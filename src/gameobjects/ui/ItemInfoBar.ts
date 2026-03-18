/**
 * 底部信息栏 - 参考四季物语底部布局
 *
 * ┌─────────────────────────────────────────────────────┐
 * │  [🏡]     点击任意物品查看详情               [📦]  │
 * │  装修      (选中后：物品名+描述+出售/合成线)  仓库  │
 * └─────────────────────────────────────────────────────┘
 */
import * as PIXI from 'pixi.js';
import { EventBus } from '@/core/EventBus';
import { TweenManager, Ease } from '@/core/TweenManager';
import { DESIGN_WIDTH, COLORS, FONT_FAMILY } from '@/config/Constants';
import { ITEM_DEFS, ItemDef, Category } from '@/config/ItemConfig';
import { BUILDING_DEFS } from '@/config/BuildingConfig';
import { CellState } from '@/config/BoardLayout';
import { BoardManager } from '@/managers/BoardManager';
import { DecorationManager } from '@/managers/DecorationManager';
import { TextureCache } from '@/utils/TextureCache';

/** 底部栏总高度（含安全区） */
export const INFO_BAR_HEIGHT = 100;


const SELL_BTN_W = 64;
const SELL_BTN_H = 36;

/** 侧边圆形按钮半径 */
const SIDE_BTN_R = 46;
/** 左右按钮的 x 边距（图标中心距边缘距离，留出与边界的空白） */
const SIDE_PAD = 58;

const SAFE_BOTTOM = 24;

export class ItemInfoBar extends PIXI.Container {
  private _bg!: PIXI.Graphics;
  private _actualHeight: number;
  /** 内容区垂直中心（考虑底部安全区） */
  private _contentCY: number;

  private _shopBtn!: PIXI.Container;
  private _shopRedDot!: PIXI.Graphics;
  private _warehouseBtn!: PIXI.Container;

  private _sellBtn!: PIXI.Container;
  private _chainBtn!: PIXI.Container;

  private _infoContainer!: PIXI.Container;
  private _nameText!: PIXI.Text;
  private _levelText!: PIXI.Text;
  private _descText!: PIXI.Text;

  private _hintContainer!: PIXI.Container;

  private _selectedItemId: string | null = null;
  private _selectedCellIndex = -1;

  constructor(actualHeight?: number) {
    super();
    this._actualHeight = actualHeight ?? INFO_BAR_HEIGHT;
    this._contentCY = (this._actualHeight - SAFE_BOTTOM) / 2;
    this._buildBg();
    this._buildShopBtn();
    this._buildWarehouseBtn();
    this._buildHintArea();
    this._buildInfoArea();
    this._buildChainBtn();
    this._buildSellBtn();
    this._bindEvents();

    this._infoContainer.visible = false;
    this._sellBtn.visible = false;
    this._chainBtn.visible = false;
    this._hintContainer.visible = true;
  }

  // ===================== 背景 =====================

  private _buildBg(): void {
    this._bg = new PIXI.Graphics();
    this._bg.beginFill(0x000000, 0.03);
    this._bg.drawRect(0, -3, DESIGN_WIDTH, 3);
    this._bg.endFill();
    this._bg.beginFill(0xFFF8F0, 0.97);
    this._bg.drawRect(0, 0, DESIGN_WIDTH, this._actualHeight);
    this._bg.endFill();
    this.addChild(this._bg);
  }

  // ===================== 左侧装修按钮 =====================

