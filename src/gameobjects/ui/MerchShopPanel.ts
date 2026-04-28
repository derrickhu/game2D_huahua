/**
 * 游戏内「购买物品」商店弹窗：
 * - **底板**：`shop_merch_panel_frame`（紫木外框 + 楣/棚/绳），顶带标题「商店」（与装修面板顶栏同族白字+赭描边+投影；`MERCH_FRAME_TITLE_OFFSET_Y` 可微调垂直）；右上角**透明关闭热区**。
 * - **货架组件**：纵向三行 + 每行三槽位；层板顶黄丝带显示 **免费商店 / 神秘商店 / 神秘商店**（第三栏与第二栏同逻辑占位，与 `MERCH_SHELVES` 顺序一致）；**刷新说明 + 倒计时（`HH:MM:SS`）+ 钻石刷新**在底板内侧底部；上区**上下拖动**（canvas + 滚轮）。
 * 底板整图缩放与 `WarehousePanel` 一致。
 */
import * as PIXI from 'pixi.js';
import { Game } from '@/core/Game';
import { EventBus } from '@/core/EventBus';
import { TweenManager, Ease } from '@/core/TweenManager';
import { DESIGN_WIDTH, FONT_FAMILY, COLORS } from '@/config/Constants';
import { TextureCache } from '@/utils/TextureCache';
import { createAdIcon, createFreeAdBadge } from '@/gameobjects/ui/AdBadge';
import { CurrencyManager } from '@/managers/CurrencyManager';
import { MerchShopManager, type MerchSlotSnapshot } from '@/managers/MerchShopManager';
import { AdEntitlementManager, DailyAdEntitlement } from '@/managers/AdEntitlementManager';
import { MERCH_DIAMOND_REFRESH_SHELF_COST } from '@/config/MerchShopConfig';

/** 相对原先边距略收紧 + 乘系数，整体面板（底板+内嵌货架）约大 6%～10%，仍钳在屏内 */
const MERCH_PANEL_PAD_X = 22;
const MERCH_PANEL_PAD_Y = 56;
const MERCH_PANEL_SCALE_BOOST = 1.14;
const MERCH_PANEL_CAP_PAD_X = 4;
const MERCH_PANEL_CAP_PAD_Y = 10;

function merchPanelScale(texW: number, texH: number, logicH: number): number {
  const fit = Math.min(
    (DESIGN_WIDTH - MERCH_PANEL_PAD_X) / texW,
    (logicH - MERCH_PANEL_PAD_Y) / texH,
  );
  const boosted = fit * MERCH_PANEL_SCALE_BOOST;
  const cap = Math.min(
    (DESIGN_WIDTH - MERCH_PANEL_CAP_PAD_X) / texW,
    (logicH - MERCH_PANEL_CAP_PAD_Y) / texH,
  );
  return Math.min(boosted, cap);
}

/** 底板 `shop_merch_panel_frame.png` 当前裁边后约 741×1292；内区为楣/棚/绳之下的紫木板陈列带 */
const FRAME_REF_W = 741;
const FRAME_REF_H = 1292;
const FRAME_INNER = { x: 52, y: 372, w: 636, h: 833 };

/** 层板 `shop_section_panel_bg.png` 裁边后约 1089×765 */
const REF_SEC_W = 1089;
const REF_SEC_H = 765;
const REF_SLOT_CY = 407;
const REF_SLOT_DX = [-308.5, -2, 303.5] as const;
const REF_SLOT_SIDE = 280;
/** 灰槽 `shop_item_slot` 相对参考尺寸的显示缩放（仅缩小格子，槽心仍用策划坐标） */
const MERCH_SLOT_FRAME_SCALE = 0.74;
/** 「剩余：n」纯文字底边与灰槽顶边之间的空隙（`REF_SEC_H` 纹理坐标系，乘 `fsy`）；越小字越靠近灰框、离棚越远 */
const MERCH_STOCK_ABOVE_SLOT_REF = 5;
/** 「剩余：n」字号（相对 `REF_SEC_H` 缩放，再乘层板 `fsy`） */
const MERCH_STOCK_LABEL_FONT_REF = 30;
/** 灰框底边到购买按钮顶边的空隙（按钮整体在框下方，大按钮时需配合 `slotFrameBottom + gap + scaledH` 定位底边） */
const MERCH_BTN_TOP_GAP = 10;
/** 青绿键上主字 + 浅描边（深字在饱和绿底上可读） */
const MERCH_BTN_LABEL_FILL = 0x2a453c;
const MERCH_BTN_LABEL_STROKE = 0xd8f0e8;
/** 商品购买键目标高度（纹理坐标，越大按钮越醒目） */
const MERCH_BUY_BTN_TARGET_H = 106;
/** 购买键叠字字号（随 `MERCH_BUY_BTN_TARGET_H` 放大） */
const MERCH_BUY_BTN_LABEL_FONT_SIZE = 39;

/** 纵向货架行数（与 MerchShopManager / MERCH_SHELVES 路数一致） */
const SHELF_ROWS = 3;
/** 每行横向槽位数 */
const SHELF_COLS = 3;
const SECTION_GAP = 12;
/** 视口内目标：完整可见的层板行数（用于算放大系数） */
const VISIBLE_SHELF_ROWS = 2;
/**
 * 行内刷新条高度（与层板纹理同坐标系）；条中心靠底板下缘内收，整体落在 `shop_section_panel_bg` 可视区域内。
 */
const MERCH_STRIP_BAR_H = 132;
/** 刷新条底边距层板纹理下沿的内边距（纹理 px；越大整条越靠上，缩小与购买键之间的空白） */
const MERCH_STRIP_BOTTOM_INSET = 101;
/** 整栏底板图相对行顶微调（单层高的比例）；槽位另加 `MERCH_ITEMS_CLUSTER_OFFSET_REF` 仅上移商品区 */
const MERCH_SHELF_CLUSTER_SHIFT = -0.08;
/**
 * 槽位+图标+购买键（含键上价标/「免费」「广告」及叠在键上的说明）相对参考整体上移（负=向上），
 * 按 `fsy = th/REF_SEC_H` 缩放；略下移可在棚/丝带与灰槽之间留出「剩余」说明区。
 */
const MERCH_ITEMS_CLUSTER_OFFSET_REF = -36;

function nativeClientToDesignY(clientY: number): number {
  return (clientY * Game.designHeight) / Game.screenHeight;
}

