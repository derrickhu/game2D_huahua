/**
 * 小游戏 canvas 拖拽 / 滚动事件链。
 *
 * 华为快游戏宿主只派发 touch，pointermove / pointerup 一次都不来。
 * 微信 / 抖音的 pointer 链已在真机验证过，不跟着改道。
 */
import { Platform } from '@/core/PlatformService';

export type TouchCanvasLike = {
  addEventListener(type: string, listener: EventListener, options?: boolean | AddEventListenerOptions): void;
  removeEventListener(type: string, listener: EventListener, options?: boolean | EventListenerOptions): void;
};

export function eventClientPoint(e: unknown): { x: number; y: number } {
  const ev = e as {
    clientX?: number;
    clientY?: number;
    x?: number;
    y?: number;
    pageX?: number;
    pageY?: number;
    touches?: Array<{ clientX?: number; clientY?: number }>;
    changedTouches?: Array<{ clientX?: number; clientY?: number }>;
  };
  const t0 = ev.changedTouches?.[0] ?? ev.touches?.[0];
  return {
    x: ev.clientX ?? t0?.clientX ?? ev.pageX ?? ev.x ?? 0,
    y: ev.clientY ?? t0?.clientY ?? ev.pageY ?? ev.y ?? 0,
  };
}

/** pointerId / touch identifier，华为 touchend 只有 identifier */
export function eventPointerId(e: unknown): number | undefined {
  const ev = e as {
    pointerId?: number;
    identifier?: number;
    changedTouches?: Array<{ identifier?: number }>;
    touches?: Array<{ identifier?: number }>;
  };
  if (typeof ev.pointerId === 'number') return ev.pointerId;
  if (typeof ev.identifier === 'number') return ev.identifier;
  const t0 = ev.changedTouches?.[0] ?? ev.touches?.[0];
  if (typeof t0?.identifier === 'number') return t0.identifier;
  return undefined;
}

export interface CanvasPointerMoveOptions {
  onMove: (e: unknown) => void;
  onUp: (e?: unknown) => void;
  onCancel?: (e?: unknown) => void;
  onDown?: (e: unknown) => void;
}

export interface CanvasPointerMoveHandle {
  destroy(): void;
}

function minigamePointerEvents(): { down: string; move: string; up: string; cancel: string } {
  return Platform.isHuawei
    ? { down: 'touchstart', move: 'touchmove', up: 'touchend', cancel: 'touchcancel' }
    : { down: 'pointerdown', move: 'pointermove', up: 'pointerup', cancel: 'pointercancel' };
}

/** 当前接触点（华为 pinch 用 touches；单指 pointer 用 client） */
/** Pixi Federated 按下：华为 native 常是 TouchEvent（无顶层 clientX），须读 touches */
export function federatedHasBrowserClient(e: {
  nativeEvent?: unknown;
  clientX?: number;
}): boolean {
  const n = e.nativeEvent as {
    clientX?: number;
    touches?: ArrayLike<unknown>;
    changedTouches?: ArrayLike<unknown>;
  } | undefined;
  if (n) {
    if (typeof n.clientX === 'number') return true;
    if (n.touches && n.touches.length > 0) return true;
    if (n.changedTouches && n.changedTouches.length > 0) return true;
  }
  return typeof e.clientX === 'number';
}

/**
 * Pixi 按下 → 浏览器 client。
 * 华为上 `e.global` 已是 CSS 像素；微信/抖音 `e.global` 是 canvas 像素，不要当 client 用。
 */
export function federatedToClientPoint(e: {
  nativeEvent?: unknown;
  clientX?: number;
  clientY?: number;
  global?: { x: number; y: number };
}): { x: number; y: number } {
  if (federatedHasBrowserClient(e)) {
    return eventClientPoint(e.nativeEvent ?? e);
  }
  if (e.global && Platform.isHuawei) {
    return { x: e.global.x, y: e.global.y };
  }
  return { x: 0, y: 0 };
}

/** Pixi 按下 → 设计坐标（华为不走 globalToDesign / dpr，避免起点被压矮） */
export function federatedToDesignPoint(
  e: {
    nativeEvent?: unknown;
    clientX?: number;
    clientY?: number;
    global?: { x: number; y: number };
  },
  clientToDesign: (x: number, y: number) => { x: number; y: number },
  globalToDesign: (x: number, y: number) => { x: number; y: number },
): { x: number; y: number } {
  if (federatedHasBrowserClient(e) || Platform.isHuawei) {
    const p = federatedToClientPoint(e);
    return clientToDesign(p.x, p.y);
  }
  if (e.global) return globalToDesign(e.global.x, e.global.y);
  return { x: 0, y: 0 };
}

export function eventTouchPoints(e: unknown): Array<{ id: number; x: number; y: number }> {
  const ev = e as {
    touches?: ArrayLike<{ identifier?: number; clientX?: number; clientY?: number }>;
    pointerId?: number;
    clientX?: number;
    clientY?: number;
  };
  if (ev.touches && ev.touches.length) {
    return Array.from(ev.touches).map((t) => ({
      id: typeof t.identifier === 'number' ? t.identifier : 0,
      x: t.clientX ?? 0,
      y: t.clientY ?? 0,
    }));
  }
  if (typeof ev.clientX === 'number') {
    return [{ id: ev.pointerId ?? 0, x: ev.clientX, y: ev.clientY ?? 0 }];
  }
  return [];
}

export function attachCanvasMoveUp(
  canvas: TouchCanvasLike,
  opts: CanvasPointerMoveOptions,
): () => void {
  const onDown = opts.onDown
    ? (((e: Event) => opts.onDown!(e)) as EventListener)
    : null;
  const onMove = ((e: Event) => {
    (e as { preventDefault?: () => void }).preventDefault?.();
    opts.onMove(e);
  }) as EventListener;
  const onUp = ((e: Event) => opts.onUp(e)) as EventListener;
  const onCancel = ((e: Event) => (opts.onCancel || opts.onUp)(e)) as EventListener;
  const { down, move, up, cancel } = minigamePointerEvents();

  if (onDown) canvas.addEventListener(down, onDown);
  canvas.addEventListener(move, onMove);
  canvas.addEventListener(up, onUp);
  canvas.addEventListener(cancel, onCancel);
  return () => {
    if (onDown) canvas.removeEventListener(down, onDown);
    canvas.removeEventListener(move, onMove);
    canvas.removeEventListener(up, onUp);
    canvas.removeEventListener(cancel, onCancel);
  };
}

export function bindCanvasPointerMove(opts: CanvasPointerMoveOptions & { canvas: TouchCanvasLike }): CanvasPointerMoveHandle {
  const detach = attachCanvasMoveUp(opts.canvas, opts);
  return { destroy: detach };
}
