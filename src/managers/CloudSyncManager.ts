import {
  CLOUD_ENV_ID,
  CLOUD_PLAYER_DATA_COLLECTION,
  CLOUD_SYNC_BASE_DELAY_MS,
  CLOUD_SYNC_DEBOUNCE_MS,
  CLOUD_SYNC_FUNCTIONS,
  CLOUD_SYNC_LOG_THRESHOLD,
  CLOUD_SYNC_MAX_BACKOFF_MS,
  CLOUD_SYNC_MAX_FAIL_COUNT,
  CLOUD_SYNC_RETRY_INTERVAL_MS,
  CLOUD_SYNC_STARTUP_TIMEOUT_MS,
} from '@/config/CloudConfig';
import { PersistService } from '@/core/PersistService';
import { Platform } from '@/core/PlatformService';

interface CloudPlayerDataDoc {
  _id?: string;
  _openid?: string;
  schemaVersion?: number;
  updatedAt?: number;
  clientFingerprint?: string;
  payload?: Record<string, string>;
  payloadKeys?: string[];
}

class CloudSyncManagerClass {
  private _initPromise: Promise<void> | null = null;
  private _startupPromise: Promise<void> | null = null;
  private _cloudReady = false;
  private _initDone = false;
  private _openid = '';
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
    return Platform.isWechat;
  }

  get ready(): boolean {
    return this._cloudReady;
  }

  get openid(): string {
    return this._openid;
  }

  prewarm(): void {
    if (!this.enabled) {
      console.log('[CloudSync] prewarm 跳过: enabled=false, isWechat=', Platform.isWechat);
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
        console.log('[CloudSync] 初始化中... env:', CLOUD_ENV_ID, 'supportsCloud:', Platform.supportsCloud);
        const inited = Platform.initCloud({ env: CLOUD_ENV_ID, traceUser: true });
        if (!inited) {
          console.warn('[CloudSync] 微信云开发初始化不可用，继续使用本地存档');
          return;
        }
        console.log('[CloudSync] 云环境初始化成功，开始创建集合...');

        await this._ensureCollections();
        console.log('[CloudSync] 集合检查完成，获取 openid...');
        this._openid = await this._getOpenid();
        this._cloudReady = !!this._openid;

        if (!this._cloudReady) {
          console.warn('[CloudSync] openid 获取失败，继续使用本地存档');
          return;
        }

        console.log('[CloudSync] 云同步就绪! openid:', this._openid.slice(0, 8) + '...');
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
    const docs = await this._queryPlayerDocs();
    const localSnapshot = PersistService.exportCloudSnapshot();

    if (docs.length === 0) {
      if (localSnapshot.payloadKeys.length > 0) {
        this.scheduleSync('startup-no-remote-doc');
      }
      return;
    }

    const primary = [...docs].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0];
    const remotePayloadKeys = Array.isArray(primary.payloadKeys)
      ? primary.payloadKeys
      : Object.keys(primary.payload || {});
    const remoteUpdatedAt = typeof primary.updatedAt === 'number' ? primary.updatedAt : 0;

    if (docs.length > 1 && primary._id) {
      await this._cleanupDuplicateDocs(docs, primary._id);
    }

    const shouldApplyRemote = remotePayloadKeys.length > 0
      && (localSnapshot.payloadKeys.length === 0 || remoteUpdatedAt > localSnapshot.updatedAt);

    if (shouldApplyRemote) {
      PersistService.importCloudSnapshot({
        updatedAt: remoteUpdatedAt,
        payload: primary.payload || {},
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
      const docData = {
        schemaVersion: finalSnapshot.schemaVersion,
        updatedAt: finalSnapshot.updatedAt,
        clientFingerprint: this._buildClientFingerprint(),
        payload: finalSnapshot.payload,
        payloadKeys: finalSnapshot.payloadKeys,
      };

      const db = Platform.getCloudDatabase();
      if (!db) {
        throw new Error('cloud database unavailable');
      }

      const collection = db.collection(CLOUD_PLAYER_DATA_COLLECTION);
      const docs = await this._queryPlayerDocs();

      if (docs.length > 1) {
        const primary = [...docs].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0];
        await collection.doc(primary._id).update({ data: docData });
        await this._cleanupDuplicateDocs(docs, primary._id!);
      } else if (docs.length === 1 && docs[0]._id) {
        await collection.doc(docs[0]._id).update({ data: docData });
      } else {
        await collection.add({ data: docData });
      }

      PersistService.markCloudSynced(finalSnapshot.updatedAt);

      if (this._syncFailCount > 0) {
        console.log('[CloudSync] 云同步恢复成功');
      }
      console.log(
        `[CloudSync] 云端已同步 reason=${reason}, keys=${finalSnapshot.payloadKeys.length}, size=${finalSnapshot.sizeBytes}B`,
      );

      this._syncFailCount = 0;
      this._syncDisabled = false;
      if (this._retryTimer) {
        clearInterval(this._retryTimer);
        this._retryTimer = null;
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

  private async _ensureCollections(): Promise<void> {
    try {
      const res = await Platform.callCloudFunction({
        name: CLOUD_SYNC_FUNCTIONS.initCollections,
      });
      const errors = res?.result?.errors;
      if (Array.isArray(errors) && errors.length > 0) {
        console.warn('[CloudSync] 初始化集合存在异常:', errors);
      }
    } catch (e) {
      console.warn('[CloudSync] 初始化集合失败:', e);
    }
  }

  private async _getOpenid(): Promise<string> {
    const res = await Platform.callCloudFunction({
      name: CLOUD_SYNC_FUNCTIONS.getOpenid,
    });
    const openid = res?.result?.openid || '';
    console.log('[CloudSync] 当前用户 openid:', openid);
    return openid;
  }

  private async _queryPlayerDocs(): Promise<CloudPlayerDataDoc[]> {
    if (!this._openid) return [];

    const db = Platform.getCloudDatabase();
    if (!db) return [];

    const res = await db.collection(CLOUD_PLAYER_DATA_COLLECTION).where({ _openid: this._openid }).get();
    return Array.isArray(res?.data) ? res.data as CloudPlayerDataDoc[] : [];
  }

  private async _cleanupDuplicateDocs(docs: CloudPlayerDataDoc[], keepId: string): Promise<void> {
    if (!keepId) return;

    const db = Platform.getCloudDatabase();
    if (!db) return;

    const collection = db.collection(CLOUD_PLAYER_DATA_COLLECTION);
    const duplicates = docs.filter((doc) => doc._id && doc._id !== keepId);

    for (const doc of duplicates) {
      try {
        await collection.doc(doc._id).remove();
      } catch (e) {
        console.warn('[CloudSync] 清理重复云存档失败:', e);
      }
    }

    if (duplicates.length > 0) {
      console.log(`[CloudSync] 已清理 ${duplicates.length} 条重复云存档`);
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
