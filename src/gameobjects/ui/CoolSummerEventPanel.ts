import * as PIXI from 'pixi.js';
import { DESIGN_WIDTH, FONT_FAMILY } from '@/config/Constants';
import { Game } from '@/core/Game';
import { EventBus } from '@/core/EventBus';
import { OverlayManager } from '@/core/OverlayManager';
import { TweenManager, Ease } from '@/core/TweenManager';
import {
  COOL_SUMMER_EVENT_NAME,
  COOL_SUMMER_SEASON_ID,
  COOL_SUMMER_SHOP_CATEGORIES,
  COOL_SUMMER_SHOP_PRODUCTS,
  type CoolSummerGrant,
  type CoolSummerShopCategory,
  type CoolSummerShopProduct,
} from '@/config/events/CoolSummerEventConfig';
import { CoolSummerEventManager } from '@/managers/CoolSummerEventManager';
import { DECO_MAP } from '@/config/DecorationConfig';
import {
  WORKSHOP_BLUEPRINT_MAP,
  resolveWorkshopMaterialIconKey,
} from '@/config/FurnitureWorkshopConfig';
import { collectFurniturePreloadKeys } from '@/config/FurnitureRenderConfig';
import { TextureCache } from '@/utils/TextureCache';
import { ToastMessage } from '@/gameobjects/ui/ToastMessage';
import { ItemObtainOverlay, type ItemObtainEntry } from '@/gameobjects/ui/ItemObtainOverlay';
import { AudioManager } from '@/core/AudioManager';
import {
  appendWorkshopBlueprintIcon,
  WORKSHOP_BLUEPRINT_SCROLL_KEY,
} from '@/utils/WorkshopBlueprintDisplay';

const COOL_SUMMER_PANEL_SHELL_KEY = 'cool_summer_event_panel_shell_v2';

const Z = 11240;
const FALLBACK_SHELL_W = 680;
const FALLBACK_SHELL_H = 1138;
/** 壳体图右上红 X 中心（按 v2 图像素实测） */
const CLOSE_NX = 0.905;
const CLOSE_NY = 0.084;
const CLOSE_R = 56;
const TITLE_NY = 0.135;
const CURRENCY_NY = 0.275;
const COUNTDOWN_NY = 0.325;
const CONTENT_NX = 0.11;
const CONTENT_NY = 0.31;
const CONTENT_NW = 0.78;
/** 略收矮，避免列表底边压进壳体底部装饰条 */
const CONTENT_NH = 0.40;
const CARD_W = 172;
const CARD_H = 172;
const CARD_GAP_X = 14;
const CARD_GAP_Y = 14;
const SECTION_HEADER_H = 76;
/** 可领取时改为双行：标题+领取 / 奖励说明，避免挤在一行互相遮挡 */
const SECTION_HEADER_CLAIM_H = 108;
/** 列表底部额外留白，最后一行卡片不被壳体底饰裁切 */
const LIST_BOTTOM_PAD = 48;
/** 滚动视口相对 content 区再上收，给底饰留空 */
const VIEWPORT_BOTTOM_INSET = 56;

export class CoolSummerEventPanel extends PIXI.Container {
  private _isOpen = false;
  private _opening = false;
  private _bg!: PIXI.Graphics;
  private _root!: PIXI.Container;
  private _art!: PIXI.Sprite;
  private _content!: PIXI.Container;
  private _list: PIXI.Container | null = null;
  private _closeHit!: PIXI.Container;
  private _scrollMask!: PIXI.Graphics;
  private _currencyInfo: PIXI.Container | null = null;
  private _scrollY = 0;
  private _contentHeight = 0;
  private _dragging = false;
  private _dragMoved = false;
  private _dragLastY = 0;
  private _canvasScrollListening = false;
  private _canvasScrollStartDesignY = 0;
  private _canvasScrollStartY = 0;
  private _areaW = 0;
  private _areaH = 0;
  private _shellW = 0;
  private _shellH = 0;
  private _closeDesignX = 0;
  private _closeDesignY = 0;
  private _closeDesignR = CLOSE_R;

  constructor() {
    super();
    this.visible = false;
    this.zIndex = Z;
    this.sortableChildren = true;
    this._build();
    this._setupCanvasScroll();
    EventBus.on('panel:openCoolSummerEvent', () => this.open());
    EventBus.on('coolSummerEvent:changed', () => {
      if (this._isOpen) this._refresh();
    });
    EventBus.on('coolSummerEvent:periodChanged', () => {
      if (!this._isOpen) return;
      if (!CoolSummerEventManager.isActive()) {
        ToastMessage.show('清凉一夏活动已结束');
        this.close();
      } else {
        this._refresh();
      }
    });
  }

