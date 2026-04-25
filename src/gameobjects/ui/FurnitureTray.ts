/**
 * 家具托盘（编辑模式底部抽屉）
 *
 * 编辑模式下从底部弹出，展示已解锁家具横滑列表；「房屋」Tab 为已购房间风格，点选即切换房壳。
 * 分类与装修面板一致，家具支持向上拖入房间。
 */
import * as PIXI from 'pixi.js';
import { Game } from '@/core/Game';
import { TweenManager, Ease } from '@/core/TweenManager';
import { ToastMessage } from '@/gameobjects/ui/ToastMessage';
import { DecorationManager } from '@/managers/DecorationManager';
import { RoomLayoutManager } from '@/managers/RoomLayoutManager';
import { FurnitureDragSystem } from '@/systems/FurnitureDragSystem';
import { TextureCache } from '@/utils/TextureCache';
import {
  DecoSlot,
  DECO_MAP,
  DECO_RARITY_INFO,
  DecoDef,
  FURNITURE_TRAY_TABS,
  sortRoomStylesByUnlockLevelThenCost,
  type FurnitureTrayTabId,
  type DecoPanelTabId,
  type RoomStyleDef,
  getDecorationTabLabel,
  getDecosForDecorationPanelTab,
  getRoomStylesForScene,
  isDecoAllowedInScene,
  furnitureTrayTabFromSlot,
  furnitureTrayTabForDeco,
  furnitureTrayTabTextureKey,
} from '@/config/DecorationConfig';
import { CurrencyManager } from '@/managers/CurrencyManager';
import { DESIGN_WIDTH, FONT_FAMILY, COLORS } from '@/config/Constants';

// ---- 布局常量 ----
/** 导出供 ShopScene 对齐编辑按钮位置；略低于旧 300px，少挡花店场景 */
/** Tab 行下移后仍保留网格高度，与 TAB_ROW_TOP_PAD 同步增加 */
export const FURNITURE_TRAY_H = 310;
/**
 * 打开态托盘整体上移（相对「贴底 TRAY_H」基准），与编辑态透明操作区上沿对齐
 * @see ShopScene._enterEditMode trayTopY
 */
export const FURNITURE_TRAY_OPEN_OFFSET_UP = 50;
/** 在「上移对齐」基础上再整体下移，减少遮挡房间内家具（Pixi y 增大 = 向下） */
export const FURNITURE_TRAY_OPEN_NUDGE_DOWN = 30;

const TRAY_H = FURNITURE_TRAY_H;
/** 手柄与 Tab 行间距（整体下移） */
const TAB_ROW_TOP_PAD = 30;
/** 单个 Tab 槽宽（7 枚 + 间隙，整行水平居中，比均分屏宽更紧凑） */
const TAB_SLOT_W = 88;
const TAB_GAP = 4;
/** 仅图标 Tab 行高度（无文字/计数） */
const TAB_BAR_H = 50;
const TAB_ICON_PAD = 6;
const HANDLE_H = 28;              // 顶部拖拽手柄高度
/** Tab 带下沿到托盘内容区顶（与 _build 一致） */
const TAB_BAND_BOTTOM = HANDLE_H + TAB_ROW_TOP_PAD + TAB_BAR_H;
/** Tab 行与家具横滑区相对原布局整体下移（与顶区留白），高度从列表区扣除避免顶底溢出 */
const TRAY_TAB_GRID_BLOCK_OFFSET_Y = 4;
/** 家具横滑区总高度（含底部筛选条） */
const GRID_VIEW_H = TRAY_H - TAB_BAND_BOTTOM;
/** 底部「全部 / 未放置」筛选条高度；列表仅占用上方 GRID_SCROLL_H */
const GRID_FILTER_BAR_H = 48;
const GRID_SCROLL_H = GRID_VIEW_H - GRID_FILTER_BAR_H - TRAY_TAB_GRID_BLOCK_OFFSET_Y;
/**
 * 列表裁切左右缩进（奶油区内再各收约 20，避免贴紫框；不足一屏可横滑）
 */
