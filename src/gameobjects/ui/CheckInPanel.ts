/**
 * 签到面板 - 7日签到 UI
 */
import * as PIXI from 'pixi.js';
import { Game } from '@/core/Game';
import { TweenManager, Ease } from '@/core/TweenManager';
import { CheckInManager, CHECK_IN_REWARDS } from '@/managers/CheckInManager';
import { DESIGN_WIDTH, FONT_FAMILY, COLORS } from '@/config/Constants';

export class CheckInPanel extends PIXI.Container {
  private _bg!: PIXI.Graphics;
  private _content!: PIXI.Container;
  private _isOpen = false;

  constructor() {
    super();
    this.visible = false;
    this.zIndex = 5000;
    this._build();
  }

  open(): void {
    if (this._isOpen) return;
    this._isOpen = true;
    this.visible = true;
    this._refresh();

    // 弹出动画：遮罩淡入 + 面板从缩小弹出
    this._bg.alpha = 0;
    this._content.alpha = 0;
    this._content.scale.set(0.85);
    TweenManager.to({ target: this._bg, props: { alpha: 1 }, duration: 0.2, ease: Ease.easeOutQuad });
    TweenManager.to({ target: this._content, props: { alpha: 1 }, duration: 0.2, ease: Ease.easeOutQuad });
    TweenManager.to({ target: this._content.scale, props: { x: 1, y: 1 }, duration: 0.3, ease: Ease.easeOutBack });
  }

  close(): void {
    if (!this._isOpen) return;
    this._isOpen = false;
    TweenManager.to({
      target: this._bg, props: { alpha: 0 }, duration: 0.15, ease: Ease.easeInQuad,
    });
    TweenManager.to({
      target: this._content, props: { alpha: 0 }, duration: 0.15, ease: Ease.easeInQuad,
      onComplete: () => { this.visible = false; this.alpha = 1; },
    });
    TweenManager.to({
      target: this._content.scale, props: { x: 0.9, y: 0.9 }, duration: 0.15, ease: Ease.easeInQuad,
    });
  }

  private _build(): void {
    const w = DESIGN_WIDTH;
    const h = Game.logicHeight;

    // 半透明背景遮罩
    this._bg = new PIXI.Graphics();
    this._bg.beginFill(0x000000, 0.5);
    this._bg.drawRect(0, 0, w, h);
    this._bg.endFill();
    this._bg.eventMode = 'static';
    this._bg.on('pointerdown', () => this.close());
    this.addChild(this._bg);

    // 面板内容容器 — 用 position 居中，不使用 pivot
    this._content = new PIXI.Container();
    this.addChild(this._content);
  }

