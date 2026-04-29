/**
 * TutorialDialogBubble — 教程角色对话气泡
 *
 * 店主半身像居中在气泡框上方（脚底/底边与气泡顶相接）+ 圆角气泡框 + 标题 + 正文 + 可选按钮。
 * 弹性入场动画，自动智能避让高亮区域。
 */
import * as PIXI from 'pixi.js';
import { TweenManager, Ease } from '@/core/TweenManager';
import { Game } from '@/core/Game';
import { DESIGN_WIDTH, FONT_FAMILY, COLORS } from '@/config/Constants';
import { TextureCache } from '@/utils/TextureCache';

const BUBBLE_MAX_W = 610;
const BUBBLE_R = 30;
const AVATAR_SIZE = 116;
const INNER_PAD_X = 26;
const INNER_PAD_Y = 24;
const TITLE_H = 46;
const BTN_W = 210;
const BTN_H = 54;
const BTN_R = 27;

export interface DialogBubbleOptions {
  title?: string;
  body: string;
  /** 底部操作短句，强调当前要做的动作 */
  actionText?: string;
  buttonText?: string;
  onButton?: () => void;
  /** 高亮区域顶部 Y（用于智能避让） */
  spotlightTop?: number;
  /** 高亮区域底部 Y */
  spotlightBottom?: number;
  /**
   * 高亮目标水平中心 X（与 spotlightTop/Bottom 同一坐标系，通常为场景根容器局部坐标）。
   * 提供时气泡在该点水平居中并 clamp 到屏内，避免目标在左下角时仍整屏水平居中。
   */
  spotlightCenterX?: number;
  /** 是否显示店主头像，默认 true */
  showAvatar?: boolean;
  /**
   * 垂直位置：auto 按 spotlight 上下避让；bottom 固定靠近屏底；below 强制放在目标下方。
   */
  dialogVerticalMode?: 'auto' | 'bottom' | 'below';
  /** dialog 用于说明，action 用于强操作提示，影响卡片尺寸与强调层级 */
  variant?: 'dialog' | 'action';
}

export class TutorialDialogBubble extends PIXI.Container {
  private _onButtonCallback?: () => void;

  constructor(options: DialogBubbleOptions) {
    super();
    this.eventMode = 'passive';
    this._build(options);
    this._playEntrance();
  }

