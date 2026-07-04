/**
 * 许愿喷泉抽奖面板 — 挂 OverlayManager，可从大地图节点打开；高于 WorldMapPanel。
 */
import * as PIXI from 'pixi.js';
import { Game } from '@/core/Game';
import { EventBus } from '@/core/EventBus';
import { TweenManager, Ease } from '@/core/TweenManager';
import { OverlayManager } from '@/core/OverlayManager';
import { shareAppMessageWithAnalytics } from '@/utils/wechatShare';
import { createWishLuckyShare } from '@/config/ShareConfig';
import { TextureCache } from '@/utils/TextureCache';
import { ToastMessage } from '@/gameobjects/ui/ToastMessage';
import { createAdIcon, createFreeAdBadge } from '@/gameobjects/ui/AdBadge';
import { DESIGN_WIDTH, FONT_FAMILY } from '@/config/Constants';
import {
  FLOWER_SIGN_DRAW_COST_MULTI,
  FLOWER_SIGN_DRAW_COST_SINGLE,
} from '@/config/FlowerSignGachaConfig';
import {
  FlowerSignGachaManager,
  grantFlowerSignRewards,
  type FlowerSignReward,
} from '@/managers/FlowerSignGachaManager';
import { FlowerSignTicketManager } from '@/managers/FlowerSignTicketManager';
import { AdManager, AdScene } from '@/managers/AdManager';
import { AdEntitlementManager, DailyAdEntitlement } from '@/managers/AdEntitlementManager';
import { SaveManager } from '@/managers/SaveManager';
import { ItemObtainOverlay, type ItemObtainEntry } from '@/gameobjects/ui/ItemObtainOverlay';
import { getWorkshopMaterialDisplayName } from '@/config/FurnitureWorkshopConfig';

function flowerSignRewardsToObtainEntries(rewards: FlowerSignReward[]): ItemObtainEntry[] {
  return rewards.map((r) => {
    switch (r.kind) {
      case 'reward_box_item':
        return { kind: 'board_item', itemId: r.itemId, count: r.count };
      case 'direct_stamina':
        return { kind: 'direct_currency', currency: 'stamina', amount: r.amount };
      case 'direct_huayuan':
        return { kind: 'direct_currency', currency: 'huayuan', amount: r.amount };
      case 'direct_diamond':
        return { kind: 'direct_currency', currency: 'diamond', amount: r.amount };
      case 'workshop_dye':
        return {
          kind: 'workshop_material',
          materialId: r.materialId,
          count: r.count,
          label: getWorkshopMaterialDisplayName(r.materialId),
        };
    }
  });
}

const Z = 11500;
/** 无场景图时回退用圆角壳 */
const FALLBACK_CORNER_R = 26;
/** 全屏立绘：红彩带标题 + 许愿硬币行整体下移 */
const IMMERSIVE_HEADER_DY = 100;
/** 全屏立绘：底部提示文案 + 许愿按钮行整体下移 */
const IMMERSIVE_IDLE_DY = 50;
/** 回退壳：标题区 / 底部交互区与立绘模式对齐的纵向偏移 */
const FALLBACK_HEADER_DY = 100;
const FALLBACK_IDLE_DY = 50;
const CLOSE_BTN_MAX_SIDE = 56;
const CLOSE_BTN_HIT_PAD = 12;
/** 全屏立绘模式：关闭钮距右缘（与装修面板一致） */
const IMMERSIVE_CLOSE_INSET_RIGHT = 44;
/** 立绘模式许愿按钮：标题 / 券标字号（免费十连再放大一档） */
const WISH_DECO_BTN_MAX_W = 178;
const WISH_DECO_TITLE_FS = 20;
const WISH_DECO_TITLE_FS_FREE = 24;
const WISH_DECO_COST_FS = 22;
const WISH_DECO_COST_FS_FREE = 28;
const WISH_DECO_COIN_ICON_H = 26;
const WISH_DECO_COIN_ICON_H_FREE = 30;

