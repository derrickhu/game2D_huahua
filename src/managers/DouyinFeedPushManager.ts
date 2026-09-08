/**
 * 抖音推荐流直玩 · 复访（体力恢复）
 *
 * 只在抖音端生效：微信 `init()` 直接返回，不注册监听、不调 tt API。
 * 就绪走平台托管 `storeFeedData`（回满时间戳），不回查自建服务端。
 */
import { DOUYIN_FEED_PUSH } from '@/config/DouyinFeedPushConfig';
import { ENABLE_DOUYIN_FEED_PUSH } from '@/config/FeatureFlags';
import { STAMINA_RECOVER_INTERVAL } from '@/config/Constants';
import { EventBus } from '@/core/EventBus';
import { Platform } from '@/core/PlatformService';
import { CurrencyManager } from './CurrencyManager';
import { TutorialManager } from './TutorialManager';

declare const GameGlobal: {
  __launchInfo?: {
    scene?: string;
    query?: Record<string, unknown>;
  };
} | undefined;

const SYNC_DEBOUNCE_MS = 800;
const FAR_FUTURE_MS = 10 * 365 * 24 * 3600 * 1000;

function isFeedLaunchScene(scene?: string): boolean {
  return typeof scene === 'string' && scene.length >= 4 && scene.slice(-4) === DOUYIN_FEED_PUSH.launchSceneSuffix;
}

function readQuery(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!key) continue;
    out[key] = value === undefined || value === null ? '' : String(value);
  }
  return out;
}

