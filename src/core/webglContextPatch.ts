/**
 * 对齐 xiaochu2：iOS 微信 WebGL2 不完整；华为/宿主守卫环境
 * 探测第二块 WebGL canvas 会白屏或把主屏搞死。
 *
 * - settings.PREFER_ENV = WEBGL
 * - getContext('webgl2') 返回 null
 * - 主屏只取一次 WebGL，交给 PIXI.Renderer 的 context
 * - Renderer.test = true，禁止 isWebGLSupported 再开探测画布
 */
import { Renderer } from '@pixi/core';
import { ENV } from '@pixi/constants';
import { settings } from '@pixi/settings';
import { Platform } from '@/core/PlatformService';
import { getNativePlatformApi } from '@/core/platformDetect';

declare const GameGlobal: any;

function platformApi(): any {
  return getNativePlatformApi();
}

export function iosPlatform(): boolean {
  try {
    return platformApi()?.getSystemInfoSync?.()?.platform === 'ios';
  } catch {
    return false;
  }
}

export function minigameRendererOpts(guardedHost: boolean): {
  backgroundColor: number;
  resolution: number;
  antialias: boolean;
  preserveDrawingBuffer: boolean;
  preferWebGLVersion: 1;
} {
  return {
    backgroundColor: 0xFFF5EE,
    resolution: 1,
    antialias: !guardedHost,
    preserveDrawingBuffer: !guardedHost,
    preferWebGLVersion: 1,
  };
}

/**
 * 华为 1078+：主屏 canvas 设得比屏幕像素小，画面会缩在一角，不会像微信那样拉伸铺满。
 * 优先用宿主已经开好的主屏尺寸，绝不能再往小了改。
 */
export function capTapDevicePixelRatio(pixelRatio: number): number {
  const dpr = Number(pixelRatio) || 2;
  return Math.min(dpr, 2);
}

export function capTapFramebuffer(
  width: number,
  height: number,
  maxEdge = 2560,
): { width: number; height: number; scale: number } {
  const edge = Math.max(width, height);
  if (edge <= maxEdge) return { width, height, scale: 1 };
  const scale = maxEdge / edge;
  return {
    width: Math.floor(width * scale),
    height: Math.floor(height * scale),
    scale,
  };
}

export function resolveHuaweiViewSize(opts: {
  canvasWidth?: number;
  canvasHeight?: number;
  screenWidth: number;
  screenHeight: number;
  pixelRatio: number;
}): { width: number; height: number; dpr: number } {
  const sw = Math.max(1, Number(opts.screenWidth) || 375);
  const sh = Math.max(1, Number(opts.screenHeight) || 667);
  const dpr = Number(opts.pixelRatio) > 0 ? Number(opts.pixelRatio) : 2;
  const hostW = Number(opts.canvasWidth) || 0;
  const hostH = Number(opts.canvasHeight) || 0;
  if (hostW >= 2 && hostH >= 2) {
    return { width: hostW, height: hostH, dpr: hostW / sw };
  }
  return {
    width: Math.round(sw * dpr),
    height: Math.round(sh * dpr),
    dpr,
  };
}

/**
 * Tap Android 的 libwebglhost 在部分机型上会把 alpha 画布合成到黑色窗口上，
 * 清屏色写了也是纯黑（准入截图 luma_std=0）。先要一块不透明、保留缓冲的 WebGL1。
 * stencil / MSAA 仍不要开，那两项会把主屏搞死。
 */
export function guardedWebGLContextAttempts(): Record<string, unknown>[] {
  return [
    { antialias: false, preserveDrawingBuffer: true, stencil: false, depth: false, alpha: false },
    { antialias: false, preserveDrawingBuffer: true, stencil: false, depth: false, alpha: true },
    { antialias: false, preserveDrawingBuffer: false, stencil: false, depth: true, alpha: true },
    { antialias: false, preserveDrawingBuffer: false },
    {},
  ];
}

export function acquireMainWebGLContext(canvas: unknown): any {
  const c = canvas as {
    getContext?: (type: string, opts?: object) => unknown;
  } | null;
  if (!c?.getContext) return null;
  const attempts = Platform.isCanvasHostGuarded
    ? guardedWebGLContextAttempts()
    : [
      { antialias: true, preserveDrawingBuffer: true, stencil: true, depth: true, alpha: true },
      { antialias: false, stencil: true },
      {},
    ];
  for (const opts of attempts) {
    try {
      const gl = c.getContext('webgl', opts) || c.getContext('experimental-webgl', opts);
      if (!gl) continue;
      // 上下文刚拿到就铺一层不透明底，避免宿主在首帧 Pixi 之前把透明缓冲合成成黑屏
      try {
        const g = gl as {
          clearColor?: (r: number, g: number, b: number, a: number) => void;
          clear?: (mask: number) => void;
          COLOR_BUFFER_BIT?: number;
        };
        g.clearColor?.(1, 0.961, 0.933, 1);
        if (g.COLOR_BUFFER_BIT) g.clear?.(g.COLOR_BUFFER_BIT);
      } catch { /* 清屏失败不挡后续 Pixi */ }
      return gl;
    } catch { /* 换下一组属性 */ }
  }
  return null;
}

/**
 * Pixi 的 isWebGLSupported 会再开一块 canvas 做探测，失败就报
 * Unable to auto-detect a suitable renderer，或掉进 CanvasRenderer（白屏）。
 */
export function forcePixiWebGLRenderer(): void {
  try { Renderer.test = () => true; } catch { /* */ }
}

export function rememberSharedWebGL(gl: unknown): void {
  try {
    if (typeof GameGlobal !== 'undefined') GameGlobal.__huahuaGL = gl;
  } catch { /* */ }
}

export function configurePixiWebGLEnvForPlatform(platform?: string): void {
  if (platform !== 'ios' && !iosPlatform() && !Platform.isCanvasHostGuarded) return;
  settings.PREFER_ENV = ENV.WEBGL;
}

export function blockWebGL2OnCanvas(canvas: unknown): void {
  const c = canvas as {
    getContext?: (type: string, opts?: object) => unknown;
    __webgl2Blocked?: boolean;
  } | null;
  if (!c?.getContext || c.__webgl2Blocked) return;

  const orig = c.getContext.bind(c);
  c.getContext = (type: string, opts?: object) => {
    if (type === 'webgl2') return null;
    return orig(type, opts);
  };
  c.__webgl2Blocked = true;
}

/** 只包 iOS 的 createCanvas。华为上包一层会和 document.createElement 互相重入。 */
export function installBlockWebGL2OnPlatform(): void {
  if (!iosPlatform() || Platform.isCanvasHostGuarded) return;

  const api = platformApi();
  if (!api?.createCanvas || api.__webgl2BlockedCreateCanvas) return;
  api.__webgl2BlockedCreateCanvas = true;

  const origCreate = api.createCanvas.bind(api);
  api.createCanvas = (...args: unknown[]) => {
    const c = origCreate(...args);
    blockWebGL2OnCanvas(c);
    return c;
  };
}