const GRID_CLIP_INSET_X = 59;
/** 列表左留白与裁切左缘对齐 */
const GRID_LIST_PAD_LEFT = GRID_CLIP_INSET_X;
const GRID_LIST_PAD_RIGHT = 16;
const GRID_LIST_PAD_Y = 10;
/** 圆角卡片底边与下方名称文案的间距 */
const CARD_NAME_BELOW_GAP = 4;
const GRID_CARD_GAP = 8;
const GRID_TARGETS_PER_ROW = 6;
/** 奶油区内可绘宽度（与遮罩一致） */
const GRID_CLIP_INNER_W = DESIGN_WIDTH - 2 * GRID_CLIP_INSET_X;
/** 裁切右缘在父坐标中的 x（用于 maxScroll） */
const GRID_CLIP_RIGHT_X = GRID_CLIP_INSET_X + GRID_CLIP_INNER_W;
/** 首卡左缘与裁切左缘对齐，宽度按区内宽减右留白与间隙推导，避免滑到 0 仍裁到第六张 */
const CARD_SIZE = Math.floor(
  (GRID_CLIP_INNER_W -
    GRID_LIST_PAD_RIGHT -
    (GRID_TARGETS_PER_ROW - 1) * GRID_CARD_GAP) /
    GRID_TARGETS_PER_ROW,
);
/** 底板矢量回退与贴图裁切高度（略大于 TRAY_H，与历史布局一致） */
const TRAY_BG_H = TRAY_H + 40;
const BG_COLOR = 0xFFF8F0;
const BG_ALPHA = 0.97;
const TRAY_RADIUS = 20;

/** 与 DecorationPanel 一致：原生 client → 设计坐标（微信小游戏上子节点 pointermove 不可靠，需绑 canvas） */
function nativeClientToDesignX(clientX: number): number {
  return (clientX * Game.designWidth) / Game.screenWidth;
}
function nativeClientToDesignY(clientY: number): number {
  return (clientY * Game.designHeight) / Game.screenHeight;
}

function federatedPointerToDesign(e: PIXI.FederatedPointerEvent): { x: number; y: number } {
  const n = e.nativeEvent as PointerEvent | MouseEvent | undefined;
  if (n != null && typeof (n as PointerEvent).clientX === 'number') {
    const pe = n as PointerEvent;
    return { x: nativeClientToDesignX(pe.clientX), y: nativeClientToDesignY(pe.clientY) };
  }
  return {
    x: (e.global.x / Game.dpr) * Game.designWidth / Game.screenWidth,
    y: (e.global.y / Game.dpr) * Game.designHeight / Game.screenHeight,
  };
}

/** 滑动与点击区分：小于此位移视为点击 */
const TRAY_TAP_SLOP_PX = 12;

type TrayScrollMode = 'scroll' | 'drag' | 'neutral';

type TrayListFilter = 'all' | 'unplaced';

export class FurnitureTray extends PIXI.Container {
  /** 底板：拱顶壳体贴图或矢量回退 */
  private _bg!: PIXI.Container;
  private _handle!: PIXI.Container;
  private _tabContainer!: PIXI.Container;
  private _gridContainer!: PIXI.Container;
  private _gridMask!: PIXI.Graphics;
  /** 底部左侧：全部 / 未放置 */
  private _filterRow!: PIXI.Container;
  private _isOpen = false;
  private _currentTab: FurnitureTrayTabId = 'flower_room';
  private _closedY = 0;
  private _openY = 0;
  private _scrollX = 0;
  private _maxScrollX = 0;

  /** 横向列表内层（改 x 实现滚动） */
  private _trayScrollInner: PIXI.Container | null = null;
  private _trayScrollListening = false;
  private _trayStartDesignX = 0;
  private _trayStartDesignY = 0;
  private _trayStartScrollX = 0;
  private _trayMode: TrayScrollMode | null = null;
  private _trayDragStarted = false;
  private _trayPending: { decoId: string; isPlaced: boolean } | null = null;

  /** 列表筛选：默认仅显示尚未放入房间的家具 */
  private _listFilter: TrayListFilter = 'unplaced';

  private readonly _onCanvasTrayMove = (ev: PointerEvent): void => {
    if (!this._isOpen || !this._trayScrollListening) return;
    const designX = nativeClientToDesignX(ev.clientX);
    const designY = nativeClientToDesignY(ev.clientY);
    const tdx = designX - this._trayStartDesignX;
    const tdy = designY - this._trayStartDesignY;

    if (this._trayMode == null) {
      if (Math.abs(tdx) < TRAY_TAP_SLOP_PX && Math.abs(tdy) < TRAY_TAP_SLOP_PX) return;
      if (Math.abs(tdx) >= Math.abs(tdy)) {
        this._trayMode = 'scroll';
      } else if (this._trayPending && !this._trayPending.isPlaced) {
        this._trayMode = 'drag';
      } else {
        this._trayMode = 'neutral';
      }
    }

    if (this._trayMode === 'scroll') {
      this._scrollX = Math.max(-this._maxScrollX, Math.min(0, this._trayStartScrollX + tdx));
      if (this._trayScrollInner) this._trayScrollInner.x = this._scrollX;
      return;
    }

    if (this._trayMode === 'drag' && this._trayPending && !this._trayDragStarted) {
      this._trayDragStarted = true;
      FurnitureDragSystem.startDragFromTray(this._trayPending.decoId, designX, designY);
      this._trayPending = null;
      this._trayScrollListening = false;
      this._trayMode = null;
      this._unbindCanvasTrayScroll();
    }
  };