export class FlowerSignGachaPanel extends PIXI.Container {
  private _isOpen = false;
  private _opening = false;
  private _bg!: PIXI.Graphics;
  private _panelRoot!: PIXI.Container;
  private _idleLayer!: PIXI.Container;
  private _ticketText!: PIXI.Text;
  /** 已扣券、待点击获得遮罩发奖（强关面板时在此补发） */
  private _pendingRewards: FlowerSignReward[] | null = null;
  private _drawInProgress = false;
  private _idleLayout: {
    W: number;
    H: number;
    immersiveArt: boolean;
    idleLayerY: number;
    innerH: number;
  } | null = null;
  /** 立绘/白壳 + 标题硬币行；open 预加载完成后重建，避免构造阶段无纹理永久停在空白壳 */
  private _chromeLayer!: PIXI.Container;
  private _closeBtn!: PIXI.Container;
  private _layout!: {
    W: number;
    H: number;
    pw: number;
    ph: number;
    px: number;
    py: number;
    maxArtW: number;
    maxArtH: number;
    artCenterY: number;
  };
  private _assetUnsub: (() => void) | null = null;

  constructor() {
    super();
    this.visible = false;
    this.zIndex = Z;
    this.sortableChildren = true;
    this._build();
    EventBus.on('panel:openFlowerSignGacha', () => this.open());
    EventBus.on('flowerSignTicket:changed', () => this._syncTicketLabel());
  }

  get isOpen(): boolean {
    return this._isOpen;
  }

  open(): void {
    if (this._isOpen || this._opening) return;
    this._opening = true;
    void TextureCache.preloadPanelAssets('flowerSignGacha').finally(() => {
      this._opening = false;
      this._openReady();
    });
  }

  private _openReady(): void {
    if (this._isOpen) return;
    this._isOpen = true;
    OverlayManager.bringToFront();
    this.visible = true;
    this._assetUnsub = TextureCache.onAssetGroupLoaded('flowerSignGacha', () => {
      if (this._isOpen && !this._drawInProgress) this._rebuildChrome();
    });
    this._rebuildChrome();
    this.alpha = 0;
    TweenManager.to({ target: this, props: { alpha: 1 }, duration: 0.25, ease: Ease.easeOutQuad });
  }

  close(): void {
    this._opening = false;
    if (!this._isOpen) return;
    ItemObtainOverlay.forceClose();
    if (this._pendingRewards) {
      grantFlowerSignRewards(this._pendingRewards);
      SaveManager.save();
      this._pendingRewards = null;
    }
    this._drawInProgress = false;
    this._isOpen = false;
    this._assetUnsub?.();
    this._assetUnsub = null;
    TweenManager.to({
      target: this,
      props: { alpha: 0 },
      duration: 0.2,
      ease: Ease.easeInQuad,
      onComplete: () => {
        this.visible = false;
      },
    });
  }

  private _build(): void {
    const W = DESIGN_WIDTH;
    const H = Game.logicHeight;

    this._bg = new PIXI.Graphics();
    this._bg.beginFill(0x000000, 0.58);
    this._bg.drawRect(0, 0, W, H);
    this._bg.endFill();
    this._bg.eventMode = 'static';
    this._bg.on('pointertap', () => this.close());
    this.addChild(this._bg);

    this._panelRoot = new PIXI.Container();
    this._panelRoot.sortableChildren = true;
    this._panelRoot.eventMode = 'static';
    this._panelRoot.on('pointertap', (e: PIXI.FederatedPointerEvent) => e.stopPropagation());
    this.addChild(this._panelRoot);

    const pw = Math.min(560, W - 32);
    const ph = Math.min(620, H - Game.safeTop - 80);
    const px = (W - pw) / 2;
    const py = Game.safeTop + 56 + (H - Game.safeTop - 56 - ph) / 2;

    const topBand = Game.safeTop + 64;
    const bottomReserve = 96;
    /** 略增高区：不规则立绘上下留白多，避免缩得过小 */
    const maxArtW = W - 8;
    const maxArtH = Math.max(260, H - topBand - bottomReserve);
    const artCenterY = topBand + maxArtH * 0.5;

    this._layout = {
      W,
      H,
      pw,
      ph,
      px,
      py,
      maxArtW,
      maxArtH,
      artCenterY,
    };

    this._chromeLayer = new PIXI.Container();
    this._panelRoot.addChild(this._chromeLayer);

    this._closeBtn = this._createCloseButton();
    this._panelRoot.addChild(this._closeBtn);

    this._idleLayer = new PIXI.Container();
    this._panelRoot.addChild(this._idleLayer);

    this._rebuildChrome();
  }

