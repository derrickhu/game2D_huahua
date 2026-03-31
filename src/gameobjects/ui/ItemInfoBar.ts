/**
 * 底部信息栏 — 奶油卡片 + 标题红彩带（item_info_title_ribbon，与装修面板解耦）+ 合成线/出售
 */
import * as PIXI from 'pixi.js';
import { EventBus } from '@/core/EventBus';
import { TweenManager, Ease } from '@/core/TweenManager';
import { DESIGN_WIDTH, COLORS, FONT_FAMILY } from '@/config/Constants';
import {
  ITEM_DEFS,
  ItemDef,
  Category,
  InteractType,
  FlowerLine,
  getMergeChain,
  isCrystalBallItem,
  isGoldenScissorsItem,
  isLuckyCoinItem,
} from '@/config/ItemConfig';
import { findBoardProducerDef } from '@/config/BuildingConfig';
import { CellState } from '@/config/BoardLayout';
import { BoardManager } from '@/managers/BoardManager';
import { ToolProducePolicy } from '@/managers/ToolProducePolicy';
import { DecorationManager } from '@/managers/DecorationManager';
import { TextureCache } from '@/utils/TextureCache';
import { getItemSellPrice } from '@/utils/ItemSellPrice';

export const INFO_BAR_HEIGHT = 112;

const SELL_BTN_W = 98;
const SELL_BTN_H = 56;
const CHAIN_W = 96;
const CHAIN_H = 48;
/** 卡片内右侧留给双按钮的列宽（含间距） */
const BTN_COL_W = CHAIN_W + SELL_BTN_W + 18;
/** 卡片相对「铺满左右按钮之间」再左右各缩进的像素 */
const CARD_SIDE_TRIM = 40;
/** 叶条最大宽度（仅占左上，不拉满卡片；加长右侧可让长标题+Lv 留在红带主体内） */
const LEAF_MAX_W = 380;
/** 叶形条向左超出卡片左金边的像素（文字仍排在卡片内） */
const LEAF_LEFT_OVERHANG = 32;
const SIDE_BTN_R = 46;
const SIDE_PAD = 58;
const SAFE_BOTTOM = 24;

const CARD_R = 16;
/** 叶条显示高度（与贴图缩放一致，上下留白让大字完全落在彩带区域内） */
const LEAF_TARGET_H = 62;
/** 标题文字右缘相对彩带贴图右缘的最小留白（避免 Lv 压到右侧卷边） */
const RIBBON_PAD_RIGHT = 52;
const LEAF_INSET_X = 10;
const GOLD_LINE = 0xe8c078;
const CREAM_FILL = 0xfff9ec;
const SHADOW_RGBA = 0x8b7355;

/** 叶形条矢量回退（细长双鼓形） */
function drawLeafTitleBar(g: PIXI.Graphics, w: number, h: number): void {
  const midY = h * 0.5;
  g.clear();
  g.lineStyle(2, 0x2d5a27, 0.9);
  g.beginFill(0x5fa85a, 1);
  g.moveTo(2, midY);
  g.bezierCurveTo(w * 0.22, -h * 0.35, w * 0.78, -h * 0.35, w - 2, midY);
  g.bezierCurveTo(w * 0.78, h + h * 0.35, w * 0.22, h + h * 0.35, 2, midY);
  g.endFill();
  g.lineStyle(1.5, 0x8fd67a, 0.5);
  g.moveTo(w * 0.12, midY);
  g.bezierCurveTo(w * 0.35, midY * 0.55, w * 0.55, midY * 0.5, w * 0.88, midY);
}

function drawCardChrome(shadow: PIXI.Graphics, card: PIXI.Graphics, x: number, y: number, w: number, h: number): void {
  shadow.clear();
  shadow.beginFill(SHADOW_RGBA, 0.18);
  shadow.drawRoundedRect(x + 3, y + 4, w, h, CARD_R);
  shadow.endFill();

  card.clear();
  card.lineStyle(2.5, GOLD_LINE, 0.95);
  card.beginFill(CREAM_FILL, 0.98);
  card.drawRoundedRect(x, y, w, h, CARD_R);
  card.endFill();
  card.lineStyle(1.2, 0xd4a84b, 0.55);
  card.drawRoundedRect(x + 3, y + 3, w - 6, h - 6, Math.max(10, CARD_R - 3));
}