  private readonly _onCanvasTrayUp = (ev: PointerEvent): void => {
    this._finishTrayScroll(ev);
  };

  constructor() {
    super();
    this.visible = false;
    this.zIndex = 6000;
    this._build();
  }

  /**
   * 打开托盘（滑入动画）
   * @param trayArg 不传默认花房；传槽位则按槽位选 Tab；传 `{ deco }` 时尊重 decorationPanelTab（家具 / 花房 / 庭院）
   */
  open(trayArg?: DecoSlot | { deco: DecoDef }): void {
    if (this._isOpen) return;
    this._isOpen = true;
    this.visible = true;

    const logicH = Game.logicHeight;
    this._closedY = logicH;
    this._openY =
      logicH - TRAY_H - FURNITURE_TRAY_OPEN_OFFSET_UP + FURNITURE_TRAY_OPEN_NUDGE_DOWN;

    this.y = this._closedY;
    if (trayArg != null && typeof trayArg === 'object' && 'deco' in trayArg) {
      this._currentTab = furnitureTrayTabForDeco(trayArg.deco);
    } else if (trayArg != null) {
      this._currentTab = furnitureTrayTabFromSlot(trayArg as DecoSlot);
    } else {
      this._currentTab = 'flower_room';
    }
    this._listFilter = 'unplaced';
    this._refreshAll();

    TweenManager.to({
      target: this,
      props: { y: this._openY },
      duration: 0.3,
      ease: Ease.easeOutBack,
    });
  }

  /** 关闭托盘（滑出动画） */
  close(): void {
    if (!this._isOpen) return;
    this._isOpen = false;
    this._teardownTrayScroll();

    TweenManager.to({
      target: this,
      props: { y: this._closedY },
      duration: 0.2,
      ease: Ease.easeInQuad,
      onComplete: () => { this.visible = false; },
    });
  }

  get isOpen(): boolean {
    return this._isOpen;
  }

  /** 刷新内容（外部调用，如装饰解锁后） */
  refresh(): void {
    if (this._isOpen) {
      this._refreshAll();
    }
  }

  // ---- 构建 UI ----

