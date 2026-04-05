/**
 * 平台服务抽象层 - 统一封装微信/抖音双平台 API
 *
 * 所有平台特有调用（存储、广告、分享等）都通过本模块统一访问，
 * src/ 中不再需要各自 declare const wx / tt。
 */

declare const wx: any;
declare const tt: any;
declare const GameGlobal: any;

export type PlatformName = 'wechat' | 'douyin' | 'unknown';

class PlatformServiceClass {
  /** 当前平台名 */
  readonly name: PlatformName;

  /** 底层平台 API 对象（wx / tt / null） */
  private _api: any;

  constructor() {
    if (typeof wx !== 'undefined') {
      this._api = wx;
      this.name = 'wechat';
    } else if (typeof tt !== 'undefined') {
      this._api = tt;
      this.name = 'douyin';
    } else {
      this._api = null;
      this.name = 'unknown';
    }
    console.log(`[Platform] 当前平台: ${this.name}`);
  }

  /** 是否在小游戏环境中 */
  get isMinigame(): boolean {
    return this._api !== null;
  }

  /** 底层 API（慎用，优先使用封装方法） */
  get api(): any {
    return this._api;
  }

  // ═══════════════ 存储 ═══════════════

  getStorageSync(key: string): string | null {
    try {
      return this._api?.getStorageSync(key) || null;
    } catch (_) {
      return null;
    }
  }

  setStorageSync(key: string, value: string): void {
    try {
      this._api?.setStorageSync(key, value);
    } catch (_) {}
  }

  /** 异步写入本地存储（避免阻塞主线程） */
  setStorageAsync(key: string, value: string): void {
    try {
      if (this._api?.setStorage) {
        this._api.setStorage({ key, data: value, fail() {} });
      } else {
        this._api?.setStorageSync(key, value);
      }
    } catch (_) {}
  }

  removeStorageSync(key: string): void {
    try {
      this._api?.removeStorageSync(key);
    } catch (_) {}
  }

  // ═══════════════ 系统信息 ═══════════════

  getSystemInfoSync(): any {
    try {
      return this._api?.getSystemInfoSync?.() || null;
    } catch (_) {
      return null;
    }
  }

  getMenuButtonBoundingClientRect(): any {
    try {
      return this._api?.getMenuButtonBoundingClientRect?.() || null;
    } catch (_) {
      return null;
    }
  }

  // ═══════════════ 震动反馈（已全局关闭，保留 API 避免调用方报错）════════════════

  /** @deprecated 产品要求关闭全部硬件震动，此方法为空操作 */
  vibrateShort(_type?: 'light' | 'medium' | 'heavy'): void {}

  /** @deprecated 产品要求关闭全部硬件震动，此方法为空操作 */
  vibrateLong(): void {}

  // ═══════════════ 广告 ═══════════════

  /** 创建激励视频广告实例 */
  createRewardedVideoAd(adUnitId: string): any {
    try {
      if (this.name === 'wechat') {
        return this._api?.createRewardedVideoAd?.({ adUnitId });
      } else if (this.name === 'douyin') {
        return this._api?.createRewardedVideoAd?.({ adUnitId });
      }
    } catch (e) {
      console.warn('[Platform] 创建激励视频广告失败:', e);
    }
    return null;
  }

  /** 创建 Banner 广告实例 */
  createBannerAd(adUnitId: string, style: any): any {
    try {
      if (this.name === 'wechat') {
        return this._api?.createBannerAd?.({ adUnitId, style });
      } else if (this.name === 'douyin') {
        return this._api?.createBannerAd?.({ adUnitId, style });
      }
    } catch (e) {
      console.warn('[Platform] 创建Banner广告失败:', e);
    }
    return null;
  }

  /** 创建插屏广告实例 */
  createInterstitialAd(adUnitId: string): any {
    try {
      if (this.name === 'wechat') {
        return this._api?.createInterstitialAd?.({ adUnitId });
      } else if (this.name === 'douyin') {
        return this._api?.createInterstitialAd?.({ adUnitId });
      }
    } catch (e) {
      console.warn('[Platform] 创建插屏广告失败:', e);
    }
    return null;
  }

  // ═══════════════ 分享 ═══════════════