  private _buildShopBtn(): void {
    this._shopBtn = new PIXI.Container();
    const cx = SIDE_PAD;
    const cy = this._contentCY;

    const shopTex = TextureCache.get('icon_shop');
    if (shopTex) {
      const sprite = new PIXI.Sprite(shopTex);
      sprite.anchor.set(0.5);
      sprite.width = SIDE_BTN_R * 2;
      sprite.height = SIDE_BTN_R * 2;
      sprite.position.set(0, -2);
      this._shopBtn.addChild(sprite);
    } else {
      const circle = new PIXI.Graphics();
      circle.beginFill(0x8BC34A);
      circle.drawCircle(0, 0, SIDE_BTN_R);
      circle.endFill();
      this._shopBtn.addChild(circle);
      const icon = new PIXI.Text('🏡', { fontSize: 22 });
      icon.anchor.set(0.5, 0.5);
      this._shopBtn.addChild(icon);
    }

    // 红点
    this._shopRedDot = new PIXI.Graphics();
    this._shopRedDot.beginFill(0xFF3333);
    this._shopRedDot.drawCircle(SIDE_BTN_R - 2, -SIDE_BTN_R + 4, 5);
    this._shopRedDot.endFill();
    this._shopRedDot.lineStyle(1.5, 0xFFFFFF);
    this._shopRedDot.drawCircle(SIDE_BTN_R - 2, -SIDE_BTN_R + 4, 5);
    this._shopRedDot.visible = false;
    this._shopBtn.addChild(this._shopRedDot);

    this._shopBtn.position.set(cx, cy);
    this._shopBtn.eventMode = 'static';
    this._shopBtn.cursor = 'pointer';
    this._shopBtn.hitArea = new PIXI.Circle(0, 0, SIDE_BTN_R + 8);
    this._shopBtn.on('pointerdown', () => {
      this._playBtnBounce(this._shopBtn);
      EventBus.emit('scene:switchToShop');
    });
    this.addChild(this._shopBtn);
  }

  // ===================== 右侧仓库按钮 =====================

  private _buildWarehouseBtn(): void {
    this._warehouseBtn = new PIXI.Container();
    const cx = DESIGN_WIDTH - SIDE_PAD;
    const cy = this._contentCY;

    const chestTex = TextureCache.get('icon_basket');
    if (chestTex) {
      const sprite = new PIXI.Sprite(chestTex);
      sprite.anchor.set(0.5);
      sprite.width = SIDE_BTN_R * 2;
      sprite.height = SIDE_BTN_R * 2;
      sprite.position.set(0, -2);
      this._warehouseBtn.addChild(sprite);
    } else {
      const circle = new PIXI.Graphics();
      circle.beginFill(0x64B5F6);
      circle.drawCircle(0, 0, SIDE_BTN_R);
      circle.endFill();
      this._warehouseBtn.addChild(circle);
      const icon = new PIXI.Text('📦', { fontSize: 22 });
      icon.anchor.set(0.5, 0.5);
      this._warehouseBtn.addChild(icon);
    }

    this._warehouseBtn.position.set(cx, cy);
    this._warehouseBtn.eventMode = 'static';
    this._warehouseBtn.cursor = 'pointer';
    this._warehouseBtn.hitArea = new PIXI.Circle(0, 0, SIDE_BTN_R + 8);
    this._warehouseBtn.on('pointerdown', () => {
      this._playBtnBounce(this._warehouseBtn);
      EventBus.emit('nav:openWarehouse');
    });
    this.addChild(this._warehouseBtn);
  }

  // ===================== 中间默认提示区 =====================

  private _buildHintArea(): void {
    this._hintContainer = new PIXI.Container();

    const midL = SIDE_PAD + SIDE_BTN_R + 14;
    const midR = DESIGN_WIDTH - SIDE_PAD - SIDE_BTN_R - 14;
    const midW = midR - midL;
    const midH = 52;
    const cy = this._contentCY;

    const bg = new PIXI.Graphics();
    bg.beginFill(0xFFF5ED, 0.9);
    bg.drawRoundedRect(midL, cy - midH / 2, midW, midH, 14);
    bg.endFill();
    this._hintContainer.addChild(bg);

    const hint = new PIXI.Text('点击任意物品查看详情', {
      fontSize: 18,
      fill: 0xC0A898,
      fontFamily: FONT_FAMILY,
    });
    hint.anchor.set(0.5, 0.5);
    hint.position.set(midL + midW / 2, cy);
    this._hintContainer.addChild(hint);

    this.addChild(this._hintContainer);
  }

