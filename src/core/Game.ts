/**
 * 全局游戏单例 - 持有 PIXI.Application 和核心引用
 */
import * as PIXI from 'pixi.js';
import { ShaderSystem } from '@pixi/core';
import { TweenManager } from './TweenManager';
import { BuildingManager } from '@/managers/BuildingManager';
import {
  ENABLE_PAD_SAFE_FRAME,
  ENABLE_RESPONSIVE_LAYOUT_V2,
} from '@/config/FeatureFlags';
import {
  computeViewportLayout,
  normalizeViewportMetrics,
  pickHuaweiViewportInput,
  type ViewportLayout,
  type ViewportMetrics,
} from '@/config/ResponsiveLayout';
import { getNativePlatformApi } from '@/core/platformDetect';
import { Platform } from '@/core/PlatformService';
import { readHostCanvasRect } from '@/utils/hostCanvasRect';
import { eventClientPoint, federatedToDesignPoint } from '@/utils/canvasInteraction';
import {
  acquireMainWebGLContext,
  blockWebGL2OnCanvas,
  configurePixiWebGLEnvForPlatform,
  forcePixiWebGLRenderer,
  installBlockWebGL2OnPlatform,
  minigameRendererOpts,
  rememberSharedWebGL,
  resolveHuaweiViewSize,
} from '@/core/webglContextPatch';

/** 华为宿主 console 把异常对象打成 [object Object]，必须先摊平成文本 */
function errText(e: unknown): string {
  if (e == null) return String(e);
  const any = e as { message?: unknown; errMsg?: unknown; stack?: unknown };
  const head = String(any.message ?? any.errMsg ?? e);
  const tail = any.stack ? ' | ' + String(any.stack).slice(0, 400) : '';
  return head + tail;
}

/* ---- @pixi/unsafe-eval 内联 patch ---- */

const GLSL_TO_SINGLE_SETTERS: Record<string, (gl: any, loc: any, cv: any, v: any) => void> = {
  vec3(gl, loc, cv, v) { (cv[0]!==v[0]||cv[1]!==v[1]||cv[2]!==v[2])&&(cv[0]=v[0],cv[1]=v[1],cv[2]=v[2],gl.uniform3f(loc,v[0],v[1],v[2])); },
  int(gl, loc, _c, v) { gl.uniform1i(loc, v); },
  ivec2(gl, loc, _c, v) { gl.uniform2i(loc, v[0], v[1]); },
  ivec3(gl, loc, _c, v) { gl.uniform3i(loc, v[0], v[1], v[2]); },
  ivec4(gl, loc, _c, v) { gl.uniform4i(loc, v[0], v[1], v[2], v[3]); },
  uint(gl, loc, _c, v) { gl.uniform1ui(loc, v); },
  uvec2(gl, loc, _c, v) { gl.uniform2ui(loc, v[0], v[1]); },
  uvec3(gl, loc, _c, v) { gl.uniform3ui(loc, v[0], v[1], v[2]); },
  uvec4(gl, loc, _c, v) { gl.uniform4ui(loc, v[0], v[1], v[2], v[3]); },
  bvec2(gl, loc, _c, v) { gl.uniform2i(loc, v[0], v[1]); },
  bvec3(gl, loc, _c, v) { gl.uniform3i(loc, v[0], v[1], v[2]); },
  bvec4(gl, loc, _c, v) { gl.uniform4i(loc, v[0], v[1], v[2], v[3]); },
  mat2(gl, loc, _c, v) { gl.uniformMatrix2fv(loc, false, v); },
  mat4(gl, loc, _c, v) { gl.uniformMatrix4fv(loc, false, v); },
};
const GLSL_TO_ARRAY_SETTERS: Record<string, (gl: any, loc: any, cv: any, v: any) => void> = {
  float(gl, loc, _c, v) { gl.uniform1fv(loc, v); },
  vec2(gl, loc, _c, v) { gl.uniform2fv(loc, v); },
  vec3(gl, loc, _c, v) { gl.uniform3fv(loc, v); },
  vec4(gl, loc, _c, v) { gl.uniform4fv(loc, v); },
  int(gl, loc, _c, v) { gl.uniform1iv(loc, v); },
  ivec2(gl, loc, _c, v) { gl.uniform2iv(loc, v); },
  ivec3(gl, loc, _c, v) { gl.uniform3iv(loc, v); },
  ivec4(gl, loc, _c, v) { gl.uniform4iv(loc, v); },
  uint(gl, loc, _c, v) { gl.uniform1uiv(loc, v); },
  uvec2(gl, loc, _c, v) { gl.uniform2uiv(loc, v); },
  uvec3(gl, loc, _c, v) { gl.uniform3uiv(loc, v); },
  uvec4(gl, loc, _c, v) { gl.uniform4uiv(loc, v); },
  bool(gl, loc, _c, v) { gl.uniform1iv(loc, v); },
  bvec2(gl, loc, _c, v) { gl.uniform2iv(loc, v); },
  bvec3(gl, loc, _c, v) { gl.uniform3iv(loc, v); },
  bvec4(gl, loc, _c, v) { gl.uniform4iv(loc, v); },
  sampler2D(gl, loc, _c, v) { gl.uniform1iv(loc, v); },
  samplerCube(gl, loc, _c, v) { gl.uniform1iv(loc, v); },
  sampler2DArray(gl, loc, _c, v) { gl.uniform1iv(loc, v); },
};

