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

const BUBBLE_MAX_W = 520;
const BUBBLE_R = 20;
const AVATAR_SIZE = 90;
const AVATAR_PAD = 12;
const INNER_PAD = 18;
const BTN_W = 170;
const BTN_H = 44;
const BTN_R = 22;

export interface DialogBubbleOptions {
  title?: string;
  body: string;
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
   * 垂直位置：auto 按 spotlight 上下避让；bottom 固定靠近屏底，避免挡住中部商品/弹窗内容。
   */
  dialogVerticalMode?: 'auto' | 'bottom';
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
    const bubbleW = Math.min(BUBBLE_MAX_W, DESIGN_WIDTH - 36);
    const textW = bubbleW - INNER_PAD * 2;

    const titleText = opts.title
      ? new PIXI.Text(opts.title, {
          fontSize: 22,
          fill: 0x4a3728,
          fontFamily: FONT_FAMILY,
          fontWeight: 'bold',
          stroke: 0xfffcf8,
          strokeThickness: 2,
        })
      : null;

    const bodyText = new PIXI.Text(opts.body, {
      fontSize: 17,
      fill: 0x5c4a3d,
      fontFamily: FONT_FAMILY,
      wordWrap: true,
      wordWrapWidth: textW,
      lineHeight: 26,
    });

    let contentH = INNER_PAD;
    if (titleText) contentH += titleText.height + 8;
    contentH += bodyText.height + INNER_PAD;
    if (opts.buttonText) contentH += BTN_H + 12;

    const bubbleH = Math.max(80, contentH);

    // Bubble background
    const bg = new PIXI.Graphics();
    bg.beginFill(0xFFFBF0, 0.96);
    bg.drawRoundedRect(0, 0, bubbleW, bubbleH, BUBBLE_R);
    bg.endFill();
    bg.lineStyle(2.5, 0xFFD700, 0.5);
    bg.drawRoundedRect(0, 0, bubbleW, bubbleH, BUBBLE_R);

    const bubbleContainer = new PIXI.Container();
    bubbleContainer.addChild(bg);

    let textY = INNER_PAD;
    if (titleText) {
      titleText.anchor.set(0, 0);
      titleText.position.set(INNER_PAD, textY);
      bubbleContainer.addChild(titleText);
      textY += titleText.height + 8;
    }

    bodyText.anchor.set(0, 0);
    bodyText.position.set(INNER_PAD, textY);
    bubbleContainer.addChild(bodyText);
    textY += bodyText.height + 12;

    if (opts.buttonText && opts.onButton) {
      this._onButtonCallback = opts.onButton;
      const btnX = (bubbleW - BTN_W) / 2;
      const btnY = bubbleH - BTN_H - 12;

      const btn = new PIXI.Graphics();
      btn.beginFill(COLORS.BUTTON_PRIMARY);
      btn.drawRoundedRect(btnX, btnY, BTN_W, BTN_H, BTN_R);
      btn.endFill();
      bubbleContainer.addChild(btn);

      const btnLabel = new PIXI.Text(opts.buttonText, {
        fontSize: 17,
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

    // Avatar — 居中在气泡上方；气泡顶 = 人物底边（不压到框内）
    let bubbleTopAfterAvatar = 0;
    let totalH: number;

    if (showAvatar) {
      const avatarContainer = new PIXI.Container();
      const avatarTex = TextureCache.get('owner_chibi_default');
      /** 半身像 anchor 在方形容器中心，底边到容器顶的距离 */
      let avatarBottomY = AVATAR_SIZE;
      if (avatarTex) {
        const avatarSprite = new PIXI.Sprite(avatarTex);
        const scale = AVATAR_SIZE / Math.max(avatarTex.width, avatarTex.height);
        avatarSprite.scale.set(scale);
        avatarSprite.anchor.set(0.5, 0.5);
        avatarSprite.position.set(AVATAR_SIZE / 2, AVATAR_SIZE / 2);
        const dispH = avatarTex.height * scale;
        avatarBottomY = AVATAR_SIZE / 2 + dispH / 2;
        avatarContainer.addChild(avatarSprite);
      } else {
        const circle = new PIXI.Graphics();
        circle.beginFill(0xFFE0C0);
        circle.drawCircle(AVATAR_SIZE / 2, AVATAR_SIZE / 2, AVATAR_SIZE / 2);
        circle.endFill();
        avatarContainer.addChild(circle);

        const label = new PIXI.Text('', { fontSize: 40, fontFamily: FONT_FAMILY });
        label.anchor.set(0.5, 0.5);
        label.position.set(AVATAR_SIZE / 2, AVATAR_SIZE / 2);
        avatarContainer.addChild(label);
      }

      bubbleTopAfterAvatar = avatarBottomY;

      avatarContainer.position.set(
        (bubbleW - AVATAR_SIZE) / 2,
        0,
      );
      this.addChild(avatarContainer);

      bubbleContainer.position.set(0, bubbleTopAfterAvatar);
      totalH = bubbleTopAfterAvatar + bubbleH;
    } else {
      bubbleContainer.position.set(0, 0);
      totalH = bubbleH;
    }

    this.addChild(bubbleContainer);

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
