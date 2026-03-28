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

/** 广告位 ID 配置（上线前替换为真实 ID） */
const AD_CONFIG = {
  wechat: {
    rewardedVideo: 'adunit-xxxxxxxxxxxxxxxxxx',  // 微信激励视频广告位
    interstitial:  'adunit-yyyyyyyyyyyyyyyyyy',  // 微信插屏广告位
    banner:        'adunit-zzzzzzzzzzzzzzzzzz',  // 微信 Banner 广告位
  },
  douyin: {
    rewardedVideo: 'xxxxxxxxxxxxxxxxxxxxxxxxxx',  // 抖音激励视频广告位
    interstitial:  'yyyyyyyyyyyyyyyyyyyyyyyyyy',  // 抖音插屏广告位
    banner:        'zzzzzzzzzzzzzzzzzzzzzzzzzz',  // 抖音 Banner 广告位
  },
};

/** 广告场景枚举 */
export enum AdScene {
  STAMINA_RECOVER  = 'stamina_recover',   // 体力恢复
  CD_SPEEDUP       = 'cd_speedup',        // 建筑CD加速
  EXTRA_REWARD     = 'extra_reward',      // 额外奖励
  REVIVE           = 'revive',            // 挑战复活
  FREE_CHEST       = 'free_chest',        // 免费开箱
}

type AdCallback = (success: boolean) => void;

class AdManagerClass {
  private _rewardedAd: any = null;
  private _interstitialAd: any = null;
  private _bannerAd: any = null;
  private _isAdLoaded = false;
  private _isAdShowing = false;
  private _pendingCallback: AdCallback | null = null;

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

    const config = Platform.name === 'wechat' ? AD_CONFIG.wechat
      : Platform.name === 'douyin' ? AD_CONFIG.douyin
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

    // 创建激励视频广告
    this._rewardedAd = Platform.createRewardedVideoAd(config.rewardedVideo);
    if (this._rewardedAd) {
      this._rewardedAd.onLoad(() => {
        console.log('[AdManager] 激励视频广告加载成功');
        this._isAdLoaded = true;
      });
      this._rewardedAd.onError((err: any) => {
        console.warn('[AdManager] 激励视频广告错误:', err);
        this._isAdLoaded = false;
      });
      this._rewardedAd.onClose((res: any) => {
        this._isAdShowing = false;
        const isCompleted = res && res.isEnded;
        console.log(`[AdManager] 激励视频关闭, isCompleted=${isCompleted}`);

        if (this._pendingCallback) {
          this._pendingCallback(isCompleted);
          this._pendingCallback = null;
        }

        if (isCompleted) {
          this._stats.totalCompleted++;
          EventBus.emit('ad:completed');
        }
      });

      // 预加载
      this._rewardedAd.load().catch(() => {});
    }

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
    return this._isAdLoaded && !!this._rewardedAd;
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

    if (!this._rewardedAd) {
      console.warn('[AdManager] 广告实例不存在');
      callback(false);
      return;
    }

    this._pendingCallback = callback;
    this._isAdShowing = true;

    this._rewardedAd.show().catch(() => {
      // 显示失败，尝试重新加载后再显示
      this._rewardedAd.load().then(() => {
        this._rewardedAd.show().catch((err: any) => {
          console.error('[AdManager] 激励视频展示失败:', err);
          this._isAdShowing = false;
          if (this._pendingCallback) {
            this._pendingCallback(false);
            this._pendingCallback = null;
          }
        });
      }).catch((err: any) => {
        console.error('[AdManager] 激励视频加载失败:', err);
        this._isAdShowing = false;
        if (this._pendingCallback) {
          this._pendingCallback(false);
          this._pendingCallback = null;
        }
      });
    });
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
