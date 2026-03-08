/**
 * 确认弹窗 - 用于钥匙格解锁等需要确认的操作
 */
import * as PIXI from 'pixi.js';
import { Game } from '@/core/Game';
import { DESIGN_WIDTH, COLORS, FONT_FAMILY } from '@/config/Constants';
import { TweenManager, Ease } from '@/core/TweenManager';

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
      Game.stage.addChild(dialog);
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

    // 全屏遮罩
    const overlay = new PIXI.Graphics();
    overlay.beginFill(0x000000, 0.45);
    overlay.drawRect(0, 0, W, H);
    overlay.endFill();
    overlay.eventMode = 'static';
    this.addChild(overlay);

    // 面板
    const panelW = 480;
    const panelH = 260;
    const px = (W - panelW) / 2;
    const py = (H - panelH) / 2;

    const panel = new PIXI.Graphics();
    panel.beginFill(0xFFFDF8, 0.97);
    panel.drawRoundedRect(px, py, panelW, panelH, 20);
    panel.endFill();
    panel.lineStyle(2, COLORS.CELL_BORDER, 0.4);
    panel.drawRoundedRect(px, py, panelW, panelH, 20);
    this.addChild(panel);

    // 标题
    const titleTxt = new PIXI.Text(title, {
      fontSize: 22,
      fill: COLORS.TEXT_DARK,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    titleTxt.anchor.set(0.5, 0);
    titleTxt.position.set(W / 2, py + 24);
    this.addChild(titleTxt);

    // 正文
    const msgTxt = new PIXI.Text(message, {
      fontSize: 17,
      fill: COLORS.TEXT_LIGHT,
      fontFamily: FONT_FAMILY,
      wordWrap: true,
      wordWrapWidth: panelW - 60,
      align: 'center',
      lineHeight: 26,
    });
    msgTxt.anchor.set(0.5, 0);
    msgTxt.position.set(W / 2, py + 65);
    this.addChild(msgTxt);

    // 按钮
    const btnW = 150;
    const btnH = 46;
    const btnY = py + panelH - 72;
    const gap = 24;

    const cancelBtn = this._makeBtn(cancelText, COLORS.BUTTON_SECONDARY, btnW, btnH);
    cancelBtn.position.set(W / 2 - btnW - gap / 2, btnY);
    cancelBtn.on('pointertap', () => this._close(false));
    this.addChild(cancelBtn);

    const confirmBtn = this._makeBtn(confirmText, COLORS.BUTTON_PRIMARY, btnW, btnH);
    confirmBtn.position.set(W / 2 + gap / 2, btnY);
    confirmBtn.on('pointertap', () => this._close(true));
    this.addChild(confirmBtn);

    // 入场动画
    this.alpha = 0;
    TweenManager.to({
      target: this,
      props: { alpha: 1 },
      duration: 0.18,
      ease: Ease.easeOutQuad,
    });
  }

  private _makeBtn(label: string, color: number, w: number, h: number): PIXI.Container {
    const c = new PIXI.Container();
    c.eventMode = 'static';
    c.cursor = 'pointer';

    const bg = new PIXI.Graphics();
    bg.beginFill(color);
    bg.drawRoundedRect(0, 0, w, h, 12);
    bg.endFill();
    c.addChild(bg);

    const txt = new PIXI.Text(label, {
      fontSize: 17,
      fill: 0xFFFFFF,
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
      duration: 0.12,
      ease: Ease.easeInQuad,
      onComplete: () => {
        this.parent?.removeChild(this);
        this.destroy({ children: true });
        this._resolve(result);
      },
    });
  }
}
