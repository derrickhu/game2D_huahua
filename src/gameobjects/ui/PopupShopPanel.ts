/**
 * 弹框式商店面板 — 大地图上 popup_shop 节点弹出的购买面板
 *
 * 挂在 OverlayManager.container 上，浮在大地图面板之上。
 * 支持滚动商品列表 + 花愿/钻石购买。
 */
import * as PIXI from 'pixi.js';
import { Game } from '@/core/Game';
import { EventBus } from '@/core/EventBus';
import { TweenManager, Ease } from '@/core/TweenManager';
import { OverlayManager } from '@/core/OverlayManager';
import { TextureCache } from '@/utils/TextureCache';
import { CurrencyManager } from '@/managers/CurrencyManager';
import { RewardBoxManager } from '@/managers/RewardBoxManager';
import { ToastMessage } from '@/gameobjects/ui/ToastMessage';
import { DESIGN_WIDTH, FONT_FAMILY, COLORS } from '@/config/Constants';
import { getMapShop, type MapShopItemDef, type MapShopDef } from '@/config/MapShopConfig';

const PANEL_W = 580;
const PANEL_H = 520;
const CARD_W = 250;
const CARD_H = 130;
const CARD_GAP = 16;
const COLS = 2;

export class PopupShopPanel extends PIXI.Container {
  private _isOpen = false;
  private _bg!: PIXI.Graphics;
  private _panelBg!: PIXI.Graphics;
  private _titleText!: PIXI.Text;
  private _grid!: PIXI.Container;
  private _currentShopId = '';

  constructor() {
    super();
    this.visible = false;
    this.zIndex = 11000;
    this._build();
    this._bindEvents();
  }

  get isOpen(): boolean { return this._isOpen; }

  open(shopId: string): void {
    if (this._isOpen) return;
    const shop = getMapShop(shopId);
    if (!shop) {
      console.warn(`[PopupShopPanel] unknown shopId: ${shopId}`);
      return;
    }
    this._isOpen = true;
    this._currentShopId = shopId;
    OverlayManager.bringToFront();
    this.visible = true;
    this._renderShop(shop);
    this.alpha = 0;
    TweenManager.to({ target: this, props: { alpha: 1 }, duration: 0.25, ease: Ease.easeOutQuad });
  }

  close(): void {
    if (!this._isOpen) return;
    this._isOpen = false;
    TweenManager.to({
      target: this, props: { alpha: 0 }, duration: 0.2, ease: Ease.easeInQuad,
      onComplete: () => { this.visible = false; },
    });
  }

  private _build(): void {
    const W = DESIGN_WIDTH;
    const H = Game.logicHeight;

    this._bg = new PIXI.Graphics();
    this._bg.beginFill(0x000000, 0.55);
    this._bg.drawRect(0, 0, W, H);
    this._bg.endFill();
    this._bg.eventMode = 'static';
    this._bg.on('pointertap', () => this.close());
    this.addChild(this._bg);

    const px = (W - PANEL_W) / 2;
    const py = (H - PANEL_H) / 2 - 40;

    this._panelBg = new PIXI.Graphics();
    this._panelBg.beginFill(0xFFF8F0, 0.97);
    this._panelBg.drawRoundedRect(px, py, PANEL_W, PANEL_H, 24);
    this._panelBg.endFill();
    this._panelBg.lineStyle(3, 0xD2B48C, 0.6);
    this._panelBg.drawRoundedRect(px, py, PANEL_W, PANEL_H, 24);
    this._panelBg.eventMode = 'static';
    this._panelBg.on('pointertap', (e: PIXI.FederatedPointerEvent) => e.stopPropagation());
    this.addChild(this._panelBg);

    this._titleText = new PIXI.Text('', {
      fontSize: 26, fill: COLORS.TEXT_DARK, fontFamily: FONT_FAMILY, fontWeight: 'bold',
    });
    this._titleText.anchor.set(0.5, 0);
    this._titleText.position.set(W / 2, py + 18);
    this.addChild(this._titleText);

    // close button
    const closeBtn = new PIXI.Container();
    const cr = 18;
    const cbg = new PIXI.Graphics();
    cbg.beginFill(0x000000, 0.4);
    cbg.drawCircle(0, 0, cr);
    cbg.endFill();
    cbg.lineStyle(2.5, 0xFFFFFF, 0.9);
    const arm = 7;
    cbg.moveTo(-arm, -arm); cbg.lineTo(arm, arm);
    cbg.moveTo(arm, -arm); cbg.lineTo(-arm, arm);
    closeBtn.addChild(cbg);
    closeBtn.position.set(px + PANEL_W - 24, py + 24);
    closeBtn.eventMode = 'static';
    closeBtn.cursor = 'pointer';
    closeBtn.hitArea = new PIXI.Circle(0, 0, cr + 10);
    closeBtn.on('pointertap', () => this.close());
    this.addChild(closeBtn);

    this._grid = new PIXI.Container();
    this._grid.position.set(px + (PANEL_W - COLS * CARD_W - (COLS - 1) * CARD_GAP) / 2, py + 65);
    this.addChild(this._grid);
  }

