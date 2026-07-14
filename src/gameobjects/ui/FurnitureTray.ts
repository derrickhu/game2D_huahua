/**
 * 家具托盘（编辑模式底部抽屉）
 *
 * 编辑模式下从底部弹出，展示已解锁家具横滑列表；「房屋」Tab 为已购房间风格，点选即切换房壳。
 * 分类与装修面板一致，家具支持向上拖入房间。
 *
 * 底栏壳：`furniture_tray_panel_shell_v3_thin_pink_nb2`；左侧竖 Tab（常规/主题/工坊），右侧分类图标 + 家具横滑。
 */
import * as PIXI from 'pixi.js';
import { Game } from '@/core/Game';
import { TweenManager, Ease } from '@/core/TweenManager';
import { ToastMessage } from '@/gameobjects/ui/ToastMessage';
import { DecorationManager } from '@/managers/DecorationManager';
import { RoomLayoutManager } from '@/managers/RoomLayoutManager';
import { FurnitureDragSystem } from '@/systems/FurnitureDragSystem';
import { TextureCache } from '@/utils/TextureCache';
import { getDecoDisplayName } from '@/config/FurnitureWorkshopConfig';
import {
  DecoSlot,
  DECO_MAP,
  DECO_RARITY_INFO,
  DecoDef,
  FURNITURE_TRAY_REGULAR_TABS,
  FURNITURE_TRAY_THEME_TABS,
  FURNITURE_TRAY_WORKSHOP_TABS,
  sortRoomStylesByUnlockLevelThenCost,
  type FurnitureTrayTabId,
  type DecoPanelTabId,
  type RoomStyleDef,
  getDecorationTabLabel,
  getDecosForDecorationPanelTab,
  getWorkshopDecosForTrayTab,
  getWorkshopTrayTabForDeco,
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
const TRAY_H = FURNITURE_TRAY_H;
/** v3 壳体优先；缺图回退 legacy 拱顶壳 */
const TRAY_SHELL_TEX_KEYS = [
  'furniture_tray_panel_shell_v3_thin_pink_nb2',
  'furniture_tray_panel_shell_nb2',
] as const;
const TRAY_TOP_PAD = 4;
/** 列表裁切外缘（薄粉边） */
const GRID_CLIP_INSET_X = 12;
/** 列表裁切右缘额外内收（避免横滑时卡片贴出壳体） */
const GRID_CLIP_INSET_RIGHT_EXTRA = 11;
/** 左侧连体竖 Tab（再向右加宽约 5px） */
const SECTION_RAIL_W = 45;
const SECTION_RAIL_OFFSET_X = 5;
const SECTION_RAIL_GAP = 4;
/** 竖 Tab 相对布局基准的水平微调（仅移动左侧 rail） */
const SECTION_RAIL_NUDGE_X = 5;
/** 竖 Tab 在面板内上下对称留白（圆角区），高度由此决定并垂直居中 */
const SECTION_RAIL_V_INSET = 20;
/** 竖 Tab 整体再收短（保持居中） */
const SECTION_RAIL_HEIGHT_TRIM = 5;
const SECTION_RAIL_H = TRAY_H - SECTION_RAIL_V_INSET * 2 - SECTION_RAIL_HEIGHT_TRIM;
const SECTION_RAIL_Y = (TRAY_H - SECTION_RAIL_H) / 2;
/** 分类图标 Tab 行（放大） */
const TAB_BAR_H = 46;
const TAB_ICON_PAD = 3;
/** 分类 Tab 选中：相对 idle fit 的放大倍率 */
const CATEGORY_TAB_ICON_SELECTED_SCALE = 1.22;
/** 分类 Tab 选中：图标下椭圆阴影 */
const CATEGORY_TAB_ICON_SHADOW_ALPHA = 0.24;
/** 分类图标行相对顶部的额外下移 */
const CATEGORY_TAB_ROW_EXTRA_Y = 16;
/** 底栏：全部/未放置筛选 chip（托盘底边水平居中） */
const GRID_FILTER_BAR_H = 40;
const FILTER_CHIP_H = 36;
const FILTER_CHIP_FONT = 18;
const FILTER_CHIP_RADIUS = 12;
const FILTER_CHIP_GAP = 8;
const FILTER_CHIP_W_ALL = 72;
const FILTER_CHIP_W_UNPLACED = 96;
/** 底栏 chip 相对居中位置的垂直微调（负值上移） */
const FILTER_CHIP_NUDGE_Y = -15;
const TAB_BAND_BOTTOM = TRAY_TOP_PAD + CATEGORY_TAB_ROW_EXTRA_Y + TAB_BAR_H + 8;
const CONTENT_LEFT = GRID_CLIP_INSET_X + SECTION_RAIL_OFFSET_X + SECTION_RAIL_W + SECTION_RAIL_GAP;
const GRID_SCROLL_H = TRAY_H - TAB_BAND_BOTTOM - GRID_FILTER_BAR_H;
const GRID_CLIP_INNER_W =
  DESIGN_WIDTH - CONTENT_LEFT - GRID_CLIP_INSET_X - GRID_CLIP_INSET_RIGHT_EXTRA;
const GRID_LIST_PAD_LEFT = 6;
const GRID_LIST_PAD_RIGHT = 10;
/** 家具列表顶留白（略下移，避免贴分类 Tab） */
const GRID_LIST_PAD_Y = 16;
/** 圆角卡片底边与下方名称文案的间距 */
const CARD_NAME_BELOW_GAP = 4;
const GRID_CARD_GAP = 8;
/** 一屏约 4 张；单卡略缩小，避免编辑态底栏家具框过大 */
const GRID_TARGETS_PER_ROW = 4;
/** 在预算边长上再缩放（仅缩方块，名称区单独计高） */
const CARD_SIZE_SCALE = 0.86;
const CARD_NAME_FONT_SIZE = 15;
const CARD_NAME_LINE_HEIGHT = 19;
/** 名称区占用高度（单行居中；过长仍可换行但尽量不超出视口） */
const CARD_NAME_BLOCK_H = CARD_NAME_BELOW_GAP + CARD_NAME_LINE_HEIGHT;
const CARD_W_BUDGET = Math.floor(
  (GRID_CLIP_INNER_W -
    GRID_LIST_PAD_RIGHT -
    (GRID_TARGETS_PER_ROW - 1) * GRID_CARD_GAP) /
    GRID_TARGETS_PER_ROW,
);
const CARD_SIZE = Math.max(
  92,
  Math.round(
    Math.min(CARD_W_BUDGET, GRID_SCROLL_H - GRID_LIST_PAD_Y - CARD_NAME_BLOCK_H) *
      CARD_SIZE_SCALE,
  ),
);
const CARD_CORNER_RADIUS = Math.max(8, Math.round(CARD_SIZE * 0.05));
const CARD_ICON_INSET = Math.max(5, Math.round(CARD_SIZE * 0.04));

/** 编辑态顶栏圆钮目标边长（清空 / 完成，仅圆形图标无字） */
export const FURNITURE_TRAY_EDIT_CORNER_ICON_TARGET_H = 64;
/** @deprecated 兼容旧引用 */
export const FURNITURE_TRAY_CLEAR_ICON_TARGET_H = FURNITURE_TRAY_EDIT_CORNER_ICON_TARGET_H;
/** 面板顶栏圆钮圆心 Y（相对托盘顶） */
export const FURNITURE_TRAY_EDIT_CORNER_ICON_Y = -26;
/** @deprecated */
export const FURNITURE_TRAY_CLEAR_ICON_Y = FURNITURE_TRAY_EDIT_CORNER_ICON_Y;
/** 距面板左/右缘 */
export const FURNITURE_TRAY_EDIT_CORNER_ICON_SIDE_PAD = 14;
/** @deprecated */
export const FURNITURE_TRAY_CLEAR_ICON_RIGHT_PAD = FURNITURE_TRAY_EDIT_CORNER_ICON_SIDE_PAD;

/** 编辑态托盘顶边设计 Y（与 open() / ShopScene trayOpenTopY 一致） */
export function furnitureTrayOpenTopY(logicH: number, safeBottom = 0): number {
  return logicH - safeBottom - TRAY_H;
}

/** 教程高亮「完成装修」顶右圆钮矩形（场景设计坐标，与 layoutEditCompleteIcon 一致） */
export function furnitureTrayEditCompleteSpotlightRect(trayTopY: number): {
  x: number;
  y: number;
  w: number;
  h: number;
} {
  const size = FURNITURE_TRAY_EDIT_CORNER_ICON_TARGET_H + 16;
  const cx =
    DESIGN_WIDTH - FURNITURE_TRAY_EDIT_CORNER_ICON_SIDE_PAD - size / 2 + 8;
  const cy = trayTopY + FURNITURE_TRAY_EDIT_CORNER_ICON_Y;
  return {
    x: cx - size / 2,
    y: cy - size / 2,
    w: size,
    h: size,
  };
}

/** 底栏行顶 Y（相对托盘） */
export const FURNITURE_TRAY_FOOTER_Y = TAB_BAND_BOTTOM + GRID_SCROLL_H;
export const FURNITURE_TRAY_FOOTER_H = GRID_FILTER_BAR_H;
export const FURNITURE_TRAY_CONTENT_LEFT = CONTENT_LEFT;
/** 底板高度与可见托盘一致（v3 flat 壳顶对齐缩放） */
const TRAY_BG_H = TRAY_H;
const BG_COLOR = 0xFFF8F0;
const BG_ALPHA = 0.97;
const TRAY_RADIUS = 20;

function trayShellTexture(): PIXI.Texture | null {
  for (const key of TRAY_SHELL_TEX_KEYS) {
    const tex = TextureCache.get(key);
    if (tex?.width) return tex;
  }
  return null;
}

function mountTrayShellSprite(shellTex: PIXI.Texture, w: number, bgH: number): PIXI.Sprite {
  const sp = new PIXI.Sprite(shellTex);
  sp.anchor.set(0.5, 0);
  sp.position.set(w / 2, 0);
  sp.scale.set(w / shellTex.width, bgH / shellTex.height);
  return sp;
}

/** 与 DecorationPanel 一致：原生 client → 设计坐标（微信小游戏上子节点 pointermove 不可靠，需绑 canvas） */
function nativeClientToDesignX(clientX: number): number {
  return Game.clientToDesign(clientX, 0).x;
}
function nativeClientToDesignY(clientY: number): number {
  return Game.clientToDesign(0, clientY).y;
}

function federatedPointerToDesign(e: PIXI.FederatedPointerEvent): { x: number; y: number } {
  const n = e.nativeEvent as PointerEvent | MouseEvent | undefined;
  if (n != null && typeof (n as PointerEvent).clientX === 'number') {
    const pe = n as PointerEvent;
    return { x: nativeClientToDesignX(pe.clientX), y: nativeClientToDesignY(pe.clientY) };
  }
  return {
    ...Game.globalToDesign(e.global.x, e.global.y),
  };
}

/** 滑动与点击区分：小于此位移视为点击 */
const TRAY_TAP_SLOP_PX = 12;

type TrayScrollMode = 'scroll' | 'drag' | 'neutral';

type TrayListFilter = 'all' | 'unplaced';

/** 单个分类图标 Tab 槽宽（放大） */
const TAB_SLOT_W = 88;
const TAB_GAP = 5;

/** 托盘左侧竖向分区：常规 / 主题 / 工坊 */
type TraySection = 'regular' | 'theme' | 'workshop';

const SECTION_TABS: { id: TraySection; label: string }[] = [
  { id: 'regular', label: '常规' },
  { id: 'theme', label: '主题' },
  { id: 'workshop', label: '工坊' },
];

const SECTION_TAB_SELECTED_FILL = 0xe878a8;
const SECTION_TAB_IDLE_FILL = 0xfce4ef;
const SECTION_TAB_RAIL_FILL = 0xfce4ef;
const SECTION_TAB_SELECTED_TEXT = 0xffffff;
const SECTION_TAB_IDLE_TEXT = 0xb86888;
const SECTION_TAB_LABEL_SIZE = 21;
const SECTION_TAB_LABEL_LINE_GAP = 1;
const SECTION_TAB_RAIL_R = 12;

type SectionSegPos = 'first' | 'mid' | 'last';

/** 连体竖 Tab 外轮廓：纯色浅粉，无描边 */
function paintSectionRailShell(g: PIXI.Graphics, w: number, h: number): void {
  const r = Math.min(SECTION_TAB_RAIL_R, Math.floor(w * 0.34));
  g.clear();
  g.beginFill(SECTION_TAB_RAIL_FILL, 1);
  g.drawRoundedRect(0, 0, w, h, r);
  g.endFill();
}

/** 连体竖 Tab 单段：纯色填充，无描边 */
function paintConnectedSectionSegment(
  g: PIXI.Graphics,
  w: number,
  h: number,
  pos: SectionSegPos,
  selected: boolean,
): void {
  const fill = selected ? SECTION_TAB_SELECTED_FILL : SECTION_TAB_IDLE_FILL;
  const r = Math.min(SECTION_TAB_RAIL_R, Math.floor(w * 0.34));

  g.clear();
  g.beginFill(fill, 1);
  if (pos === 'first') {
    g.drawRoundedRect(0, 0, w, h, r);
  } else if (pos === 'last') {
    g.drawRoundedRect(0, 0, w, h, r);
  } else {
    g.drawRect(0, 0, w, h);
  }
  g.endFill();
}

function verticalCjkLabel(text: string, style: Partial<PIXI.ITextStyle>, lineGap = 2): PIXI.Container {
  const wrap = new PIXI.Container();
  let y = 0;
  for (const ch of text) {
    const t = new PIXI.Text(ch, style);
    t.anchor.set(0.5, 0);
    t.position.set(0, y);
    wrap.addChild(t);
    y += (t.height || 16) + lineGap;
  }
  return wrap;
}

export class FurnitureTray extends PIXI.Container {
  /** 底板：拱顶壳体贴图或矢量回退 */
  private _bg!: PIXI.Container;
  private _bgShellSprite: PIXI.Sprite | null = null;
  private _bgFallback: PIXI.DisplayObject | null = null;
  private _handle!: PIXI.Container;
  private _tabContainer!: PIXI.Container;
  /** 左侧竖 Tab 层（独立 zIndex，避免被壳体/遮罩盖住） */
  private _sectionRailLayer!: PIXI.Container;
  /** 顶栏「清空 / 完成」圆钮层 */
  private _cornerIconLayer!: PIXI.Container;
  /** 顶栏左侧：常规 / 主题 / 工坊 */
  private _modeToggleRow!: PIXI.Container;
  /** 竖 Tab 与内容区分隔线 */
  private _sectionDivider: PIXI.Graphics | null = null;
  /** 列表裁切视口（mask 与 scroll 内容同级，避免 refresh 时误毁 mask） */
  private _gridViewport!: PIXI.Container;
  private _gridContainer!: PIXI.Container;
  private _gridMask!: PIXI.Graphics;
  /** 底部左侧：全部 / 未放置 */
  private _filterRow!: PIXI.Container;
  private _isOpen = false;
  private _textureRefreshUnsub: (() => void) | null = null;
  /** 避免 pointer 栈内 destroy 卡片后 Pixi updateTransform 读 null（与 DecorationPanel 同因） */
  private _gridRefreshRaf: number | null = null;
  private _assetRefreshRaf: number | null = null;
  private _currentTab: FurnitureTrayTabId = 'flower_room';
  private _traySection: TraySection = 'regular';
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
  private _trayPending: { decoId: string; isPlaced: boolean; selectInstanceId?: string } | null = null;

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
      FurnitureDragSystem.startDragFromTray(
        this._trayPending.decoId,
        designX,
        designY,
        ev.pointerId,
      );
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
    this.sortableChildren = true;
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
    this._openY = furnitureTrayOpenTopY(logicH, Game.safeBottom);

    this.y = this._closedY;
    if (trayArg != null && typeof trayArg === 'object' && 'deco' in trayArg) {
      const deco = trayArg.deco;
      if (deco.workshopExclusive) {
        this._traySection = 'workshop';
        this._currentTab = getWorkshopTrayTabForDeco(deco);
      } else if (furnitureTrayTabForDeco(deco) === 'qinglian') {
        this._traySection = 'theme';
        this._currentTab = 'qinglian';
      } else {
        this._traySection = 'regular';
        this._currentTab = furnitureTrayTabForDeco(deco);
      }
    } else if (trayArg != null) {
      this._traySection = 'regular';
      this._currentTab = furnitureTrayTabFromSlot(trayArg as DecoSlot);
    } else {
      this._traySection = 'regular';
      this._currentTab = 'flower_room';
    }
    this._listFilter = 'unplaced';
    this._textureRefreshUnsub?.();
    this._textureRefreshUnsub = TextureCache.observeTextureDependencies(
      { groups: ['deco', 'panels'] },
      () => {
        if (!this._isOpen) return;
        this._scheduleAssetRefresh();
      },
    );
    this._applyLoadedShellTextures();
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
    this._textureRefreshUnsub?.();
    this._textureRefreshUnsub = null;
    this._cancelScheduledRefreshes();
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

  /** 窗口变化后更新托盘开/关锚点，保留当前 Tab、滚动和开关状态。 */
  relayout(): void {
    const logicH = Game.logicHeight;
    this._closedY = logicH;
    this._openY = furnitureTrayOpenTopY(logicH, Game.safeBottom);
    TweenManager.cancelTarget(this);
    this.y = this._isOpen ? this._openY : this._closedY;
  }

  /** 「清空」圆钮：面板顶栏左缘 */
  layoutEditClearIcon(clear: PIXI.Container): void {
    const hit = clear.hitArea;
    const w = hit instanceof PIXI.Rectangle ? hit.width : FURNITURE_TRAY_EDIT_CORNER_ICON_TARGET_H;
    clear.position.set(
      FURNITURE_TRAY_EDIT_CORNER_ICON_SIDE_PAD + w / 2,
      FURNITURE_TRAY_EDIT_CORNER_ICON_Y,
    );
    clear.zIndex = 1;
    if (clear.parent !== this._cornerIconLayer) {
      this._cornerIconLayer.addChild(clear);
    }
    this.sortChildren();
  }

  /** 「完成装修」圆钮：面板顶栏右缘（原清空位置） */
  layoutEditCompleteIcon(complete: PIXI.Container): void {
    const hit = complete.hitArea;
    const w = hit instanceof PIXI.Rectangle ? hit.width : FURNITURE_TRAY_EDIT_CORNER_ICON_TARGET_H;
    complete.position.set(
      DESIGN_WIDTH - FURNITURE_TRAY_EDIT_CORNER_ICON_SIDE_PAD - w / 2,
      FURNITURE_TRAY_EDIT_CORNER_ICON_Y,
    );
    complete.zIndex = 2;
    if (complete.parent !== this._cornerIconLayer) {
      this._cornerIconLayer.addChild(complete);
    }
    this.sortChildren();
  }

  /** 供 ShopScene 挂载编辑态清空图标 */
  mountEditClearIcon(clear: PIXI.Container): void {
    this.layoutEditClearIcon(clear);
  }

  /** 供 ShopScene 挂载编辑态完成图标 */
  mountEditCompleteIcon(complete: PIXI.Container): void {
    this.layoutEditCompleteIcon(complete);
  }

  /** 刷新内容（外部调用，如装饰解锁后） */
  refresh(): void {
    if (this._isOpen) {
      this._scheduleGridRefresh();
    }
  }

  private _cancelScheduledRefreshes(): void {
    if (this._gridRefreshRaf !== null) {
      cancelAnimationFrame(this._gridRefreshRaf);
      this._gridRefreshRaf = null;
    }
    if (this._assetRefreshRaf !== null) {
      cancelAnimationFrame(this._assetRefreshRaf);
      this._assetRefreshRaf = null;
    }
  }

  /** 下一帧刷新 Tab / 筛选 / 列表（不动左侧竖 Tab） */
  private _scheduleGridRefresh(): void {
    if (!this._isOpen || this._gridRefreshRaf !== null) return;
    this._gridRefreshRaf = requestAnimationFrame(() => {
      this._gridRefreshRaf = null;
      if (!this._isOpen) return;
      this._refreshContentOnly();
    });
  }

  /** 下一帧刷新竖 Tab + 内容区（分区切换） */
  private _scheduleFullRefresh(): void {
    if (!this._isOpen || this._gridRefreshRaf !== null) return;
    this._gridRefreshRaf = requestAnimationFrame(() => {
      this._gridRefreshRaf = null;
      if (!this._isOpen) return;
      this._refreshAll();
    });
  }

  /** 纹理分包到达：补壳体后刷新 Tab / 列表 */
  private _scheduleAssetRefresh(): void {
    if (!this._isOpen || this._assetRefreshRaf !== null) return;
    this._assetRefreshRaf = requestAnimationFrame(() => {
      this._assetRefreshRaf = null;
      if (!this._isOpen) return;
      this._applyLoadedShellTextures();
      this._refreshContentOnly();
    });
  }

  private _refreshContentOnly(): void {
    this._buildTabs();
    this._buildFilterRow();
    this._buildGrid();
    this.sortChildren();
  }

  // ---- 构建 UI ----

  private _build(): void {
    const w = DESIGN_WIDTH;

    // 背景：v3 flat 壳顶对齐，缩放至 TRAY_BG_H
    this._bg = new PIXI.Container();
    this._bg.eventMode = 'static';
    this._bg.hitArea = new PIXI.Rectangle(0, 0, w, TRAY_BG_H);

    const shellTex = trayShellTexture();
    if (shellTex?.width) {
      const sp = mountTrayShellSprite(shellTex, w, TRAY_BG_H);
      this._bg.addChild(sp);
      this._bgShellSprite = sp;
    } else {
      const g = new PIXI.Graphics();
      g.beginFill(BG_COLOR, BG_ALPHA);
      g.drawRoundedRect(0, 0, w, TRAY_BG_H, TRAY_RADIUS);
      g.endFill();
      g.lineStyle(1, 0xE0D0C0);
      g.drawRoundedRect(0, 0, w, TRAY_BG_H, TRAY_RADIUS);
      this._bg.addChild(g);
      this._bgFallback = g;
    }

    const bgMask = new PIXI.Graphics();
    bgMask.beginFill(0xffffff);
    bgMask.drawRoundedRect(0, 0, w, TRAY_BG_H, TRAY_RADIUS);
    bgMask.endFill();
    this._bg.addChild(bgMask);
    this._bg.mask = bgMask;

    this._bg.zIndex = 0;
    this.addChild(this._bg);

    // v3 壳无手柄
    this._handle = new PIXI.Container();
    this._handle.visible = false;
    this._handle.eventMode = 'none';
    this.addChild(this._handle);

    this._sectionRailLayer = new PIXI.Container();
    this._sectionRailLayer.zIndex = 25;
    this.addChild(this._sectionRailLayer);

    this._cornerIconLayer = new PIXI.Container();
    this._cornerIconLayer.zIndex = 40;
    this.addChild(this._cornerIconLayer);

    this._modeToggleRow = new PIXI.Container();
    this._modeToggleRow.position.set(
      GRID_CLIP_INSET_X + SECTION_RAIL_OFFSET_X + SECTION_RAIL_NUDGE_X,
      SECTION_RAIL_Y,
    );
    this._sectionRailLayer.addChild(this._modeToggleRow);

    this._sectionDivider = new PIXI.Graphics();
    this._sectionDivider.eventMode = 'none';
    this._sectionDivider.zIndex = 12;
    this.addChild(this._sectionDivider);

    this._tabContainer = new PIXI.Container();
    this._tabContainer.zIndex = 10;
    this._tabContainer.position.set(CONTENT_LEFT, TRAY_TOP_PAD + CATEGORY_TAB_ROW_EXTRA_Y);
    this.addChild(this._tabContainer);

    const gridTopY = TAB_BAND_BOTTOM;
    const clipW = GRID_CLIP_INNER_W;

    this._gridViewport = new PIXI.Container();
    this._gridViewport.zIndex = 6;
    this._gridViewport.position.set(CONTENT_LEFT, gridTopY);
    this._gridViewport.eventMode = 'static';
    this._gridViewport.hitArea = new PIXI.Rectangle(0, 0, clipW, GRID_SCROLL_H);
    this.addChild(this._gridViewport);

    this._gridMask = new PIXI.Graphics();
    this._gridMask.eventMode = 'none';
    this._gridMask.beginFill(0xFFFFFF);
    this._gridMask.drawRect(0, 0, clipW, GRID_SCROLL_H);
    this._gridMask.endFill();
    this._gridViewport.addChild(this._gridMask);
    this._gridViewport.mask = this._gridMask;

    this._gridContainer = new PIXI.Container();
    this._gridViewport.addChild(this._gridContainer);

    this._filterRow = new PIXI.Container();
    this._filterRow.zIndex = 14;
    this.addChild(this._filterRow);

    this._buildModeToggle();
    this.sortChildren();
  }

  private _syncSectionDivider(): void {
    this._sectionDivider?.clear();
  }

  private _applyLoadedShellTextures(): void {
    if (this._bgShellSprite) return;
    const shellTex = trayShellTexture();
    if (!shellTex?.width) return;

    if (this._bgFallback?.parent) {
      this._bgFallback.parent.removeChild(this._bgFallback);
      this._bgFallback.destroy({ children: true });
    }
    this._bgFallback = null;

    const sp = mountTrayShellSprite(shellTex, DESIGN_WIDTH, TRAY_BG_H);
    this._bg.addChildAt(sp, 0);
    this._bgShellSprite = sp;
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
    pending: { decoId: string; isPlaced: boolean; selectInstanceId?: string } | null,
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
        if (pending.selectInstanceId) FurnitureDragSystem.select(pending.selectInstanceId);
        const name = getDecoDisplayName(pending.decoId);
        ToastMessage.show(`已选中「${name}」，可在房间中拖动`);
      } else {
        ToastMessage.show('拖住图标向上拖入房间即可放置');
      }
    }
  }

  private _getActiveTrayTabs(): FurnitureTrayTabId[] {
    if (this._traySection === 'workshop') return FURNITURE_TRAY_WORKSHOP_TABS;
    if (this._traySection === 'theme') return FURNITURE_TRAY_THEME_TABS;
    return FURNITURE_TRAY_REGULAR_TABS;
  }

  private _setTraySection(section: TraySection): void {
    if (this._traySection === section) return;
    this._traySection = section;
    const tabs = this._getActiveTrayTabs();
    if (!tabs.includes(this._currentTab)) {
      this._currentTab = tabs[0] ?? 'furniture';
    }
    this._scrollX = 0;
    this._scheduleFullRefresh();
  }

  private _buildModeToggle(): void {
    this._modeToggleRow.removeChildren().forEach(ch => ch.destroy({ children: true }));

    const railH = SECTION_RAIL_H;
    const tabW = SECTION_RAIL_W;
    const n = SECTION_TABS.length;
    const tabH = Math.floor(railH / n);

    const shell = new PIXI.Graphics();
    paintSectionRailShell(shell, tabW, railH);
    shell.eventMode = 'none';
    this._modeToggleRow.addChild(shell);

    SECTION_TABS.forEach(({ id, label }, i) => {
      const selected = this._traySection === id;
      const pos: SectionSegPos = i === 0 ? 'first' : i === n - 1 ? 'last' : 'mid';
      const chip = new PIXI.Container();
      chip.position.set(0, i * tabH);

      const bg = new PIXI.Graphics();
      paintConnectedSectionSegment(bg, tabW, tabH, pos, selected);
      chip.addChild(bg);

      const labelWrap = verticalCjkLabel(label, {
        fontSize: SECTION_TAB_LABEL_SIZE,
        fill: selected ? SECTION_TAB_SELECTED_TEXT : SECTION_TAB_IDLE_TEXT,
        fontFamily: FONT_FAMILY,
        fontWeight: '900',
      }, SECTION_TAB_LABEL_LINE_GAP);
      labelWrap.position.set(tabW / 2, Math.max(6, (tabH - labelWrap.height) / 2));
      chip.addChild(labelWrap);

      chip.eventMode = 'static';
      chip.cursor = 'pointer';
      chip.hitArea = new PIXI.Rectangle(0, 0, tabW + 6, tabH);
      chip.on('pointertap', () => this._setTraySection(id));
      this._modeToggleRow.addChild(chip);
    });

    this._syncSectionDivider();
  }

  private _buildTabs(): void {
    this._tabContainer.removeChildren().forEach(ch => ch.destroy({ children: true }));

    const tabs = this._getActiveTrayTabs();
    const n = tabs.length;
    const rowW = n * TAB_SLOT_W + (n - 1) * TAB_GAP;
    const rowStartX = Math.max(0, (GRID_CLIP_INNER_W - rowW) / 2);

    tabs.forEach((tabId, i) => {
      const meta = getDecorationTabLabel(tabId as DecoPanelTabId, CurrencyManager.state.sceneId);
      const isCurrent = tabId === this._currentTab;

      const tab = new PIXI.Container();
      tab.position.set(rowStartX + i * (TAB_SLOT_W + TAB_GAP), 0);

      const iconKey = furnitureTrayTabTextureKey(tabId);
      const tabTex = TextureCache.get(iconKey);
      const maxW = TAB_SLOT_W - TAB_ICON_PAD * 2;
      const maxH = TAB_BAR_H - 2;
      const cx = TAB_SLOT_W / 2;
      const cy = TAB_BAR_H / 2;

      if (tabTex?.width) {
        const baseFit = Math.min(maxW / tabTex.width, maxH / tabTex.height);
        const iconScale = isCurrent ? baseFit * CATEGORY_TAB_ICON_SELECTED_SCALE : baseFit;
        const iconH = tabTex.height * iconScale;
        const iconW = tabTex.width * iconScale;

        if (isCurrent) {
          const shadow = new PIXI.Graphics();
          shadow.beginFill(0x8a5070, CATEGORY_TAB_ICON_SHADOW_ALPHA);
          shadow.drawEllipse(
            cx,
            cy + iconH * 0.28,
            iconW * 0.38,
            Math.max(3, iconH * 0.07),
          );
          shadow.endFill();
          tab.addChild(shadow);
        }

        const sp = new PIXI.Sprite(tabTex);
        sp.anchor.set(0.5, 0.5);
        sp.scale.set(iconScale);
        sp.position.set(cx, cy);
        tab.addChild(sp);
      }

      tab.eventMode = 'static';
      tab.hitArea = new PIXI.Rectangle(0, 0, TAB_SLOT_W, TAB_BAR_H);
      tab.cursor = 'pointer';
      tab.on('pointertap', () => {
        this._currentTab = tabId;
        this._scrollX = 0;
        this._scheduleGridRefresh();
      });

      this._tabContainer.addChild(tab);
    });
  }

  private _layoutFilterRowPosition(rowW: number): void {
    this._filterRow.position.set(
      (DESIGN_WIDTH - rowW) / 2,
      FURNITURE_TRAY_FOOTER_Y + Math.max(0, (GRID_FILTER_BAR_H - FILTER_CHIP_H) / 2) + FILTER_CHIP_NUDGE_Y,
    );
  }

  private _buildFilterRow(): void {
    this._filterRow.removeChildren().forEach(ch => ch.destroy({ children: true }));
    if (this._currentTab === 'room_styles') {
      this._filterRow.visible = false;
      return;
    }
    this._filterRow.visible = true;
    const CHIP_H = FILTER_CHIP_H;
    const PAD_Y = Math.max(0, (GRID_FILTER_BAR_H - CHIP_H) / 2);
    const CHIP_GAP = FILTER_CHIP_GAP;
    const chips: { id: TrayListFilter; label: string; w: number }[] = [
      { id: 'all', label: '全部', w: FILTER_CHIP_W_ALL },
      { id: 'unplaced', label: '未放置', w: FILTER_CHIP_W_UNPLACED },
    ];
    const rowW = chips.reduce((s, c, i) => s + c.w + (i > 0 ? CHIP_GAP : 0), 0);
    this._layoutFilterRowPosition(rowW);
    let x = 0;
    for (const { id, label, w } of chips) {
      const chip = new PIXI.Container();
      chip.position.set(x, PAD_Y);
      const selected = this._listFilter === id;
      const bg = new PIXI.Graphics();
      if (selected) {
        bg.beginFill(0xFFE8D0);
        bg.drawRoundedRect(0, 0, w, CHIP_H, FILTER_CHIP_RADIUS);
        bg.endFill();
        bg.lineStyle(2, COLORS.BUTTON_PRIMARY);
        bg.drawRoundedRect(0, 0, w, CHIP_H, FILTER_CHIP_RADIUS);
      } else {
        bg.beginFill(0xFFFFFF, 0.96);
        bg.drawRoundedRect(0, 0, w, CHIP_H, FILTER_CHIP_RADIUS);
        bg.endFill();
        bg.lineStyle(1, 0xE0D0C0);
        bg.drawRoundedRect(0, 0, w, CHIP_H, FILTER_CHIP_RADIUS);
      }
      chip.addChild(bg);
      const tx = new PIXI.Text(label, {
        fontSize: FILTER_CHIP_FONT,
        fill: selected ? COLORS.TEXT_DARK : COLORS.TEXT_LIGHT,
        fontFamily: FONT_FAMILY,
        fontWeight: 'bold',
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
        this._scheduleGridRefresh();
      });
      this._filterRow.addChild(chip);
      x += w + CHIP_GAP;
    }
  }

  private _buildGrid(): void {
    this._teardownTrayScroll();
    this._trayScrollInner = null;
    this._gridContainer.removeChildren().forEach(ch => ch.destroy({ children: true }));

    if (this._currentTab === 'room_styles') {
      this._buildRoomStylesGrid();
      return;
    }

    const sceneId = CurrencyManager.state.sceneId;
    const candidates = this._traySection === 'workshop'
      ? getWorkshopDecosForTrayTab(this._currentTab, sceneId)
      : getDecosForDecorationPanelTab(this._currentTab as DecoPanelTabId, sceneId)
          .filter(d => !d.workshopExclusive);
    const layout = RoomLayoutManager.getLayout();
    const unlocked = candidates.filter(
      d => DecorationManager.isUnlocked(d.id) && isDecoAllowedInScene(d, sceneId),
    );
    const decos =
      this._listFilter === 'unplaced'
        ? unlocked.filter(d => RoomLayoutManager.getAvailableCount(d.id) > 0)
        : unlocked;

    if (unlocked.length === 0) {
      const emptyText = new PIXI.Text(
        this._traySection === 'workshop'
          ? '暂无工坊家具\n去家具工坊制作吧~'
          : '暂无已解锁的装饰\n去装修面板解锁吧~',
        {
        fontSize: 16, fill: COLORS.TEXT_LIGHT, fontFamily: FONT_FAMILY,
        align: 'center',
      });
      emptyText.anchor.set(0.5, 0.5);
      emptyText.position.set(GRID_CLIP_INNER_W / 2, GRID_SCROLL_H / 2);
      this._gridContainer.addChild(emptyText);
      return;
    }

    if (decos.length === 0) {
      const emptyText = new PIXI.Text('该分类下暂无未放置的家具\n点「全部」可查看已放置项', {
        fontSize: 15, fill: COLORS.TEXT_LIGHT, fontFamily: FONT_FAMILY,
        align: 'center',
      });
      emptyText.anchor.set(0.5, 0.5);
      emptyText.position.set(GRID_CLIP_INNER_W / 2, GRID_SCROLL_H / 2);
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
    const plateW = Math.max(GRID_CLIP_INNER_W, contentW);

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

    this._maxScrollX = Math.max(0, contentW - GRID_CLIP_INNER_W);
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
      emptyText.position.set(GRID_CLIP_INNER_W / 2, GRID_SCROLL_H / 2);
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
    const plateW = Math.max(GRID_CLIP_INNER_W, contentW);

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

    this._maxScrollX = Math.max(0, contentW - GRID_CLIP_INNER_W);
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
    bg.drawRoundedRect(0, 0, CARD_SIZE, CARD_SIZE, CARD_CORNER_RADIUS);
    bg.endFill();
    if (equipped) {
      bg.lineStyle(2, COLORS.BUTTON_PRIMARY);
    } else {
      bg.lineStyle(1, 0xE0D0C0);
    }
    bg.drawRoundedRect(0, 0, CARD_SIZE, CARD_SIZE, CARD_CORNER_RADIUS);
    card.addChild(bg);

    const roomTex = TextureCache.get(style.bgTexture);
    if (roomTex?.width) {
      const sprite = new PIXI.Sprite(roomTex);
      const iconInset = CARD_ICON_INSET;
      const maxSize = CARD_SIZE - iconInset * 2;
      const s = Math.min(maxSize / roomTex.width, maxSize / roomTex.height);
      sprite.scale.set(s);
      sprite.anchor.set(0.5, 0.5);
      sprite.position.set(CARD_SIZE / 2, CARD_SIZE / 2);
      card.addChild(sprite);
    } else {
      const ph = new PIXI.Text('房', {
        fontSize: Math.round(CARD_SIZE * 0.22),
        fontFamily: FONT_FAMILY,
        fill: COLORS.TEXT_DARK,
      });
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
      fontSize: CARD_NAME_FONT_SIZE,
      fill: COLORS.TEXT_DARK,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      wordWrap: true,
      wordWrapWidth: CARD_SIZE,
      align: 'center',
      lineHeight: CARD_NAME_LINE_HEIGHT,
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
        this._scheduleGridRefresh();
      }
    });

    return card;
  }

  private _buildCard(
    deco: DecoDef,
    x: number,
    y: number,
    layout: ReadonlyArray<{ instanceId: string; decoId: string }>,
  ): PIXI.Container {
    const card = new PIXI.Container();
    card.position.set(x, y);

    const placements = layout.filter(p => p.decoId === deco.id);
    const placedCount = placements.length;
    const ownedCount = DecorationManager.getOwnedCount(deco.id);
    const availableCount = Math.max(0, ownedCount - placedCount);
    const isPlaced = availableCount <= 0;
    const rarityInfo = DECO_RARITY_INFO[deco.rarity];

    // 卡片背景（已放置与未放置同样式，仅用右下角对勾区分）
    const bg = new PIXI.Graphics();
    bg.beginFill(0xFFFFFF);
    bg.drawRoundedRect(0, 0, CARD_SIZE, CARD_SIZE, CARD_CORNER_RADIUS);
    bg.endFill();
    bg.lineStyle(1, 0xE0D0C0);
    bg.drawRoundedRect(0, 0, CARD_SIZE, CARD_SIZE, CARD_CORNER_RADIUS);
    card.addChild(bg);

    // 家具图标（卡片内铺满，名称已移到方块外下方）
    const texture = TextureCache.get(deco.icon);
    if (texture) {
      const sprite = new PIXI.Sprite(texture);
      const iconInset = CARD_ICON_INSET;
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

    if (deco.stackable) {
      const countText = new PIXI.Text(`可用${availableCount}/${ownedCount}`, {
        fontSize: 12,
        fill: 0x5b6f62,
        fontFamily: FONT_FAMILY,
        fontWeight: 'bold',
      });
      countText.anchor.set(0, 0);
      countText.position.set(6, 5);
      card.addChild(countText);
    }

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
    const nameText = new PIXI.Text(getDecoDisplayName(deco.id), {
      fontSize: CARD_NAME_FONT_SIZE,
      fill: COLORS.TEXT_DARK,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      wordWrap: true,
      wordWrapWidth: CARD_SIZE,
      align: 'center',
      lineHeight: CARD_NAME_LINE_HEIGHT,
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
      this._beginTrayScroll(e, {
        decoId: deco.id,
        isPlaced,
        selectInstanceId: placements[0]?.instanceId,
      });
    });

    return card;
  }

  private _refreshAll(): void {
    this._buildModeToggle();
    this._buildTabs();
    this._buildFilterRow();
    this._buildGrid();
    this.sortChildren();
  }
}