  /** 纹理异步落盘后刷新上半屏布局（immersive ↔ fallback） */
  private _rebuildChrome(): void {
    if (!this._layout || !this._chromeLayer || !this._closeBtn) return;

    const {
      W,
      H,
      pw,
      ph,
      px,
      py,
      maxArtW,
      maxArtH,
      artCenterY,
    } = this._layout;

    this._chromeLayer.removeChildren();

    const sceneTex = TextureCache.get('flower_sign_gacha_scene_nb2');
    let immersive = !!(sceneTex && sceneTex.width > 2);
    if (immersive && sceneTex) {
      const tw = sceneTex.width;
      const th = sceneTex.height;
      const scale = Math.min(maxArtW / tw, maxArtH / th);
      const sp = new PIXI.Sprite(sceneTex);
      sp.anchor.set(0.5, 0.4);
      sp.scale.set(scale);
      sp.position.set(W / 2, artCenterY + 12);
      sp.eventMode = 'none';
      this._chromeLayer.addChild(sp);
    } else {
      const shell = new PIXI.Graphics();
      shell.beginFill(0xfff7f0, 0.98);
      shell.drawRoundedRect(px, py, pw, ph, FALLBACK_CORNER_R);
      shell.endFill();
      shell.lineStyle(2.5, 0xd4a574, 0.75);
      shell.drawRoundedRect(px, py, pw, ph, FALLBACK_CORNER_R);
      this._chromeLayer.addChild(shell);
      immersive = false;
    }

    this._layoutCloseButton(immersive, px, pw, py);
    this._refreshCloseButtonTexture();

    if (!immersive) {
      const titleY = py + 16 + FALLBACK_HEADER_DY;
      const ticketY = py + 52 + FALLBACK_HEADER_DY;

      const title = new PIXI.Text('许愿喷泉', {
        fontSize: 28,
        fill: 0x4e342e,
        fontFamily: FONT_FAMILY,
        fontWeight: 'bold',
      });
      title.anchor.set(0.5, 0);
      title.position.set(W / 2, titleY);
      this._chromeLayer.addChild(title);

      const ticketRow = new PIXI.Container();
      ticketRow.position.set(W / 2, ticketY);
      const tTex = TextureCache.get('icon_flower_sign_coin');
      if (tTex?.width) {
        const tsp = new PIXI.Sprite(tTex);
        tsp.anchor.set(1, 0.5);
        tsp.height = 28;
        tsp.width = (tTex.width / tTex.height) * 28;
        tsp.position.set(-6, 0);
        ticketRow.addChild(tsp);
      }
      this._ticketText = new PIXI.Text('', {
        fontSize: 18,
        fill: 0x5d4037,
        fontFamily: FONT_FAMILY,
        fontWeight: 'bold',
      });
      this._ticketText.anchor.set(0, 0.5);
      this._ticketText.position.set(8, 0);
      ticketRow.addChild(this._ticketText);
      this._chromeLayer.addChild(ticketRow);
      this._syncTicketLabel();
    } else {
      this._buildGachaRibbonHeader(W);
      this._syncTicketLabel();
    }

    this._buildIdleContent(
      W,
      H,
      immersive,
      immersive ? 0 : py + 118 + FALLBACK_IDLE_DY,
      ph - 130,
    );
    this._idleLayer.visible = true;
  }

