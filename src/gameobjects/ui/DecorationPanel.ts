/**
 * 花店装修面板
 *
 * 布局：
 * - 底图优先 decoration_panel_bg_nb2：按 DECO_PANEL_BG_TOP_RATIO 取纹理上段、宽向等比缩放，底边贴齐面板底，不纵向拉伸；缺图时回退 merge_chain_panel（仍铺满拉伸）
 * - 顶栏标题「家具」叠在底板粉区；筛选条（deco_rarity_tag_fine/common，等比）贴粉区下沿；再下黄条（board_bar，与棋盘顶一致）；全屏遮罩点击关闭
 * - 左侧：分类 Tab 栏（药丸底图 NB2 + 程序叠字；列顶与首行家具图标顶对齐；缺图时回退矢量圆角）
 * - 右侧：家具/房间风格 3 列网格（视口下移 GRID_VIEWPORT_TOP_INSET；列表按解锁等级、花愿价排序）
 * - 卡片：双层金边圆角 + 贴图按钮 + 家具卡左上角星星值角标（房间风格卡同）
 * - 顶栏右上 `deco_nb2_close_btn_1x1` 关闭；星级条在遮罩之上时点条身穿透落到遮罩关闭
 */
import * as PIXI from 'pixi.js';
import { Game } from '@/core/Game';
import { SceneManager } from '@/core/SceneManager';
import { TweenManager, Ease } from '@/core/TweenManager';
import { EventBus } from '@/core/EventBus';
import { ToastMessage } from '@/gameobjects/ui/ToastMessage';
import { DecorationManager } from '@/managers/DecorationManager';
import { TextureCache } from '@/utils/TextureCache';
import { checkRequirement } from '@/utils/UnlockChecker';
import {
  DecoSlot, DECO_SLOT_INFO,
  DecoDef,
  ROOM_STYLES, RoomStyleDef,
  DECO_PANEL_TABS,
  type DecoPanelTabId,
  getDecorationTabLabel,
  getDecosForDecorationPanelTab,
  isDecoAllowedInScene,
  formatAllowedScenesShort,
} from '@/config/DecorationConfig';
import { CurrencyManager } from '@/managers/CurrencyManager';
import { BOARD_BAR_HEIGHT, DESIGN_WIDTH, FONT_FAMILY, COLORS } from '@/config/Constants';
import { RoomLayoutManager } from '@/managers/RoomLayoutManager';
import { setPendingPlaceDeco } from '@/core/DecoPlaceIntent';

/** 全宽底栏：与 NB2 全幅贴边原型一致（旧版左右各留边会造成左侧大缝） */
const PANEL_W = DESIGN_WIDTH;
/** overlay 内与其它全屏面板一致；须低于 ShopScene 抬升的星级条(5600)，使进度条在遮罩外可点穿关闭 */
const DECO_PANEL_Z_INDEX = 5000;
/** 右上角关闭钮：最长边与热区（与 MergeChainPanel / 仓库关闭钮同量级） */
const DECO_CLOSE_BTN_MAX_SIDE = 56;
const DECO_CLOSE_BTN_HIT_PAD = 12;
const DECO_CLOSE_BTN_INSET_RIGHT = 44;
/** NB2 底板竖向取样比例（越大图越高；过高会带回底部圆角，需与 rembg 底图配合） */
const DECO_PANEL_BG_TOP_RATIO = 0.84;
const PANEL_MARGIN_LEFT = 0;
/** 面板占逻辑屏高度比例（越大底栏上沿越接近顶区「家具」参考位） */
const PANEL_H_RATIO = 0.92;
const PANEL_TOP_R = 20;
/** 顶栏与米色身区分界线在面板内的比例（对齐 NB2 薄顶栏底边；筛选条以此为基准下移） */
const PANEL_PINK_BAND_BOTTOM_RATIO = 0.258;
/** 标题「家具」中心 Y：落在顶栏下沿横框附近（与 PINK 底边对齐感） */
const PANEL_TITLE_Y_RATIO = 0.224;

/**
 * 相对粉区下沿的竖向偏移（可负）。
 * 负值：筛选条整体上移，叠到头图与米色区的过渡/阴影带之上，避免落在内凹阴影下方。
 */
/** 粉区下沿到筛选条顶 */
const FILTER_ROW_GAP_BELOW_PINK = 26;
/** 筛选条高度（容纳 rarity 标签图等比缩放；变高须同步调 HEADER_CHROME_EXTRA_Y 以保持网格顶不变） */
const FILTER_BAR_H = 58;
/** 筛选条底到分割线 */
const DIVIDER_BELOW_FILTER_GAP = 22;
/** 分割线与家具区顶边 */
const DIVIDER_TO_CONTENT = 30;
/**
 * 仅把「家具」标题 + 筛选条 + 分割线整体下移（像素）；contentTopY 会减回同量，家具网格顶不变。
 */
const HEADER_CHROME_EXTRA_Y = 109;
/** 顶部分割黄条（board_bar）左右内缩，避免超出米色壳/圆角视觉区 */
const HEADER_BOARD_BAR_SIDE_INSET = 36;
/** 网格区距面板底边的留白，避免卡片贴到金边外；略大以保证裁切在画框内 */
const CONTENT_BOTTOM = 36;

/**
 * 家具网格视口相对「内容顶」再下移：与薄顶栏底图对齐，避免首行卡片顶出参考区。
 */
const GRID_VIEWPORT_TOP_INSET = 86;

/** 左侧分类药丸宽度（与底图左象牙带大致对齐；勿过宽以免压到家具槽视觉） */
const TAB_W = 130;
/** Tab 与家具网格之间明确缝，避免药丸阴影/网格互相挡 */
const TAB_GAP = 12;
/** NB2 侧栏药丸原图约 256×119：绘制须等比缩放，勿独立拉宽高 */
const TAB_PILL_TEX_W = 256;
const TAB_PILL_TEX_H = 119;
const TAB_PILL_TEXTURE_ASPECT = TAB_PILL_TEX_W / TAB_PILL_TEX_H;
/** 左侧 Tab 每行固定高度（不随面板变高纵向拉长；与 TAB_W 放大后匹配药丸比例） */
const TAB_ROW_H = 106;
/** 左侧 Tab 行高下限（可用高度不足时按比例压缩） */
const TAB_ROW_MIN_H = 48;
/** Tab 列左边距 */
const TAB_COLUMN_LEFT = 4;
/** 家具网格距面板右缘留白（勿贴边；与左侧 Tab 区视觉平衡） */
const GRID_MARGIN_RIGHT = 22;
/** 家具网格相对 Tab 列右缘缝整体横移（负为左移；宽度同步补偿，右缘仍贴 GRID_MARGIN_RIGHT） */
const FURNITURE_GRID_NUDGE_X = -5;

function decoPanelGridOriginX(): number {
  return TAB_COLUMN_LEFT + TAB_W + TAB_GAP + FURNITURE_GRID_NUDGE_X;
}

function decoPanelGridWidth(): number {
  return PANEL_W - TAB_COLUMN_LEFT - TAB_W - TAB_GAP - GRID_MARGIN_RIGHT - FURNITURE_GRID_NUDGE_X;
}

/** 侧边 Tab：选中态暖色底 / 未选中灰奶油 */
const TAB_BG_SELECTED = 0xffc9a8;
const TAB_BG_SELECTED_INNER = 0xffe8d8;
const TAB_BG_IDLE = 0xefebe5;
const TAB_BORDER_IDLE = 0xc4b8ae;

const GRID_COLS = 3;
const CARD_GAP = 6;
const CARD_BASE_W = 140;
const CARD_BASE_H = 160;
/**
 * 卡片最大宽度上限（仅防极端宽屏异常大；此前 176 会把三列卡锁死变「永远不大」）。
 * 750 设计宽下 grid 变宽后应吃满 cwRaw。
 */
const CARD_MAX_W = 256;
const CARD_R = 10;
/** 花愿不足时购买底图+价签整体透明度（与 Merch 空槽 0.5 同量级，略低以保留绿钮可读） */
const DECO_PURCHASE_BTN_DISABLED_ALPHA = 0.42;

const GOLD_LINE = 0xe8c078;
const GOLD_INNER = 0xd4a84b;
const CREAM_FILL = 0xfff9ec;
const SHADOW_COLOR = 0x8b7355;

/** 顶栏「家具」与左侧分类 Tab 字：同族描边+阴影（Tab 字号缩小） */
const DECO_PANEL_CHROME_TEXT_BASE = {
  fontFamily: FONT_FAMILY,
  fontWeight: 'bold' as const,
  fill: 0xffffff,
  stroke: 0x7a4530,
  dropShadow: true,
  dropShadowColor: 0x5a2d10,
  dropShadowBlur: 2,
  dropShadowDistance: 1,
};

function measureCardGrid(gridW: number): { cw: number; ch: number; cols: number; startX: number } {
  const cwRaw = Math.floor((gridW - CARD_GAP * (GRID_COLS + 1)) / GRID_COLS);
  const cw = Math.max(94, Math.min(CARD_MAX_W, cwRaw));
  const ch = Math.round((cw * CARD_BASE_H) / CARD_BASE_W);
  const blockW = GRID_COLS * cw + (GRID_COLS - 1) * CARD_GAP;
  const startX = Math.floor((gridW - blockW) / 2);
  return { cw, ch, cols: GRID_COLS, startX };
}

/** 列表顶留白：避免首行卡片贴上分割线 */
function decoGridListTopPad(availH: number, totalRows: number, ch: number): number {
  const baseH = CARD_GAP + totalRows * (ch + CARD_GAP);
  const minPad = 32;
  if (baseH >= availH) return minPad;
  const spare = availH - baseH;
  return Math.min(40, Math.max(minPad, Math.floor(spare * 0.32)));
}

