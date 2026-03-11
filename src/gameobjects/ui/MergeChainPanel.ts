/**
 * 合成线可视化面板 - 展示物品的完整合成路径
 *
 * 从底部上滑弹出，高度约屏幕 40%，展示物品所在合成链的所有等级。
 */
import * as PIXI from 'pixi.js';
import { EventBus } from '@/core/EventBus';
import { TweenManager, Ease } from '@/core/TweenManager';
import { Game } from '@/core/Game';
import { DESIGN_WIDTH, COLORS, FONT_FAMILY, BoardMetrics } from '@/config/Constants';
import { ITEM_DEFS, getMergeChain, getMergeChainName, Category } from '@/config/ItemConfig';
import { BUILDING_DEFS } from '@/config/BuildingConfig';
import { BoardManager } from '@/managers/BoardManager';
import { TextureCache } from '@/utils/TextureCache';

/** 面板高度 */
const PANEL_HEIGHT = 280;
/** 单个物品卡片 */
const CARD_W = 72;
const CARD_H = 100;
const CARD_GAP = 12;
/** 箭头宽度 */
const ARROW_W = 24;

export class MergeChainPanel extends PIXI.Container {
  private _overlay!: PIXI.Graphics;
  private _panel!: PIXI.Container;
  private _panelBg!: PIXI.Graphics;
  private _titleText!: PIXI.Text;
  private _subtitleText!: PIXI.Text;
  private _closeBtn!: PIXI.Container;
  private _scrollContainer!: PIXI.Container;
  private _scrollMask!: PIXI.Graphics;
  private _isOpen = false;

  /** 当前棋盘上拥有的物品ID集合 */
  private _ownedItems = new Set<string>();

  constructor() {
    super();
    this.visible = false;
    this._buildOverlay();
    this._buildPanel();
    this._buildCloseBtn();
    this._buildScrollArea();
  }

  private _buildOverlay(): void {
    this._overlay = new PIXI.Graphics();
    this._overlay.beginFill(0x000000, 0.6);
    this._overlay.drawRect(0, 0, DESIGN_WIDTH, Game.logicHeight);
    this._overlay.endFill();
    this._overlay.eventMode = 'static';
    this._overlay.on('pointerdown', () => this.close());
    this.addChild(this._overlay);
  }