/** 圆角立体按钮（阴影 + 主体 + 顶高光 + 底暗边） */
function drawStereoscopicRoundButton(
  g: PIXI.Graphics,
  w: number,
  h: number,
  r: number,
  baseMid: number,
  highlight: number,
  rimDark: number,
): void {
  const hw = w / 2;
  const hh = h / 2;
  g.clear();
  g.beginFill(0x000000, 0.22);
  g.drawRoundedRect(-hw + 1, -hh + 3, w, h, r);
  g.endFill();
  g.beginFill(rimDark, 1);
  g.drawRoundedRect(-hw, -hh, w, h, r);
  g.endFill();
  g.beginFill(baseMid, 1);
  g.drawRoundedRect(-hw + 1.5, -hh + 1.5, w - 3, h - 3, Math.max(4, r - 2));
  g.endFill();
  g.beginFill(highlight, 0.38);
  g.drawRoundedRect(-hw + 3, -hh + 3, w - 6, h * 0.42, Math.max(3, r - 3));
  g.endFill();
  g.lineStyle(1.2, 0xffffff, 0.45);
  g.drawRoundedRect(-hw + 2.5, -hh + 2.5, w - 5, h * 0.35, Math.max(3, r - 2));
  g.lineStyle(1, 0x000000, 0.12);
  g.drawRoundedRect(-hw + 1, -hh + 1, w - 2, h - 2, r - 1);
}

export class ItemInfoBar extends PIXI.Container {
  private _bg!: PIXI.Graphics;
  private _actualHeight: number;
  private _contentCY: number;

  private _shopBtn!: PIXI.Container;
  private _shopRedDot!: PIXI.Graphics;
  private _warehouseBtn!: PIXI.Container;

  private _sellBtn!: PIXI.Container;
  private _chainBtn!: PIXI.Container;
  private _sellPriceRow!: PIXI.Container;
  private _sellHuayuanSp!: PIXI.Sprite;
  private _sellPriceText!: PIXI.Text;

  private _hintContainer!: PIXI.Container;
  private _hintShadow!: PIXI.Graphics;
  private _hintCard!: PIXI.Graphics;

  private _infoContainer!: PIXI.Container;
  private _infoShadow!: PIXI.Graphics;
  private _infoCard!: PIXI.Graphics;
  private _leafStrip!: PIXI.Container;
  private _leafSprite: PIXI.Sprite | null = null;
  private _leafGfx!: PIXI.Graphics;
  private _nameText!: PIXI.Text;
  private _levelText!: PIXI.Text;
  private _descText!: PIXI.Text;
  /** 可产出工具 / 花束包装：仅显示体力图标 + 消耗文案 */
  private _staminaDescRow!: PIXI.Container;
  private _staminaEnergyIcon!: PIXI.Sprite;
  private _staminaDescLabel!: PIXI.Text;

  private _cardLeft = 0;
  private _cardTop = 0;
  private _cardW = 0;
  private _cardH = 0;
  /** 叶条实际绘制宽度（左上短条，非整卡宽） */
  private _leafDisplayW = 0;
  /** 按卡片宽度算出的彩带宽度下限（选中物品时会按标题再放宽） */
  private _leafDisplayWMin = 168;

  private _selectedItemId: string | null = null;
  private _selectedCellIndex = -1;

  constructor(actualHeight?: number) {
    super();
    this._actualHeight = actualHeight ?? INFO_BAR_HEIGHT;
    this._contentCY = (this._actualHeight - SAFE_BOTTOM) / 2;
    this._buildBg();
    this._buildShopBtn();
    this._buildWarehouseBtn();
    this._layoutMetrics();
    this._buildHintArea();
    this._buildInfoArea();
    this._buildChainBtn();
    this._buildSellBtn();
    this._layoutActionButtons();
    this._bindEvents();

    this._infoContainer.visible = false;
    this._sellBtn.visible = false;
    this._chainBtn.visible = false;
    this._hintContainer.visible = true;
  }

