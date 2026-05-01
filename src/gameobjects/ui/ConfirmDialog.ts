/**
 * 确认弹窗 — 视觉对齐新手引导 `TutorialDialogBubble`（粉紫外框 + 奶油内底 + 蜜黄标题条 + 圆角按钮）
 */
import * as PIXI from 'pixi.js';
import { Game } from '@/core/Game';
import { DESIGN_WIDTH, COLORS, FONT_FAMILY } from '@/config/Constants';
import { TweenManager, Ease } from '@/core/TweenManager';

const BUBBLE_R = 26;
const INNER_PAD = 28;
const TITLE_H = 46;
const TITLE_PAD_X = 22;

export class ConfirmDialog extends PIXI.Container {
  private _resolve!: (value: boolean) => void;

  /** 显示确认弹窗，返回 Promise<boolean> */
  static show(
    title: string,
    message: string,
    confirmText = '确定',
    cancelText = '取消',
  ): Promise<boolean> {
    return new Promise((resolve) => {
      const dialog = new ConfirmDialog(title, message, confirmText, cancelText);
      dialog._resolve = resolve;
      dialog.zIndex = 30000;
      Game.stage.addChild(dialog);
      if (Game.stage.sortableChildren) Game.stage.sortChildren();
    });
  }

  private constructor(
    title: string,
    message: string,
    confirmText: string,
    cancelText: string,
  ) {
    super();
    const W = DESIGN_WIDTH;
    const H = Game.logicHeight;

    const overlay = new PIXI.Graphics();
    overlay.beginFill(0x000000, 0.5);
    overlay.drawRect(0, 0, W, H);
    overlay.endFill();
    overlay.eventMode = 'static';
    this.addChild(overlay);

    const panelW = Math.min(540, DESIGN_WIDTH - 44);

    const msgTxt = new PIXI.Text(message, {
      fontSize: 21,
      fill: 0x5c4a3d,
      fontFamily: FONT_FAMILY,
      wordWrap: true,
      wordWrapWidth: panelW - INNER_PAD * 2 - 8,
      lineHeight: 32,
      align: 'center',
    });
    msgTxt.anchor.set(0.5, 0);

    const BTN_W = 168;
    const BTN_H = 50;
    const BTN_R = 22;
    const BTN_GAP = 18;
    const titleBlockH = TITLE_H + 14;
    const panelH = Math.max(
      232,
      INNER_PAD + 8 + titleBlockH + msgTxt.height + 26 + BTN_H + INNER_PAD + 6,
    );

    const px = (W - panelW) / 2;
    const py = (H - panelH) / 2;

    const panelRoot = new PIXI.Container();
    panelRoot.position.set(px, py);
    panelRoot.eventMode = 'static';
    panelRoot.hitArea = new PIXI.Rectangle(0, 0, panelW, panelH);
    panelRoot.on('pointertap', (e: PIXI.FederatedPointerEvent) => e.stopPropagation());
    this.addChild(panelRoot);

    const shadow = new PIXI.Graphics();
    shadow.beginFill(0x4c2f4f, 0.15);
    shadow.drawRoundedRect(8, 14, panelW, panelH, BUBBLE_R);
    shadow.endFill();

    const outer = new PIXI.Graphics();
    outer.beginFill(0xd8c4ff, 0.98);
    outer.drawRoundedRect(0, 0, panelW, panelH, BUBBLE_R);
    outer.endFill();
    outer.lineStyle(3, 0xffffff, 0.55);
    outer.drawRoundedRect(2, 2, panelW - 4, panelH - 4, BUBBLE_R - 2);

    const inner = new PIXI.Graphics();
    inner.beginFill(0xfff7ea, 0.98);
    inner.drawRoundedRect(9, 9, panelW - 18, panelH - 18, BUBBLE_R - 9);
    inner.endFill();
    inner.lineStyle(3, 0xffc9dc, 0.78);
    inner.drawRoundedRect(10.5, 10.5, panelW - 21, panelH - 21, BUBBLE_R - 10);

    panelRoot.addChild(shadow, outer, inner);

    const titleText = new PIXI.Text(title, {
      fontSize: 26,
      fill: 0x4a3728,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: 0xfffcf5,
      strokeThickness: 2,
    });
    const titleW = Math.max(220, titleText.width + TITLE_PAD_X * 2);
    const titleX = (panelW - titleW) / 2;
    let contentY = INNER_PAD + 6;

    const titleBg = new PIXI.Graphics();
    titleBg.beginFill(0xffd76e, 1);
    titleBg.drawRoundedRect(titleX, contentY, titleW, TITLE_H, 22);
    titleBg.endFill();
    titleBg.lineStyle(2, 0xfff5bf, 0.95);
    titleBg.drawRoundedRect(titleX + 3, contentY + 3, titleW - 6, TITLE_H - 6, 18);
    panelRoot.addChild(titleBg);

    titleText.anchor.set(0.5, 0.5);
    titleText.position.set(panelW / 2, contentY + TITLE_H / 2 - 1);
    panelRoot.addChild(titleText);
    contentY += titleBlockH;

    msgTxt.position.set(panelW / 2, contentY);
    panelRoot.addChild(msgTxt);
    contentY += msgTxt.height + 22;

    const btnRowW = BTN_W * 2 + BTN_GAP;
    const btnStartX = (panelW - btnRowW) / 2;

    const cancelBtn = this._makePastelBtn(cancelText, btnStartX, contentY, BTN_W, BTN_H, BTN_R);
    cancelBtn.on('pointertap', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      this._close(false);
    });
    panelRoot.addChild(cancelBtn);

