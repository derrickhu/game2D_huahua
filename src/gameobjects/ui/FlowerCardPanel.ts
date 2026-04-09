/**
 * 花语卡片面板 - 花语卡片收集与分享（张数与 FlowerCardManager 一致）
 *
 * 展示所有花语卡片（已收集的显示完整内容，未收集的灰色占位）
 * 点击已收集卡片可查看详情并分享到朋友圈
 */
import * as PIXI from 'pixi.js';
import { Game } from '@/core/Game';
import { EventBus } from '@/core/EventBus';
import { TweenManager, Ease } from '@/core/TweenManager';
import { FlowerCardManager, FlowerCard } from '@/managers/FlowerCardManager';
import { ToastMessage } from './ToastMessage';
import { DESIGN_WIDTH, FONT_FAMILY, COLORS } from '@/config/Constants';

/** 花系颜色映射 */
const LINE_COLORS: Record<string, number> = {
  daily: 0xFFB347,
  romantic: 0xFF69B4,
  luxury: 0x9370DB,
};

const LINE_NAMES: Record<string, string> = {
  daily: '日常花系',
  romantic: '浪漫花系',
  luxury: '奢华花系',
};

export class FlowerCardPanel extends PIXI.Container {
  private _bg!: PIXI.Graphics;
  private _content!: PIXI.Container;
  private _scrollContainer!: PIXI.Container;
  private _isOpen = false;
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
    EventBus.on('panel:openFlowerCard', () => this.open());
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

    // 面板背景（花语风格：渐变粉色调）
    const bg = new PIXI.Graphics();
    bg.beginFill(0xFFF5F8);
    bg.drawRoundedRect(panelX, panelY, panelW, panelH, 20);
    bg.endFill();
    bg.eventMode = 'static';
    this._content.addChild(bg);

    // 标题
    const title = new PIXI.Text(` 花语卡片  ${FlowerCardManager.collectedCount}/${FlowerCardManager.totalCount}`, {
      fontSize: 22, fill: COLORS.TEXT_DARK, fontFamily: FONT_FAMILY, fontWeight: 'bold',
    });
    title.anchor.set(0.5, 0);
    title.position.set(cx, panelY + 16);
    this._content.addChild(title);

    // 收集进度条
    const barX = panelX + 40;
    const barW = panelW - 80;
    const barY = panelY + 48;
    const progress = FlowerCardManager.collectedCount / FlowerCardManager.totalCount;

    const barBg = new PIXI.Graphics();
    barBg.beginFill(0xF0D0D8);
    barBg.drawRoundedRect(barX, barY, barW, 10, 5);
    barBg.endFill();
    this._content.addChild(barBg);

    if (progress > 0) {
      const barFill = new PIXI.Graphics();
      barFill.beginFill(0xFF69B4);
      barFill.drawRoundedRect(barX, barY, barW * Math.min(progress, 1), 10, 5);
      barFill.endFill();
      this._content.addChild(barFill);
    }

    if (FlowerCardManager.isComplete) {
      const completeText = new PIXI.Text(' 已集齐全部花语卡片！', {
        fontSize: 13, fill: 0xFF69B4, fontFamily: FONT_FAMILY, fontWeight: 'bold',
      });
      completeText.anchor.set(0.5, 0);
      completeText.position.set(cx, barY + 14);
      this._content.addChild(completeText);
    }

    // 关闭按钮
    const closeBtn = new PIXI.Text('×', {
      fontSize: 22, fill: COLORS.TEXT_LIGHT, fontFamily: FONT_FAMILY,
    });
    closeBtn.anchor.set(0.5, 0.5);
    closeBtn.position.set(panelX + panelW - 24, panelY + 24);
    closeBtn.eventMode = 'static';
    closeBtn.cursor = 'pointer';
    closeBtn.on('pointerdown', () => this.close());
    this._content.addChild(closeBtn);

    // 滚动区域
    const scrollAreaY = barY + 32;
    const scrollAreaH = panelH - (scrollAreaY - panelY) - 12;

    const mask = new PIXI.Graphics();
    mask.beginFill(0xFFFFFF);
    mask.drawRect(panelX, scrollAreaY, panelW, scrollAreaH);
    mask.endFill();
    this._content.addChild(mask);

    this._scrollContainer = new PIXI.Container();
    this._scrollContainer.mask = mask;
    this._content.addChild(this._scrollContainer);

    // 按花系分组绘制卡片
    const contentH = this._drawCards(panelX, scrollAreaY, panelW);
    this._maxScrollY = Math.max(0, contentH - scrollAreaH);

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