function federatedPointerToDesignY(e: PIXI.FederatedPointerEvent): number {
  const n = e.nativeEvent as PointerEvent | MouseEvent | undefined;
  if (n != null && typeof (n as PointerEvent).clientY === 'number') {
    return nativeClientToDesignY((n as PointerEvent).clientY);
  }
  return (e.global.y / Game.dpr) * (Game.designHeight / Game.screenHeight);
}

/** 剩余秒数 → `HH:MM:SS`（商店层板底部「刷新时间」） */
function merchFormatCountdownHms(secLeft: number): string {
  const s = Math.max(0, Math.floor(secLeft));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

/** 红关叉中心在底板纹理上的像素（与 `shop_merch_panel_frame` 对齐；仅作透明热区，不再绘制叠层） */
const FRAME_CLOSE_TEX = { x: 695, y: 65 };
/** 顶栏金色标题带文字中心（与底板纹理对齐，约 `FRAME_REF_W×FRAME_REF_H` 空间） */
const FRAME_TITLE_TEX = { x: 372, y: 122 };
/** 主标题相对纹理校准点再上移（设计坐标，已乘 Sf 后叠加） */
const MERCH_FRAME_TITLE_OFFSET_Y = 0;
/**
 * `shop_section_panel_bg` 顶区黄丝带标题纵向参考（距纹理顶边，与 `REF_SEC_H` 同比缩放）。
 */
const REF_SECTION_RIBBON_TITLE_CY = 106;
/** 与 `MERCH_SHELVES` 行顺序一致：免费 / 神秘 / 神秘（第三栏占位复用第二栏） */
const MERCH_SHELF_TITLE_NAMES = ['免费商店', '神秘商店', '神秘商店'] as const;
/** 关闭热区半径（设计坐标，盖住底板上的红叉图即可） */
const MERCH_CLOSE_HIT_RADIUS = 44;

/**
 * 与其它全屏面板顶栏标题一致（如 `DecorationPanel`「家具」：`DECO_PANEL_CHROME_TEXT_BASE` + fontSize 34）
 * — 白字、赭描边、浅投影。
 */
function merchPanelTitleStyle(fontSize: number): Record<string, unknown> {
  return {
    fontFamily: FONT_FAMILY,
    fontWeight: 'bold',
    fontSize,
    fill: 0xffffff,
    stroke: 0x7a4530,
    strokeThickness: Math.max(4, Math.round(5 * Math.min(1.12, fontSize / 34))),
    dropShadow: true,
    dropShadowColor: 0x5a2d10,
    dropShadowBlur: 2,
    dropShadowDistance: 1,
  };
}

interface MerchSlotCell {
  row: number;
  col: number;
  icon: PIXI.Sprite;
  /** 图标最大边（纹理坐标系，与槽位同单位） */
  iconCap: number;
  /** 与家具卡一致：`deco_card_btn_3` 购买 / `deco_card_btn_2` 售罄 */
  buyRoot: PIXI.Container;
  buyBtnSprite: PIXI.Sprite;
  buyOverlay: PIXI.Container;
  btnMaxW: number;
  btnTargetH: number;
  /** 槽位框底边 Y（scrollContent 局部坐标），用于大按钮垂直定位 */
  slotFrameBottom: number;
  /** 剩余库存纯文字（`剩余：n`，置于灰槽上方） */
  badgeRoot: PIXI.Container;
  badgeCount: PIXI.Text;
}

interface MerchRefreshButtonView {
  row: PIXI.Container;
  icon: PIXI.Sprite | null;
  adIcon: PIXI.Container | null;
  label: PIXI.Text;
}

export class MerchShopPanel extends PIXI.Container {
  private _bg!: PIXI.Graphics;
  private _frameRoot!: PIXI.Container;
  private _isOpen = false;
  private _opening = false;
  private _assetUnsub: (() => void) | null = null;
  /** 货架滚动层（有组件底板时存在） */
  private _merchScrollContent: PIXI.Container | null = null;
  private _merchScrollMinY = 0;
  /** 微信等环境：子节点 pointermove 不可靠，改绑 canvas */
  private _merchScrollListening = false;
  private _merchScrollStartDesignY = 0;
  private _merchScrollStartScrollY = 0;
  /** 由 `_buildFrameWithComposedShelves` 填充；无货架纹理时为 false */
  private _merchDataBound = false;
  private _slotCells: MerchSlotCell[] = [];
  /** 与 `MERCH_SHELVES` 路数一致，每层板一条倒计时 */
  private _shelfStripCountdowns: PIXI.Text[] = [];
  private _shelfStripBtns: PIXI.Container[] = [];
  private _shelfRefreshButtonViews: MerchRefreshButtonView[] = [];
  private _merchTickAcc = 0;

  private readonly _onMerchShopChanged = (): void => {
    if (this._isOpen && this._merchDataBound) {
      this._refreshMerchSlots();
      this._refreshMerchShelfStrips();
    }
  };
  private readonly _onCurrencyChanged = (): void => {
    if (this._isOpen && this._merchDataBound) {
      this._refreshMerchSlots();
      this._refreshMerchShelfStrips();
    }
  };
  private readonly _onAdEntitlementChanged = (): void => {
    if (this._isOpen && this._merchDataBound) {
      this._refreshMerchSlots();
      this._refreshMerchShelfStrips();
    }
  };
  private readonly _merchUiTick = (): void => {
    if (!this._isOpen || !this._merchDataBound) return;
    this._merchTickAcc += Game.ticker.deltaMS;
    if (this._merchTickAcc < 500) return;
    this._merchTickAcc = 0;
    this._refreshMerchShelfStrips();
  };

  constructor() {
    super();
    this.visible = false;
    this.zIndex = 5200;
    this._build();
  }

  get isOpen(): boolean {
    return this._isOpen;
  }

  open(): void {
    if (this._isOpen || this._opening) return;
    this._opening = true;
    void TextureCache.preloadMerchShopPanel()
      .then(() => {
        // 构造时可能还没拿到 CDN 图而画了「筹备中」fallback；
        // 打开前资源已就绪时必须主动重建，否则不会再收到 texture:loaded 事件。
        if (!this._merchDataBound) this._rebuildFrameContents();
        this._openReady();
      })
      .catch(err => {
        console.warn('[MerchShopPanel] 商店资源未就绪，暂不打开空壳:', err);
      })
      .finally(() => {
        this._opening = false;
      });
  }

  private _openReady(): void {
    if (this._isOpen) return;
    this._isOpen = true;
    this.visible = true;
    this.alpha = 1;
    this._assetUnsub = TextureCache.onAssetGroupLoaded('merchShop', () => {
      if (!this._isOpen) return;
      if (!this._merchDataBound) {
        this._rebuildFrameContents();
      }
      if (this._merchDataBound) {
        this._refreshMerchSlots();
        this._refreshMerchShelfStrips();
      }
    });
    this.position.set(0, 0);
    this.scale.set(1, 1);

    TweenManager.cancelTarget(this._bg);
    TweenManager.cancelTarget(this._frameRoot);
    TweenManager.cancelTarget(this._frameRoot.scale);

    this._bg.alpha = 0;
    this._frameRoot.alpha = 0;
    this._frameRoot.scale.set(0.92);
    if (this._merchScrollContent) this._merchScrollContent.y = 0;

    TweenManager.to({ target: this._bg, props: { alpha: 1 }, duration: 0.2, ease: Ease.easeOutQuad });
    TweenManager.to({ target: this._frameRoot, props: { alpha: 1 }, duration: 0.22, ease: Ease.easeOutQuad });
    TweenManager.to({ target: this._frameRoot.scale, props: { x: 1, y: 1 }, duration: 0.32, ease: Ease.easeOutBack });

    MerchShopManager.ensureUpToDate();
    if (this._merchDataBound) {
      this._refreshMerchSlots();
      this._refreshMerchShelfStrips();
      EventBus.on('merchShop:changed', this._onMerchShopChanged);
      EventBus.on('currency:changed', this._onCurrencyChanged);
      EventBus.on('adEntitlement:changed', this._onAdEntitlementChanged);
      EventBus.on('merchShop:dailyAdRefreshCompleted', this._onAdEntitlementChanged);
      Game.ticker.add(this._merchUiTick, this);
    }
  }

  close(): void {
    this._opening = false;
    if (!this._isOpen) return;
    this._isOpen = false;
    this._assetUnsub?.();
    this._assetUnsub = null;
    this._finishMerchCanvasScroll();
    if (this._merchDataBound) {
      EventBus.off('merchShop:changed', this._onMerchShopChanged);
      EventBus.off('currency:changed', this._onCurrencyChanged);
      EventBus.off('adEntitlement:changed', this._onAdEntitlementChanged);
      EventBus.off('merchShop:dailyAdRefreshCompleted', this._onAdEntitlementChanged);
      Game.ticker.remove(this._merchUiTick, this);
    }
    TweenManager.cancelTarget(this._bg);
    TweenManager.cancelTarget(this._frameRoot);
    TweenManager.cancelTarget(this._frameRoot.scale);

    TweenManager.to({ target: this._bg, props: { alpha: 0 }, duration: 0.15, ease: Ease.easeInQuad });
    TweenManager.to({
      target: this._frameRoot,
      props: { alpha: 0 },
      duration: 0.15,
      ease: Ease.easeInQuad,
      onComplete: () => {
        this.visible = false;
        this.alpha = 1;
      },
    });
    TweenManager.to({ target: this._frameRoot.scale, props: { x: 0.94, y: 0.94 }, duration: 0.15, ease: Ease.easeInQuad });
  }

  private readonly _onCanvasMerchMove = (ev: PointerEvent): void => {
    if (!this._isOpen || !this._merchScrollListening || !this._merchScrollContent) return;
    const dy = nativeClientToDesignY(ev.clientY) - this._merchScrollStartDesignY;
    let ny = this._merchScrollStartScrollY + dy;
    if (ny > 0) ny = 0;
    if (ny < this._merchScrollMinY) ny = this._merchScrollMinY;
    this._merchScrollContent.y = ny;
  };

  private readonly _onCanvasMerchUp = (): void => {
    this._finishMerchCanvasScroll();
  };

  private _finishMerchCanvasScroll(): void {
    if (!this._merchScrollListening) return;
    const canvas = Game.app.view as unknown as HTMLCanvasElement | undefined;
    if (canvas?.removeEventListener) {
      canvas.removeEventListener('pointermove', this._onCanvasMerchMove);
      canvas.removeEventListener('pointerup', this._onCanvasMerchUp);
      canvas.removeEventListener('pointercancel', this._onCanvasMerchUp);
    }
    this._merchScrollListening = false;
  }

  private _beginMerchCanvasScroll(e: PIXI.FederatedPointerEvent): void {
    if (!this._isOpen || !this._merchScrollContent || this._merchScrollListening) return;
    this._merchScrollListening = true;
    this._merchScrollStartDesignY = federatedPointerToDesignY(e);
    this._merchScrollStartScrollY = this._merchScrollContent.y;
    const canvas = Game.app.view as unknown as HTMLCanvasElement | undefined;
    if (canvas?.addEventListener) {
      canvas.addEventListener('pointermove', this._onCanvasMerchMove);
      canvas.addEventListener('pointerup', this._onCanvasMerchUp);
      canvas.addEventListener('pointercancel', this._onCanvasMerchUp);
    }
  }

  private _build(): void {
    const w = DESIGN_WIDTH;
    const h = Game.logicHeight;

    this._bg = new PIXI.Graphics();
    this._bg.beginFill(0x000000, 0.5);
    this._bg.drawRect(0, 0, w, h);
    this._bg.endFill();
    this._bg.eventMode = 'static';
    this._bg.on('pointertap', () => this.close());
    this.addChild(this._bg);

    this._frameRoot = new PIXI.Container();
    this._frameRoot.position.set(DESIGN_WIDTH / 2, h / 2);
    this.addChild(this._frameRoot);

    this._buildFrameContents();
  }

  private _resetMerchFrameState(): void {
    this._finishMerchCanvasScroll();
    if (this._merchDataBound) {
      EventBus.off('merchShop:changed', this._onMerchShopChanged);
      EventBus.off('currency:changed', this._onCurrencyChanged);
      EventBus.off('adEntitlement:changed', this._onAdEntitlementChanged);
      EventBus.off('merchShop:dailyAdRefreshCompleted', this._onAdEntitlementChanged);
      Game.ticker.remove(this._merchUiTick, this);
    }
    this._merchDataBound = false;
    this._merchScrollContent = null;
    this._merchScrollMinY = 0;
    this._slotCells = [];
    this._shelfStripCountdowns = [];
    this._shelfStripBtns = [];
    this._shelfRefreshButtonViews = [];
  }

  private _rebuildFrameContents(): void {
    this._resetMerchFrameState();
    for (const child of [...this._frameRoot.children]) {
      this._frameRoot.removeChild(child);
      child.destroy({ children: true });
    }
    this._buildFrameContents();
    if (this._isOpen && this._merchDataBound) {
      MerchShopManager.ensureUpToDate();
      this._refreshMerchSlots();
      this._refreshMerchShelfStrips();
      EventBus.on('merchShop:changed', this._onMerchShopChanged);
      EventBus.on('currency:changed', this._onCurrencyChanged);
      EventBus.on('adEntitlement:changed', this._onAdEntitlementChanged);
      EventBus.on('merchShop:dailyAdRefreshCompleted', this._onAdEntitlementChanged);
      Game.ticker.add(this._merchUiTick, this);
    }
  }

  private _buildFrameContents(): void {
    const h = Game.logicHeight;
    const frameTex = TextureCache.get('shop_merch_panel_frame');
    const secTex = TextureCache.get('shop_section_panel_bg');
    const slotTex = TextureCache.get('shop_item_slot');

    let closeLX = 0;
    let closeLY = 0;
    let titleLX = 0;
    let titleLY = 0;
    let titleFontSize = 34;

    if (frameTex?.width && secTex?.width && slotTex?.width) {
      const c = this._buildFrameWithComposedShelves(frameTex, secTex, slotTex, h);
      closeLX = c.closeX;
      closeLY = c.closeY;
      titleLX = c.titleX;
      titleLY = c.titleY;
      titleFontSize = c.titleFontSize;
    } else if (frameTex?.width) {
      const fw = frameTex.width;
      const fh = frameTex.height;
      const Sf = merchPanelScale(fw, fh, h);
      const sp = new PIXI.Sprite(frameTex);
      sp.anchor.set(0.5);
      sp.scale.set(Sf);
      sp.position.set(0, 0);
      sp.eventMode = 'static';
      sp.on('pointertap', (e: PIXI.FederatedPointerEvent) => e.stopPropagation());
      this._frameRoot.addChild(sp);
      const halfW = (fw * Sf) / 2;
      const halfH = (fh * Sf) / 2;
      const hint = new PIXI.Text('商品筹备中，敬请期待~', {
        fontSize: 22,
        fill: COLORS.TEXT_DARK,
        fontFamily: FONT_FAMILY,
      });
      hint.anchor.set(0.5);
      hint.position.set(0, Math.min(140, halfH * 0.28));
      hint.eventMode = 'none';
      this._frameRoot.addChild(hint);
      const fx0 = fw / FRAME_REF_W;
      const fy0 = fh / FRAME_REF_H;
      closeLX = (FRAME_CLOSE_TEX.x * fx0 - fw / 2) * Sf;
      closeLY = (FRAME_CLOSE_TEX.y * fy0 - fh / 2) * Sf;
      titleLX = (FRAME_TITLE_TEX.x * fx0 - fw / 2) * Sf;
      titleLY = (FRAME_TITLE_TEX.y * fy0 - fh / 2) * Sf + MERCH_FRAME_TITLE_OFFSET_Y;
      titleFontSize = Math.max(28, Math.round(34 * Sf));
    } else {
      const rw = DESIGN_WIDTH - 40;
      const rh = Math.min(1180, h - 80);
      const fb = new PIXI.Graphics();
      fb.beginFill(0xfff5ec, 0.96);
      fb.lineStyle(3, 0xd2b48c, 0.7);
      fb.drawRoundedRect(-rw / 2, -rh / 2, rw, rh, 20);
      fb.endFill();
      fb.eventMode = 'static';
      fb.on('pointertap', (e: PIXI.FederatedPointerEvent) => e.stopPropagation());
      this._frameRoot.addChild(fb);
      const halfW = rw / 2;
      const halfH = rh / 2;
      const hint = new PIXI.Text('商品筹备中，敬请期待~', {
        fontSize: 22,
        fill: COLORS.TEXT_DARK,
        fontFamily: FONT_FAMILY,
      });
      hint.anchor.set(0.5);
      hint.position.set(0, Math.min(140, halfH * 0.28));
      hint.eventMode = 'none';
      this._frameRoot.addChild(hint);
      closeLX = halfW - 36;
      closeLY = -halfH + 40;
      titleLX = 0;
      titleLY = -halfH + 52 + MERCH_FRAME_TITLE_OFFSET_Y;
      titleFontSize = 34;
    }

    const panelTitle = new PIXI.Text('商店', merchPanelTitleStyle(titleFontSize) as any);
    panelTitle.anchor.set(0.5);
    panelTitle.position.set(titleLX, titleLY);
    panelTitle.eventMode = 'none';
    this._frameRoot.addChild(panelTitle);

    const closeBtn = new PIXI.Container();
    closeBtn.position.set(closeLX, closeLY);
    closeBtn.eventMode = 'static';
    closeBtn.cursor = 'pointer';
    closeBtn.hitArea = new PIXI.Circle(0, 0, MERCH_CLOSE_HIT_RADIUS);
    closeBtn.on('pointertap', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      this.close();
    });
    this._frameRoot.addChild(closeBtn);
  }

  /**
   * 底板在下、货架在上；关叉与底板纹理对齐。
   */
  private _buildFrameWithComposedShelves(
    frameTex: PIXI.Texture,
    secTex: PIXI.Texture,
    slotTex: PIXI.Texture,
    logicH: number,
  ): { closeX: number; closeY: number; titleX: number; titleY: number; titleFontSize: number } {
    const fw = frameTex.width;
    const fh = frameTex.height;
    const fx = fw / FRAME_REF_W;
    const fy = fh / FRAME_REF_H;
    const inner = {
      x: FRAME_INNER.x * fx,
      y: FRAME_INNER.y * fy,
      w: FRAME_INNER.w * fx,
      h: FRAME_INNER.h * fy,
    };
    const Sf = merchPanelScale(fw, fh, logicH);

    const frameSp = new PIXI.Sprite(frameTex);
    frameSp.anchor.set(0.5);
    frameSp.scale.set(Sf);
    frameSp.position.set(0, 0);
    frameSp.eventMode = 'static';
    frameSp.on('pointertap', (e: PIXI.FederatedPointerEvent) => e.stopPropagation());
    this._frameRoot.addChild(frameSp);

    const tw = secTex.width;
    const th = secTex.height;
    const fsx = tw / REF_SEC_W;
    const fsy = th / REF_SEC_H;
    const slotCy = REF_SLOT_CY * fsy;
    const slotDx = REF_SLOT_DX.map((d) => d * fsx);
    const slotSide = REF_SLOT_SIDE * fsx;
    const slotDrawSide = slotSide * MERCH_SLOT_FRAME_SCALE;
    const shelfShiftY = th * MERCH_SHELF_CLUSTER_SHIFT;
    const itemsShiftY = MERCH_ITEMS_CLUSTER_OFFSET_REF * fsy;

    const stackW = tw;
    const shelfBlockTexH = th;
    const stackH =
      SHELF_ROWS * shelfBlockTexH + (SHELF_ROWS - 1) * SECTION_GAP;
    const innerLeftX = (inner.x - fw / 2) * Sf;
    const innerTopY = (inner.y - fh / 2) * Sf;
    const innerWscr = inner.w * Sf;
    const innerHscr = inner.h * Sf;
    const scrollViewportH = Math.max(120, innerHscr);
    const visibleTwoTexH =
      VISIBLE_SHELF_ROWS * shelfBlockTexH +
      (VISIBLE_SHELF_ROWS - 1) * SECTION_GAP;
    /** 高度限幅时常有横向余量（层板图比内区窄的视觉效果）；乘系数吃满内宽，整体放大子商店 */
    const MERCH_SHELF_SCALE_BOOST = 1.17;
    const wlim = innerWscr / stackW;
    const hlim = scrollViewportH / visibleTwoTexH;
    const shelfS = Math.min(wlim, hlim * MERCH_SHELF_SCALE_BOOST);

    const merchInner = new PIXI.Container();
    merchInner.position.set(innerLeftX, innerTopY);
    merchInner.eventMode = 'static';
    this._frameRoot.addChild(merchInner);

    const scrollViewport = new PIXI.Container();
    scrollViewport.position.set(0, 0);
    scrollViewport.eventMode = 'static';
    scrollViewport.cursor = 'grab';
    scrollViewport.hitArea = new PIXI.Rectangle(0, 0, innerWscr, scrollViewportH);

    const scrollMask = new PIXI.Graphics();
    scrollMask.beginFill(0xffffff);
    scrollMask.drawRect(0, 0, innerWscr, scrollViewportH);
    scrollMask.endFill();
    scrollViewport.addChild(scrollMask);
    scrollViewport.mask = scrollMask;

    const scrollContent = new PIXI.Container();
    scrollContent.sortableChildren = true;
    scrollContent.scale.set(shelfS);
    const offsetX = Math.max(0, (innerWscr - stackW * shelfS) / 2);
    scrollContent.position.set(offsetX, 0);
    scrollViewport.addChild(scrollContent);
    merchInner.addChild(scrollViewport);

    const contentHScr = stackH * shelfS;
    this._merchScrollMinY = Math.min(0, scrollViewportH - contentHScr);
    this._merchScrollContent = scrollContent;

    const bindMerchWheel = (): void => {
      scrollViewport.on('wheel', (e: PIXI.FederatedWheelEvent) => {
        if (!this._merchScrollContent) return;
        let ny = this._merchScrollContent.y - e.deltaY * 0.45;
        if (ny > 0) ny = 0;
        if (ny < this._merchScrollMinY) ny = this._merchScrollMinY;
        this._merchScrollContent.y = ny;
        e.stopPropagation();
      });
    };
    bindMerchWheel();

    this._slotCells = [];
    this._shelfStripCountdowns = [];
    this._shelfStripBtns = [];
    this._shelfRefreshButtonViews = [];

    const onMerchScrollSurfaceDown = (e: PIXI.FederatedPointerEvent): void => {
      e.stopPropagation();
      this._beginMerchCanvasScroll(e);
    };

    for (let r = 0; r < SHELF_ROWS; r++) {
      const yTop = r * (shelfBlockTexH + SECTION_GAP);

      const sec = new PIXI.Sprite(secTex);
      sec.anchor.set(0.5, 0);
      sec.position.set(stackW / 2, yTop + shelfShiftY);
      sec.zIndex = 0;
      sec.eventMode = 'static';
      sec.on('pointertap', (e: PIXI.FederatedPointerEvent) => e.stopPropagation());
      sec.on('pointerdown', onMerchScrollSurfaceDown);
      scrollContent.addChild(sec);

      const shelfTitleStr = MERCH_SHELF_TITLE_NAMES[r] ?? `货架${r + 1}`;
      const shelfTitleFont = Math.max(32, Math.round(42 * fsy));
      const shelfTitle = new PIXI.Text(shelfTitleStr, {
        fontSize: shelfTitleFont,
        fill: 0x6b3a12,
        fontFamily: FONT_FAMILY,
        fontWeight: 'bold',
        stroke: 0xfff5d8,
        strokeThickness: Math.max(2.8, shelfTitleFont * 0.1),
      } as any);
      shelfTitle.anchor.set(0.5, 0.5);
      shelfTitle.position.set(stackW / 2, yTop + shelfShiftY + REF_SECTION_RIBBON_TITLE_CY * fsy);
      shelfTitle.eventMode = 'none';
      shelfTitle.zIndex = 7;
      scrollContent.addChild(shelfTitle);

      for (let c = 0; c < SHELF_COLS; c++) {
        const sx = stackW / 2 + slotDx[c]!;
        const sy = yTop + slotCy + shelfShiftY + itemsShiftY;

        const slot = new PIXI.Sprite(slotTex);
        slot.anchor.set(0.5);
        const ss = slotDrawSide / Math.max(slotTex.width, slotTex.height);
        slot.scale.set(ss);
        slot.position.set(sx, sy);
        slot.eventMode = 'static';
        slot.on('pointertap', (e: PIXI.FederatedPointerEvent) => e.stopPropagation());
        slot.on('pointerdown', onMerchScrollSurfaceDown);
        scrollContent.addChild(slot);

        const icon = new PIXI.Sprite(PIXI.Texture.EMPTY);
        icon.anchor.set(0.5);
        icon.position.set(sx, sy);
        icon.visible = false;
        icon.eventMode = 'static';
        icon.zIndex = 2;
        icon.on('pointertap', (e: PIXI.FederatedPointerEvent) => e.stopPropagation());
        icon.on('pointerdown', onMerchScrollSurfaceDown);
        scrollContent.addChild(icon);

        const slotHalf = slotDrawSide * 0.5;
        const stockBandBottom = sy - slotHalf - MERCH_STOCK_ABOVE_SLOT_REF * fsy;
        const badgeRoot = new PIXI.Container();
        badgeRoot.zIndex = 8;
        badgeRoot.position.set(sx, stockBandBottom);
        badgeRoot.eventMode = 'none';
        const stockLabelFs = Math.max(20, Math.round(MERCH_STOCK_LABEL_FONT_REF * fsy));
        const badgeCount = new PIXI.Text('', {
          fontSize: stockLabelFs,
          fill: 0x5a3310,
          fontFamily: FONT_FAMILY,
          fontWeight: 'bold',
          stroke: 0xfff5d8,
          strokeThickness: Math.max(3, stockLabelFs * 0.14),
        } as any);
        badgeCount.anchor.set(0.5, 1);
        badgeCount.position.set(0, 0);
        badgeRoot.addChild(badgeCount);
        scrollContent.addChild(badgeRoot);

        const buyRoot = new PIXI.Container();
        const slotFrameBottom = sy + slotDrawSide * 0.5;
        const btnTargetH = MERCH_BUY_BTN_TARGET_H;
        buyRoot.position.set(sx, slotFrameBottom + MERCH_BTN_TOP_GAP + btnTargetH);
        buyRoot.eventMode = 'static';
        buyRoot.cursor = 'pointer';
        buyRoot.zIndex = 4;
        const buyBtnSprite = new PIXI.Sprite(PIXI.Texture.EMPTY);
        buyBtnSprite.anchor.set(0.5, 1);
        buyBtnSprite.position.set(0, 0);
        const buyOverlay = new PIXI.Container();
        buyRoot.addChild(buyBtnSprite);
        buyRoot.addChild(buyOverlay);
        const shelfIndex = r;
        const col = c;
        buyRoot.on('pointertap', (e: PIXI.FederatedPointerEvent) => {
          e.stopPropagation();
          this._onBuyTap(shelfIndex, col);
        });
        scrollContent.addChild(buyRoot);

        this._slotCells.push({
          row: shelfIndex,
          col: c,
          icon,
          iconCap: slotDrawSide * 0.62,
          buyRoot,
          buyBtnSprite,
          buyOverlay,
          btnMaxW: Math.min(338, Math.round(slotSide * 2.62)),
          btnTargetH,
          slotFrameBottom,
          badgeRoot,
          badgeCount,
        });
      }

      const stripY =
        yTop +
        shelfShiftY +
        th -
        MERCH_STRIP_BOTTOM_INSET -
        MERCH_STRIP_BAR_H * 0.5;
      const stripRoot = new PIXI.Container();
      stripRoot.position.set(stackW / 2, stripY);
      stripRoot.eventMode = 'static';
      stripRoot.zIndex = 6;

      const barH = MERCH_STRIP_BAR_H;
      const shelfIdx = r;
      const rBtnH = Math.min(66, barH - 12);
      const refreshBtn = new PIXI.Container();
      refreshBtn.eventMode = 'static';
      refreshBtn.cursor = 'pointer';
      const rBtnTex = TextureCache.get('deco_card_btn_3');
      const rBtnMaxW = 176;
      let rHitW = 140;
      if (rBtnTex?.width) {
        const rsp = new PIXI.Sprite(rBtnTex);
        const rs = Math.min(rBtnMaxW / rBtnTex.width, rBtnH / rBtnTex.height);
        rsp.anchor.set(1, 0.5);
        rsp.scale.set(rs);
        rsp.position.set(0, 0);
        refreshBtn.addChild(rsp);
        rHitW = rBtnTex.width * rs;
      } else {
        const rg = new PIXI.Graphics();
        rg.beginFill(0x4caf50);
        rg.drawRoundedRect(-rBtnMaxW, -rBtnH / 2, rBtnMaxW, rBtnH, rBtnH / 2);
        rg.endFill();
        refreshBtn.addChild(rg);
        rHitW = rBtnMaxW;
      }
      const rRow = new PIXI.Container();
      rRow.position.set(-rHitW / 2, 0);
      const hasDailyAdRefresh = AdEntitlementManager.canUseDaily(DailyAdEntitlement.MERCH_DAILY_REFRESH);
      const rIconH = Math.min(46, rBtnH - 10);
      const rGem = TextureCache.get('icon_gem');
      let rIcon: PIXI.Sprite | null = null;
      if (rGem?.width) {
        rIcon = new PIXI.Sprite(rGem);
        rIcon.anchor.set(0.5, 0.5);
        rIcon.height = rIconH;
        rIcon.width = (rGem.width / rGem.height) * rIconH;
        rIcon.visible = !hasDailyAdRefresh;
        rRow.addChild(rIcon);
      }
      const rAdIcon = createAdIcon(24);
      rAdIcon.visible = hasDailyAdRefresh;
      rRow.addChild(rAdIcon);
      const rPrice = new PIXI.Text(hasDailyAdRefresh ? '免费' : String(MERCH_DIAMOND_REFRESH_SHELF_COST), {
        fontSize: 42,
        fill: MERCH_BTN_LABEL_FILL,
        fontFamily: FONT_FAMILY,
        fontWeight: 'bold',
        stroke: MERCH_BTN_LABEL_STROKE,
        strokeThickness: 3.4,
      } as any);
      rPrice.anchor.set(0.5, 0.5);
      rRow.addChild(rPrice);
      this._syncRefreshButtonView({ row: rRow, icon: rIcon, adIcon: rAdIcon, label: rPrice });
      refreshBtn.addChild(rRow);
      refreshBtn.hitArea = new PIXI.Rectangle(-rHitW - 6, -barH / 2, rHitW + 12, barH);
      refreshBtn.on('pointertap', (e: PIXI.FederatedPointerEvent) => {
        e.stopPropagation();
        if (AdEntitlementManager.canUseDaily(DailyAdEntitlement.MERCH_DAILY_REFRESH)) {
          MerchShopManager.refreshShelfWithDailyAd(shelfIdx);
        } else {
          MerchShopManager.tryDiamondRefreshShelf(shelfIdx, MERCH_DIAMOND_REFRESH_SHELF_COST);
        }
      });
      this._shelfRefreshButtonViews.push({ row: rRow, icon: rIcon, adIcon: rAdIcon, label: rPrice });

      const stripLbl = new PIXI.Text('刷新时间', {
        fontSize: 32,
        fill: 0x8b2d14,
        fontFamily: FONT_FAMILY,
        fontWeight: 'bold',
        stroke: 0xfff8f0,
        strokeThickness: 3.8,
      } as any);
      stripLbl.anchor.set(0, 0.5);

      const stripCd = new PIXI.Text('00:00:00', {
        fontSize: 44,
        fill: 0x3d2814,
        fontFamily: FONT_FAMILY,
        fontWeight: 'bold',
        stroke: 0xfffdf8,
        strokeThickness: 4.2,
      } as any);
      stripCd.anchor.set(0.5, 0.5);

      const STRIP_GAP_LBL_CD = 12;
      const STRIP_GAP_CD_BTN = 14;
      /** 倒计时占位宽（`HH:MM:SS`），避免数字变长时与两侧挤在一起 */
      const STRIP_TIMER_COL_W = 158;
      const stripPadX = 28;
      const innerW =
        stripLbl.width + STRIP_GAP_LBL_CD + STRIP_TIMER_COL_W + STRIP_GAP_CD_BTN + rHitW;
      /** 内容宽 + 左右内边距 + 额外拉长，上限几乎铺满层板宽 */
      const barW = Math.min(stackW * 0.98, innerW + stripPadX * 2 + 64);

      const stripBg = new PIXI.Graphics();
      stripBg.beginFill(0xfff0e0, 0.9);
      stripBg.lineStyle(3, 0xd4a574, 0.78);
      stripBg.drawRoundedRect(-barW / 2, -barH / 2, barW, barH, 18);
      stripBg.endFill();
      stripBg.eventMode = 'static';
      stripBg.on('pointerdown', onMerchScrollSurfaceDown);
      stripRoot.addChild(stripBg);

      const leftX = -barW / 2 + stripPadX;
      stripLbl.position.set(leftX, 0);
      stripRoot.addChild(stripLbl);

      stripCd.position.set(leftX + stripLbl.width + STRIP_GAP_LBL_CD + STRIP_TIMER_COL_W * 0.5, 0);
      stripRoot.addChild(stripCd);
      this._shelfStripCountdowns.push(stripCd);

      refreshBtn.position.set(barW / 2 - stripPadX, 0);
      stripRoot.addChild(refreshBtn);
      this._shelfStripBtns.push(refreshBtn);

      scrollContent.addChild(stripRoot);
    }

    this._merchDataBound = true;

    const closeX = (FRAME_CLOSE_TEX.x * fx - fw / 2) * Sf;
    const closeY = (FRAME_CLOSE_TEX.y * fy - fh / 2) * Sf;
    const titleX = (FRAME_TITLE_TEX.x * fx - fw / 2) * Sf;
    const titleY = (FRAME_TITLE_TEX.y * fy - fh / 2) * Sf + MERCH_FRAME_TITLE_OFFSET_Y;
    const titleFontSize = Math.max(28, Math.round(34 * Sf));
    return { closeX, closeY, titleX, titleY, titleFontSize };
  }

  /**
   * 与 DecorationPanel `_addFooter` 购买态一致：`deco_card_btn_3` + 币图标 + 数字（免费/广告仅文案）。
   */
  private _layoutMerchBuyButton(cell: MerchSlotCell, sl: MerchSlotSnapshot | undefined): void {
    const sp = cell.buyBtnSprite;
    const overlay = cell.buyOverlay;
    overlay.removeChildren();

    const labelStyle = {
      fontSize: MERCH_BUY_BTN_LABEL_FONT_SIZE,
      fill: MERCH_BTN_LABEL_FILL,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold' as const,
      stroke: MERCH_BTN_LABEL_STROKE,
      strokeThickness: 3.1,
    };

    if (!sl) {
      sp.visible = false;
      cell.buyRoot.eventMode = 'none';
      cell.buyRoot.cursor = 'default';
      cell.buyRoot.alpha = 0.5;
      cell.buyRoot.hitArea = null;
      return;
    }

    const soldOut = sl.remaining <= 0;
    const maxBtnW = cell.btnMaxW;
    const targetH = cell.btnTargetH;
    const btnTexKey = soldOut ? 'deco_card_btn_2' : 'deco_card_btn_3';
    const btnTex = TextureCache.get(btnTexKey);

    if (btnTex?.width) {
      sp.texture = btnTex;
      const s = Math.min(maxBtnW / btnTex.width, targetH / btnTex.height);
      sp.scale.set(s);
      sp.visible = true;
      const scaledH = btnTex.height * s;
      const scaledW = btnTex.width * s;
      cell.buyRoot.position.y = cell.slotFrameBottom + MERCH_BTN_TOP_GAP + scaledH;
      overlay.position.set(0, -scaledH * 0.5);

      if (soldOut) {
        const t = new PIXI.Text('售罄', labelStyle as any);
        t.anchor.set(0.5);
        overlay.addChild(t);
      } else {
        let iconKey: string | null = null;
        let priceStr = '';
        const isAdPrice = sl.priceType === 'ad';
        if (sl.priceType === 'huayuan') {
          iconKey = 'icon_huayuan';
          priceStr = String(sl.priceAmount);
        } else if (sl.priceType === 'diamond') {
          iconKey = 'icon_gem';
          priceStr = String(sl.priceAmount);
        } else if (sl.priceType === 'free') {
          priceStr = '免费';
        } else {
          priceStr = '免费';
        }

        const row = new PIXI.Container();
        const gap = 10;
        const iconH = Math.max(30, Math.min(50, Math.round(scaledH * 0.58)));
        let iconW = 0;
        if (isAdPrice) {
          const badge = createFreeAdBadge(MERCH_BUY_BTN_LABEL_FONT_SIZE, MERCH_BTN_LABEL_FILL, MERCH_BTN_LABEL_STROKE);
          row.addChild(badge);
          overlay.addChild(row);
        } else {
          if (iconKey) {
          const iconTex = TextureCache.get(iconKey);
          if (iconTex?.width) {
            const iconSp = new PIXI.Sprite(iconTex);
            iconSp.anchor.set(0.5, 0.5);
            iconSp.height = iconH;
            iconSp.width = (iconTex.width / iconTex.height) * iconH;
            iconW = iconSp.width;
            row.addChild(iconSp);
          }
        }
          const price = new PIXI.Text(priceStr, labelStyle as any);
          price.anchor.set(0.5, 0.5);
          row.addChild(price);
          const rowW = iconW > 0 ? iconW + gap + price.width : price.width;
          let xLeft = -rowW / 2;
          if (iconW > 0 && row.children[0]) {
            (row.children[0] as PIXI.Sprite).position.set(xLeft + iconW / 2, 0);
            xLeft += iconW + gap;
          }
          price.position.set(xLeft + price.width / 2, 0);
          overlay.addChild(row);
        }
      }

      cell.buyRoot.hitArea = new PIXI.Rectangle(-scaledW / 2, -scaledH, scaledW, scaledH);
      cell.buyRoot.eventMode = soldOut ? 'none' : 'static';
      cell.buyRoot.cursor = soldOut ? 'default' : 'pointer';
      cell.buyRoot.alpha = soldOut ? 0.92 : 1;
      return;
    }

    const bw = Math.min(maxBtnW, 256);
    const bh = targetH;
    sp.visible = false;
    cell.buyRoot.position.y = cell.slotFrameBottom + MERCH_BTN_TOP_GAP + bh;
    overlay.position.set(0, -bh / 2);
    const g = new PIXI.Graphics();
    const fill = soldOut ? 0x9e9e9e : 0x4caf50;
    g.beginFill(fill, 0.94);
    g.drawRoundedRect(-bw / 2, -bh / 2, bw, bh, bh / 2);
    g.endFill();
    overlay.addChild(g);
    const line =
      soldOut ? '售罄' : sl.priceType === 'free' ? '免费' : sl.priceType === 'ad' ? '免费' : `${sl.priceAmount}`;
    const t = new PIXI.Text(line, labelStyle as any);
    t.anchor.set(0.5);
    overlay.addChild(t);
    if (!soldOut && sl.priceType === 'ad') {
      const icon = createAdIcon(22);
      icon.position.set(t.width / 2 + 16, 0);
      overlay.addChild(icon);
    }
    cell.buyRoot.hitArea = new PIXI.Rectangle(-bw / 2, -bh / 2, bw, bh);
    cell.buyRoot.eventMode = soldOut ? 'none' : 'static';
    cell.buyRoot.cursor = soldOut ? 'default' : 'pointer';
    cell.buyRoot.alpha = soldOut ? 0.85 : 1;
  }

  private _layoutMerchStockBadge(cell: MerchSlotCell, sl: MerchSlotSnapshot | undefined): void {
    if (!cell.badgeRoot || !cell.badgeCount) return;
    if (!sl) {
      cell.badgeRoot.visible = false;
      return;
    }
    cell.badgeRoot.visible = true;
    cell.badgeCount.text = `剩余：${sl.remaining}`;
    cell.badgeCount.alpha = sl.remaining <= 0 ? 0.72 : 1;
  }

  private _refreshMerchSlots(): void {
    const snap = MerchShopManager.getSnapshot();
    for (const cell of this._slotCells) {
      const shelf = snap[cell.row];
      const sl = shelf?.slots[cell.col];
      if (!sl) {
        cell.icon.visible = false;
        this._layoutMerchBuyButton(cell, undefined);
        this._layoutMerchStockBadge(cell, undefined);
        continue;
      }
      const soldOut = sl.remaining <= 0;
      const itemTex = TextureCache.get(sl.icon);
      if (itemTex?.width) {
        cell.icon.texture = itemTex;
        const isc = cell.iconCap / Math.max(itemTex.width, itemTex.height);
        cell.icon.scale.set(isc);
        cell.icon.visible = true;
      } else {
        cell.icon.visible = false;
      }
      cell.icon.alpha = soldOut ? 0.4 : 1;
      this._layoutMerchBuyButton(cell, sl);
      this._layoutMerchStockBadge(cell, sl);
    }
  }

  private _refreshMerchShelfStrips(): void {
    if (this._shelfStripCountdowns.length === 0) return;
    MerchShopManager.ensureUpToDate();
    const snap = MerchShopManager.getSnapshot();
    const now = Date.now();
    for (let r = 0; r < this._shelfStripCountdowns.length; r++) {
      const cd = this._shelfStripCountdowns[r];
      const sh = snap[r];
      if (cd && sh) {
        const secLeft = Math.max(0, Math.ceil((sh.nextRefreshAt - now) / 1000));
        cd.text = merchFormatCountdownHms(secLeft);
      }
      const btn = this._shelfStripBtns[r];
      if (btn) {
        btn.alpha = 1;
        btn.cursor = 'pointer';
        btn.eventMode = 'static';
      }
      const refreshView = this._shelfRefreshButtonViews[r];
      if (refreshView) this._syncRefreshButtonView(refreshView);
    }
  }

  private _syncRefreshButtonView(view: MerchRefreshButtonView): void {
    const hasDailyAdRefresh = AdEntitlementManager.canUseDaily(DailyAdEntitlement.MERCH_DAILY_REFRESH);
    const gap = 7;
    view.label.text = hasDailyAdRefresh ? '免费' : String(MERCH_DIAMOND_REFRESH_SHELF_COST);
    if (view.icon) view.icon.visible = !hasDailyAdRefresh;
    if (view.adIcon) view.adIcon.visible = hasDailyAdRefresh;

    const iconW = view.icon?.visible ? view.icon.width : 0;
    const adIconW = view.adIcon?.visible ? view.adIcon.width : 0;
    const rowW =
      iconW > 0
        ? iconW + gap + view.label.width
        : adIconW > 0
          ? view.label.width + gap + adIconW
          : view.label.width;
    let x = -rowW / 2;
    if (view.icon?.visible) {
      view.icon.position.set(x + iconW / 2, 0);
      x += iconW + gap;
    }
    view.label.position.set(x + view.label.width / 2, 0);
    x += view.label.width + gap;
    if (view.adIcon?.visible) {
      view.adIcon.position.set(x + adIconW / 2, 0);
    }
  }

  private _onBuyTap(row: number, col: number): void {
    const snap = MerchShopManager.getSnapshot();
    const sl = snap[row]?.slots[col];
    if (!sl || sl.remaining <= 0) return;
    if (sl.priceType === 'ad') {
      MerchShopManager.purchaseWithAd(row, col);
    } else {
      MerchShopManager.tryPurchase(row, col);
    }
  }
}
