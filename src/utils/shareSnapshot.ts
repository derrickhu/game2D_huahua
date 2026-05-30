/**
 * 微信小游戏动态分享图。
 * 真机：优先裁主屏 WebGL canvas（wx.canvasToTempFilePath 不传 canvas 字段）；
 * 开发者工具：可再走 RenderTexture → extract → 离屏 toDataURL 落盘。
 */
import * as PIXI from 'pixi.js';
import { settings } from '@pixi/settings';
import { Game } from '@/core/Game';
import { Platform } from '@/core/PlatformService';

export interface ShareSnapshotOptions {
  padding?: number;
  /** 输出 JPG 宽度，默认 500（微信分享常用 5:4） */
  destWidth?: number;
  /** 宽/高比，默认 5/4 */
  aspectRatio?: number;
  /** 截图前临时隐藏（如「晒一下」按钮） */
  hide?: PIXI.DisplayObject[];
  /**
   * 主 canvas 裁切：固定设计坐标区（许愿「恭喜获得」弹层）。
   * 设置后真机主屏裁剪优先用此区域，不依赖子节点包围盒。
   */
  fallbackCrop?: { x: number; y: number; width: number; height: number };
}

type ShareRenderer = PIXI.IRenderer & {
  extract?: { canvas: (target: PIXI.DisplayObject | PIXI.RenderTexture) => HTMLCanvasElement };
  plugins?: { extract?: { canvas: (target: PIXI.DisplayObject | PIXI.RenderTexture) => HTMLCanvasElement } };
  generateTexture?: (
    displayObject: PIXI.DisplayObject,
    options?: { resolution?: number; region?: PIXI.Rectangle },
  ) => PIXI.RenderTexture;
  render: (
    displayObject: PIXI.DisplayObject,
    opts: { renderTexture: PIXI.RenderTexture; clear?: boolean; transform?: PIXI.Matrix },
  ) => void;
};

function getShareRenderer(): ShareRenderer | undefined {
  return Game.app?.renderer as ShareRenderer | undefined;
}

function getExtract(renderer: ShareRenderer): ShareRenderer['extract'] {
  return renderer.extract ?? renderer.plugins?.extract;
}

/** 真机小游戏：主屏裁剪可靠；RT+离屏导出在真机常失败 */
function preferMainScreenCapture(): boolean {
  return Platform.isMinigame && !Platform.isDevtools;
}

function createExportCanvas2D(width: number, height: number): HTMLCanvasElement | null {
  try {
    const c = settings.ADAPTER.createCanvas(width, height) as HTMLCanvasElement;
    return c?.getContext?.('2d') ? c : null;
  } catch (_) {
    return null;
  }
}

function unionBoundsLocal(layers: PIXI.DisplayObject[], padding: number): PIXI.Rectangle | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const layer of layers) {
    if (!layer || layer.destroyed || !layer.visible) continue;
    const b = layer.getBounds(true);
    if (b.width < 1 || b.height < 1) continue;
    minX = Math.min(minX, b.x - padding);
    minY = Math.min(minY, b.y - padding);
    maxX = Math.max(maxX, b.x + b.width + padding);
    maxY = Math.max(maxY, b.y + b.height + padding);
  }
  if (!Number.isFinite(minX)) return null;
  return new PIXI.Rectangle(minX, minY, maxX - minX, maxY - minY);
}

function unionBoundsGlobal(layers: PIXI.DisplayObject[], padding: number): PIXI.Rectangle | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const layer of layers) {
    if (!layer || layer.destroyed || !layer.visible) continue;
    const b = layer.getBounds(true);
    if (b.width < 1 || b.height < 1) continue;
    const tl = layer.toGlobal(new PIXI.Point(b.x - padding, b.y - padding));
    const br = layer.toGlobal(new PIXI.Point(b.x + b.width + padding, b.y + b.height + padding));
    minX = Math.min(minX, tl.x, br.x);
    minY = Math.min(minY, tl.y, br.y);
    maxX = Math.max(maxX, tl.x, br.x);
    maxY = Math.max(maxY, tl.y, br.y);
  }
  if (!Number.isFinite(minX)) return null;
  return new PIXI.Rectangle(minX, minY, maxX - minX, maxY - minY);
}