  // ===================== 物品信息区域 =====================

  private _buildInfoArea(): void {
    this._infoContainer = new PIXI.Container();

    const infoX = SIDE_PAD + SIDE_BTN_R + 20;
    const cy = this._contentCY;

    this._nameText = new PIXI.Text('', {
      fontSize: 18,
      fill: COLORS.TEXT_DARK,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    this._nameText.anchor.set(0, 0.5);
    this._nameText.position.set(infoX, cy - 12);
    this._infoContainer.addChild(this._nameText);

    this._levelText = new PIXI.Text('', {
      fontSize: 14,
      fill: COLORS.BUTTON_PRIMARY,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    this._levelText.anchor.set(0, 0.5);
    this._levelText.position.set(infoX, cy - 12);
    this._infoContainer.addChild(this._levelText);

    this._descText = new PIXI.Text('', {
      fontSize: 12,
      fill: COLORS.TEXT_LIGHT,
      fontFamily: FONT_FAMILY,
      wordWrap: true,
      wordWrapWidth: 320,
    });
    this._descText.anchor.set(0, 0.5);
    this._descText.position.set(infoX, cy + 12);
    this._infoContainer.addChild(this._descText);

    this.addChild(this._infoContainer);
  }

  // ===================== 合成线按钮 =====================

  private _buildChainBtn(): void {
    this._chainBtn = new PIXI.Container();
    const CHAIN_W = 66;
    const CHAIN_H = 34;
    const cx = DESIGN_WIDTH - SIDE_PAD - SIDE_BTN_R - 14 - SELL_BTN_W - 10 - CHAIN_W / 2;

    const bg = new PIXI.Graphics();
    bg.beginFill(0x8BB8D0);
    bg.drawRoundedRect(-CHAIN_W / 2, -CHAIN_H / 2, CHAIN_W, CHAIN_H, 10);
    bg.endFill();
    this._chainBtn.addChild(bg);

    const text = new PIXI.Text('合成线', {
      fontSize: 12, fill: 0xFFFFFF, fontFamily: FONT_FAMILY, fontWeight: 'bold',
    });
    text.anchor.set(0.5, 0.5);
    this._chainBtn.addChild(text);

    this._chainBtn.position.set(cx, this._contentCY);
    this._chainBtn.eventMode = 'static';
    this._chainBtn.cursor = 'pointer';
    this._chainBtn.hitArea = new PIXI.Rectangle(
      -CHAIN_W / 2 - 4, -CHAIN_H / 2 - 4, CHAIN_W + 8, CHAIN_H + 8,
    );
    this._chainBtn.on('pointerdown', () => this._onChainTap());
    this.addChild(this._chainBtn);
  }

  // ===================== 出售按钮 =====================

  private _buildSellBtn(): void {
    this._sellBtn = new PIXI.Container();
    const cx = DESIGN_WIDTH - SIDE_PAD - SIDE_BTN_R - 14 - SELL_BTN_W / 2;

    const bg = new PIXI.Graphics();
    bg.beginFill(0xFF8C69);
    bg.drawRoundedRect(-SELL_BTN_W / 2, -SELL_BTN_H / 2, SELL_BTN_W, SELL_BTN_H, 10);
    bg.endFill();
    this._sellBtn.addChild(bg);

    const text = new PIXI.Text('出售', {
      fontSize: 14, fill: 0xFFFFFF, fontFamily: FONT_FAMILY, fontWeight: 'bold',
    });
    text.anchor.set(0.5, 0.5);
    this._sellBtn.addChild(text);

    this._sellBtn.position.set(cx, this._contentCY);
    this._sellBtn.eventMode = 'static';
    this._sellBtn.cursor = 'pointer';
    this._sellBtn.hitArea = new PIXI.Rectangle(
      -SELL_BTN_W / 2 - 4, -SELL_BTN_H / 2 - 4, SELL_BTN_W + 8, SELL_BTN_H + 8,
    );
    this._sellBtn.on('pointerdown', () => this._onSellTap());
    this.addChild(this._sellBtn);
  }

  // ===================== 红点更新 =====================

  updateQuickBtnRedDots(): void {
    this._shopRedDot.visible = DecorationManager.hasAffordableNew();
  }

  // ===================== 事件 =====================

  private _bindEvents(): void {
    EventBus.on('board:itemSelected', (cellIndex: number, itemId: string | null) => {
      this._onItemSelected(cellIndex, itemId);
    });
    EventBus.on('board:selectionCleared', () => this._clearSelection());
    EventBus.on('board:merged', () => this._clearSelection());
    EventBus.on('board:moved', () => this._clearSelection());
    EventBus.on('board:itemRemoved', () => this._clearSelection());
    EventBus.on('board:itemSold', () => this._clearSelection());
  }

  // ===================== 选中逻辑 =====================

  private _onItemSelected(cellIndex: number, itemId: string | null): void {
    if (!itemId) { this._clearSelection(); return; }

    this._selectedItemId = itemId;
    this._selectedCellIndex = cellIndex;

    const def = ITEM_DEFS.get(itemId);
    if (!def) { this._clearSelection(); return; }

    this._nameText.text = def.name;
    this._levelText.text = ` Lv.${def.level}`;
    this._levelText.position.x = this._nameText.position.x + this._nameText.width + 4;
    this._descText.text = this._getDescription(def);

    this._infoContainer.visible = true;
    this._hintContainer.visible = false;

    const cell = BoardManager.getCellByIndex(cellIndex);
    const canSell = def.category !== Category.BUILDING
      && !!cell && cell.state === CellState.OPEN;
    this._sellBtn.visible = canSell;

    const showChain = def.category !== Category.BUILDING && def.maxLevel > 1;
    this._chainBtn.visible = showChain;

    this._infoContainer.alpha = 0;
    TweenManager.to({
      target: this._infoContainer,
      props: { alpha: 1 },
      duration: 0.2,
      ease: Ease.easeOutQuad,
    });
  }

  private _clearSelection(): void {
    this._selectedItemId = null;
    this._selectedCellIndex = -1;

    this._infoContainer.visible = false;
    this._sellBtn.visible = false;
    this._chainBtn.visible = false;
    this._hintContainer.visible = true;
  }

  private _getDescription(def: ItemDef): string {
    if (def.category === Category.BUILDING) {
      const bDef = BUILDING_DEFS.get(def.id);
      if (bDef) {
        return `⚡${bDef.staminaCost} | 冷却 ${bDef.cooldown}s | 产出 Lv.${bDef.produceLevelRange[0]}~${bDef.produceLevelRange[1]}`;
      }
      return '功能建筑';
    }
    if (def.category === Category.CHEST) return '点击开启，获得随机物品';
    if (def.level < def.maxLevel) return '合成后可获得更高级物品。';
    return '已达最高等级！可用于完成订单。';
  }

  // ===================== 按钮回调 =====================

  private _onSellTap(): void {
    if (this._selectedCellIndex < 0 || !this._selectedItemId) return;
    this._playBtnBounce(this._sellBtn);
    EventBus.emit('board:requestSell', this._selectedCellIndex, this._selectedItemId);
  }

  private _onChainTap(): void {
    if (!this._selectedItemId) return;
    this._playBtnBounce(this._chainBtn);
    EventBus.emit('mergeChain:open', this._selectedItemId);
  }

  private _playBtnBounce(btn: PIXI.Container): void {
    TweenManager.cancelTarget(btn.scale);
    btn.scale.set(0.85);
    TweenManager.to({
      target: btn.scale,
      props: { x: 1, y: 1 },
      duration: 0.2,
      ease: Ease.easeOutBack,
    });
  }
}
