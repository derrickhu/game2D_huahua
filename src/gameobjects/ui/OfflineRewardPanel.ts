/**
 * 离线收益面板 - 展示离线期间的收益报告
 *
 * 启动是否弹出由 `Constants.OFFLINE_REWARD_UI_ENABLED` 控制；类保留供日后复用。
 */
import * as PIXI from 'pixi.js';
import { Game } from '@/core/Game';
import { TweenManager, Ease } from '@/core/TweenManager';
import { EventBus } from '@/core/EventBus';
import { IdleManager, OfflineReward } from '@/managers/IdleManager';
import { DESIGN_WIDTH, FONT_FAMILY, COLORS } from '@/config/Constants';

export class OfflineRewardPanel extends PIXI.Container {
  private _bg!: PIXI.Graphics;
  private _content!: PIXI.Container;
  private _isOpen = false;
  private _reward: OfflineReward | null = null;

  constructor() {
    super();
    this.visible = false;
    this.zIndex = 6000;
    this._build();
  }

  /** 展示离线收益 */
  show(reward: OfflineReward): void {
    if (this._isOpen) return;
    this._reward = reward;
    this._isOpen = true;
    this.visible = true;
    this._refresh();

    this.alpha = 0;
    this._content.scale.set(0.8);
    TweenManager.to({ target: this, props: { alpha: 1 }, duration: 0.3, ease: Ease.easeOutQuad });
    TweenManager.to({ target: this._content.scale, props: { x: 1, y: 1 }, duration: 0.3, ease: Ease.easeOutBack });
  }

  close(): void {
    if (!this._isOpen) return;
    this._isOpen = false;
    TweenManager.to({
      target: this, props: { alpha: 0 }, duration: 0.2,
      onComplete: () => {
        this.visible = false;
        this._reward = null;
      },
    });
  }

  private _build(): void {
    const w = DESIGN_WIDTH;
    const h = Game.logicHeight;

    this._bg = new PIXI.Graphics();
    this._bg.beginFill(0x000000, 0.6);
    this._bg.drawRect(0, 0, w, h);
    this._bg.endFill();
    this._bg.eventMode = 'static';
    this.addChild(this._bg);

    this._content = new PIXI.Container();
    this._content.pivot.set(w / 2, h / 2);
    this._content.position.set(w / 2, h / 2);
    this.addChild(this._content);
  }

  private _refresh(): void {
    while (this._content.children.length > 0) {
      this._content.removeChild(this._content.children[0]);
    }

    if (!this._reward) return;

    const cx = DESIGN_WIDTH / 2;
    const panelW = 500;
    const panelH = 420;
    const panelX = cx - panelW / 2;
    const panelY = Game.logicHeight / 2 - panelH / 2;

    // 面板背景
    const bg = new PIXI.Graphics();
    bg.beginFill(0xFFFBF0);
    bg.drawRoundedRect(panelX, panelY, panelW, panelH, 20);
    bg.endFill();
    bg.lineStyle(2, 0xFFD700, 0.5);
    bg.drawRoundedRect(panelX, panelY, panelW, panelH, 20);
    bg.eventMode = 'static';
    this._content.addChild(bg);

    // 标题
    const title = new PIXI.Text(' 离线收益报告', {
      fontSize: 24, fill: COLORS.TEXT_DARK, fontFamily: FONT_FAMILY, fontWeight: 'bold',
    });
    title.anchor.set(0.5, 0);
    title.position.set(cx, panelY + 20);
    this._content.addChild(title);

    // 离线时长
    const hours = Math.floor(this._reward.offlineSeconds / 3600);
    const minutes = Math.floor((this._reward.offlineSeconds % 3600) / 60);
    const timeStr = hours > 0 ? `${hours}小时${minutes}分钟` : `${minutes}分钟`;
    const timeText = new PIXI.Text(`离线时长: ${timeStr}`, {
      fontSize: 15, fill: COLORS.TEXT_LIGHT, fontFamily: FONT_FAMILY,
    });
    timeText.anchor.set(0.5, 0);
    timeText.position.set(cx, panelY + 54);
    this._content.addChild(timeText);

    // 收益列表
    let y = panelY + 90;
    const lineH = 36;

    // 产出物品
    if (this._reward.producedItems.length > 0) {
      this._drawRewardLine(panelX + 60, y, '', `花束产出 ×${this._reward.producedItems.length}`);
      y += lineH;

      // 显示具体物品名（最多3个）
      const items = this._reward.producedItems.slice(0, 3);
      const names = items.map(i => i.name).join('、');
      const extra = this._reward.producedItems.length > 3 ? `等${this._reward.producedItems.length}个` : '';
      const itemDetail = new PIXI.Text(`  ${names}${extra}`, {
        fontSize: 13, fill: COLORS.TEXT_LIGHT, fontFamily: FONT_FAMILY,
      });
      itemDetail.position.set(panelX + 80, y);
      this._content.addChild(itemDetail);
      y += lineH;
    }

    if (this._reward.huayuanEarned > 0) {
      this._drawRewardLine(panelX + 60, y, '', `花愿收入 +${this._reward.huayuanEarned}`);
      y += lineH;
    }

    const btnY = panelY + panelH - 90;
    const btnW = 220;
    const btnH = 48;

    const claimBtnX = cx - btnW / 2;
    const claimBtn = new PIXI.Graphics();
    claimBtn.beginFill(COLORS.BUTTON_PRIMARY);
    claimBtn.drawRoundedRect(claimBtnX, btnY, btnW, btnH, 24);
    claimBtn.endFill();
    this._content.addChild(claimBtn);

    const claimText = new PIXI.Text(' 领取收益', {
      fontSize: 17, fill: 0xFFFFFF, fontFamily: FONT_FAMILY, fontWeight: 'bold',
    });
    claimText.anchor.set(0.5, 0.5);
    claimText.position.set(claimBtnX + btnW / 2, btnY + btnH / 2);
    this._content.addChild(claimText);

    const claimHit = new PIXI.Container();
    claimHit.hitArea = new PIXI.Rectangle(claimBtnX, btnY, btnW, btnH);
    claimHit.eventMode = 'static';
    claimHit.cursor = 'pointer';
    claimHit.on('pointerdown', () => {
      IdleManager.claimReward();
      this.close();
    });
    this._content.addChild(claimHit);
  }

  private _drawRewardLine(x: number, y: number, icon: string, text: string): void {
    const iconText = new PIXI.Text(icon, { fontSize: 22, fontFamily: FONT_FAMILY });
    iconText.position.set(x, y);
    this._content.addChild(iconText);

    const label = new PIXI.Text(text, {
      fontSize: 17, fill: COLORS.TEXT_DARK, fontFamily: FONT_FAMILY,
    });
    label.position.set(x + 36, y + 2);
    this._content.addChild(label);
  }
}
