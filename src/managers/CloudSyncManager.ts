/**
 * 云同步管理器 —— HTTP 版
 *
 * 对接 CloudBase HTTP 访问服务（见 src/core/BackendService.ts）。
 * 逻辑保留：
 *   - 启动时拉云端 + 本地合并（updatedAt 比较决定上/下行）
 *   - 本地脏标记订阅 + 防抖
 *   - 连续失败指数退避 / 低频重试
 *
 * 每平台独立身份（wx:/dy:/anon: 前缀），不互通；闸门改用 Platform.canUseBackend。
 */

import {
  CLOUD_SYNC_BASE_DELAY_MS,
  CLOUD_SYNC_DEBOUNCE_MS,
  CLOUD_SYNC_LOG_THRESHOLD,
  CLOUD_SYNC_MAX_BACKOFF_MS,
  CLOUD_SYNC_MAX_FAIL_COUNT,
  CLOUD_SYNC_RETRY_INTERVAL_MS,
  CLOUD_SYNC_STARTUP_TIMEOUT_MS,
} from '@/config/CloudConfig';
import { BackendError, BackendService } from '@/core/BackendService';
import { PersistService } from '@/core/PersistService';
import { Platform } from '@/core/PlatformService';

class CloudSyncManagerClass {
  private _initPromise: Promise<void> | null = null;
  private _startupPromise: Promise<void> | null = null;
  private _cloudReady = false;
  private _initDone = false;
  private _syncTimer: ReturnType<typeof setTimeout> | null = null;
  private _retryTimer: ReturnType<typeof setInterval> | null = null;
  private _syncFailCount = 0;
  private _syncDisabled = false;
  private _syncing = false;
  private _syncPending = false;

  constructor() {
    PersistService.subscribe((changedKeys) => {
      if (changedKeys.length === 0) return;
      this.scheduleSync(`dirty:${changedKeys.length}`);
    });
  }

  get enabled(): boolean {
    return BackendService.available;
  }

  get ready(): boolean {
    return this._cloudReady;
  }

  get userId(): string {
    return BackendService.userId;
  }

  prewarm(): void {
    if (!this.enabled) {
      console.log('[CloudSync] prewarm 跳过: enabled=false, platform=', Platform.name);
      return;
    }
    if (!this._startupPromise) {
      console.log('[CloudSync] prewarm 开始初始化');
      this._startupPromise = this._initialize();
    }
  }