function patchedSyncUniforms(group: any, uniformData: any, ud: any, uv: any, renderer: any): void {
  let textureCount = 0, v: any = null, cv: any = null;
  const gl = renderer.gl;
  for (const i in group.uniforms) {
    const data = uniformData[i], uvi = uv[i], udi = ud[i], gu = group.uniforms[i];
    if (!data) { if (gu.group === true) renderer.shader.syncUniformGroup(uvi); continue; }
    if (data.type==='float'&&data.size===1&&!data.isArray) { if(uvi!==udi.value){udi.value=uvi;gl.uniform1f(udi.location,uvi);} }
    else if (data.type==='bool'&&data.size===1&&!data.isArray) { if(uvi!==udi.value){udi.value=uvi;gl.uniform1i(udi.location,Number(uvi));} }
    else if ((data.type==='sampler2D'||data.type==='samplerCube'||data.type==='sampler2DArray')&&data.size===1&&!data.isArray) {
      renderer.texture.bind(uvi,textureCount); if(udi.value!==textureCount){udi.value=textureCount;gl.uniform1i(udi.location,textureCount);} textureCount++;
    } else if (data.type==='mat3'&&data.size===1&&!data.isArray) {
      gu.a!==void 0?gl.uniformMatrix3fv(udi.location,false,uvi.toArray(true)):gl.uniformMatrix3fv(udi.location,false,uvi);
    } else if (data.type==='vec2'&&data.size===1&&!data.isArray) {
      if(gu.x!==void 0){cv=udi.value;v=uvi;(cv[0]!==v.x||cv[1]!==v.y)&&(cv[0]=v.x,cv[1]=v.y,gl.uniform2f(udi.location,v.x,v.y));}
      else{cv=udi.value;v=uvi;(cv[0]!==v[0]||cv[1]!==v[1])&&(cv[0]=v[0],cv[1]=v[1],gl.uniform2f(udi.location,v[0],v[1]));}
    } else if (data.type==='vec4'&&data.size===1&&!data.isArray) {
      if(gu.width!==void 0){cv=udi.value;v=uvi;(cv[0]!==v.x||cv[1]!==v.y||cv[2]!==v.width||cv[3]!==v.height)&&(cv[0]=v.x,cv[1]=v.y,cv[2]=v.width,cv[3]=v.height,gl.uniform4f(udi.location,v.x,v.y,v.width,v.height));}
      else{cv=udi.value;v=uvi;(cv[0]!==v[0]||cv[1]!==v[1]||cv[2]!==v[2]||cv[3]!==v[3])&&(cv[0]=v[0],cv[1]=v[1],cv[2]=v[2],cv[3]=v[3],gl.uniform4f(udi.location,v[0],v[1],v[2],v[3]));}
    } else { (data.size===1&&!data.isArray?GLSL_TO_SINGLE_SETTERS:GLSL_TO_ARRAY_SETTERS)[data.type].call(null,gl,udi.location,udi.value,uvi); }
  }
}

function ensureUnsafeEvalPatch(): void {
  if ((ShaderSystem.prototype as any).__patched) return;
  Object.assign(ShaderSystem.prototype, {
    __patched: true,
    systemCheck() { /* 禁用 eval 检测 */ },
    syncUniforms(group: any, glProgram: any) {
      const self = this as any;
      patchedSyncUniforms(group, self.shader.program.uniformData, glProgram.uniformData, group.uniforms, self.renderer);
    },
  });
}