  /** 绘制花语卡片网格 */
  private _drawCards(panelX: number, startY: number, panelW: number): number {
    const pad = 14;
    const cardW = (panelW - pad * 4) / 3;
    const cardH = 140;
    const gap = 10;
    let y = startY + 8;

    const allCards = FlowerCardManager.allCards;

    // 按花系分组
    const groups: Record<string, any[]> = { daily: [], romantic: [], luxury: [] };
    for (const card of allCards) {
      // 从 ID 推断花系
      if (card.id.includes('daily')) groups.daily.push(card);
      else if (card.id.includes('romantic')) groups.romantic.push(card);
      else if (card.id.includes('luxury')) groups.luxury.push(card);
    }

    for (const [line, cards] of Object.entries(groups)) {
      if (cards.length === 0) continue;

      const lineColor = LINE_COLORS[line] || 0x999999;
      const lineName = LINE_NAMES[line] || line;

      // 花系标题
      const lineTitle = new PIXI.Text(`${line === 'daily' ? '' : line === 'romantic' ? '' : ''} ${lineName}`, {
        fontSize: 15, fill: lineColor, fontFamily: FONT_FAMILY, fontWeight: 'bold',
      });
      lineTitle.position.set(panelX + pad, y);
      this._scrollContainer.addChild(lineTitle);
      y += 26;

      // 3列卡片
      for (let i = 0; i < cards.length; i += 3) {
        for (let j = 0; j < 3 && i + j < cards.length; j++) {
          const card = cards[i + j];
          const cardX = panelX + pad + j * (cardW + pad);
          this._drawSingleCard(cardX, y, cardW, cardH, card, lineColor);
        }
        y += cardH + gap;
      }

      y += 6;
    }

    return y - startY;
  }

  /** 绘制单张卡片 */
  private _drawSingleCard(
    x: number, y: number, w: number, h: number,
    card: any, lineColor: number,
  ): void {
    const discovered = card.discovered !== false;

    // 卡片背景
    const cardBg = new PIXI.Graphics();
    if (discovered) {
      cardBg.beginFill(0xFFFFFF);
      cardBg.lineStyle(1.5, lineColor, 0.6);
    } else {
      cardBg.beginFill(0xE8E8E8);
      cardBg.lineStyle(1, 0xCCCCCC, 0.3);
    }
    cardBg.drawRoundedRect(x, y, w, h, 10);
    cardBg.endFill();
    this._scrollContainer.addChild(cardBg);

    if (discovered) {
      // 图标
      const icon = new PIXI.Text(card.icon || '', {
        fontSize: 30, fontFamily: FONT_FAMILY,
      });
      icon.anchor.set(0.5, 0.5);
      icon.position.set(x + w / 2, y + 30);
      this._scrollContainer.addChild(icon);

      // 花名
      const name = new PIXI.Text(card.name, {
        fontSize: 12, fill: COLORS.TEXT_DARK, fontFamily: FONT_FAMILY, fontWeight: 'bold',
        wordWrap: true, wordWrapWidth: w - 10,
        align: 'center',
      });
      name.anchor.set(0.5, 0);
      name.position.set(x + w / 2, y + 52);
      this._scrollContainer.addChild(name);

      // 花语（截断显示）
      if (card.quote) {
        const quoteShort = card.quote.length > 14 ? card.quote.slice(0, 14) + '…' : card.quote;
        const quote = new PIXI.Text(`「${quoteShort}」`, {
          fontSize: 10, fill: lineColor, fontFamily: FONT_FAMILY,
          wordWrap: true, wordWrapWidth: w - 10,
          align: 'center',
        });
        quote.anchor.set(0.5, 0);
        quote.position.set(x + w / 2, y + 76);
        this._scrollContainer.addChild(quote);
      }

      // 分享按钮
      const shareBtn = new PIXI.Text(' 分享', {
        fontSize: 11, fill: lineColor, fontFamily: FONT_FAMILY,
      });
      shareBtn.anchor.set(0.5, 0);
      shareBtn.position.set(x + w / 2, y + h - 24);
      this._scrollContainer.addChild(shareBtn);

      // 点击分享
      const hit = new PIXI.Container();
      hit.hitArea = new PIXI.Rectangle(x, y, w, h);
      hit.eventMode = 'static';
      hit.cursor = 'pointer';
      hit.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
        e.stopPropagation();
        if (card.id) {
          const fullCard = FlowerCardManager.getCard(card.id);
          if (fullCard) {
            FlowerCardManager.shareCard(fullCard);
            ToastMessage.show(`已分享「${fullCard.name}」的花语卡片`);
          }
        }
      });
      this._scrollContainer.addChild(hit);
    } else {
      // 未发现：问号图标
      const lock = new PIXI.Text('?', {
        fontSize: 30, fontFamily: FONT_FAMILY,
      });
      lock.anchor.set(0.5, 0.5);
      lock.position.set(x + w / 2, y + 40);
      lock.alpha = 0.4;
      this._scrollContainer.addChild(lock);

      const unknownName = new PIXI.Text(card.name || '???', {
        fontSize: 12, fill: 0xBBBBBB, fontFamily: FONT_FAMILY,
        align: 'center',
      });
      unknownName.anchor.set(0.5, 0);
      unknownName.position.set(x + w / 2, y + 64);
      this._scrollContainer.addChild(unknownName);

      const hint = new PIXI.Text('合成解锁', {
        fontSize: 10, fill: 0xCCCCCC, fontFamily: FONT_FAMILY,
      });
      hint.anchor.set(0.5, 0);
      hint.position.set(x + w / 2, y + 84);
      this._scrollContainer.addChild(hint);
    }
  }
}
