/**
 * 家具托盘（编辑模式底部抽屉）
 *
 * 编辑模式下从底部弹出，展示所有已解锁家具的缩略图网格。
 * 分类与装修面板一致（花房/家电/…），支持向上拖出家具到房间。
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
  type FurnitureTrayTabId,
  type DecoPanelTabId,
  getDecorationTabLabel,
  getDecosForDecorationPanelTab,
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
/** 家具横滑区可视高度 */
const GRID_VIEW_H = TRAY_H - TAB_BAND_BOTTOM;
/**
 * 列表裁切左右缩进（奶油区内再各收约 20，避免贴紫框；不足一屏可横滑）
 */
const GRID_CLIP_INSET_X = 59;
/** 列表左留白与裁切左缘对齐 */
const GRID_LIST_PAD_LEFT = GRID_CLIP_INSET_X;
const GRID_LIST_PAD_RIGHT = 16;
const GRID_LIST_PAD_Y = 10;
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

export class FurnitureTray extends PIXI.Container {
  /** 底板：拱顶壳体贴图或矢量回退 */
  private _bg!: PIXI.Container;
  private _handle!: PIXI.Container;
  private _tabContainer!: PIXI.Container;
  private _gridContainer!: PIXI.Container;
  private _gridMask!: PIXI.Graphics;
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

    // 分类 Tab 栏（下移，与壳体上沿留白）
    this._tabContainer = new PIXI.Container();
    this._tabContainer.y = HANDLE_H + TAB_ROW_TOP_PAD;
    this.addChild(this._tabContainer);

    // 家具网格区域
    this._gridContainer = new PIXI.Container();
    this._gridContainer.y = TAB_BAND_BOTTOM;
    this.addChild(this._gridContainer);

    // 网格遮罩（左右缩进，与奶油区内宽一致，列表不画到紫框上）
    const clipW = w - 2 * GRID_CLIP_INSET_X;
    this._gridMask = new PIXI.Graphics();
    this._gridMask.beginFill(0xFFFFFF);
    this._gridMask.drawRect(GRID_CLIP_INSET_X, TAB_BAND_BOTTOM, clipW, GRID_VIEW_H);
    this._gridMask.endFill();
    this.addChild(this._gridMask);
    this._gridContainer.mask = this._gridMask;

    // 网格滚动事件（命中区与可视裁切一致）
    this._gridContainer.eventMode = 'static';
    this._gridContainer.hitArea = new PIXI.Rectangle(GRID_CLIP_INSET_X, 0, clipW, GRID_VIEW_H);
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
      const meta = getDecorationTabLabel(tabId as DecoPanelTabId);
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
        const emoji = new PIXI.Text(meta.emoji, {
          fontSize: Math.min(34, maxH),
          fontFamily: FONT_FAMILY,
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

  private _buildGrid(): void {
    this._teardownTrayScroll();
    this._trayScrollInner = null;
    this._gridContainer.removeChildren();

    const sceneId = CurrencyManager.state.sceneId;
    const candidates = getDecosForDecorationPanelTab(this._currentTab as DecoPanelTabId, sceneId);
    const decos = candidates.filter(
      d => DecorationManager.isUnlocked(d.id) && isDecoAllowedInScene(d, sceneId),
    );
    if (decos.length === 0) {
      // 空状态
      const emptyText = new PIXI.Text('暂无已解锁的装饰\n去装修面板解锁吧~', {
        fontSize: 16, fill: COLORS.TEXT_LIGHT, fontFamily: FONT_FAMILY,
        align: 'center',
      });
      emptyText.anchor.set(0.5, 0.5);
      emptyText.position.set(DESIGN_WIDTH / 2, GRID_VIEW_H / 2);
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
    scrollPlate.hitArea = new PIXI.Rectangle(0, 0, plateW, GRID_VIEW_H);
    scrollPlate.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      this._beginTrayScroll(e, null);
    });
    innerContainer.addChild(scrollPlate);

    const currentLayout = RoomLayoutManager.getLayout();

    decos.forEach((deco, i) => {
      const x = GRID_LIST_PAD_LEFT + i * (CARD_SIZE + GRID_CARD_GAP);
      const y = GRID_LIST_PAD_Y;
      const card = this._buildCard(deco, x, y, currentLayout);
      innerContainer.addChild(card);
    });

    this._maxScrollX = Math.max(0, contentW - GRID_CLIP_RIGHT_X);
    this._scrollX = Math.max(-this._maxScrollX, Math.min(0, this._scrollX));
    innerContainer.x = this._scrollX;
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

    // 卡片背景
    const bg = new PIXI.Graphics();
    bg.beginFill(isPlaced ? 0xE8F5E8 : 0xFFFFFF);
    bg.drawRoundedRect(0, 0, CARD_SIZE, CARD_SIZE, 8);
    bg.endFill();
    if (isPlaced) {
      bg.lineStyle(2, 0x4CAF50);
    } else {
      bg.lineStyle(1, 0xE0D0C0);
    }
    bg.drawRoundedRect(0, 0, CARD_SIZE, CARD_SIZE, 8);
    card.addChild(bg);

    // 家具图标
    const texture = TextureCache.get(deco.icon);
    if (texture) {
      const sprite = new PIXI.Sprite(texture);
      const maxSize = CARD_SIZE - 18;
      const s = Math.min(maxSize / texture.width, maxSize / texture.height);
      sprite.scale.set(s);
      sprite.anchor.set(0.5, 0.5);
      sprite.position.set(CARD_SIZE / 2, CARD_SIZE / 2 - 4);
      if (isPlaced) sprite.alpha = 0.5;
      card.addChild(sprite);
    }

    // 稀有度小点（加大）
    const rarityDot = new PIXI.Graphics();
    rarityDot.beginFill(rarityInfo.color);
    rarityDot.drawCircle(CARD_SIZE - 10, 10, 5);
    rarityDot.endFill();
    card.addChild(rarityDot);

    // 已放置标记
    if (isPlaced) {
      const placedBadge = new PIXI.Text('✓', {
        fontSize: 18, fill: 0x4CAF50, fontFamily: FONT_FAMILY, fontWeight: 'bold',
      });
      placedBadge.anchor.set(0.5, 0.5);
      placedBadge.position.set(CARD_SIZE / 2, CARD_SIZE / 2);
      card.addChild(placedBadge);
    }

    // 名称（底部标签，加大可读）
    const nameText = new PIXI.Text(deco.name, {
      fontSize: 11, fill: COLORS.TEXT_LIGHT, fontFamily: FONT_FAMILY,
    });
    nameText.anchor.set(0.5, 1);
    nameText.position.set(CARD_SIZE / 2, CARD_SIZE - 4);
    card.addChild(nameText);

    // 交互：pointerdown 起手势，横向滑 = 列表滚动，纵向滑 = 未放置则从托盘拖入房间
    card.eventMode = 'static';
    card.cursor = 'pointer';

    card.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      this._beginTrayScroll(e, { decoId: deco.id, isPlaced });
    });

    return card;
  }

  private _refreshAll(): void {
    this._buildTabs();
    this._buildGrid();
  }
}
