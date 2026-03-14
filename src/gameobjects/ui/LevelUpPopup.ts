/**
 * 升级弹窗 - 显示升级动画和奖励
 */
import * as PIXI from 'pixi.js';
import { Game } from '@/core/Game';
import { TweenManager, Ease } from '@/core/TweenManager';
import { DESIGN_WIDTH, FONT_FAMILY, COLORS } from '@/config/Constants';

export class LevelUpPopup extends PIXI.Container {
  constructor() {
    super();
    this.zIndex = 8000;
    this.visible = false;
  }

  show(level: number, reward: { gold: number; stamina: number; diamond: number }): void {
    this.visible = true;
    this.removeChildren();

    const cx = DESIGN_WIDTH / 2;
    const cy = Game.logicHeight / 2 - 60;

    // 背景遮罩
    const mask = new PIXI.Graphics();
    mask.beginFill(0x000000, 0.4);
    mask.drawRect(0, 0, DESIGN_WIDTH, Game.logicHeight);
    mask.endFill();
    mask.eventMode = 'static';
    this.addChild(mask);

    // 主卡片
    const cardW = 360;
    const cardH = 240;
    const card = new PIXI.Graphics();
    card.beginFill(0xFFFBF0);
    card.drawRoundedRect(cx - cardW / 2, cy - cardH / 2, cardW, cardH, 24);
    card.endFill();
    card.lineStyle(3, 0xFFD700);
    card.drawRoundedRect(cx - cardW / 2, cy - cardH / 2, cardW, cardH, 24);
    this.addChild(card);

    // 星星装饰
    const stars = new PIXI.Text('⭐', { fontSize: 40, fontFamily: FONT_FAMILY });
    stars.anchor.set(0.5, 0.5);
    stars.position.set(cx, cy - cardH / 2 - 10);
    this.addChild(stars);

    // "升级！"
    const titleText = new PIXI.Text('🎉 升级！', {
      fontSize: 28, fill: 0xFFD700, fontFamily: FONT_FAMILY, fontWeight: 'bold',
      stroke: 0x000000, strokeThickness: 2,
    });
    titleText.anchor.set(0.5, 0.5);
    titleText.position.set(cx, cy - 60);
    this.addChild(titleText);

    // 等级数字
    const levelText = new PIXI.Text(`Lv.${level}`, {
      fontSize: 48, fill: COLORS.BUTTON_PRIMARY, fontFamily: FONT_FAMILY, fontWeight: 'bold',
      stroke: 0xFFFFFF, strokeThickness: 3,
    });
    levelText.anchor.set(0.5, 0.5);
    levelText.position.set(cx, cy - 15);
    this.addChild(levelText);

    // 奖励
    const rewards: string[] = [];
    if (reward.gold > 0) rewards.push(`💰 金币 +${reward.gold}`);
    if (reward.stamina > 0) rewards.push(`💖 体力 +${reward.stamina}`);
    if (reward.diamond > 0) rewards.push(`💎 钻石 +${reward.diamond}`);

    const rewardStr = rewards.join('  ');
    const rewardText = new PIXI.Text(rewardStr, {
      fontSize: 15, fill: COLORS.TEXT_DARK, fontFamily: FONT_FAMILY,
    });
    rewardText.anchor.set(0.5, 0.5);
    rewardText.position.set(cx, cy + 30);
    this.addChild(rewardText);

    // 确定按钮
    const btnW = 140;
    const btnH = 42;
    const btnY = cy + 65;
    const btn = new PIXI.Graphics();
    btn.beginFill(COLORS.BUTTON_PRIMARY);
    btn.drawRoundedRect(cx - btnW / 2, btnY, btnW, btnH, 21);
    btn.endFill();
    this.addChild(btn);

    const btnText = new PIXI.Text('太棒了！', {
      fontSize: 18, fill: 0xFFFFFF, fontFamily: FONT_FAMILY, fontWeight: 'bold',
    });
    btnText.anchor.set(0.5, 0.5);
    btnText.position.set(cx, btnY + btnH / 2);
    this.addChild(btnText);

    const hit = new PIXI.Container();
    hit.hitArea = new PIXI.Rectangle(cx - btnW / 2, btnY, btnW, btnH);
    hit.eventMode = 'static';
    hit.cursor = 'pointer';
    hit.on('pointerdown', () => this._dismiss());
    this.addChild(hit);

    // 入场动画
    this.alpha = 0;
    this.scale.set(0.5);
    this.pivot.set(cx, cy);
    this.position.set(cx, cy);

    TweenManager.to({ target: this, props: { alpha: 1 }, duration: 0.3, ease: Ease.easeOutQuad });
    TweenManager.to({ target: this.scale, props: { x: 1, y: 1 }, duration: 0.4, ease: Ease.easeOutBack });
  }

  private _dismiss(): void {
    TweenManager.to({
      target: this,
      props: { alpha: 0 },
      duration: 0.3,
      ease: Ease.easeInQuad,
      onComplete: () => {
        this.visible = false;
        this.removeChildren();
        // 重置 transform
        this.scale.set(1);
        this.pivot.set(0, 0);
        this.position.set(0, 0);
      },
    });
  }
}