  private _layoutMetrics(): void {
    const midL = SIDE_PAD + SIDE_BTN_R + 8;
    const cardRightEdge = DESIGN_WIDTH - SIDE_PAD - SIDE_BTN_R - 10;
    const fullSpan = cardRightEdge - midL;
    this._cardLeft = midL + CARD_SIDE_TRIM;
    this._cardW = Math.max(208, fullSpan - CARD_SIDE_TRIM * 2);
    const innerH = this._actualHeight - SAFE_BOTTOM - 8;
    this._cardH = Math.min(108, Math.max(82, innerH - 4));
    this._cardTop = (this._actualHeight - SAFE_BOTTOM - this._cardH) / 2;
    this._leafDisplayWMin = Math.min(
      LEAF_MAX_W,
      Math.max(168, Math.floor(this._cardW * 0.58)),
    );
    this._leafDisplayW = this._leafDisplayWMin;
  }

  private _buildBg(): void {
    this._bg = new PIXI.Graphics();
    this._bg.beginFill(0xC8B8A0, 0.6);
    this._bg.drawRect(0, -2.5, DESIGN_WIDTH, 2.5);
    this._bg.endFill();
    this._bg.beginFill(0xfff0d0, 0.97);
    this._bg.drawRect(0, 0, DESIGN_WIDTH, this._actualHeight);
    this._bg.endFill();
    this.addChild(this._bg);
  }

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
      circle.beginFill(0x8bc34a);
      circle.drawCircle(0, 0, SIDE_BTN_R);
      circle.endFill();
      this._shopBtn.addChild(circle);
      const icon = new PIXI.Text('🏡', { fontSize: 22 });
      icon.anchor.set(0.5, 0.5);
      this._shopBtn.addChild(icon);
    }

    this._shopRedDot = new PIXI.Graphics();
    this._shopRedDot.beginFill(0xff3333);
    this._shopRedDot.drawCircle(SIDE_BTN_R - 2, -SIDE_BTN_R + 4, 5);
    this._shopRedDot.endFill();
    this._shopRedDot.lineStyle(1.5, 0xffffff);
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
      circle.beginFill(0x64b5f6);
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

  private _buildHintArea(): void {
    this._hintContainer = new PIXI.Container();
    this._hintShadow = new PIXI.Graphics();
    this._hintCard = new PIXI.Graphics();
    drawCardChrome(this._hintShadow, this._hintCard, this._cardLeft, this._cardTop, this._cardW, this._cardH);
    this._hintContainer.addChild(this._hintShadow);
    this._hintContainer.addChild(this._hintCard);

    const hint = new PIXI.Text('点击任意物品查看详情', {
      fontSize: 22,
      fill: COLORS.TEXT_LIGHT,
      fontFamily: FONT_FAMILY,
    });
    hint.anchor.set(0.5, 0.5);
    hint.position.set(this._cardLeft + this._cardW / 2, this._cardTop + this._cardH / 2);
    this._hintContainer.addChild(hint);

    this.addChild(this._hintContainer);
  }

  private _syncLeafStrip(): void {
    const leafX = LEAF_INSET_X;
    const leafY = 4;
    const lw = this._leafDisplayW;
    const tex = TextureCache.get('item_info_title_ribbon');
    this._leafGfx.visible = false;
    if (this._leafSprite) {
      this._leafSprite.visible = false;
    }

    if (tex && tex.width > 0) {
      if (!this._leafSprite) {
        this._leafSprite = new PIXI.Sprite(tex);
        this._leafStrip.addChildAt(this._leafSprite, 0);
      }
      const sp = this._leafSprite;
      sp.texture = tex;
      sp.visible = true;
      sp.anchor.set(0, 0);
      sp.position.set(leafX, leafY);
      sp.scale.set(lw / tex.width, LEAF_TARGET_H / tex.height);
    } else {
      this._leafGfx.visible = true;
      this._leafGfx.position.set(leafX, leafY);
      drawLeafTitleBar(this._leafGfx, lw, LEAF_TARGET_H);
    }
  }

  private _buildInfoArea(): void {
    this._infoContainer = new PIXI.Container();

    this._infoShadow = new PIXI.Graphics();
    this._infoCard = new PIXI.Graphics();
    drawCardChrome(this._infoShadow, this._infoCard, this._cardLeft, this._cardTop, this._cardW, this._cardH);
    this._infoContainer.addChild(this._infoShadow);
    this._infoContainer.addChild(this._infoCard);

    this._leafStrip = new PIXI.Container();
    this._leafStrip.position.set(this._cardLeft - LEAF_LEFT_OVERHANG, this._cardTop - 10);
    this._leafGfx = new PIXI.Graphics();
    this._leafStrip.addChild(this._leafGfx);
    this._syncLeafStrip();
    this._infoContainer.addChild(this._leafStrip);

    const titleY =
      this._cardTop - 6 + LEAF_TARGET_H * 0.5;
    this._nameText = new PIXI.Text('', {
      fontSize: 24,
      fill: 0xffffff,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: 0x6b1818,
      strokeThickness: 4,
    });
    this._nameText.anchor.set(0, 0.5);
    this._nameText.position.set(this._cardLeft + 30, titleY);
    this._infoContainer.addChild(this._nameText);

    this._levelText = new PIXI.Text('', {
      fontSize: 19,
      fill: 0xfff8dc,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: 0x5c1a1a,
      strokeThickness: 3,
    });
    this._levelText.anchor.set(0, 0.5);
    this._levelText.position.set(this._cardLeft + 30, titleY);
    this._infoContainer.addChild(this._levelText);

    const descTop = this._cardTop + LEAF_TARGET_H + 4;
    this._descText = new PIXI.Text('', {
      fontSize: 17,
      fill: COLORS.TEXT_DARK,
      fontFamily: FONT_FAMILY,
      wordWrap: true,
      wordWrapWidth: Math.max(80, this._cardW - 20 - BTN_COL_W),
    });
    this._descText.anchor.set(0, 0);
    this._descText.position.set(this._cardLeft + 10, descTop);
    this._infoContainer.addChild(this._descText);

    this._staminaDescRow = new PIXI.Container();
    this._staminaDescRow.position.set(this._cardLeft + 10, descTop + 2);
    this._staminaDescRow.visible = false;
    const enT = TextureCache.get('icon_energy');
    this._staminaEnergyIcon = new PIXI.Sprite(enT && enT.width > 0 ? enT : PIXI.Texture.EMPTY);
    this._staminaEnergyIcon.anchor.set(0, 0.5);
    if (enT && enT.width > 0) {
      const sc = 24 / Math.max(enT.width, enT.height);
      this._staminaEnergyIcon.scale.set(sc);
    }
    this._staminaEnergyIcon.position.set(0, 10);
    this._staminaDescRow.addChild(this._staminaEnergyIcon);
    this._staminaDescLabel = new PIXI.Text('', {
      fontSize: 17,
      fill: COLORS.TEXT_DARK,
      fontFamily: FONT_FAMILY,
    });
    this._staminaDescLabel.anchor.set(0, 0.5);
    this._staminaDescLabel.position.set(30, 10);
    this._staminaDescRow.addChild(this._staminaDescLabel);
    this._infoContainer.addChild(this._staminaDescRow);

    this.addChild(this._infoContainer);
  }

  /** 合成线 / 出售放在奶油卡片内右下角（初值，选中时会再算） */
  private _layoutActionButtons(): void {
    this._syncActionButtonPositions(true, true);
  }

  private _syncActionButtonPositions(showChain: boolean, canSell: boolean): void {
    const padR = 8;
    const padB = 6;
    const sellY = this._cardTop + this._cardH - padB - SELL_BTN_H / 2;
    const rightX = this._cardLeft + this._cardW - padR;

    if (showChain && canSell) {
      const sellX = rightX - SELL_BTN_W / 2;
      const chainX = sellX - SELL_BTN_W / 2 - 6 - CHAIN_W / 2;
      this._sellBtn.position.set(sellX, sellY);
      this._chainBtn.position.set(chainX, sellY);
    } else if (canSell) {
      this._sellBtn.position.set(rightX - SELL_BTN_W / 2, sellY);
    } else if (showChain) {
      this._chainBtn.position.set(rightX - CHAIN_W / 2, sellY);
    }
  }

  private _buildChainBtn(): void {
    this._chainBtn = new PIXI.Container();

    const bg = new PIXI.Graphics();
    drawStereoscopicRoundButton(
      bg,
      CHAIN_W,
      CHAIN_H,
      14,
      0x7ecbc4,
      0xc5fff8,
      0x4a9490,
    );
    this._chainBtn.addChild(bg);

    const text = new PIXI.Text('查看', {
      fontSize: 17,
      fill: 0xffffff,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: 0x2d5a55,
      strokeThickness: 3,
    });
    text.anchor.set(0.5, 0.5);
    this._chainBtn.addChild(text);

    this._chainBtn.eventMode = 'static';
    this._chainBtn.cursor = 'pointer';
    this._chainBtn.hitArea = new PIXI.Rectangle(
      -CHAIN_W / 2 - 4, -CHAIN_H / 2 - 4, CHAIN_W + 8, CHAIN_H + 8,
    );
    this._chainBtn.on('pointerdown', () => this._onChainTap());
    this._infoContainer.addChild(this._chainBtn);
  }

  /** 花愿图标 + 数字在出售钮内水平居中 */
  private _layoutSellPriceRow(): void {
    const hy = this._sellHuayuanSp;
    const hasIcon = hy.visible && hy.texture && hy.texture.width > 0;
    const iw = hasIcon ? hy.width : 0;
    const gap = hasIcon ? 4 : 0;
    const tw = this._sellPriceText.width;
    const total = iw + gap + tw;
    let x = -total / 2;
    if (hasIcon) {
      hy.position.set(x + iw / 2, 0);
      x += iw + gap;
    }
    this._sellPriceText.position.set(x, 0);
  }

  private _buildSellBtn(): void {
    this._sellBtn = new PIXI.Container();

    const bg = new PIXI.Graphics();
    drawStereoscopicRoundButton(
      bg,
      SELL_BTN_W,
      SELL_BTN_H,
      16,
      0x7fe86f,
      0xd8ffc8,
      0x43a047,
    );
    this._sellBtn.addChild(bg);

    const text = new PIXI.Text('出售', {
      fontSize: 17,
      fill: 0xffffff,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: 0x1b5e20,
      strokeThickness: 3,
    });
    text.anchor.set(0.5, 0.5);
    text.position.set(0, -11);
    this._sellBtn.addChild(text);

    this._sellPriceRow = new PIXI.Container();
    this._sellPriceRow.position.set(0, 14);
    const hyTex = TextureCache.get('icon_huayuan');
    this._sellHuayuanSp = new PIXI.Sprite(hyTex ?? PIXI.Texture.EMPTY);
    this._sellHuayuanSp.anchor.set(0.5, 0.5);
    if (hyTex && hyTex.width > 0) {
      const side = 26;
      const s = side / Math.max(hyTex.width, hyTex.height);
      this._sellHuayuanSp.scale.set(s);
    }
    this._sellPriceRow.addChild(this._sellHuayuanSp);

    this._sellPriceText = new PIXI.Text('', {
      fontSize: 16,
      fill: 0xfffde7,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: 0x3e2723,
      strokeThickness: 3,
    });
    this._sellPriceText.anchor.set(0, 0.5);
    this._sellPriceRow.addChild(this._sellPriceText);
    this._sellBtn.addChild(this._sellPriceRow);

    this._sellBtn.eventMode = 'static';
    this._sellBtn.cursor = 'pointer';
    this._sellBtn.hitArea = new PIXI.Rectangle(
      -SELL_BTN_W / 2 - 4, -SELL_BTN_H / 2 - 4, SELL_BTN_W + 8, SELL_BTN_H + 8,
    );
    this._sellBtn.on('pointerdown', () => this._onSellTap());
    this._infoContainer.addChild(this._sellBtn);
  }

  updateQuickBtnRedDots(): void {
    this._shopRedDot.visible = DecorationManager.hasAffordableNew();
  }

  private _bindEvents(): void {
    EventBus.on('board:itemSelected', (cellIndex: number, itemId: string | null) => {
      this._onItemSelected(cellIndex, itemId);
    });
    EventBus.on('board:selectionCleared', () => this._clearSelection());
    EventBus.on('board:merged', () => this._clearSelection());
    EventBus.on('board:moved', () => this._clearSelection());
    EventBus.on('board:itemRemoved', () => this._clearSelection());
    EventBus.on('board:itemSold', () => this._clearSelection());
    EventBus.on('toolproduce:policyChanged', () => this._refreshToolStaminaLabel());
  }

  /** 全局工具体力倍率变化时刷新底栏文案（不重播入场动画） */
  private _refreshToolStaminaLabel(): void {
    if (this._selectedCellIndex < 0 || !this._selectedItemId) return;
    const def = ITEM_DEFS.get(this._selectedItemId);
    if (!def) return;
    const producerDef = findBoardProducerDef(def.id);
    if (def.interactType !== InteractType.TOOL || !producerDef?.canProduce) return;
    if (!this._staminaDescRow.visible) return;
    const cost = ToolProducePolicy.getEffectiveStaminaCost(producerDef.staminaCost);
    this._staminaDescLabel.text = `消耗体力 ${cost}`;
  }

  private _onItemSelected(cellIndex: number, itemId: string | null): void {
    if (!itemId) {
      this._clearSelection();
      return;
    }

    this._selectedItemId = itemId;
    this._selectedCellIndex = cellIndex;

    const def = ITEM_DEFS.get(itemId);
    if (!def) {
      this._clearSelection();
      return;
    }

    this._nameText.text = def.name;
    this._levelText.text = `Lv.${def.level}`;
    this._levelText.position.x = this._nameText.position.x + this._nameText.width + 6;
    const ribbonLeftWorld = this._cardLeft - LEAF_LEFT_OVERHANG + LEAF_INSET_X;
    const titleRightWorld =
      this._levelText.position.x + this._levelText.width;
    const neededRibbonW = Math.ceil(
      titleRightWorld + RIBBON_PAD_RIGHT - ribbonLeftWorld,
    );
    this._leafDisplayW = Math.min(
      LEAF_MAX_W,
      Math.max(this._leafDisplayWMin, neededRibbonW),
    );

    const cell = BoardManager.getCellByIndex(cellIndex);
    const producerDef = findBoardProducerDef(def.id);
    const showStaminaRow = def.interactType === InteractType.TOOL && !!producerDef?.canProduce;

    if (showStaminaRow) {
      const cost = ToolProducePolicy.getEffectiveStaminaCost(producerDef!.staminaCost);
      this._descText.visible = false;
      this._staminaDescRow.visible = true;
      this._staminaDescLabel.text = `消耗体力 ${cost}`;
    } else {
      this._descText.visible = true;
      this._staminaDescRow.visible = false;
      this._descText.text = this._getDescription(def);
    }

    const canSell = !!cell && cell.state === CellState.OPEN && def.sellable;
    this._sellBtn.visible = canSell;
    if (canSell) {
      const price = getItemSellPrice(def);
      const hyTex = TextureCache.get('icon_huayuan');
      this._sellHuayuanSp.visible = price > 0 && !!(hyTex && hyTex.width > 0);
      this._sellPriceText.text = price > 0 ? String(price) : '腾格';
      this._layoutSellPriceRow();
    } else {
      this._sellPriceText.text = '';
    }

    const showChain = getMergeChain(def.id).length > 1;
    this._chainBtn.visible = showChain;

    const descReserveW =
      showChain && canSell
        ? BTN_COL_W
        : showChain || canSell
          ? Math.max(CHAIN_W, SELL_BTN_W) + 24
          : 20;
    this._descText.style.wordWrapWidth = Math.max(72, this._cardW - 20 - descReserveW);

    this._syncActionButtonPositions(showChain, canSell);

    this._syncLeafStrip();

    this._infoContainer.visible = true;
    this._hintContainer.visible = false;

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
    this._staminaDescRow.visible = false;
    this._descText.visible = true;
    this._hintContainer.visible = true;
  }

  private _getDescription(def: ItemDef): string {
    if (isLuckyCoinItem(def.id)) {
      return '拖到鲜花或饮品上试试，会有惊喜。';
    }
    if (isCrystalBallItem(def.id)) {
      return '拖到鲜花或饮品上，确认后可稳定升一级（满级不可用）。';
    }
    if (isGoldenScissorsItem(def.id)) {
      return '拖到 2 级及以上的鲜花或饮品上，确认后拆成两个低一级的同线物品。';
    }
    if (def.interactType === InteractType.TOOL) {
      const pd = findBoardProducerDef(def.id);
      if (pd && !pd.canProduce) return '合成后可获得更高级物品。';
      if (pd?.canProduce) return '';
      return '工具';
    }
    if (def.interactType === InteractType.CHEST) {
      return '点击开启，宝物散落棋盘';
    }
    if (def.category === Category.FLOWER && def.line === FlowerLine.WRAP) {
      return '包装中间材，合成用，不进入订单。';
    }
    if (def.level < def.maxLevel) return '合成后可获得更高级物品。';
    return '已达最高等级！可用于完成订单。';
  }

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