// 立即执行一次（模块加载时）
ensureUnsafeEvalPatch();

/* ---- end unsafe-eval patch ---- */

class GameClass {
  app!: PIXI.Application;
  stage: PIXI.Container;
  ticker: PIXI.Ticker;

  /** 设计分辨率 */
  designWidth = 750;
  designHeight = 1334;

  /** 实际屏幕尺寸（逻辑像素） */
  screenWidth = 375;
  screenHeight = 667;

  /** 缩放比 */
  scale = 1;
  /** CSS 逻辑像素到设计坐标的缩放（不含 DPR）。 */
  contentScale = 1;
  /** 核心安全框在窗口中的 CSS 像素偏移。 */
  contentOffsetX = 0;
  contentOffsetY = 0;
  /** 当前采用宽适配还是 Pad 高度适配。 */
  viewportMode: ViewportLayout['mode'] = 'width-fit';

  /** 像素密度 */
  dpr = 1;

  /** 安全区顶部偏移（设计坐标），位于微信胶囊按钮下方 */
  safeTop = 0;
  /** 底部系统手势区高度（设计坐标） */
  safeBottom = 0;

  private _initialized = false;
  private _canvas: any = null;
  private _renderFailSeen = new Set<string>();
  private _viewportListeners = new Set<() => void>();
  private _resizeTimer: ReturnType<typeof setTimeout> | null = null;

  /** 唯一实例标识，用于调试模块重复加载问题 */
  readonly _uid = Math.random().toString(36).slice(2, 8);

  constructor() {
    // 预初始化 stage/ticker，保证任何时刻访问都不为 undefined
    this.stage = new PIXI.Container();
    this.ticker = new PIXI.Ticker();
  }