  /**
   * 许愿喷泉：装修同款红彩带标题 + 许愿硬币（与单张透明底立绘搭配）
   */
  private _buildGachaRibbonHeader(W: number): void {
    const cx = W / 2;
    const ribbon = this._gachaRibbonLayout();
    let y = ribbon.topY;
    const decoRibbon = TextureCache.get('deco_panel_title_ribbon');
    let titleCenterY = ribbon.centerY;
    let onRedRibbon = false;

    if (decoRibbon && decoRibbon.width > 2) {
      const BW = 440;
      let BH = Math.round((BW * decoRibbon.height) / decoRibbon.width);
      BH = Math.max(52, Math.min(86, BH));
      const sp = new PIXI.Sprite(decoRibbon);
      sp.anchor.set(0.5, 0.5);
      sp.position.set(cx, ribbon.centerY);
      sp.width = BW;
      sp.height = BH;
      this._chromeLayer.addChild(sp);
      y = ribbon.bottomY + 10;
      onRedRibbon = true;
    } else {
      const title = new PIXI.Text('许愿喷泉', {
        fontSize: 28,
        fill: 0x4e342e,
        fontFamily: FONT_FAMILY,
        fontWeight: 'bold',
      });
      title.anchor.set(0.5, 0);
      title.position.set(cx, y);
      this._chromeLayer.addChild(title);
      y += title.height + 10;
    }

    if (onRedRibbon) {
      const titleOnRibbon = new PIXI.Text('许愿喷泉', {
        fontSize: 24,
        fill: 0xffffff,
        fontFamily: FONT_FAMILY,
        fontWeight: 'bold',
        stroke: 0x4e2018,
        strokeThickness: 3,
      });
      titleOnRibbon.anchor.set(0.5, 0.5);
      titleOnRibbon.position.set(cx, titleCenterY);
      this._chromeLayer.addChild(titleOnRibbon);
    }

    y += 8;

    const ticketRow = new PIXI.Container();
    ticketRow.position.set(cx, y);
    const tTex = TextureCache.get('icon_flower_sign_coin');
    if (tTex?.width) {
      const tsp = new PIXI.Sprite(tTex);
      tsp.anchor.set(1, 0.5);
      tsp.height = 28;
      tsp.width = (tTex.width / tTex.height) * 28;
      tsp.position.set(-6, 0);
      ticketRow.addChild(tsp);
    }
    this._ticketText = new PIXI.Text('', {
      fontSize: 18,
      fill: 0xfff8f0,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: 0x3e2723,
      strokeThickness: 2,
      dropShadow: true,
      dropShadowColor: 0x000000,
      dropShadowAlpha: 0.35,
      dropShadowBlur: 2,
      dropShadowDistance: 1,
    });
    this._ticketText.anchor.set(0, 0.5);
    this._ticketText.position.set(8, 0);
    ticketRow.addChild(this._ticketText);
    this._chromeLayer.addChild(ticketRow);
    this._syncTicketLabel();
  }

  private _syncTicketLabel(): void {
    this._ticketText.text = `：${FlowerSignTicketManager.count}`;
  }