  private _build(): void {
    const w = DESIGN_WIDTH;

    // 背景：壳体贴图顶对齐；资源已倒置为平底在上，遮罩内主要见奶油区，拱顶在贴图下方可被裁掉
    this._bg = new PIXI.Container();
    this._bg.eventMode = 'static';
    this._bg.hitArea = new PIXI.Rectangle(0, 0, w, TRAY_BG_H);

    const shellTex = TextureCache.get('furniture_tray_panel_shell_nb2');
    if (shellTex?.width) {
      const sp = new PIXI.Sprite(shellTex);
      sp.anchor.set(0.5, 0);
      sp.position.set(w / 2, 0);
      const sx = w / shellTex.width;
      sp.scale.set(sx, sx);
      this._bg.addChild(sp);
    } else {
      const g = new PIXI.Graphics();
      g.beginFill(BG_COLOR, BG_ALPHA);
      g.drawRoundedRect(0, 0, w, TRAY_BG_H, TRAY_RADIUS);
      g.endFill();
      g.lineStyle(1, 0xE0D0C0);
      g.drawRoundedRect(0, 0, w, TRAY_BG_H, TRAY_RADIUS);
      this._bg.addChild(g);
    }

    const bgMask = new PIXI.Graphics();
    bgMask.beginFill(0xffffff);
    bgMask.drawRoundedRect(0, 0, w, TRAY_BG_H, TRAY_RADIUS);
    bgMask.endFill();
    this._bg.addChild(bgMask);
    this._bg.mask = bgMask;

    this.addChild(this._bg);

    // 顶部拖拽手柄
    this._handle = new PIXI.Container();
    const handleBar = new PIXI.Graphics();
    handleBar.beginFill(0xD0C0B0);
    handleBar.drawRoundedRect(w / 2 - 30, 8, 60, 4, 2);
    handleBar.endFill();
    this._handle.addChild(handleBar);
    this._handle.eventMode = 'static';
    this._handle.hitArea = new PIXI.Rectangle(0, 0, w, HANDLE_H);
    this.addChild(this._handle);

    // 分类 Tab 栏（下移，与壳体上沿留白；与列表块同偏移）
    this._tabContainer = new PIXI.Container();
    this._tabContainer.y = HANDLE_H + TAB_ROW_TOP_PAD + TRAY_TAB_GRID_BLOCK_OFFSET_Y;
    this.addChild(this._tabContainer);

    // 家具网格区域
    this._gridContainer = new PIXI.Container();
    this._gridContainer.y = TAB_BAND_BOTTOM + TRAY_TAB_GRID_BLOCK_OFFSET_Y;
    this.addChild(this._gridContainer);

    // 网格遮罩（左右缩进，与奶油区内宽一致，列表不画到紫框上）
    const clipW = w - 2 * GRID_CLIP_INSET_X;
    const gridMaskTop = TAB_BAND_BOTTOM + TRAY_TAB_GRID_BLOCK_OFFSET_Y;
    this._gridMask = new PIXI.Graphics();
    this._gridMask.beginFill(0xFFFFFF);
    this._gridMask.drawRect(GRID_CLIP_INSET_X, gridMaskTop, clipW, GRID_SCROLL_H);
    this._gridMask.endFill();
    this.addChild(this._gridMask);
    this._gridContainer.mask = this._gridMask;

    // 网格滚动事件（命中区与可视裁切一致）
    this._gridContainer.eventMode = 'static';
    this._gridContainer.hitArea = new PIXI.Rectangle(GRID_CLIP_INSET_X, 0, clipW, GRID_SCROLL_H);

    this._filterRow = new PIXI.Container();
    this._filterRow.y = gridMaskTop + GRID_SCROLL_H;
    this.addChild(this._filterRow);
  }

  private _unbindCanvasTrayScroll(): void {
    const canvas = Game.app.view as unknown as HTMLCanvasElement | undefined;
    if (!canvas?.removeEventListener) return;
    canvas.removeEventListener('pointermove', this._onCanvasTrayMove);
    canvas.removeEventListener('pointerup', this._onCanvasTrayUp);
    canvas.removeEventListener('pointercancel', this._onCanvasTrayUp);
  }

  /** 结束托盘上的滑动跟踪（不关闭托盘） */
  private _teardownTrayScroll(): void {
    if (this._trayScrollListening) {
      this._unbindCanvasTrayScroll();
      this._trayScrollListening = false;
    }
    this._trayPending = null;
    this._trayMode = null;
    this._trayDragStarted = false;
  }

  private _beginTrayScroll(
    e: PIXI.FederatedPointerEvent,
    pending: { decoId: string; isPlaced: boolean } | null,
  ): void {
    if (this._trayScrollListening || !this._isOpen) return;
    const p = federatedPointerToDesign(e);
    this._trayScrollListening = true;
    this._trayPending = pending;
    this._trayMode = null;
    this._trayDragStarted = false;
    this._trayStartDesignX = p.x;
    this._trayStartDesignY = p.y;
    this._trayStartScrollX = this._scrollX;

    const canvas = Game.app.view as unknown as HTMLCanvasElement | undefined;
    if (canvas?.addEventListener) {
      canvas.addEventListener('pointermove', this._onCanvasTrayMove);
      canvas.addEventListener('pointerup', this._onCanvasTrayUp);
      canvas.addEventListener('pointercancel', this._onCanvasTrayUp);
    }
  }

  private _finishTrayScroll(ev?: PointerEvent): void {
    if (!this._trayScrollListening) return;

    const endX = ev != null ? nativeClientToDesignX(ev.clientX) : this._trayStartDesignX;
    const endY = ev != null ? nativeClientToDesignY(ev.clientY) : this._trayStartDesignY;
    const tdx = endX - this._trayStartDesignX;
    const tdy = endY - this._trayStartDesignY;
    const moved = Math.hypot(tdx, tdy);

    this._unbindCanvasTrayScroll();
    this._trayScrollListening = false;

    const pending = this._trayPending;
    const mode = this._trayMode;
    this._trayPending = null;
    this._trayMode = null;
    this._trayDragStarted = false;

    if (mode === 'drag') return;

    if (pending && moved < TRAY_TAP_SLOP_PX) {
      if (pending.isPlaced) {
        FurnitureDragSystem.select(pending.decoId);
        const name = DECO_MAP.get(pending.decoId)?.name ?? '家具';
        ToastMessage.show(`已选中「${name}」，可在房间中拖动`);
      } else {
        ToastMessage.show('拖住图标向上拖入房间即可放置');
      }
    }
  }