/** 装修面板：解锁等级升序，同级按花愿价升序（仅「未解锁」筛选用） */
function sortDecosByUnlockLevelThenCost(decos: DecoDef[]): DecoDef[] {
  return [...decos].sort((a, b) => {
    const la = a.unlockRequirement?.level ?? 0;
    const lb = b.unlockRequirement?.level ?? 0;
    if (la !== lb) return la - lb;
    return a.cost - b.cost;
  });
}

/** 已满足条件可展示购买的家具 / 已拥有家具：只按花愿价升序，不看等级 */
function sortDecosByCostAsc(decos: DecoDef[]): DecoDef[] {
  return [...decos].sort((a, b) => a.cost - b.cost);
}

function sortDecosForInvFilter(decos: DecoDef[], filter: DecoInvFilter): DecoDef[] {
  return filter === 'locked' ? sortDecosByUnlockLevelThenCost(decos) : sortDecosByCostAsc(decos);
}

function sortRoomStylesByUnlockLevelThenCost(styles: RoomStyleDef[]): RoomStyleDef[] {
  return [...styles].sort((a, b) => {
    const la = a.unlockRequirement?.level ?? 0;
    const lb = b.unlockRequirement?.level ?? 0;
    if (la !== lb) return la - lb;
    return a.cost - b.cost;
  });
}

/** 家具列表库存筛选（默认打开面板为「未购买」） */
type DecoInvFilter = 'all' | 'placed' | 'not_placed' | 'not_purchased' | 'locked';

const DECO_INV_FILTER_SPECS: ReadonlyArray<{ id: DecoInvFilter; label: string }> = [
  { id: 'all', label: '全部' },
  { id: 'placed', label: '已放置' },
  { id: 'not_placed', label: '未放置' },
  { id: 'not_purchased', label: '未购买' },
  { id: 'locked', label: '未解锁' },
];

function decoMatchesInvFilter(deco: DecoDef, filter: DecoInvFilter, sceneId: string): boolean {
  const owned = DecorationManager.isUnlocked(deco.id);
  const reqMet = checkRequirement(deco.unlockRequirement).met;
  const sceneOk = isDecoAllowedInScene(deco, sceneId);
  const blocked = !reqMet || !sceneOk;
  const isPlaced = !!RoomLayoutManager.getPlacement(deco.id);
  switch (filter) {
    case 'all':
      return true;
    case 'placed':
      return owned && isPlaced;
    case 'not_placed':
      return owned && !isPlaced && sceneOk;
    case 'not_purchased':
      return !owned && !blocked;
    case 'locked':
      return !owned && blocked;
    default:
      return true;
  }
}

/** global pixel -> design coordinate */
function globalToDesignY(globalY: number): number {
  return globalY / Game.scale;
}

/** 与 BoardView / FurnitureDragSystem 一致：原生 clientY → 设计坐标纵轴 */
function nativeClientToDesignY(clientY: number): number {
  return (clientY * Game.designHeight) / Game.screenHeight;
}

function federatedPointerToDesignY(e: PIXI.FederatedPointerEvent): number {
  const n = e.nativeEvent as PointerEvent | MouseEvent | undefined;
  if (n != null && typeof (n as PointerEvent).clientY === 'number') {
    return nativeClientToDesignY((n as PointerEvent).clientY);
  }
  return globalToDesignY(e.global.y);
}

type DecoGridPendingTap =
  | { type: 'deco'; deco: DecoDef; flyCard: PIXI.Container }
  | { type: 'room'; style: RoomStyleDef; flyCard: PIXI.Container };

export class DecorationPanel extends PIXI.Container {
  private _bg!: PIXI.Graphics;
  private _content!: PIXI.Container;
  private _tabContainer!: PIXI.Container;
  /** 网格裁剪视口：与遮罩同父，避免兄弟遮罩在部分环境下不生效 */
  private _gridViewport!: PIXI.Container;
  private _gridContainer!: PIXI.Container;
  private _gridMask!: PIXI.Graphics;
  private _headerDivider!: PIXI.Container;
  private _titleText!: PIXI.Text;
  /** 右侧家具库存筛选（全部 / 已放置 / 未放置 / 未购买 / 未解锁） */
  private _filterBar!: PIXI.Container;
  /** Tab / 网格顶边（分割线以下，_build 内按顶栏比例计算） */
  private _contentTopY = 168;
  private _isOpen = false;
  private _activeTab: DecoPanelTabId = 'flower_room';
  private _decoInvFilter: DecoInvFilter = 'not_purchased';
  private _scrollY = 0;
  private _maxScrollY = 0;
  private _gridScrollListening = false;
  private _gridScrollStartDesignY = 0;
  private _gridScrollStartScrollY = 0;
  private _pendingGridTap: DecoGridPendingTap | null = null;
  /** 与 DressUp 一致：logicHeight 变化时拉伸手绘底图并重画裁剪区 */
  private _panelHBuilt = 0;
  /** NB2 底板精灵（等比缩放）；merge 回退时纵向铺满 panelH */
  private _panelBaseSprite: PIXI.Sprite | null = null;
  /** NB2 底板裁切到面板矩形（顶栏若高于 panelH 则裁顶） */
  private _panelBgMask: PIXI.Graphics | null = null;
  /** NB2 底板层（整块面板点击区） */
  private _panelBgLayer: PIXI.Container | null = null;
  /** 顶栏右上角关闭 */
  private _closeBtn!: PIXI.Container;
  /** 购买成功后「获得新家具」浮层 */
  private _unlockOverlay: PIXI.Container | null = null;
  /** 飞星结束前暂存，用于到账加星与弹窗顺序 */
  private _pendingDecoGrantStar: DecoDef | null = null;
  /** 升星弹窗关闭后再弹出「获得新家具」 */
  private _pendingNewDecoAfterLevelUp: DecoDef | null = null;

  private readonly _onCurrencyChangedForGrid = (type?: string): void => {
    if (!this._isOpen || type !== 'huayuan') return;
    this._refreshAll();
  };

  private readonly _onCollectionDiscoveredForGrid = (): void => {
    if (!this._isOpen) return;
    this._refreshAll();
  };

  constructor() {
    super();
    this.visible = false;
    this.zIndex = DECO_PANEL_Z_INDEX;
    this.sortableChildren = true;
    this._build();
    EventBus.on('decoration:shopStarFlyComplete', this._onShopStarFlyComplete);
    EventBus.on('shop:levelUpPopupClosed', this._onShopLevelUpPopupClosed);
  }

  // ─── touch scroll：pointermove/up 绑 canvas（微信小游戏上 stage 级 move 常丢失）────

  private readonly _onCanvasGridMove = (ev: PointerEvent): void => {
    if (!this._isOpen || !this._gridScrollListening) return;
    const dy = nativeClientToDesignY(ev.clientY) - this._gridScrollStartDesignY;
    this._scrollY = Math.max(-this._maxScrollY, Math.min(0, this._gridScrollStartScrollY + dy));
    this._applyScroll();
  };

  private readonly _onCanvasGridUp = (ev: PointerEvent): void => {
    this._finishGridScroll(ev);
  };

  private _unbindCanvasGridScroll(): void {
    const canvas = Game.app.view as unknown as HTMLCanvasElement | undefined;
    if (!canvas?.removeEventListener) return;
    canvas.removeEventListener('pointermove', this._onCanvasGridMove);
    canvas.removeEventListener('pointerup', this._onCanvasGridUp);
    canvas.removeEventListener('pointercancel', this._onCanvasGridUp);
  }

  private _finishGridScroll(ev?: PointerEvent): void {
    if (!this._gridScrollListening) return;
    this._unbindCanvasGridScroll();
    this._gridScrollListening = false;

    const endDesignY = ev != null ? nativeClientToDesignY(ev.clientY) : this._gridScrollStartDesignY;
    const movedPx = Math.abs(endDesignY - this._gridScrollStartDesignY);
    const pending = this._pendingGridTap;
    this._pendingGridTap = null;
    if (movedPx < 12 && pending) {
      if (pending.type === 'deco') this._onCardTap(pending.deco, pending.flyCard);
      else this._onRoomStyleTap(pending.style, pending.flyCard);
    }
  }

  private _beginScroll(e: PIXI.FederatedPointerEvent): void {
    if (this._gridScrollListening || !this._isOpen) return;
    this._gridScrollListening = true;
    this._gridScrollStartDesignY = federatedPointerToDesignY(e);
    this._gridScrollStartScrollY = this._scrollY;
    const canvas = Game.app.view as unknown as HTMLCanvasElement | undefined;
    if (canvas?.addEventListener) {
      canvas.addEventListener('pointermove', this._onCanvasGridMove);
      canvas.addEventListener('pointerup', this._onCanvasGridUp);
      canvas.addEventListener('pointercancel', this._onCanvasGridUp);
    }
  }

  private _teardownScroll(): void {
    if (!this._gridScrollListening) return;
    this._unbindCanvasGridScroll();
    this._gridScrollListening = false;
    this._pendingGridTap = null;
  }

