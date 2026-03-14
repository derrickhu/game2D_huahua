/**
 * 挑战关卡面板 - 章节选择 + 关卡列表
 */
import * as PIXI from 'pixi.js';
import { Game } from '@/core/Game';
import { EventBus } from '@/core/EventBus';
import { TweenManager, Ease } from '@/core/TweenManager';
import { ChallengeManager, ChallengeType, StarRating } from '@/managers/ChallengeManager';
import { ToastMessage } from './ToastMessage';
import { DESIGN_WIDTH, FONT_FAMILY, COLORS } from '@/config/Constants';

const TYPE_DISPLAY: Record<string, { icon: string; name: string }> = {
  [ChallengeType.TIMED]: { icon: '⏱️', name: '限时' },
  [ChallengeType.LIMITED_MOVES]: { icon: '📏', name: '限步' },
  [ChallengeType.TARGET]: { icon: '🎯', name: '目标' },
  [ChallengeType.COMBO]: { icon: '🔥', name: '连击' },
};

export class ChallengePanel extends PIXI.Container {
  private _bg!: PIXI.Graphics;
  private _content!: PIXI.Container;
  private _scrollContainer!: PIXI.Container;
  private _isOpen = false;
  private _activeChapter = 1;
  private _scrollY = 0;
  private _maxScrollY = 0;

  constructor() {
    super();
    this.visible = false;
    this.zIndex = 5000;
    this._build();
    EventBus.on('panel:openChallenge', () => this.open());
  }

  open(): void {
    if (this._isOpen) return;
    this._isOpen = true;
    this.visible = true;
    this._activeChapter = 1;
    this._scrollY = 0;
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
    const panelW = Math.min(680, DESIGN_WIDTH - 32);
    const panelH = Math.min(Game.logicHeight - 60, 780);
    const panelX = cx - panelW / 2;
    const panelY = (Game.logicHeight - panelH) / 2;

    // 背景
    const bg = new PIXI.Graphics();
    bg.beginFill(0xFFF8F0);
    bg.drawRoundedRect(panelX, panelY, panelW, panelH, 20);
    bg.endFill();
    bg.eventMode = 'static';
    this._content.addChild(bg);

    // 标题
    const title = new PIXI.Text(`🏆 挑战关卡  ⭐${ChallengeManager.totalStars}  (${ChallengeManager.clearedLevels}/${ChallengeManager.totalLevels})`, {
      fontSize: 20, fill: COLORS.TEXT_DARK, fontFamily: FONT_FAMILY, fontWeight: 'bold',
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

    // 章节 Tab
    const tabY = panelY + 48;
    const chapters = ChallengeManager.chapters;
    const tabW = 140;
    for (let i = 0; i < chapters.length; i++) {
      const ch = chapters[i];
      const isActive = ch === this._activeChapter;
      const tx = panelX + 20 + i * (tabW + 10);
      const g = new PIXI.Graphics();
      g.beginFill(isActive ? COLORS.BUTTON_PRIMARY : 0xEEEEEE);
      g.drawRoundedRect(tx, tabY, tabW, 34, 17);
      g.endFill();
      this._content.addChild(g);
      const label = new PIXI.Text(`第${ch}章`, {
        fontSize: 14, fill: isActive ? 0xFFFFFF : COLORS.TEXT_DARK, fontFamily: FONT_FAMILY, fontWeight: isActive ? 'bold' : 'normal',
      });
      label.anchor.set(0.5, 0.5);
      label.position.set(tx + tabW / 2, tabY + 17);
      this._content.addChild(label);
      const hit = new PIXI.Container();
      hit.hitArea = new PIXI.Rectangle(tx, tabY, tabW, 34);
      hit.eventMode = 'static';
      hit.cursor = 'pointer';
      hit.on('pointerdown', () => { this._activeChapter = ch; this._refresh(); });
      this._content.addChild(hit);
    }

    // 滚动区域
    const scrollY = tabY + 44;
    const scrollH = panelH - (scrollY - panelY) - 12;
    const mask = new PIXI.Graphics();
    mask.beginFill(0xFFFFFF);
    mask.drawRect(panelX, scrollY, panelW, scrollH);
    mask.endFill();
    this._content.addChild(mask);
    this._scrollContainer = new PIXI.Container();
    this._scrollContainer.mask = mask;
    this._content.addChild(this._scrollContainer);

    const contentH = this._drawLevels(panelX, scrollY, panelW);
    this._maxScrollY = Math.max(0, contentH - scrollH);
    this._scrollY = 0;

    let lastTouchY = 0;
    let isDragging = false;
    bg.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      const ly = e.globalY / Game.scale;
      if (ly >= scrollY && ly <= scrollY + scrollH) { lastTouchY = ly; isDragging = true; }
    });
    bg.on('pointermove', (e: PIXI.FederatedPointerEvent) => {
      if (!isDragging) return;
      const cy = e.globalY / Game.scale;
      this._scrollY = Math.max(0, Math.min(this._maxScrollY, this._scrollY + (lastTouchY - cy)));
      lastTouchY = cy;
      this._scrollContainer.y = -this._scrollY;
    });
    bg.on('pointerup', () => { isDragging = false; });
    bg.on('pointerupoutside', () => { isDragging = false; });
  }