async function waitPaintFrames(count = 2): Promise<void> {
  const ticker = Game.app?.ticker;
  if (!ticker) {
    await new Promise<void>(r => setTimeout(r, 64));
    return;
  }
  for (let i = 0; i < count; i++) {
    await new Promise<void>(resolve => {
      ticker.addOnce(() => resolve());
    });
  }
}

async function canvasToShareJpg(
  sourceCanvas: PIXI.ICanvas,
  destW: number,
  destH: number,
  letterboxColor = '#fff5ee',
): Promise<string | null> {
  let path = await Platform.canvasToTempFilePath({
    canvas: sourceCanvas,
    destWidth: destW,
    destHeight: destH,
    fileType: 'jpg',
    quality: 0.88,
  });
  if (path) return path;

  const outCanvas = createExportCanvas2D(destW, destH);
  if (!outCanvas) return null;
  const ctx = outCanvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = letterboxColor;
  ctx.fillRect(0, 0, destW, destH);
  ctx.drawImage(sourceCanvas, 0, 0, destW, destH);
  return Platform.canvasToTempFilePath({
    canvas: outCanvas,
    destWidth: destW,
    destHeight: destH,
    fileType: 'jpg',
    quality: 0.88,
  });
}

function repaintStage(renderer: ShareRenderer): void {
  try {
    renderer.render(Game.stage);
  } catch (_) { /* ignore */ }
}

async function captureViaRenderTexture(
  layers: PIXI.DisplayObject[],
  options: ShareSnapshotOptions | undefined,
  renderer: ShareRenderer,
  extract: NonNullable<ReturnType<typeof getExtract>>,
): Promise<string | null> {
  const pad = options?.padding ?? 14;
  const visibleLayers = layers.filter(l => l && !l.destroyed && l.visible);
  if (visibleLayers.length === 0) return null;

  const bounds = unionBoundsLocal(visibleLayers, pad)
    ?? unionBoundsGlobal(visibleLayers, pad);
  if (!bounds || bounds.width < 2 || bounds.height < 2) {
    console.warn('[shareSnapshot] empty bounds');
    return null;
  }

  const aspect = options?.aspectRatio ?? 5 / 4;
  const destW = options?.destWidth ?? 500;
  const destH = Math.max(2, Math.round(destW / aspect));

  let rt: PIXI.RenderTexture | null = null;
  try {
    if (visibleLayers.length === 1 && renderer.generateTexture) {
      try {
        rt = renderer.generateTexture(visibleLayers[0], { resolution: 1, region: bounds });
      } catch (e) {
        console.warn('[shareSnapshot] generateTexture failed', e);
        rt = null;
      }
    }

    if (!rt || rt.destroyed || rt.width < 2 || rt.height < 2) {
      rt?.destroy(true);
      const rw = Math.min(2048, Math.max(2, Math.ceil(bounds.width)));
      const rh = Math.min(2048, Math.max(2, Math.ceil(bounds.height)));
      rt = PIXI.RenderTexture.create({ width: rw, height: rh });
      const matrix = new PIXI.Matrix().translate(-bounds.x, -bounds.y);
      let first = true;
      for (const layer of visibleLayers) {
        renderer.render(layer, { renderTexture: rt, clear: first, transform: matrix });
        first = false;
      }
    }

    const sourceCanvas = extract.canvas(rt);
    if (!sourceCanvas) return null;
    return await canvasToShareJpg(sourceCanvas, destW, destH);
  } catch (err) {
    console.warn('[shareSnapshot] RT capture failed', err);
    return null;
  } finally {
    rt?.destroy(true);
  }
}

