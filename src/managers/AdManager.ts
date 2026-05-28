/**
 * 广告管理器 - 微信/抖音双平台广告统一管理
 *
 * 支持：
 * - 激励视频广告（体力恢复、CD加速等）
 * - 插屏广告（场景切换间隙）
 * - Banner 广告（预留位）
 *
 * 广告位 ID 配置：
 * - 微信和抖音使用不同的 adUnitId
 * - 上线前在 AdConfig 中填入真实 ID
 */
import { Platform } from '@/core/PlatformService';
import { EventBus } from '@/core/EventBus';
import { analytics, EVENT_NAMES } from '@/analytics';
import { AD_UNIT_CONFIG, type PlatformAdUnitConfig } from '@/config/AdConfig';

const AD_TYPE = 'reward';
/**
 * SDK 自定义错误码（与 wx / tt 的真实 errCode 共存于同一个 err_code 字段）：
 * 用 -100 段负数与平台真实码区分（dashboard 上按 err_code < -99 即"我们自己生成"）。
 * 维护规则同 hot-pot 经验：同一次播放周期内 onError 与 show().catch() 双通路只允许打一次 ad_error。
 */
const AD_ERR_BUSY = -101;
const AD_ERR_NO_AD = -102;
const AD_ERR_DEV_MODE = -103;

/** 广告场景枚举 */
export enum AdScene {
  STAMINA_RECOVER  = 'stamina_recover',   // 体力恢复
  CD_SPEEDUP       = 'cd_speedup',        // 建筑CD加速
  EXTRA_REWARD     = 'extra_reward',      // 额外奖励
  REVIVE           = 'revive',            // 挑战复活
  FREE_CHEST       = 'free_chest',        // 免费开箱
  MERCH_SHOP       = 'merch_shop',        // 主场景内购商店广告购
  BOARD_CELL_UNLOCK = 'board_cell_unlock',
  WAREHOUSE_SLOT_UNLOCK = 'warehouse_slot_unlock',
  SPECIAL_DECO_UNLOCK = 'special_deco_unlock',
  /** 宣传款家具等（独立广告位，见 AdConfig `promo_furniture_unlock`） */
  PROMO_FURNITURE_UNLOCK = 'promo_furniture_unlock',
  MERCH_DAILY_REFRESH = 'merch_daily_refresh',
  FLOWER_SIGN_DAILY_DRAW = 'flower_sign_daily_draw',
  WAREHOUSE_ORGANIZE = 'warehouse_organize',
  REWARD_BOX_ORGANIZE = 'reward_box_organize',
  MERGE_BUBBLE_UNLOCK = 'merge_bubble_unlock',
  /** 每日签到完成后加餐（体力+钻石） */
  CHECKIN_AD_BONUS = 'checkin_ad_bonus',
  NEWBIE_GIFT_PACK = 'newbie_gift_pack',
}

export type AdFailReason =
  | 'busy'
  | 'no_ad'
  | 'load_failed'
  | 'show_failed'
  | 'skipped';

type AdCallback = (success: boolean, reason?: AdFailReason) => void;

export function showRewardedAdAsync(scene: AdScene): Promise<boolean> {
  return new Promise((resolve) => {
    AdManager.showRewardedAd(scene, resolve);
  });
}

class AdManagerClass {
  private _adConfig: PlatformAdUnitConfig | null = null;
  private _rewardedAds = new Map<string, any>();
  private _loadedRewardedAdUnits = new Set<string>();
  private _interstitialAd: any = null;
  private _bannerAd: any = null;
  private _isAdShowing = false;
  private _pendingCallback: AdCallback | null = null;
  private _pendingScene: AdScene | null = null;
  private _pendingAdUnitId: string | null = null;
  /**
   * 单次播放周期内是否已上报过 ad_error。
   * 抖音 / 微信都会在 ad.show() 失败时同时触发 onError 与 show().catch() 两条通路，
   * 任由它们各自上报会让 ad_error 翻倍（hot-pot 实测过 144×2=288 的离群样本）。
   * 用 cycle 标志保证同一次播放周期内 ad_error 只打一次。
   */
  private _errorReportedThisCycle = false;

  /** 开发模式：没有真实广告时模拟成功 */
  private _devMode = true;

  /** 广告统计 */
  private _stats = {
    totalShown: 0,
    totalCompleted: 0,
    todayShown: 0,
    lastResetDate: '',
  };

  init(): void {
    if (!Platform.isMinigame) {
      console.log('[AdManager] 非小游戏环境，使用开发模式');
      this._devMode = true;
      return;
    }

    const config = Platform.name === 'wechat' ? AD_UNIT_CONFIG.wechat
      : Platform.name === 'douyin' ? AD_UNIT_CONFIG.douyin
      : null;

    if (!config) {
      console.log('[AdManager] 未知平台，使用开发模式');
      this._devMode = true;
      return;
    }

    // 检查是否配置了真实广告位 ID
    if (config.rewardedVideo.includes('xxxx')) {
      console.log('[AdManager] 广告位ID未配置，使用开发模式');
      this._devMode = true;
      return;
    }

    this._devMode = false;
    this._adConfig = config;

    // 创建插屏广告
    this._interstitialAd = Platform.createInterstitialAd(config.interstitial);
    if (this._interstitialAd) {
      this._interstitialAd.onLoad(() => {
        console.log('[AdManager] 插屏广告加载成功');
      });
      this._interstitialAd.onError((err: any) => {
        console.warn('[AdManager] 插屏广告错误:', err?.errMsg || err?.message || String(err));
      });
    }

    console.log(`[AdManager] 初始化完成, 平台=${Platform.name}, devMode=${this._devMode}`);
  }