  private _buildTabs(): void {
    this._tabContainer.removeChildren();

    const tabs = FURNITURE_TRAY_TABS;
    const n = tabs.length;
    const rowW = n * TAB_SLOT_W + (n - 1) * TAB_GAP;
    const rowStartX = Math.max(0, (DESIGN_WIDTH - rowW) / 2);

    tabs.forEach((tabId, i) => {
      const meta = getDecorationTabLabel(tabId as DecoPanelTabId, CurrencyManager.state.sceneId);
      const isCurrent = tabId === this._currentTab;

      const tab = new PIXI.Container();
      tab.position.set(rowStartX + i * (TAB_SLOT_W + TAB_GAP), 0);

      // Tab 背景
      const bg = new PIXI.Graphics();
      if (isCurrent) {
        bg.beginFill(0xFFE8D0);
        bg.drawRoundedRect(2, 2, TAB_SLOT_W - 4, TAB_BAR_H - 4, 6);
        bg.endFill();
        bg.lineStyle(2, COLORS.BUTTON_PRIMARY);
        bg.drawRoundedRect(2, 2, TAB_SLOT_W - 4, TAB_BAR_H - 4, 6);
      }
      tab.addChild(bg);

      const iconKey = furnitureTrayTabTextureKey(tabId);
      const tabTex = TextureCache.get(iconKey);
      const maxW = TAB_SLOT_W - TAB_ICON_PAD * 2;
      const maxH = TAB_BAR_H - TAB_ICON_PAD * 2;
      const cx = TAB_SLOT_W / 2;
      const cy = TAB_BAR_H / 2;

      if (tabTex?.width) {
        const sp = new PIXI.Sprite(tabTex);
        sp.anchor.set(0.5, 0.5);
        const s = Math.min(maxW / tabTex.width, maxH / tabTex.height);
        sp.scale.set(s, s);
        sp.position.set(cx, cy);
        tab.addChild(sp);
      } else {
        const fb = meta.name.charAt(0) || '?';
        const emoji = new PIXI.Text(fb, {
          fontSize: Math.min(22, maxH),
          fontFamily: FONT_FAMILY,
          fill: COLORS.TEXT_DARK,
        });
        emoji.anchor.set(0.5, 0.5);
        emoji.position.set(cx, cy);
        tab.addChild(emoji);
      }

      tab.eventMode = 'static';
      tab.hitArea = new PIXI.Rectangle(0, 0, TAB_SLOT_W, TAB_BAR_H);
      tab.cursor = 'pointer';
      tab.on('pointertap', () => {
        this._currentTab = tabId;
        this._scrollX = 0;
        this._refreshAll();
      });

      this._tabContainer.addChild(tab);
    });
  }

  private _buildFilterRow(): void {
    this._filterRow.removeChildren();
    if (this._currentTab === 'room_styles') {
      this._filterRow.visible = false;
      return;
    }
    this._filterRow.visible = true;
    const CHIP_H = 36;
    const PAD_Y = Math.max(0, (GRID_FILTER_BAR_H - CHIP_H) / 2);
    const CHIP_GAP = 12;
    const chips: { id: TrayListFilter; label: string; w: number }[] = [
      { id: 'all', label: '全部', w: 68 },
      { id: 'unplaced', label: '未放置', w: 92 },
    ];
    let x = GRID_CLIP_INSET_X;
    for (const { id, label, w } of chips) {
      const chip = new PIXI.Container();
      chip.position.set(x, PAD_Y);
      const selected = this._listFilter === id;
      const bg = new PIXI.Graphics();
      if (selected) {
        bg.beginFill(0xFFE8D0);
        bg.drawRoundedRect(0, 0, w, CHIP_H, 10);
        bg.endFill();
        bg.lineStyle(2, COLORS.BUTTON_PRIMARY);
        bg.drawRoundedRect(0, 0, w, CHIP_H, 10);
      } else {
        bg.beginFill(0xFFFFFF, 0.96);
        bg.drawRoundedRect(0, 0, w, CHIP_H, 10);
        bg.endFill();
        bg.lineStyle(1, 0xE0D0C0);
        bg.drawRoundedRect(0, 0, w, CHIP_H, 10);
      }
      chip.addChild(bg);
      const tx = new PIXI.Text(label, {
        fontSize: 16,
        fill: selected ? COLORS.TEXT_DARK : COLORS.TEXT_LIGHT,
        fontFamily: FONT_FAMILY,
      });
      tx.anchor.set(0.5, 0.5);
      tx.position.set(w / 2, CHIP_H / 2);
      chip.addChild(tx);
      chip.eventMode = 'static';
      chip.cursor = 'pointer';
      const hitPad = 4;
      chip.hitArea = new PIXI.Rectangle(-hitPad, -hitPad, w + hitPad * 2, CHIP_H + hitPad * 2);
      chip.on('pointertap', () => {
        if (this._listFilter === id) return;
        this._listFilter = id;
        this._scrollX = 0;
        this._refreshAll();
      });
      this._filterRow.addChild(chip);
      x += w + CHIP_GAP;
    }
  }

