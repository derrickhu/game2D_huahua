/**
 * 限时活动面板 - 活动任务 + 积分商店
 *
 * 显示当前活动的：
 * - 活动信息（名称、倒计时、主题色）
 * - 活动任务列表（进度条+领取按钮）
 * - 积分商店（使用活动积分兑换奖励）
 */
import * as PIXI from 'pixi.js';
import { Game } from '@/core/Game';
import { EventBus } from '@/core/EventBus';
import { TweenManager, Ease } from '@/core/TweenManager';
import { EventManager, EventStatus } from '@/managers/EventManager';
import { ToastMessage } from './ToastMessage';
import { DESIGN_WIDTH, FONT_FAMILY, COLORS } from '@/config/Constants';

type TabType = 'tasks' | 'shop';

export class EventPanel extends PIXI.Container {
  private _bg!: PIXI.Graphics;
  private _content!: PIXI.Container;
  private _scrollContainer!: PIXI.Container;
  private _isOpen = false;
  private _activeTab: TabType = 'tasks';
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

    if (!EventManager.activeEvent) {
      ToastMessage.show('🎪 当前没有进行中的活动');
      return;
    }

    this._isOpen = true;
    this.visible = true;
    this._activeTab = 'tasks';
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
    EventBus.on('panel:openEvent', () => this.open());
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

    const event = EventManager.activeEvent;
    if (!event) return;

    this._content.pivot.set(DESIGN_WIDTH / 2, Game.logicHeight / 2);
    this._content.position.set(DESIGN_WIDTH / 2, Game.logicHeight / 2);

    const cx = DESIGN_WIDTH / 2;
    const panelW = Math.min(680, DESIGN_WIDTH - 32);
    const panelH = Math.min(Game.logicHeight - 60, 820);
    const panelX = cx - panelW / 2;
    const panelY = (Game.logicHeight - panelH) / 2;

    // 面板背景（使用活动主题色）
    const themeColor = event.themeColor;
    const bg = new PIXI.Graphics();
    bg.beginFill(0xFFFBF0);
    bg.drawRoundedRect(panelX, panelY, panelW, panelH, 20);
    bg.endFill();
    bg.eventMode = 'static';
    this._content.addChild(bg);

    // 活动标题横幅
    const bannerH = 60;
    const banner = new PIXI.Graphics();
    banner.beginFill(themeColor, 0.3);
    banner.drawRoundedRect(panelX, panelY, panelW, bannerH, 20);
    banner.endFill();
    banner.beginFill(themeColor, 0.3);
    banner.drawRect(panelX, panelY + bannerH - 20, panelW, 20);
    banner.endFill();
    this._content.addChild(banner);

    // 活动名称
    const title = new PIXI.Text(event.name, {
      fontSize: 22, fill: COLORS.TEXT_DARK, fontFamily: FONT_FAMILY, fontWeight: 'bold',
    });
    title.anchor.set(0.5, 0);
    title.position.set(cx, panelY + 10);
    this._content.addChild(title);

    // 倒计时 + 积分
    const status = EventManager.eventStatus;
    const statusText = status === EventStatus.ENDING_SOON ? '⚠️ 即将结束' :
                       status === EventStatus.ENDED ? '❌ 已结束' : '⏳ 进行中';

    const timerText = new PIXI.Text(`${statusText}  剩余: ${EventManager.timeRemainingText}  |  🎪 积分: ${EventManager.points}`, {
      fontSize: 13, fill: COLORS.TEXT_LIGHT, fontFamily: FONT_FAMILY,
    });
    timerText.anchor.set(0.5, 0);
    timerText.position.set(cx, panelY + 38);
    this._content.addChild(timerText);

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

    // Tab 按钮
    const tabY = panelY + bannerH + 6;
    this._drawTab('📋 活动任务', panelX + 20, tabY, 150, 'tasks');
    this._drawTab('🛒 积分商店', panelX + 180, tabY, 150, 'shop');