  private _createCloseButton(): PIXI.Container {
    const btn = new PIXI.Container();
    btn.zIndex = 30;
    btn.eventMode = 'static';
    btn.cursor = 'pointer';
    const closeTex = TextureCache.get('deco_nb2_close_btn_1x1') ?? TextureCache.get('warehouse_close_btn');
    const closeSp = new PIXI.Sprite(closeTex ?? PIXI.Texture.EMPTY);
    closeSp.anchor.set(0.5);
    if (closeTex && closeTex.width > 0) {
      const s = CLOSE_BTN_MAX_SIDE / Math.max(closeTex.width, closeTex.height);
      closeSp.scale.set(s);
    } else {
      const fallback = new PIXI.Graphics();
      fallback.beginFill(0xef6b6b, 1);
      fallback.drawCircle(0, 0, 22);
      fallback.endFill();
      fallback.lineStyle(2.5, 0xffffff, 0.95);
      fallback.drawCircle(0, 0, 22);
      fallback.lineStyle(3, 0xffffff, 1);
      fallback.moveTo(-8, -8);
      fallback.lineTo(8, 8);
      fallback.moveTo(8, -8);
      fallback.lineTo(-8, 8);
      btn.addChild(fallback);
    }
    if (closeSp.texture !== PIXI.Texture.EMPTY) btn.addChild(closeSp);
    const hit = Math.max(CLOSE_BTN_MAX_SIDE + CLOSE_BTN_HIT_PAD * 2, 72);
    btn.hitArea = new PIXI.Circle(0, 0, hit / 2);
    const onClose = (e: PIXI.FederatedPointerEvent): void => {
      e.stopPropagation();
      this.close();
    };
    btn.on('pointerdown', onClose);
    btn.on('pointertap', onClose);
    return btn;
  }

  private _layoutCloseButton(immersive: boolean, px: number, pw: number, py: number): void {
    const { W } = this._layout;
    if (immersive) {
      const { x, y } = this._immersiveCloseButtonPos(W);
      this._closeBtn.position.set(x, y);
      return;
    }
    this._closeBtn.position.set(px + pw - 28, py + 24);
  }

  /** 与 `_buildGachaRibbonHeader` 红彩带标题同行，避免贴顶栏/胶囊区 */
  private _immersiveCloseButtonPos(W: number): { x: number; y: number } {
    const ribbon = this._gachaRibbonLayout();
    return {
      x: W - IMMERSIVE_CLOSE_INSET_RIGHT,
      y: ribbon.centerY + 10,
    };
  }

  private _gachaRibbonLayout(): { topY: number; centerY: number; bottomY: number } {
    const topY = Game.safeTop + 28 + IMMERSIVE_HEADER_DY;
    const decoRibbon = TextureCache.get('deco_panel_title_ribbon');
    if (decoRibbon && decoRibbon.width > 2) {
      const BW = 440;
      let BH = Math.round((BW * decoRibbon.height) / decoRibbon.width);
      BH = Math.max(52, Math.min(86, BH));
      return { topY, centerY: topY + BH / 2, bottomY: topY + BH };
    }
    return { topY, centerY: topY + 22, bottomY: topY + 44 };
  }

  private _refreshCloseButtonTexture(): void {
    if (!this._closeBtn) return;
    this._closeBtn.removeChildren();
    const closeTex = TextureCache.get('deco_nb2_close_btn_1x1') ?? TextureCache.get('warehouse_close_btn');
    if (closeTex && closeTex.width > 0) {
      const closeSp = new PIXI.Sprite(closeTex);
      closeSp.anchor.set(0.5);
      const s = CLOSE_BTN_MAX_SIDE / Math.max(closeTex.width, closeTex.height);
      closeSp.scale.set(s);
      this._closeBtn.addChild(closeSp);
    } else {
      const fallback = new PIXI.Graphics();
      fallback.beginFill(0xef6b6b, 1);
      fallback.drawCircle(0, 0, 22);
      fallback.endFill();
      fallback.lineStyle(2.5, 0xffffff, 0.95);
      fallback.drawCircle(0, 0, 22);
      fallback.lineStyle(3, 0xffffff, 1);
      fallback.moveTo(-8, -8);
      fallback.lineTo(8, 8);
      fallback.moveTo(8, -8);
      fallback.lineTo(-8, 8);
      this._closeBtn.addChild(fallback);
    }
  }

