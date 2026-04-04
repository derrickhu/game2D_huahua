/**
 * 花店装修面板
 *
 * 布局：
 * - 底图优先 decoration_panel_bg_nb2（NB2+rembg）；缺底板时回退 merge_chain_panel
 * - 顶栏标题「家具」叠在底板粉区；筛选条整体上移贴粉区下沿/头身过渡带（见 FILTER_ROW_GAP_BELOW_PINK）；再下分割线；点遮罩关闭
 * - 左侧：分类 Tab 栏（药丸底图 NB2 + 程序叠字；不显示 x/y 计数；缺图时回退矢量圆角）
 * - 右侧：家具/房间风格 3 列网格（视口下移 GRID_VIEWPORT_TOP_INSET；列表按解锁等级、花愿价排序）
 * - 卡片：双层金边圆角 + 贴图按钮 + 家具卡左上角星星值角标（房间风格卡同）
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
import { DESIGN_WIDTH, FONT_FAMILY, COLORS } from '@/config/Constants';
import { RoomLayoutManager } from '@/managers/RoomLayoutManager';
import { setPendingPlaceDeco } from '@/core/DecoPlaceIntent';

/** 全宽底栏：与 NB2 全幅贴边原型一致（旧版左右各留边会造成左侧大缝） */
const PANEL_W = DESIGN_WIDTH;
const PANEL_MARGIN_LEFT = 0;
const PANEL_H_RATIO = 0.74;
const PANEL_TOP_R = 20;
/** 粉区下沿占面板高度（恢复较早「头带 + 标题」形态，与常见底图对齐） */
const PANEL_PINK_BAND_BOTTOM_RATIO = 0.132;
/** 标题「家具」中心 Y（略偏上，落在粉区内） */
const PANEL_TITLE_Y_RATIO = 0.059;

/**
 * 相对粉区下沿的竖向偏移（可负）。
 * 负值：筛选条整体上移，叠到头图与米色区的过渡/阴影带之上，避免落在内凹阴影下方。
 */
/** 粉区下沿到筛选条顶（正值：筛选在米色区，头带层次更清晰） */
const FILTER_ROW_GAP_BELOW_PINK = 6;
/** 筛选条高度（与 divider 间距见下） */
const FILTER_BAR_H = 38;
/** 筛选条底到分割线 */
const DIVIDER_BELOW_FILTER_GAP = 10;
/** 分割线与家具区顶边 */
const DIVIDER_TO_CONTENT = 10;
/** 顶部分割线长度占面板内宽比例（居中，避免顶到两侧装饰边） */
const HEADER_DIVIDER_WIDTH_RATIO = 0.56;
/** 网格区距面板底边的留白，避免卡片贴到金边外；略大以保证裁切在画框内 */
const CONTENT_BOTTOM = 36;

/**
 * 家具网格视口相对「内容顶」再下移：对齐底图凹槽 + 筛选条与首行卡片之间多留呼吸空间。
 */
const GRID_VIEWPORT_TOP_INSET = 30;

/** 左侧分类药丸宽度（与底图左象牙带大致对齐；勿过宽以免压到家具槽视觉） */
const TAB_W = 108;
/** Tab 与家具网格之间明确缝，避免药丸阴影/网格互相挡 */
const TAB_GAP = 12;
/** 左侧 Tab 每行固定高度（不随面板变高纵向拉长，仅加宽左右） */
const TAB_ROW_H = 88;
/** 左侧 Tab 行高下限（可用高度不足时按比例压缩） */
const TAB_ROW_MIN_H = 40;
/** Tab 列左边距 */
const TAB_COLUMN_LEFT = 4;
/** Tab 列整体上移（像素） */
const TAB_COLUMN_NUDGE_Y = 6;
/** 家具槽距面板右缘（1px 防裁切） */
const GRID_MARGIN_RIGHT = 1;

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

