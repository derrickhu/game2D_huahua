/**
 * 合成页软提醒：样式对齐教程对话气泡，不拦截棋盘操作。
 */
import * as PIXI from 'pixi.js';
import { Game } from '@/core/Game';
import { TweenManager, Ease } from '@/core/TweenManager';
import { DESIGN_WIDTH, BoardMetrics } from '@/config/Constants';
import { TutorialDialogBubble } from '@/gameobjects/ui/TutorialDialogBubble';
import type { ItemInfoBar } from '@/gameobjects/ui/ItemInfoBar';

interface SpotlightRect {
  x: number;
  y: number;
  w: number;
  h: number;
  r?: number;
}

export class BuyFurnitureHintOverlay {
  private _root: PIXI.Container;
  private _layer: PIXI.Container;
  private _bubble: TutorialDialogBubble | null = null;
  private _showing = false;

  constructor(parent: PIXI.Container) {
    this._root = new PIXI.Container();
    this._root.visible = false;
    this._root.zIndex = 7600;
    this._root.eventMode = 'passive';
    parent.addChild(this._root);
    if (!parent.sortableChildren) parent.sortableChildren = true;

    this._layer = new PIXI.Container();
    this._root.addChild(this._layer);
  }

  get isShowing(): boolean {
    return this._showing;
  }

  show(options: { itemInfoBar?: ItemInfoBar | null; onDismiss: () => void }): void {
    if (this._showing) return;
    this._showing = true;
    this._layer.removeChildren();
    this._root.visible = true;
    this._root.alpha = 0;

    this._drawNonBlockingDim(0.38);

    const huayuanRect = this._getHuayuanSpotlight();
    this._drawGlowBorder(huayuanRect);

    if (options.itemInfoBar) {
      const local = options.itemInfoBar.getHouseButtonSpotlightRectLocal();
      const shopRect: SpotlightRect = {
        x: options.itemInfoBar.x + local.x,
        y: options.itemInfoBar.y + local.y,
        w: local.w,
        h: local.h,
        r: 16,
      };
      this._drawGlowBorder(shopRect);
    }

    this._bubble = new TutorialDialogBubble({
      title: '可以买家具啦',
      body: '你已经攒了不少花愿~\n左下角进入花店，点「家具」就能添置新家具哦！',
      buttonText: '知道了',
      variant: 'dialog',
      dialogAnchorY: BoardMetrics.topY + BoardMetrics.areaHeight * 0.5,
      onButton: () => this.hide(options.onDismiss),
    });
    this._layer.addChild(this._bubble);

    TweenManager.to({
      target: this._root,
      props: { alpha: 1 },
      duration: 0.28,
      ease: Ease.easeOutQuad,
    });
  }

  hide(onDone?: () => void): void {
    if (!this._showing) return;
    TweenManager.to({
      target: this._root,
      props: { alpha: 0 },
      duration: 0.2,
      ease: Ease.easeInQuad,
      onComplete: () => {
        this._layer.removeChildren();
        this._bubble = null;
        this._root.visible = false;
        this._showing = false;
        onDone?.();
      },
    });
  }

  private _getHuayuanSpotlight(): SpotlightRect {
    const cx = 51;
    const iconR = 23;
    return {
      x: cx - iconR - 6,
      y: Game.safeTop + 6,
      w: (iconR + 6) * 2,
      h: 64,
      r: 12,
    };
  }

  private _drawNonBlockingDim(alpha: number): void {
    const g = new PIXI.Graphics();
    g.beginFill(0x000000, alpha);
    g.drawRect(0, 0, DESIGN_WIDTH, Game.logicHeight);
    g.endFill();
    g.eventMode = 'none';
    this._layer.addChild(g);
  }

  private _drawGlowBorder(rect: SpotlightRect): void {
    const r = rect.r ?? 0;
    const glow = new PIXI.Graphics();
    glow.lineStyle(4, 0xffd700, 0.5);
    glow.drawRoundedRect(rect.x - 2, rect.y - 2, rect.w + 4, rect.h + 4, r + 2);
    glow.lineStyle(2, 0xffd700, 0.9);
    glow.drawRoundedRect(rect.x, rect.y, rect.w, rect.h, r);
    glow.eventMode = 'none';
    this._layer.addChild(glow);
    this._breatheAnim(glow);
  }

  private _breatheAnim(target: PIXI.DisplayObject): void {
    const breathe = (): void => {
      TweenManager.to({
        target,
        props: { alpha: 0.4 },
        duration: 0.7,
        ease: Ease.easeInOutQuad,
        onComplete: () => {
          TweenManager.to({
            target,
            props: { alpha: 1 },
            duration: 0.7,
            ease: Ease.easeInOutQuad,
            onComplete: breathe,
          });
        },
      });
    };
    breathe();
  }
}