  private _buildGrid(): void {
    this._teardownTrayScroll();
    this._trayScrollInner = null;
    this._gridContainer.removeChildren();

    if (this._currentTab === 'room_styles') {
      this._buildRoomStylesGrid();
      return;
    }

    const sceneId = CurrencyManager.state.sceneId;
    const candidates = getDecosForDecorationPanelTab(this._currentTab as DecoPanelTabId, sceneId);
    const layout = RoomLayoutManager.getLayout();
    const unlocked = candidates.filter(
      d => DecorationManager.isUnlocked(d.id) && isDecoAllowedInScene(d, sceneId),
    );
    const decos =
      this._listFilter === 'unplaced'
        ? unlocked.filter(d => !layout.some(p => p.decoId === d.id))
        : unlocked;

    if (unlocked.length === 0) {
      const emptyText = new PIXI.Text('暂无已解锁的装饰\n去装修面板解锁吧~', {
        fontSize: 16, fill: COLORS.TEXT_LIGHT, fontFamily: FONT_FAMILY,
        align: 'center',
      });
      emptyText.anchor.set(0.5, 0.5);
      emptyText.position.set(DESIGN_WIDTH / 2, GRID_SCROLL_H / 2);
      this._gridContainer.addChild(emptyText);
      return;
    }

    if (decos.length === 0) {
      const emptyText = new PIXI.Text('该分类下暂无未放置的家具\n点「全部」可查看已放置项', {
        fontSize: 15, fill: COLORS.TEXT_LIGHT, fontFamily: FONT_FAMILY,
        align: 'center',
      });
      emptyText.anchor.set(0.5, 0.5);
      emptyText.position.set(DESIGN_WIDTH / 2, GRID_SCROLL_H / 2);
      this._gridContainer.addChild(emptyText);
      return;
    }

    const innerContainer = new PIXI.Container();
    this._gridContainer.addChild(innerContainer);
    this._trayScrollInner = innerContainer;

    const n = decos.length;
    const contentW =
      GRID_LIST_PAD_LEFT +
      n * CARD_SIZE +
      (n > 0 ? (n - 1) * GRID_CARD_GAP : 0) +
      GRID_LIST_PAD_RIGHT;
    const plateW = Math.max(DESIGN_WIDTH, contentW);

    // 底层透明承接区：点在卡片间隙或右侧留白时也能横向滑动
    const scrollPlate = new PIXI.Container();
    scrollPlate.eventMode = 'static';
    scrollPlate.hitArea = new PIXI.Rectangle(0, 0, plateW, GRID_SCROLL_H);
    scrollPlate.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      this._beginTrayScroll(e, null);
    });
    innerContainer.addChild(scrollPlate);

    decos.forEach((deco, i) => {
      const x = GRID_LIST_PAD_LEFT + i * (CARD_SIZE + GRID_CARD_GAP);
      const y = GRID_LIST_PAD_Y;
      const card = this._buildCard(deco, x, y, layout);
      innerContainer.addChild(card);
    });

    this._maxScrollX = Math.max(0, contentW - GRID_CLIP_RIGHT_X);
    this._scrollX = Math.max(-this._maxScrollX, Math.min(0, this._scrollX));
    innerContainer.x = this._scrollX;
  }

  /** 房屋 Tab：仅展示已购买（已解锁）的房间风格，点选切换当前场景房壳 */
  private _buildRoomStylesGrid(): void {
    const owned = sortRoomStylesByUnlockLevelThenCost(getRoomStylesForScene(CurrencyManager.state.sceneId)).filter(s =>
      DecorationManager.isRoomStyleUnlocked(s.id),
    );
    if (owned.length === 0) {
      const emptyText = new PIXI.Text('暂无已购买的房间风格\n去装修面板购买吧~', {
        fontSize: 16, fill: COLORS.TEXT_LIGHT, fontFamily: FONT_FAMILY,
        align: 'center',
      });
      emptyText.anchor.set(0.5, 0.5);
      emptyText.position.set(DESIGN_WIDTH / 2, GRID_SCROLL_H / 2);
      this._gridContainer.addChild(emptyText);
      return;
    }

    const innerContainer = new PIXI.Container();
    this._gridContainer.addChild(innerContainer);
    this._trayScrollInner = innerContainer;

    const n = owned.length;
    const contentW =
      GRID_LIST_PAD_LEFT +
      n * CARD_SIZE +
      (n > 0 ? (n - 1) * GRID_CARD_GAP : 0) +
      GRID_LIST_PAD_RIGHT;
    const plateW = Math.max(DESIGN_WIDTH, contentW);

    const scrollPlate = new PIXI.Container();
    scrollPlate.eventMode = 'static';
    scrollPlate.hitArea = new PIXI.Rectangle(0, 0, plateW, GRID_SCROLL_H);
    scrollPlate.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      this._beginTrayScroll(e, null);
    });
    innerContainer.addChild(scrollPlate);

    owned.forEach((style, i) => {
      const x = GRID_LIST_PAD_LEFT + i * (CARD_SIZE + GRID_CARD_GAP);
      const y = GRID_LIST_PAD_Y;
      innerContainer.addChild(this._buildRoomStyleCard(style, x, y));
    });

    this._maxScrollX = Math.max(0, contentW - GRID_CLIP_RIGHT_X);
    this._scrollX = Math.max(-this._maxScrollX, Math.min(0, this._scrollX));
    innerContainer.x = this._scrollX;
  }

  private _buildRoomStyleCard(style: RoomStyleDef, x: number, y: number): PIXI.Container {
    const card = new PIXI.Container();
    card.position.set(x, y);
    const equipped = DecorationManager.roomStyleId === style.id;
    const rarityInfo = DECO_RARITY_INFO[style.rarity];

    const bg = new PIXI.Graphics();
    bg.beginFill(0xffffff);
    bg.drawRoundedRect(0, 0, CARD_SIZE, CARD_SIZE, 8);
    bg.endFill();
    if (equipped) {
      bg.lineStyle(2, COLORS.BUTTON_PRIMARY);
    } else {
      bg.lineStyle(1, 0xE0D0C0);
    }
    bg.drawRoundedRect(0, 0, CARD_SIZE, CARD_SIZE, 8);
    card.addChild(bg);

    const roomTex = TextureCache.get(style.bgTexture);
    if (roomTex?.width) {
      const sprite = new PIXI.Sprite(roomTex);
      const iconInset = 5;
      const maxSize = CARD_SIZE - iconInset * 2;
      const s = Math.min(maxSize / roomTex.width, maxSize / roomTex.height);
      sprite.scale.set(s);
      sprite.anchor.set(0.5, 0.5);
      sprite.position.set(CARD_SIZE / 2, CARD_SIZE / 2);
      card.addChild(sprite);
    } else {
      const ph = new PIXI.Text('房', { fontSize: 28, fontFamily: FONT_FAMILY, fill: COLORS.TEXT_DARK });
      ph.anchor.set(0.5, 0.5);
      ph.position.set(CARD_SIZE / 2, CARD_SIZE / 2);
      card.addChild(ph);
    }

    const rarityDot = new PIXI.Graphics();
    rarityDot.beginFill(rarityInfo.color);
    rarityDot.drawCircle(CARD_SIZE - 10, 10, 5);
    rarityDot.endFill();
    card.addChild(rarityDot);

    if (equipped) {
      const badgeTex = TextureCache.get('ui_order_check_badge');
      if (badgeTex) {
        const targetSide = Math.min(28, Math.floor(CARD_SIZE * 0.34));
        const bs = targetSide / Math.max(badgeTex.width, badgeTex.height);
        const badge = new PIXI.Sprite(badgeTex);
        badge.scale.set(bs);
        badge.anchor.set(1, 1);
        badge.position.set(CARD_SIZE - 4, CARD_SIZE - 4);
        badge.eventMode = 'none';
        card.addChild(badge);
      }
    }

    const nameText = new PIXI.Text(style.name, {
      fontSize: 14,
      fill: COLORS.TEXT_DARK,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      wordWrap: true,
      wordWrapWidth: CARD_SIZE,
      align: 'center',
      lineHeight: 18,
    });
    nameText.anchor.set(0.5, 0);
    nameText.position.set(CARD_SIZE / 2, CARD_SIZE + CARD_NAME_BELOW_GAP);
    card.addChild(nameText);

    card.eventMode = 'static';
    card.cursor = 'pointer';
    const hitH = CARD_SIZE + CARD_NAME_BELOW_GAP + Math.ceil(nameText.height);
    card.hitArea = new PIXI.Rectangle(0, 0, CARD_SIZE, hitH);

    card.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      this._beginTrayScroll(e, null);
    });
    card.on('pointertap', () => {
      if (DecorationManager.roomStyleId === style.id) return;
      if (DecorationManager.equipRoomStyle(style.id)) {
        ToastMessage.show(`已切换为「${style.name}」`);
        this._refreshAll();
      }
    });

    return card;
  }

  private _buildCard(
    deco: DecoDef,
    x: number,
    y: number,
    layout: ReadonlyArray<{ decoId: string }>,
  ): PIXI.Container {
    const card = new PIXI.Container();
    card.position.set(x, y);

    const isPlaced = layout.some(p => p.decoId === deco.id);
    const rarityInfo = DECO_RARITY_INFO[deco.rarity];

    // 卡片背景（已放置与未放置同样式，仅用右下角对勾区分）
    const bg = new PIXI.Graphics();
    bg.beginFill(0xFFFFFF);
    bg.drawRoundedRect(0, 0, CARD_SIZE, CARD_SIZE, 8);
    bg.endFill();
    bg.lineStyle(1, 0xE0D0C0);
    bg.drawRoundedRect(0, 0, CARD_SIZE, CARD_SIZE, 8);
    card.addChild(bg);

    // 家具图标（卡片内铺满，名称已移到方块外下方）
    const texture = TextureCache.get(deco.icon);
    if (texture) {
      const sprite = new PIXI.Sprite(texture);
      const iconInset = 5;
      const maxSize = CARD_SIZE - iconInset * 2;
      const s = Math.min(maxSize / texture.width, maxSize / texture.height);
      sprite.scale.set(s);
      sprite.anchor.set(0.5, 0.5);
      sprite.position.set(CARD_SIZE / 2, CARD_SIZE / 2);
      card.addChild(sprite);
    }

    // 稀有度小点（加大）
    const rarityDot = new PIXI.Graphics();
    rarityDot.beginFill(rarityInfo.color);
    rarityDot.drawCircle(CARD_SIZE - 10, 10, 5);
    rarityDot.endFill();
    card.addChild(rarityDot);

    // 已放置：右下角叠主包对勾角标（与订单格 / 任务领奖一致）
    if (isPlaced) {
      const badgeTex = TextureCache.get('ui_order_check_badge');
      if (badgeTex) {
        const targetSide = Math.min(28, Math.floor(CARD_SIZE * 0.34));
        const bs = targetSide / Math.max(badgeTex.width, badgeTex.height);
        const badge = new PIXI.Sprite(badgeTex);
        badge.scale.set(bs);
        badge.anchor.set(1, 1);
        const inset = 4;
        badge.position.set(CARD_SIZE - inset, CARD_SIZE - inset);
        badge.eventMode = 'none';
        card.addChild(badge);
      }
    }

    // 名称：在圆角方块下方（不占卡片内白底）
    const nameText = new PIXI.Text(deco.name, {
      fontSize: 14,
      fill: COLORS.TEXT_DARK,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      wordWrap: true,
      wordWrapWidth: CARD_SIZE,
      align: 'center',
      lineHeight: 18,
    });
    nameText.anchor.set(0.5, 0);
    nameText.position.set(CARD_SIZE / 2, CARD_SIZE + CARD_NAME_BELOW_GAP);
    card.addChild(nameText);

    // 交互：pointerdown 起手势，横向滑 = 列表滚动，纵向滑 = 未放置则从托盘拖入房间
    card.eventMode = 'static';
    card.cursor = 'pointer';
    const hitH = CARD_SIZE + CARD_NAME_BELOW_GAP + Math.ceil(nameText.height);
    card.hitArea = new PIXI.Rectangle(0, 0, CARD_SIZE, hitH);

    card.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      this._beginTrayScroll(e, { decoId: deco.id, isPlaced });
    });

    return card;
  }

  private _refreshAll(): void {
    this._buildTabs();
    this._buildFilterRow();
    this._buildGrid();
  }
}