const GOLD_LINE = 0xe8c078;
const GOLD_INNER = 0xd4a84b;
/** 顶部分割线：马卡龙薄荷影 + 淡粉高光（立体感，非金） */
const HEADER_DIVIDER_SHADOW_MACARON = 0x8fb0a3;
const HEADER_DIVIDER_HIGHLIGHT_MACARON = 0xfff2f6;
const CREAM_FILL = 0xfff9ec;
const SHADOW_COLOR = 0x8b7355;

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

/** 装修面板：解锁等级升序，同级按花愿价升序 */
function sortDecosByUnlockLevelThenCost(decos: DecoDef[]): DecoDef[] {
  return [...decos].sort((a, b) => {
    const la = a.unlockRequirement?.level ?? 0;
    const lb = b.unlockRequirement?.level ?? 0;
    if (la !== lb) return la - lb;
    return a.cost - b.cost;
  });
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
type DecoInvFilter = 'all' | 'purchased' | 'not_purchased' | 'locked';

const DECO_INV_FILTER_SPECS: ReadonlyArray<{ id: DecoInvFilter; label: string }> = [
  { id: 'all', label: '全部' },
  { id: 'purchased', label: '已购买' },
  { id: 'not_purchased', label: '未购买' },
  { id: 'locked', label: '未解锁' },
];

function decoMatchesInvFilter(deco: DecoDef, filter: DecoInvFilter, sceneId: string): boolean {
  const owned = DecorationManager.isUnlocked(deco.id);
  const reqMet = checkRequirement(deco.unlockRequirement).met;
  const sceneOk = isDecoAllowedInScene(deco, sceneId);
  const blocked = !reqMet || !sceneOk;
  switch (filter) {
    case 'all':
      return true;
    case 'purchased':
      return owned;
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
  private _headerDivider!: PIXI.Graphics;
  private _titleText!: PIXI.Text;
  /** 右侧家具库存筛选（全部 / 已购买 / 未购买 / 未解锁） */
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
  /** Tab 列在网格可视高度内垂直居中的上边距 */
  private _tabVerticalPad = 0;
  /** 与 DressUp 一致：logicHeight 变化时拉伸手绘底图并重画裁剪区 */
  private _panelHBuilt = 0;
  /** NB2 底板精灵（resize 时改 height） */
  private _panelBaseSprite: PIXI.Sprite | null = null;
  /** 购买成功后「获得新家具」浮层 */
  private _unlockOverlay: PIXI.Container | null = null;
  /** 飞星结束前暂存，用于到账加星与弹窗顺序 */
  private _pendingDecoGrantStar: DecoDef | null = null;
  /** 升星弹窗关闭后再弹出「获得新家具」 */
  private _pendingNewDecoAfterLevelUp: DecoDef | null = null;

  constructor() {
    super();
    this.visible = false;
    this.zIndex = 5000;
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

  open(): void {
    if (this._isOpen) return;
    this._isOpen = true;
    this.visible = true;
    EventBus.emit('decoration:decoPanelBackdrop', { open: true });
    this._activeTab = 'flower_room';
    this._decoInvFilter = 'not_purchased';
    this._redrawDimMask();
    this._resizePanelIfNeeded();
    this._refreshAll();

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
    EventBus.emit('decoration:decoPanelBackdrop', { open: false });
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
    const filterBarTop = Math.round(pinkBandBottom + FILTER_ROW_GAP_BELOW_PINK);
    const dividerY = Math.round(filterBarTop + FILTER_BAR_H + DIVIDER_BELOW_FILTER_GAP);
    const contentTopY = Math.round(dividerY + DIVIDER_TO_CONTENT);
    const tabColumnH = panelH - contentTopY - CONTENT_BOTTOM;
    const gridViewportTop = contentTopY + GRID_VIEWPORT_TOP_INSET;
    const gridH = Math.max(48, panelH - gridViewportTop - CONTENT_BOTTOM);
    const gridX = TAB_COLUMN_LEFT + TAB_W + TAB_GAP;
    const gridW = PANEL_W - gridX - GRID_MARGIN_RIGHT;
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

  /** 筛选条下方短分隔：浅沟立体感，粉系非金 */
  private _redrawHeaderDivider(dividerY: number): void {
    const divHalfW = Math.round((PANEL_W * HEADER_DIVIDER_WIDTH_RATIO) / 2);
    const cx = Math.round(PANEL_W / 2);
    const x0 = cx - divHalfW;
    const x1 = cx + divHalfW;
    this._headerDivider.clear();
    this._headerDivider.lineStyle(2, HEADER_DIVIDER_SHADOW_MACARON, 0.45);
    this._headerDivider.moveTo(x0, dividerY + 1);
    this._headerDivider.lineTo(x1, dividerY + 1);
    this._headerDivider.lineStyle(1.5, HEADER_DIVIDER_HIGHLIGHT_MACARON, 0.92);
    this._headerDivider.moveTo(x0, dividerY - 0.5);
    this._headerDivider.lineTo(x1, dividerY - 0.5);
  }

  /** 仅同步顶区与分割线（resize 时用；open 内会再 _refreshAll 重建 Tab/网格） */
  private _applyHeaderChrome(panelH: number): void {
    const L = this._headerLayout(panelH);
    this._contentTopY = L.contentTopY;
    this._filterBar.position.set(L.gridX, L.filterBarTop);
    this._titleText.position.y = Math.round(panelH * PANEL_TITLE_Y_RATIO);
    this._redrawHeaderDivider(L.dividerY);
  }

  // ─── build ────────────────────────────────────────────────

  private _build(): void {
    const w = DESIGN_WIDTH;
    const h = Game.logicHeight;

    // dim overlay（全屏；花店星/进度条/礼包由 ShopScene 提到 overlay 更高层显示在遮罩上）
    this._bg = new PIXI.Graphics();
    this._redrawDimMask();
    this._bg.eventMode = 'static';
    this._bg.on('pointertap', () => this.close());
    this.addChild(this._bg);

    const panelH = Math.round(h * PANEL_H_RATIO);
    const panelX = PANEL_MARGIN_LEFT;
    const panelY = h - panelH;

    this._content = new PIXI.Container();
    this._content.sortableChildren = true;
    this._content.position.set(panelX, panelY);
    this.addChild(this._content);

    // --- panel background: NB2 底板 or merge_chain_panel ---
    const nb2Tex = TextureCache.get('decoration_panel_bg_nb2');
    const mergeTex = TextureCache.get('merge_chain_panel');
    const basePanelTex = nb2Tex ?? mergeTex;
    this._panelBaseSprite = null;
    if (basePanelTex?.width) {
      const panelBg = new PIXI.Sprite(basePanelTex);
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
    const titleCenterY = Math.round(panelH * PANEL_TITLE_Y_RATIO);
    const L = this._headerLayout(panelH);

    this._titleText = new PIXI.Text('家具', {
      fontSize: 34,
      fill: 0xffffff,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: 0x7a4530,
      strokeThickness: 5,
      dropShadow: true,
      dropShadowColor: 0x5a2d10,
      dropShadowBlur: 2,
      dropShadowDistance: 1,
    } as any);
    this._titleText.anchor.set(0.5, 0.5);
    this._titleText.position.set(PANEL_W / 2, titleCenterY);
    this._titleText.zIndex = 12;
    this._content.addChild(this._titleText);

    // --- 右侧库存筛选条（仅家具网格列宽；「房间风格」时隐藏） ---
    this._filterBar = new PIXI.Container();
    this._filterBar.position.set(L.gridX, L.filterBarTop);
    this._filterBar.zIndex = 11;
    this._content.addChild(this._filterBar);
    this._buildInventoryFilterBar(L.gridW);

    // --- 顶部分割线：粉系浅沟，不顶到两侧装饰边 ---
    this._headerDivider = new PIXI.Graphics();
    this._headerDivider.zIndex = 11;
    this._redrawHeaderDivider(L.dividerY);
    this._content.addChild(this._headerDivider);

    this._contentTopY = L.contentTopY;

    // --- layout zones（Tab 列与网格之间留白对称） ---
    const { gridX, gridW, tabColumnH, gridViewportTop, gridH } = L;

    // tab container：y 在 _buildTabs 内写入 _tabVerticalPad 后对齐
    this._tabContainer = new PIXI.Container();
    this._tabContainer.zIndex = 8;
    this._content.addChild(this._tabContainer);

    this._buildTabs(tabColumnH);
    this._tabContainer.position.set(
      TAB_COLUMN_LEFT,
      this._contentTopY + this._tabVerticalPad - TAB_COLUMN_NUDGE_Y,
    );

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
    const gridX = TAB_COLUMN_LEFT + TAB_W + TAB_GAP;
    const gridW = PANEL_W - gridX - GRID_MARGIN_RIGHT;
    const gridViewportTop = this._contentTopY + GRID_VIEWPORT_TOP_INSET;
    const gridH = Math.max(48, panelH - gridViewportTop - CONTENT_BOTTOM);
    return { gridX, gridW, gridH, gridViewportTop };
  }

  /** 右侧四格筛选：全部 / 已购买 / 未购买 / 未解锁 */
  private _buildInventoryFilterBar(gridW: number): void {
    this._filterBar.removeChildren();
    const n = DECO_INV_FILTER_SPECS.length;
    const gap = 5;
    const cellW = (gridW - gap * (n - 1)) / n;
    const rowH = FILTER_BAR_H - 4;
    DECO_INV_FILTER_SPECS.forEach((spec, i) => {
      const cell = new PIXI.Container();
      cell.position.set(i * (cellW + gap), 2);
      const sel = this._decoInvFilter === spec.id;
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
      const t = new PIXI.Text(spec.label, {
        fontSize: sel ? 14 : 13,
        fill: sel ? 0x5a3528 : COLORS.TEXT_LIGHT,
        fontFamily: FONT_FAMILY,
        fontWeight: sel ? 'bold' : 'normal',
      });
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

  private _resizePanelIfNeeded(): void {
    const panelH = Math.round(Game.logicHeight * PANEL_H_RATIO);
    if (panelH === this._panelHBuilt) return;
    if (this._panelBaseSprite) {
      this._panelBaseSprite.height = panelH;
    } else {
      const bg = this._content.children[0];
      if (bg instanceof PIXI.Sprite) bg.height = panelH;
    }
    this._panelHBuilt = panelH;
    this._applyHeaderChrome(panelH);
    this._syncGridViewportClip();
  }

  // ─── tabs (left column, pill-shaped text buttons) ─────────

  private _buildTabs(availH: number): void {
    this._tabContainer.removeChildren();

    const tabCount = DECO_PANEL_TABS.length;
    const idealBlock = tabCount * TAB_ROW_H;
    let tabH: number;
    let spare: number;
    if (availH >= idealBlock) {
      tabH = TAB_ROW_H;
      spare = availH - idealBlock;
    } else {
      tabH = Math.max(TAB_ROW_MIN_H, Math.floor(availH / tabCount));
      spare = Math.max(0, availH - tabCount * tabH);
    }
    this._tabVerticalPad = Math.floor(spare * 0.5);
    const pad = 2;
    const bw = TAB_W - pad * 2;

    const idleTabTex = TextureCache.get('deco_panel_tab_idle_nb2');
    const selTabTex = TextureCache.get('deco_panel_tab_selected_nb2');
    const useNb2TabSprites = idleTabTex != null && selTabTex != null;

    const makeTab = (row: number, isCurrent: boolean, title: string, onTap: () => void): void => {
      const tab = new PIXI.Container();
      tab.position.set(0, row * tabH);
      const bh = tabH - pad * 2;
      const r = bh / 2;

      const drop = new PIXI.Graphics();
      drop.beginFill(0x4a3020, 0.08);
      drop.drawRoundedRect(pad + 1, pad + 2, bw, bh, r);
      drop.endFill();
      tab.addChild(drop);

      if (useNb2TabSprites) {
        const tex = isCurrent ? selTabTex! : idleTabTex!;
        const bg = new PIXI.Sprite(tex);
        bg.anchor.set(0.5, 0.5);
        bg.position.set(TAB_W / 2, tabH / 2);
        bg.width = bw;
        bg.height = bh;
        tab.addChild(bg);
      } else {
        const bg = new PIXI.Graphics();
        if (isCurrent) {
          bg.beginFill(TAB_BG_SELECTED);
          bg.drawRoundedRect(pad, pad, bw, bh, r);
          bg.endFill();
          bg.lineStyle(2.5, COLORS.BUTTON_PRIMARY);
          bg.drawRoundedRect(pad, pad, bw, bh, r);
          const ir = Math.max(5, r - 3);
          bg.lineStyle(1.2, TAB_BG_SELECTED_INNER, 0.85);
          bg.drawRoundedRect(pad + 2, pad + 2, bw - 4, bh - 4, ir);
        } else {
          bg.beginFill(TAB_BG_IDLE);
          bg.drawRoundedRect(pad, pad, bw, bh, r);
          bg.endFill();
          bg.lineStyle(1.25, TAB_BORDER_IDLE, 0.95);
          bg.drawRoundedRect(pad, pad, bw, bh, r);
        }
        tab.addChild(bg);
      }

      const label = new PIXI.Text(title, {
        fontSize: isCurrent ? 16 : 15,
        fill: isCurrent ? 0x5a3528 : COLORS.TEXT_LIGHT,
        fontFamily: FONT_FAMILY,
        fontWeight: isCurrent ? 'bold' : 'normal',
        lineHeight: isCurrent ? 21 : 19,
        wordWrap: true,
        wordWrapWidth: Math.max(44, bw - 4),
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
    const { gridH, gridW } = this._gridLayoutMetrics();
    this._buildTabs(tabColumnH);
    this._tabContainer.position.set(
      TAB_COLUMN_LEFT,
      this._contentTopY + this._tabVerticalPad - TAB_COLUMN_NUDGE_Y,
    );
    this._buildInventoryFilterBar(gridW);
    this._filterBar.visible = this._activeTab !== 'room_styles';
    this._syncGridViewportClip();
    this._buildGrid(gridH);
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
    let decos = sortDecosByUnlockLevelThenCost(
      getDecosForDecorationPanelTab(this._activeTab, sceneId),
    );
    decos = decos.filter((d) => decoMatchesInvFilter(d, this._decoInvFilter, sceneId));
    const gridW = PANEL_W - TAB_COLUMN_LEFT - TAB_W - TAB_GAP - GRID_MARGIN_RIGHT;
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
    const gridW = PANEL_W - TAB_COLUMN_LEFT - TAB_W - TAB_GAP - GRID_MARGIN_RIGHT;
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
      const lock = new PIXI.Text('🔒', { fontSize: 22, fontFamily: FONT_FAMILY });
      lock.anchor.set(0.5, 0.5);
      lock.position.set(cw / 2, iconCy);
      card.addChild(lock);
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

    card.eventMode = 'static';
    card.cursor = 'pointer';
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
      const lock = new PIXI.Text('🔒', { fontSize: 22, fontFamily: FONT_FAMILY });
      lock.anchor.set(0.5, 0.5);
      lock.position.set(cw / 2, previewCy);
      card.addChild(lock);
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

    card.eventMode = 'static';
    card.cursor = 'pointer';
    card.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      this._beginScroll(e);
      this._pendingGridTap = { type: 'room', style, flyCard: card };
    });
    return card;
  }

  /** 全屏半透明遮罩 */
  private _redrawDimMask(): void {
    const w = DESIGN_WIDTH;
    const h = Game.logicHeight;
    this._bg.clear();
    this._bg.beginFill(0x000000, 0.5);
    this._bg.drawRect(0, 0, w, h);
    this._bg.endFill();
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
