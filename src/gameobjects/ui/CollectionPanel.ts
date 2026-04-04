/**
 * 图鉴面板 - 6大收集分类展示 + 里程碑奖励
 *
 * 分类：花系 / 花饮(9) / 建筑(13) / 宝箱(5) / 客人(6) / 装饰(72) / 花语卡片（与 FlowerCardManager 同步）
 * 里程碑：25% / 50% / 75% / 100% 解锁奖励
 */
import * as PIXI from 'pixi.js';
import { Game } from '@/core/Game';
import { EventBus } from '@/core/EventBus';
import { TweenManager, Ease } from '@/core/TweenManager';
import { CollectionManager, CollectionCategory } from '@/managers/CollectionManager';
import { ToastMessage } from './ToastMessage';
import { DESIGN_WIDTH, FONT_FAMILY, COLORS } from '@/config/Constants';

type TabType = 'overview' | 'milestone';

/** 分类显示配置 */
const CATEGORY_DISPLAY: { cat: CollectionCategory; icon: string; name: string; color: number }[] = [
  { cat: CollectionCategory.FLOWER, icon: '🌸', name: '花束', color: 0xFFB7C5 },
  { cat: CollectionCategory.DRINK, icon: '🍵', name: '花饮', color: 0x90EE90 },
  { cat: CollectionCategory.BUILDING, icon: '🏠', name: '建筑', color: 0xDEB887 },
  { cat: CollectionCategory.CHEST, icon: '📦', name: '宝箱', color: 0xDAA520 },
  { cat: CollectionCategory.CUSTOMER, icon: '👤', name: '客人', color: 0x87CEEB },
  { cat: CollectionCategory.DECORATION, icon: '🪑', name: '装饰', color: 0xDDA0DD },
  { cat: CollectionCategory.FLOWER_CARD, icon: '💐', name: '花语卡片', color: 0xFFD700 },
];

export class CollectionPanel extends PIXI.Container {
  private _bg!: PIXI.Graphics;
  private _content!: PIXI.Container;
  private _scrollContainer!: PIXI.Container;
  private _isOpen = false;
  private _activeTab: TabType = 'overview';
  private _scrollY = 0;
  private _maxScrollY = 0;

  constructor() {
    super();
    this.visible = false;
    this.zIndex = 5000;
    this._build();
    this._bindEvents();
  }