  /** 是否可以展示激励视频 */
  get canShowRewardedAd(): boolean {
    if (this._isAdShowing) return false;
    if (this._devMode) return true;
    return !!this._adConfig && this._rewardedAds.size > 0;
  }

  /** 是否处于开发模式 */
  get isDevMode(): boolean {
    return this._devMode;
  }

  // ═══════════════ 经分埋点辅助（所有真机广告流程都过这一组） ═══════════════

  private _trackAd(eventName: string, scene: AdScene, adUnitId: string | null, extras?: Record<string, string | number | boolean>): void {
    try {
      analytics.track(eventName, {
        ad_unit_id: adUnitId || '',
        ad_type: AD_TYPE,
        scene,
        ...(extras ?? {}),
      });
    } catch (_) {
      // 埋点失败不能影响业务
    }
  }

  /** 同一次播放周期内只允许打一次 ad_error，避免 onError + show().catch() 双计。 */
  private _reportAdErrorOnce(scene: AdScene, adUnitId: string | null, errCode: number, errMsg: string): void {
    if (this._errorReportedThisCycle) return;
    this._errorReportedThisCycle = true;
    this._trackAd(EVENT_NAMES.AD_ERROR, scene, adUnitId, {
      err_code: errCode,
      err_msg: errMsg || 'unknown',
    });
  }

  /**
   * 展示激励视频广告
   * @param scene 广告场景（用于统计）
   * @param callback 回调 (success: boolean)
   */
  showRewardedAd(scene: AdScene, callback: AdCallback): void {
    if (this._isAdShowing) {
      console.warn('[AdManager] 已有广告正在展示，忽略新请求:', scene);
      // 复用一个 ad_error.err_code=-101 表示业务并发冲突，dashboard 按 err_code 区分平台/SDK 错误。
      this._trackAd(EVENT_NAMES.AD_ERROR, scene, this._pendingAdUnitId, {
        err_code: AD_ERR_BUSY,
        err_msg: 'busy',
      });
      callback(false, 'busy');
      return;
    }

    this._checkDailyReset();
    this._stats.totalShown++;
    this._stats.todayShown++;

    EventBus.emit('ad:show', scene);

    if (this._devMode) {
      // 开发模式：模拟 500ms 后广告完成。只打 ad_error（dev_mode 标记），不打 ad_request/show/close，
      // 避免污染真实 eCPM × 曝光数的收益估算。dashboard 按 err_code=-103 过滤即可。
      console.log(`[AdManager] [DEV] 模拟激励视频广告 (场景: ${scene})`);
      this._trackAd(EVENT_NAMES.AD_ERROR, scene, null, {
        err_code: AD_ERR_DEV_MODE,
        err_msg: 'dev_mode_simulation',
      });
      this._isAdShowing = true;
      setTimeout(() => {
        this._isAdShowing = false;
        this._stats.totalCompleted++;
        callback(true);
        EventBus.emit('ad:completed', scene);
      }, 500);
      return;
    }

    const adUnitId = this._rewardedAdUnitIdForScene(scene);
    // 经分 ad_request：在调 createRewardedVideoAd().load() 前打。dev_mode 不打，避免曝光数虚高。
    this._trackAd(EVENT_NAMES.AD_REQUEST, scene, adUnitId);

    const rewardedAd = adUnitId ? this._getOrCreateRewardedAd(adUnitId) : null;
    if (!rewardedAd) {
      console.warn('[AdManager] 广告实例不存在');
      this._trackAd(EVENT_NAMES.AD_ERROR, scene, adUnitId, {
        err_code: AD_ERR_NO_AD,
        err_msg: 'no_ad_instance',
      });
      callback(false, 'no_ad');
      return;
    }

    this._pendingCallback = callback;
    this._pendingScene = scene;
    this._pendingAdUnitId = adUnitId;
    this._isAdShowing = true;
    // 重置一次性 cycle 标志：从这次 show() 开始，到 _finishRewardedAd 结束之间，ad_error 只打一次。
    this._errorReportedThisCycle = false;

    rewardedAd.show()
      .then(() => {
        // 真正展示成功才打 ad_show（与 ad_request 拉开漏斗，方便算 load→show 转化率）
        this._trackAd(EVENT_NAMES.AD_SHOW, scene, adUnitId);
      })
      .catch(() => {
        // 显示失败，尝试重新加载后再显示
        rewardedAd.load().then(() => {
          if (this._pendingAdUnitId !== adUnitId || !this._pendingCallback) return;
          rewardedAd.show()
            .then(() => {
              this._trackAd(EVENT_NAMES.AD_SHOW, scene, adUnitId);
            })
            .catch((err: any) => {
              console.error('[AdManager] 激励视频展示失败:', err);
              this._reportAdErrorOnce(scene, adUnitId, Number(err?.errCode ?? -1), String(err?.errMsg || 'show_failed'));
              this._finishRewardedAd(false, 'show_failed');
            });
        }).catch((err: any) => {
          console.error('[AdManager] 激励视频加载失败:', err);
          this._reportAdErrorOnce(scene, adUnitId, Number(err?.errCode ?? -1), String(err?.errMsg || 'load_failed'));
          this._finishRewardedAd(false, 'load_failed');
        });
      });
  }