  /** 主动分享（fire-and-forget） */
  shareAppMessage(opts: { title: string; imageUrl?: string; query?: string }): void {
    try {
      this._api?.shareAppMessage?.(opts);
    } catch (_) {}
  }

  /**
   * 主动分享并等待结果（通过 onHide/onShow 时间差判断）。
   * 微信已移除分享成功回调，此方法用时间差启发式判断：
   * 离开 >2s 视为分享成功，否则视为取消。
   *
   * 微信开发者工具：`platform === 'devtools'` 时分享往往不触发与真机一致的前后台切换，
   * 或回到前台间隔 <2s，导致恒为「取消」。工具内调用 `shareAppMessage` 成功后直接视为成功，便于测转发解锁格等流程。
   *
   * @returns true = 可能已分享，false = 取消或未分享
   */
  shareAndWait(opts: { title: string; imageUrl?: string; query?: string }): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      if (!this._api) {
        resolve(true);
        return;
      }

      const sys = this.getSystemInfoSync();
      const isDevtools = sys?.platform === 'devtools';

      if (isDevtools) {
        try {
          this._api.shareAppMessage(opts);
          console.log('[Platform] shareAndWait: devtools 环境，分享调用后视为成功（真机仍走 onHide/onShow 启发式）');
          resolve(true);
        } catch (_) {
          resolve(false);
        }
        return;
      }

      let hideTime = 0;
      const SHARE_MIN_MS = 2000;

      const onHide = () => {
        hideTime = Date.now();
      };

      const onShow = () => {
        cleanup();
        const elapsed = Date.now() - hideTime;
        resolve(elapsed >= SHARE_MIN_MS);
      };

      const cleanup = () => {
        try { this._api?.offHide?.(onHide); } catch (_) {}
        try { this._api?.offShow?.(onShow); } catch (_) {}
      };

      this._api.onHide(onHide);
      this._api.onShow(onShow);

      try {
        this._api.shareAppMessage(opts);
      } catch (_) {
        cleanup();
        resolve(false);
      }
    });
  }

  /** 注册被动分享（右上角"分享"） */
  onShareAppMessage(callback: () => { title: string; imageUrl?: string; query?: string }): void {
    try {
      this._api?.onShareAppMessage?.(callback);
    } catch (_) {}
  }

  /** 分享到朋友圈（仅微信） */
  onShareTimeline(callback: () => { title: string; imageUrl?: string; query?: string }): void {
    try {
      if (this.name === 'wechat') {
        this._api?.onShareTimeline?.(callback);
      }
    } catch (_) {}
  }

  // ═══════════════ 生命周期 ═══════════════

  onHide(callback: () => void): void {
    try {
      this._api?.onHide?.(callback);
    } catch (_) {}
  }

  onShow(callback: (res?: any) => void): void {
    try {
      this._api?.onShow?.(callback);
    } catch (_) {}
  }

  // ═══════════════ 其他 ═══════════════

  /** 获取当前时间戳（服务器校时备用，默认本地） */
  now(): number {
    return Date.now();
  }

  /** 显示原生 Toast */
  showToast(title: string, icon: 'success' | 'none' | 'error' = 'none'): void {
    try {
      this._api?.showToast?.({ title, icon, duration: 2000 });
    } catch (_) {}
  }

  /**
   * 写入剪贴板（异步 API，失败走 fail 回调，不会 throw）
   * 微信需：公众平台 → 设置 → 基本设置 → 用户隐私保护指引 中声明剪贴板用途，
   * 否则 fail（如 errno 1026）；仍可从开发者工具 Console 手动复制。
   */
  setClipboardData(data: string): void {
    try {
      const fn = this._api?.setClipboardData;
      if (typeof fn !== 'function') return;
      fn.call(this._api, {
        data,
        success() {},
        fail(err: any) {
          console.warn(
            '[Platform] setClipboardData 失败（多因未配置剪贴板隐私）：',
            err?.errMsg || err,
          );
        },
      });
    } catch (e) {
      console.warn('[Platform] setClipboardData:', e);
    }
  }
}

// 全局单例
const _global: any = typeof GameGlobal !== 'undefined' ? GameGlobal
  : typeof globalThis !== 'undefined' ? globalThis : {};

if (!_global.__platformService) {
  _global.__platformService = new PlatformServiceClass();
}

export const Platform: PlatformServiceClass = _global.__platformService;