  init(canvas: any): void {
    if (this._initialized) return;

    // 再次确保 patch（防止 bundler 重排）
    ensureUnsafeEvalPatch();

    this._canvas = canvas;
    const viewport = this._readViewportMetrics();
    this._assignViewportMetrics(viewport);

    let realWidth = Math.round(this.screenWidth * this.dpr);
    let realHeight = Math.round(this.screenHeight * this.dpr);
    if (Platform.isHuawei) {
      const view = this._applyHuaweiHostView(canvas);
      realWidth = view.width;
      realHeight = view.height;
    }

    const RENDERER_OPTS = minigameRendererOpts(Platform.isCanvasHostGuarded);
    forcePixiWebGLRenderer();
    try { (PIXI.utils as { isWebGLSupported: () => boolean }).isWebGLSupported = () => true; } catch { /* */ }
    blockWebGL2OnCanvas(canvas);
    let sysPlatform: string | undefined;
    try { sysPlatform = getNativePlatformApi()?.getSystemInfoSync?.()?.platform; } catch { /* */ }
    configurePixiWebGLEnvForPlatform(sysPlatform);
    installBlockWebGL2OnPlatform();
    const sharedGL = acquireMainWebGLContext(canvas);
    rememberSharedWebGL(sharedGL);
    try {
      const cv = canvas as { width?: number; height?: number; __huahuaMeasure?: boolean };
      (GameGlobal as any).__bootDiag?.(
        (sharedGL ? 'gl=ok' : 'gl=null')
        + ` cv=${cv?.width || 0}x${cv?.height || 0}`
        + ` fake=${!!cv?.__huahuaMeasure}`
        + ` src=${(GameGlobal as any).__hostCanvasSrc || '?'}`,
      );
    } catch { /* */ }

    try {
      if (Platform.isHuawei) {
        // 华为主屏 canvas 设小了会缩在一角；只允许放大到目标像素，绝不缩小
        if ((canvas.width || 0) < realWidth) canvas.width = realWidth;
        if ((canvas.height || 0) < realHeight) canvas.height = realHeight;
        realWidth = canvas.width || realWidth;
        realHeight = canvas.height || realHeight;
      } else {
        canvas.width = realWidth;
        canvas.height = realHeight;
      }
    } catch (e) {
      console.warn('[Game] 设置 canvas 尺寸失败:', errText(e));
    }
    try {
      // 华为：宿主已经按物理像素铺满。再写 style.width=screenWidth
      // 若 screenWidth 被报成 1084，CSS 画布会比窗口大一倍多，只露出屋顶。
      if (canvas.style && !Platform.isHuawei) {
        canvas.style.width = `${this.screenWidth}px`;
        canvas.style.height = `${this.screenHeight}px`;
      }
    } catch { /* 宿主可能没有 style */ }
    try {
      const sys = getNativePlatformApi()?.getSystemInfoSync?.();
      const rect = readHostCanvasRect();
      (GameGlobal as any).__bootDiag?.(
        `view=${realWidth}x${realHeight} dpr=${Number(this.dpr).toFixed(2)} logical=${this.screenWidth}x${this.screenHeight}`
        + ` raw=${sys?.screenWidth || 0}x${sys?.screenHeight || 0}`
        + ` css=${rect ? `${Math.round(rect.width)}x${Math.round(rect.height)}` : 'none'}`,
      );
    } catch { /* */ }

    const rendererOpts = {
      view: canvas,
      width: realWidth,
      height: realHeight,
      ...RENDERER_OPTS,
      accessibility: false,
      hello: false,
      ...(sharedGL ? { context: sharedGL } : {}),
    } as any;

    // 华为：不要走 Application。插件初始化会再 createCanvas，和宿主互相重入。
    let renderer: PIXI.IRenderer | null = null;
    let app: PIXI.Application | null = null;
    if (!Platform.isCanvasHostGuarded) {
      try {
        app = new PIXI.Application(rendererOpts);
      } catch (e) {
        console.error('[Game] new PIXI.Application 失败:', errText(e));
        try { (GameGlobal as any).__bootDiag?.('PIXI.Application 失败:' + errText(e)); } catch { /* */ }
      }
    }

    if (app && app.stage && app.ticker && app.renderer) {
      this.app = app;
      this.stage = app.stage;
      this.ticker = app.ticker;
      renderer = app.renderer;
    } else {
      if (app?.renderer) renderer = app.renderer;
      if (!renderer) {
        try {
          renderer = new PIXI.Renderer(rendererOpts);
          try { (GameGlobal as any).__bootDiag?.('renderer=ok'); } catch { /* */ }
        } catch (e2) {
          console.error('[Game] new PIXI.Renderer 失败:', errText(e2));
          try { (GameGlobal as any).__bootDiag?.('PIXI.Renderer 失败:' + errText(e2)); } catch { /* */ }
        }
      }
      if (!renderer) {
        try {
          renderer = PIXI.autoDetectRenderer(rendererOpts);
        } catch (e3) {
          console.error('[Game] autoDetectRenderer 失败:', errText(e3));
          try { (GameGlobal as any).__bootDiag?.('autoDetectRenderer 失败:' + errText(e3)); } catch { /* */ }
        }
      }

      this.stage = new PIXI.Container();
      this.ticker = new PIXI.Ticker();
      this.ticker.start();

      if (renderer) {
        this.ticker.add(() => { this._renderGuarded(renderer!); });
      } else {
        console.error('[Game] 所有渲染器创建均失败，画面将无法渲染');
      }

      this.app = {
        stage: this.stage,
        ticker: this.ticker,
        renderer,
        view: canvas,
      } as any;
    }

    if (!renderer) {
      try { (GameGlobal as any).__gameRendered = false; } catch { /* */ }
      try { (GameGlobal as any).__bootDiag?.('Game.init 无渲染器'); } catch { /* */ }
      try { (GameGlobal as any).__showBootDiag?.(); } catch { /* */ }
      console.error('[Game] 渲染器不可用，终止初始化');
      return;
    }
    try { (GameGlobal as any).__gameRendered = true; } catch { /* */ }

    // 整体缩放到设计分辨率
    this.stage.scale.set(this.scale, this.scale);
    this.stage.position.set(this.contentOffsetX * this.dpr, this.contentOffsetY * this.dpr);

    // 全局 ticker：Tween + 棋盘工具/宝箱 CD（与当前场景无关；切花店装修时主场景 _update 已移除，仍须走表）
    this.ticker.add(() => {
      const dt = this.ticker.deltaMS / 1000;
      TweenManager.update(dt);
      BuildingManager.update(dt);
    });

    // ---- 修复 EventSystem 坐标映射 ----
    // 真机 canvas.parentElement 不可写，PixiJS 内部 mapPositionToPoint
    // 走到 fallback rect {width:0,height:0} 导致坐标 NaN，所有 hit test 失败
    try {
      const evtSys = (this.app.renderer as any).events;
      if (evtSys && evtSys.domElement) {
        const dom = evtSys.domElement;
        evtSys.mapPositionToPoint = (point: any, x: number, y: number) => {
          let rect: any;
          try { rect = dom.getBoundingClientRect(); } catch (_) { rect = null; }
          if (!rect || !rect.width || !rect.height) {
            rect = { left: 0, top: 0, width: this.screenWidth, height: this.screenHeight };
          }
          const resMul = 1.0 / (evtSys.resolution || 1);
          point.x = ((x - (rect.left || 0)) * (dom.width / rect.width)) * resMul;
          point.y = ((y - (rect.top || 0)) * (dom.height / rect.height)) * resMul;
        };
      }
    } catch (e) { console.warn('[Game] EventSystem patch 失败:', errText(e)); }

    this._initialized = true;
    this._bindViewportResize();
  }