  private _rewardedAdUnitIdForScene(scene: AdScene): string | null {
    if (!this._adConfig) return null;
    return this._adConfig.rewardedVideoByScene?.[scene] ?? this._adConfig.rewardedVideo;
  }

  private _getOrCreateRewardedAd(adUnitId: string): any {
    const existing = this._rewardedAds.get(adUnitId);
    if (existing) return existing;

    const ad = Platform.createRewardedVideoAd(adUnitId);
    if (!ad) return null;

    ad.onLoad(() => {
      console.log('[AdManager] 激励视频广告加载成功:', adUnitId);
      this._loadedRewardedAdUnits.add(adUnitId);
    });
    ad.onError((err: any) => {
      console.warn('[AdManager] 激励视频广告错误:', adUnitId, err);
      this._loadedRewardedAdUnits.delete(adUnitId);
      // 仅当错误归属当前正在播放的广告才上报 ad_error（避免 wx/tt 后台 prefetch 失败这类
      // 与业务无关的"无主错误"污染 scene 桶）。cycle 标志保证与 show().catch() 通路不双计。
      if (this._pendingAdUnitId === adUnitId && this._pendingScene) {
        this._reportAdErrorOnce(
          this._pendingScene,
          adUnitId,
          Number(err?.errCode ?? -1),
          String(err?.errMsg || 'unknown'),
        );
      }
      if (this._pendingAdUnitId === adUnitId && this._pendingCallback) {
        this._finishRewardedAd(false, 'load_failed');
      }
    });
    ad.onClose((res: any) => {
      if (this._pendingAdUnitId && this._pendingAdUnitId !== adUnitId) return;
      this._loadedRewardedAdUnits.delete(adUnitId);
      const isCompleted = res?.isEnded !== false;
      const scene = this._pendingScene;
      console.log('[AdManager] 激励视频关闭:', { scene, adUnitId, res, isCompleted });

      this._finishRewardedAd(isCompleted, isCompleted ? undefined : 'skipped');
      ad.load().catch(() => {});
    });

    this._rewardedAds.set(adUnitId, ad);
    ad.load().catch(() => {});
    return ad;
  }

  private _finishRewardedAd(success: boolean, reason?: AdFailReason): void {
    const callback = this._pendingCallback;
    const scene = this._pendingScene;
    const adUnitId = this._pendingAdUnitId;

    this._isAdShowing = false;
    this._pendingCallback = null;
    this._pendingScene = null;
    this._pendingAdUnitId = null;
    if (adUnitId) this._loadedRewardedAdUnits.delete(adUnitId);

    // 仅当 callback 还在（即首次进入 finish）才上报 ad_close，避免双通路触发时重复打。
    // 抖音端 res.isEnded 偶尔不返回，已在 onClose 回调里用 `res?.isEnded !== false` 兜底，
    // 这里再用 success 复刻同样逻辑：只有显式失败的 reason 才算未完整看完。
    if (callback && scene) {
      this._trackAd(EVENT_NAMES.AD_CLOSE, scene, adUnitId, {
        is_ended: success,
        ...(reason ? { reason } : {}),
      });
    }

    if (callback) callback(success, reason);

    if (success) {
      this._stats.totalCompleted++;
      EventBus.emit('ad:completed', scene);
    }
  }

  /** 展示插屏广告（场景切换时调用） */
  showInterstitialAd(): void {
    if (this._devMode) {
      console.log('[AdManager] [DEV] 跳过插屏广告');
      return;
    }

    if (this._interstitialAd) {
      this._interstitialAd.show().catch(() => {
        // 静默失败，不影响游戏流程
      });
    }
  }

  /** 展示 Banner 广告 */
  showBanner(): void {
    if (this._devMode || !this._bannerAd) return;
    try {
      this._bannerAd.show();
    } catch (_) {}
  }

  /** 隐藏 Banner 广告 */
  hideBanner(): void {
    if (!this._bannerAd) return;
    try {
      this._bannerAd.hide();
    } catch (_) {}
  }

  /** 获取今日广告统计 */
  get todayAdCount(): number {
    this._checkDailyReset();
    return this._stats.todayShown;
  }

  private _checkDailyReset(): void {
    const today = new Date().toISOString().slice(0, 10);
    if (today !== this._stats.lastResetDate) {
      this._stats.lastResetDate = today;
      this._stats.todayShown = 0;
    }
  }
}

export const AdManager = new AdManagerClass();
