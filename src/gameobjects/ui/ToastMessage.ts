/**
 * 轻量浮动提示（体力不足、金币不足等）
 */
import * as PIXI from 'pixi.js';
import { Game } from '@/core/Game';
import { DESIGN_WIDTH, FONT_FAMILY } from '@/config/Constants';
import { TweenManager, Ease } from '@/core/TweenManager';

/** 高于 OverlayManager.container（10000），且低于 ConfirmDialog（30000）等系统模态 */
const TOAST_STAGE_Z_INDEX = 15000;

export class ToastMessage {
  /**
   * 显示一条浮动提示
   * @param message 提示文字
   * @param staySeconds 停留时长（秒）
   */
  static show(message: string, staySeconds = 1.2): void {
    const W = DESIGN_WIDTH;
    const H = Game.logicHeight;

    const container = new PIXI.Container();

    const txt = new PIXI.Text(message, {
      fontSize: 18,
      fill: 0xFFFFFF,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    txt.anchor.set(0.5, 0.5);

    const padX = 24;
    const padY = 14;
    const bgW = txt.width + padX * 2;
    const bgH = txt.height + padY * 2;

    const bg = new PIXI.Graphics();
    bg.beginFill(0x000000, 0.7);
    bg.drawRoundedRect(-bgW / 2, -bgH / 2, bgW, bgH, bgH / 2);
    bg.endFill();

    container.addChild(bg);
    container.addChild(txt);
    container.position.set(W / 2, H * 0.35);
    container.alpha = 0;
    container.zIndex = TOAST_STAGE_Z_INDEX;

    Game.stage.addChild(container);
    if (Game.stage.sortableChildren) Game.stage.sortChildren();

    // 淡入
    TweenManager.to({
      target: container,
      props: { alpha: 1 },
      duration: 0.15,
      ease: Ease.easeOutQuad,
      onComplete: () => {
        // 停留后淡出 + 上浮
        TweenManager.to({
          target: container,
          props: { alpha: 0 },
          duration: 0.35,
          delay: staySeconds,
          ease: Ease.easeInQuad,
        });
        TweenManager.to({
          target: container,
          props: { y: container.y - 40 },
          duration: 0.35,
          delay: staySeconds,
          ease: Ease.easeInQuad,
          onComplete: () => {
            container.parent?.removeChild(container);
            container.destroy({ children: true });
          },
        });
      },
    });
  }
}
