/**
 * 排行榜面板 - 4种排行榜展示
 */
import * as PIXI from 'pixi.js';
import { Game } from '@/core/Game';
import { EventBus } from '@/core/EventBus';
import { TweenManager, Ease } from '@/core/TweenManager';
import { SocialManager, LeaderboardType } from '@/managers/SocialManager';
import { ToastMessage } from './ToastMessage';
import { DESIGN_WIDTH, FONT_FAMILY, COLORS } from '@/config/Constants';

const LB_TABS: { type: LeaderboardType; icon: string }[] = [
  { type: LeaderboardType.LEVEL, icon: '🏆' },
  { type: LeaderboardType.COLLECTION, icon: '📖' },
  { type: LeaderboardType.DECORATION, icon: '🏠' },
];

export class LeaderboardPanel extends PIXI.Container {
  private _bg!: PIXI.Graphics;
  private _content!: PIXI.Container;
  private _isOpen = false;
  private _activeType: LeaderboardType = LeaderboardType.LEVEL;

  constructor() {
    super();
    this.visible = false;
    this.zIndex = 5000;
    this._build();
    EventBus.on('panel:openLeaderboard', () => this.open());
  }

  open(): void {
    if (this._isOpen) return;
    this._isOpen = true;
    this.visible = true;
    this._activeType = LeaderboardType.LEVEL;
    this._refresh();
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
    TweenManager.to({ target: this._bg, props: { alpha: 0 }, duration: 0.15, ease: Ease.easeInQuad });
    TweenManager.to({
      target: this._content, props: { alpha: 0 }, duration: 0.15, ease: Ease.easeInQuad,
      onComplete: () => { this.visible = false; this.alpha = 1; },
    });
    TweenManager.to({ target: this._content.scale, props: { x: 0.9, y: 0.9 }, duration: 0.15, ease: Ease.easeInQuad });
  }

  private _build(): void {
    const w = DESIGN_WIDTH;
    const h = Game.logicHeight;
    this._bg = new PIXI.Graphics();
    this._bg.beginFill(0x000000, 0.5);
    this._bg.drawRect(0, 0, w, h);
    this._bg.endFill();
    this._bg.eventMode = 'static';
    this._bg.on('pointerdown', () => this.close());
    this.addChild(this._bg);
    this._content = new PIXI.Container();
    this.addChild(this._content);
  }