  open(): void {
    if (this._isOpen || this._opening) return;
    if (!CoolSummerEventManager.isActive()) {
      ToastMessage.show('清凉一夏暂未开放');
      return;
    }
    this._opening = true;
    void Promise.all([
      TextureCache.preloadEventKeys(
        COOL_SUMMER_SEASON_ID,
        [COOL_SUMMER_PANEL_SHELL_KEY],
      ),
      TextureCache.preloadKeys(this._rewardIconKeys()),
    ]).finally(() => {
      this._opening = false;
      this._openReady();
    });
  }

  close(): void {
    this._opening = false;
    if (!this._isOpen) return;
    this._isOpen = false;
    this._dragging = false;
    this._canvasScrollListening = false;
    TweenManager.to({
      target: this,
      props: { alpha: 0 },
      duration: 0.16,
      ease: Ease.easeInQuad,
      onComplete: () => {
        this.visible = false;
        this.alpha = 1;
      },
    });
  }

  private _openReady(): void {
    if (this._isOpen) return;
    this._isOpen = true;
    OverlayManager.bringToFront();
    this.visible = true;
    this.alpha = 0;
    this._scrollY = 0;
    this._rebuildArt();
    this._refresh();
    TweenManager.to({
      target: this,
      props: { alpha: 1 },
      duration: 0.2,
      ease: Ease.easeOutQuad,
    });
  }

  private _build(): void {
    this._bg = new PIXI.Graphics();
    this._bg.beginFill(0x000000, 0.55);
    this._bg.drawRect(0, 0, DESIGN_WIDTH, Game.logicHeight);
    this._bg.endFill();
    this._bg.eventMode = 'static';
    this._bg.on('pointertap', () => {
      if (this._hideCurrencyInfo()) return;
      this.close();
    });
    this.addChild(this._bg);

    this._root = new PIXI.Container();
    this._root.position.set(DESIGN_WIDTH / 2, Game.logicHeight / 2);
    this._root.sortableChildren = true;
    this._root.eventMode = 'static';
    this._root.on('pointertap', (e: PIXI.FederatedPointerEvent) => {
      this._hideCurrencyInfo();
      e.stopPropagation();
    });
    this._root.on('pointerdown', (e: PIXI.FederatedPointerEvent) => this._onPanelPointerDown(e));
    this._root.on('globalpointermove', (e: PIXI.FederatedPointerEvent) => this._onPanelPointerMove(e));
    this._root.on('pointerup', () => this._onPanelPointerUp());
    this._root.on('pointerupoutside', () => this._onPanelPointerUp());
    this.addChild(this._root);

    this._art = new PIXI.Sprite();
    this._art.anchor.set(0.5);
    this._art.eventMode = 'none';
    this._art.zIndex = 1;
    this._root.addChild(this._art);

    this._content = new PIXI.Container();
    this._content.zIndex = 2;
    this._root.addChild(this._content);

    // 关闭热区挂在面板根节点（非 _root），避免被壳体 hitArea / 内容层吞掉事件
    this._closeHit = new PIXI.Container();
    this._closeHit.zIndex = 200;
    this._closeHit.eventMode = 'static';
    this._closeHit.cursor = 'pointer';
    const onClose = (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      AudioManager.play('button_click');
      this.close();
    };
    this._closeHit.on('pointerdown', onClose);
    this._closeHit.on('pointertap', onClose);
    this.addChild(this._closeHit);
  }

  private _layoutCloseHit(shellW: number, shellH: number): void {
    this._shellW = shellW;
    this._shellH = shellH;
    const localX = -shellW / 2 + shellW * CLOSE_NX;
    const localY = -shellH / 2 + shellH * CLOSE_NY;
    this._closeDesignX = DESIGN_WIDTH / 2 + localX;
    this._closeDesignY = Game.logicHeight / 2 + localY;
    this._closeDesignR = CLOSE_R;
    this._closeHit.position.set(this._closeDesignX, this._closeDesignY);
    this._closeHit.hitArea = new PIXI.Circle(0, 0, this._closeDesignR);
  }

