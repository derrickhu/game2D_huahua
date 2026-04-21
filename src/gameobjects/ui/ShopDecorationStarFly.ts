/**
 * 装修/形象购买后：星星飞入进度条左侧星标（与 ShopScene._playStarFlyFromGlobal 逻辑一致，供主场景复用）
 */
import * as PIXI from 'pixi.js';
import { Game } from '@/core/Game';
import { TweenManager, Ease } from '@/core/TweenManager';
import { TextureCache } from '@/utils/TextureCache';
import { DESIGN_WIDTH, FONT_FAMILY } from '@/config/Constants';
import { TOP_BAR_HEIGHT } from '@/gameobjects/ui/TopBar';

/** 与 ShopScene 内 `_buildProgressBar` 一致，用于主场景无进度条时对齐同一屏幕落点 */
const PROGRESS_BAR_W = 400;
const PROGRESS_BAR_H = 28;

/** 花店进度条左侧星标在场景根容器内的局部坐标（与 barContainer + starGroup 对齐） */
export function getShopProgressStarTargetLocalInSceneRoot(): { x: number; y: number } {
  const w = DESIGN_WIDTH;
  const cx = w / 2;
  const y = Game.safeTop + TOP_BAR_HEIGHT + 16;
  return {
    x: cx - PROGRESS_BAR_W / 2 - 22,
    y: y + PROGRESS_BAR_H / 2,
  };
}

/**
 * 从全局起点飞入 `targetLocal`（均为 `flyLayer.parent` 局部坐标系，与 ShopScene 原实现一致）。
 * `flyLayer` 须为 parent 的子节点且一般 position (0,0)（粒子坐标即 parent 内坐标）。
 */
export function playShopDecorationStarFly(params: {
  flyLayer: PIXI.Container;
  startGlobalX: number;
  startGlobalY: number;
  targetLocalX: number;
  targetLocalY: number;
  amount: number;
  onComplete: () => void;
}): void {
  const {
    flyLayer,
    startGlobalX,
    startGlobalY,
    targetLocalX,
    targetLocalY,
    amount,
    onComplete,
  } = params;

  const parent = flyLayer.parent;
  if (amount <= 0 || !parent) {
    onComplete();
    return;
  }

  const tex = TextureCache.get('icon_star');
  const targetLocal = new PIXI.Point(targetLocalX, targetLocalY);
  const startLocal = new PIXI.Point();
  parent.toLocal(new PIXI.Point(startGlobalX, startGlobalY), undefined, startLocal);

  const ICON_SIZE = 30;
  const COUNT = Math.min(Math.max(1, Math.ceil(amount / 2)), 10);
  const FLY_DURATION = 0.52;
  const STAGGER = 0.045;
  let arrived = 0;

  for (let i = 0; i < COUNT; i++) {
    const icon = tex
      ? new PIXI.Sprite(tex)
      : new PIXI.Text('★', { fontSize: 22, fontFamily: FONT_FAMILY });
    icon.anchor.set(0.5);
    icon.eventMode = 'none';
    let targetScale = 1;
    if (icon instanceof PIXI.Sprite && tex) {
      targetScale = ICON_SIZE / Math.max(tex.width, tex.height);
    }
    const randX = (Math.random() - 0.5) * 48;
    const randY = (Math.random() - 0.5) * 36;
    icon.position.set(startLocal.x + randX, startLocal.y + randY);
    icon.alpha = 0;
    icon.scale.set(targetScale * 0.35);
    flyLayer.addChild(icon);

    const delay = i * STAGGER;
    TweenManager.to({
      target: icon,
      props: { alpha: 1 },
      duration: 0.12,
      delay,
    });
    TweenManager.to({
      target: icon.scale,
      props: { x: targetScale, y: targetScale },
      duration: 0.2,
      delay,
      ease: Ease.easeOutBack,
      onComplete: () => {
        const cpx = (icon.x + targetLocal.x) / 2 + (Math.random() - 0.5) * 70;
        const cpy = Math.min(icon.y, targetLocal.y) - 28 - Math.random() * 36;
        const startX = icon.x;
        const startY = icon.y;
        const progress = { t: 0 };
        TweenManager.to({
          target: progress,
          props: { t: 1 },
          duration: FLY_DURATION,
          ease: Ease.easeInQuad,
          onUpdate: () => {
            const t = progress.t;
            const mt = 1 - t;
            icon.x = mt * mt * startX + 2 * mt * t * cpx + t * t * targetLocal.x;
            icon.y = mt * mt * startY + 2 * mt * t * cpy + t * t * targetLocal.y;
            icon.scale.set(targetScale * (1 - t * 0.45));
            icon.alpha = t < 0.82 ? 1 : 1 - (t - 0.82) / 0.18;
          },
          onComplete: () => {
            icon.destroy();
            arrived++;
            if (arrived >= COUNT) {
              onComplete();
            }
          },
        });
      },
    });
  }
}