  private _buildPanel(): void {
    this._panel = new PIXI.Container();
    this._panel.position.set(0, Game.logicHeight - PANEL_HEIGHT);

    // 面板背景
    this._panelBg = new PIXI.Graphics();
    this._panelBg.beginFill(0xFFF8F0);
    this._panelBg.drawRoundedRect(0, 0, DESIGN_WIDTH, PANEL_HEIGHT + 40, 20);
    this._panelBg.endFill();
    // 顶部装饰线
    this._panelBg.beginFill(0xE8D5C0);
    this._panelBg.drawRoundedRect(DESIGN_WIDTH / 2 - 30, 8, 60, 4, 2);
    this._panelBg.endFill();
    this._panel.addChild(this._panelBg);
    // 阻止面板点击穿透到overlay
    this._panelBg.eventMode = 'static';

    // 标题
    this._titleText = new PIXI.Text('', {
      fontSize: 18,
      fill: COLORS.TEXT_DARK,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    this._titleText.anchor.set(0.5, 0);
    this._titleText.position.set(DESIGN_WIDTH / 2, 20);
    this._panel.addChild(this._titleText);

    // 副标题（底部提示）
    this._subtitleText = new PIXI.Text('', {
      fontSize: 13,
      fill: COLORS.TEXT_LIGHT,
      fontFamily: FONT_FAMILY,
    });
    this._subtitleText.anchor.set(0.5, 0);
    this._subtitleText.position.set(DESIGN_WIDTH / 2, PANEL_HEIGHT - 40);
    this._panel.addChild(this._subtitleText);

    this.addChild(this._panel);
  }

  private _buildCloseBtn(): void {
    this._closeBtn = new PIXI.Container();
    const bg = new PIXI.Graphics();
    bg.beginFill(0xE8D5C0, 0.8);
    bg.drawCircle(0, 0, 16);
    bg.endFill();
    this._closeBtn.addChild(bg);

    const x = new PIXI.Text('✕', {
      fontSize: 16,
      fill: COLORS.TEXT_DARK,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    x.anchor.set(0.5, 0.5);
    this._closeBtn.addChild(x);

    this._closeBtn.position.set(DESIGN_WIDTH - 36, 24);
    this._closeBtn.eventMode = 'static';
    this._closeBtn.cursor = 'pointer';
    this._closeBtn.hitArea = new PIXI.Circle(0, 0, 22);
    this._closeBtn.on('pointerdown', () => this.close());
    this._panel.addChild(this._closeBtn);
  }

  private _buildScrollArea(): void {
    this._scrollContainer = new PIXI.Container();
    this._scrollContainer.position.set(0, 50);
    this._panel.addChild(this._scrollContainer);

    // 滚动区域遮罩
    this._scrollMask = new PIXI.Graphics();
    this._scrollMask.beginFill(0xFFFFFF);
    this._scrollMask.drawRect(10, 50, DESIGN_WIDTH - 20, PANEL_HEIGHT - 100);
    this._scrollMask.endFill();
    this._panel.addChild(this._scrollMask);
    this._scrollContainer.mask = this._scrollMask;
  }

  /** 打开面板，显示指定物品的合成链 */
  open(itemId: string): void {
    const chain = getMergeChain(itemId);
    if (chain.length === 0) return;

    this._isOpen = true;
    this.visible = true;

    // 收集当前棋盘上拥有的物品
    this._ownedItems.clear();
    for (const cell of BoardManager.cells) {
      if (cell.itemId) this._ownedItems.add(cell.itemId);
    }

    // 设置标题
    this._titleText.text = getMergeChainName(itemId);

    // 设置副标题
    const def = ITEM_DEFS.get(itemId);
    if (def && def.level >= def.maxLevel) {
      this._subtitleText.text = '✨ 已达到最高等级！';
    } else if (def) {
      const nextDef = chain[def.level] ? ITEM_DEFS.get(chain[def.level]) : null;
      this._subtitleText.text = nextDef
        ? `合成 2个 ${def.name} 可获得 ${nextDef.name}`
        : '';
    }

    // 渲染合成链
    this._renderChain(chain, itemId);

    // 入场动画
    this._overlay.alpha = 0;
    this._panel.position.y = Game.logicHeight;
    TweenManager.to({
      target: this._overlay,
      props: { alpha: 1 },
      duration: 0.2,
      ease: Ease.easeOutQuad,
    });
    TweenManager.to({
      target: this._panel.position,
      props: { y: Game.logicHeight - PANEL_HEIGHT },
      duration: 0.3,
      ease: Ease.easeOutBack,
    });
  }

  /** 关闭面板 */
  close(): void {
    if (!this._isOpen) return;
    this._isOpen = false;

    TweenManager.to({
      target: this._overlay,
      props: { alpha: 0 },
      duration: 0.2,
      ease: Ease.easeOutQuad,
    });
    TweenManager.to({
      target: this._panel.position,
      props: { y: Game.logicHeight },
      duration: 0.25,
      ease: Ease.easeInQuad,
      onComplete: () => {
        this.visible = false;
        this._clearChain();
      },
    });
  }

  get isOpen(): boolean { return this._isOpen; }

  /** 渲染合成链 */
  private _renderChain(chain: string[], currentItemId: string): void {
    this._clearChain();

    const totalCards = chain.length;
    const totalArrows = totalCards - 1;
    const contentW = totalCards * CARD_W + totalArrows * ARROW_W + (totalCards - 1) * CARD_GAP;
    const availW = DESIGN_WIDTH - 40;
    // 居中偏移
    const startX = Math.max(20, (DESIGN_WIDTH - contentW) / 2);
    const centerY = (PANEL_HEIGHT - 100) / 2;

    // 检查建筑材料满级转化
    const lastItem = ITEM_DEFS.get(chain[chain.length - 1]);
    let convertBuilding: string | null = null;
    if (lastItem && lastItem.category === Category.BUILDING_MAT) {
      for (const [bId, bDef] of BUILDING_DEFS) {
        if (bDef.requireMatId === lastItem.id) {
          convertBuilding = bId;
          break;
        }
      }
    }

    let x = startX;
    for (let i = 0; i < chain.length; i++) {
      const id = chain[i];
      const isCurrent = id === currentItemId;
      const card = this._createCard(id, isCurrent);
      card.position.set(x, centerY - CARD_H / 2);
      this._scrollContainer.addChild(card);
      x += CARD_W;

      // 箭头
      if (i < chain.length - 1) {
        const arrow = this._createArrow();
        arrow.position.set(x + CARD_GAP / 2 + ARROW_W / 2, centerY);
        this._scrollContainer.addChild(arrow);
        x += ARROW_W + CARD_GAP;
      }
    }

    // 建筑材料满级转化箭头+建筑图标
    if (convertBuilding) {
      x += CARD_GAP;
      const arrow = this._createConvertArrow();
      arrow.position.set(x + ARROW_W / 2, centerY);
      this._scrollContainer.addChild(arrow);
      x += ARROW_W + CARD_GAP;

      const bCard = this._createCard(convertBuilding, false, true);
      bCard.position.set(x, centerY - CARD_H / 2);
      this._scrollContainer.addChild(bCard);
    }

    // 如果内容超出可视区域，启用简单拖拽滚动
    const finalW = x + CARD_W + 20;
    if (finalW > availW) {
      this._enableScroll(finalW - availW);
    }
  }

  /** 创建单个物品卡片 */
  private _createCard(itemId: string, isCurrent: boolean, isBuilding = false): PIXI.Container {
    const card = new PIXI.Container();
    const def = ITEM_DEFS.get(itemId);
    if (!def) return card;

    const owned = this._ownedItems.has(itemId);
    const isMaxLevel = def.level >= def.maxLevel;

    // 卡片背景
    const bg = new PIXI.Graphics();
    if (isCurrent) {
      // 当前物品：金色高亮
      bg.lineStyle(3, 0xFFD700);
      bg.beginFill(0xFFF8DC);
    } else {
      bg.lineStyle(1.5, owned ? 0xD4C4B0 : 0xCCCCCC);
      bg.beginFill(owned ? 0xFFFEFC : 0xF0EDE8);
    }
    bg.drawRoundedRect(0, 0, CARD_W, CARD_H, 10);
    bg.endFill();
    card.addChild(bg);

    // 物品图标
    const iconSize = 40;
    const tex = TextureCache.get(def.icon);
    if (tex) {
      const sprite = new PIXI.Sprite(tex);
      const s = Math.min(iconSize / tex.width, iconSize / tex.height);
      sprite.scale.set(s);
      sprite.anchor.set(0.5, 0.5);
      sprite.position.set(CARD_W / 2, 30);
      if (!owned && !isCurrent) sprite.alpha = 0.5;
      card.addChild(sprite);
    } else {
      // Fallback: 圆形+emoji
      const circle = new PIXI.Graphics();
      const iconColor = this._getLineColor(def.line);
      circle.beginFill(iconColor, owned || isCurrent ? 0.3 : 0.15);
      circle.drawCircle(CARD_W / 2, 30, iconSize / 2 - 2);
      circle.endFill();
      card.addChild(circle);

      const emoji = new PIXI.Text(this._getCategoryEmoji(def.category), {
        fontSize: 18,
        fontFamily: FONT_FAMILY,
      });
      emoji.anchor.set(0.5, 0.5);
      emoji.position.set(CARD_W / 2, 28);
      if (!owned && !isCurrent) emoji.alpha = 0.5;
      card.addChild(emoji);
    }

    // 物品名称
    const name = new PIXI.Text(def.name.length > 4 ? def.name.substring(0, 4) : def.name, {
      fontSize: 11,
      fill: owned || isCurrent ? COLORS.TEXT_DARK : 0xAAAAAA,
      fontFamily: FONT_FAMILY,
      align: 'center',
    });
    name.anchor.set(0.5, 0);
    name.position.set(CARD_W / 2, 56);
    card.addChild(name);

    // 等级标签
    const lvText = isBuilding ? '建筑' : `Lv.${def.level}`;
    const lv = new PIXI.Text(lvText, {
      fontSize: 10,
      fill: isCurrent ? 0xCC8800 : COLORS.TEXT_LIGHT,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    lv.anchor.set(0.5, 0);
    lv.position.set(CARD_W / 2, 72);
    card.addChild(lv);

    // 满级皇冠
    if (isMaxLevel && !isBuilding) {
      const crown = new PIXI.Text('👑', { fontSize: 12, fontFamily: FONT_FAMILY });
      crown.anchor.set(0.5, 0.5);
      crown.position.set(CARD_W - 10, 10);
      card.addChild(crown);
    }

    // 当前标记
    if (isCurrent) {
      const marker = new PIXI.Text('▲当前', {
        fontSize: 9,
        fill: 0xCC8800,
        fontFamily: FONT_FAMILY,
        fontWeight: 'bold',
      });
      marker.anchor.set(0.5, 0);
      marker.position.set(CARD_W / 2, CARD_H - 2);
      card.addChild(marker);
    }

    return card;
  }

  /** 创建箭头 */
  private _createArrow(): PIXI.Container {
    const c = new PIXI.Container();
    const g = new PIXI.Graphics();
    // 花瓣形箭头
    g.lineStyle(2.5, 0xE8D5C0);
    g.moveTo(-8, 0);
    g.lineTo(6, 0);
    g.moveTo(3, -4);
    g.lineTo(8, 0);
    g.lineTo(3, 4);
    c.addChild(g);

    // ×2 标注
    const txt = new PIXI.Text('×2', {
      fontSize: 9,
      fill: COLORS.TEXT_LIGHT,
      fontFamily: FONT_FAMILY,
    });
    txt.anchor.set(0.5, 0);
    txt.position.set(0, 6);
    c.addChild(txt);

    return c;
  }

  /** 转化箭头（建筑材料→建筑） */
  private _createConvertArrow(): PIXI.Container {
    const c = new PIXI.Container();
    const g = new PIXI.Graphics();
    g.lineStyle(2.5, 0xB8860B);
    g.moveTo(-10, 0);
    g.lineTo(8, 0);
    g.moveTo(4, -5);
    g.lineTo(10, 0);
    g.lineTo(4, 5);
    c.addChild(g);

    const txt = new PIXI.Text('转化', {
      fontSize: 9,
      fill: 0xB8860B,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    txt.anchor.set(0.5, 0);
    txt.position.set(0, 7);
    c.addChild(txt);

    return c;
  }

  /** 简单的拖拽滚动 */
  private _enableScroll(maxOffset: number): void {
    let dragging = false;
    let startX = 0;
    let startScrollX = 0;

    this._scrollContainer.eventMode = 'static';
    this._scrollContainer.hitArea = new PIXI.Rectangle(0, 0, DESIGN_WIDTH, PANEL_HEIGHT - 100);

    this._scrollContainer.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      dragging = true;
      startX = e.global.x;
      startScrollX = this._scrollContainer.position.x;
    });
    this._scrollContainer.on('pointermove', (e: PIXI.FederatedPointerEvent) => {
      if (!dragging) return;
      const dx = e.global.x - startX;
      let newX = startScrollX + dx;
      newX = Math.max(-maxOffset, Math.min(0, newX));
      this._scrollContainer.position.x = newX;
    });
    this._scrollContainer.on('pointerup', () => { dragging = false; });
    this._scrollContainer.on('pointerupoutside', () => { dragging = false; });
  }

  private _clearChain(): void {
    while (this._scrollContainer.children.length > 0) {
      const child = this._scrollContainer.children[0];
      this._scrollContainer.removeChild(child);
      child.destroy({ children: true });
    }
    this._scrollContainer.position.x = 0;
    this._scrollContainer.eventMode = 'auto';
    this._scrollContainer.removeAllListeners();
  }

  private _getLineColor(line: string): number {
    const map: Record<string, number> = {
      daily: COLORS.FLOWER_DAILY,
      romantic: COLORS.FLOWER_ROMANTIC,
      luxury: COLORS.FLOWER_LUXURY,
      tea: COLORS.DRINK_TEA,
      cold: COLORS.DRINK_COLD,
      dessert: COLORS.DRINK_DESSERT,
    };
    return map[line] || 0x999999;
  }

  private _getCategoryEmoji(category: Category): string {
    switch (category) {
      case Category.FLOWER: return '🌸';
      case Category.DRINK: return '🍵';
      case Category.BUILDING_MAT: return '🧱';
      case Category.BUILDING: return '🏠';
      case Category.CHEST: return '📦';
      default: return '❓';
    }
  }
}