  private _rebuildArt(): void {
    const tex = TextureCache.get(COOL_SUMMER_PANEL_SHELL_KEY);
    if (tex && tex.width > 1) {
      this._art.texture = tex;
      this._art.visible = true;
      const maxW = DESIGN_WIDTH * 0.96;
      const maxH = Game.logicHeight * 0.9;
      const scale = Math.min(maxW / tex.width, maxH / tex.height);
      this._art.scale.set(scale);
      const w = tex.width * scale;
      const h = tex.height * scale;
      this._root.hitArea = new PIXI.Rectangle(-w / 2, -h / 2, w, h);
      this._layoutCloseHit(w, h);
      this._content.position.set(-w / 2 + w * CONTENT_NX, -h / 2 + h * CONTENT_NY);
      this._areaW = w * CONTENT_NW;
      this._areaH = h * CONTENT_NH;
      return;
    }

    this._art.visible = false;
    const w = Math.min(FALLBACK_SHELL_W, DESIGN_WIDTH * 0.9);
    const h = Math.min(FALLBACK_SHELL_H, Game.logicHeight * 0.86);
    this._root.hitArea = new PIXI.Rectangle(-w / 2, -h / 2, w, h);
    this._content.position.set(-w / 2 + w * CONTENT_NX, -h / 2 + h * CONTENT_NY);
    this._layoutCloseHit(w, h);
    this._areaW = w * CONTENT_NW;
    this._areaH = h * CONTENT_NH;
  }

  private _refresh(): void {
    this._drawShop();
  }

  private _drawShop(): void {
    this._content.removeChildren();
    this._currencyInfo = null;

    const chromeTop = -this._areaH * 0.29 + 56;
    this._drawProgrammaticChrome(chromeTop);

    const viewport = new PIXI.Container();
    viewport.position.set(0, 58);
    viewport.eventMode = 'static';
    viewport.cursor = 'grab';
    const viewportH = Math.max(1, this._areaH - 64 - VIEWPORT_BOTTOM_INSET);
    viewport.hitArea = new PIXI.Rectangle(0, 0, this._areaW, viewportH);
    viewport.on('wheel' as any, (e: any) => {
      e.stopPropagation?.();
      this._setScroll(this._scrollY - Math.sign(e.deltaY || 0) * 56);
    });

    this._scrollMask = new PIXI.Graphics();
    this._scrollMask.beginFill(0xffffff);
    this._scrollMask.drawRoundedRect(0, 58, this._areaW, viewportH, 16);
    this._scrollMask.endFill();
    this._scrollMask.renderable = false;
    this._content.addChild(this._scrollMask);

    this._list = new PIXI.Container();
    this._list.mask = this._scrollMask;
    viewport.addChild(this._list);
    this._content.addChild(viewport);

    let y = 0;
    for (const category of COOL_SUMMER_SHOP_CATEGORIES) {
      y = this._drawCategory(this._list, category, y);
    }
    this._contentHeight = y + LIST_BOTTOM_PAD;
    this._setScroll(this._scrollY);
  }

  private _drawProgrammaticChrome(topY: number): void {
    const title = new PIXI.Text(COOL_SUMMER_EVENT_NAME, {
      fontSize: 38,
      fill: 0x8A5638,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: 0xFFF6D5,
      strokeThickness: 5,
    } as PIXI.TextStyle);
    title.anchor.set(0.5);
    title.position.set(this._areaW / 2, topY);
    this._content.addChild(title);

    const pillW = Math.min(166, this._areaW * 0.34);
    const pillH = 38;
    const pillY = 0;
    const pill = new PIXI.Graphics();
    pill.beginFill(0xF8FFFC, 0.98);
    pill.lineStyle(2.2, 0x55B9B3, 1);
    pill.drawRoundedRect(this._areaW / 2 - pillW / 2, pillY - pillH / 2, pillW, pillH, pillH / 2);
    pill.endFill();
    this._content.addChild(pill);

    const fan = this._makeIcon('icon_cool_summer_fan', 30);
    fan.position.set(this._areaW / 2 - pillW / 2 + 36, pillY);
    fan.eventMode = 'static';
    fan.cursor = 'pointer';
    fan.hitArea = new PIXI.Circle(0, 0, 20);
    fan.on('pointertap', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      this._toggleCurrencyInfo();
    });
    this._content.addChild(fan);

    const currency = new PIXI.Text(`${CoolSummerEventManager.currency}`, {
      fontSize: 24,
      fill: 0x1A4F4C,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: 0xFFFFFF,
      strokeThickness: 2,
    } as PIXI.TextStyle);
    currency.anchor.set(0, 0.5);
    currency.position.set(this._areaW / 2 - pillW / 2 + 58, pillY);
    this._content.addChild(currency);