  /** 监听可用窗口变化。返回取消监听函数。 */
  onViewportChange(listener: () => void): () => void {
    this._viewportListeners.add(listener);
    return () => this._viewportListeners.delete(listener);
  }

  /** 重读窗口数据并同步 renderer/stage；尺寸未变化时不会触发布局。 */
  refreshViewport(resizeInfo?: any): boolean {
    if (!this._initialized) return false;
    const next = this._readViewportMetrics(resizeInfo);
    const nextLayout = computeViewportLayout(
      next,
      ENABLE_RESPONSIVE_LAYOUT_V2 && ENABLE_PAD_SAFE_FRAME,
    );
    const nextSafeTop = Math.round(nextLayout.safeTop);
    const nextSafeBottom = ENABLE_RESPONSIVE_LAYOUT_V2
      ? Math.round(nextLayout.safeBottom)
      : 0;
    const sameLogical = next.width === this.screenWidth
      && next.height === this.screenHeight
      && nextSafeTop === this.safeTop
      && nextSafeBottom === this.safeBottom;
    // 华为 dpr 以宿主 canvas 为准，不能和 getSystemInfo.pixelRatio 比相等
    if (sameLogical && (Platform.isHuawei || next.pixelRatio === this.dpr)) {
      return false;
    }

    this._assignViewportMetrics(next);
    let realWidth = Math.round(this.screenWidth * this.dpr);
    let realHeight = Math.round(this.screenHeight * this.dpr);
    if (Platform.isHuawei) {
      const view = this._applyHuaweiHostView(this._canvas);
      realWidth = view.width;
      realHeight = view.height;
    }
    try {
      if (Platform.isHuawei) {
        const canvas = this._canvas;
        const prevW = canvas?.width || 0;
        const prevH = canvas?.height || 0;
        if (canvas) {
          if (prevW < realWidth) canvas.width = realWidth;
          if (prevH < realHeight) canvas.height = realHeight;
          realWidth = canvas.width || realWidth;
          realHeight = canvas.height || realHeight;
        }
        if (realWidth !== prevW || realHeight !== prevH) {
          (this.app?.renderer as any)?.resize?.(realWidth, realHeight);
        }
      } else {
        (this.app?.renderer as any)?.resize?.(realWidth, realHeight);
      }
    } catch (e) {
      console.warn('[Game] renderer.resize 失败，回退直接更新 canvas:', e);
      if (this._canvas && !Platform.isHuawei) {
        this._canvas.width = realWidth;
        this._canvas.height = realHeight;
      }
    }
    this.stage.scale.set(this.scale, this.scale);
    this.stage.position.set(this.contentOffsetX * this.dpr, this.contentOffsetY * this.dpr);
    for (const listener of [...this._viewportListeners]) {
      try { listener(); } catch (e) { console.warn('[Game] viewport listener 失败:', e); }
    }
    return true;
  }

  private _assignViewportMetrics(metrics: ViewportMetrics): void {
    const layout = computeViewportLayout(
      metrics,
      ENABLE_RESPONSIVE_LAYOUT_V2 && ENABLE_PAD_SAFE_FRAME,
    );
    this.screenWidth = metrics.width;
    this.screenHeight = metrics.height;
    this.dpr = metrics.pixelRatio;
    this.contentScale = layout.contentScale;
    this.contentOffsetX = layout.contentOffsetX;
    this.contentOffsetY = layout.contentOffsetY;
    this.viewportMode = layout.mode;
    this.safeTop = Math.round(layout.safeTop);
    this.safeBottom = ENABLE_RESPONSIVE_LAYOUT_V2
      ? Math.round(layout.safeBottom)
      : 0;
    this.scale = this.contentScale * metrics.pixelRatio;
  }

