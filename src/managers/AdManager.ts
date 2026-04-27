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
import { AD_UNIT_CONFIG, type PlatformAdUnitConfig } from '@/config/AdConfig';

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
}

type AdCallback = (success: boolean) => void;

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
        console.warn('[AdManager] 插屏广告错误:', err);
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

  /**
   * 展示激励视频广告
   * @param scene 广告场景（用于统计）
   * @param callback 回调 (success: boolean)
   */
  showRewardedAd(scene: AdScene, callback: AdCallback): void {
    if (this._isAdShowing) {
      console.warn('[AdManager] 已有广告正在展示，忽略新请求:', scene);
      callback(false);
      return;
    }

    this._checkDailyReset();
    this._stats.totalShown++;
    this._stats.todayShown++;

    EventBus.emit('ad:show', scene);

    if (this._devMode) {
      // 开发模式：模拟 500ms 后广告完成
      console.log(`[AdManager] [DEV] 模拟激励视频广告 (场景: ${scene})`);
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
    const rewardedAd = adUnitId ? this._getOrCreateRewardedAd(adUnitId) : null;
    if (!rewardedAd) {
      console.warn('[AdManager] 广告实例不存在');
      callback(false);
      return;
    }

    this._pendingCallback = callback;
    this._pendingScene = scene;
    this._pendingAdUnitId = adUnitId;
    this._isAdShowing = true;

    rewardedAd.show().catch(() => {
      // 显示失败，尝试重新加载后再显示
      rewardedAd.load().then(() => {
        rewardedAd.show().catch((err: any) => {
          console.error('[AdManager] 激励视频展示失败:', err);
          this._isAdShowing = false;
          if (this._pendingCallback) {
            this._pendingCallback(false);
            this._pendingCallback = null;
          }
          this._pendingScene = null;
          this._pendingAdUnitId = null;
        });
      }).catch((err: any) => {
        console.error('[AdManager] 激励视频加载失败:', err);
        this._isAdShowing = false;
        if (this._pendingCallback) {
          this._pendingCallback(false);
          this._pendingCallback = null;
        }
        this._pendingScene = null;
        this._pendingAdUnitId = null;
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
    });
    ad.onClose((res: any) => {
      if (this._pendingAdUnitId && this._pendingAdUnitId !== adUnitId) return;
      this._isAdShowing = false;
      this._loadedRewardedAdUnits.delete(adUnitId);
      const isCompleted = res?.isEnded !== false;
      const scene = this._pendingScene;
      console.log('[AdManager] 激励视频关闭:', { scene, adUnitId, res, isCompleted });

      if (this._pendingCallback) {
        this._pendingCallback(isCompleted);
        this._pendingCallback = null;
      }
      this._pendingScene = null;
      this._pendingAdUnitId = null;

      if (isCompleted) {
        this._stats.totalCompleted++;
        EventBus.emit('ad:completed', scene);
      }
      ad.load().catch(() => {});
    });

    this._rewardedAds.set(adUnitId, ad);
    ad.load().catch(() => {});
    return ad;
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