  private _refresh(): void {
    // 清除旧内容
    while (this._content.children.length > 0) {
      const child = this._content.children[0];
      this._content.removeChild(child);
      child.destroy({ children: true });
    }

    const panelW = Math.min(600, DESIGN_WIDTH - 40);
    const panelH = 480;
    const panelX = (DESIGN_WIDTH - panelW) / 2;
    const panelY = (Game.logicHeight - panelH) / 2;

    // 设置 _content 的 pivot 和 position 用于缩放动画居中
    this._content.pivot.set(DESIGN_WIDTH / 2, Game.logicHeight / 2);
    this._content.position.set(DESIGN_WIDTH / 2, Game.logicHeight / 2);

    const cx = DESIGN_WIDTH / 2;

    // 面板背景
    const bg = new PIXI.Graphics();
    bg.beginFill(0xFFFBF0);
    bg.drawRoundedRect(panelX, panelY, panelW, panelH, 20);
    bg.endFill();
    bg.lineStyle(2, 0xFFD700, 0.4);
    bg.drawRoundedRect(panelX, panelY, panelW, panelH, 20);
    bg.eventMode = 'static'; // 阻止点击穿透
    this._content.addChild(bg);

    // 标题
    const title = new PIXI.Text('📅 每日签到', {
      fontSize: 24, fill: COLORS.TEXT_DARK, fontFamily: FONT_FAMILY, fontWeight: 'bold',
    });
    title.anchor.set(0.5, 0);
    title.position.set(cx, panelY + 16);
    this._content.addChild(title);

    // 连续签到信息
    const streakText = new PIXI.Text(
      `连续签到 ${CheckInManager.consecutiveDays} 天  ${CheckInManager.state.signedToday ? '✅ 今日已签到' : '❗ 今日未签到'}`,
      { fontSize: 14, fill: COLORS.TEXT_LIGHT, fontFamily: FONT_FAMILY },
    );
    streakText.anchor.set(0.5, 0);
    streakText.position.set(cx, panelY + 48);
    this._content.addChild(streakText);

    // 连续签到加成
    const bonusDesc = CheckInManager.streakBonusDesc;
    if (bonusDesc) {
      const bonusText = new PIXI.Text(`🎉 连续签到加成：${bonusDesc}`, {
        fontSize: 13, fill: 0xFF8C69, fontFamily: FONT_FAMILY,
      });
      bonusText.anchor.set(0.5, 0);
      bonusText.position.set(cx, panelY + 68);
      this._content.addChild(bonusText);
    }

    // 7天签到格子
    const startY = panelY + 96;
    const cardW = 72;
    const cardH = 100;
    const gap = 8;
    const totalW = 7 * cardW + 6 * gap;
    let startX = cx - totalW / 2;

    const signedDays = CheckInManager.state.signedDays;
    const signedToday = CheckInManager.state.signedToday;

    for (let i = 0; i < 7; i++) {
      const reward = CHECK_IN_REWARDS[i];
      const dayX = startX + i * (cardW + gap);
      const isSigned = i < signedDays || (i === signedDays && signedToday);
      const isToday = i === signedDays && !signedToday;

      // 卡片背景
      const card = new PIXI.Graphics();
      if (isSigned) {
        card.beginFill(0xE8F5E8);
      } else if (isToday) {
        card.beginFill(0xFFF3E0);
        card.lineStyle(2, 0xFFD700);
      } else {
        card.beginFill(0xF5F5F5);
      }
      card.drawRoundedRect(dayX, startY, cardW, cardH, 10);
      card.endFill();
      this._content.addChild(card);

      // Day 标签
      const dayLabel = new PIXI.Text(`Day ${reward.day}`, {
        fontSize: 11, fill: isToday ? 0xFF8C69 : COLORS.TEXT_LIGHT, fontFamily: FONT_FAMILY,
        fontWeight: isToday ? 'bold' : 'normal',
      });
      dayLabel.anchor.set(0.5, 0);
      dayLabel.position.set(dayX + cardW / 2, startY + 6);
      this._content.addChild(dayLabel);

      // 图标
      const icon = new PIXI.Text(isSigned ? '✅' : reward.icon, {
        fontSize: 24, fill: 0x000000, fontFamily: FONT_FAMILY,
      });
      icon.anchor.set(0.5, 0.5);
      icon.position.set(dayX + cardW / 2, startY + 42);
      this._content.addChild(icon);

      // 奖励描述
      const desc = new PIXI.Text(this._shortRewardDesc(reward), {
        fontSize: 10, fill: COLORS.TEXT_LIGHT, fontFamily: FONT_FAMILY,
        wordWrap: true, wordWrapWidth: cardW - 8,
        align: 'center',
      });
      desc.anchor.set(0.5, 0);
      desc.position.set(dayX + cardW / 2, startY + 64);
      this._content.addChild(desc);
    }

    // 签到按钮
    if (CheckInManager.canCheckIn) {
      const btnW = 200;
      const btnH = 50;
      const btnY = startY + cardH + 30;

      const btn = new PIXI.Graphics();
      btn.beginFill(COLORS.BUTTON_PRIMARY);
      btn.drawRoundedRect(cx - btnW / 2, btnY, btnW, btnH, 25);
      btn.endFill();
      this._content.addChild(btn);

      const btnText = new PIXI.Text('🎁 立即签到', {
        fontSize: 20, fill: 0xFFFFFF, fontFamily: FONT_FAMILY, fontWeight: 'bold',
      });
      btnText.anchor.set(0.5, 0.5);
      btnText.position.set(cx, btnY + btnH / 2);
      this._content.addChild(btnText);

      const hitArea = new PIXI.Container();
      hitArea.hitArea = new PIXI.Rectangle(cx - btnW / 2, btnY, btnW, btnH);
      hitArea.eventMode = 'static';
      hitArea.cursor = 'pointer';
      hitArea.on('pointerdown', () => {
        const reward = CheckInManager.checkIn();
        if (reward) {
          this._refresh();
        }
      });
      this._content.addChild(hitArea);
    }

    // 关闭按钮
    const closeBtn = new PIXI.Text('✕', {
      fontSize: 22, fill: COLORS.TEXT_LIGHT, fontFamily: FONT_FAMILY,
    });
    closeBtn.anchor.set(0.5, 0.5);
    closeBtn.position.set(panelX + panelW - 24, panelY + 24);
    closeBtn.eventMode = 'static';
    closeBtn.cursor = 'pointer';
    closeBtn.on('pointerdown', () => this.close());
    this._content.addChild(closeBtn);
  }

  private _shortRewardDesc(reward: typeof CHECK_IN_REWARDS[0]): string {
    const parts: string[] = [];
    if (reward.gold) parts.push(`💰${reward.gold}`);
    if (reward.stamina) parts.push(`💖${reward.stamina}`);
    if (reward.diamond) parts.push(`💎${reward.diamond}`);
    if (reward.huayuan) parts.push(`🌸${reward.huayuan}`);
    return parts.join('\n');
  }
}