    const confirmBtn = this._makePrimaryBtn(confirmText, btnStartX + BTN_W + BTN_GAP, contentY, BTN_W, BTN_H, BTN_R);
    confirmBtn.on('pointertap', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      this._close(true);
    });
    panelRoot.addChild(confirmBtn);

    this.alpha = 0;
    panelRoot.scale.set(0.94, 0.94);
    panelRoot.pivot.set(panelW / 2, panelH / 2);
    panelRoot.position.set(px + panelW / 2, py + panelH / 2);
    TweenManager.to({
      target: this,
      props: { alpha: 1 },
      duration: 0.2,
      ease: Ease.easeOutQuad,
    });
    TweenManager.to({
      target: panelRoot.scale,
      props: { x: 1, y: 1 },
      duration: 0.28,
      ease: Ease.easeOutBack,
    });
  }

  private _makePrimaryBtn(
    label: string,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
  ): PIXI.Container {
    const c = new PIXI.Container();
    c.position.set(x, y);
    c.eventMode = 'static';
    c.cursor = 'pointer';

    const bg = new PIXI.Graphics();
    bg.beginFill(COLORS.BUTTON_PRIMARY);
    bg.drawRoundedRect(0, 0, w, h, r);
    bg.endFill();
    bg.lineStyle(2, 0xffffff, 0.55);
    bg.drawRoundedRect(3, 3, w - 6, h - 6, r - 3);
    c.addChild(bg);

    const txt = new PIXI.Text(label, {
      fontSize: 19,
      fill: 0xffffff,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    txt.anchor.set(0.5, 0.5);
    txt.position.set(w / 2, h / 2);
    c.addChild(txt);
    return c;
  }

  private _makePastelBtn(
    label: string,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
  ): PIXI.Container {
    const c = new PIXI.Container();
    c.position.set(x, y);
    c.eventMode = 'static';
    c.cursor = 'pointer';

    const bg = new PIXI.Graphics();
    bg.beginFill(0xe8dff7);
    bg.drawRoundedRect(0, 0, w, h, r);
    bg.endFill();
    bg.lineStyle(2.5, 0xffffff, 0.85);
    bg.drawRoundedRect(2.5, 2.5, w - 5, h - 5, Math.max(8, r - 4));
    c.addChild(bg);

    const txt = new PIXI.Text(label, {
      fontSize: 19,
      fill: 0x5c4a3d,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    txt.anchor.set(0.5, 0.5);
    txt.position.set(w / 2, h / 2);
    c.addChild(txt);
    return c;
  }

  private _close(result: boolean): void {
    TweenManager.to({
      target: this,
      props: { alpha: 0 },
      duration: 0.14,
      ease: Ease.easeInQuad,
      onComplete: () => {
        this.parent?.removeChild(this);
        this.destroy({ children: true });
        this._resolve(result);
      },
    });
  }
}