  private _drawLevels(panelX: number, startY: number, panelW: number): number {
    const pad = 16;
    let y = startY + 8;
    const levels = ChallengeManager.getLevels(this._activeChapter);

    for (const level of levels) {
      const cardX = panelX + pad;
      const cardW = panelW - pad * 2;
      const cardH = 110;
      const typeInfo = TYPE_DISPLAY[level.type] || { icon: '❓', name: '未知' };

      // 卡片
      const rowBg = new PIXI.Graphics();
      rowBg.beginFill(level.unlocked ? 0xFFFFFF : 0xF0F0F0);
      rowBg.drawRoundedRect(cardX, y, cardW, cardH, 14);
      rowBg.endFill();
      if (level.unlocked) { rowBg.lineStyle(1.5, level.bestStars >= StarRating.THREE ? 0xFFD700 : 0xDDDDDD); }
      else { rowBg.lineStyle(1, 0xDDDDDD); }
      rowBg.drawRoundedRect(cardX, y, cardW, cardH, 14);
      this._scrollContainer.addChild(rowBg);

      // 关卡图标
      const icon = new PIXI.Text(level.icon, { fontSize: 30, fontFamily: FONT_FAMILY });
      icon.anchor.set(0.5, 0.5);
      icon.position.set(cardX + 32, y + 32);
      if (!level.unlocked) icon.alpha = 0.3;
      this._scrollContainer.addChild(icon);

      // 类型标签
      const typeBadge = new PIXI.Text(`${typeInfo.icon} ${typeInfo.name}`, {
        fontSize: 10, fill: 0x666666, fontFamily: FONT_FAMILY,
      });
      typeBadge.position.set(cardX + 56, y + 8);
      this._scrollContainer.addChild(typeBadge);

      // 名称
      const name = new PIXI.Text(`${level.level}. ${level.name}`, {
        fontSize: 16, fill: level.unlocked ? COLORS.TEXT_DARK : 0xBBBBBB, fontFamily: FONT_FAMILY, fontWeight: 'bold',
      });
      name.position.set(cardX + 56, y + 24);
      this._scrollContainer.addChild(name);

      // 描述
      const desc = new PIXI.Text(level.desc, {
        fontSize: 12, fill: COLORS.TEXT_LIGHT, fontFamily: FONT_FAMILY,
      });
      desc.position.set(cardX + 56, y + 46);
      this._scrollContainer.addChild(desc);

      // 星级
      const starsText = '⭐'.repeat(level.bestStars) + '☆'.repeat(3 - level.bestStars);
      const stars = new PIXI.Text(starsText, { fontSize: 16, fontFamily: FONT_FAMILY });
      stars.position.set(cardX + 56, y + 68);
      this._scrollContainer.addChild(stars);

      // 奖励预览
      const rewardParts: string[] = [];
      if (level.reward.gold) rewardParts.push(`💰${level.reward.gold}`);
      if (level.reward.diamond) rewardParts.push(`💎${level.reward.diamond}`);
      if (level.reward.huayuan) rewardParts.push(`🌸${level.reward.huayuan}`);
      const rewardText = new PIXI.Text(
        level.firstCleared ? '✅ 已领取' : rewardParts.join(' '),
        { fontSize: 11, fill: level.firstCleared ? 0x9E9E9E : COLORS.TEXT_LIGHT, fontFamily: FONT_FAMILY },
      );
      rewardText.position.set(cardX + 56, y + 90);
      this._scrollContainer.addChild(rewardText);

      // 开始/锁定按钮
      const btnX = cardX + cardW - 100;
      const btnY = y + cardH / 2 - 18;

      if (!level.unlocked) {
        const lockText = new PIXI.Text(`🔒 需${level.unlockStars}⭐`, {
          fontSize: 12, fill: 0xBBBBBB, fontFamily: FONT_FAMILY,
        });
        lockText.position.set(btnX, btnY + 6);
        this._scrollContainer.addChild(lockText);
      } else {
        const btn = new PIXI.Graphics();
        btn.beginFill(level.bestStars > 0 ? 0x2196F3 : COLORS.BUTTON_PRIMARY);
        btn.drawRoundedRect(btnX, btnY, 88, 36, 18);
        btn.endFill();
        this._scrollContainer.addChild(btn);

        const btnLabel = level.bestStars > 0 ? '再战' : '挑战';
        const btnText = new PIXI.Text(btnLabel, {
          fontSize: 15, fill: 0xFFFFFF, fontFamily: FONT_FAMILY, fontWeight: 'bold',
        });
        btnText.anchor.set(0.5, 0.5);
        btnText.position.set(btnX + 44, btnY + 18);
        this._scrollContainer.addChild(btnText);

        const hit = new PIXI.Container();
        hit.hitArea = new PIXI.Rectangle(btnX, btnY, 88, 36);
        hit.eventMode = 'static';
        hit.cursor = 'pointer';
        hit.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
          e.stopPropagation();
          if (ChallengeManager.startChallenge(level.id)) {
            ToastMessage.show(`🏆 开始挑战：${level.name}！`);
            this.close();
          } else {
            ToastMessage.show('⚠️ 无法开始挑战');
          }
        });
        this._scrollContainer.addChild(hit);
      }

      y += cardH + 10;
    }

    return y - startY;
  }
}