  private _buildIdleContent(
    W: number,
    H: number,
    immersiveArt: boolean,
    idleLayerY: number,
    innerH: number,
  ): void {
    this._idleLayout = { W, H, immersiveArt, idleLayerY, innerH };
    this._idleLayer.removeChildren();
    this._idleLayer.position.set(0, idleLayerY);

    let btnRowY: number;
    if (immersiveArt) {
      /** 上移到画内喷泉石基一带（相对原 H-178 再上移约 70px） */
      btnRowY = H - 248 - idleLayerY + IMMERSIVE_IDLE_DY;
    } else {
      btnRowY = Math.min(innerH * 0.4, 228) + 80;
    }

    if (!immersiveArt) {
      this._idleLayer.addChild(
        this._makeStackedGreenBtns(W, btnRowY, () => this._doDraw('single'), () => this._doDraw('multi')),
      );
    } else {
      const row = new PIXI.Container();
      row.position.set(W / 2, btnRowY);
      const gap = 16;
      const maxBtnW = WISH_DECO_BTN_MAX_W;
      const hasDailyAdDraw = AdEntitlementManager.canUseDaily(DailyAdEntitlement.FLOWER_SIGN_DAILY_DRAW);
      const b1 = this._makeDecoWishBtn(
        '许愿一次',
        FLOWER_SIGN_DRAW_COST_SINGLE,
        maxBtnW,
        immersiveArt,
        () => this._doDraw('single'),
      );
      const b2 = this._makeDecoWishBtn(
        '许愿十次',
        hasDailyAdDraw ? 0 : FLOWER_SIGN_DRAW_COST_MULTI,
        maxBtnW,
        immersiveArt,
        () => this._doDraw('multi'),
        hasDailyAdDraw,
      );
      const hw = maxBtnW + gap;
      b1.position.set(-hw / 2, 0);
      b2.position.set(hw / 2, 0);
      row.addChild(b1, b2);
      this._idleLayer.addChild(row);
    }
  }

