/**
 * 平台服务抽象层 - 统一封装微信/抖音双平台 API
 *
 * 所有平台特有调用（存储、广告、分享、侧边栏、桌面等）都通过本模块统一访问，
 * src/ 中不再需要各自 declare const wx / tt。
 *
 * 存储：读写前统一经 scopeStorageKey 映射到平台命名空间（微信原样，抖音加 _tt 段），
 * 因此业务层继续用 `huahua_xxx` 逻辑 key 即可，无需感知平台。
 */

declare const GameGlobal: any;

import { scopeStorageKey, getScopedGameKey } from '@/config/gameKeyScope';
import {
  detectMinigamePlatform,
  getNativePlatformApi,
  toBackendPlatformCode,
  type BackendPlatformCode,
  type PlatformName,
} from './platformDetect';

export type { PlatformName, BackendPlatformCode };
export { detectMinigamePlatform };

class PlatformServiceClass {
  /** 当前平台名 */
  readonly name: PlatformName;

  /** 底层平台 API 对象（wx / tt / null） */
  private _api: any;

  constructor() {
    this.name = detectMinigamePlatform();
    this._api = getNativePlatformApi(this.name);
    const apiLabel = this.name === 'douyin' ? 'tt' : this.name === 'wechat' ? 'wx' : 'none';
    console.log(`[Platform] 当前平台: ${this.name}, api=${apiLabel}, gameKey=${getScopedGameKey(this.name)}`);
  }

  /** 后端 /login 的 platform 字段（wx / dy / anon） */
  get backendPlatformCode(): BackendPlatformCode {
    return toBackendPlatformCode(this.name);
  }

  /** 当前平台的数据命名空间（huahua / huahua_tt） */
  get scopedGameKey(): string {
    return getScopedGameKey(this.name);
  }

  /** 是否在小游戏环境中 */
  get isMinigame(): boolean {
    return this._api !== null;
  }

  /** 是否微信平台 */
  get isWechat(): boolean {
    return this.name === 'wechat';
  }

  /** 是否抖音平台 */
  get isDouyin(): boolean {
    return this.name === 'douyin';
  }

  /** 微信开发者工具（非真机）；brand/environment 亦可能为 devtools（模拟器 platform 常为 ios） */
  get isDevtools(): boolean {
    return this._isDevtools();
  }

  /** 鸿蒙微信当前不稳定支持 PageManager openlink，福利半屏需降级。 */
  get isOhos(): boolean {
    if (!this.isMinigame) return false;
    try {
      const dev = typeof this._api?.getDeviceInfo === 'function' ? this._api.getDeviceInfo() : null;
      if (dev && (dev.platform === 'ohos' || dev.system === 'HarmonyOS')) return true;
    } catch (_) {}
    try {
      const sys = this._api?.getSystemInfoSync?.();
      return !!(sys && (sys.platform === 'ohos' || sys.system === 'HarmonyOS'));
    } catch (_) {
      return false;
    }
  }

  /**
   * 是否有可用的后端 HTTP 通道
   * - 微信 / 抖音小游戏：有原生 request API
   * - 浏览器：有全局 fetch
   */
  get canUseBackend(): boolean {
    if (this._api && typeof this._api.request === 'function') return true;
    return typeof (globalThis as any).fetch === 'function';
  }

  /** 底层 API（慎用，优先使用封装方法） */
  get api(): any {
    return this._api;
  }

  // ═══════════════ 存储（key 自动落到平台命名空间）═══════════════

  /** 逻辑 key → 物理 key，供排障时确认实际写入的位置 */
  storageKey(key: string): string {
    return scopeStorageKey(key, this.name);
  }

  getStorageSync(key: string): string | null {
    try {
      return this._api?.getStorageSync(this.storageKey(key)) || null;
    } catch (_) {
      return null;
    }
  }

  setStorageSync(key: string, value: string): void {
    try {
      this._api?.setStorageSync(this.storageKey(key), value);
    } catch (_) {}
  }

  /** 异步写入本地存储（避免阻塞主线程） */
  setStorageAsync(key: string, value: string): void {
    const physicalKey = this.storageKey(key);
    try {
      if (this._api?.setStorage) {
        this._api.setStorage({ key: physicalKey, data: value, fail() {} });
      } else {
        this._api?.setStorageSync(physicalKey, value);
      }
    } catch (_) {}
  }