    // 滚动区域
    const scrollAreaY = tabY + 44;
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
    if (this._activeTab === 'tasks') {
      contentH = this._drawTasksTab(panelX, scrollAreaY, panelW);
    } else {
      contentH = this._drawShopTab(panelX, scrollAreaY, panelW);
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

  /** 活动任务 Tab */
  private _drawTasksTab(panelX: number, startY: number, panelW: number): number {
    const event = EventManager.activeEvent;
    if (!event) return 0;

    const pad = 16;
    let y = startY + 8;

    for (const task of event.tasks) {
      const cardX = panelX + pad;
      const cardW = panelW - pad * 2;
      const cardH = 86;
      const progress = Math.min(task.current / task.target, 1);

      // 行背景
      const rowBg = new PIXI.Graphics();
      rowBg.beginFill(task.claimed ? 0xF0F0F0 : task.completed ? 0xFFF3E0 : 0xFFFFFF);
      rowBg.drawRoundedRect(cardX, y, cardW, cardH, 12);
      rowBg.endFill();
      rowBg.lineStyle(1, 0xEEEEEE);
      rowBg.drawRoundedRect(cardX, y, cardW, cardH, 12);
      this._scrollContainer.addChild(rowBg);

      // 图标
      const icon = new PIXI.Text(task.icon, { fontSize: 24, fontFamily: FONT_FAMILY });
      icon.position.set(cardX + 12, y + 10);
      this._scrollContainer.addChild(icon);

      // 任务名
      const name = new PIXI.Text(task.name, {
        fontSize: 15, fill: COLORS.TEXT_DARK, fontFamily: FONT_FAMILY, fontWeight: 'bold',
      });
      name.position.set(cardX + 44, y + 10);
      this._scrollContainer.addChild(name);

      // 描述
      const desc = new PIXI.Text(task.desc, {
        fontSize: 12, fill: COLORS.TEXT_LIGHT, fontFamily: FONT_FAMILY,
      });
      desc.position.set(cardX + 44, y + 32);
      this._scrollContainer.addChild(desc);

      // 进度条
      const barX = cardX + 44;
      const barY = y + 54;
      const barW = cardW * 0.45;

      const barBg = new PIXI.Graphics();
      barBg.beginFill(0xE0E0E0);
      barBg.drawRoundedRect(barX, barY, barW, 12, 6);
      barBg.endFill();
      this._scrollContainer.addChild(barBg);

      if (progress > 0) {
        const barFill = new PIXI.Graphics();
        barFill.beginFill(task.completed ? 0x4CAF50 : COLORS.BUTTON_PRIMARY);
        barFill.drawRoundedRect(barX, barY, barW * progress, 12, 6);
        barFill.endFill();
        this._scrollContainer.addChild(barFill);
      }

      const progressText = new PIXI.Text(`${task.current}/${task.target}`, {
        fontSize: 11, fill: COLORS.TEXT_LIGHT, fontFamily: FONT_FAMILY,
      });
      progressText.position.set(barX + barW + 8, barY - 1);
      this._scrollContainer.addChild(progressText);

      // 奖励/状态按钮
      const btnX = cardX + cardW - 100;
      const btnY = y + 24;

      if (task.claimed) {
        const doneText = new PIXI.Text('✅ 已领取', {
          fontSize: 13, fill: 0x9E9E9E, fontFamily: FONT_FAMILY,
        });
        doneText.position.set(btnX, btnY + 6);
        this._scrollContainer.addChild(doneText);
      } else if (task.completed) {
        const btn = new PIXI.Graphics();
        btn.beginFill(0x4CAF50);
        btn.drawRoundedRect(btnX, btnY, 88, 34, 17);
        btn.endFill();
        this._scrollContainer.addChild(btn);

        const btnText = new PIXI.Text(`+${task.pointReward}分`, {
          fontSize: 14, fill: 0xFFFFFF, fontFamily: FONT_FAMILY, fontWeight: 'bold',
        });
        btnText.anchor.set(0.5, 0.5);
        btnText.position.set(btnX + 44, btnY + 17);
        this._scrollContainer.addChild(btnText);

        const hit = new PIXI.Container();
        hit.hitArea = new PIXI.Rectangle(btnX, btnY, 88, 34);
        hit.eventMode = 'static';
        hit.cursor = 'pointer';
        hit.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
          e.stopPropagation();
          if (EventManager.claimTaskReward(task.id)) {
            ToastMessage.show(`🎪 获得 ${task.pointReward} 活动积分！`);
            this._refresh();
          }
        });
        this._scrollContainer.addChild(hit);
      } else {
        const rewardText = new PIXI.Text(`🎪 +${task.pointReward}分`, {
          fontSize: 12, fill: COLORS.TEXT_LIGHT, fontFamily: FONT_FAMILY,
        });
        rewardText.position.set(btnX, btnY + 6);
        this._scrollContainer.addChild(rewardText);
      }

      y += cardH + 8;
    }