  private _refresh(): void {
    while (this._content.children.length > 0) {
      const child = this._content.children[0];
      this._content.removeChild(child);
      child.destroy({ children: true });
    }
    this._content.pivot.set(DESIGN_WIDTH / 2, Game.logicHeight / 2);
    this._content.position.set(DESIGN_WIDTH / 2, Game.logicHeight / 2);

    const cx = DESIGN_WIDTH / 2;
    const panelW = Math.min(620, DESIGN_WIDTH - 40);
    const panelH = 560;
    const panelX = cx - panelW / 2;
    const panelY = (Game.logicHeight - panelH) / 2;

    // 背景
    const bg = new PIXI.Graphics();
    bg.beginFill(0xFFFBF0);
    bg.drawRoundedRect(panelX, panelY, panelW, panelH, 20);
    bg.endFill();
    bg.eventMode = 'static';
    this._content.addChild(bg);

    // 标题
    const lbName = SocialManager.getLeaderboardName(this._activeType);
    const title = new PIXI.Text(lbName, {
      fontSize: 22, fill: COLORS.TEXT_DARK, fontFamily: FONT_FAMILY, fontWeight: 'bold',
    });
    title.anchor.set(0.5, 0);
    title.position.set(cx, panelY + 16);
    this._content.addChild(title);

    // 关闭
    const closeBtn = new PIXI.Text('✕', { fontSize: 22, fill: COLORS.TEXT_LIGHT, fontFamily: FONT_FAMILY });
    closeBtn.anchor.set(0.5, 0.5);
    closeBtn.position.set(panelX + panelW - 24, panelY + 24);
    closeBtn.eventMode = 'static';
    closeBtn.cursor = 'pointer';
    closeBtn.on('pointerdown', () => this.close());
    this._content.addChild(closeBtn);

    // Tab 按钮
    const tabY = panelY + 52;
    const tabW = (panelW - 40) / LB_TABS.length;
    for (let i = 0; i < LB_TABS.length; i++) {
      const tab = LB_TABS[i];
      const isActive = tab.type === this._activeType;
      const tx = panelX + 20 + i * tabW;
      const g = new PIXI.Graphics();
      g.beginFill(isActive ? COLORS.BUTTON_PRIMARY : 0xEEEEEE);
      g.drawRoundedRect(tx, tabY, tabW - 6, 34, 17);
      g.endFill();
      this._content.addChild(g);

      const tabLabel = new PIXI.Text(tab.icon, { fontSize: 18, fontFamily: FONT_FAMILY });
      tabLabel.anchor.set(0.5, 0.5);
      tabLabel.position.set(tx + (tabW - 6) / 2, tabY + 17);
      this._content.addChild(tabLabel);

      const hit = new PIXI.Container();
      hit.hitArea = new PIXI.Rectangle(tx, tabY, tabW - 6, 34);
      hit.eventMode = 'static';
      hit.cursor = 'pointer';
      hit.on('pointerdown', () => { this._activeType = tab.type; this._refresh(); });
      this._content.addChild(hit);
    }

    // 排行榜内容
    const listY = tabY + 48;
    const entries = SocialManager.getLeaderboard(this._activeType);
    const myScores = SocialManager.getMyScores();

    // 我的排名信息
    const myScore = myScores[this._activeType] || 0;
    const myInfo = new PIXI.Text(`📊 我的成绩: ${myScore}`, {
      fontSize: 15, fill: COLORS.BUTTON_PRIMARY, fontFamily: FONT_FAMILY, fontWeight: 'bold',
    });
    myInfo.anchor.set(0.5, 0);
    myInfo.position.set(cx, listY);
    this._content.addChild(myInfo);

    // 排行榜列表
    let y = listY + 36;
    const rowH = 56;
    const rowW = panelW - 40;
    const rowX = panelX + 20;

    for (const entry of entries) {
      const rowBg = new PIXI.Graphics();
      rowBg.beginFill(entry.isSelf ? 0xFFF3E0 : 0xFFFFFF);
      rowBg.drawRoundedRect(rowX, y, rowW, rowH, 10);
      rowBg.endFill();
      rowBg.lineStyle(1, entry.isSelf ? COLORS.BUTTON_PRIMARY : 0xEEEEEE, 0.5);
      rowBg.drawRoundedRect(rowX, y, rowW, rowH, 10);
      this._content.addChild(rowBg);

      // 排名
      const rankColors = [0xFFD700, 0xC0C0C0, 0xCD7F32];
      const rankColor = entry.rank <= 3 ? rankColors[entry.rank - 1] : COLORS.TEXT_LIGHT;
      const rank = new PIXI.Text(`#${entry.rank}`, {
        fontSize: 18, fill: rankColor, fontFamily: FONT_FAMILY, fontWeight: 'bold',
      });
      rank.anchor.set(0.5, 0.5);
      rank.position.set(rowX + 30, y + rowH / 2);
      this._content.addChild(rank);

      // 头像占位
      const avatar = new PIXI.Graphics();
      avatar.beginFill(0xE0E0E0);
      avatar.drawCircle(rowX + 72, y + rowH / 2, 18);
      avatar.endFill();
      this._content.addChild(avatar);

      const avatarIcon = new PIXI.Text(entry.isSelf ? '👤' : '🌸', { fontSize: 18, fontFamily: FONT_FAMILY });
      avatarIcon.anchor.set(0.5, 0.5);
      avatarIcon.position.set(rowX + 72, y + rowH / 2);
      this._content.addChild(avatarIcon);

      // 昵称
      const nickname = new PIXI.Text(entry.nickname || '花花妙屋玩家', {
        fontSize: 14, fill: COLORS.TEXT_DARK, fontFamily: FONT_FAMILY,
      });
      nickname.position.set(rowX + 100, y + 10);
      this._content.addChild(nickname);

      // 分数
      const score = new PIXI.Text(`${entry.score}`, {
        fontSize: 16, fill: COLORS.BUTTON_PRIMARY, fontFamily: FONT_FAMILY, fontWeight: 'bold',
      });
      score.anchor.set(1, 0.5);
      score.position.set(rowX + rowW - 16, y + rowH / 2);
      this._content.addChild(score);

      y += rowH + 6;
    }

    // 提示：排行榜需要微信开放数据域
    const hint = new PIXI.Text('💡 排行榜数据来自好友圈（微信开放数据域）', {
      fontSize: 11, fill: 0xBBBBBB, fontFamily: FONT_FAMILY,
    });
    hint.anchor.set(0.5, 0);
    hint.position.set(cx, panelY + panelH - 30);
    this._content.addChild(hint);

    // 互赠体力
    const giftY = y + 10;
    const giftBtn = new PIXI.Graphics();
    giftBtn.beginFill(0x4CAF50);
    giftBtn.drawRoundedRect(cx - 100, giftY, 200, 40, 20);
    giftBtn.endFill();
    this._content.addChild(giftBtn);

    const giftText = new PIXI.Text(`🎁 赠送体力 (${SocialManager.giftRemaining}/3)`, {
      fontSize: 14, fill: 0xFFFFFF, fontFamily: FONT_FAMILY, fontWeight: 'bold',
    });
    giftText.anchor.set(0.5, 0.5);
    giftText.position.set(cx, giftY + 20);
    this._content.addChild(giftText);

    if (SocialManager.giftRemaining > 0) {
      const giftHit = new PIXI.Container();
      giftHit.hitArea = new PIXI.Rectangle(cx - 100, giftY, 200, 40);
      giftHit.eventMode = 'static';
      giftHit.cursor = 'pointer';
      giftHit.on('pointerdown', () => {
        if (SocialManager.sendGift()) {
          ToastMessage.show('🎁 已发送体力赠送邀请！');
          this._refresh();
        }
      });
      this._content.addChild(giftHit);
    }
  }
}