  removeStorageSync(key: string): void {
    try {
      this._api?.removeStorageSync(this.storageKey(key));
    } catch (_) {}
  }

  // ═══════════════ 通用 HTTP（对接 CloudBase HTTP 访问服务）═══════════════

  /**
   * 跨平台 HTTP 请求，统一返回 { statusCode, data }。
   * - 非 2xx 不会 reject（让上层自行判定业务错误码）
   * - 网络失败 / 超时 / 解析异常才 reject
   */
  request(opts: {
    url: string;
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    data?: unknown;
    headers?: Record<string, string>;
    timeoutMs?: number;
  }): Promise<{ statusCode: number; data: any }> {
    const method = (opts.method || 'POST').toUpperCase();
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      ...(opts.headers || {}),
    };
    const timeoutMs = opts.timeoutMs && opts.timeoutMs > 0 ? opts.timeoutMs : 10000;

    // 仅微信开发者工具走 fetch：wx.request 在部分基础库会误报 "An object could not be cloned"。
    // 抖音模拟器必须走 tt.request，和 xiaochu2 一样；fetch 在 tt 环境经常拿不到登录/云同步。
    if (this.isWechat && this._isDevtools() && typeof (globalThis as any).fetch === 'function') {
      return this._requestViaFetch(opts.url, method, opts.data, headers, timeoutMs);
    }
    if (this._api && typeof this._api.request === 'function') {
      return this._requestViaMiniApi(opts.url, method, opts.data, headers, timeoutMs);
    }
    if (typeof (globalThis as any).fetch === 'function') {
      return this._requestViaFetch(opts.url, method, opts.data, headers, timeoutMs);
    }
    return Promise.reject(new Error('no http transport available'));
  }

  private _requestViaMiniApi(
    url: string,
    method: string,
    data: unknown,
    headers: Record<string, string>,
    timeoutMs: number,
  ): Promise<{ statusCode: number; data: any }> {
    return new Promise((resolve, reject) => {
      let done = false;
      const startedAt = Date.now();
      const requestId = Math.random().toString(36).slice(2, 8);
      const requestData = data === undefined || typeof data === 'string'
        ? data
        : JSON.stringify(data);
      const timer = setTimeout(() => {
        if (done) return;
        done = true;
        reject(new Error(`request timeout after ${timeoutMs}ms: ${url}`));
      }, timeoutMs);

      try {
        this._api.request({
          url,
          method,
          data: requestData,
          header: headers,
          timeout: timeoutMs,
          success: (res: any) => {
            if (done) return;
            done = true;
            clearTimeout(timer);
            resolve({
              statusCode: res?.statusCode ?? 0,
              data: res?.data,
            });
          },
          fail: (err: any) => {
            if (done) return;
            clearTimeout(timer);
            let raw = '';
            try { raw = JSON.stringify(err); } catch (_) { raw = String(err); }
            const msg = err?.errMsg || err?.message || raw || String(err);
            console.warn(
              `[Platform.request#${requestId}] fail ${method} ${url}: ${msg}, cost=${Date.now() - startedAt}ms, env=${this._getRequestEnvSummary()}`,
            );

            const fetchFn = (globalThis as any).fetch as typeof fetch | undefined;
            const canFallback =
              typeof fetchFn === 'function'
              && /request:fail/i.test(msg);

            if (canFallback) {
              console.warn('[Platform.request] wx.request 失败，尝试 fetch 兜底:', url);
              void this._requestViaFetch(url, method, data, headers, timeoutMs)
                .then((result) => {
                  if (done) return;
                  done = true;
                  resolve(result);
                })
                .catch((e2) => {
                  if (done) return;
                  done = true;
                  const fb = e2 instanceof Error ? e2.message : String(e2);
                  reject(new Error(`request failed: ${msg}; url=${url}; raw=${raw}; fetchFallback=${fb}`));
                });
              return;
            }

            done = true;
            reject(new Error(`request failed: ${msg}; url=${url}; raw=${raw}`));
          },
        });
      } catch (e) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    });
  }

  private _requestViaFetch(
    url: string,
    method: string,
    data: unknown,
    headers: Record<string, string>,
    timeoutMs: number,
  ): Promise<{ statusCode: number; data: any }> {
    const fetchFn = (globalThis as any).fetch as typeof fetch;
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;

    const init: any = {
      method,
      headers,
      signal: ctrl ? ctrl.signal : undefined,
    };
    if (data !== undefined && method !== 'GET') {
      init.body = typeof data === 'string' ? data : JSON.stringify(data);
    }

    return fetchFn(url, init).then(async (res) => {
      if (timer) clearTimeout(timer);
      const text = await res.text();
      let parsed: any = text;
      if (text) {
        try {
          parsed = JSON.parse(text);
        } catch (_) {
          parsed = text;
        }
      }
      return { statusCode: res.status, data: parsed };
    }).catch((e) => {
      if (timer) clearTimeout(timer);
      console.warn(`[Platform.fetch] fail ${method} ${url}:`, e instanceof Error ? e.message : String(e));
      throw e instanceof Error ? e : new Error(String(e));
    });
  }

  private _isDevtools(): boolean {
    if (!this.isMinigame) return false;
    try {
      const info = this._api?.getSystemInfoSync?.();
      if (!info) return false;
      const platform = String(info.platform || '').toLowerCase();
      const brand = String(info.brand || '').toLowerCase();
      const model = String(info.model || '').toLowerCase();
      const environment = String(info.environment || '').toLowerCase();
      return platform === 'devtools'
        || brand === 'devtools'
        || environment === 'devtools'
        || model.includes('devtools');
    } catch (_) {
      return false;
    }
  }

  private _getRequestEnvSummary(): string {
    try {
      const info = this._api?.getSystemInfoSync?.();
      if (!info) return `platform=${this.name}`;
      return [
        `platform=${this.name}`,
        `sys=${info.system || info.platform || 'unknown'}`,
        `sdk=${info.SDKVersion || 'unknown'}`,
        `brand=${info.brand || 'unknown'}`,
        `model=${info.model || 'unknown'}`,
      ].join(',');
    } catch (_) {
      return `platform=${this.name}`;
    }
  }

  /**
   * 平台登录凭证：
   *   微信 -> wx.login → code
   *   抖音 -> tt.login({ force: true }) → code，未登录时也可能只有 anonymousCode
   */
  loginCredentials(): Promise<{ code: string; anonymousCode: string }> {
    return new Promise((resolve) => {
      const empty = { code: '', anonymousCode: '' };
      if (!this._api || typeof this._api.login !== 'function') {
        console.warn(`[Platform] login 不可用 platform=${this.name}`);
        resolve(empty);
        return;
      }
      try {
        this._api.login({
          force: this.isDouyin,
          success: (res: any) => {
            const code = String(res?.code || '');
            const anonymousCode = String(res?.anonymousCode || '');
            if (!code && !anonymousCode) {
              console.warn(`[Platform] login 成功但无 code platform=${this.name}`, res);
            } else {
              console.log(
                `[Platform] login ok platform=${this.name} hasCode=${!!code} hasAnonymous=${!!anonymousCode} isLogin=${res?.isLogin}`,
              );
            }
            resolve({ code, anonymousCode });
          },
          fail: (err: any) => {
            console.warn(`[Platform] login 失败 platform=${this.name}`, err);
            resolve(empty);
          },
        });
      } catch (err) {
        console.warn(`[Platform] login 抛错 platform=${this.name}`, err);
        resolve(empty);
      }
    });
  }

  /** 兼容旧调用：优先正式 code，抖音可回落到 anonymousCode */
  loginCode(): Promise<string> {
    return this.loginCredentials().then((creds) => creds.code || creds.anonymousCode);
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

  /** 创建激励视频广告实例（微信须 multiton，否则小游戏端全局单例只绑定首次 adUnitId） */
  createRewardedVideoAd(adUnitId: string): any {
    try {
      if (this.name === 'wechat') {
        return this._api?.createRewardedVideoAd?.({ adUnitId, multiton: true });
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
    if (!this._isValidAdUnitId(adUnitId)) {
      console.warn('[Platform] 插屏广告位未配置，跳过创建');
      return null;
    }
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

  private _isValidAdUnitId(adUnitId: string): boolean {
    if (!adUnitId) return false;
    if (/[xyz]{6,}/i.test(adUnitId)) return false;
    if (this.name === 'wechat') return /^adunit-[0-9a-f]{16}$/i.test(adUnitId);
    if (this.name === 'douyin') return !/[xyz]{6,}/i.test(adUnitId) && adUnitId.length >= 8;
    return false;
  }

  /**
   * 创建微信「游戏圈」原生按钮。
   * 仅微信小游戏支持；调用方通常会把它做成透明热区，视觉仍由 Canvas UI 自行绘制。
   */
  createGameClubButton(opts: {
    type?: 'text' | 'image';
    text?: string;
    icon?: 'green' | 'white' | 'dark' | 'light';
    image?: string;
    style: Record<string, any>;
  }): any {
    try {
      if (this.name === 'wechat') {
        return this._api?.createGameClubButton?.(opts);
      }
    } catch (e) {
      console.warn('[Platform] 创建游戏圈按钮失败:', e);
    }
    return null;
  }

  /** 微信 PageManager openlink 能力：用于游戏圈 / 福利半屏。 */
  canOpenPageByOpenlink(): boolean {
    return this.name === 'wechat'
      && !this.isDevtools
      && !this.isOhos
      && typeof this._api?.createPageManager === 'function';
  }

  createPageManager(): any {
    try {
      if (this.canOpenPageByOpenlink()) {
        return this._api.createPageManager();
      }
    } catch (e) {
      console.warn('[Platform] 创建 PageManager 失败:', e);
    }
    return null;
  }

  // ═══════════════ 分享 ═══════════════

  /** 显式开启右上角菜单分享入口（微信真机需要，否则菜单里可能显示当前页面不可分享） */
  showShareMenu(opts?: { withShareTicket?: boolean; menus?: string[] }): void {
    try {
      // menus / withShareTicket 是微信特有参数，抖音传入会被判为非法入参
      if (this.name === 'douyin') {
        this._api?.showShareMenu?.({});
        return;
      }
      this._api?.showShareMenu?.({
        withShareTicket: opts?.withShareTicket ?? true,
        menus: opts?.menus ?? ['shareAppMessage', 'shareTimeline'],
      });
    } catch (_) {}
  }

  /** 主动分享（fire-and-forget） */
  shareAppMessage(opts: {
    title: string;
    imageUrl?: string;
    query?: string;
    desc?: string;
    templateId?: string;
  }): void {
    try {
      this._api?.shareAppMessage?.(this._buildShareAppMessageOpts(opts));
    } catch (_) {}
  }

  /** 组装平台分享参数：抖音多传 desc / templateId，并去掉空字段 */
  private _buildShareAppMessageOpts(opts: {
    title: string;
    imageUrl?: string;
    query?: string;
    desc?: string;
    templateId?: string;
    success?: (...args: any[]) => void;
    fail?: (...args: any[]) => void;
    complete?: (...args: any[]) => void;
  }): Record<string, unknown> {
    const out: Record<string, unknown> = { title: opts.title };
    if (opts.imageUrl) out.imageUrl = opts.imageUrl;
    if (opts.query) out.query = opts.query;
    if (opts.success) out.success = opts.success;
    if (opts.fail) out.fail = opts.fail;
    if (opts.complete) out.complete = opts.complete;
    if (this.isDouyin) {
      if (opts.desc) out.desc = opts.desc;
      if (opts.templateId) out.templateId = opts.templateId;
    }
    return out;
  }

  /**
   * 导出 canvas 为临时图片。
   * - `fromMainScreen: true`：裁主屏 WebGL（微信真机分享图必走此路径，勿传 canvas 字段）。
   * - 否则：离屏 canvas 用 toDataURL + 写 USER_DATA_PATH（真机对离屏 canvasToTempFilePath 常失败）。
   */
  canvasToTempFilePath(opts: {
    canvas?: any;
    fromMainScreen?: boolean;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    destWidth?: number;
    destHeight?: number;
    fileType?: 'jpg' | 'png';
    quality?: number;
  }): Promise<string | null> {
    if (!this._api?.canvasToTempFilePath) {
      console.warn('[Platform] canvasToTempFilePath unavailable');
      return Promise.resolve(null);
    }
    if (opts.fromMainScreen) {
      return this._canvasToTempFromMainScreen(opts);
    }
    if (!opts.canvas) {
      console.warn('[Platform] canvasToTempFilePath: 缺少 canvas');
      return Promise.resolve(null);
    }
    return this._canvasToTempFromOffscreen(opts);
  }

  /** 微信/抖音：从默认上屏 WebGL canvas 裁剪（x/y/width/height 为物理像素） */
  private _canvasToTempFromMainScreen(opts: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    destWidth?: number;
    destHeight?: number;
    fileType?: 'jpg' | 'png';
    quality?: number;
  }): Promise<string | null> {
    return new Promise(resolve => {
      try {
        const apiOpts: Record<string, unknown> = {
          destWidth: opts.destWidth,
          destHeight: opts.destHeight,
          fileType: opts.fileType ?? 'jpg',
          quality: opts.quality ?? 0.9,
          success: (res: { tempFilePath?: string }) => resolve(res.tempFilePath ?? null),
          fail: (err: unknown) => {
            console.warn('[Platform] canvasToTempFilePath(main) failed', err);
            resolve(null);
          },
        };
        if (opts.x != null) apiOpts.x = Math.max(0, Math.round(opts.x));
        if (opts.y != null) apiOpts.y = Math.max(0, Math.round(opts.y));
        if (opts.width != null) apiOpts.width = Math.max(1, Math.round(opts.width));
        if (opts.height != null) apiOpts.height = Math.max(1, Math.round(opts.height));
        this._api.canvasToTempFilePath(apiOpts);
      } catch (err) {
        console.warn('[Platform] canvasToTempFilePath(main) exception', err);
        resolve(null);
      }
    });
  }

  /** 离屏 2D / extract 画布：toDataURL 落盘（避免传 canvas 给 wx API） */
  private _canvasToTempFromOffscreen(opts: {
    canvas: any;
    destWidth?: number;
    destHeight?: number;
    fileType?: 'jpg' | 'png';
    quality?: number;
  }): Promise<string | null> {
    const canvas = opts.canvas;
    const destW = Math.max(2, opts.destWidth ?? 500);
    const destH = Math.max(2, opts.destHeight ?? 400);
    const mime = (opts.fileType ?? 'jpg') === 'png' ? 'image/png' : 'image/jpeg';
    const quality = opts.quality ?? 0.88;

    try {
      let dataUrl: string | null = null;
      const sw = canvas.width ?? 0;
      const sh = canvas.height ?? 0;
      if (sw > 0 && sh > 0 && typeof canvas.getContext === 'function') {
        const tmp = this._api.createCanvas?.() ?? canvas;
        if (tmp && tmp !== canvas) {
          tmp.width = destW;
          tmp.height = destH;
          const ctx = tmp.getContext?.('2d');
          if (ctx) {
            ctx.drawImage(canvas, 0, 0, destW, destH);
            dataUrl = typeof tmp.toDataURL === 'function'
              ? tmp.toDataURL(mime, quality)
              : null;
          }
        }
      }
      if (!dataUrl && typeof canvas.toDataURL === 'function') {
        dataUrl = canvas.toDataURL(mime, quality);
      }
      if (!dataUrl) {
        console.warn('[Platform] offscreen toDataURL 不可用');
        return Promise.resolve(null);
      }

      const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
      const fs = this._api.getFileSystemManager?.();
      const root = this._api.env?.USER_DATA_PATH ?? '';
      if (!fs?.writeFileSync || !root) {
        console.warn('[Platform] 无法写分享临时图（无 fs 或 USER_DATA_PATH）');
        return Promise.resolve(null);
      }
      const ext = mime === 'image/png' ? 'png' : 'jpg';
      const path = `${root}/share_snap_${Date.now()}.${ext}`;
      fs.writeFileSync(path, base64, 'base64');
      return Promise.resolve(path);
    } catch (err) {
      console.warn('[Platform] offscreen export failed', err);
      return Promise.resolve(null);
    }
  }

  /**
   * 主动分享并等待结果。
   *
   * - **抖音**：用 `tt.shareAppMessage` 的 success/fail（官方支持；hide/show 启发式在抖音端内分享不可靠）。
   * - **微信**：已移除分享成功回调，用 onHide/onShow 时间差：离开 >2s 视为成功，否则取消。
   * - **微信开发者工具**：`platform === 'devtools'` 时分享后直接视为成功，便于测转发解锁。
   *
   * @returns true = 可能已分享，false = 取消或未分享
   */
  shareAndWait(opts: {
    title: string;
    imageUrl?: string;
    query?: string;
    desc?: string;
    templateId?: string;
  }): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      if (!this._api) {
        resolve(true);
        return;
      }

      const sys = this.getSystemInfoSync();
      const isDevtools = sys?.platform === 'devtools';

      if (isDevtools) {
        try {
          this._api.shareAppMessage(this._buildShareAppMessageOpts(opts));
          console.log('[Platform] shareAndWait: devtools 环境，分享调用后视为成功（真机仍按平台分支判定）');
          resolve(true);
        } catch (_) {
          resolve(false);
        }
        return;
      }

      // 抖音：官方有 success/fail，端内分享常不触发足够长的 hide/show
      if (this.isDouyin) {
        let settled = false;
        const finish = (ok: boolean) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve(ok);
        };
        const timer = setTimeout(() => {
          console.warn('[Platform] shareAndWait: 抖音分享超时，视为取消');
          finish(false);
        }, 120_000);

        try {
          this._api.shareAppMessage(
            this._buildShareAppMessageOpts({
              ...opts,
              success: () => {
                console.log('[Platform] shareAndWait: 抖音 success');
                finish(true);
              },
              fail: (err: unknown) => {
                console.warn('[Platform] shareAndWait: 抖音 fail', err);
                finish(false);
              },
            }),
          );
        } catch (e) {
          console.warn('[Platform] shareAndWait: 抖音 exception', e);
          finish(false);
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
        this._api.shareAppMessage(this._buildShareAppMessageOpts(opts));
      } catch (_) {
        cleanup();
        resolve(false);
      }
    });
  }

  /** 注册被动分享（右上角"分享"） */
  onShareAppMessage(
    callback: (res?: { from?: string }) => {
      title: string;
      imageUrl?: string;
      query?: string;
      desc?: string;
      templateId?: string;
    },
  ): void {
    try {
      // 统一剥空字段；抖音可带 desc / templateId
      this._api?.onShareAppMessage?.((res?: { from?: string }) => {
        const payload = callback(res) || { title: '' };
        return this._buildShareAppMessageOpts(payload);
      });
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

  getLaunchOptionsSync(): any {
    try {
      return this._api?.getLaunchOptionsSync?.() || null;
    } catch (_) {
      return null;
    }
  }

  getEnterOptionsSync(): any {
    try {
      return this._api?.getEnterOptionsSync?.() || null;
    } catch (_) {
      return null;
    }
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

  restartMiniProgram(): boolean {
    try {
      if (typeof this._api?.restartMiniProgram !== 'function') return false;
      this._api.restartMiniProgram();
      return true;
    } catch (e) {
      console.warn('[Platform] restartMiniProgram 失败:', e);
      return false;
    }
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

  // ═══════════════ 分包 ═══════════════

  /**
   * 加载资源分包（微信 / 抖音 API 同名同形）。
   * 宿主不支持时 resolve(null)，由调用方决定走 CDN 还是兜底；下载失败则 reject。
   */
  loadSubpackage(
    name: string,
    onProgress?: (percent: number, written: number, total: number) => void,
  ): Promise<'loaded' | 'unsupported'> {
    return new Promise((resolve, reject) => {
      if (typeof this._api?.loadSubpackage !== 'function') {
        resolve('unsupported');
        return;
      }
      try {
        const task = this._api.loadSubpackage({
          name,
          success: () => resolve('loaded'),
          fail: (err: any) => {
            const errMsg = err?.errMsg || err?.message || '';
            let raw = '';
            try { raw = JSON.stringify(err); } catch (_) { raw = String(err); }
            reject(Object.assign(
              new Error(`loadSubpackage(${name}) 失败: ${errMsg || raw || 'unknown'}`),
              { raw: err },
            ));
          },
        });
        if (onProgress && task?.onProgressUpdate) {
          task.onProgressUpdate((res: any) => {
            onProgress(res?.progress ?? 0, res?.totalBytesWritten ?? 0, res?.totalBytesExpectedToWrite ?? 0);
          });
        }
      } catch (e) {
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    });
  }

  // ═══════════════ 文件系统 / 下载（CDN 资源缓存）═══════════════

  getFileSystemManager(): any {
    try {
      return this._api?.getFileSystemManager?.() ?? null;
    } catch (_) {
      return null;
    }
  }

  /** 用户数据根目录；抖音与微信同为 env.USER_DATA_PATH */
  get userDataPath(): string {
    try {
      return this._api?.env?.USER_DATA_PATH || '';
    } catch (_) {
      return '';
    }
  }

  /**
   * 以纯文本取回响应体，绕过宿主的 JSON 协议解析层。
   *
   * CloudBase 默认域名上的 application/json 静态文件若走普通解析通道，
   * 会被云开发协议层当成协议报文 JSON.parse 而报错，所以这里必须显式声明 text。
   */
  requestText(url: string, timeoutMs?: number): Promise<string> {
    if (typeof this._api?.request === 'function') {
      return new Promise((resolve, reject) => {
        this._api.request({
          url,
          method: 'GET',
          responseType: 'text',
          dataType: 'text',
          timeout: timeoutMs,
          success: (res: any) => {
            const statusCode = Number(res?.statusCode || 0);
            if (statusCode < 200 || statusCode >= 300) {
              reject(new Error(`request status=${statusCode || 'unknown'} url=${url}`));
              return;
            }
            const data = res?.data;
            resolve(typeof data === 'string' ? data : (data ? JSON.stringify(data) : ''));
          },
          fail: (err: any) => {
            const msg = err?.errMsg || err?.message || String(err);
            reject(new Error(msg));
          },
        });
      });
    }

    const fetchFn = (globalThis as any).fetch as typeof fetch | undefined;
    if (typeof fetchFn !== 'function') {
      return Promise.reject(new Error('no http transport available'));
    }
    return fetchFn(url).then((res) => {
      if (!res.ok) throw new Error(`request status=${res.status} url=${url}`);
      return res.text();
    });
  }

  /** 下载文件到临时路径（CDN 资源用） */
  downloadFile(opts: { url: string; timeoutMs?: number }): Promise<{ tempFilePath: string }> {
    return new Promise((resolve, reject) => {
      if (typeof this._api?.downloadFile !== 'function') {
        reject(new Error('downloadFile unavailable'));
        return;
      }
      try {
        this._api.downloadFile({
          url: opts.url,
          timeout: opts.timeoutMs,
          success: (res: any) => {
            const statusCode = Number(res?.statusCode || 0);
            if (statusCode < 200 || statusCode >= 300) {
              reject(new Error(`downloadFile status=${statusCode || 'unknown'} url=${opts.url}`));
              return;
            }
            if (!res?.tempFilePath) {
              reject(new Error(`downloadFile missing tempFilePath url=${opts.url}`));
              return;
            }
            resolve({ tempFilePath: res.tempFilePath });
          },
          fail: (err: any) => {
            const msg = err?.errMsg || err?.message || String(err);
            reject(new Error(msg));
          },
        });
      } catch (e) {
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    });
  }

  // ═══════════════ 抖音侧边栏复访（平台必接）═══════════════

  /** 检测宿主是否支持指定场景（如 sidebar） */
  checkScene(opts: {
    scene: string;
    success?: (res: { isExist?: boolean }) => void;
    fail?: (err?: unknown) => void;
  }): void {
    try {
      if (this._api?.checkScene) {
        this._api.checkScene(opts);
      } else {
        opts.fail?.({ errMsg: 'checkScene not supported' });
      }
    } catch (e) {
      opts.fail?.(e);
    }
  }

  /** 跳转宿主场景（抖音侧边栏复访必接：tt.navigateToScene） */
  navigateToScene(opts: {
    scene: string;
    success?: () => void;
    fail?: (err?: unknown) => void;
  }): void {
    try {
      if (this._api?.navigateToScene) {
        this._api.navigateToScene(opts);
      } else {
        opts.fail?.({ errMsg: 'navigateToScene not supported' });
      }
    } catch (e) {
      opts.fail?.(e);
    }
  }

  // ═══════════════ 抖音添加到桌面（平台必接）═══════════════

  /** 检查桌面快捷方式是否已添加（仅 Android 可靠） */
  checkShortcut(opts: {
    success?: (res: { status?: { exist?: boolean; needUpdate?: boolean } }) => void;
    fail?: (err?: unknown) => void;
  }): void {
    try {
      if (this._api?.checkShortcut) {
        this._api.checkShortcut(opts);
      } else {
        opts.fail?.({ errMsg: 'checkShortcut not supported' });
      }
    } catch (e) {
      opts.fail?.(e);
    }
  }

  /**
   * 添加小游戏到手机桌面。
   * 抖音要求在用户点击的同步调用栈内触发，异步 await 之后再调会被判定为非用户手势而失败。
   */
  addShortcut(opts: {
    success?: () => void;
    fail?: (err?: { errMsg?: string }) => void;
    complete?: () => void;
  }): void {
    try {
      if (this._api?.addShortcut) {
        this._api.addShortcut(opts);
      } else {
        opts.fail?.({ errMsg: 'addShortcut not supported' });
      }
    } catch (e) {
      opts.fail?.(e as { errMsg?: string });
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