  /**
   * 对齐 xiaochu2：宿主 canvas 已是物理像素时跟宿主走，dpr = hostW / screenWidth。
   * 只改 scale/dpr，不在这里改小 canvas。
   */
  private _applyHuaweiHostView(canvas: any): { width: number; height: number } {
    const view = resolveHuaweiViewSize({
      canvasWidth: canvas?.width,
      canvasHeight: canvas?.height,
      screenWidth: this.screenWidth,
      screenHeight: this.screenHeight,
      pixelRatio: this.dpr,
    });
    this.dpr = view.dpr;
    this.scale = this.contentScale * this.dpr;
    return { width: view.width, height: view.height };
  }

  private _readViewportMetrics(resizeInfo?: any): ViewportMetrics {
    const api: any = getNativePlatformApi();
    let sysInfo: any = null;
    let windowInfo: any = null;
    let capsule: any = null;
    try { sysInfo = api?.getSystemInfoSync?.() ?? null; } catch (_) {}
    try { capsule = api?.getMenuButtonBoundingClientRect?.() ?? null; } catch (_) {}
    if (Platform.isHuawei) {
      const rect = readHostCanvasRect();
      const canvas = this._canvas as { width?: number; height?: number } | null;
      return normalizeViewportMetrics(
        pickHuaweiViewportInput(sysInfo, this.screenWidth, this.screenHeight, {
          canvasWidth: canvas?.width,
          canvasHeight: canvas?.height,
          cssWidth: rect?.width,
          cssHeight: rect?.height,
        }),
        this.screenWidth,
        this.screenHeight,
      );
    }
    if (!ENABLE_RESPONSIVE_LAYOUT_V2) {
      const legacySafeTop = capsule?.top
        || (sysInfo?.statusBarHeight ? sysInfo.statusBarHeight + 6 : 40);
      return {
        width: sysInfo?.screenWidth || this.screenWidth,
        height: sysInfo?.screenHeight || this.screenHeight,
        pixelRatio: sysInfo ? (sysInfo.pixelRatio || 2) : this.dpr,
        safeTopPx: legacySafeTop,
        safeBottomPx: 0,
      };
    }
    if (ENABLE_RESPONSIVE_LAYOUT_V2) {
      try { windowInfo = api?.getWindowInfo?.() ?? null; } catch (_) {}
    }

    const browserW = typeof window !== 'undefined' ? Number(window.innerWidth) : 0;
    const browserH = typeof window !== 'undefined' ? Number(window.innerHeight) : 0;
    const source = ENABLE_RESPONSIVE_LAYOUT_V2 ? (windowInfo ?? sysInfo ?? {}) : (sysInfo ?? {});
    const width = ENABLE_RESPONSIVE_LAYOUT_V2
      ? resizeInfo?.windowWidth ?? source.windowWidth ?? source.screenWidth ?? browserW
      : source.screenWidth;
    const height = ENABLE_RESPONSIVE_LAYOUT_V2
      ? resizeInfo?.windowHeight ?? source.windowHeight ?? source.screenHeight ?? browserH
      : source.screenHeight;
    const safeArea = source.safeArea ?? sysInfo?.safeArea;

    return normalizeViewportMetrics({
      width,
      height,
      pixelRatio: source.pixelRatio ?? sysInfo?.pixelRatio,
      statusBarHeight: source.statusBarHeight ?? sysInfo?.statusBarHeight,
      safeAreaTop: safeArea?.top,
      safeAreaBottom: safeArea?.bottom,
      capsuleTop: capsule?.top,
    }, this.screenWidth, this.screenHeight);
  }