  /** 参考占卜页：横向双 pill + 文案在上、券标在按钮内 */
  private _makeDecoWishBtn(
    titleAbove: string,
    cost: number,
    maxBtnW: number,
    fullScene: boolean,
    onTap: () => void,
    isFreePromo = false,
  ): PIXI.Container {
    const root = new PIXI.Container();
    root.eventMode = 'static';
    root.cursor = 'pointer';
    if (isFreePromo) root.scale.set(1.06);

    const btnTex = TextureCache.get('deco_card_btn_1');
    let hitW = maxBtnW;
    let hitH = 48;
    let sp: PIXI.Sprite | null = null;

    if (btnTex && btnTex.width > 2) {
      const s = new PIXI.Sprite(btnTex);
      s.anchor.set(0.5);
      const sc = maxBtnW / btnTex.width;
      s.scale.set(sc);
      hitW = btnTex.width * sc;
      hitH = btnTex.height * sc;
      sp = s;
      root.addChild(s);
    } else {
      const g = new PIXI.Graphics();
      g.beginFill(isFreePromo ? 0xffa726 : 0x66bb6a, 0.98);
      g.drawRoundedRect(-maxBtnW / 2, -26, maxBtnW, 52, 22);
      g.endFill();
      if (isFreePromo) {
        g.lineStyle(2.5, 0xffeb3b, 0.95);
        g.drawRoundedRect(-maxBtnW / 2, -26, maxBtnW, 52, 22);
      }
      root.addChild(g);
      hitH = 52;
    }

    if (isFreePromo && sp) {
      const glow = new PIXI.Graphics();
      glow.beginFill(0xffeb3b, 0.28);
      glow.drawEllipse(0, 0, hitW * 0.58, hitH * 0.72);
      glow.endFill();
      root.addChildAt(glow, 0);
    }

    const costRow = new PIXI.Container();
    const icTex = TextureCache.get('icon_flower_sign_coin');
    const coinIconH = isFreePromo ? WISH_DECO_COIN_ICON_H_FREE : WISH_DECO_COIN_ICON_H;
    if (cost > 0 && icTex && icTex.width > 1) {
      const ic = new PIXI.Sprite(icTex);
      ic.anchor.set(1, 0.5);
      ic.height = coinIconH;
      ic.width = (icTex.width / icTex.height) * coinIconH;
      ic.position.set(-2, 0);
      costRow.addChild(ic);
    }
    const costLabel = isFreePromo ? '免费十连' : `×${cost}`;
    const cx = new PIXI.Text(costLabel, {
      fontSize: isFreePromo ? WISH_DECO_COST_FS_FREE : WISH_DECO_COST_FS,
      fill: isFreePromo ? 0xffeb3b : 0xffffff,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: isFreePromo ? 0xbf360c : 0x3e2723,
      strokeThickness: isFreePromo ? 4 : 3,
      dropShadow: isFreePromo,
      dropShadowColor: 0x000000,
      dropShadowAlpha: 0.45,
      dropShadowBlur: 3,
      dropShadowDistance: 1,
    });
    cx.anchor.set(0, 0.5);
    cx.position.set(6, 0);
    costRow.addChild(cx);
    if (isFreePromo) {
      const adIcon = createAdIcon(26);
      adIcon.position.set(cx.x + cx.width + 18, 0);
      costRow.addChild(adIcon);
    }
    const cb = costRow.getLocalBounds();
    costRow.pivot.set(cb.x + cb.width / 2, cb.y + cb.height / 2);
    costRow.position.set(0, sp ? -2 : 0);
    root.addChild(costRow);

    const titleFill = isFreePromo ? 0xfff176 : (fullScene ? 0xfff5eb : 0x4e342e);
    const title = new PIXI.Text(titleAbove, {
      fontSize: isFreePromo ? WISH_DECO_TITLE_FS_FREE : WISH_DECO_TITLE_FS,
      fill: titleFill,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: isFreePromo ? 0xbf360c : 0x2c1e16,
      strokeThickness: isFreePromo ? 4 : (fullScene ? 3 : 2),
      dropShadow: fullScene || isFreePromo,
      dropShadowColor: 0x000000,
      dropShadowAlpha: isFreePromo ? 0.55 : (fullScene ? 0.45 : 0),
      dropShadowBlur: isFreePromo ? 3 : 2,
      dropShadowDistance: 1,
    });
    title.anchor.set(0.5, 1);
    title.position.set(0, -hitH / 2 - 10);
    root.addChild(title);

    const topPad = title.height + 12;
    root.hitArea = new PIXI.Rectangle(
      -hitW / 2 - 6,
      -hitH / 2 - topPad,
      hitW + 12,
      hitH + topPad + 6,
    );
    root.on('pointertap', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      onTap();
    });
    return root;
  }

  /** 无全屏场景时维持纵向绿色双按钮 */
  private _makeStackedGreenBtns(
    W: number,
    btnY: number,
    onSingle: () => void,
    onMulti: () => void,
  ): PIXI.Container {
    const wrap = new PIXI.Container();
    const mk = (label: string, cost: number, y: number, onTap: () => void, isFreePromo = false): void => {
      const c = new PIXI.Container();
      c.position.set(W / 2, y);
      c.eventMode = 'static';
      c.cursor = 'pointer';
      const btnW = isFreePromo ? 280 : 260;
      const btnH = isFreePromo ? 50 : 44;
      const g = new PIXI.Graphics();
      g.beginFill(isFreePromo ? 0xffa726 : 0x66bb6a, 0.98);
      g.drawRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 22);
      g.endFill();
      if (isFreePromo) {
        g.lineStyle(2.5, 0xffeb3b, 0.95);
        g.drawRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 22);
      }
      c.addChild(g);
      const line = isFreePromo ? `${label} · 免费十连` : `${label}（${cost}券）`;
      const t = new PIXI.Text(line, {
        fontSize: isFreePromo ? 22 : 20,
        fill: isFreePromo ? 0xffeb3b : 0xffffff,
        fontFamily: FONT_FAMILY,
        fontWeight: 'bold',
        stroke: isFreePromo ? 0xbf360c : 0x2c6b35,
        strokeThickness: isFreePromo ? 4 : 3,
      });
      t.anchor.set(0.5);
      c.addChild(t);
      if (isFreePromo) {
        const badge = createFreeAdBadge(18, 0xffeb3b, 0xbf360c, '看广告', 24);
        badge.position.set(t.x + t.width / 2 + 38, 0);
        c.addChild(badge);
      }
      c.hitArea = new PIXI.Rectangle(-btnW / 2, -btnH / 2, btnW, btnH);
      c.on('pointertap', (e: PIXI.FederatedPointerEvent) => {
        e.stopPropagation();
        onTap();
      });
      wrap.addChild(c);
    };
    const hasDailyAdDraw = AdEntitlementManager.canUseDaily(DailyAdEntitlement.FLOWER_SIGN_DAILY_DRAW);
    mk('许愿一次', FLOWER_SIGN_DRAW_COST_SINGLE, btnY, onSingle);
    mk('许愿十次', hasDailyAdDraw ? 0 : FLOWER_SIGN_DRAW_COST_MULTI, btnY + 62, onMulti, hasDailyAdDraw);
    return wrap;
  }

  private _doDraw(kind: 'single' | 'multi'): void {
    if (this._drawInProgress) return;
    this._drawInProgress = true;

    if (
      kind === 'multi'
      && AdEntitlementManager.canUseDaily(DailyAdEntitlement.FLOWER_SIGN_DAILY_DRAW)
    ) {
      AdManager.showRewardedAd(AdScene.FLOWER_SIGN_DAILY_DRAW, (success) => {
        console.log('[FlowerSignGacha] 广告十连回调:', success);
        if (!success) {
          this._drawInProgress = false;
          ToastMessage.show('广告未看完，未许愿');
          return;
        }
        if (!AdEntitlementManager.markDailyUsed(DailyAdEntitlement.FLOWER_SIGN_DAILY_DRAW)) {
          this._drawInProgress = false;
          ToastMessage.show('今日广告许愿已使用');
          return;
        }
        const res = FlowerSignGachaManager.drawMultiFree();
        if (!res.ok) {
          this._drawInProgress = false;
          ToastMessage.show('奖池配置异常');
          return;
        }
        this._showResults(res.rewards);
      });
      return;
    }
    const res = kind === 'single' ? FlowerSignGachaManager.drawSingle() : FlowerSignGachaManager.drawMulti();
    if (!res.ok) {
      this._drawInProgress = false;
      if (res.reason === 'no_ticket') ToastMessage.show('许愿硬币不足');
      else ToastMessage.show('奖池配置异常');
      return;
    }
    this._showResults(res.rewards);
  }

  private _showIdle(): void {
    if (this._idleLayout) {
      this._buildIdleContent(
        this._idleLayout.W,
        this._idleLayout.H,
        this._idleLayout.immersiveArt,
        this._idleLayout.idleLayerY,
        this._idleLayout.innerH,
      );
    }
    this._idleLayer.visible = true;
    this._syncTicketLabel();
  }

  private _showResults(rewards: FlowerSignReward[]): void {
    this._syncTicketLabel();
    this._pendingRewards = rewards;
    ItemObtainOverlay.show(
      flowerSignRewardsToObtainEntries(rewards),
      () => {
        const pending = this._pendingRewards;
        this._pendingRewards = null;
        if (pending) {
          grantFlowerSignRewards(pending);
          SaveManager.save();
        }
        this._drawInProgress = false;
        this._showIdle();
      },
      {
        shareLabel: '晒欧气',
        onShare: async (overlay) => {
          const imageUrl = await overlay.createShareSnapshotImageUrl();
          shareAppMessageWithAnalytics(
            createWishLuckyShare(imageUrl ?? undefined),
            'wish_lucky',
            { has_snapshot: !!imageUrl },
          );
          ToastMessage.show(imageUrl ? '已分享本次许愿结果' : '已分享许愿好运');
        },
      },
    );
  }
}