  async awaitStartupSync(timeoutMs = CLOUD_SYNC_STARTUP_TIMEOUT_MS): Promise<void> {
    if (!this.enabled) return;
    this.prewarm();
    if (!this._startupPromise) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    await Promise.race([
      this._startupPromise.catch(() => undefined),
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, timeoutMs);
      }),
    ]);
    if (timer) clearTimeout(timer);
  }

  scheduleSync(reason = 'debounce'): void {
    if (!this.enabled) return;

    this.prewarm();

    if (!this._initDone) {
      this._syncPending = true;
      return;
    }

    if (!this._cloudReady || this._syncDisabled) return;

    if (this._syncTimer) {
      clearTimeout(this._syncTimer);
    }

    const delay = this._syncFailCount > 0
      ? Math.min(CLOUD_SYNC_BASE_DELAY_MS * Math.pow(2, this._syncFailCount - 1), CLOUD_SYNC_MAX_BACKOFF_MS)
      : CLOUD_SYNC_DEBOUNCE_MS;

    this._syncTimer = setTimeout(() => {
      this._syncTimer = null;
      void this._syncToCloud(reason);
    }, delay);
  }

  async flushNow(reason = 'manual'): Promise<void> {
    if (!this.enabled) return;

    this.prewarm();

    if (this._startupPromise) {
      try {
        await this._startupPromise;
      } catch (_) {}
    }

    if (!this._cloudReady) return;

    if (this._syncTimer) {
      clearTimeout(this._syncTimer);
      this._syncTimer = null;
    }

    await this._syncToCloud(reason, true);
  }

  private async _initialize(): Promise<void> {
    if (this._initPromise) return this._initPromise;

    this._initPromise = (async () => {
      try {
        console.log('[CloudSync] 初始化中... platform:', Platform.name);
        await BackendService.ensureToken();
        this._cloudReady = !!BackendService.userId;

        if (!this._cloudReady) {
          console.warn('[CloudSync] 未能获取 token/userId，继续使用本地存档');
          return;
        }

        console.log('[CloudSync] 云同步就绪! userId:', BackendService.userId);
        await this._pullFromCloudOnStartup();
      } catch (e) {
        console.warn('[CloudSync] 初始化失败，继续使用本地存档:', e);
      } finally {
        this._initDone = true;
        if (this._syncPending && this._cloudReady) {
          this._syncPending = false;
          this.scheduleSync('pending-after-init');
        }
      }
    })();

    return this._initPromise;
  }

  private async _pullFromCloudOnStartup(): Promise<void> {
    let remote;
    try {
      remote = await BackendService.pullSave();
    } catch (e) {
      console.warn('[CloudSync] 启动拉取失败，保持本地存档:', e);
      // 拉取失败但已登录：本地若有脏数据仍尝试上行（下一轮同步时会再走 push）
      if (PersistService.isCloudDirty()) {
        this.scheduleSync('startup-pull-failed');
      }
      return;
    }

    const localSnapshot = PersistService.exportCloudSnapshot();

    if (!remote.exists) {
      if (localSnapshot.payloadKeys.length > 0) {
        this.scheduleSync('startup-no-remote-doc');
      }
      return;
    }

    const remoteUpdatedAt = Number(remote.updatedAt) || 0;
    const remotePayloadKeys = Array.isArray(remote.payloadKeys)
      ? remote.payloadKeys
      : Object.keys(remote.payload || {});

    const shouldApplyRemote = remotePayloadKeys.length > 0
      && (localSnapshot.payloadKeys.length === 0 || remoteUpdatedAt > localSnapshot.updatedAt);

    if (shouldApplyRemote) {
      PersistService.importCloudSnapshot({
        updatedAt: remoteUpdatedAt,
        payload: remote.payload || {},
      });
      console.log(`[CloudSync] 启动期已从云端恢复 ${remotePayloadKeys.length} 个 key`);
      return;
    }

    if (localSnapshot.payloadKeys.length > 0 && localSnapshot.updatedAt > remoteUpdatedAt) {
      this.scheduleSync('startup-local-newer');
      return;
    }

    if (PersistService.isCloudDirty()) {
      this.scheduleSync('startup-local-dirty');
    }
  }

  private async _syncToCloud(reason: string, force = false): Promise<void> {
    if (!this._cloudReady) return;
    if (!force && this._syncDisabled) return;

    if (this._syncing) {
      this._syncPending = true;
      return;
    }

    this._syncing = true;

    try {
      const snapshot = PersistService.exportCloudSnapshot();
      const hasDirty = PersistService.isCloudDirty();

      if (!hasDirty && snapshot.payloadKeys.length === 0) {
        return;
      }

      if (snapshot.updatedAt <= 0) {
        PersistService.touchCloudMeta();
      }

      const finalSnapshot = PersistService.exportCloudSnapshot();

      try {
        const res = await BackendService.pushSave({
          schemaVersion: finalSnapshot.schemaVersion,
          updatedAt: finalSnapshot.updatedAt,
          clientFingerprint: this._buildClientFingerprint(),
          payload: finalSnapshot.payload,
        });

        PersistService.markCloudSynced(res.updatedAt || finalSnapshot.updatedAt);

        if (this._syncFailCount > 0) {
          console.log('[CloudSync] 云同步恢复成功');
        }
        console.log(
          `[CloudSync] 云端已同步 reason=${reason}, keys=${finalSnapshot.payloadKeys.length}, size=${res.sizeBytes ?? finalSnapshot.sizeBytes}B`,
        );

        this._syncFailCount = 0;
        this._syncDisabled = false;
        if (this._retryTimer) {
          clearInterval(this._retryTimer);
          this._retryTimer = null;
        }
      } catch (e) {
        if (e instanceof BackendError && e.code === 'STALE_UPDATE' && e.data?.remote) {
          // 服务端版本更新 → 下行覆盖，重置失败计数
          const remote = e.data.remote as {
            updatedAt?: number;
            payload?: Record<string, string>;
          };
          console.warn('[CloudSync] 服务端版本更新，改为下行覆盖本地');
          PersistService.importCloudSnapshot({
            updatedAt: Number(remote.updatedAt) || Date.now(),
            payload: remote.payload || {},
          });
          this._syncFailCount = 0;
          this._syncDisabled = false;
          return;
        }
        throw e;
      }
    } catch (e: any) {
      this._syncFailCount += 1;
      if (this._syncFailCount <= CLOUD_SYNC_LOG_THRESHOLD) {
        console.warn(
          `[CloudSync] 云同步失败(${this._syncFailCount}/${CLOUD_SYNC_MAX_FAIL_COUNT}):`,
          e?.message || e,
        );
      }

      if (this._syncFailCount >= CLOUD_SYNC_MAX_FAIL_COUNT) {
        this._syncDisabled = true;
        if (!this._retryTimer) {
          console.warn('[CloudSync] 连续失败，进入低频重试模式（本地存档仍正常可用）');
          this._retryTimer = setInterval(() => {
            if (!this._syncing && PersistService.isCloudDirty()) {
              void this._syncToCloud('retry-interval', true);
            }
          }, CLOUD_SYNC_RETRY_INTERVAL_MS);
        }
      }
    } finally {
      this._syncing = false;
      if (this._syncPending && !this._syncDisabled) {
        this._syncPending = false;
        this.scheduleSync('pending-resume');
      }
    }
  }

  private _buildClientFingerprint(): string {
    const info = Platform.getSystemInfoSync() || {};
    return [
      Platform.name,
      info.brand,
      info.model,
      info.platform,
      info.version,
    ]
      .filter(Boolean)
      .join('|')
      .slice(0, 160);
  }
}

export const CloudSyncManager = new CloudSyncManagerClass();
