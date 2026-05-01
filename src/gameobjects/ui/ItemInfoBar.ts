/**
 * 底部信息栏 — 奶油卡片 + 标题红彩带（item_info_title_ribbon，与装修面板解耦）+ 合成线/出售
 *
 * 语义：左下按钮为「进屋 / 花店装修场景」，不是内购商店；购买物品商店仅顶栏胶囊（panel:openMerchShop）。
 *
 * 可产出工具处于 **CD** 时，原「出售 / 腾格」位改为 **加速**（占位：看广告清 CD）。可监听
 * `board:requestToolCdAdAccelerate`（cellIndex, itemId）接入激励视频后再由 BuildingManager 等清 CD。
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
import { MERGE_BUBBLE_DISPLAY_NAME } from '@/config/MergeCompanionConfig';
import { CellState } from '@/config/BoardLayout';
import { BoardManager } from '@/managers/BoardManager';
import { BuildingManager } from '@/managers/BuildingManager';
import { AdManager, AdScene } from '@/managers/AdManager';
import {
  MergeCompanionManager,
  type MergeCompanionFloatBubble,
} from '@/managers/MergeCompanionManager';
import { ConfirmDialog } from './ConfirmDialog';
import { ToastMessage } from './ToastMessage';
import { ToolProducePolicy } from '@/managers/ToolProducePolicy';
import { DecorationManager } from '@/managers/DecorationManager';
import { TextureCache } from '@/utils/TextureCache';
import { getItemSellPrice } from '@/utils/ItemSellPrice';
import { createAdIcon } from '@/gameobjects/ui/AdBadge';

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
/** 左下花店入口红点半径（与左侧任务列红点比例接近） */
const HOUSE_RED_DOT_R = 8;
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

  /** 左下：进入花店/房屋（scene:switchToShop），勿与顶栏购买商店混淆 */
  private _houseBtn!: PIXI.Container;
  /** 花店门面图标（与红点分离，可单独呼吸缩放） */
  private _houseVisual!: PIXI.Container;
  private _houseRedDot!: PIXI.Graphics;
  private _houseAffordBreathPhase = 0;
  private _warehouseBtn!: PIXI.Container;

  private _sellBtn!: PIXI.Container;
  /** 出售 / 加速 共用钮底色（CD 时换琥珀色） */
  private _sellBtnBg!: PIXI.Graphics;
  private _sellBtnTitle!: PIXI.Text;
  /** true：当前显示「加速」占位（工具 CD 中），点击走广告预留而非出售 */
  private _sellAccelerateMode = false;
  private _chainBtn!: PIXI.Container;
  private _chainBtnLabel!: PIXI.Text;
  private _sellPriceRow!: PIXI.Container;
  private _sellHuayuanSp!: PIXI.Sprite;
  private _sellAdIcon!: PIXI.Container;
  private _sellPriceText!: PIXI.Text;
  private _lastSellTitleText = '出售';
  private _lastSellTitleStroke = 0x1b5e20;
  private _lastSellPriceText = '';
  private _lastSellHuayuanVisible = false;

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
  /** 底部栏展示合成气泡说明时 */
  private _selectedMergeBubbleId: string | null = null;
  /** 气泡「换花愿移除」入口（原在棋盘上，现仅底栏） */
  private _bubbleDismissLink!: PIXI.Text;

  constructor(actualHeight?: number) {
    super();
    this._actualHeight = actualHeight ?? INFO_BAR_HEIGHT;
    this._contentCY = (this._actualHeight - SAFE_BOTTOM) / 2;
    this._buildBg();
    this._buildHouseBtn();
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

  /**
   * 左下进屋：仍用花店门面原图（TextureCache `icon_enter_house`），
   * 仅文件名与语义和顶栏「内购商店」区分。
   */
  private _buildHouseBtn(): void {
    this._houseBtn = new PIXI.Container();
    this._houseVisual = new PIXI.Container();
    const cx = SIDE_PAD;
    const cy = this._contentCY;

    const houseTex = TextureCache.get('icon_enter_house');
    if (houseTex) {
      const sprite = new PIXI.Sprite(houseTex);
      sprite.anchor.set(0.5);
      sprite.width = SIDE_BTN_R * 2;
      sprite.height = SIDE_BTN_R * 2;
      sprite.position.set(0, -2);
      this._houseVisual.addChild(sprite);
    } else {
      const circle = new PIXI.Graphics();
      circle.beginFill(0xffb74d);
      circle.lineStyle(2.2, 0xf57c00, 0.85);
      circle.drawCircle(0, 0, SIDE_BTN_R);
      circle.endFill();
      this._houseVisual.addChild(circle);
      const icon = new PIXI.Text('店', { fontSize: 22, fontFamily: FONT_FAMILY, fill: 0xffffff });
      icon.anchor.set(0.5, 0.5);
      icon.position.set(0, -1);
      this._houseVisual.addChild(icon);
    }

    this._houseBtn.addChild(this._houseVisual);

    const hrdx = SIDE_BTN_R - 3;
    const hrdy = -SIDE_BTN_R + 5;
    this._houseRedDot = new PIXI.Graphics();
    this._houseRedDot.beginFill(0xff3333);
    this._houseRedDot.drawCircle(hrdx, hrdy, HOUSE_RED_DOT_R);
    this._houseRedDot.endFill();
    this._houseRedDot.lineStyle(2, 0xffffff);
    this._houseRedDot.drawCircle(hrdx, hrdy, HOUSE_RED_DOT_R);
    this._houseRedDot.visible = false;
    this._houseBtn.addChild(this._houseRedDot);

    this._houseBtn.position.set(cx, cy);
    this._houseBtn.eventMode = 'static';
    this._houseBtn.cursor = 'pointer';
    this._houseBtn.hitArea = new PIXI.Circle(0, 0, SIDE_BTN_R + 8);
    this._houseBtn.on('pointerdown', () => {
      this._playBtnBounce(this._houseVisual);
      EventBus.emit('scene:switchToShop');
    });
    this.addChild(this._houseBtn);
  }

  /**
   * 左下「进屋 / 花店」按钮外接正方形（相对本栏容器坐标），供主场景新手引导镂空与气泡对齐。
   */
  getHouseButtonSpotlightRectLocal(): { x: number; y: number; w: number; h: number } {
    const cx = this._houseBtn.x;
    const cy = this._houseBtn.y;
    const pad = 10;
    const ext = SIDE_BTN_R + pad;
    return { x: cx - ext, y: cy - ext, w: ext * 2, h: ext * 2 };
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
      const icon = new PIXI.Text('仓', { fontSize: 18, fontFamily: FONT_FAMILY, fill: 0xffffff });
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

    this._bubbleDismissLink = new PIXI.Text('', {
      fontSize: 15,
      fill: 0x2e7d32,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    this._bubbleDismissLink.visible = false;
    this._bubbleDismissLink.eventMode = 'static';
    this._bubbleDismissLink.cursor = 'pointer';
    this._bubbleDismissLink.on('pointertap', e => {
      e.stopPropagation();
      void this._onMergeBubbleDismissTap();
    });
    this._infoContainer.addChild(this._bubbleDismissLink);

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

    this._chainBtnLabel = new PIXI.Text('查看', {
      fontSize: 17,
      fill: 0xffffff,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: 0x2d5a55,
      strokeThickness: 3,
    });
    this._chainBtnLabel.anchor.set(0.5, 0.5);
    this._chainBtn.addChild(this._chainBtnLabel);

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
    const ad = this._sellAdIcon;
    const hasIcon = hy.visible && hy.texture && hy.texture.width > 0;
    const hasAdIcon = ad.visible;
    const iw = hasIcon ? hy.width : 0;
    const aw = hasAdIcon ? ad.width : 0;
    const gap = hasIcon || hasAdIcon ? 4 : 0;
    const tw = this._sellPriceText.width;
    const total = iw + (hasIcon ? gap : 0) + tw + (hasAdIcon ? gap + aw : 0);
    let x = -total / 2;
    if (hasIcon) {
      hy.position.set(x + iw / 2, 0);
      x += iw + gap;
    }
    this._sellPriceText.position.set(x, 0);
    x += tw + gap;
    if (hasAdIcon) {
      ad.position.set(x + aw / 2, 0);
    }
  }

  /** 出售=绿；工具 CD 加速占位=琥珀 */
  private _paintSellBtnChrome(accelerate: boolean): void {
    if (accelerate) {
      drawStereoscopicRoundButton(
        this._sellBtnBg,
        SELL_BTN_W,
        SELL_BTN_H,
        16,
        0xffb74d,
        0xffe0b2,
        0xe65100,
      );
    } else {
      drawStereoscopicRoundButton(
        this._sellBtnBg,
        SELL_BTN_W,
        SELL_BTN_H,
        16,
        0x7fe86f,
        0xd8ffc8,
        0x43a047,
      );
    }
  }

  private _buildSellBtn(): void {
    this._sellBtn = new PIXI.Container();

    this._sellBtnBg = new PIXI.Graphics();
    this._paintSellBtnChrome(false);
    this._sellBtn.addChild(this._sellBtnBg);

    this._sellBtnTitle = new PIXI.Text('出售', {
      fontSize: 17,
      fill: 0xffffff,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: 0x1b5e20,
      strokeThickness: 3,
    });
    this._sellBtnTitle.anchor.set(0.5, 0.5);
    this._sellBtnTitle.position.set(0, -11);
    this._sellBtn.addChild(this._sellBtnTitle);

    this._sellPriceRow = new PIXI.Container();
    this._sellPriceRow.position.set(0, 14);
    const hyTex = TextureCache.get('icon_huayuan');
    this._sellHuayuanSp = new PIXI.Sprite(hyTex ?? PIXI.Texture.EMPTY);
    this._sellHuayuanSp.anchor.set(0.5, 0.5);
    /** 与 `_lastSellHuayuanVisible = false` 一致；若默认可见而缓存为 false，首次进「免费加速」时不会关图标 */
    this._sellHuayuanSp.visible = false;
    if (hyTex && hyTex.width > 0) {
      const side = 26;
      const s = side / Math.max(hyTex.width, hyTex.height);
      this._sellHuayuanSp.scale.set(s);
    }
    this._sellPriceRow.addChild(this._sellHuayuanSp);

    this._sellAdIcon = createAdIcon(17);
    this._sellAdIcon.visible = false;
    this._sellPriceRow.addChild(this._sellAdIcon);

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
    this._houseRedDot.visible = DecorationManager.hasAffordableNew();
  }

  /**
   * 有可负担的新家具时：花店图标（不含红点）呼吸缩放，与左侧任务入口一致节奏。
   */
  tickHouseShopAffordHint(dt: number): void {
    if (!this._houseVisual || this._houseVisual.destroyed) return;
    const afford = DecorationManager.hasAffordableNew();
    if (!afford) {
      this._houseAffordBreathPhase = 0;
      this._houseVisual.scale.set(1);
      return;
    }
    this._houseAffordBreathPhase += (Math.PI * 2 * dt) / 2.35;
    const s = 1 + Math.sin(this._houseAffordBreathPhase) * 0.06;
    this._houseVisual.scale.set(s);
  }

  /** 主循环：气泡消失时清底栏选中态（倒计时在棋盘 HUD） */
  tickMergeBubbleCountdown(): void {
    if (!this._selectedMergeBubbleId) return;
    if (!MergeCompanionManager.getFloatBubble(this._selectedMergeBubbleId)) {
      this._clearSelection();
    }
  }

  private _bindEvents(): void {
    EventBus.on('mergeCompanion:bubbleSelected', (id: string) => {
      this._onMergeBubbleSelected(id);
    });
    EventBus.on('mergeCompanion:bubbleDeselect', () => {
      if (!this._selectedMergeBubbleId) return;
      this._selectedMergeBubbleId = null;
      this._chainBtnLabel.text = '查看';
      if (!this._selectedItemId) {
        this._clearSelection();
      }
    });
    EventBus.on('mergeCompanion:changed', () => {
      this._refreshSelectedBubblePanel();
    });
    EventBus.on('board:itemSelected', (cellIndex: number, itemId: string | null) => {
      this._onItemSelected(cellIndex, itemId);
    });
    EventBus.on('board:selectionCleared', () => this._clearSelection());
    EventBus.on('board:merged', () => this._clearSelection());
    EventBus.on('board:moved', () => this._clearSelection());
    EventBus.on('board:itemRemoved', () => this._clearSelection());
    EventBus.on('board:itemSold', () => this._clearSelection());
    EventBus.on('toolproduce:policyChanged', () => this._refreshToolStaminaLabel());
    EventBus.on('collection:discovered', () => this.updateQuickBtnRedDots());
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

  /** 主循环调用：选中工具时 CD 结束需从「加速」切回普通状态，无需重点格子。 */
  tickSelectedToolCooldownUi(): void {
    if (!this._infoContainer.visible || this._selectedCellIndex < 0 || !this._selectedItemId) return;
    const def = ITEM_DEFS.get(this._selectedItemId);
    if (!def) return;
    const cell = BoardManager.getCellByIndex(this._selectedCellIndex);
    if (!cell) return;
    if (cell.state === CellState.FOG || cell.state === CellState.PEEK) return;
    this._applySellButtonState(def, cell);
  }

  /** 右下角出售钮：工具 CD 中改为加速占位，否则按 sellable 显示出售 */
  private _applySellButtonState(def: ItemDef, cell: NonNullable<ReturnType<typeof BoardManager.getCellByIndex>>): void {
    const producerDef = findBoardProducerDef(def.id);
    const isProducingTool = def.interactType === InteractType.TOOL && !!producerDef?.canProduce;
    const canSellBase = cell.state === CellState.OPEN && def.sellable && !isProducingTool;
    const cdInfo =
      this._selectedCellIndex >= 0 ? BuildingManager.getCdInfo(this._selectedCellIndex) : null;
    const toolOnCooldown =
      isProducingTool &&
      cell.state === CellState.OPEN &&
      producerDef.cooldown > 0 &&
      (cdInfo?.remaining ?? 0) > 0;

    if (toolOnCooldown) {
      if (!this._sellAccelerateMode) {
        this._sellAccelerateMode = true;
        this._paintSellBtnChrome(true);
      }
      this._setSellTitleState('加速', 0xbf360c);
      this._setSellPriceState('免费', false, true);
      if (!this._sellBtn.visible) this._sellBtn.visible = true;
      return;
    }

    if (this._sellAccelerateMode) {
      this._sellAccelerateMode = false;
      this._paintSellBtnChrome(false);
    }
    this._setSellTitleState('出售', 0x1b5e20);

    if (this._sellBtn.visible !== canSellBase) this._sellBtn.visible = canSellBase;
    if (canSellBase) {
      const price = getItemSellPrice(def);
      const hyTex = TextureCache.get('icon_huayuan');
      const showHuayuan = price > 0 && !!(hyTex && hyTex.width > 0);
      this._setSellPriceState(price > 0 ? String(price) : '腾格', showHuayuan, false);
    } else {
      this._setSellPriceState('', false, false);
    }
  }

  private _setSellTitleState(text: string, stroke: number): void {
    if (text !== this._lastSellTitleText) {
      this._lastSellTitleText = text;
      this._sellBtnTitle.text = text;
    }
    if (stroke !== this._lastSellTitleStroke) {
      this._lastSellTitleStroke = stroke;
      this._sellBtnTitle.style.stroke = stroke;
      this._sellBtnTitle.style.strokeThickness = 3;
    }
  }

  private _setSellPriceState(text: string, showHuayuan: boolean, showAdIcon = false): void {
    let layoutDirty = false;
    if (showHuayuan !== this._lastSellHuayuanVisible || this._sellHuayuanSp.visible !== showHuayuan) {
      this._lastSellHuayuanVisible = showHuayuan;
      this._sellHuayuanSp.visible = showHuayuan;
      layoutDirty = true;
    }
    if (text !== this._lastSellPriceText) {
      this._lastSellPriceText = text;
      this._sellPriceText.text = text;
      layoutDirty = true;
    }
    if (this._sellAdIcon.visible !== showAdIcon) {
      this._sellAdIcon.visible = showAdIcon;
      layoutDirty = true;
    }
    if (layoutDirty) {
      this._layoutSellPriceRow();
    }
  }

  private _onItemSelected(cellIndex: number, itemId: string | null): void {
    if (!itemId) {
      this._clearSelection();
      return;
    }

    this._selectedMergeBubbleId = null;
    this._chainBtnLabel.text = '查看';

    this._selectedItemId = itemId;
    this._selectedCellIndex = cellIndex;

    const def = ITEM_DEFS.get(itemId);
    if (!def) {
      this._clearSelection();
      return;
    }

    const cell = BoardManager.getCellByIndex(cellIndex);
    const isLockedOrPeek =
      !!cell && (cell.state === CellState.FOG || cell.state === CellState.PEEK);

    if (isLockedOrPeek) {
      this._nameText.text = cell!.state === CellState.FOG ? '迷雾格子' : '未解锁';
      this._levelText.visible = false;
      this._levelText.text = '';
      this._descText.visible = true;
      this._staminaDescRow.visible = false;
      this._descText.text =
        cell!.state === CellState.FOG
          ? '迷雾未揭开，暂不可操作。'
          : '将相同物品从已开放格拖来合成后即可打开。';
      const ribbonLeftWorld = this._cardLeft - LEAF_LEFT_OVERHANG + LEAF_INSET_X;
      const titleRightWorld = this._nameText.position.x + this._nameText.width;
      const neededRibbonW = Math.ceil(
        titleRightWorld + RIBBON_PAD_RIGHT - ribbonLeftWorld,
      );
      this._leafDisplayW = Math.min(
        LEAF_MAX_W,
        Math.max(this._leafDisplayWMin, neededRibbonW),
      );
    } else {
      this._levelText.visible = true;
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
    }

    if (!isLockedOrPeek && cell) {
      this._applySellButtonState(def, cell);
    } else {
      if (this._sellAccelerateMode) {
        this._sellAccelerateMode = false;
        this._paintSellBtnChrome(false);
      }
      this._sellBtnTitle.text = '出售';
      this._sellBtnTitle.style.stroke = 0x1b5e20;
      this._sellBtnTitle.style.strokeThickness = 3;
      this._sellBtn.visible = false;
      this._sellPriceText.text = '';
    }

    const showChain =
      !isLockedOrPeek && getMergeChain(def.id).length > 1;
    this._chainBtn.visible = showChain;

    const showRightAction = this._sellBtn.visible;
    const descReserveW =
      showChain && showRightAction
        ? BTN_COL_W
        : showChain || showRightAction
          ? Math.max(CHAIN_W, SELL_BTN_W) + 24
          : 20;
    this._descText.style.wordWrapWidth = Math.max(72, this._cardW - 20 - descReserveW);

    this._syncActionButtonPositions(showChain, showRightAction);

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
    this._selectedMergeBubbleId = null;
    this._chainBtnLabel.text = '查看';
    this._bubbleDismissLink.visible = false;

    if (this._sellAccelerateMode) {
      this._sellAccelerateMode = false;
      this._paintSellBtnChrome(false);
    }
    this._setSellTitleState('出售', 0x1b5e20);
    this._setSellPriceState('', false);

    this._infoContainer.visible = false;
    this._sellBtn.visible = false;
    this._chainBtn.visible = false;
    this._staminaDescRow.visible = false;
    this._descText.visible = true;
    this._levelText.visible = true;
    this._hintContainer.visible = true;
  }

  private _getDescription(def: ItemDef): string {
    if (isLuckyCoinItem(def.id)) {
      return '拖到物品上试试就可以';
    }
    if (isCrystalBallItem(def.id)) {
      return '拖到鲜花或饮品（含蝴蝶标本）上，确认后可稳定升一级（满级不可用）。';
    }
    if (isGoldenScissorsItem(def.id)) {
      return '拖到 2 级及以上的鲜花或饮品（含蝴蝶标本）上，确认后拆成两个低一级的同线物品。';
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
    if (this._sellAccelerateMode) {
      const cellIndex = this._selectedCellIndex;
      const itemId = this._selectedItemId;
      void ConfirmDialog.show(
        '工具加速',
        '观看一段广告，立即完成该工具冷却。',
        '免费加速',
        '取消',
      ).then((ok) => {
        if (!ok) return;
        EventBus.emit('board:requestToolCdAdAccelerate', cellIndex, itemId);
        AdManager.showRewardedAd(AdScene.CD_SPEEDUP, (success) => {
          if (!success) {
            ToastMessage.show('广告未看完，未加速');
            return;
          }
          if (BuildingManager.clearCooldownByAd(cellIndex)) {
            ToastMessage.show('冷却已完成');
          } else {
            ToastMessage.show('该工具无需加速');
          }
        });
      });
      return;
    }
    EventBus.emit('board:requestSell', this._selectedCellIndex, this._selectedItemId);
  }

  private _onChainTap(): void {
    if (this._selectedMergeBubbleId) {
      void this._onMergeBubbleUnlockTap();
      return;
    }
    if (!this._selectedItemId) return;
    this._playBtnBounce(this._chainBtn);
    EventBus.emit('mergeChain:open', this._selectedItemId);
  }

  /**
   * 底栏：标题 + 简要说明 + 解锁按钮；倒计时仅在棋盘上泡泡 HUD 显示，此处不写「剩余」。
   */
  private _applyMergeBubbleBarContent(b: MergeCompanionFloatBubble): void {
    this._descText.text = '到期未解锁获得少量体力';
    this._descText.visible = true;
    this._staminaDescRow.visible = false;
    const freeInstant = MergeCompanionManager.shouldBubbleUnlockWithoutAd(b.payloadItemId);
    this._chainBtnLabel.text = freeInstant ? '免费解锁' : '看广告解锁';

    const showDismiss = b.dismissEnabled && b.dismissHuayuanAmount > 0;
    this._bubbleDismissLink.visible = showDismiss;
    if (showDismiss) {
      this._bubbleDismissLink.text = `换 ${b.dismissHuayuanAmount} 花愿移除泡泡`;
      this._bubbleDismissLink.position.set(
        this._descText.x,
        this._descText.y + this._descText.height + 4,
      );
    }
  }

  private _onMergeBubbleSelected(id: string): void {
    const b = MergeCompanionManager.getFloatBubble(id);
    if (!b) {
      this._clearSelection();
      return;
    }

    this._selectedMergeBubbleId = id;
    this._selectedItemId = null;
    this._selectedCellIndex = -1;

    const def = ITEM_DEFS.get(b.payloadItemId);
    this._nameText.text = MERGE_BUBBLE_DISPLAY_NAME;
    this._levelText.visible = true;
    this._levelText.text = def ? `${def.name} · Lv.${def.level}` : b.payloadItemId;
    this._levelText.position.x = this._nameText.position.x + this._nameText.width + 6;

    const ribbonLeftWorld = this._cardLeft - LEAF_LEFT_OVERHANG + LEAF_INSET_X;
    const titleRightWorld = this._levelText.position.x + this._levelText.width;
    const neededRibbonW = Math.ceil(titleRightWorld + RIBBON_PAD_RIGHT - ribbonLeftWorld);
    this._leafDisplayW = Math.min(LEAF_MAX_W, Math.max(this._leafDisplayWMin, neededRibbonW));

    this._applyMergeBubbleBarContent(b);

    this._sellBtn.visible = false;
    this._chainBtn.visible = true;

    this._descText.style.wordWrapWidth = Math.max(72, this._cardW - 20 - CHAIN_W - 32);
    this._syncActionButtonPositions(true, false);

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

  private _refreshSelectedBubblePanel(): void {
    if (!this._selectedMergeBubbleId) return;
    const b = MergeCompanionManager.getFloatBubble(this._selectedMergeBubbleId);
    if (!b) {
      this._clearSelection();
      return;
    }
    if (!this._infoContainer.visible) return;
    this._applyMergeBubbleBarContent(b);
  }

  private async _onMergeBubbleDismissTap(): Promise<void> {
    const id = this._selectedMergeBubbleId;
    if (!id) return;
    const b = MergeCompanionManager.getFloatBubble(id);
    if (!b || !b.dismissEnabled || b.dismissHuayuanAmount <= 0) return;
    const ok = await ConfirmDialog.show(
      `移除${MERGE_BUBBLE_DISPLAY_NAME}`,
      `移除后获得 ${b.dismissHuayuanAmount} 花愿，不会得到泡泡里的物品。`,
      '确认',
      '取消',
    );
    if (!ok) return;
    if (!MergeCompanionManager.dismissBubbleForHuayuan(id)) {
      ToastMessage.show('无法移除');
    } else {
      ToastMessage.show(`+${b.dismissHuayuanAmount} 花愿`);
      this._clearSelection();
    }
  }

  private async _onMergeBubbleUnlockTap(): Promise<void> {
    const id = this._selectedMergeBubbleId;
    if (!id) return;
    this._playBtnBounce(this._chainBtn);
    await this._performMergeBubbleUnlock(id);
  }

  private async _performMergeBubbleUnlock(id: string): Promise<void> {
    const b = MergeCompanionManager.getFloatBubble(id);
    if (!b) {
      this._clearSelection();
      return;
    }
    const def = ITEM_DEFS.get(b.payloadItemId);
    const name = def?.name ?? b.payloadItemId;

    if (MergeCompanionManager.shouldBubbleUnlockWithoutAd(b.payloadItemId)) {
      if (!MergeCompanionManager.unlockBubbleWithDiamond(id)) {
        ToastMessage.show('泡泡已消失');
      } else {
        ToastMessage.show('已获得泡泡里的物品');
        this._clearSelection();
      }
      return;
    }

    const ok = await ConfirmDialog.show(
      `解锁${MERGE_BUBBLE_DISPLAY_NAME}`,
      `观看一段广告获得「${name}」。\n（棋盘满时物品进入收纳箱）`,
      '免费解锁',
      '取消',
    );
    if (!ok) return;

    AdManager.showRewardedAd(AdScene.MERGE_BUBBLE_UNLOCK, (success) => {
      if (!success) {
        ToastMessage.show('广告未看完，未解锁');
        return;
      }
      if (!MergeCompanionManager.unlockBubbleWithAd(id)) {
        ToastMessage.show('泡泡已消失');
      } else {
        ToastMessage.show('已获得泡泡里的物品');
        this._clearSelection();
      }
    });
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