  open(): void {
    if (this._isOpen) return;
    this._isOpen = true;
    this.visible = true;
    this._activeTab = 'overview';
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

  private _bindEvents(): void {
    EventBus.on('panel:openCollection', () => this.open());
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
    const panelH = Math.min(Game.logicHeight - 60, 820);
    const panelX = cx - panelW / 2;
    const panelY = (Game.logicHeight - panelH) / 2;

    // 面板背景
    const bg = new PIXI.Graphics();
    bg.beginFill(0xFFFBF0);
    bg.drawRoundedRect(panelX, panelY, panelW, panelH, 20);
    bg.endFill();
    bg.eventMode = 'static';
    this._content.addChild(bg);

    // 标题
    const totalPercent = CollectionManager.progressPercent.toFixed(1);
    const title = new PIXI.Text(`📖 花语图鉴  ${CollectionManager.totalDiscovered}/${CollectionManager.totalCount} (${totalPercent}%)`, {
      fontSize: 20, fill: COLORS.TEXT_DARK, fontFamily: FONT_FAMILY, fontWeight: 'bold',
    });
    title.anchor.set(0.5, 0);
    title.position.set(cx, panelY + 16);
    this._content.addChild(title);

    // Tab 按钮
    const tabY = panelY + 48;
    this._drawTab('📋 总览', panelX + 20, tabY, 140, 'overview');
    this._drawTab('🏆 里程碑', panelX + 170, tabY, 140, 'milestone');

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

    // 滚动区域
    const scrollAreaY = tabY + 46;
    const scrollAreaH = panelH - (scrollAreaY - panelY) - 12;

    const mask = new PIXI.Graphics();
    mask.beginFill(0xFFFFFF);
    mask.drawRect(panelX, scrollAreaY, panelW, scrollAreaH);
    mask.endFill();
    this._content.addChild(mask);

    this._scrollContainer = new PIXI.Container();
    this._scrollContainer.mask = mask;
    this._content.addChild(this._scrollContainer);

    let contentH = 0;
    if (this._activeTab === 'overview') {
      contentH = this._drawOverviewTab(panelX, scrollAreaY, panelW);
    } else {
      contentH = this._drawMilestoneTab(panelX, scrollAreaY, panelW);
    }

    this._maxScrollY = Math.max(0, contentH - scrollAreaH);
    this._scrollY = 0;

    // 滚动交互
    let lastTouchY = 0;
    let isDragging = false;
    bg.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      const localY = e.globalY / Game.scale;
      if (localY >= scrollAreaY && localY <= scrollAreaY + scrollAreaH) {
        lastTouchY = localY;
        isDragging = true;
      }
    });
    bg.on('pointermove', (e: PIXI.FederatedPointerEvent) => {
      if (!isDragging) return;
      const curTouchY = e.globalY / Game.scale;
      const delta = lastTouchY - curTouchY;
      lastTouchY = curTouchY;
      this._scrollY = Math.max(0, Math.min(this._maxScrollY, this._scrollY + delta));
      this._scrollContainer.y = -this._scrollY;
    });
    bg.on('pointerup', () => { isDragging = false; });
    bg.on('pointerupoutside', () => { isDragging = false; });
  }

  private _drawTab(label: string, x: number, y: number, w: number, tab: TabType): void {
    const isActive = this._activeTab === tab;
    const g = new PIXI.Graphics();
    g.beginFill(isActive ? COLORS.BUTTON_PRIMARY : 0xEEEEEE);
    g.drawRoundedRect(x, y, w, 36, 18);
    g.endFill();
    this._content.addChild(g);

    const text = new PIXI.Text(label, {
      fontSize: 14, fill: isActive ? 0xFFFFFF : COLORS.TEXT_DARK, fontFamily: FONT_FAMILY,
      fontWeight: isActive ? 'bold' : 'normal',
    });
    text.anchor.set(0.5, 0.5);
    text.position.set(x + w / 2, y + 18);
    this._content.addChild(text);

    const hit = new PIXI.Container();
    hit.hitArea = new PIXI.Rectangle(x, y, w, 36);
    hit.eventMode = 'static';
    hit.cursor = 'pointer';
    hit.on('pointerdown', () => {
      this._activeTab = tab;
      this._refresh();
    });
    this._content.addChild(hit);
  }

  /** 总览 Tab - 显示各大分类的收集进度 */
  private _drawOverviewTab(panelX: number, startY: number, panelW: number): number {
    const pad = 16;
    let y = startY + 10;

    // 总进度条
    const barX = panelX + pad;
    const barW = panelW - pad * 2;
    const progress = CollectionManager.progressPercent / 100;

    const barBg = new PIXI.Graphics();
    barBg.beginFill(0xE0E0E0);
    barBg.drawRoundedRect(barX, y, barW, 14, 7);
    barBg.endFill();
    this._scrollContainer.addChild(barBg);

    if (progress > 0) {
      const barFill = new PIXI.Graphics();
      barFill.beginFill(COLORS.BUTTON_PRIMARY);
      barFill.drawRoundedRect(barX, y, barW * Math.min(progress, 1), 14, 7);
      barFill.endFill();
      this._scrollContainer.addChild(barFill);
    }
    y += 28;

    // 各分类卡片（2列布局）
    const cardW = (panelW - pad * 3) / 2;
    const cardH = 110;
    const gap = 10;

    for (let i = 0; i < CATEGORY_DISPLAY.length; i += 2) {
      for (let j = 0; j < 2 && i + j < CATEGORY_DISPLAY.length; j++) {
        const cfg = CATEGORY_DISPLAY[i + j];
        const cardX = panelX + pad + j * (cardW + pad);
        this._drawCategoryCard(cardX, y, cardW, cardH, cfg);
      }
      y += cardH + gap;
    }

    return y - startY;
  }

  /** 绘制分类卡片 */
  private _drawCategoryCard(
    x: number, y: number, w: number, h: number,
    cfg: { cat: CollectionCategory; icon: string; name: string; color: number },
  ): void {
    const count = CollectionManager.getCategoryCount(cfg.cat);
    const total = CollectionManager.getCategoryTotal(cfg.cat);
    const progress = total > 0 ? count / total : 0;

    // 卡片背景
    const card = new PIXI.Graphics();
    card.beginFill(0xFFFFFF);
    card.drawRoundedRect(x, y, w, h, 12);
    card.endFill();
    card.lineStyle(1.5, cfg.color, 0.5);
    card.drawRoundedRect(x, y, w, h, 12);
    this._scrollContainer.addChild(card);

    // 顶部色条
    const topBar = new PIXI.Graphics();
    topBar.beginFill(cfg.color, 0.3);
    topBar.drawRoundedRect(x, y, w, 32, 12);
    topBar.endFill();
    // 遮住下方圆角
    topBar.beginFill(cfg.color, 0.3);
    topBar.drawRect(x, y + 16, w, 16);
    topBar.endFill();
    this._scrollContainer.addChild(topBar);

    // 图标 + 名称
    const nameText = new PIXI.Text(`${cfg.icon} ${cfg.name}`, {
      fontSize: 15, fill: COLORS.TEXT_DARK, fontFamily: FONT_FAMILY, fontWeight: 'bold',
    });
    nameText.position.set(x + 10, y + 7);
    this._scrollContainer.addChild(nameText);

    // 数量
    const countText = new PIXI.Text(`${count}/${total}`, {
      fontSize: 13, fill: COLORS.TEXT_LIGHT, fontFamily: FONT_FAMILY,
    });
    countText.anchor.set(1, 0);
    countText.position.set(x + w - 10, y + 9);
    this._scrollContainer.addChild(countText);

    // 进度条
    const barX = x + 10;
    const barY = y + 42;
    const barW = w - 20;
    const barH = 10;

    const barBg = new PIXI.Graphics();
    barBg.beginFill(0xE8E8E8);
    barBg.drawRoundedRect(barX, barY, barW, barH, 5);
    barBg.endFill();
    this._scrollContainer.addChild(barBg);

    if (progress > 0) {
      const barFill = new PIXI.Graphics();
      barFill.beginFill(cfg.color);
      barFill.drawRoundedRect(barX, barY, barW * Math.min(progress, 1), barH, 5);
      barFill.endFill();
      this._scrollContainer.addChild(barFill);
    }

    // 进度百分比
    const percentText = new PIXI.Text(`${(progress * 100).toFixed(0)}%`, {
      fontSize: 12, fill: COLORS.TEXT_LIGHT, fontFamily: FONT_FAMILY,
    });
    percentText.position.set(barX, barY + 16);
    this._scrollContainer.addChild(percentText);

    // 状态说明
    const statusText = count >= total ? '✅ 已完成' : `还差 ${total - count} 项`;
    const status = new PIXI.Text(statusText, {
      fontSize: 11, fill: count >= total ? 0x4CAF50 : COLORS.TEXT_LIGHT, fontFamily: FONT_FAMILY,
    });
    status.anchor.set(1, 0);
    status.position.set(x + w - 10, barY + 16);
    this._scrollContainer.addChild(status);
  }

  /** 里程碑 Tab - 显示 4 个里程碑奖励 */
  private _drawMilestoneTab(panelX: number, startY: number, panelW: number): number {
    const pad = 16;
    let y = startY + 10;

    const milestones = CollectionManager.milestones;
    const currentPercent = CollectionManager.progressPercent;

    for (const ms of milestones) {
      const cardX = panelX + pad;
      const cardW = panelW - pad * 2;
      const cardH = 100;

      const reached = currentPercent >= ms.percent;
      const claimed = ms.claimed;

      // 卡片背景
      const card = new PIXI.Graphics();
      card.beginFill(claimed ? 0xF0F0F0 : reached ? 0xFFF8E1 : 0xFFFFFF);
      card.drawRoundedRect(cardX, y, cardW, cardH, 12);
      card.endFill();
      card.lineStyle(1, claimed ? 0xDDDDDD : reached ? 0xFFD700 : 0xEEEEEE);
      card.drawRoundedRect(cardX, y, cardW, cardH, 12);
      this._scrollContainer.addChild(card);

      // 百分比徽章
      const badgeColor = claimed ? 0x9E9E9E : reached ? 0xFFD700 : 0xBDBDBD;
      const badge = new PIXI.Graphics();
      badge.beginFill(badgeColor);
      badge.drawCircle(cardX + 36, y + cardH / 2, 24);
      badge.endFill();
      this._scrollContainer.addChild(badge);

      const badgeText = new PIXI.Text(`${ms.percent}%`, {
        fontSize: 14, fill: 0xFFFFFF, fontFamily: FONT_FAMILY, fontWeight: 'bold',
      });
      badgeText.anchor.set(0.5, 0.5);
      badgeText.position.set(cardX + 36, y + cardH / 2);
      this._scrollContainer.addChild(badgeText);

      // 标题
      const title = new PIXI.Text(ms.desc, {
        fontSize: 16, fill: COLORS.TEXT_DARK, fontFamily: FONT_FAMILY, fontWeight: 'bold',
      });
      title.position.set(cardX + 72, y + 14);
      this._scrollContainer.addChild(title);

      // 奖励描述
      const rewardParts: string[] = [];
      if (ms.gold) rewardParts.push(`💰${ms.gold}`);
      if (ms.diamond) rewardParts.push(`💎${ms.diamond}`);
      if (ms.huayuan) rewardParts.push(`🌸${ms.huayuan}`);
      const rewardText = new PIXI.Text(rewardParts.join('  '), {
        fontSize: 13, fill: COLORS.TEXT_LIGHT, fontFamily: FONT_FAMILY,
      });
      rewardText.position.set(cardX + 72, y + 40);
      this._scrollContainer.addChild(rewardText);

      // 状态按钮
      if (claimed) {
        const doneText = new PIXI.Text('✅ 已领取', {
          fontSize: 14, fill: 0x9E9E9E, fontFamily: FONT_FAMILY,
        });
        doneText.position.set(cardX + 72, y + 66);
        this._scrollContainer.addChild(doneText);
      } else if (reached) {
        // 可领取按钮
        const btnX = cardX + 72;
        const btnY = y + 62;
        const btn = new PIXI.Graphics();
        btn.beginFill(0x4CAF50);
        btn.drawRoundedRect(btnX, btnY, 100, 30, 15);
        btn.endFill();
        this._scrollContainer.addChild(btn);

        const btnText = new PIXI.Text('🎁 领取', {
          fontSize: 14, fill: 0xFFFFFF, fontFamily: FONT_FAMILY, fontWeight: 'bold',
        });
        btnText.anchor.set(0.5, 0.5);
        btnText.position.set(btnX + 50, btnY + 15);
        this._scrollContainer.addChild(btnText);

        const hit = new PIXI.Container();
        hit.hitArea = new PIXI.Rectangle(btnX, btnY, 100, 30);
        hit.eventMode = 'static';
        hit.cursor = 'pointer';
        hit.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
          e.stopPropagation();
          if (CollectionManager.claimMilestone(ms.percent)) {
            ToastMessage.show(`🎉 领取里程碑奖励：${ms.desc}！`);
            this._refresh();
          }
        });
        this._scrollContainer.addChild(hit);
      } else {
        // 进度提示
        const progressText = new PIXI.Text(`进度 ${currentPercent.toFixed(1)}% / ${ms.percent}%`, {
          fontSize: 12, fill: COLORS.TEXT_LIGHT, fontFamily: FONT_FAMILY,
        });
        progressText.position.set(cardX + 72, y + 68);
        this._scrollContainer.addChild(progressText);
      }

      y += cardH + 10;
    }

    return y - startY;
  }
}