    const countdown = new PIXI.Text(`活动剩余 ${CoolSummerEventManager.countdownLabel() ?? '已结束'}`, {
      fontSize: 18,
      fill: 0x765548,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    } as PIXI.TextStyle);
    countdown.anchor.set(0.5);
    countdown.position.set(this._areaW / 2, 35);
    this._content.addChild(countdown);
  }

  private _drawCategory(target: PIXI.Container, category: CoolSummerShopCategory, y: number): number {
    const claimed = CoolSummerEventManager.isCategoryRewardClaimed(category.id);
    const canClaim = CoolSummerEventManager.canClaimCategoryReward(category.id);
    const headerH = canClaim ? SECTION_HEADER_CLAIM_H : SECTION_HEADER_H;

    const header = new PIXI.Container();
    header.position.set(0, y);
    const bg = new PIXI.Graphics();
    bg.beginFill(0xBFEFE6, 0.98);
    bg.lineStyle(2.5, 0x51AAA8, 1);
    bg.drawRoundedRect(0, 0, this._areaW, headerH, 18);
    bg.endFill();
    header.addChild(bg);

    const title = new PIXI.Text(category.name, {
      fontSize: 24,
      fill: 0x285E5D,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    title.anchor.set(0, 0.5);
    title.position.set(18, canClaim ? 28 : headerH / 2);
    header.addChild(title);

    const claimBtnW = 108;
    if (canClaim) {
      const claimBtnX = this._areaW - claimBtnW - 14;
      const claimBtnY = 10;
      const claimBtnH = 36;
      const claimBtn = new PIXI.Container();
      claimBtn.position.set(claimBtnX, claimBtnY);
      claimBtn.eventMode = 'static';
      claimBtn.cursor = 'pointer';
      claimBtn.hitArea = new PIXI.Rectangle(0, 0, claimBtnW, claimBtnH);
      const claimBg = new PIXI.Graphics();
      claimBg.beginFill(0xFF8A65);
      claimBg.drawRoundedRect(0, 0, claimBtnW, claimBtnH, 16);
      claimBg.endFill();
      claimBtn.addChild(claimBg);
      const claimLabel = new PIXI.Text('领取', {
        fontSize: 20,
        fill: 0xFFFFFF,
        fontFamily: FONT_FAMILY,
        fontWeight: 'bold',
      });
      claimLabel.anchor.set(0.5);
      claimLabel.position.set(claimBtnW / 2, claimBtnH / 2);
      claimBtn.addChild(claimLabel);
      claimBtn.on('pointertap', (e: PIXI.FederatedPointerEvent) => {
        e.stopPropagation();
        if (this._dragMoved) return;
        this._claimCategory(category);
      });
      header.addChild(claimBtn);
    }

    const rewardCy = canClaim ? 76 : headerH / 2;
    const rewardRight = this._areaW - 18;
    const prefix = new PIXI.Text(canClaim ? '可领取：' : '全部兑换后获得：', {
      fontSize: canClaim ? 17 : 18,
      fill: canClaim ? 0xC45C26 : 0x765548,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: 0xFFFFFF,
      strokeThickness: 2,
    } as PIXI.TextStyle);
    prefix.anchor.set(1, 0.5);
    prefix.alpha = claimed ? 0.55 : 1;
    prefix.position.set(
      rewardRight - this._estimateCategoryRewardWidth(category.completionRewards) - 8,
      rewardCy,
    );
    header.addChild(prefix);
    this._drawCategoryRewardIcons(header, category.completionRewards, rewardRight, rewardCy, claimed);
    target.addChild(header);

    const products = COOL_SUMMER_SHOP_PRODUCTS.filter(p => p.categoryId === category.id);
    const cardTop = y + headerH + 12;
    const innerW = this._areaW;
    const gapX = CARD_GAP_X;
    const cardW = Math.min(CARD_W, (innerW - gapX * 2) / 3);
    products.forEach((product, index) => {
      const col = index % 3;
      const row = Math.floor(index / 3);
      const card = this._makeProductCard(product, cardW);
      const totalCardsW = cardW * 3 + gapX * 2;
      const startX = (innerW - totalCardsW) / 2;
      card.position.set(
        startX + col * (cardW + gapX),
        cardTop + row * (CARD_H + CARD_GAP_Y),
      );
      target.addChild(card);
    });
    const rows = Math.ceil(products.length / 3);
    return cardTop + rows * (CARD_H + CARD_GAP_Y) + 8;
  }

  private _toggleCurrencyInfo(): void {
    if (this._hideCurrencyInfo()) return;
    const root = new PIXI.Container();
    root.position.set(this._areaW / 2, 62);
    root.zIndex = 50;

    const w = Math.min(460, this._areaW - 24);
    const h = 198;
    const bg = new PIXI.Graphics();
    bg.beginFill(0xFFFDF3, 0.98);
    bg.lineStyle(3, 0x55B9B3, 1);
    bg.drawRoundedRect(-w / 2, 0, w, h, 18);
    bg.endFill();
    bg.lineStyle(1.5, 0xffffff, 0.85);
    bg.drawRoundedRect(-w / 2 + 6, 6, w - 12, h - 12, 14);
    root.addChild(bg);

    const icon = this._makeIcon('icon_cool_summer_fan', 38);
    icon.position.set(-w / 2 + 36, 30);
    root.addChild(icon);

    const title = new PIXI.Text('清凉小扇', {
      fontSize: 26,
      fill: 0x285E5D,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    } as PIXI.TextStyle);
    title.anchor.set(0, 0.5);
    title.position.set(-w / 2 + 62, 30);
    root.addChild(title);

    const body = new PIXI.Text(
      '获取来源：完成包含冷饮或果切的订单\n用途：在清凉一夏活动中兑换奖励',
      {
        fontSize: 20,
        fill: 0x765548,
        fontFamily: FONT_FAMILY,
        fontWeight: 'bold',
        lineHeight: 30,
        wordWrap: true,
        wordWrapWidth: w - 36,
      } as PIXI.TextStyle,
    );
    body.position.set(-w / 2 + 18, 58);
    root.addChild(body);

    const note = new PIXI.Text(
      '活动截止后未兑换完的扇子，自动换算为等量花愿值。',
      {
        fontSize: 19,
        fill: 0xD97706,
        fontFamily: FONT_FAMILY,
        fontWeight: 'bold',
        lineHeight: 28,
        wordWrap: true,
        wordWrapWidth: w - 36,
      } as PIXI.TextStyle,
    );
    note.position.set(-w / 2 + 18, 58 + body.height + 8);
    root.addChild(note);

    root.eventMode = 'static';
    root.on('pointertap', (e: PIXI.FederatedPointerEvent) => e.stopPropagation());
    this._currencyInfo = root;
    this._content.addChild(root);
  }

  private _hideCurrencyInfo(): boolean {
    if (!this._currencyInfo) return false;
    this._currencyInfo.destroy({ children: true });
    this._currencyInfo = null;
    return true;
  }

  private _drawCategoryRewardIcons(
    target: PIXI.Container,
    grants: readonly CoolSummerGrant[],
    rightX: number,
    cy: number,
    claimed: boolean,
  ): void {
    let x = rightX;
    const alpha = claimed ? 0.55 : 1;
    for (let i = grants.length - 1; i >= 0; i--) {
      const grant = grants[i];
      const value = `x${this._grantValueLabel(grant)}`;
      const text = new PIXI.Text(value, {
        fontSize: 21,
        fill: 0x765548,
        fontFamily: FONT_FAMILY,
        fontWeight: 'bold',
        stroke: 0xFFFFFF,
        strokeThickness: 2,
      } as PIXI.TextStyle);
      text.anchor.set(1, 0.5);
      text.alpha = alpha;
      text.position.set(x, cy);
      target.addChild(text);
      x -= text.width + 8;

      const icon = this._makeGrantIcon(grant, 34);
      icon.alpha = alpha;
      icon.position.set(x - 17, cy);
      target.addChild(icon);
      x -= 42;
    }
  }

  private _estimateCategoryRewardWidth(grants: readonly CoolSummerGrant[]): number {
    return grants.reduce((sum, grant) => {
      const value = `x${this._grantValueLabel(grant)}`;
      // 粗估：图标 42 + 描边粗体数字约 13px/字 + 间距
      return sum + 42 + value.length * 13 + 10;
    }, 0);
  }

  private _makeProductCard(product: CoolSummerShopProduct, cardW = CARD_W): PIXI.Container {
    const root = new PIXI.Container();
    const remaining = CoolSummerEventManager.getRemainingStock(product.id);
    const satisfied = CoolSummerEventManager.isProductSatisfied(product.id);
    const enabled = !satisfied && remaining > 0 && CoolSummerEventManager.currency >= product.cost;

    const radius = 15;
    const bg = new PIXI.Graphics();
    bg.beginFill(satisfied ? 0xE8E2DA : 0xFFF9EC, 0.98);
    bg.lineStyle(2.2, satisfied ? 0xB8ADA2 : 0xF2A987, 1);
    bg.drawRoundedRect(0, 0, cardW, CARD_H, radius);
    bg.endFill();
    bg.lineStyle(1.2, 0xffffff, 0.85);
    bg.drawRoundedRect(5, 5, cardW - 10, CARD_H - 10, Math.max(6, radius - 4));
    root.addChild(bg);

    const name = new PIXI.Text(product.name, {
      fontSize: 16,
      fill: 0x5D4037,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      align: 'center',
      wordWrap: true,
      wordWrapWidth: cardW - 18,
    });
    name.anchor.set(0.5, 0);
    name.position.set(cardW / 2, 10);
    root.addChild(name);

    const qty = this._grantValueLabel(product.grant);
    const hasQty = qty.length > 0;
    const iconSize = product.grant.kind === 'deco' ? 54 : 62;
    const icon = this._makeGrantIcon(product.grant, iconSize);
    icon.position.set(hasQty ? cardW / 2 - 16 : cardW / 2, 74);
    root.addChild(icon);

    if (hasQty) {
      const amount = new PIXI.Text(`x${qty}`, {
        fontSize: 18,
        fill: 0x8D6E63,
        fontFamily: FONT_FAMILY,
        fontWeight: 'bold',
        stroke: 0xFFFFFF,
        strokeThickness: 2,
      } as PIXI.TextStyle);
      amount.anchor.set(0, 0.5);
      amount.position.set(cardW / 2 + 18, 76);
      root.addChild(amount);
    }

    const btnH = 38;
    const btnX = 12;
    const btnW = cardW - 24;
    const buyBtn = new PIXI.Container();
    buyBtn.position.set(btnX, CARD_H - btnH - 10);
    const priceBg = new PIXI.Graphics();
    priceBg.beginFill(satisfied ? 0xBDB5AD : enabled ? 0xFF8A65 : 0xD7A999);
    priceBg.drawRoundedRect(0, 0, btnW, btnH, 18);
    priceBg.endFill();
    buyBtn.addChild(priceBg);
    const price = new PIXI.Text(
      satisfied ? '已购' : `${product.cost}`,
      {
        fontSize: 17,
        fill: 0xFFFFFF,
        fontFamily: FONT_FAMILY,
        fontWeight: 'bold',
      },
    );
    price.anchor.set(0.5);
    price.position.set(btnW / 2 + (satisfied ? 0 : 12), btnH / 2);
    buyBtn.addChild(price);

    if (!satisfied) {
      const fan = this._makeIcon('icon_cool_summer_fan', 26);
      fan.position.set(btnW / 2 - 26, btnH / 2);
      buyBtn.addChild(fan);
    }
    root.addChild(buyBtn);

    // 仅底部兑换按钮可点；卡片其余区域留给滑动，避免误兑
    if (!satisfied && remaining > 0) {
      buyBtn.eventMode = 'static';
      buyBtn.cursor = 'pointer';
      buyBtn.hitArea = new PIXI.Rectangle(0, 0, btnW, btnH);
      buyBtn.on('pointertap', (e: PIXI.FederatedPointerEvent) => {
        e.stopPropagation();
        if (this._dragMoved) return;
        this._purchase(product);
      });
    }
    return root;
  }

  private _onPanelPointerDown(e: PIXI.FederatedPointerEvent): void {
    if (!this._list) return;
    const p = this._root.toLocal(e.global);
    const vx = this._content.x;
    const vy = this._content.y + 58;
    const vh = Math.max(1, this._areaH - 64 - VIEWPORT_BOTTOM_INSET);
    if (p.x < vx || p.x > vx + this._areaW || p.y < vy || p.y > vy + vh) return;
    this._dragging = true;
    this._dragMoved = false;
    this._dragLastY = e.global.y;
  }

  private _onPanelPointerMove(e: PIXI.FederatedPointerEvent): void {
    if (!this._dragging) return;
    const dy = e.global.y - this._dragLastY;
    if (Math.abs(dy) >= 2) this._dragMoved = true;
    this._dragLastY = e.global.y;
    this._setScroll(this._scrollY + dy);
  }

  private _onPanelPointerUp(): void {
    this._dragging = false;
    // 微信小游戏上拖动抬手后仍可能补发 pointertap，短暂保留防误触
    setTimeout(() => { this._dragMoved = false; }, 80);
  }

  private _setupCanvasScroll(): void {
    const canvas = Game.app.view as unknown as HTMLCanvasElement | undefined;
    if (!canvas?.addEventListener) return;
    canvas.addEventListener('pointerdown', this._onCanvasPointerDown);
    canvas.addEventListener('pointermove', this._onCanvasPointerMove);
    canvas.addEventListener('pointerup', this._onCanvasPointerUp);
    canvas.addEventListener('pointercancel', this._onCanvasPointerUp);
  }

  private readonly _onCanvasPointerDown = (ev: PointerEvent): void => {
    if (!this._isOpen) return;
    const p = this._rawToDesign(ev);
    if (this._isPointInCloseHit(p.x, p.y)) {
      AudioManager.play('button_click');
      this.close();
      return;
    }
    if (!this._list) return;
    if (!this._isPointInScrollViewport(p.x, p.y)) return;
    this._canvasScrollListening = true;
    this._dragMoved = false;
    this._canvasScrollStartDesignY = p.y;
    this._canvasScrollStartY = this._scrollY;
  };

  private readonly _onCanvasPointerMove = (ev: PointerEvent): void => {
    if (!this._isOpen || !this._canvasScrollListening) return;
    const y = this._rawToDesign(ev).y;
    const dy = y - this._canvasScrollStartDesignY;
    if (Math.abs(dy) >= 3) this._dragMoved = true;
    this._setScroll(this._canvasScrollStartY + dy);
    ev.preventDefault?.();
  };

  private readonly _onCanvasPointerUp = (): void => {
    if (!this._canvasScrollListening) return;
    this._canvasScrollListening = false;
    setTimeout(() => { this._dragMoved = false; }, 80);
  };

  private _isPointInCloseHit(x: number, y: number): boolean {
    const dx = x - this._closeDesignX;
    const dy = y - this._closeDesignY;
    return dx * dx + dy * dy <= this._closeDesignR * this._closeDesignR;
  }

  private _isPointInScrollViewport(x: number, y: number): boolean {
    const rootX = DESIGN_WIDTH / 2;
    const rootY = Game.logicHeight / 2;
    const vx = rootX + this._content.x;
    const vy = rootY + this._content.y + 58;
    const vh = Math.max(1, this._areaH - 64 - VIEWPORT_BOTTOM_INSET);
    return x >= vx && x <= vx + this._areaW && y >= vy && y <= vy + vh;
  }

  private _rawToDesign(e: PointerEvent): { x: number; y: number } {
    const cx = e.clientX ?? 0;
    const cy = e.clientY ?? 0;
    const k = Game.designWidth / Game.screenWidth;
    return { x: cx * k, y: cy * k };
  }

  private _purchase(product: CoolSummerShopProduct): void {
    const result = CoolSummerEventManager.purchase(product.id);
    if (result.ok) {
      const entry = this._grantToObtainEntry(product.grant);
      this._refresh();
      if (entry) {
        // ItemObtainOverlay 内播 ui_reward_fanfare（与升级/抽奖获得一致）
        this._showObtainOverlay([entry]);
      } else {
        AudioManager.play('purchase_tap');
        ToastMessage.show(`获得 ${product.name}`);
      }
      return;
    }
    const messages: Record<string, string> = {
      not_active: '活动已结束',
      out_of_stock: '该奖励已售罄',
      not_enough_currency: '清凉小扇不足',
      already_owned: '已经拥有该奖励',
      grant_failed: '奖励发放失败，请稍后再试',
      product_not_found: '奖励配置不存在',
    };
    ToastMessage.show(messages[result.reason] ?? '暂时无法兑换');
  }

  private _claimCategory(category: CoolSummerShopCategory): void {
    if (this._dragMoved) return;
    const result = CoolSummerEventManager.claimCategoryReward(category.id);
    if (result.ok) {
      const entries = category.completionRewards
        .map(grant => this._grantToObtainEntry(grant))
        .filter((e): e is ItemObtainEntry => e != null);
      this._refresh();
      if (entries.length > 0) {
        this._showObtainOverlay(entries);
      }
      return;
    }
    ToastMessage.show(result.reason === 'not_complete' ? '请先兑换完本类奖励' : '暂时无法领取');
  }

  private _showObtainOverlay(entries: ItemObtainEntry[]): void {
    void TextureCache.preloadKeys(['merge_chain_ribbon', 'pink_bar', ...this._obtainEntryIconKeys(entries)])
      .finally(() => {
        ItemObtainOverlay.show(entries, () => {});
      });
  }

  private _grantToObtainEntry(grant: CoolSummerGrant): ItemObtainEntry | null {
    switch (grant.kind) {
      case 'stamina':
        return { kind: 'direct_currency', currency: 'stamina', amount: grant.amount };
      case 'huayuan':
        return { kind: 'direct_currency', currency: 'huayuan', amount: grant.amount };
      case 'diamond':
        return { kind: 'direct_currency', currency: 'diamond', amount: grant.amount };
      case 'workshopMaterial':
        return { kind: 'workshop_material', materialId: grant.materialId, count: grant.amount };
      case 'deco':
        return {
          kind: 'deco',
          decoId: grant.decoId,
          label: DECO_MAP.get(grant.decoId)?.name ?? '家具',
        };
      case 'blueprint': {
        const decoId = WORKSHOP_BLUEPRINT_MAP.get(grant.blueprintId)?.outputDecoId;
        return {
          kind: 'unlock_icon',
          iconKey: decoId
            ? (DECO_MAP.get(decoId)?.icon ?? decoId)
            : 'icon_workshop_blueprint_scroll',
          label: '图纸×1',
        };
      }
      default:
        return null;
    }
  }

  private _obtainEntryIconKeys(entries: ItemObtainEntry[]): string[] {
    const keys: string[] = [];
    for (const entry of entries) {
      if (entry.kind === 'direct_currency') {
        if (entry.currency === 'stamina') keys.push('icon_energy');
        else if (entry.currency === 'huayuan') keys.push('icon_huayuan');
        else if (entry.currency === 'diamond') keys.push('icon_gem');
        else keys.push('icon_flower_sign_coin');
      } else if (entry.kind === 'workshop_material') {
        keys.push(resolveWorkshopMaterialIconKey(entry.materialId));
      } else if (entry.kind === 'deco') {
        keys.push(DECO_MAP.get(entry.decoId)?.icon ?? entry.decoId);
      } else if (entry.kind === 'unlock_icon') {
        keys.push(entry.iconKey);
      } else if (entry.kind === 'board_item') {
        keys.push(entry.itemId);
      }
    }
    return keys;
  }

  private _setScroll(y: number): void {
    const viewportH = Math.max(1, this._areaH - 64 - VIEWPORT_BOTTOM_INSET);
    const minY = Math.min(0, viewportH - this._contentHeight);
    this._scrollY = Math.max(minY, Math.min(0, y));
    if (this._list) this._list.y = this._scrollY;
  }

  private _makeIcon(key: string, size: number): PIXI.Container {
    const root = new PIXI.Container();
    const tex = TextureCache.get(key);
    if (tex && tex.width > 0) {
      const sprite = new PIXI.Sprite(tex);
      sprite.anchor.set(0.5);
      sprite.scale.set(size / Math.max(tex.width, tex.height));
      root.addChild(sprite);
    } else {
      const fallback = new PIXI.Graphics();
      fallback.beginFill(0x77D2C8);
      fallback.drawCircle(0, 0, size * 0.36);
      fallback.endFill();
      root.addChild(fallback);
    }
    return root;
  }

  /** 图纸奖励：与工坊图纸商店相同的卷轴+家具剪影；其它奖励走普通图标 */
  private _makeGrantIcon(grant: CoolSummerGrant, size: number): PIXI.Container {
    if (grant.kind === 'blueprint') {
      const root = new PIXI.Container();
      const decoId = WORKSHOP_BLUEPRINT_MAP.get(grant.blueprintId)?.outputDecoId;
      if (decoId) {
        appendWorkshopBlueprintIcon(root, decoId, 0, 0, size);
      } else {
        return this._makeIcon('icon_workshop_blueprint_scroll', size);
      }
      return root;
    }
    return this._makeIcon(this._grantIcon(grant), size);
  }

  private _rewardIconKeys(): string[] {
    const keys = new Set<string>([
      'icon_cool_summer_fan',
      WORKSHOP_BLUEPRINT_SCROLL_KEY,
      'icon_workshop_blueprint_scroll',
    ]);
    const addGrantKeys = (grant: CoolSummerGrant) => {
      if (grant.kind === 'blueprint') {
        const decoId = WORKSHOP_BLUEPRINT_MAP.get(grant.blueprintId)?.outputDecoId;
        if (!decoId) return;
        const deco = DECO_MAP.get(decoId);
        for (const k of collectFurniturePreloadKeys(decoId, deco?.icon ?? decoId)) {
          keys.add(k);
        }
        return;
      }
      keys.add(this._grantIcon(grant));
    };
    for (const product of COOL_SUMMER_SHOP_PRODUCTS) addGrantKeys(product.grant);
    for (const category of COOL_SUMMER_SHOP_CATEGORIES) {
      for (const grant of category.completionRewards) addGrantKeys(grant);
    }
    return Array.from(keys);
  }

  private _grantIcon(grant: CoolSummerGrant): string {
    switch (grant.kind) {
      case 'stamina':
        return 'icon_energy';
      case 'huayuan':
        return 'icon_huayuan';
      case 'diamond':
        return 'icon_gem';
      case 'workshopMaterial':
        return resolveWorkshopMaterialIconKey(grant.materialId);
      case 'blueprint':
        return 'icon_workshop_blueprint_scroll';
      case 'deco':
        return DECO_MAP.get(grant.decoId)?.icon ?? grant.decoId;
      default:
        return 'icon_gift';
    }
  }

  private _grantLabel(grant: CoolSummerGrant): string {
    switch (grant.kind) {
      case 'stamina':
        return `体力×${grant.amount}`;
      case 'huayuan':
        return `花愿×${grant.amount}`;
      case 'diamond':
        return `钻石×${grant.amount}`;
      case 'workshopMaterial':
        return `材料×${grant.amount}`;
      case 'blueprint':
        return '图纸×1';
      case 'deco':
        return DECO_MAP.get(grant.decoId)?.name ?? '家具×1';
      default:
        return '奖励';
    }
  }

  private _grantValueLabel(grant: CoolSummerGrant): string {
    switch (grant.kind) {
      case 'stamina':
      case 'huayuan':
      case 'diamond':
      case 'workshopMaterial':
        return `${grant.amount}`;
      case 'blueprint':
      case 'deco':
        return '1';
      default:
        return '';
    }
  }

  private _grantsLabel(grants: readonly CoolSummerGrant[]): string {
    return grants.map(g => this._grantLabel(g)).join(' + ');
  }
}