  private _addScrollPlate(inner: PIXI.Container, w: number, h: number): void {
    const plate = new PIXI.Container();
    plate.eventMode = 'static';
    plate.hitArea = new PIXI.Rectangle(0, 0, w, h);
    plate.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      this._beginScroll(e);
      this._pendingGridTap = null;
    });
    inner.addChildAt(plate, 0);
  }

  // ─── open / close ─────────────────────────────────────────

  /** 与 overlay 内其它节点 zIndex 排序（含抬升后的星级条） */
  private _sortParentOverlay(): void {
    const p = this.parent;
    if (p?.sortableChildren) p.sortChildren();
  }

  open(): void {
    if (this._isOpen) return;
    this._isOpen = true;
    this.visible = true;
    EventBus.emit('decoration:decoPanelBackdrop', { open: true });
    this._sortParentOverlay();
    this._activeTab = 'flower_room';
    this._decoInvFilter = 'not_purchased';
    this._redrawDimMask();
    this._resizePanelIfNeeded();
    this._refreshAll();
    EventBus.on('currency:changed', this._onCurrencyChangedForGrid);
    EventBus.on('collection:discovered', this._onCollectionDiscoveredForGrid);

    const h = Game.logicHeight;
    const panelH = Math.round(h * PANEL_H_RATIO);
    const panelY = h - panelH;
    const panelX = this._content.position.x;

    TweenManager.cancelTarget(this._content.position);
    this._content.position.set(panelX, h);
    this.alpha = 0;
    TweenManager.to({ target: this, props: { alpha: 1 }, duration: 0.18, ease: Ease.easeOutQuad });
    TweenManager.to({ target: this._content.position, props: { y: panelY }, duration: 0.28, ease: Ease.easeOutQuad });
  }

  close(): void {
    if (!this._isOpen) return;
    EventBus.off('currency:changed', this._onCurrencyChangedForGrid);
    EventBus.off('collection:discovered', this._onCollectionDiscoveredForGrid);
    EventBus.emit('decoration:decoPanelBackdrop', { open: false });
    this._sortParentOverlay();
    this._flushDeferredStarOnClose();
    this._pendingNewDecoAfterLevelUp = null;
    this._dismissUnlockPopup();
    this._teardownScroll();
    this._isOpen = false;
    const h = Game.logicHeight;
    TweenManager.cancelTarget(this._content.position);
    TweenManager.to({ target: this._content.position, props: { y: h }, duration: 0.22, ease: Ease.easeInQuad });
    TweenManager.to({
      target: this, props: { alpha: 0 }, duration: 0.2, ease: Ease.easeInQuad,
      onComplete: () => { this.visible = false; },
    });
  }

  /** 顶栏粉区下沿、筛选条、分割线、内容顶与网格几何（随 panel 高度变化） */
  private _headerLayout(panelH: number): {
    filterBarTop: number;
    dividerY: number;
    contentTopY: number;
    tabColumnH: number;
    gridViewportTop: number;
    gridH: number;
    gridX: number;
    gridW: number;
  } {
    const pinkBandBottom = Math.round(panelH * PANEL_PINK_BAND_BOTTOM_RATIO);
    const filterBarTop = Math.round(pinkBandBottom + FILTER_ROW_GAP_BELOW_PINK + HEADER_CHROME_EXTRA_Y);
    const dividerY = Math.round(filterBarTop + FILTER_BAR_H + DIVIDER_BELOW_FILTER_GAP);
    const contentTopY = Math.round(dividerY + DIVIDER_TO_CONTENT - HEADER_CHROME_EXTRA_Y);
    const tabColumnH = panelH - contentTopY - CONTENT_BOTTOM;
    const gridViewportTop = contentTopY + GRID_VIEWPORT_TOP_INSET;
    const gridH = Math.max(48, panelH - gridViewportTop - CONTENT_BOTTOM);
    const gridX = decoPanelGridOriginX();
    const gridW = decoPanelGridWidth();
    return {
      filterBarTop,
      dividerY,
      contentTopY,
      tabColumnH,
      gridViewportTop,
      gridH,
      gridX,
      gridW,
    };
  }

  /** 筛选条下方：复用棋盘顶 `board_bar`（与 BoardView 一致）；无图时矢量双条兜底 */
  private _layoutHeaderDivider(dividerY: number): void {
    this._headerDivider.removeChildren();
    const barTex = TextureCache.get('board_bar');
    const barW = Math.max(200, PANEL_W - HEADER_BOARD_BAR_SIDE_INSET * 2);
    if (barTex?.width) {
      const sp = new PIXI.Sprite(barTex);
      sp.width = barW;
      sp.height = BOARD_BAR_HEIGHT;
      sp.anchor.set(0.5, 1);
      sp.position.set(PANEL_W / 2, dividerY);
      sp.eventMode = 'none';
      this._headerDivider.addChild(sp);
      return;
    }
    const divHalfW = Math.round(barW / 2);
    const cx = Math.round(PANEL_W / 2);
    const x0 = cx - divHalfW;
    const x1 = cx + divHalfW;
    const g = new PIXI.Graphics();
    g.lineStyle(3.5, 0x8fb0a3, 0.52);
    g.moveTo(x0, dividerY + 1.25);
    g.lineTo(x1, dividerY + 1.25);
    g.lineStyle(2.5, 0xfff2f6, 0.94);
    g.moveTo(x0, dividerY - 1);
    g.lineTo(x1, dividerY - 1);
    g.eventMode = 'none';
    this._headerDivider.addChild(g);
  }

  /** 仅同步顶区与黄条（resize 时用；open 内会再 _refreshAll 重建 Tab/网格） */
  private _applyHeaderChrome(panelH: number): void {
    const L = this._headerLayout(panelH);
    this._contentTopY = L.contentTopY;
    this._filterBar.position.set(L.gridX, L.filterBarTop);
    const titleY = Math.round(panelH * PANEL_TITLE_Y_RATIO + HEADER_CHROME_EXTRA_Y);
    this._titleText.position.y = titleY;
    this._closeBtn.position.set(PANEL_W - DECO_CLOSE_BTN_INSET_RIGHT, titleY);
    this._layoutHeaderDivider(L.dividerY);
  }

  private _buildCloseBtn(panelH: number): void {
    const titleY = Math.round(panelH * PANEL_TITLE_Y_RATIO + HEADER_CHROME_EXTRA_Y);
    this._closeBtn = new PIXI.Container();
    this._closeBtn.zIndex = 25;
    this._closeBtn.position.set(PANEL_W - DECO_CLOSE_BTN_INSET_RIGHT, titleY);
    this._closeBtn.eventMode = 'static';
    this._closeBtn.cursor = 'pointer';
    const closeTex = TextureCache.get('deco_nb2_close_btn_1x1') ?? TextureCache.get('warehouse_close_btn');
    const closeSp = new PIXI.Sprite(closeTex ?? PIXI.Texture.EMPTY);
    closeSp.anchor.set(0.5);
    if (closeTex && closeTex.width > 0) {
      const s = DECO_CLOSE_BTN_MAX_SIDE / Math.max(closeTex.width, closeTex.height);
      closeSp.scale.set(s);
    }
    this._closeBtn.addChild(closeSp);
    const hit = Math.max(DECO_CLOSE_BTN_MAX_SIDE + DECO_CLOSE_BTN_HIT_PAD * 2, 72);
    this._closeBtn.hitArea = new PIXI.Circle(0, 0, hit / 2);
    const onClose = (e: PIXI.FederatedPointerEvent): void => {
      e.stopPropagation();
      this.close();
    };
    this._closeBtn.on('pointerdown', onClose);
    this._closeBtn.on('pointertap', onClose);
    this._content.addChild(this._closeBtn);
  }

  // ─── build ────────────────────────────────────────────────

  private _build(): void {
    const w = DESIGN_WIDTH;
    const h = Game.logicHeight;

    // dim overlay（全屏；本面板 zIndex 低于抬升的星级条，点遮罩空白区关闭；进度条区由 ShopScene 穿透）
    this._bg = new PIXI.Graphics();
    this._redrawDimMask();
    this._bg.eventMode = 'static';
    this._bg.zIndex = 0;
    const onDimClose = (): void => this.close();
    this._bg.on('pointertap', onDimClose);
    this._bg.on('pointerdown', onDimClose);
    this.addChild(this._bg);

    const panelH = Math.round(h * PANEL_H_RATIO);
    const panelX = PANEL_MARGIN_LEFT;
    const panelY = h - panelH;

    this._content = new PIXI.Container();
    this._content.sortableChildren = true;
    this._content.zIndex = 10;
    this._content.position.set(panelX, panelY);
    this.addChild(this._content);

    // --- panel background: NB2 底板（上段取样等比 + 底贴齐） or merge_chain_panel（铺满） ---
    const nb2Tex = TextureCache.get('decoration_panel_bg_nb2');
    const mergeTex = TextureCache.get('merge_chain_panel');
    this._panelBaseSprite = null;
    this._panelBgMask = null;
    this._panelBgLayer = null;
    if (nb2Tex?.width) {
      const fr = nb2Tex.frame;
      const cropH = Math.max(1, Math.floor(fr.height * DECO_PANEL_BG_TOP_RATIO));
      const subFrame = new PIXI.Rectangle(fr.x, fr.y, fr.width, cropH);
      const croppedTex = new PIXI.Texture(nb2Tex.baseTexture, subFrame);
      const panelBg = new PIXI.Sprite(croppedTex);
      panelBg.anchor.set(0.5, 1);
      panelBg.eventMode = 'static';
      panelBg.zIndex = 0;
      const bgLayer = new PIXI.Container();
      bgLayer.sortableChildren = true;
      bgLayer.zIndex = 0;
      bgLayer.eventMode = 'static';
      bgLayer.hitArea = new PIXI.Rectangle(0, 0, PANEL_W, panelH);
      const bgMask = new PIXI.Graphics();
      bgMask.beginFill(0xffffff);
      bgMask.drawRect(0, 0, PANEL_W, panelH);
      bgMask.endFill();
      bgLayer.addChild(panelBg);
      bgLayer.addChild(bgMask);
      bgLayer.mask = bgMask;
      this._content.addChild(bgLayer);
      this._panelBaseSprite = panelBg;
      this._panelBgMask = bgMask;
      this._panelBgLayer = bgLayer;
      this._layoutNb2PanelBackground(panelH);
    } else if (mergeTex?.width) {
      const panelBg = new PIXI.Sprite(mergeTex);
      panelBg.width = PANEL_W;
      panelBg.height = panelH;
      panelBg.eventMode = 'static';
      panelBg.zIndex = 0;
      this._content.addChild(panelBg);
      this._panelBaseSprite = panelBg;
    } else {
      const g = new PIXI.Graphics();
      g.lineStyle(3, 0xd97b00);
      g.beginFill(0xfff9e6);
      g.drawRoundedRect(0, 0, PANEL_W, panelH, PANEL_TOP_R);
      g.endFill();
      g.lineStyle(2, 0xffd700);
      g.drawRoundedRect(3, 3, PANEL_W - 6, panelH - 6, PANEL_TOP_R - 2);
      g.eventMode = 'static';
      g.zIndex = 0;
      this._content.addChild(g);
    }

    // --- 顶栏：无彩带；标题「家具」叠在底板粉区 ---
    const titleCenterY = Math.round(panelH * PANEL_TITLE_Y_RATIO + HEADER_CHROME_EXTRA_Y);
    const L = this._headerLayout(panelH);

    this._titleText = new PIXI.Text('家具', {
      ...DECO_PANEL_CHROME_TEXT_BASE,
      fontSize: 34,
      strokeThickness: 5,
    } as any);
    this._titleText.anchor.set(0.5, 0.5);
    this._titleText.position.set(PANEL_W / 2, titleCenterY);
    this._titleText.zIndex = 12;
    this._content.addChild(this._titleText);

    this._buildCloseBtn(panelH);

    // --- 右侧库存筛选条（仅家具网格列宽；「房间风格」时隐藏） ---
    this._filterBar = new PIXI.Container();
    this._filterBar.position.set(L.gridX, L.filterBarTop);
    this._filterBar.zIndex = 11;
    this._content.addChild(this._filterBar);
    this._buildInventoryFilterBar(L.gridW);

    // --- 顶部分隔：棋盘同款 board_bar ---
    this._headerDivider = new PIXI.Container();
    this._headerDivider.zIndex = 11;
    this._headerDivider.eventMode = 'none';
    this._layoutHeaderDivider(L.dividerY);
    this._content.addChild(this._headerDivider);

    this._contentTopY = L.contentTopY;

    // --- layout zones（Tab 列与网格之间留白对称） ---
    const { gridX, gridW, tabColumnH, gridViewportTop, gridH } = L;

    this._tabContainer = new PIXI.Container();
    this._tabContainer.zIndex = 8;
    this._content.addChild(this._tabContainer);

    this._buildTabs(tabColumnH);
    this._syncTabColumnY(gridW, gridH, gridViewportTop);

    this._gridViewport = new PIXI.Container();
    this._gridViewport.position.set(gridX, gridViewportTop);
    this._gridViewport.eventMode = 'static';
    this._gridViewport.hitArea = new PIXI.Rectangle(0, 0, gridW, gridH);
    this._gridViewport.zIndex = 5;
    this._content.addChild(this._gridViewport);

    // 遮罩挂在 viewport 上：滚动时 inner.y 为负，仍能裁掉超出网格矩形的像素（避免顶穿筛选条/阴影区）
    this._gridMask = new PIXI.Graphics();
    this._gridMask.beginFill(0xffffff);
    this._gridMask.drawRect(0, 0, gridW, gridH);
    this._gridMask.endFill();
    this._gridMask.eventMode = 'none';
    this._gridViewport.addChild(this._gridMask);
    this._gridViewport.mask = this._gridMask;

    this._gridContainer = new PIXI.Container();
    this._gridViewport.addChild(this._gridContainer);

    // wheel scroll
    this._gridContainer.eventMode = 'static';
    this._gridContainer.on('wheel', (e: any) => {
      this._scrollY = Math.max(-this._maxScrollY, Math.min(0, this._scrollY - (e.deltaY || 0)));
      this._applyScroll();
    });

    this._panelHBuilt = panelH;
  }

  private _gridLayoutMetrics(): { gridX: number; gridW: number; gridH: number; gridViewportTop: number } {
    const panelH = Math.round(Game.logicHeight * PANEL_H_RATIO);
    const gridX = decoPanelGridOriginX();
    const gridW = decoPanelGridWidth();
    const gridViewportTop = this._contentTopY + GRID_VIEWPORT_TOP_INSET;
    const gridH = Math.max(48, panelH - gridViewportTop - CONTENT_BOTTOM);
    return { gridX, gridW, gridH, gridViewportTop };
  }

  /** 右侧五格筛选：全部 / 已放置 / 未放置 / 未购买 / 未解锁（deco_rarity_tag_fine / _common，等比缩放） */
  private _buildInventoryFilterBar(gridW: number): void {
    this._filterBar.removeChildren();
    const n = DECO_INV_FILTER_SPECS.length;
    const gap = 6;
    const cellW = (gridW - gap * (n - 1)) / n;
    const rowH = FILTER_BAR_H - 6;
    const padY = Math.max(1, Math.floor((FILTER_BAR_H - rowH) / 2));
    const texFine = TextureCache.get('deco_rarity_tag_fine');
    const texCommon = TextureCache.get('deco_rarity_tag_common');
    const useTagSprites = texFine != null && texCommon != null;

    DECO_INV_FILTER_SPECS.forEach((spec, i) => {
      const cell = new PIXI.Container();
      cell.position.set(i * (cellW + gap), padY);
      cell.hitArea = new PIXI.Rectangle(0, 0, cellW, rowH);
      const sel = this._decoInvFilter === spec.id;

      if (useTagSprites) {
        const tex = sel ? texFine! : texCommon!;
        const iw = tex.orig.width;
        const ih = tex.orig.height;
        const scale = Math.min(cellW / iw, rowH / ih);
        const sp = new PIXI.Sprite(tex);
        sp.anchor.set(0.5, 0.5);
        sp.position.set(cellW / 2, rowH / 2);
        sp.scale.set(scale);
        cell.addChild(sp);
      } else {
        const bg = new PIXI.Graphics();
        if (sel) {
          bg.beginFill(TAB_BG_SELECTED);
          bg.drawRoundedRect(0, 0, cellW, rowH, rowH / 2);
          bg.endFill();
          bg.lineStyle(1.5, COLORS.BUTTON_PRIMARY, 0.9);
          bg.drawRoundedRect(0, 0, cellW, rowH, rowH / 2);
        } else {
          bg.beginFill(TAB_BG_IDLE);
          bg.drawRoundedRect(0, 0, cellW, rowH, rowH / 2);
          bg.endFill();
          bg.lineStyle(1, TAB_BORDER_IDLE, 0.85);
          bg.drawRoundedRect(0, 0, cellW, rowH, rowH / 2);
        }
        cell.addChild(bg);
      }

      const t = new PIXI.Text(spec.label, {
        ...DECO_PANEL_CHROME_TEXT_BASE,
        fontSize: 17,
        strokeThickness: 3,
        lineHeight: 23,
      } as any);
      t.anchor.set(0.5, 0.5);
      t.position.set(cellW / 2, rowH / 2);
      cell.addChild(t);

      cell.eventMode = 'static';
      cell.cursor = 'pointer';
      const fid = spec.id;
      cell.on('pointertap', () => {
        if (this._decoInvFilter === fid) return;
        this._decoInvFilter = fid;
        this._scrollY = 0;
        this._buildInventoryFilterBar(gridW);
        const { gridH } = this._gridLayoutMetrics();
        this._buildGrid(gridH);
      });
      this._filterBar.addChild(cell);
    });
  }

  private _syncGridViewportClip(): void {
    const { gridX, gridW, gridH, gridViewportTop } = this._gridLayoutMetrics();
    this._gridViewport.position.set(gridX, gridViewportTop);
    this._gridViewport.hitArea = new PIXI.Rectangle(0, 0, gridW, gridH);
    this._gridMask.clear();
    this._gridMask.beginFill(0xffffff);
    this._gridMask.drawRect(0, 0, gridW, gridH);
    this._gridMask.endFill();
  }

  /** NB2 底板：宽对齐设计宽，高等比；锚点底中，y = panelH */
  private _layoutNb2PanelBackground(panelH: number): void {
    const sp = this._panelBaseSprite;
    if (!sp || !this._panelBgMask) return;
    const tw = sp.texture.width;
    const th = sp.texture.height;
    const scale = PANEL_W / tw;
    sp.width = PANEL_W;
    sp.height = th * scale;
    sp.position.set(PANEL_W / 2, panelH);
    this._panelBgMask.clear();
    this._panelBgMask.beginFill(0xffffff);
    this._panelBgMask.drawRect(0, 0, PANEL_W, panelH);
    this._panelBgMask.endFill();
    if (this._panelBgLayer) {
      this._panelBgLayer.hitArea = new PIXI.Rectangle(0, 0, PANEL_W, panelH);
    }
  }

  private _resizePanelIfNeeded(): void {
    const panelH = Math.round(Game.logicHeight * PANEL_H_RATIO);
    if (panelH === this._panelHBuilt) return;
    if (this._panelBaseSprite) {
      if (this._panelBgMask) {
        this._layoutNb2PanelBackground(panelH);
      } else {
        this._panelBaseSprite.height = panelH;
      }
    } else {
      const bg = this._content.children[0];
      if (bg instanceof PIXI.Sprite) bg.height = panelH;
    }
    this._panelHBuilt = panelH;
    this._applyHeaderChrome(panelH);
    this._syncGridViewportClip();
    if (this._isOpen) {
      const { gridW, gridH, gridViewportTop } = this._gridLayoutMetrics();
      this._syncTabColumnY(gridW, gridH, gridViewportTop);
    }
  }

  /**
   * 网格视口内首行家具图区域顶边 Y（与 _buildCard 中 icon 区一致；房间风格卡用相同 iconCy / maxIcon 近似）。
   */
  private _approxFirstRowIconTopInGrid(gridW: number, gridH: number): number {
    const { cw, ch, cols } = measureCardGrid(gridW);
    let totalRows: number;
    if (this._activeTab === 'room_styles') {
      totalRows = Math.max(1, Math.ceil(ROOM_STYLES.length / cols));
    } else {
      const sceneId = CurrencyManager.state.sceneId;
      let decos = sortDecosForInvFilter(
        getDecosForDecorationPanelTab(this._activeTab, sceneId),
        this._decoInvFilter,
      );
      decos = decos.filter((d) => decoMatchesInvFilter(d, this._decoInvFilter, sceneId));
      totalRows = decos.length === 0 ? 1 : Math.ceil(decos.length / cols);
    }
    const listTopPad = decoGridListTopPad(gridH, totalRows, ch);
    const cardTop = listTopPad + CARD_GAP;
    const iconCy = Math.round((ch * 54) / CARD_BASE_H);
    const maxIcon = Math.round((82 * cw) / CARD_BASE_W);
    return cardTop + iconCy - maxIcon * 0.5;
  }

  /** 与 _buildTabs 使用同一行高逻辑（resize 时无需依赖上次 build） */
  private _tabRowHeightForColumn(availH: number): number {
    const tabCount = DECO_PANEL_TABS.length;
    const idealBlock = tabCount * TAB_ROW_H;
    if (availH >= idealBlock) return TAB_ROW_H;
    return Math.max(TAB_ROW_MIN_H, Math.floor(availH / tabCount));
  }

  /** 左侧 Tab 列 Y：首颗药丸可视顶与首行家具图顶对齐 */
  private _syncTabColumnY(gridW: number, gridH: number, gridViewportTop: number): void {
    const iconTop = this._approxFirstRowIconTopInGrid(gridW, gridH);
    const panelH = Math.round(Game.logicHeight * PANEL_H_RATIO);
    const availH = panelH - this._contentTopY - CONTENT_BOTTOM;
    const tabH = this._tabRowHeightForColumn(availH);
    const pad = 2;
    const bh = tabH - pad * 2;
    const bw = TAB_W - pad * 2;
    let dh: number;
    const idleTabTex = TextureCache.get('deco_panel_tab_idle_nb2');
    const selTabTex = TextureCache.get('deco_panel_tab_selected_nb2');
    if (idleTabTex != null && selTabTex != null) {
      const iw = idleTabTex.orig.width;
      const ih = idleTabTex.orig.height;
      const scale = Math.min(bw / iw, bh / ih);
      dh = ih * scale;
    } else {
      let dhh = Math.round(bw / TAB_PILL_TEXTURE_ASPECT);
      if (dhh > bh) dhh = bh;
      dh = dhh;
    }
    const pillTopInRow = (tabH - dh) / 2;
    const rawY = gridViewportTop + iconTop - pillTopInRow;
    const tabY = Math.max(this._contentTopY + 4, Math.round(rawY));
    this._tabContainer.position.set(TAB_COLUMN_LEFT, tabY);
  }

  // ─── tabs (left column, pill-shaped text buttons) ─────────

  private _buildTabs(availH: number): void {
    this._tabContainer.removeChildren();

    const tabH = this._tabRowHeightForColumn(availH);
    const pad = 2;
    const bw = TAB_W - pad * 2;

    const idleTabTex = TextureCache.get('deco_panel_tab_idle_nb2');
    const selTabTex = TextureCache.get('deco_panel_tab_selected_nb2');
    const useNb2TabSprites = idleTabTex != null && selTabTex != null;

    const makeTab = (row: number, isCurrent: boolean, title: string, onTap: () => void): void => {
      const tab = new PIXI.Container();
      tab.position.set(0, row * tabH);
      const bh = tabH - pad * 2;

      const drop = new PIXI.Graphics();
      tab.addChild(drop);

      if (useNb2TabSprites) {
        const tex = isCurrent ? selTabTex! : idleTabTex!;
        const iw = tex.orig.width;
        const ih = tex.orig.height;
        const scale = Math.min(bw / iw, bh / ih);
        const dw = iw * scale;
        const dh = ih * scale;
        const dx = (TAB_W - dw) / 2;
        const dy = (tabH - dh) / 2;
        const cornerR = Math.min(dw, dh) * 0.5;
        drop.beginFill(0x4a3020, 0.08);
        drop.drawRoundedRect(dx + 1, dy + 2, dw, dh, cornerR);
        drop.endFill();

        const bg = new PIXI.Sprite(tex);
        bg.anchor.set(0.5, 0.5);
        bg.position.set(TAB_W / 2, tabH / 2);
        bg.scale.set(scale);
        tab.addChild(bg);
      } else {
        let dw = bw;
        let dh = Math.round(bw / TAB_PILL_TEXTURE_ASPECT);
        if (dh > bh) {
          dh = bh;
          dw = Math.round(bh * TAB_PILL_TEXTURE_ASPECT);
        }
        const x0 = pad + (bw - dw) / 2;
        const y0 = pad + (bh - dh) / 2;
        const r = dh / 2;
        drop.beginFill(0x4a3020, 0.08);
        drop.drawRoundedRect(x0 + 1, y0 + 2, dw, dh, r);
        drop.endFill();

        const bg = new PIXI.Graphics();
        if (isCurrent) {
          bg.beginFill(TAB_BG_SELECTED);
          bg.drawRoundedRect(x0, y0, dw, dh, r);
          bg.endFill();
          bg.lineStyle(2.5, COLORS.BUTTON_PRIMARY);
          bg.drawRoundedRect(x0, y0, dw, dh, r);
          const ir = Math.max(5, r - 3);
          bg.lineStyle(1.2, TAB_BG_SELECTED_INNER, 0.85);
          bg.drawRoundedRect(x0 + 2, y0 + 2, dw - 4, dh - 4, ir);
        } else {
          bg.beginFill(TAB_BG_IDLE);
          bg.drawRoundedRect(x0, y0, dw, dh, r);
          bg.endFill();
          bg.lineStyle(1.25, TAB_BORDER_IDLE, 0.95);
          bg.drawRoundedRect(x0, y0, dw, dh, r);
        }
        tab.addChild(bg);
      }

      const label = new PIXI.Text(title, {
        ...DECO_PANEL_CHROME_TEXT_BASE,
        fontSize: 20,
        strokeThickness: 4,
        lineHeight: 26,
        wordWrap: true,
        wordWrapWidth: Math.max(58, bw - 6),
        align: 'center',
      } as any);
      label.anchor.set(0.5, 0.5);
      label.position.set(TAB_W / 2, tabH / 2);
      tab.addChild(label);

      tab.eventMode = 'static';
      tab.cursor = 'pointer';
      tab.on('pointertap', () => { onTap(); this._scrollY = 0; this._refreshAll(); });
      this._tabContainer.addChild(tab);
    };

    DECO_PANEL_TABS.forEach((tab, i) => {
      const label = getDecorationTabLabel(tab);
      const isCurrent = this._activeTab === tab;
      const title = label.name;
      makeTab(i, isCurrent, title, () => { this._activeTab = tab; });
    });
  }

  // ─── refresh ──────────────────────────────────────────────

  private _refreshAll(): void {
    const panelH = Math.round(Game.logicHeight * PANEL_H_RATIO);
    const tabColumnH = panelH - this._contentTopY - CONTENT_BOTTOM;
    const { gridH, gridW, gridViewportTop } = this._gridLayoutMetrics();
    this._buildTabs(tabColumnH);
    this._buildInventoryFilterBar(gridW);
    this._filterBar.visible = this._activeTab !== 'room_styles';
    this._syncGridViewportClip();
    this._buildGrid(gridH);
    this._syncTabColumnY(gridW, gridH, gridViewportTop);
  }

  // ─── grid ─────────────────────────────────────────────────

  /** 仅清除滚动内容（遮罩在 viewport 上，不在 gridContainer 内） */
  private _clearGridScrollContent(): void {
    this._gridContainer.removeChildren();
  }

  private _buildGrid(availH: number): void {
    this._clearGridScrollContent();
    if (this._activeTab === 'room_styles') { this._buildRoomStyleGrid(availH); return; }

    const sceneId = CurrencyManager.state.sceneId;
    let decos = sortDecosForInvFilter(
      getDecosForDecorationPanelTab(this._activeTab, sceneId),
      this._decoInvFilter,
    );
    decos = decos.filter((d) => decoMatchesInvFilter(d, this._decoInvFilter, sceneId));
    const gridW = decoPanelGridWidth();
    const { cw, ch, cols, startX } = measureCardGrid(gridW);

    const inner = new PIXI.Container();
    this._gridContainer.addChild(inner);

    if (decos.length === 0) {
      const hint = '该筛选下暂无家具';
      const empty = new PIXI.Text(hint, {
        fontSize: 15,
        fill: COLORS.TEXT_LIGHT,
        fontFamily: FONT_FAMILY,
        align: 'center',
      });
      empty.anchor.set(0.5, 0.5);
      empty.position.set(gridW / 2, availH / 2);
      inner.addChild(empty);
      this._addScrollPlate(inner, gridW, availH);
      this._maxScrollY = 0;
      this._scrollY = 0;
      return;
    }

    const totalRows = Math.ceil(decos.length / cols);
    const listTopPad = decoGridListTopPad(availH, totalRows, ch);

    decos.forEach((deco, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const y = listTopPad + CARD_GAP + row * (ch + CARD_GAP);
      inner.addChild(this._buildCard(deco, startX + col * (cw + CARD_GAP), y, cw, ch));
    });

    const contentH = listTopPad + CARD_GAP + totalRows * (ch + CARD_GAP);
    this._addScrollPlate(inner, gridW, contentH);
    this._maxScrollY = Math.max(0, contentH - availH);
    this._scrollY = 0;
  }

  private _buildRoomStyleGrid(availH: number): void {
    const gridW = decoPanelGridWidth();
    const { cw, ch, cols, startX } = measureCardGrid(gridW);

    const inner = new PIXI.Container();
    this._gridContainer.addChild(inner);

    const stylesSorted = sortRoomStylesByUnlockLevelThenCost(ROOM_STYLES);
    const totalRows = Math.ceil(stylesSorted.length / cols);
    const listTopPad = decoGridListTopPad(availH, totalRows, ch);

    stylesSorted.forEach((style, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const y = listTopPad + CARD_GAP + row * (ch + CARD_GAP);
      inner.addChild(this._buildRoomStyleCard(style, startX + col * (cw + CARD_GAP), y, cw, ch));
    });

    const contentH = listTopPad + CARD_GAP + totalRows * (ch + CARD_GAP);
    this._addScrollPlate(inner, gridW, contentH);
    this._maxScrollY = Math.max(0, contentH - availH);
    this._scrollY = 0;
  }

  // ─── card chrome (programmatic gold-edge card) ────────────

  private _drawCardBg(card: PIXI.Container, cw: number, ch: number, unlocked: boolean, equipped: boolean): void {
    const shadow = new PIXI.Graphics();
    shadow.beginFill(SHADOW_COLOR, 0.15);
    shadow.drawRoundedRect(2, 3, cw, ch, CARD_R);
    shadow.endFill();
    card.addChild(shadow);

    const bg = new PIXI.Graphics();
    if (equipped) {
      bg.lineStyle(2.5, COLORS.BUTTON_PRIMARY, 0.95);
    } else {
      bg.lineStyle(2, GOLD_LINE, unlocked ? 0.85 : 0.45);
    }
    bg.beginFill(unlocked ? CREAM_FILL : 0xF0ECEA, unlocked ? 0.98 : 0.75);
    bg.drawRoundedRect(0, 0, cw, ch, CARD_R);
    bg.endFill();

    if (unlocked) {
      bg.lineStyle(1, GOLD_INNER, equipped ? 0.35 : 0.45);
      bg.drawRoundedRect(3, 3, cw - 6, ch - 6, Math.max(6, CARD_R - 2));
    }
    card.addChild(bg);
  }

  // ─── 星星值角标（购买后获得的 ⭐，与稀有度无关）────────────────

  private _addStarValueBadge(card: PIXI.Container, cw: number, starValue: number): void {
    const tagPad = 4;
    const iconH = Math.min(19, Math.max(14, Math.round(cw * 0.11)));
    const gap = 4;
    const fontSize = Math.round(Math.min(13, Math.max(11, cw * 0.085)));

    const wrap = new PIXI.Container();
    wrap.position.set(tagPad, tagPad);

    const content = new PIXI.Container();
    let iconW = iconH;
    const starTex = TextureCache.get('icon_star');
    if (starTex?.width) {
      const sp = new PIXI.Sprite(starTex);
      sp.height = iconH;
      sp.width = (starTex.width / starTex.height) * iconH;
      sp.position.set(0, 0);
      content.addChild(sp);
      iconW = sp.width;
    } else {
      const fb = new PIXI.Text('⭐', { fontSize: Math.round(iconH * 0.9), fontFamily: FONT_FAMILY });
      content.addChild(fb);
      iconW = fb.width;
    }

    const num = new PIXI.Text(String(starValue), {
      fontSize,
      fill: 0x8D4A1A,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: 0xFFFFFF,
      strokeThickness: 2,
    } as any);
    num.anchor.set(0, 0.5);
    num.position.set(iconW + gap, iconH / 2);
    content.addChild(num);

    const pillPadX = 6;
    const pillPadY = 3;
    const pillW = pillPadX * 2 + iconW + gap + num.width;
    const pillH = pillPadY * 2 + iconH;

    const pill = new PIXI.Graphics();
    pill.beginFill(0xFFF3E0, 0.95);
    pill.lineStyle(1.2, 0xFFB74D, 0.88);
    pill.drawRoundedRect(0, 0, pillW, pillH, 9);
    pill.endFill();
    wrap.addChild(pill);
    content.position.set(pillPadX, pillPadY);
    wrap.addChild(content);

    card.addChild(wrap);
  }

  // ─── equipped badge ───────────────────────────────────────

  private _addEquipBadge(card: PIXI.Container, cw: number): void {
    const bg = new PIXI.Graphics();
    bg.beginFill(COLORS.BUTTON_PRIMARY);
    bg.drawCircle(cw - 14, 14, 11);
    bg.endFill();
    card.addChild(bg);
    const t = new PIXI.Text('✓', { fontSize: 13, fill: 0xffffff, fontFamily: FONT_FAMILY, fontWeight: 'bold' });
    t.anchor.set(0.5, 0.5);
    t.position.set(cw - 14, 14);
    card.addChild(t);
  }

  // ─── card footer (btn sprites + text overlay) ─────────────

  private _addFooter(
    card: PIXI.Container, cw: number, ch: number,
    mode:
      | 'equipped'
      | 'ready'
      | 'purchase'
      | 'locked'
      | 'furniture_placed'
      | 'furniture_go_place',
    cost: number | undefined,
    actionLabel: string,
  ): void {
    const purchaseUnaffordable =
      mode === 'purchase' && cost !== undefined && cost > 0 && CurrencyManager.state.huayuan < cost;
    const purchaseFooterAlpha = purchaseUnaffordable ? DECO_PURCHASE_BTN_DISABLED_ALPHA : 1;
    const key =
      mode === 'equipped' || mode === 'furniture_placed'
        ? 'deco_card_btn_1'
        : mode === 'locked'
          ? 'deco_card_btn_2'
          : 'deco_card_btn_3';
    const tex = TextureCache.get(key);
    const bottomPad = 10;
    const maxBtnW = cw - 12;
    const targetH = Math.min(48, Math.round((38 * ch) / CARD_BASE_H));
    const labelFont = 18;
    const labelStyle = {
      fontSize: labelFont,
      fill: 0xffffff,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold' as const,
      stroke: 0x333333,
      strokeThickness: 2,
    };
    let lineText: string;
    if (mode === 'furniture_placed') lineText = '已放置';
    else if (mode === 'furniture_go_place') lineText = '去放置';
    else {
      const ownedAsReady =
        mode === 'ready' && (actionLabel === '装备' || actionLabel === '使用');
      lineText = mode === 'equipped' || ownedAsReady ? '已拥有' : actionLabel;
    }
    const pillCenterY = (btnHScaled: number) => ch - bottomPad - btnHScaled / 2;

    if (tex?.width) {
      const sp = new PIXI.Sprite(tex);
      const s = Math.min(maxBtnW / tex.width, targetH / tex.height);
      sp.scale.set(s);
      sp.anchor.set(0.5, 1);
      sp.position.set(cw / 2, ch - bottomPad);
      if (mode === 'purchase' && cost !== undefined && cost > 0) sp.alpha = purchaseFooterAlpha;
      card.addChild(sp);
      const scaledH = tex.height * s;
      const cy = pillCenterY(scaledH);

      if (mode === 'purchase' && cost !== undefined && cost > 0) {
        const iconTex = TextureCache.get('icon_huayuan');
        const gap = 5;
        const iconH = Math.max(16, Math.min(28, Math.round(scaledH * 0.62)));
        let iconW = 0;
        const row = new PIXI.Container();
        row.position.set(cw / 2, cy);
        if (iconTex?.width) {
          const iconSp = new PIXI.Sprite(iconTex);
          iconSp.anchor.set(0.5, 0.5);
          iconSp.height = iconH;
          iconSp.width = (iconTex.width / iconTex.height) * iconH;
          iconW = iconSp.width;
          row.addChild(iconSp);
        }
        const price = new PIXI.Text(String(cost), labelStyle as any);
        price.anchor.set(0.5, 0.5);
        row.addChild(price);
        const rowW = iconW > 0 ? iconW + gap + price.width : price.width;
        let xLeft = -rowW / 2;
        if (iconW > 0) {
          (row.children[0] as PIXI.Sprite).position.set(xLeft + iconW / 2, 0);
          xLeft += iconW + gap;
        }
        price.position.set(xLeft + price.width / 2, 0);
        row.alpha = purchaseFooterAlpha;
        card.addChild(row);
      } else {
        const lockStyle = mode === 'locked' ? { ...labelStyle, fontSize: 15 } : labelStyle;
        const label = new PIXI.Text(lineText, lockStyle as any);
        label.anchor.set(0.5, 0.5);
        label.position.set(cw / 2, cy);
        card.addChild(label);
      }
    } else {
      const btnW = Math.min(maxBtnW, 100);
      const btnH = targetH;
      const btnY = ch - bottomPad - btnH;
      const color =
        mode === 'equipped' || mode === 'furniture_placed'
          ? 0xbb88dd
          : mode === 'locked'
            ? 0xf0a030
            : mode === 'ready' || mode === 'furniture_go_place'
              ? COLORS.BUTTON_PRIMARY
              : 0x4caf50;
      const g = new PIXI.Graphics();
      g.beginFill(color);
      g.drawRoundedRect(cw / 2 - btnW / 2, btnY, btnW, btnH, btnH / 2);
      g.endFill();
      if (mode === 'purchase' && cost !== undefined && cost > 0) g.alpha = purchaseFooterAlpha;
      card.addChild(g);
      const cy = btnY + btnH / 2;
      if (mode === 'purchase' && cost !== undefined && cost > 0) {
        const row = new PIXI.Container();
        row.position.set(cw / 2, cy);
        const gap = 5;
        const iconH = Math.max(16, Math.min(26, Math.round(btnH * 0.58)));
        const iconTex = TextureCache.get('icon_huayuan');
        let iconW = 0;
        if (iconTex?.width) {
          const iconSp = new PIXI.Sprite(iconTex);
          iconSp.anchor.set(0.5, 0.5);
          iconSp.height = iconH;
          iconSp.width = (iconTex.width / iconTex.height) * iconH;
          iconW = iconSp.width;
          row.addChild(iconSp);
        }
        const price = new PIXI.Text(String(cost), labelStyle as any);
        price.anchor.set(0.5, 0.5);
        row.addChild(price);
        const rowW = iconW > 0 ? iconW + gap + price.width : price.width;
        let xLeft = -rowW / 2;
        if (iconW > 0 && row.children[0]) {
          (row.children[0] as PIXI.Sprite).position.set(xLeft + iconW / 2, 0);
          xLeft += iconW + gap;
        }
        price.position.set(xLeft + price.width / 2, 0);
        row.alpha = purchaseFooterAlpha;
        card.addChild(row);
      } else {
        const fs = mode === 'locked' ? 15 : 17;
        const t = new PIXI.Text(lineText, { fontSize: fs, fill: 0xffffff, fontFamily: FONT_FAMILY, fontWeight: 'bold' });
        t.anchor.set(0.5, 0.5);
        t.position.set(cw / 2, cy);
        card.addChild(t);
      }
    }
  }

  /** 未解锁家具/房壳：与仓库格锁同一资源 `warehouse_slot_lock`；缺纹理时退回棋盘锁再退回 emoji */
  private _addCardLockOverlay(parent: PIXI.Container, cx: number, cy: number, cw: number): void {
    const lockTex = TextureCache.get('warehouse_slot_lock') ?? TextureCache.get('cell_locked');
    const lockSize = Math.max(24, Math.round((34 * cw) / CARD_BASE_W));
    if (lockTex?.width) {
      const sp = new PIXI.Sprite(lockTex);
      const sc = Math.min(lockSize / lockTex.width, lockSize / lockTex.height);
      sp.scale.set(sc);
      sp.anchor.set(0.5, 0.5);
      sp.position.set(cx, cy);
      parent.addChild(sp);
      return;
    }
    const lock = new PIXI.Text('🔒', { fontSize: 22, fontFamily: FONT_FAMILY });
    lock.anchor.set(0.5, 0.5);
    lock.position.set(cx, cy);
    parent.addChild(lock);
  }

  // ─── build furniture card ─────────────────────────────────

  private _buildCard(deco: DecoDef, x: number, y: number, cw: number, ch: number): PIXI.Container {
    const card = new PIXI.Container();
    card.position.set(x, y);

    const isUnlocked = DecorationManager.isUnlocked(deco.id);
    const isPlaced = !!RoomLayoutManager.getPlacement(deco.id);
    const reqResult = checkRequirement(deco.unlockRequirement);
    const reqMet = reqResult.met;
    const sceneOk = isDecoAllowedInScene(deco, CurrencyManager.state.sceneId);
    const cardUnlockedLook = (isUnlocked || reqMet) && sceneOk;

    this._drawCardBg(card, cw, ch, cardUnlockedLook, isPlaced);

    const maxIcon = Math.round((82 * cw) / CARD_BASE_W);
    const iconCy = Math.round((ch * 54) / CARD_BASE_H);
    const nameY = Math.max(
      Math.round((ch * 90) / CARD_BASE_H),
      iconCy + Math.ceil(maxIcon * 0.52) + 8,
    );

    const iconArea = new PIXI.Container();
    iconArea.position.set(cw / 2, iconCy);
    card.addChild(iconArea);

    const texture = TextureCache.get(deco.icon);
    if (texture) {
      const sprite = new PIXI.Sprite(texture);
      const s = Math.min(maxIcon / texture.width, maxIcon / texture.height);
      sprite.scale.set(s);
      sprite.anchor.set(0.5, 0.5);
      if (!reqMet || !sceneOk) sprite.alpha = 0.4;
      iconArea.addChild(sprite);
    } else {
      const emoji = new PIXI.Text(DECO_SLOT_INFO[deco.slot].emoji, {
        fontSize: Math.round((40 * cw) / CARD_BASE_W), fontFamily: FONT_FAMILY,
      });
      emoji.anchor.set(0.5, 0.5);
      if (!reqMet || !sceneOk) emoji.alpha = 0.4;
      iconArea.addChild(emoji);
    }

    if (!reqMet || !sceneOk) {
      this._addCardLockOverlay(card, cw / 2, iconCy, cw);
    }

    this._addStarValueBadge(card, cw, deco.starValue);
    if (isPlaced) this._addEquipBadge(card, cw);

    const nameText = new PIXI.Text(deco.name, {
      fontSize: 15, fill: COLORS.TEXT_DARK, fontFamily: FONT_FAMILY, fontWeight: 'bold',
      wordWrap: true, wordWrapWidth: cw - 12, align: 'center',
    });
    nameText.anchor.set(0.5, 0);
    nameText.position.set(cw / 2, nameY);
    card.addChild(nameText);

    if (!sceneOk) {
      this._addFooter(card, cw, ch, 'locked', undefined, formatAllowedScenesShort(deco));
    } else if (isUnlocked && isPlaced) this._addFooter(card, cw, ch, 'furniture_placed', undefined, '');
    else if (isUnlocked) this._addFooter(card, cw, ch, 'furniture_go_place', undefined, '');
    else if (!reqResult.met) this._addFooter(card, cw, ch, 'locked', undefined, reqResult.text);
    else if (deco.cost > 0) this._addFooter(card, cw, ch, 'purchase', deco.cost, '装备');
    else this._addFooter(card, cw, ch, 'furniture_go_place', undefined, '');

    const showPurchase =
      sceneOk && !isUnlocked && reqResult.met && deco.cost > 0;
    const affordPurchase = CurrencyManager.state.huayuan >= deco.cost;

    card.eventMode = 'static';
    card.cursor = showPurchase && !affordPurchase ? 'default' : 'pointer';
    card.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      this._beginScroll(e);
      this._pendingGridTap = { type: 'deco', deco, flyCard: card };
    });
    return card;
  }

  // ─── build room style card ────────────────────────────────

  private _buildRoomStyleCard(style: RoomStyleDef, x: number, y: number, cw: number, ch: number): PIXI.Container {
    const card = new PIXI.Container();
    card.position.set(x, y);

    const unlocked = DecorationManager.isRoomStyleUnlocked(style.id);
    const equipped = DecorationManager.roomStyleId === style.id;
    const styleReq = checkRequirement(style.unlockRequirement);
    const styleReqMet = styleReq.met;

    this._drawCardBg(card, cw, ch, unlocked || styleReqMet, equipped);

    const previewCy = Math.round((ch * 54) / CARD_BASE_H);

    const preview = new PIXI.Container();
    preview.position.set(cw / 2, previewCy);
    card.addChild(preview);

    const tex = TextureCache.get(style.bgTexture);
    let previewHalfH = 0;
    if (tex?.width) {
      const sp = new PIXI.Sprite(tex);
      const maxW = cw - 12;
      const maxH = Math.round((76 * ch) / CARD_BASE_H);
      const s = Math.min(maxW / tex.width, maxH / tex.height);
      previewHalfH = Math.ceil((tex.height * s) / 2);
      sp.scale.set(s);
      sp.anchor.set(0.5, 0.5);
      if (!styleReqMet) sp.alpha = 0.45;
      preview.addChild(sp);
    } else {
      const ph = new PIXI.Text('🏠', { fontSize: Math.round((40 * cw) / CARD_BASE_W), fontFamily: FONT_FAMILY });
      ph.anchor.set(0.5, 0.5);
      if (!styleReqMet) ph.alpha = 0.45;
      preview.addChild(ph);
      previewHalfH = Math.ceil(ph.height / 2) || 20;
    }

    const nameY = Math.max(
      Math.round((ch * 90) / CARD_BASE_H),
      previewCy + (previewHalfH || 28) + 8,
    );

    if (!styleReqMet) {
      this._addCardLockOverlay(card, cw / 2, previewCy, cw);
    }

    this._addStarValueBadge(card, cw, style.starValue);
    if (equipped) this._addEquipBadge(card, cw);

    const nameText = new PIXI.Text(style.name, {
      fontSize: 15, fill: COLORS.TEXT_DARK, fontFamily: FONT_FAMILY, fontWeight: 'bold',
      wordWrap: true, wordWrapWidth: cw - 12, align: 'center',
    });
    nameText.anchor.set(0.5, 0);
    nameText.position.set(cw / 2, nameY);
    card.addChild(nameText);

    if (equipped) this._addFooter(card, cw, ch, 'equipped', undefined, '使用');
    else if (unlocked) this._addFooter(card, cw, ch, 'ready', undefined, '使用');
    else if (!styleReqMet) this._addFooter(card, cw, ch, 'locked', undefined, styleReq.text);
    else if (style.cost > 0) this._addFooter(card, cw, ch, 'purchase', style.cost, '使用');
    else this._addFooter(card, cw, ch, 'ready', undefined, '领取');

    const showStylePurchase = !unlocked && styleReqMet && style.cost > 0;
    const affordStylePurchase = CurrencyManager.state.huayuan >= style.cost;

    card.eventMode = 'static';
    card.cursor = showStylePurchase && !affordStylePurchase ? 'default' : 'pointer';
    card.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      this._beginScroll(e);
      this._pendingGridTap = { type: 'room', style, flyCard: card };
    });
    return card;
  }

  /** 全屏半透明遮罩（显式 hitArea + 低于面板的 zIndex，保证点击遮罩区能关闭） */
  private _redrawDimMask(): void {
    const w = DESIGN_WIDTH;
    const h = Game.logicHeight;
    this._bg.clear();
    this._bg.beginFill(0x000000, 0.5);
    this._bg.drawRect(0, 0, w, h);
    this._bg.endFill();
    this._bg.hitArea = new PIXI.Rectangle(0, 0, w, h);
  }

  /** 关面板时若飞星未完成，立即加星避免丢进度 */
  private _flushDeferredStarOnClose(): void {
    if (!this._pendingDecoGrantStar) return;
    const deco = this._pendingDecoGrantStar;
    this._pendingDecoGrantStar = null;
    if (deco.starValue > 0) {
      CurrencyManager.addStar(deco.starValue);
    }
  }

  private readonly _onShopStarFlyComplete = (): void => {
    if (!this._isOpen) return;
    const deco = this._pendingDecoGrantStar;
    if (!deco) return;
    this._pendingDecoGrantStar = null;
    if (deco.starValue > 0) {
      const oldLv = CurrencyManager.state.level;
      CurrencyManager.addStar(deco.starValue);
      if (CurrencyManager.state.level > oldLv) {
        this._pendingNewDecoAfterLevelUp = deco;
        this._refreshAll();
        return;
      }
    }
    this._refreshAll();
    this._showNewDecoUnlockPopup(deco);
  };

  private readonly _onShopLevelUpPopupClosed = (): void => {
    if (!this._isOpen || !this._pendingNewDecoAfterLevelUp) return;
    const deco = this._pendingNewDecoAfterLevelUp;
    this._pendingNewDecoAfterLevelUp = null;
    this._showNewDecoUnlockPopup(deco);
  };

  // ─── tap handlers ─────────────────────────────────────────

  private _emitShopStarFly(flyCard: PIXI.Container, starAmount: number): void {
    if (starAmount <= 0) return;
    const lp = new PIXI.Point(14, 14);
    const gp = flyCard.toGlobal(lp);
    EventBus.emit('decoration:shopStarFly', { globalX: gp.x, globalY: gp.y, amount: starAmount });
  }

  /** 关闭装修面板并切花店场景，携带待摆放家具（编辑模式 + 托盘拖入） */
  private _goToPlaceDeco(decoId: string): void {
    setPendingPlaceDeco(decoId);
    this.close();
    EventBus.emit('scene:switchToShop');
  }

  private _onCardTap(deco: DecoDef, flyCard: PIXI.Container): void {
    if (!isDecoAllowedInScene(deco, CurrencyManager.state.sceneId)) {
      ToastMessage.show(`🔒 当前场景不可用（${formatAllowedScenesShort(deco)}）`);
      return;
    }
    const isUnlocked = DecorationManager.isUnlocked(deco.id);
    const isPlaced = !!RoomLayoutManager.getPlacement(deco.id);
    if (isUnlocked) {
      this._goToPlaceDeco(deco.id);
      return;
    }
    const req = checkRequirement(deco.unlockRequirement);
    if (!req.met) {
      ToastMessage.show(`🔒 ${req.text}`);
      return;
    }
    if (deco.cost > 0 && CurrencyManager.state.huayuan < deco.cost) {
      ToastMessage.show(`🌸 花愿不足，需要 ${deco.cost} 花愿`);
      return;
    }
    if (this._pendingDecoGrantStar) {
      ToastMessage.show('请稍候，星级正在飞入~');
      return;
    }
    const onShopScene = SceneManager.current?.name === 'shop';
    if (deco.starValue > 0 && onShopScene) {
      if (!DecorationManager.unlock(deco.id, { deferStarGrant: true })) {
        ToastMessage.show(`🌸 花愿不足，需要 ${deco.cost} 花愿`);
        return;
      }
      this._pendingDecoGrantStar = deco;
      this._emitShopStarFly(flyCard, deco.starValue);
      this._refreshAll();
    } else {
      if (!DecorationManager.unlock(deco.id)) {
        ToastMessage.show(`🌸 花愿不足，需要 ${deco.cost} 花愿`);
        return;
      }
      this._emitShopStarFly(flyCard, deco.starValue);
      this._refreshAll();
      this._showNewDecoUnlockPopup(deco);
    }
  }

  private _dismissUnlockPopup(): void {
    if (this._unlockOverlay) {
      this.removeChild(this._unlockOverlay);
      this._unlockOverlay.destroy({ children: true });
      this._unlockOverlay = null;
    }
  }

  /** 购买成功后：类似合成解锁的获得提示，可立即进店摆放 */
  private _showNewDecoUnlockPopup(deco: DecoDef): void {
    this._dismissUnlockPopup();
    const W = DESIGN_WIDTH;
    const H = Game.logicHeight;
    const cx = W / 2;

    const root = new PIXI.Container();
    root.zIndex = 12000;
    this._unlockOverlay = root;
    this.addChild(root);

    const mask = new PIXI.Graphics();
    mask.beginFill(0x000000, 0.55);
    mask.drawRect(0, 0, W, H);
    mask.endFill();
    mask.eventMode = 'static';
    root.addChild(mask);

    const cardW = Math.min(400, W - 48);
    const cardTop = H * 0.2;
    const cardH = 280;

    const card = new PIXI.Graphics();
    card.beginFill(0xfffdf7, 0.98);
    card.lineStyle(2.5, 0xd4a574, 0.9);
    card.drawRoundedRect(cx - cardW / 2, cardTop, cardW, cardH, 20);
    card.endFill();
    root.addChild(card);

    const title = new PIXI.Text('获得新家具', {
      fontSize: 26,
      fill: 0x5a3e2b,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    title.anchor.set(0.5, 0);
    title.position.set(cx, cardTop + 22);
    root.addChild(title);

    const sub = new PIXI.Text(`「${deco.name}」`, {
      fontSize: 18,
      fill: 0x6d4c41,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    sub.anchor.set(0.5, 0);
    sub.position.set(cx, cardTop + 58);
    root.addChild(sub);

    const iconCy = cardTop + 118;
    const tex = TextureCache.get(deco.icon);
    if (tex?.width) {
      const sp = new PIXI.Sprite(tex);
      const ms = Math.min(100 / tex.width, 100 / tex.height);
      sp.scale.set(ms);
      sp.anchor.set(0.5);
      sp.position.set(cx, iconCy);
      root.addChild(sp);
    }

    const btnW = 148;
    const btnH = 46;
    const btnY = cardTop + cardH - btnH - 20;
    const gap = 14;

    const mkBtn = (label: string, bx: number, onTap: () => void): void => {
      const hit = new PIXI.Container();
      hit.position.set(bx, btnY);
      hit.eventMode = 'static';
      hit.cursor = 'pointer';
      const g = new PIXI.Graphics();
      g.beginFill(0xe57373);
      g.drawRoundedRect(-btnW / 2, 0, btnW, btnH, btnH / 2);
      g.endFill();
      hit.addChild(g);
      const t = new PIXI.Text(label, {
        fontSize: 17,
        fill: 0xffffff,
        fontFamily: FONT_FAMILY,
        fontWeight: 'bold',
      });
      t.anchor.set(0.5, 0.5);
      t.position.set(0, btnH / 2);
      hit.addChild(t);
      hit.on('pointertap', e => {
        e.stopPropagation();
        onTap();
      });
      root.addChild(hit);
    };

    mkBtn('稍后', cx - btnW / 2 - gap / 2, () => {
      this._dismissUnlockPopup();
    });
    mkBtn('放入房间', cx + btnW / 2 + gap / 2, () => {
      this._dismissUnlockPopup();
      this._goToPlaceDeco(deco.id);
    });
  }

  private _onRoomStyleTap(style: RoomStyleDef, flyCard: PIXI.Container): void {
    const unlocked = DecorationManager.isRoomStyleUnlocked(style.id);
    const equipped = DecorationManager.roomStyleId === style.id;
    if (equipped) return;
    if (unlocked) {
      if (DecorationManager.equipRoomStyle(style.id)) {
        ToastMessage.show( `已切换为「${style.name}」`);
        this._refreshAll();
      }
    } else {
      const req = checkRequirement(style.unlockRequirement);
      if (!req.met) {
        ToastMessage.show( `🔒 ${req.text}`);
        return;
      }
      if (style.cost > 0 && CurrencyManager.state.huayuan < style.cost) {
        ToastMessage.show(`🌸 花愿不足，需要 ${style.cost} 花愿`);
        return;
      }
      if (DecorationManager.unlockRoomStyle(style.id)) {
        DecorationManager.equipRoomStyle(style.id);
        this._emitShopStarFly(flyCard, style.starValue);
        ToastMessage.show( `✨ 解锁「${style.name}」！`);
        this._refreshAll();
      } else {
        ToastMessage.show( `🌸 花愿不足，需要 ${style.cost} 花愿`);
      }
    }
  }

  // ─── utils ────────────────────────────────────────────────

  private _applyScroll(): void {
    const inner = this._gridContainer.children[0] as PIXI.Container | undefined;
    if (inner) inner.y = this._scrollY;
  }
}