function toInt(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

class DouyinFeedPushManagerClass {
  private _inited = false;
  private _runtimeBound = false;
  private _bootAt = 0;
  private _feedLaunch = false;
  private _feedScene = 0;
  private _feedChannel = 0;
  private _feedContentId = '';
  private _entered = false;
  private _interactiveReported = false;
  private _subscribeArmed = false;
  private _subscribeSupported: boolean | null = null;
  private _subscribed: boolean | null = null;
  private _syncTimer: ReturnType<typeof setTimeout> | null = null;
  private _lastStoreKey = '';
  private _sessionStartHandler: (() => void) | null = null;
  private _sessionStarted = false;
  private _feedStatusSupported = false;
  private _nativeTouchEnd = false;
  private _loginPromise: Promise<void> | null = null;

  get enabled(): boolean {
    return Platform.isDouyin && ENABLE_DOUYIN_FEED_PUSH;
  }

  get isFeedLaunch(): boolean {
    return this.enabled && this._feedLaunch;
  }

  /** 推荐流预启动：游戏已加载，用户还没点「继续游戏」 */
  get isPreview(): boolean {
    return this.isFeedLaunch && !this._entered;
  }

  get shouldDeferSessionStart(): boolean {
    return this.isPreview;
  }

  get shouldSuppressLaunchPopups(): boolean {
    return this.isPreview;
  }

  get subscribeSupported(): boolean {
    return this._subscribeSupported === true;
  }

  get subscribed(): boolean {
    return this._subscribed === true;
  }

  get canShowSubscribeEntry(): boolean {
    return this.enabled && this._subscribeSupported === true && this._subscribed !== true;
  }

  /** 推荐流 query.feed_game_scene：2 = 体力恢复 */
  get feedGameScene(): number {
    return this._feedScene;
  }

  analyticsLaunchParams(): Record<string, string | number | boolean> {
    if (!this.enabled) return {};
    return {
      feed_launch: this._feedLaunch,
      feed_game_scene: this._feedScene,
      feed_content_id: this._feedContentId,
      feed_channel: this._feedChannel,
    };
  }

  init(): void {
    if (this._inited) return;
    this._inited = true;
    this._bootAt = Date.now();
    if (!this.enabled) return;

    this._captureLaunch(this._readLaunchOptions());
    this._feedStatusSupported = Platform.hasNativeApi('onFeedStatusChange')
      || Platform.canIUse('onFeedStatusChange');

    if (this._feedLaunch) {
      if (this._feedStatusSupported) {
        Platform.onFeedStatusChange(this._onFeedStatusChange);
      }
    } else {
      this._entered = true;
    }

    this._nativeTouchEnd = Platform.hasNativeApi('onTouchEnd');
    Platform.onTouchEnd(this._onNativeTouchEnd);
    Platform.onShow((res?: any) => this._onHostShow(res));
    console.log(
      `[DouyinFeed] init feedLaunch=${this._feedLaunch} scene=${this._feedScene} content=${this._feedContentId}`,
    );
  }

  /** 存档就绪后再听体力、写托管就绪。微信不会进来。 */
  bindAfterSave(): void {
    if (!this.enabled || this._runtimeBound) return;
    this._runtimeBound = true;
    EventBus.on('currency:changed', this._onCurrencyChanged);
    EventBus.on('currency:loaded', this._onCurrencyLoaded);
    EventBus.on('tutorial:completed', this._onTutorialCompleted);
    void this._ensureHostLogin().then(() => {
      this.syncReadyState('save-ready');
      void this.refreshSubscribeStatus();
    });
  }

  reportInteractiveReady(): void {
    if (!this.enabled || this._interactiveReported) return;
    if (!Platform.hasNativeApi('reportScene') && !Platform.canIUse('reportScene')) {
      console.warn('[DouyinFeed] reportScene 不可用，推荐流可能不出卡');
      return;
    }
    this._interactiveReported = true;
    const costTime = Math.max(0, Date.now() - this._bootAt);
    Platform.reportScene({
      sceneId: DOUYIN_FEED_PUSH.reportSceneId,
      costTime,
      success: () => console.log(`[DouyinFeed] reportScene ${DOUYIN_FEED_PUSH.reportSceneId} ok cost=${costTime}`),
      fail: (err) => console.warn('[DouyinFeed] reportScene fail', err),
    });
  }

  onAppHide(): void {
    if (!this.enabled) return;
    this.syncReadyState('app-hide', true);
  }

  setSessionStartHandler(handler: () => void): void {
    this._sessionStartHandler = handler;
    if (this._entered) this._flushSessionStart();
  }

  armSubscribeOnTouchEnd(): void {
    if (!this.enabled || !this.canShowSubscribeEntry) return;
    this._subscribeArmed = true;
  }

  /** 无原生 onTouchEnd 时，同一手势 pointerup 补一次；有原生则等官方手势回调 */
  notifySubscribePointerUp(): void {
    if (!this._subscribeArmed || this._nativeTouchEnd) return;
    this._fireSubscribe();
  }

  refreshSubscribeStatus(): Promise<boolean> {
    if (!this.enabled) return Promise.resolve(false);
    const allSceneOk = Platform.canIUse('checkFeedSubscribeStatus.object.allScene');
    const apiOk = Platform.hasNativeApi('checkFeedSubscribeStatus');
    if (!allSceneOk && !apiOk) {
      this._subscribeSupported = false;
      this._subscribed = null;
      EventBus.emit('douyinFeed:subscribeChanged');
      return Promise.resolve(false);
    }
    this._subscribeSupported = true;
    return this._ensureHostLogin().then(() => new Promise((resolve) => {
      Platform.checkFeedSubscribeStatus({
        type: 'play',
        allScene: true,
        success: (res) => {
          const status = res?.status ?? res?.data?.status;
          this._subscribed = status === true;
          EventBus.emit('douyinFeed:subscribeChanged');
          resolve(this._subscribed);
        },
        fail: (err) => {
          console.warn('[DouyinFeed] checkFeedSubscribeStatus fail', err);
          this._subscribeSupported = false;
          EventBus.emit('douyinFeed:subscribeChanged');
          resolve(false);
        },
      });
    }));
  }

  /**
   * 计算体力回满时间并写入托管。
   * 已满 / 教程中：status=0，避免误召回。
   */
  syncReadyState(reason: string, immediate = false): void {
    if (!this.enabled) return;
    if (this._syncTimer) {
      clearTimeout(this._syncTimer);
      this._syncTimer = null;
    }
    const run = () => {
      this._syncTimer = null;
      this._storeReadyNow(reason);
    };
    if (immediate) run();
    else this._syncTimer = setTimeout(run, SYNC_DEBOUNCE_MS);
  }

  private _onCurrencyChanged = (type?: string): void => {
    if (type && type !== 'stamina' && type !== 'level') return;
    this.syncReadyState(`currency:${type || 'stamina'}`);
  };

  private _onCurrencyLoaded = (): void => {
    this.syncReadyState('currency-loaded', true);
  };

  private _onTutorialCompleted = (): void => {
    this.syncReadyState('tutorial-completed', true);
  };

  private _ensureHostLogin(): Promise<void> {
    if (!this._loginPromise) {
      this._loginPromise = Platform.loginCredentials().then(() => undefined);
    }
    return this._loginPromise;
  }

  private _storeReadyNow(reason: string): void {
    if (!Platform.hasNativeApi('storeFeedData') && !Platform.canIUse('storeFeedData')) return;
    void this._ensureHostLogin().then(() => this._writeStoreFeedData(reason));
  }

  private _writeStoreFeedData(reason: string): void {
    const cap = CurrencyManager.staminaCap;
    const cur = CurrencyManager.state.stamina;
    const full = cur >= cap || TutorialManager.isActive;
    const readyAt = full ? Date.now() + FAR_FUTURE_MS : this._computeReadyAtMs(cap, cur);
    const status = full ? 0 : 1;
    const key = `${status}:${Math.floor(readyAt / 1000)}`;
    if (key === this._lastStoreKey && reason !== 'app-hide') return;
    this._lastStoreKey = key;

    Platform.storeFeedData({
      scene: DOUYIN_FEED_PUSH.scene,
      contentID: DOUYIN_FEED_PUSH.contentId,
      leftValue: 'timeStampMs',
      operator: '>=',
      rightValue: String(readyAt),
      status,
      extra: `stamina=${cur}/${cap};reason=${reason}`,
      success: () => {
        console.log(`[DouyinFeed] storeFeedData ok status=${status} readyAt=${readyAt} reason=${reason}`);
      },
      fail: (err) => {
        this._lastStoreKey = '';
        console.warn('[DouyinFeed] storeFeedData fail', err);
      },
    });
  }

  private _computeReadyAtMs(cap: number, cur: number): number {
    const pointsLeft = Math.max(0, cap - cur);
    if (pointsLeft <= 0) return Date.now();
    const remainSec = CurrencyManager.staminaRecoverRemain;
    const totalSec = (pointsLeft - 1) * STAMINA_RECOVER_INTERVAL + remainSec;
    return Date.now() + Math.max(0, totalSec) * 1000;
  }

  private _readLaunchOptions(): { scene?: string; query?: Record<string, unknown> } {
    const fromGlobal = GameGlobal?.__launchInfo;
    const launch = Platform.getLaunchOptionsSync?.() || null;
    const enter = Platform.getEnterOptionsSync?.() || null;
    return enter || launch || fromGlobal || {};
  }

  private _captureLaunch(opts: { scene?: string; query?: Record<string, unknown> }): void {
    const query = readQuery(opts?.query);
    this._feedLaunch = isFeedLaunchScene(opts?.scene);
    this._feedScene = toInt(query.feed_game_scene);
    this._feedChannel = toInt(query.feed_game_channel);
    this._feedContentId = query.feed_game_content_id || '';
    if (this._feedLaunch && this._feedScene === 0) {
      this._feedScene = DOUYIN_FEED_PUSH.scene;
    }
  }

  private _onHostShow = (res?: any): void => {
    if (!this.enabled || !res) return;
    if (typeof GameGlobal !== 'undefined') {
      GameGlobal.__launchInfo = res;
    }
    if (this._entered) return;
    if (isFeedLaunchScene(res.scene)) {
      this._captureLaunch(res);
    }
  };

  private _onFeedStatusChange = (res?: { type?: string; data?: { type?: string } }): void => {
    const type = res?.type || res?.data?.type;
    if (type === 'feedEnter') {
      this._markEntered('feedEnter');
    }
  };

  private _onNativeTouchEnd = (): void => {
    if (this._subscribeArmed) {
      this._fireSubscribe();
    }
    if (this.isPreview && !this._feedStatusSupported) {
      this._markEntered('first-touch');
    }
  };

  private _fireSubscribe(): void {
    if (!this._subscribeArmed) return;
    this._subscribeArmed = false;
    if (!this.enabled) return;
    Platform.requestFeedSubscribe({
      type: 'play',
      allScene: true,
      success: (res) => {
        const ok = (res?.success ?? res?.data?.success) !== false;
        this._subscribed = ok;
        EventBus.emit('douyinFeed:subscribeChanged', ok);
        console.log(`[DouyinFeed] requestFeedSubscribe success=${ok}`);
        if (ok) void this.refreshSubscribeStatus();
      },
      fail: (err) => {
        console.warn('[DouyinFeed] requestFeedSubscribe fail', err);
        EventBus.emit('douyinFeed:subscribeChanged', false);
      },
    });
  }

  private _markEntered(reason: string): void {
    if (this._entered) return;
    this._entered = true;
    console.log(`[DouyinFeed] real enter via ${reason}`);
    EventBus.emit('douyinFeed:entered', reason);
    this._flushSessionStart();
  }

  private _flushSessionStart(): void {
    if (this._sessionStarted || !this._entered) return;
    if (!this._sessionStartHandler) return;
    this._sessionStarted = true;
    const fn = this._sessionStartHandler;
    this._sessionStartHandler = null;
    try {
      fn();
    } catch (e) {
      console.warn('[DouyinFeed] session start handler', e);
    }
  }
}

export const DouyinFeedPushManager = new DouyinFeedPushManagerClass();