  private _bindViewportResize(): void {
    if (!ENABLE_RESPONSIVE_LAYOUT_V2) return;
    // 华为 onWindowResize / window.innerWidth 不可信，跟 xiaochu2 一样不跟窗体改主屏
    if (Platform.isHuawei) return;
    const api: any = getNativePlatformApi();
    const schedule = (info?: any): void => {
      if (this._resizeTimer) clearTimeout(this._resizeTimer);
      this._resizeTimer = setTimeout(() => {
        this._resizeTimer = null;
        this.refreshViewport(info);
      }, 120);
    };
    if (typeof api?.onWindowResize === 'function') {
      api.onWindowResize(schedule);
    } else if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('resize', () => schedule());
    }
  }

  private _renderGuarded(renderer: PIXI.IRenderer): void {
    try {
      renderer.render(this.stage);
    } catch (e) {
      const desc = String((e as any)?.message || e);
      if (this._renderFailSeen.has(desc) || this._renderFailSeen.size >= 3) return;
      this._renderFailSeen.add(desc);
      console.error('[Game] render-fail', errText(e));
      try { (GameGlobal as any).__bootDiag?.('render-fail ' + desc); } catch { /* */ }
      try { (GameGlobal as any).__showBootDiag?.(); } catch { /* */ }
    }
  }

  /** 设计坐标转实际像素 */
  toReal(v: number): number {
    return v * this.scale;
  }

  /** 获取设计分辨率下的逻辑宽度 */
  get logicWidth(): number {
    return this.designWidth;
  }

  /** 获取设计分辨率下的逻辑高度 */
  get logicHeight(): number {
    return this.screenHeight / this.contentScale;
  }

  /** 指针 Y 换算高度；关闭响应式开关时完整回退旧版固定设计高。 */
  get coordinateHeight(): number {
    return ENABLE_RESPONSIVE_LAYOUT_V2 ? this.logicHeight : this.designHeight;
  }

  /** 完整窗口在核心 750 坐标系中的可见范围；Pad 左侧通常为负值。 */
  get visibleBounds(): { left: number; top: number; width: number; height: number; right: number; bottom: number } {
    const left = -this.contentOffsetX / this.contentScale;
    const top = -this.contentOffsetY / this.contentScale;
    const width = this.screenWidth / this.contentScale;
    const height = this.screenHeight / this.contentScale;
    return { left, top, width, height, right: left + width, bottom: top + height };
  }

  /** 窗口 CSS 坐标转核心设计坐标，包含 Pad 居中偏移。 */
  clientToDesign(clientX: number, clientY: number): { x: number; y: number } {
    const rect = readHostCanvasRect();
    if (rect) {
      const sx = this.screenWidth / rect.width;
      const sy = this.screenHeight / rect.height;
      return {
        x: ((clientX - rect.left) * sx - this.contentOffsetX) / this.contentScale,
        y: ((clientY - rect.top) * sy - this.contentOffsetY) / this.contentScale,
      };
    }
    return {
      x: (clientX - this.contentOffsetX) / this.contentScale,
      y: (clientY - this.contentOffsetY) / this.contentScale,
    };
  }

  /** 宿主 pointer / touch 事件 → 设计坐标 */
  eventToDesign(e: unknown): { x: number; y: number } {
    const p = eventClientPoint(e);
    return this.clientToDesign(p.x, p.y);
  }

  /** Pixi Federated 按下 → 设计坐标（华为不把 CSS global 再 /dpr） */
  federatedToDesign(e: {
    nativeEvent?: unknown;
    clientX?: number;
    clientY?: number;
    global?: { x: number; y: number };
  }): { x: number; y: number } {
    return federatedToDesignPoint(
      e,
      (x, y) => this.clientToDesign(x, y),
      (x, y) => this.globalToDesign(x, y),
    );
  }

  /** renderer 全局物理坐标转核心设计坐标。 */
  globalToDesign(globalX: number, globalY: number): { x: number; y: number } {
    return this.clientToDesign(globalX / this.dpr, globalY / this.dpr);
  }

  /** 核心设计坐标转窗口 CSS 坐标。 */
  designToClient(designX: number, designY: number): { x: number; y: number } {
    return {
      x: designX * this.contentScale + this.contentOffsetX,
      y: designY * this.contentScale + this.contentOffsetY,
    };
  }
}

// 通过全局对象保证单例：防止 bundler 意外生成多份模块导致多个实例
const _global: any = typeof GameGlobal !== 'undefined' ? GameGlobal
  : typeof window !== 'undefined' ? window
  : typeof globalThis !== 'undefined' ? globalThis
  : {};

if (!_global.__gameInstance) {
  _global.__gameInstance = new GameClass();
}
export const Game: GameClass = _global.__gameInstance;