/** 主屏 WebGL canvas 按设计坐标裁切（真机分享图主路径） */
async function captureMainCanvasCrop(
  layers: PIXI.DisplayObject[],
  options: ShareSnapshotOptions | undefined,
  renderer: ShareRenderer,
): Promise<string | null> {
  const view = Game.app?.view as HTMLCanvasElement | undefined;
  if (!view?.width || !view?.height) return null;

  const destW = options?.destWidth ?? 500;

  try {
    repaintStage(renderer);
    await waitPaintFrames(2);

    const pad = options?.padding ?? 14;
    let cropX: number;
    let cropY: number;
    let cropW: number;
    let cropH: number;

    const fixed = options?.fallbackCrop;
    if (fixed) {
      cropX = fixed.x;
      cropY = fixed.y;
      cropW = fixed.width;
      cropH = fixed.height;
    } else {
      const g = unionBoundsGlobal(layers, pad);
      if (!g || g.width < 2 || g.height < 2) {
        console.warn('[shareSnapshot] main crop: no global bounds');
        return null;
      }
      cropX = g.x;
      cropY = g.y;
      cropW = g.width;
      cropH = g.height;
    }

    const destH = Math.max(2, Math.round(destW * (cropH / cropW)));
    const pxX = Math.round(Game.toReal(cropX));
    const pxY = Math.round(Game.toReal(cropY));
    const pxW = Math.round(Game.toReal(cropW));
    const pxH = Math.round(Game.toReal(cropH));
    const maxW = view.width;
    const maxH = view.height;
    const x = Math.max(0, Math.min(pxX, maxW - 1));
    const y = Math.max(0, Math.min(pxY, maxH - 1));
    const w = Math.max(1, Math.min(pxW, maxW - x));
    const h = Math.max(1, Math.min(pxH, maxH - y));

    const path = await Platform.canvasToTempFilePath({
      fromMainScreen: true,
      x,
      y,
      width: w,
      height: h,
      destWidth: destW,
      destHeight: destH,
      fileType: 'jpg',
      quality: 0.92,
    });
    if (!path) {
      console.warn('[shareSnapshot] main canvas crop returned null', { x, y, w, h, destW, destH });
    }
    return path;
  } catch (err) {
    console.warn('[shareSnapshot] main canvas crop failed', err);
    return null;
  }
}

/**
 * 将若干显示层合成一张分享 JPG 临时路径；失败返回 null（调用方回退默认分享图）。
 */
export async function captureLayersShareImageUrl(
  layers: PIXI.DisplayObject[],
  options?: ShareSnapshotOptions,
): Promise<string | null> {
  if (layers.length === 0) return null;

  const renderer = getShareRenderer();
  if (!renderer) {
    console.warn('[shareSnapshot] renderer 不可用');
    return null;
  }

  const hide = options?.hide ?? [];
  const prevVisible = hide.map(o => o.visible);
  hide.forEach(o => { o.visible = false; });

  try {
    const extract = getExtract(renderer);
    let imageUrl: string | null = null;
    const mainFirst = preferMainScreenCapture();

    if (mainFirst) {
      imageUrl = await captureMainCanvasCrop(layers, options, renderer);
      if (!imageUrl && extract) {
        imageUrl = await captureViaRenderTexture(layers, options, renderer, extract);
      }
    } else {
      if (extract) {
        imageUrl = await captureViaRenderTexture(layers, options, renderer, extract);
      }
      if (!imageUrl) {
        imageUrl = await captureMainCanvasCrop(layers, options, renderer);
      }
    }

    return imageUrl;
  } finally {
    hide.forEach((o, i) => { o.visible = prevVisible[i] ?? true; });
    repaintStage(renderer);
  }
}

/** 单容器截图（含其可见子节点） */
export function captureContainerShareImageUrl(
  target: PIXI.Container,
  options?: ShareSnapshotOptions,
): Promise<string | null> {
  return captureLayersShareImageUrl([target], options);
}
