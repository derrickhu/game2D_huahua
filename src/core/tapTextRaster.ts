/**
 * 对齐 xiaochu2：华为/守卫宿主全程只用一块真实 2D canvas。
 * 每个 Pixi.Text 都 ADAPTER.createCanvas() 会把纹理盖烂，或把主屏 WebGL 抢掉。
 */
import { CanvasResource } from '@pixi/core';
import { Text } from '@pixi/text';
import { Platform } from '@/core/PlatformService';

const _CR = CanvasResource as any;
if (!_CR.__tapWrapTest) {
  const origTest = _CR.test.bind(CanvasResource);
  _CR.test = (source: any) => !!(source && source.__tapTextWrap === true) || origTest(source);
  _CR.__tapWrapTest = true;
}

interface Host2d {
  canvas: { width: number; height: number };
  ctx: any;
}

let _hostState: 'pending' | 'ok' | 'null' = 'pending';

export function tapTextHostState(): string {
  return _hostState;
}

export function installTapTextRaster(acquireHost: () => Host2d | null): (w?: number, h?: number) => any {
  let host: Host2d | null | undefined;

  const getHost = (): Host2d | null => {
    if (host !== undefined) return host;
    host = acquireHost();
    _hostState = host ? 'ok' : 'null';
    return host;
  };

  const createWrap = (w?: number, h?: number): any => {
    const state = {
      w: Math.max(1, w || 1),
      h: Math.max(1, h || 1),
      snap: null as Uint8ClampedArray | null,
      pendingReset: true,
    };

    const syncSize = (): Host2d | null => {
      const h2 = getHost();
      if (!h2) return null;
      if (h2.canvas.width !== state.w) h2.canvas.width = state.w;
      if (h2.canvas.height !== state.h) h2.canvas.height = state.h;
      if (state.pendingReset) {
        state.pendingReset = false;
        try { h2.ctx.setTransform(1, 0, 0, 1, 0, 0); } catch { /* */ }
        try { h2.ctx.clearRect(0, 0, state.w, state.h); } catch { /* */ }
      }
      return h2;
    };

    const ctx: any = {
      fillStyle: '#000000',
      strokeStyle: '#000000',
      font: '16px sans-serif',
      textAlign: 'left',
      textBaseline: 'alphabetic',
      lineWidth: 1,
      lineJoin: 'miter',
      miterLimit: 10,
      shadowColor: 'black',
      shadowBlur: 0,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      globalAlpha: 1,
      letterSpacing: '0px',
      textLetterSpacing: '0px',
      apply(hctx: any) {
        hctx.fillStyle = ctx.fillStyle;
        hctx.strokeStyle = ctx.strokeStyle;
        hctx.font = ctx.font;
        hctx.textAlign = ctx.textAlign;
        hctx.textBaseline = ctx.textBaseline;
        hctx.lineWidth = ctx.lineWidth;
        hctx.lineJoin = ctx.lineJoin;
        hctx.miterLimit = ctx.miterLimit;
        hctx.shadowColor = ctx.shadowColor;
        hctx.shadowBlur = ctx.shadowBlur;
        hctx.shadowOffsetX = ctx.shadowOffsetX;
        hctx.shadowOffsetY = ctx.shadowOffsetY;
        hctx.globalAlpha = ctx.globalAlpha;
        try { (hctx as any).letterSpacing = ctx.letterSpacing; } catch { /* */ }
        try { (hctx as any).textLetterSpacing = ctx.textLetterSpacing; } catch { /* */ }
      },
      withHost(fn: (hctx: any) => any) {
        const h2 = syncSize();
        if (!h2) return undefined;
        ctx.apply(h2.ctx);
        return fn(h2.ctx);
      },
      measureText(s: string) {
        const r = ctx.withHost((hctx: any) => hctx.measureText(s));
        return r ?? { width: String(s || '').length * 10 };
      },
      clearRect(x: number, y: number, cw: number, ch: number) {
        ctx.withHost((hctx: any) => hctx.clearRect(x, y, cw, ch));
      },
      fillRect(x: number, y: number, cw: number, ch: number) {
        ctx.withHost((hctx: any) => hctx.fillRect(x, y, cw, ch));
      },
      fillText(t: string, x: number, y: number) {
        ctx.withHost((hctx: any) => hctx.fillText(t, x, y));
      },
      strokeText(t: string, x: number, y: number) {
        ctx.withHost((hctx: any) => hctx.strokeText(t, x, y));
      },
      scale(x: number, y: number) {
        ctx.withHost((hctx: any) => hctx.scale(x, y));
      },
      translate(x: number, y: number) {
        ctx.withHost((hctx: any) => hctx.translate(x, y));
      },
      setTransform(a: number, b: number, c: number, d: number, e: number, f: number) {
        ctx.withHost((hctx: any) => hctx.setTransform(a, b, c, d, e, f));
      },
      save() { getHost()?.ctx.save(); },
      restore() { getHost()?.ctx.restore(); },
      beginPath() { getHost()?.ctx.beginPath(); },
      closePath() { getHost()?.ctx.closePath(); },
      getImageData(_x: number, _y: number, iw: number, ih: number) {
        if (state.snap && state.snap.length === iw * ih * 4) {
          return { data: state.snap, width: iw, height: ih };
        }
        const h2 = getHost();
        if (h2 && h2.canvas.width === iw && h2.canvas.height === ih) {
          try { return h2.ctx.getImageData(0, 0, iw, ih); } catch { /* */ }
        }
        return { data: new Uint8ClampedArray(iw * ih * 4), width: iw, height: ih };
      },
      putImageData() {},
      createLinearGradient() { return { addColorStop() {} }; },
    };

    const canvas: any = {
      __tapTextWrap: true,
      style: {},
      get width() { return state.w; },
      set width(v: number) { state.w = Math.max(1, v | 0); state.snap = null; state.pendingReset = true; },
      get height() { return state.h; },
      set height(v: number) { state.h = Math.max(1, v | 0); state.snap = null; state.pendingReset = true; },
      getContext(type: string) { return type === '2d' ? ctx : null; },
      addEventListener() {},
      removeEventListener() {},
      __tapSnap() {
        const h2 = getHost();
        if (!h2) return;
        if (h2.canvas.width !== state.w || h2.canvas.height !== state.h) return;
        try {
          const img = h2.ctx.getImageData(0, 0, state.w, state.h);
          state.snap = new Uint8ClampedArray(img.data);
        } catch {
          state.snap = null;
        }
      },
    };
    ctx.canvas = canvas;
    return canvas;
  };

  const proto = Text.prototype as any;
  if (!proto.__tapSnapPatched) {
    const orig = proto.updateTexture;
    proto.updateTexture = function updateTextureTap(this: Text) {
      orig.call(this);
      const next = (this as any).canvas;
      if (typeof next?.__tapSnap === 'function') next.__tapSnap();
    };
    proto.__tapSnapPatched = true;
  }

  return createWrap;
}

export function shouldInstallTapTextRaster(): boolean {
  return Platform.isCanvasHostGuarded;
}