  private _build(opts: DialogBubbleOptions): void {
    const showAvatar = opts.showAvatar !== false;
    const variant = opts.variant ?? 'action';
    const bubbleW = Math.min(BUBBLE_MAX_W, DESIGN_WIDTH - 40);
    const avatarColumnW = showAvatar ? AVATAR_SIZE + 18 : 0;
    const textW = bubbleW - INNER_PAD_X * 2 - avatarColumnW;

    const titleText = opts.title
      ? new PIXI.Text(opts.title, {
          fontSize: 27,
          fill: 0x4a3728,
          fontFamily: FONT_FAMILY,
          fontWeight: 'bold',
          stroke: 0xfffcf5,
          strokeThickness: 2,
        })
      : null;

    const bodyText = new PIXI.Text(opts.body, {
      fontSize: variant === 'dialog' ? 22 : 23,
      fill: 0x5c4a3d,
      fontFamily: FONT_FAMILY,
      wordWrap: true,
      wordWrapWidth: textW,
      lineHeight: variant === 'dialog' ? 33 : 35,
    });

    const actionText = opts.actionText
      ? new PIXI.Text(opts.actionText, {
          fontSize: 20,
          fill: 0x6a4a2f,
          fontFamily: FONT_FAMILY,
          fontWeight: 'bold',
          wordWrap: true,
          wordWrapWidth: textW - 28,
          lineHeight: 28,
        })
      : null;

    let contentH = INNER_PAD_Y;
    if (titleText) contentH += TITLE_H + 12;
    contentH += bodyText.height + 12;
    if (actionText) contentH += Math.max(40, actionText.height + 16) + 12;
    if (opts.buttonText) contentH += BTN_H + 14;
    contentH += INNER_PAD_Y;

    const bubbleH = Math.max(showAvatar ? 150 : 110, contentH);

    // Bubble background: soft pastel panel matching in-game UI style.
    const shadow = new PIXI.Graphics();
    shadow.beginFill(0x4c2f4f, 0.16);
    shadow.drawRoundedRect(8, 12, bubbleW, bubbleH, BUBBLE_R);
    shadow.endFill();

    const outer = new PIXI.Graphics();
    outer.beginFill(0xd8c4ff, 0.98);
    outer.drawRoundedRect(0, 0, bubbleW, bubbleH, BUBBLE_R);
    outer.endFill();
    outer.lineStyle(3, 0xffffff, 0.55);
    outer.drawRoundedRect(2, 2, bubbleW - 4, bubbleH - 4, BUBBLE_R - 2);

    const inner = new PIXI.Graphics();
    inner.beginFill(0xfff7ea, 0.98);
    inner.drawRoundedRect(9, 9, bubbleW - 18, bubbleH - 18, BUBBLE_R - 9);
    inner.endFill();
    inner.lineStyle(3, 0xffc9dc, 0.75);
    inner.drawRoundedRect(10.5, 10.5, bubbleW - 21, bubbleH - 21, BUBBLE_R - 10);

    const bubbleContainer = new PIXI.Container();
    bubbleContainer.addChild(shadow, outer, inner);

    const textX = INNER_PAD_X + avatarColumnW;
    let textY = INNER_PAD_Y;
    if (titleText) {
      const titlePadX = 22;
      const titleW = Math.max(190, titleText.width + titlePadX * 2);
      const titleBg = new PIXI.Graphics();
      titleBg.beginFill(0xffd76e, 1);
      titleBg.drawRoundedRect(textX, textY, titleW, TITLE_H, 22);
      titleBg.endFill();
      titleBg.lineStyle(2, 0xfff5bf, 0.95);
      titleBg.drawRoundedRect(textX + 3, textY + 3, titleW - 6, TITLE_H - 6, 18);
      bubbleContainer.addChild(titleBg);

      titleText.anchor.set(0, 0);
      titleText.position.set(textX + titlePadX, textY + (TITLE_H - titleText.height) / 2 - 1);
      bubbleContainer.addChild(titleText);
      textY += TITLE_H + 12;
    }

    bodyText.anchor.set(0, 0);
    bodyText.position.set(textX, textY);
    bubbleContainer.addChild(bodyText);
    textY += bodyText.height + 12;

    if (actionText) {
      const actionH = Math.max(40, actionText.height + 16);
      const actionBg = new PIXI.Graphics();
      actionBg.beginFill(0xffefd1, 0.95);
      actionBg.drawRoundedRect(textX, textY, textW, actionH, actionH / 2);
      actionBg.endFill();
      actionBg.lineStyle(2, 0xffc76c, 0.55);
      actionBg.drawRoundedRect(textX + 2, textY + 2, textW - 4, actionH - 4, Math.max(8, actionH / 2 - 2));
      bubbleContainer.addChild(actionBg);

      const dot = new PIXI.Graphics();
      dot.beginFill(0xff9a3c, 1);
      dot.drawCircle(textX + 20, textY + actionH / 2, 6);
      dot.endFill();
      bubbleContainer.addChild(dot);

      actionText.anchor.set(0, 0.5);
      actionText.position.set(textX + 36, textY + actionH / 2);
      bubbleContainer.addChild(actionText);
      textY += actionH + 12;
    }

    if (opts.buttonText && opts.onButton) {
      this._onButtonCallback = opts.onButton;
      const btnX = textX + (textW - BTN_W) / 2;
      const btnY = bubbleH - BTN_H - INNER_PAD_Y;

      const btn = new PIXI.Graphics();
      btn.beginFill(COLORS.BUTTON_PRIMARY);
      btn.drawRoundedRect(btnX, btnY, BTN_W, BTN_H, BTN_R);
      btn.endFill();
      btn.lineStyle(2, 0xffffff, 0.55);
      btn.drawRoundedRect(btnX + 3, btnY + 3, BTN_W - 6, BTN_H - 6, BTN_R - 3);
      bubbleContainer.addChild(btn);

      const btnLabel = new PIXI.Text(opts.buttonText, {
        fontSize: 21,
        fill: 0xFFFFFF,
        fontFamily: FONT_FAMILY,
        fontWeight: 'bold',
      });
      btnLabel.anchor.set(0.5, 0.5);
      btnLabel.position.set(btnX + BTN_W / 2, btnY + BTN_H / 2);
      bubbleContainer.addChild(btnLabel);

      const hitArea = new PIXI.Container();
      hitArea.hitArea = new PIXI.Rectangle(btnX, btnY, BTN_W, BTN_H);
      hitArea.eventMode = 'static';
      hitArea.cursor = 'pointer';
      hitArea.on('pointertap', () => {
        this._onButtonCallback?.();
      });
      bubbleContainer.addChild(hitArea);
    }

    if (showAvatar) {
      const avatarContainer = new PIXI.Container();
      const avatarTex = TextureCache.get('owner_chibi_default');

      const halo = new PIXI.Graphics();
      halo.beginFill(0xffe3ef, 0.95);
      halo.drawCircle(AVATAR_SIZE / 2, AVATAR_SIZE / 2, AVATAR_SIZE / 2);
      halo.endFill();
      halo.lineStyle(3, 0xffffff, 0.82);
      halo.drawCircle(AVATAR_SIZE / 2, AVATAR_SIZE / 2, AVATAR_SIZE / 2 - 3);
      avatarContainer.addChild(halo);

      if (avatarTex) {
        const avatarSprite = new PIXI.Sprite(avatarTex);
        const scale = AVATAR_SIZE / Math.max(avatarTex.width, avatarTex.height);
        avatarSprite.scale.set(scale);
        avatarSprite.anchor.set(0.5, 0.5);
        avatarSprite.position.set(AVATAR_SIZE / 2, AVATAR_SIZE / 2);
        avatarContainer.addChild(avatarSprite);
      } else {
        const label = new PIXI.Text('花', { fontSize: 44, fontFamily: FONT_FAMILY, fill: 0x8b5a3c });
        label.anchor.set(0.5, 0.5);
        label.position.set(AVATAR_SIZE / 2, AVATAR_SIZE / 2);
        avatarContainer.addChild(label);
      }

      avatarContainer.position.set(
        INNER_PAD_X,
        Math.max(18, (bubbleH - AVATAR_SIZE) / 2),
      );
      bubbleContainer.addChild(avatarContainer);
    }

    this.addChild(bubbleContainer);
    const totalH = bubbleH;

    // Position: 整屏默认水平居中；有 spotlightCenterX 且非「贴底」模式时对准高亮目标（如底栏左上进店钮）
    let dialogX: number;
    if (opts.dialogVerticalMode === 'bottom') {
      dialogX = (DESIGN_WIDTH - bubbleW) / 2;
      dialogX = Math.max(18, Math.min(dialogX, DESIGN_WIDTH - bubbleW - 18));
    } else if (opts.spotlightCenterX !== undefined) {
      dialogX = opts.spotlightCenterX - bubbleW / 2;
      dialogX = Math.max(18, Math.min(dialogX, DESIGN_WIDTH - bubbleW - 18));
    } else {
      dialogX = (DESIGN_WIDTH - bubbleW) / 2;
    }
    let dialogY: number;
    const margin = 20;

    if (opts.dialogVerticalMode === 'bottom') {
      const marginBottom = 14;
      dialogY = Game.logicHeight - totalH - marginBottom;
      dialogY = Math.max(
        Game.safeTop + 8,
        Math.min(dialogY, Game.logicHeight - totalH - 10),
      );
    } else if (opts.dialogVerticalMode === 'below' && opts.spotlightBottom !== undefined) {
      dialogY = opts.spotlightBottom + margin;
      dialogY = Math.max(30, Math.min(dialogY, Game.logicHeight - totalH - 30));
    } else if (opts.spotlightTop !== undefined && opts.spotlightBottom !== undefined) {
      const spaceAbove = opts.spotlightTop;
      const spaceBelow = Game.logicHeight - opts.spotlightBottom;
      if (spaceAbove >= totalH + margin + 40) {
        dialogY = opts.spotlightTop - totalH - margin;
      } else if (spaceBelow >= totalH + margin + 40) {
        dialogY = opts.spotlightBottom + margin;
      } else {
        dialogY = 40;
      }
      dialogY = Math.max(30, Math.min(dialogY, Game.logicHeight - totalH - 30));
    } else {
      dialogY = Game.logicHeight * 0.3 - totalH / 2;
      dialogY = Math.max(30, Math.min(dialogY, Game.logicHeight - totalH - 30));
    }

    this.position.set(dialogX, dialogY);
  }

  private _playEntrance(): void {
    this.alpha = 0;
    this.scale.set(0.88);
    const cx = this.width / 2;
    const cy = this.height / 2;
    this.pivot.set(cx, cy);
    this.x += cx;
    this.y += cy;

    TweenManager.to({
      target: this,
      props: { alpha: 1 },
      duration: 0.25,
      ease: Ease.easeOutQuad,
    });
    TweenManager.to({
      target: this.scale,
      props: { x: 1, y: 1 },
      duration: 0.35,
      ease: Ease.easeOutBack,
    });
  }

  dispose(): void {
    TweenManager.cancelTarget(this);
    TweenManager.cancelTarget(this.scale);
    if (this.parent) this.parent.removeChild(this);
    this.destroy({ children: true });
  }
}