    return y - startY;
  }

  /** 积分商店 Tab */
  private _drawShopTab(panelX: number, startY: number, panelW: number): number {
    const event = EventManager.activeEvent;
    if (!event) return 0;

    const pad = 16;
    let y = startY + 8;

    // 当前积分
    const pointsText = new PIXI.Text(`🎪 当前积分: ${EventManager.points}`, {
      fontSize: 16, fill: COLORS.BUTTON_PRIMARY, fontFamily: FONT_FAMILY, fontWeight: 'bold',
    });
    pointsText.position.set(panelX + pad, y);
    this._scrollContainer.addChild(pointsText);
    y += 32;

    for (const item of event.shop) {
      const cardX = panelX + pad;
      const cardW = panelW - pad * 2;
      const cardH = 74;
      const soldOut = item.stock >= 0 && item.bought >= item.stock;
      const canAfford = EventManager.points >= item.pointCost;

      // 行背景
      const rowBg = new PIXI.Graphics();
      rowBg.beginFill(soldOut ? 0xF0F0F0 : 0xFFFFFF);
      rowBg.drawRoundedRect(cardX, y, cardW, cardH, 12);
      rowBg.endFill();
      rowBg.lineStyle(1, 0xEEEEEE);
      rowBg.drawRoundedRect(cardX, y, cardW, cardH, 12);
      this._scrollContainer.addChild(rowBg);

      // 图标
      const icon = new PIXI.Text(item.icon, { fontSize: 24, fontFamily: FONT_FAMILY });
      icon.position.set(cardX + 14, y + 12);
      this._scrollContainer.addChild(icon);

      // 名称
      const name = new PIXI.Text(item.name, {
        fontSize: 15, fill: soldOut ? 0xBBBBBB : COLORS.TEXT_DARK, fontFamily: FONT_FAMILY, fontWeight: 'bold',
      });
      name.position.set(cardX + 48, y + 12);
      this._scrollContainer.addChild(name);

      // 描述 + 库存
      const stockText = item.stock < 0 ? '不限' : `${item.stock - item.bought}/${item.stock}`;
      const desc = new PIXI.Text(`${item.desc || '活动奖励'}  库存: ${stockText}`, {
        fontSize: 12, fill: COLORS.TEXT_LIGHT, fontFamily: FONT_FAMILY,
      });
      desc.position.set(cardX + 48, y + 36);
      this._scrollContainer.addChild(desc);

      // 兑换按钮
      const btnX = cardX + cardW - 110;
      const btnY = y + cardH / 2 - 16;

      if (soldOut) {
        const soldText = new PIXI.Text('已售罄', {
          fontSize: 13, fill: 0x9E9E9E, fontFamily: FONT_FAMILY,
        });
        soldText.position.set(btnX + 16, btnY + 4);
        this._scrollContainer.addChild(soldText);
      } else {
        const btn = new PIXI.Graphics();
        btn.beginFill(canAfford ? COLORS.BUTTON_PRIMARY : 0xBDBDBD);
        btn.drawRoundedRect(btnX, btnY, 100, 32, 16);
        btn.endFill();
        this._scrollContainer.addChild(btn);

        const btnText = new PIXI.Text(`🎪 ${item.pointCost}`, {
          fontSize: 13, fill: 0xFFFFFF, fontFamily: FONT_FAMILY, fontWeight: 'bold',
        });
        btnText.anchor.set(0.5, 0.5);
        btnText.position.set(btnX + 50, btnY + 16);
        this._scrollContainer.addChild(btnText);

        if (canAfford) {
          const hit = new PIXI.Container();
          hit.hitArea = new PIXI.Rectangle(btnX, btnY, 100, 32);
          hit.eventMode = 'static';
          hit.cursor = 'pointer';
          hit.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
            e.stopPropagation();
            if (EventManager.buyShopItem(item.id)) {
              ToastMessage.show(`🛒 兑换成功：${item.name}！`);
              this._refresh();
            }
          });
          this._scrollContainer.addChild(hit);
        }
      }

      y += cardH + 8;
    }

    return y - startY;
  }
}