  private _renderShop(shop: MapShopDef): void {
    this._titleText.text = shop.title;
    this._grid.removeChildren();

    for (let i = 0; i < shop.items.length; i++) {
      const item = shop.items[i];
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const card = this._createItemCard(item);
      card.position.set(col * (CARD_W + CARD_GAP), row * (CARD_H + CARD_GAP));
      this._grid.addChild(card);
    }
  }

  private _createItemCard(item: MapShopItemDef): PIXI.Container {
    const card = new PIXI.Container();

    const bg = new PIXI.Graphics();
    bg.beginFill(0xFFFFFF, 0.9);
    bg.drawRoundedRect(0, 0, CARD_W, CARD_H, 14);
    bg.endFill();
    bg.lineStyle(2, 0xE0D5C5, 0.6);
    bg.drawRoundedRect(0, 0, CARD_W, CARD_H, 14);
    card.addChild(bg);

    const iconSize = 48;
    const tex = TextureCache.get(item.iconKey);
    if (tex && tex.width > 1) {
      const sp = new PIXI.Sprite(tex);
      sp.anchor.set(0.5);
      const sc = iconSize / Math.max(tex.width, tex.height);
      sp.scale.set(sc);
      sp.position.set(40, CARD_H / 2 - 8);
      card.addChild(sp);
    } else {
      const placeholder = new PIXI.Graphics();
      placeholder.beginFill(0xE8E0D8);
      placeholder.drawRoundedRect(16, CARD_H / 2 - 32, iconSize, iconSize, 8);
      placeholder.endFill();
      card.addChild(placeholder);
    }

    const label = new PIXI.Text(item.label, {
      fontSize: 18, fill: COLORS.TEXT_DARK, fontFamily: FONT_FAMILY, fontWeight: 'bold',
    });
    label.position.set(74, 16);
    card.addChild(label);

    const costStr = item.costHuayuan
      ? `${item.costHuayuan} 花愿`
      : item.costDiamond
        ? `${item.costDiamond} 钻石`
        : '免费';
    const costColor = item.costDiamond ? 0x7E57C2 : 0xE8963E;
    const costText = new PIXI.Text(costStr, {
      fontSize: 14, fill: costColor, fontFamily: FONT_FAMILY,
    });
    costText.position.set(74, 44);
    card.addChild(costText);

    const buyBtn = new PIXI.Container();
    const btnW = 72;
    const btnH = 32;
    const btnBg = new PIXI.Graphics();
    btnBg.beginFill(COLORS.BUTTON_PRIMARY, 0.92);
    btnBg.drawRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 10);
    btnBg.endFill();
    buyBtn.addChild(btnBg);
    const btnText = new PIXI.Text('购买', {
      fontSize: 15, fill: 0xFFFFFF, fontFamily: FONT_FAMILY, fontWeight: 'bold',
    });
    btnText.anchor.set(0.5);
    buyBtn.addChild(btnText);
    buyBtn.position.set(CARD_W - 52, CARD_H - 30);
    buyBtn.eventMode = 'static';
    buyBtn.cursor = 'pointer';
    buyBtn.hitArea = new PIXI.Rectangle(-btnW / 2 - 8, -btnH / 2 - 8, btnW + 16, btnH + 16);
    buyBtn.on('pointertap', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      this._onBuy(item);
    });
    card.addChild(buyBtn);

    return card;
  }

  private _onBuy(item: MapShopItemDef): void {
    const state = CurrencyManager.state;

    if (item.costHuayuan && state.huayuan < item.costHuayuan) {
      ToastMessage.show('花愿不足');
      return;
    }
    if (item.costDiamond && state.diamond < item.costDiamond) {
      ToastMessage.show('钻石不足');
      return;
    }

    if (item.costHuayuan) CurrencyManager.addHuayuan(-item.costHuayuan);
    if (item.costDiamond) CurrencyManager.addDiamond(-item.costDiamond);

    switch (item.type) {
      case 'stamina':
        CurrencyManager.addStamina(item.amount ?? 0);
        ToastMessage.show(`获得 ${item.amount} 体力`);
        break;
      case 'diamond':
        CurrencyManager.addDiamond(item.amount ?? 0);
        ToastMessage.show(`获得 ${item.amount} 钻石`);
        break;
      case 'chest':
        if (item.itemId) {
          RewardBoxManager.addItem(item.itemId, 1);
          ToastMessage.show(`获得 ${item.label}`);
        }
        break;
      case 'item':
        if (item.itemId) {
          RewardBoxManager.addItem(item.itemId, item.amount ?? 1);
          ToastMessage.show(`获得 ${item.label}`);
        }
        break;
    }
  }

  private _bindEvents(): void {
    EventBus.on('worldmap:openShop', (shopId: string) => {
      this.open(shopId);
    });
  }
}
