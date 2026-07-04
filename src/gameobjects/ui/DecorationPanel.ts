/**
 * 花店装修面板
 *
 * 布局：
 * - 底图优先 decoration_panel_shell_nb2（v5 布局玫瑰 flat 单壳 + 壳内关闭钮，无壳体分隔线）；缺图时回退 legacy
 * - 顶栏：标题 + 库存筛选条 + 分类 Tab（1～2 行横排，全宽）+ board_bar；家具 3 列网格全宽
 * - 卡片：双层金边圆角 + 贴图按钮 + 家具卡左上角星星值角标（房间风格卡同）
 * - 顶栏右上 `deco_nb2_close_btn_1x1` 关闭；星级条在遮罩之上时点条身穿透落到遮罩关闭
 */
import * as PIXI from 'pixi.js';
import { Game } from '@/core/Game';
import { AudioManager } from '@/core/AudioManager';
import { SceneManager } from '@/core/SceneManager';
import { TweenManager, Ease } from '@/core/TweenManager';
import { EventBus } from '@/core/EventBus';
import { ToastMessage } from '@/gameobjects/ui/ToastMessage';
import { ConfirmDialog } from '@/gameobjects/ui/ConfirmDialog';
import { createFreeAdBadge } from '@/gameobjects/ui/AdBadge';
import { addMysteryCardPlaceholder, createSmallNameLockIcon } from '@/gameobjects/ui/mysteryCardPlaceholder';
import { DecorationManager } from '@/managers/DecorationManager';
import { DecoNewUnlockManager } from '@/managers/DecoNewUnlockManager';
import { PROMO_FURNITURE_AD_DECO_IDS } from '@/config/AdConfig';
import { AdManager, AdScene } from '@/managers/AdManager';
import { TextureCache } from '@/utils/TextureCache';
import { checkRequirement, decorationLockedToastText, requirementHintText } from '@/utils/UnlockChecker';
import {
  DecoSlot, DECO_SLOT_INFO,
  DecoDef,
  ROOM_STYLES, RoomStyleDef, sortRoomStylesByUnlockLevelThenCost,
  DECO_PANEL_TABS,
  type DecoPanelTabId,
  getDecorationTabLabel,
  getDecosForDecorationPanelTab,
  getRoomStylesForScene,
  isDecoAllowedInScene,
  formatAllowedScenesShort,
} from '@/config/DecorationConfig';
import { getDecoDisplayName } from '@/config/FurnitureWorkshopConfig';
import { CurrencyManager } from '@/managers/CurrencyManager';
import { LevelManager } from '@/managers/LevelManager';
import { BOARD_BAR_HEIGHT, DESIGN_WIDTH, FONT_FAMILY, COLORS } from '@/config/Constants';
import { RoomLayoutManager } from '@/managers/RoomLayoutManager';
import { setPendingPlaceDeco } from '@/core/DecoPlaceIntent';
import { TutorialManager, TutorialStep } from '@/managers/TutorialManager';
import { NewbieGiftPackManager } from '@/managers/NewbieGiftPackManager';
import { NEWBIE_GIFT_PACK_QUEST_ID } from '@/config/NewbieGiftPackConfig';
import { createTutorialStyleModalFrame } from '@/gameobjects/ui/TutorialStyleModalFrame';

/** 全宽底栏：与 NB2 全幅贴边原型一致（旧版左右各留边会造成左侧大缝） */
const PANEL_W = DESIGN_WIDTH;
/** overlay 内与其它全屏面板一致；须低于 ShopScene 抬升的星级条(5600)，使进度条在遮罩外可点穿关闭 */
const DECO_PANEL_Z_INDEX = 5000;
/** 右上角关闭钮：最长边与热区（与 MergeChainPanel / 仓库关闭钮同量级） */
const DECO_CLOSE_BTN_MAX_SIDE = 56;
const DECO_CLOSE_BTN_HIT_PAD = 12;
const DECO_CLOSE_BTN_INSET_RIGHT = 44;
/** NB2 旧底板竖向取样比例（legacy decoration_panel_bg_nb2；flat 单壳不裁切） */
const DECO_PANEL_BG_TOP_RATIO = 0.84;
/** flat 单壳锚点（相对壳图宽/高 0~1，经底贴齐缩放映射到 panel） */
const SHELL_TEX_W = 703;
const SHELL_TEX_H = 1267;
/** v5 壳无烘焙关闭钮，叠 deco_nb2_close_btn；v10+ 改 true 并对齐 SHELL_CLOSE_* */
const SHELL_BAKED_CLOSE_BTN = false;
const SHELL_CLOSE_X_FRAC = 666 / 710;
const SHELL_CLOSE_Y_TEX_FRAC = 48 / SHELL_TEX_H;
const SHELL_CLOSE_HIT_R_TEX = 46 / 710;
/** 顶栏 header 带上下沿（壳图 0~1）；标题居中于该带，略低于旧 55/texH 避免贴顶 */
const SHELL_HEADER_TOP_TEX_FRAC = 48 / SHELL_TEX_H;
const SHELL_HEADER_BOTTOM_TEX_FRAC = 140 / SHELL_TEX_H;
const SHELL_TITLE_TEX_FRAC =
  (SHELL_HEADER_TOP_TEX_FRAC + SHELL_HEADER_BOTTOM_TEX_FRAC) / 2;
const SHELL_FILTER_ROW_GAP_BELOW_HEADER = 18;
const SHELL_GRID_VIEWPORT_TOP_INSET = 0;

function resolveDecorationPanelBg(): { tex: PIXI.Texture | null; flatShell: boolean } {
  const shell = TextureCache.get('decoration_panel_shell_nb2');
  if (shell?.width) return { tex: shell, flatShell: true };
  const legacy = TextureCache.get('decoration_panel_bg_nb2');
  if (legacy?.width) return { tex: legacy, flatShell: false };
  return { tex: null, flatShell: false };
}

function panelBgDisplayTexture(tex: PIXI.Texture, flatShell: boolean): PIXI.Texture {
  if (flatShell) return tex;
  const fr = tex.frame;
  const cropH = Math.max(1, Math.floor(fr.height * DECO_PANEL_BG_TOP_RATIO));
  return new PIXI.Texture(tex.baseTexture, new PIXI.Rectangle(fr.x, fr.y, fr.width, cropH));
}
const PANEL_MARGIN_LEFT = 0;
/** 面板占逻辑屏高度比例（越大底栏上沿越接近顶区「家具」参考位） */
const PANEL_H_RATIO = 0.92;
const PANEL_TOP_R = 20;
/** 顶栏与米色身区分界线在面板内的比例（对齐 NB2 薄顶栏底边；筛选条以此为基准下移） */
const PANEL_PINK_BAND_BOTTOM_RATIO = 0.258;
/** 标题「家具」中心 Y：落在顶栏下沿横框附近（legacy 底板；flat 单壳用 SHELL_TITLE_TEX_FRAC） */
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
const CONTENT_BOTTOM = 51;
/** 网格视口相对 contentTopY 的下移（flat 壳另见 SHELL_GRID_VIEWPORT_TOP_INSET） */
const GRID_VIEWPORT_TOP_INSET = 6;
/** 网格视口整体上移微调（负值上移，与 CONTENT_BOTTOM 同步补偿高度） */
const GRID_VIEWPORT_NUDGE_Y = -5;

/** 内容区左右留白（筛选 / 分类 Tab / 网格共用） */
const GRID_MARGIN_H = 22;
/** 顶部分类 Tab：8 项默认 4 列 × 2 行 */
const CATEGORY_TAB_COLS = 4;
const CATEGORY_TAB_GAP = 8;
const CATEGORY_TAB_ROW_H = 44;
const CATEGORY_TAB_FONT_SIZE = 22;
const FILTER_TO_CATEGORY_GAP = 12;
/** 分类 Tab 底到黄条：留足呼吸感，避免顶区拥挤 */
const CATEGORY_TO_DIVIDER_GAP = 30;

function decoPanelContentX(): number {
  return GRID_MARGIN_H;
}

function decoPanelContentW(): number {
  return PANEL_W - GRID_MARGIN_H * 2;
}

function decoPanelGridOriginX(): number {
  return decoPanelContentX();
}

function decoPanelGridWidth(): number {
  return decoPanelContentW();
}

function categoryTabGridLayout(contentW: number): {
  cols: number;
  rows: number;
  tabW: number;
  tabH: number;
  blockH: number;
} {
  const tabCount = DECO_PANEL_TABS.length;
  const cols = Math.min(CATEGORY_TAB_COLS, tabCount);
  const rows = Math.ceil(tabCount / cols);
  const tabW = Math.floor((contentW - CATEGORY_TAB_GAP * (cols - 1)) / cols);
  const tabH = CATEGORY_TAB_ROW_H;
  const blockH = rows * tabH + Math.max(0, rows - 1) * CATEGORY_TAB_GAP;
  return { cols, rows, tabW, tabH, blockH };
}

/** 顶栏筛选条 — 暖杏珊瑚（与侧栏区分） */
const DECO_FILTER_SELECTED_FILL = 0xeca080;
const DECO_FILTER_IDLE_FILL = 0xfff0e6;
const DECO_FILTER_IDLE_BORDER = 0xe8c8b0;
const DECO_FILTER_SELECTED_TEXT = 0xffffff;
const DECO_FILTER_IDLE_TEXT = 0x9a6848;
/** 顶栏分类 Tab — 柔鼠尾草绿（与暖杏筛选条区分） */
const DECO_SIDE_TAB_SELECTED_FILL = 0x8fbc9a;
const DECO_SIDE_TAB_IDLE_FILL = 0xeaf5ee;
const DECO_SIDE_TAB_IDLE_BORDER = 0xc0dcc8;
const DECO_SIDE_TAB_SELECTED_TEXT = 0xffffff;
const DECO_SIDE_TAB_IDLE_TEXT = 0x4a7560;
/** 标题描边：深杏褐，与 header 带 / 外框暖色一致 */
const DECO_PANEL_TITLE_STROKE = 0xc46848;

function decoPanelTextStyle(base: Partial<PIXI.ITextStyle>): PIXI.ITextStyle {
  return {
    fontFamily: FONT_FAMILY,
    fill: COLORS.TEXT_DARK,
    ...base,
  } as PIXI.ITextStyle;
}

function paintDecoFilterPill(bg: PIXI.Graphics, w: number, h: number, selected: boolean): void {
  bg.clear();
  bg.beginFill(selected ? DECO_FILTER_SELECTED_FILL : DECO_FILTER_IDLE_FILL, 1);
  bg.drawRoundedRect(0, 0, w, h, h / 2);
  bg.endFill();
  if (selected) {
    bg.lineStyle(2, 0xffffff, 0.75);
    bg.drawRoundedRect(1, 1, w - 2, h - 2, h / 2 - 1);
  } else {
    bg.lineStyle(1, DECO_FILTER_IDLE_BORDER, 0.65);
    bg.drawRoundedRect(0.5, 0.5, w - 1, h - 1, h / 2 - 0.5);
  }
}

/** 顶栏分类 Tab 药丸（同工坊形态 + 侧栏绿系配色） */
function paintDecoCategoryPill(bg: PIXI.Graphics, w: number, h: number, selected: boolean): void {
  bg.clear();
  const r = h / 2;
  bg.beginFill(0x3a5848, selected ? 0.12 : 0.06);
  bg.drawRoundedRect(1, 2, w, h, r);
  bg.endFill();
  bg.beginFill(selected ? DECO_SIDE_TAB_SELECTED_FILL : DECO_SIDE_TAB_IDLE_FILL, 1);
  bg.drawRoundedRect(0, 0, w, h, r);
  bg.endFill();
  if (selected) {
    bg.lineStyle(2, 0xffffff, 0.75);
    bg.drawRoundedRect(1, 1, w - 2, h - 2, r - 1);
  } else {
    bg.lineStyle(1, DECO_SIDE_TAB_IDLE_BORDER, 0.65);
    bg.drawRoundedRect(0.5, 0.5, w - 1, h - 1, r - 0.5);
  }
}

const GRID_COLS = 3;
const CARD_GAP = 6;
const CARD_BASE_W = 140;
const CARD_BASE_H = 160;
/** 家具卡图标最长边（设计宽 140 下约 96px，较原 82 略放大） */
const CARD_ICON_MAX_BASE = 96;
/** 房间风格预览区最大高度（设计高 160 下） */
const CARD_PREVIEW_MAX_H_BASE = 88;
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
    const aFreeAdUnlock = DecorationManager.isAdUnlockDeco(a.id)
      && !DecorationManager.isAdUnlockSatisfied(a.id)
      && checkRequirement(a.unlockRequirement).met;
    const bFreeAdUnlock = DecorationManager.isAdUnlockDeco(b.id)
      && !DecorationManager.isAdUnlockSatisfied(b.id)
      && checkRequirement(b.unlockRequirement).met;
    if (aFreeAdUnlock !== bFreeAdUnlock) return aFreeAdUnlock ? -1 : 1;
    const la = a.unlockRequirement?.level ?? 0;
    const lb = b.unlockRequirement?.level ?? 0;
    if (la !== lb) return la - lb;
    return a.cost - b.cost;
  });
}

function compareDecoByCostAsc(a: DecoDef, b: DecoDef): number {
  return (a.cost - b.cost) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
}

function compareDecoByUnlockLevelThenCost(a: DecoDef, b: DecoDef): number {
  const aFreeAdUnlock = DecorationManager.isAdUnlockDeco(a.id)
    && !DecorationManager.isAdUnlockSatisfied(a.id)
    && checkRequirement(a.unlockRequirement).met;
  const bFreeAdUnlock = DecorationManager.isAdUnlockDeco(b.id)
    && !DecorationManager.isAdUnlockSatisfied(b.id)
    && checkRequirement(b.unlockRequirement).met;
  if (aFreeAdUnlock !== bFreeAdUnlock) return aFreeAdUnlock ? -1 : 1;
  const la = a.unlockRequirement?.level ?? 0;
  const lb = b.unlockRequirement?.level ?? 0;
  return (la - lb) || compareDecoByCostAsc(a, b);
}

/** 已满足条件可展示购买的家具 / 已拥有家具：只按花愿价升序，不看等级 */
function sortDecosByCostAsc(decos: DecoDef[]): DecoDef[] {
  return [...decos].sort(compareDecoByCostAsc);
}

function decoAllFilterRank(deco: DecoDef, sceneId: string): number {
  const owned = DecorationManager.isUnlocked(deco.id);
  const reqMet = checkRequirement(deco.unlockRequirement).met;
  const sceneOk = isDecoAllowedInScene(deco, sceneId);
  const isAdGate = DecorationManager.isAdUnlockDeco(deco.id);
  const purchaseAllowed = sceneOk && reqMet && (!isAdGate || DecorationManager.isAdUnlockSatisfied(deco.id));
  const blocked = !sceneOk || !purchaseAllowed;
  const isPlaced = !!RoomLayoutManager.getPlacement(deco.id);

  if (!owned && !blocked) return 0;      // 已解锁未购买
  if (!owned && blocked) return 1;       // 未解锁
  if (owned && !isPlaced) return 2;      // 未放置
  return 3;                              // 已放置
}

function sortDecosForAllFilter(decos: DecoDef[], sceneId: string): DecoDef[] {
  return [...decos].sort((a, b) => {
    const newPri = DecoNewUnlockManager.compareAllFilterNewPriority(
      a.id,
      b.id,
      a.unlockRequirement?.level,
      b.unlockRequirement?.level,
    );
    if (newPri !== 0) return newPri;

    const ra = decoAllFilterRank(a, sceneId);
    const rb = decoAllFilterRank(b, sceneId);
    if (ra !== rb) return ra - rb;
    if (ra === 1) return compareDecoByUnlockLevelThenCost(a, b);
    return compareDecoByCostAsc(a, b);
  });
}

function sortDecosForInvFilter(decos: DecoDef[], filter: DecoInvFilter, sceneId: string): DecoDef[] {
  if (filter === 'all') return sortDecosForAllFilter(decos, sceneId);
  return filter === 'locked' ? sortDecosByUnlockLevelThenCost(decos) : sortDecosByCostAsc(decos);
}

/** 家具列表库存筛选（默认打开面板为「全部」） */
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
  const isAdGate = DecorationManager.isAdUnlockDeco(deco.id);
  const purchaseAllowed = sceneOk && reqMet && (!isAdGate || DecorationManager.isAdUnlockSatisfied(deco.id));
  const blocked = !sceneOk || !purchaseAllowed;
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

function shouldShowDecoInDecorationPanel(deco: DecoDef): boolean {
  if (deco.hideInDecorationPanel) return false;
  if (deco.workshopExclusive && !DecorationManager.isUnlocked(deco.id)) return false;
  return true;
}

/**
 * 未解锁但仍展示真实家具缩略图（替代问号占位）：广告 gate、活动/任务/图鉴条件锁、
 * 以及「差一级星级门槛即可购买」的等级锁，用于提升面板吸引力。
 */
function shouldShowLockedDecoPreview(deco: DecoDef, sceneOk: boolean): boolean {
  if (!sceneOk) return false;

  if (DecorationManager.isAdUnlockDeco(deco.id)) return true;

  const req = deco.unlockRequirement;
  if (req?.questId) return true;
  if (req?.conditionText === '活动解锁') return true;
  if (req?.conditionText === '新手礼包') return true;
  if (req?.flowerCollectionItemId) return true;

  const lv = req?.level;
  if (lv !== undefined && lv > 0 && LevelManager.level === lv - 1) return true;

  return false;
}

/** 未解锁房壳仍展示真实预览图（与家具卡 teaser 规则对齐，含新手礼包房壳） */
function shouldShowLockedRoomStylePreview(style: RoomStyleDef): boolean {
  const req = style.unlockRequirement;
  if (req?.questId) return true;
  if (req?.conditionText === '活动解锁') return true;
  if (req?.conditionText === '新手礼包') return true;
  if (req?.flowerCollectionItemId) return true;
  const lv = req?.level;
  if (lv !== undefined && lv > 0 && LevelManager.level === lv - 1) return true;
  return false;
}

function shouldUseNextLevelUnlockLabel(deco: DecoDef, sceneOk: boolean): boolean {
  if (!sceneOk) return false;
  if (DecorationManager.isAdUnlockDeco(deco.id)) return false;
  const lv = deco.unlockRequirement?.level;
  return lv !== undefined && lv > 0 && LevelManager.level === lv - 1;
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

const TUTORIAL_BUY_DECO_ID = 'shelf_wood';

export class DecorationPanel extends PIXI.Container {
  /** MainScene 唯一实例；供新手引导在 overlay 上对齐购买钮 */
  private static _sharedInstance: DecorationPanel | null = null;
  static get shared(): DecorationPanel | null {
    return DecorationPanel._sharedInstance;
  }

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
  private _assetUnsub: (() => void) | null = null;
  private _assetRefreshRaf: number | null = null;
  private _activeTab: DecoPanelTabId = 'flower_room';
  private _decoInvFilter: DecoInvFilter = 'all';
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
  /** 当前底图是否为 decoration_panel_shell_nb2（布局锚点与 legacy 不同） */
  private _usesFlatShell = false;
  /** NB2 底板裁切到面板矩形（顶栏若高于 panelH 则裁顶） */
  private _panelBgMask: PIXI.Graphics | null = null;
  /** NB2 底板层（整块面板点击区） */
  private _panelBgLayer: PIXI.Container | null = null;
  /** 构造时贴图未就绪的临时底板；真底图加载后必须移除，避免盖住花店上半区 */
  private _panelFallbackBg: PIXI.DisplayObject | null = null;
  /** 顶栏右上角关闭 */
  private _closeBtn!: PIXI.Container;
  /** 购买成功后「获得新家具」浮层 */
  private _unlockOverlay: PIXI.Container | null = null;
  /** 「放入房间」按钮节点（新手引导对齐用） */
  private _unlockPlaceRoomHit: PIXI.Container | null = null;
  /** 飞星结束前暂存，用于到账加星与弹窗顺序 */
  private _pendingDecoGrantStar: DecoDef | null = null;
  /** 升星弹窗关闭后再弹出「获得新家具」 */
  private _pendingNewDecoAfterLevelUp: DecoDef | null = null;

  /** 当前网格中首张「可花愿购买」卡片的购买区锚点（卡片局部坐标系中的点） */
  private _tutorialPurchaseAnchor: PIXI.Container | null = null;
  private _assignTutorialPurchaseAnchorDone = false;

  private readonly _onCurrencyChangedForGrid = (type?: string): void => {
    if (!this._isOpen || type !== 'huayuan') return;
    this._refreshAll();
  };

  private readonly _onCollectionDiscoveredForGrid = (): void => {
    if (!this._isOpen) return;
    this._refreshAll();
  };

  private readonly _onDecoNewUnlockChanged = (): void => {
    if (!this._isOpen) return;
    this._refreshAll();
  };

  constructor() {
    super();
    DecorationPanel._sharedInstance = this;
    this.visible = false;
    this.zIndex = DECO_PANEL_Z_INDEX;
    this.sortableChildren = true;
    this._build();
    EventBus.on('decoration:shopStarFlyComplete', this._onShopStarFlyComplete);
    EventBus.on('shop:levelUpPopupClosed', this._onShopLevelUpPopupClosed);
    EventBus.on('decoNewUnlock:changed', this._onDecoNewUnlockChanged);
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
      // 勿清空 pending：家具卡在 plate 之上命中卡本身；点在空白才落到 plate，不应抹掉已在卡上记录的 pending
    });
    inner.addChildAt(plate, 0);
  }

  // ─── open / close ─────────────────────────────────────────

  /** 与 overlay 内其它节点 zIndex 排序（含抬升后的星级条） */
  private _sortParentOverlay(): void {
    const p = this.parent;
    if (p?.sortableChildren) p.sortChildren();
  }

  /** 面板是否处于打开态（含滑入动画期间） */
  get isOpen(): boolean {
    return this._isOpen;
  }

  /**
   * 首张可立即花愿购买的家具卡、绿色购买条中心的全局坐标（设计/舞台坐标系）。
   * 仅在新手引导「选购家具」步骤且网格已刷新时可能非空。
   */
  getTutorialPurchasableBuyButtonGlobal(): PIXI.Point | null {
    if (!this._isOpen || !this._tutorialPurchaseAnchor?.parent) return null;
    const p = new PIXI.Point(0, 0);
    this._tutorialPurchaseAnchor.toGlobal(p, p);
    return new PIXI.Point(p.x, p.y);
  }

  /** 「获得新家具」弹层里「放入房间」钮中心的全局坐标 */
  getTutorialUnlockPlaceRoomButtonGlobal(): PIXI.Point | null {
    if (!this._unlockPlaceRoomHit?.parent) return null;
    const btnH = 46;
    const p = new PIXI.Point(0, btnH / 2);
    this._unlockPlaceRoomHit.toGlobal(p, p);
    return new PIXI.Point(p.x, p.y);
  }

  open(): void {
    if (this._isOpen) return;
    this._isOpen = true;
    this.visible = true;
    const offDeco = TextureCache.onAssetGroupLoaded('deco', () => this._scheduleAssetRefresh());
    const offTutorialDeco = TextureCache.onAssetGroupLoaded('tutorialDeco', () => this._scheduleAssetRefresh());
    this._assetUnsub = () => {
      offDeco();
      offTutorialDeco();
    };
    EventBus.emit('decoration:decoPanelBackdrop', { open: true });
    this._sortParentOverlay();
    this._activeTab = 'flower_room';
    this._decoInvFilter = 'all';
    this._redrawDimMask();
    this._resizePanelIfNeeded();
    // 面板实例在主场景初始化时已构建；发版后冷启动时贴图常在 open 前的预加载阶段才进入缓存。
    // 这里主动应用一次已加载贴图，避免错过 texture:loaded 事件后首帧仍停留在矢量/空贴图兜底态。
    this._applyLoadedPanelTextures();
    this._scrollY = 0;
    this._refreshAll();
    this._scheduleAssetRefresh();
    setTimeout(() => this._scheduleAssetRefresh(), 120);
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
    TweenManager.to({
      target: this._content.position,
      props: { y: panelY },
      duration: 0.28,
      ease: Ease.easeOutQuad,
      onComplete: () => {
        if (TutorialManager.isActive && TutorialManager.currentStep === TutorialStep.GUIDE_BUY_FURNITURE) {
          EventBus.emit('decoration:tutorialPurchaseAnchorReady');
        }
      },
    });
  }

  close(): void {
    if (!this._isOpen) return;
    EventBus.off('currency:changed', this._onCurrencyChangedForGrid);
    EventBus.off('collection:discovered', this._onCollectionDiscoveredForGrid);
    this._assetUnsub?.();
    this._assetUnsub = null;
    this._assetRefreshRaf = null;
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

  /** 顶栏 header 底边、筛选条、分割线、内容顶与网格几何（随 panel 高度变化） */
  private _shellTopY(panelH: number): number {
    const sp = this._panelBaseSprite;
    if (!sp) return 0;
    return panelH - sp.height;
  }

  private _shellMapY(panelH: number, texFracY: number): number {
    const sp = this._panelBaseSprite;
    if (!sp) return panelH * texFracY;
    return this._shellTopY(panelH) + sp.height * texFracY;
  }

  private _headerLayout(panelH: number, filterVisible = true): {
    contentX: number;
    contentW: number;
    filterBarTop: number;
    categoryTabTop: number;
    dividerY: number;
    contentTopY: number;
    gridViewportTop: number;
    gridH: number;
    gridX: number;
    gridW: number;
  } {
    const chromeExtra = this._usesFlatShell ? 0 : HEADER_CHROME_EXTRA_Y;
    const gridInset = this._usesFlatShell ? SHELL_GRID_VIEWPORT_TOP_INSET : GRID_VIEWPORT_TOP_INSET;
    const contentX = decoPanelContentX();
    const contentW = decoPanelContentW();
    const { blockH: categoryTabBlockH } = categoryTabGridLayout(contentW);
    const filterBlockH = filterVisible ? FILTER_BAR_H : 0;
    const filterToCategoryGap = filterVisible ? FILTER_TO_CATEGORY_GAP : 0;

    if (this._usesFlatShell && this._panelBaseSprite) {
      const headerBottom = Math.round(this._shellMapY(panelH, SHELL_HEADER_BOTTOM_TEX_FRAC));
      const filterBarTop = Math.round(headerBottom + SHELL_FILTER_ROW_GAP_BELOW_HEADER);
      const categoryTabTop = filterBarTop + filterBlockH + filterToCategoryGap;
      const dividerY = Math.round(categoryTabTop + categoryTabBlockH + CATEGORY_TO_DIVIDER_GAP);
      const contentTopY = Math.round(dividerY + DIVIDER_TO_CONTENT);
      const gridViewportTop = contentTopY + gridInset + GRID_VIEWPORT_NUDGE_Y;
      const gridH = Math.max(48, panelH - gridViewportTop - CONTENT_BOTTOM);
      return {
        contentX,
        contentW,
        filterBarTop,
        categoryTabTop,
        dividerY,
        contentTopY,
        gridViewportTop,
        gridH,
        gridX: contentX,
        gridW: contentW,
      };
    }

    const headerBottom = Math.round(panelH * PANEL_PINK_BAND_BOTTOM_RATIO);
    const filterGap = FILTER_ROW_GAP_BELOW_PINK;
    const filterBarTop = Math.round(headerBottom + filterGap + chromeExtra);
    const categoryTabTop = filterBarTop + filterBlockH + filterToCategoryGap;
    const dividerY = Math.round(categoryTabTop + categoryTabBlockH + CATEGORY_TO_DIVIDER_GAP);
    const contentTopY = Math.round(dividerY + DIVIDER_TO_CONTENT - chromeExtra);
    const gridViewportTop = contentTopY + gridInset + GRID_VIEWPORT_NUDGE_Y;
    const gridH = Math.max(48, panelH - gridViewportTop - CONTENT_BOTTOM);
    return {
      contentX,
      contentW,
      filterBarTop,
      categoryTabTop,
      dividerY,
      contentTopY,
      gridViewportTop,
      gridH,
      gridX: contentX,
      gridW: contentW,
    };
  }

  private _titleCenterY(panelH: number): number {
    if (this._usesFlatShell && this._panelBaseSprite) {
      return Math.round(this._shellMapY(panelH, SHELL_TITLE_TEX_FRAC));
    }
    return Math.round(panelH * PANEL_TITLE_Y_RATIO + HEADER_CHROME_EXTRA_Y);
  }

  /** 筛选条下方：board_bar（flat 单壳无装饰线，仍叠代码 board_bar） */
  private _layoutHeaderDivider(dividerY: number): void {
    this._headerDivider.removeChildren().forEach(ch => ch.destroy({ children: true }));
    this._headerDivider.visible = true;
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
    const filterVisible = this._activeTab !== 'room_styles';
    const L = this._headerLayout(panelH, filterVisible);
    this._contentTopY = L.contentTopY;
    this._filterBar.position.set(L.contentX, L.filterBarTop);
    this._filterBar.visible = filterVisible;
    this._tabContainer.position.set(L.contentX, L.categoryTabTop);
    const titleY = this._titleCenterY(panelH);
    this._titleText.position.y = titleY;
    this._layoutCloseBtn(panelH);
    this._layoutHeaderDivider(L.dividerY);
  }

  private _tearDownPanelBgLayer(): void {
    if (this._panelBgLayer?.parent) {
      this._panelBgLayer.parent.removeChild(this._panelBgLayer);
      this._panelBgLayer.destroy({ children: true });
    }
    this._panelBaseSprite = null;
    this._panelBgMask = null;
    this._panelBgLayer = null;
  }

  private _mountPanelBgLayer(panelH: number): boolean {
    const { tex, flatShell } = resolveDecorationPanelBg();
    if (!tex?.width) return false;

    this._tearDownPanelBgLayer();
    this._usesFlatShell = flatShell;

    const displayTex = panelBgDisplayTexture(tex, flatShell);
    const panelBg = new PIXI.Sprite(displayTex);
    panelBg.anchor.set(0.5, 1);
    panelBg.eventMode = 'none';
    panelBg.zIndex = 0;

    const bgLayer = new PIXI.Container();
    bgLayer.sortableChildren = true;
    bgLayer.zIndex = 0;
    bgLayer.eventMode = 'none';

    const bgMask = new PIXI.Graphics();
    bgMask.eventMode = 'none';
    bgMask.beginFill(0xffffff);
    bgMask.drawRect(0, 0, PANEL_W, panelH);
    bgMask.endFill();
    bgLayer.addChild(panelBg);
    bgLayer.addChild(bgMask);
    bgLayer.mask = bgMask;
    this._content.addChildAt(bgLayer, 0);
    this._panelBaseSprite = panelBg;
    this._panelBgMask = bgMask;
    this._panelBgLayer = bgLayer;
    this._layoutNb2PanelBackground(panelH);
    this._content.sortChildren();
    if (this._closeBtn) this._layoutCloseBtn(panelH);
    return true;
  }

  private _buildCloseBtn(panelH: number): void {
    this._closeBtn = new PIXI.Container();
    this._closeBtn.zIndex = 25;
    this._closeBtn.eventMode = 'static';
    this._closeBtn.cursor = 'pointer';
    const onClose = (e: PIXI.FederatedPointerEvent): void => {
      e.stopPropagation();
      this.close();
    };
    this._closeBtn.on('pointerdown', onClose);
    this._closeBtn.on('pointertap', onClose);
    this._content.addChild(this._closeBtn);
    this._layoutCloseBtn(panelH);
  }

  /** flat 单壳关闭钮：烘焙在壳上则仅热区；否则叠 deco_nb2_close_btn */
  private _layoutCloseBtn(panelH: number): void {
    if (!this._closeBtn) return;
    this._closeBtn.removeChildren().forEach(ch => ch.destroy({ children: true }));
    if (this._usesFlatShell && this._panelBaseSprite && SHELL_BAKED_CLOSE_BTN) {
      const cx = PANEL_W * SHELL_CLOSE_X_FRAC;
      const cy = this._shellMapY(panelH, SHELL_CLOSE_Y_TEX_FRAC);
      this._closeBtn.position.set(cx, cy);
      const hitR = Math.max(PANEL_W * SHELL_CLOSE_HIT_R_TEX, 28);
      this._closeBtn.hitArea = new PIXI.Circle(0, 0, hitR);
      return;
    }
    const closeY =
      this._usesFlatShell && this._panelBaseSprite
        ? this._shellMapY(panelH, SHELL_CLOSE_Y_TEX_FRAC)
        : this._titleCenterY(panelH);
    this._closeBtn.position.set(PANEL_W - DECO_CLOSE_BTN_INSET_RIGHT, closeY);
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
  }

  private _refreshCloseBtnTexture(): void {
    const panelH = Math.round(Game.logicHeight * PANEL_H_RATIO);
    this._layoutCloseBtn(panelH);
  }

  private _applyLoadedPanelTextures(): void {
    const panelH = Math.round(Game.logicHeight * PANEL_H_RATIO);
    const { tex, flatShell } = resolveDecorationPanelBg();
    const needsRemount = !!tex?.width && (!this._panelBgMask || this._usesFlatShell !== flatShell);

    if (needsRemount) {
      if (this._panelFallbackBg?.parent) {
        this._panelFallbackBg.parent.removeChild(this._panelFallbackBg);
        this._panelFallbackBg.destroy({ children: true });
      }
      this._panelFallbackBg = null;
      this._mountPanelBgLayer(panelH);
    } else if (this._panelBaseSprite && this._panelBgMask) {
      this._layoutNb2PanelBackground(panelH);
    }

    this._refreshCloseBtnTexture();
    this._applyHeaderChrome(panelH);
  }

  private _scheduleAssetRefresh(): void {
    if (!this._isOpen || this._assetRefreshRaf !== null) return;
    this._assetRefreshRaf = requestAnimationFrame(() => {
      this._assetRefreshRaf = null;
      if (!this._isOpen) return;
      this._applyLoadedPanelTextures();
      this._refreshAll();
    });
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
    this._content.eventMode = 'static';
    this._content.on('pointerdown', (e: PIXI.FederatedPointerEvent) => { e.stopPropagation(); });
    this._content.on('pointertap', (e: PIXI.FederatedPointerEvent) => { e.stopPropagation(); });
    this._layoutPanelContentHit(panelH);
    this._content.position.set(panelX, panelY);
    this.addChild(this._content);

    // --- panel background: flat 单壳 / legacy NB2 / merge_chain_panel ---
    const { tex: panelTex } = resolveDecorationPanelBg();
    const mergeTex = TextureCache.get('merge_chain_panel');
    this._panelBaseSprite = null;
    this._panelBgMask = null;
    this._panelBgLayer = null;
    this._panelFallbackBg = null;
    this._usesFlatShell = false;
    if (panelTex?.width) {
      this._mountPanelBgLayer(panelH);
    } else if (mergeTex?.width) {
      const panelBg = new PIXI.Sprite(mergeTex);
      panelBg.width = PANEL_W;
      panelBg.height = panelH;
      panelBg.eventMode = 'none';
      panelBg.zIndex = 0;
      this._content.addChild(panelBg);
      this._panelBaseSprite = panelBg;
      this._panelFallbackBg = panelBg;
    } else {
      const g = new PIXI.Graphics();
      g.lineStyle(3, 0xd97b00);
      g.beginFill(0xfff9e6);
      g.drawRoundedRect(0, 0, PANEL_W, panelH, PANEL_TOP_R);
      g.endFill();
      g.lineStyle(2, 0xffd700);
      g.drawRoundedRect(3, 3, PANEL_W - 6, panelH - 6, PANEL_TOP_R - 2);
      g.eventMode = 'none';
      g.zIndex = 0;
      this._content.addChild(g);
      this._panelFallbackBg = g;
    }

    // --- 顶栏：无彩带；标题「家具」叠在壳体 header 区 ---
    const titleCenterY = this._titleCenterY(panelH);
    const filterVisible = this._activeTab !== 'room_styles';
    const L = this._headerLayout(panelH, filterVisible);

    this._titleText = new PIXI.Text('家具', decoPanelTextStyle({
      fontSize: 38,
      fill: 0xffffff,
      fontWeight: '900',
      stroke: DECO_PANEL_TITLE_STROKE,
      strokeThickness: 5,
    }));
    this._titleText.anchor.set(0.5, 0.5);
    this._titleText.position.set(PANEL_W / 2, titleCenterY);
    this._titleText.zIndex = 12;
    this._content.addChild(this._titleText);

    this._buildCloseBtn(panelH);

    // --- 库存筛选条 + 分类 Tab（顶栏横排） ---
    this._filterBar = new PIXI.Container();
    this._filterBar.position.set(L.contentX, L.filterBarTop);
    this._filterBar.zIndex = 11;
    this._content.addChild(this._filterBar);
    this._buildInventoryFilterBar(L.contentW);

    this._tabContainer = new PIXI.Container();
    this._tabContainer.zIndex = 11;
    this._tabContainer.position.set(L.contentX, L.categoryTabTop);
    this._content.addChild(this._tabContainer);
    this._buildCategoryTabs(L.contentW);
    this._filterBar.visible = filterVisible;

    // --- 顶部分隔：棋盘同款 board_bar ---
    this._headerDivider = new PIXI.Container();
    this._headerDivider.zIndex = 11;
    this._headerDivider.eventMode = 'none';
    this._layoutHeaderDivider(L.dividerY);
    this._content.addChild(this._headerDivider);

    this._contentTopY = L.contentTopY;

    const { gridX, gridW, gridViewportTop, gridH } = L;

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
    const filterVisible = this._activeTab !== 'room_styles';
    const L = this._headerLayout(panelH, filterVisible);
    return {
      gridX: L.gridX,
      gridW: L.gridW,
      gridH: L.gridH,
      gridViewportTop: L.gridViewportTop,
    };
  }

  /** 右侧五格筛选：全部 / 已放置 / 未放置 / 未购买 / 未解锁（程序绘制药丸，同工坊分类条） */
  private _buildInventoryFilterBar(gridW: number): void {
    this._filterBar.removeChildren().forEach(ch => ch.destroy({ children: true }));
    const n = DECO_INV_FILTER_SPECS.length;
    const gap = 6;
    const cellW = (gridW - gap * (n - 1)) / n;
    const rowH = FILTER_BAR_H - 6;
    const padY = Math.max(1, Math.floor((FILTER_BAR_H - rowH) / 2));

    DECO_INV_FILTER_SPECS.forEach((spec, i) => {
      const cell = new PIXI.Container();
      cell.position.set(i * (cellW + gap), padY);
      cell.hitArea = new PIXI.Rectangle(0, 0, cellW, rowH);
      const sel = this._decoInvFilter === spec.id;

      const bg = new PIXI.Graphics();
      paintDecoFilterPill(bg, cellW, rowH, sel);
      cell.addChild(bg);

      const t = new PIXI.Text(spec.label, decoPanelTextStyle({
        fontSize: 17,
        fill: sel ? DECO_FILTER_SELECTED_TEXT : DECO_FILTER_IDLE_TEXT,
        fontWeight: '900',
        lineHeight: 23,
      }));
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
    this._layoutPanelContentHit(panelH);
    this._applyHeaderChrome(panelH);
    this._syncGridViewportClip();
  }

  // ─── category tabs (top horizontal, 1–2 rows) ───────────

  private _buildCategoryTabs(contentW: number): void {
    this._tabContainer.removeChildren().forEach(ch => ch.destroy({ children: true }));
    const { cols, tabW, tabH } = categoryTabGridLayout(contentW);
    const gap = CATEGORY_TAB_GAP;
    const fontSize = CATEGORY_TAB_FONT_SIZE;

    DECO_PANEL_TABS.forEach((tabId, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const labelDef = getDecorationTabLabel(tabId, CurrencyManager.state.sceneId);
      const isCurrent = this._activeTab === tabId;
      const title = labelDef.name;
      const withLotus = tabId === 'qinglian';

      const tab = new PIXI.Container();
      tab.position.set(col * (tabW + gap), row * (tabH + gap));

      const bg = new PIXI.Graphics();
      paintDecoCategoryPill(bg, tabW, tabH, isCurrent);
      tab.addChild(bg);

      const label = new PIXI.Text(title, decoPanelTextStyle({
        fontSize,
        fill: isCurrent ? DECO_SIDE_TAB_SELECTED_TEXT : DECO_SIDE_TAB_IDLE_TEXT,
        fontWeight: '900',
      }));

      const lotusTex = withLotus ? TextureCache.get('furniture_tray_tab_qinglian_idle') : null;
      const iconMax = 20;
      if (lotusTex?.width) {
        const sp = new PIXI.Sprite(lotusTex);
        sp.anchor.set(0.5, 0.5);
        const s = Math.min(iconMax / lotusTex.width, iconMax / lotusTex.height);
        sp.scale.set(s);
        const iconW = lotusTex.width * s;
        const textGap = 4;
        label.anchor.set(0, 0.5);
        const textW = label.width;
        const totalW = iconW + textGap + textW;
        const cx = tabW / 2;
        sp.position.set(cx - totalW / 2 + iconW / 2, tabH / 2);
        label.position.set(cx - totalW / 2 + iconW + textGap, tabH / 2);
        tab.addChild(sp);
      } else {
        label.anchor.set(0.5, 0.5);
        label.position.set(tabW / 2, tabH / 2);
      }
      tab.addChild(label);

      tab.eventMode = 'static';
      tab.cursor = 'pointer';
      tab.hitArea = new PIXI.Rectangle(0, 0, tabW, tabH);
      tab.on('pointertap', () => {
        if (this._activeTab === tabId) return;
        this._activeTab = tabId;
        this._scrollY = 0;
        this._refreshAll();
      });
      this._tabContainer.addChild(tab);
    });
  }

  // ─── refresh ──────────────────────────────────────────────

  private _refreshAll(): void {
    const panelH = Math.round(Game.logicHeight * PANEL_H_RATIO);
    const filterVisible = this._activeTab !== 'room_styles';
    const L = this._headerLayout(panelH, filterVisible);
    this._contentTopY = L.contentTopY;
    this._filterBar.position.set(L.contentX, L.filterBarTop);
    this._filterBar.visible = filterVisible;
    this._tabContainer.position.set(L.contentX, L.categoryTabTop);
    this._buildCategoryTabs(L.contentW);
    this._buildInventoryFilterBar(L.contentW);
    this._layoutHeaderDivider(L.dividerY);
    this._syncGridViewportClip();
    this._buildGrid(L.gridH);
  }

  // ─── grid ─────────────────────────────────────────────────

  /** 仅清除滚动内容（遮罩在 viewport 上，不在 gridContainer 内） */
  private _clearGridScrollContent(): void {
    this._gridContainer.removeChildren().forEach(ch => ch.destroy({ children: true }));
  }

  private _buildGrid(availH: number): void {
    this._tutorialPurchaseAnchor = null;
    this._assignTutorialPurchaseAnchorDone = false;
    this._clearGridScrollContent();
    if (this._activeTab === 'room_styles') { this._buildRoomStyleGrid(availH); return; }

    const sceneId = CurrencyManager.state.sceneId;
    let decos = sortDecosForInvFilter(
      getDecosForDecorationPanelTab(this._activeTab, sceneId)
        .filter(shouldShowDecoInDecorationPanel)
        .filter(d => !d.workshopExclusive),
      this._decoInvFilter,
      sceneId,
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
      this._applyScroll();
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
    this._restoreGridScrollAfterRebuild();
    if (
      TutorialManager.isActive
      && TutorialManager.currentStep === TutorialStep.GUIDE_BUY_FURNITURE
      && this._tutorialPurchaseAnchor?.parent
    ) {
      EventBus.emit('decoration:tutorialPurchaseAnchorReady');
    }
  }

  private _buildRoomStyleGrid(availH: number): void {
    const gridW = decoPanelGridWidth();
    const { cw, ch, cols, startX } = measureCardGrid(gridW);

    const inner = new PIXI.Container();
    this._gridContainer.addChild(inner);

    const stylesSorted = sortRoomStylesByUnlockLevelThenCost(getRoomStylesForScene(CurrencyManager.state.sceneId));
    if (stylesSorted.length === 0) {
      const empty = new PIXI.Text('当前房屋暂无可用房间风格', {
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
      this._applyScroll();
      return;
    }
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
    this._restoreGridScrollAfterRebuild();
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

  // ─── 星星值角标（购买后获得的星分，与稀有度无关）────────────────

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
      const fb = new PIXI.Text('★', { fontSize: Math.round(iconH * 0.9), fontFamily: FONT_FAMILY });
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

  private _addNewUnlockBadge(card: PIXI.Container, cw: number): void {
    const pad = 6;
    const tagW = Math.round(Math.min(34, Math.max(28, cw * 0.22)));
    const tagH = Math.round(tagW * 0.68);
    const x = cw - pad - tagW;
    const y = pad;

    const bg = new PIXI.Graphics();
    bg.beginFill(0xe53935);
    bg.lineStyle(1.5, 0xffffff, 0.92);
    bg.drawRoundedRect(x, y, tagW, tagH, 8);
    bg.endFill();
    card.addChild(bg);

    const t = new PIXI.Text('新', {
      fontSize: Math.round(tagH * 0.62),
      fill: 0xffffff,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    t.anchor.set(0.5, 0.5);
    t.position.set(x + tagW / 2, y + tagH / 2);
    card.addChild(t);
  }

  private _addEquipBadge(card: PIXI.Container, cw: number): void {
    const bg = new PIXI.Graphics();
    bg.beginFill(COLORS.BUTTON_PRIMARY);
    bg.drawCircle(cw - 14, 14, 11);
    bg.endFill();
    card.addChild(bg);
    const t = new PIXI.Text('√', { fontSize: 13, fill: 0xffffff, fontFamily: FONT_FAMILY, fontWeight: 'bold' });
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
        if (lineText === '免费解锁') {
          const badge = createFreeAdBadge(15, 0xffffff, 0x333333, '免费解锁');
          badge.position.set(cw / 2, cy);
          card.addChild(badge);
        } else {
          const label = new PIXI.Text(lineText, lockStyle as any);
          label.anchor.set(0.5, 0.5);
          label.position.set(cw / 2, cy);
          card.addChild(label);
        }
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
        if (lineText === '免费解锁') {
          const badge = createFreeAdBadge(15, 0xffffff, 0x333333, '免费解锁');
          badge.position.set(cw / 2, cy);
          card.addChild(badge);
        } else {
          const fs = mode === 'locked' ? 15 : 17;
          const t = new PIXI.Text(lineText, { fontSize: fs, fill: 0xffffff, fontFamily: FONT_FAMILY, fontWeight: 'bold' });
          t.anchor.set(0.5, 0.5);
          t.position.set(cw / 2, cy);
          card.addChild(t);
        }
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
    const adGateSatisfied = DecorationManager.isAdUnlockSatisfied(deco.id);
    const isAdGate = DecorationManager.isAdUnlockDeco(deco.id);
    const purchaseAllowed = sceneOk && reqMet && (!isAdGate || adGateSatisfied);
    const needsAdGate = sceneOk && isAdGate && reqMet && !adGateSatisfied;
    const cardUnlockedLook = (isUnlocked || purchaseAllowed) && sceneOk;

    this._drawCardBg(card, cw, ch, cardUnlockedLook, isPlaced);

    const maxIcon = Math.round((CARD_ICON_MAX_BASE * cw) / CARD_BASE_W);
    const iconCy = Math.round((ch * 54) / CARD_BASE_H);
    const nameY = Math.max(
      Math.round((ch * 90) / CARD_BASE_H),
      iconCy + Math.ceil(maxIcon * 0.52) + 8,
    );

    const iconArea = new PIXI.Container();
    iconArea.position.set(cw / 2, iconCy);
    card.addChild(iconArea);

    // 未拥有且仍被条件/场景挡住：默认问号占位；广告/活动/下一星级档等仍展示真实图以利转化
    const showLockedTeaser = shouldShowLockedDecoPreview(deco, sceneOk);
    const mysteryPreview = !isUnlocked && !purchaseAllowed && !showLockedTeaser;

    if (!mysteryPreview) {
      const texture = TextureCache.get(deco.icon);
      if (texture) {
        const sprite = new PIXI.Sprite(texture);
        const s = Math.min(maxIcon / texture.width, maxIcon / texture.height);
        sprite.scale.set(s);
        sprite.anchor.set(0.5, 0.5);
        iconArea.addChild(sprite);
      }
    } else {
      addMysteryCardPlaceholder(iconArea, cw, CARD_BASE_W, maxIcon);
    }

    this._addStarValueBadge(card, cw, deco.starValue);
    if (DecoNewUnlockManager.isNewUnlockHighlight(deco.id)) {
      this._addNewUnlockBadge(card, cw);
    }
    if (isPlaced) this._addEquipBadge(card, cw);

    const lockAfterName = !purchaseAllowed;
    const nameGap = 12;
    const lockSlot = Math.max(26, Math.round((28 * cw) / CARD_BASE_W));
    const nameWrap = lockAfterName ? Math.max(36, cw - 12 - nameGap - lockSlot) : cw - 12;

    const nameRow = new PIXI.Container();
    const nameText = new PIXI.Text(getDecoDisplayName(deco.id), {
      fontSize: 15,
      fill: COLORS.TEXT_DARK,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      wordWrap: true,
      wordWrapWidth: nameWrap,
      align: 'left',
    });
    nameText.anchor.set(0, 0);
    nameRow.addChild(nameText);

    if (lockAfterName) {
      const lockIcon = createSmallNameLockIcon(cw, CARD_BASE_W);
      lockIcon.position.set(nameText.width + nameGap, nameText.height * 0.5);
      nameRow.addChild(lockIcon);
    }

    const nb = nameRow.getLocalBounds();
    nameRow.position.set(Math.round((cw - nb.width) / 2 - nb.x), nameY - nb.y - 2);
    card.addChild(nameRow);

    if (!sceneOk) {
      this._addFooter(card, cw, ch, 'locked', undefined, formatAllowedScenesShort(deco));
    } else if (isUnlocked && isPlaced) this._addFooter(card, cw, ch, 'furniture_placed', undefined, '');
    else if (isUnlocked) this._addFooter(card, cw, ch, 'furniture_go_place', undefined, '');
    else if (needsAdGate) this._addFooter(card, cw, ch, 'ready', undefined, '免费解锁');
    else if (!purchaseAllowed) {
      const lockedText = shouldUseNextLevelUnlockLabel(deco, sceneOk) ? '下级即将解锁' : reqResult.text;
      this._addFooter(card, cw, ch, 'locked', undefined, lockedText);
    }
    else if (deco.cost > 0) this._addFooter(card, cw, ch, 'purchase', deco.cost, '购买');
    else this._addFooter(card, cw, ch, 'furniture_go_place', undefined, '');

    const showPurchase =
      sceneOk && !isUnlocked && purchaseAllowed && deco.cost > 0;
    const affordPurchase = CurrencyManager.state.huayuan >= deco.cost;

    card.eventMode = 'static';
    /** Pixi v7：子节点（底栏贴图/文字）否则会抢走命中；整张卡单一矩形命中，与 DressUpPanel 一致 */
    card.interactiveChildren = false;
    card.hitArea = new PIXI.Rectangle(0, 0, cw, ch);
    card.cursor = showPurchase && !affordPurchase ? 'default' : 'pointer';
    card.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      this._beginScroll(e);
      this._pendingGridTap = { type: 'deco', deco, flyCard: card };
    });

    if (
      TutorialManager.isActive
      && TutorialManager.currentStep === TutorialStep.GUIDE_BUY_FURNITURE
      && deco.id === TUTORIAL_BUY_DECO_ID
      && showPurchase
      && affordPurchase
      && !this._assignTutorialPurchaseAnchorDone
    ) {
      this._assignTutorialPurchaseAnchorDone = true;
      const anchor = new PIXI.Container();
      const bottomPad = 10;
      const targetH = Math.min(48, Math.round((38 * ch) / CARD_BASE_H));
      const cy = ch - bottomPad - targetH / 2;
      anchor.position.set(cw / 2, cy);
      card.addChild(anchor);
      this._tutorialPurchaseAnchor = anchor;
    }

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
    /** 已解锁、条件已满足、或任务/礼包/下一级档 teaser 时显示房壳预览 */
    const showStylePreview = unlocked || styleReqMet || shouldShowLockedRoomStylePreview(style);

    this._drawCardBg(card, cw, ch, unlocked || styleReqMet, equipped);

    const previewCy = Math.round((ch * 54) / CARD_BASE_H);

    const preview = new PIXI.Container();
    preview.position.set(cw / 2, previewCy);
    card.addChild(preview);

    let previewHalfH = 0;
    if (!showStylePreview) {
      const maxBox = Math.min(cw - 12, Math.round((CARD_PREVIEW_MAX_H_BASE * ch) / CARD_BASE_H));
      addMysteryCardPlaceholder(preview, cw, CARD_BASE_W, maxBox);
      previewHalfH = Math.ceil(maxBox * 0.44) + 2;
    } else {
      const tex = TextureCache.get(style.bgTexture);
      if (tex?.width) {
        const sp = new PIXI.Sprite(tex);
        const maxW = cw - 12;
        const maxH = Math.round((CARD_PREVIEW_MAX_H_BASE * ch) / CARD_BASE_H);
        const s = Math.min(maxW / tex.width, maxH / tex.height);
        previewHalfH = Math.ceil((tex.height * s) / 2);
        sp.scale.set(s);
        sp.anchor.set(0.5, 0.5);
        preview.addChild(sp);
      } else {
        previewHalfH = Math.round((38 * ch) / CARD_BASE_H);
      }
    }

    const nameY = Math.max(
      Math.round((ch * 90) / CARD_BASE_H),
      previewCy + (previewHalfH || 28) + 8,
    );

    this._addStarValueBadge(card, cw, style.starValue);
    if (equipped) this._addEquipBadge(card, cw);

    if (!showStylePreview) {
      const nameGap = 12;
      const lockSlot = Math.max(26, Math.round((28 * cw) / CARD_BASE_W));
      const nameWrap = Math.max(36, cw - 12 - nameGap - lockSlot);
      const nameRow = new PIXI.Container();
      const nameText = new PIXI.Text(style.name, {
        fontSize: 15,
        fill: COLORS.TEXT_DARK,
        fontFamily: FONT_FAMILY,
        fontWeight: 'bold',
        wordWrap: true,
        wordWrapWidth: nameWrap,
        align: 'left',
      });
      nameText.anchor.set(0, 0);
      nameRow.addChild(nameText);
      const lockIcon = createSmallNameLockIcon(cw, CARD_BASE_W);
      lockIcon.position.set(nameText.width + nameGap, nameText.height * 0.5);
      nameRow.addChild(lockIcon);
      const nb = nameRow.getLocalBounds();
      nameRow.position.set(Math.round((cw - nb.width) / 2 - nb.x), nameY - nb.y - 2);
      card.addChild(nameRow);
    } else {
      const nameText = new PIXI.Text(style.name, {
        fontSize: 15,
        fill: COLORS.TEXT_DARK,
        fontFamily: FONT_FAMILY,
        fontWeight: 'bold',
        wordWrap: true,
        wordWrapWidth: cw - 12,
        align: 'center',
      });
      nameText.anchor.set(0.5, 0);
      nameText.position.set(cw / 2, nameY);
      card.addChild(nameText);
    }

    if (equipped) this._addFooter(card, cw, ch, 'equipped', undefined, '使用');
    else if (unlocked) this._addFooter(card, cw, ch, 'ready', undefined, '使用');
    else if (!styleReqMet) this._addFooter(card, cw, ch, 'locked', undefined, styleReq.text);
    else if (style.cost > 0) this._addFooter(card, cw, ch, 'purchase', style.cost, '使用');
    else this._addFooter(card, cw, ch, 'ready', undefined, '领取');

    const showStylePurchase = !unlocked && styleReqMet && style.cost > 0;
    const affordStylePurchase = CurrencyManager.state.huayuan >= style.cost;

    card.eventMode = 'static';
    card.interactiveChildren = false;
    card.hitArea = new PIXI.Rectangle(0, 0, cw, ch);
    card.cursor = showStylePurchase && !affordStylePurchase ? 'default' : 'pointer';
    card.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      this._beginScroll(e);
      this._pendingGridTap = { type: 'room', style, flyCard: card };
    });
    return card;
  }

  /** 面板本体 hit 区：拦截冒泡，避免点击壳体空白误触底层遮罩关闭 */
  private _layoutPanelContentHit(panelH: number): void {
    if (!this._content) return;
    this._content.hitArea = new PIXI.Rectangle(0, 0, PANEL_W, panelH);
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
      ToastMessage.show(`当前场景不可用（${formatAllowedScenesShort(deco)}）`);
      return;
    }
    const isUnlocked = DecorationManager.isUnlocked(deco.id);
    const isPlaced = !!RoomLayoutManager.getPlacement(deco.id);
    if (isUnlocked) {
      this._goToPlaceDeco(deco.id);
      return;
    }
    const req = checkRequirement(deco.unlockRequirement);
    const adGateSatisfied = DecorationManager.isAdUnlockSatisfied(deco.id);
    const isAdGate = DecorationManager.isAdUnlockDeco(deco.id);
    const needsAdGate = isAdGate && req.met && !adGateSatisfied;
    if (!req.met) {
      if (
        deco.unlockRequirement?.questId === NEWBIE_GIFT_PACK_QUEST_ID
        && NewbieGiftPackManager.shouldShowEntry
      ) {
        EventBus.emit('panel:openNewbieGiftPack');
        return;
      }
      /** 实际点击收尾走 canvas pointerup → _finishGridScroll → 此处；微信小游戏上家具卡 pointertap 常不触发，勿依赖 */
      ToastMessage.show(decorationLockedToastText(deco.unlockRequirement, req));
      return;
    }
    if (needsAdGate) {
      void this._unlockDecoWithAd(deco);
      return;
    }
    this._purchaseDeco(deco, flyCard);
  }

  private _purchaseDeco(deco: DecoDef, flyCard: PIXI.Container): void {
    if (deco.cost > 0 && CurrencyManager.state.huayuan < deco.cost) {
      ToastMessage.show(`花愿不足，需要 ${deco.cost} 花愿`);
      return;
    }
    if (this._pendingDecoGrantStar) {
      ToastMessage.show('请稍候，星级正在飞入~');
      return;
    }
    const onShopScene = SceneManager.current?.name === 'shop';
    if (deco.starValue > 0 && onShopScene) {
      if (!DecorationManager.unlock(deco.id, { deferStarGrant: true })) {
        ToastMessage.show(`花愿不足，需要 ${deco.cost} 花愿`);
        return;
      }
      if (deco.cost > 0) AudioManager.play('purchase_tap');
      this._pendingDecoGrantStar = deco;
      this._emitShopStarFly(flyCard, deco.starValue);
      this._refreshAll();
    } else {
      if (!DecorationManager.unlock(deco.id)) {
        ToastMessage.show(DecorationManager.canPurchaseDeco(deco.id)
          ? `花愿不足，需要 ${deco.cost} 花愿`
          : '购买条件未满足');
        return;
      }
      if (deco.cost > 0) AudioManager.play('purchase_tap');
      this._emitShopStarFly(flyCard, deco.starValue);
      this._refreshAll();
      this._showNewDecoUnlockPopup(deco);
    }
  }

  private async _unlockDecoWithAd(deco: DecoDef): Promise<void> {
    const ok = await ConfirmDialog.show(
      '解锁购买资格',
      `观看广告解锁购买资格，之后仍需花愿购买。`,
      '免费解锁',
      '取消',
    );
    if (!ok) return;

    const adScene = PROMO_FURNITURE_AD_DECO_IDS.has(deco.id)
      ? AdScene.PROMO_FURNITURE_UNLOCK
      : AdScene.SPECIAL_DECO_UNLOCK;
    AdManager.showRewardedAd(adScene, (success) => {
      if (!success) {
        ToastMessage.show('广告未看完，未解锁');
        return;
      }
      if (!DecorationManager.unlockAdPurchaseGate(deco.id)) {
        ToastMessage.show('家具已不可解锁');
        return;
      }
      ToastMessage.show(`已解锁「${getDecoDisplayName(deco.id)}」购买资格`);
      this._refreshAll();
      this._showAdGateUnlockedPopup(deco);
    });
  }

  private _dismissUnlockPopup(): void {
    if (this._unlockOverlay) {
      this.removeChild(this._unlockOverlay);
      this._unlockOverlay.destroy({ children: true });
      this._unlockOverlay = null;
      this._unlockPlaceRoomHit = null;
      EventBus.emit('decoration:tutorialUnlockPopupClosed');
    }
  }

  /** 广告资格弹层：花愿说明行（居中） */
  private _layoutAdGatePurchaseHint(
    mount: PIXI.Container,
    deco: DecoDef,
    cx: number,
    y: number,
  ): number {
    const descStyle = {
      fontSize: 17,
      fill: 0x6a4a2f,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold' as const,
      stroke: 0xfffcf5,
      strokeThickness: 1.5,
    };
    if (deco.cost <= 0) {
      const desc = new PIXI.Text('现在可以免费领取', descStyle);
      desc.anchor.set(0.5, 0);
      desc.position.set(cx, y);
      mount.addChild(desc);
      return y + desc.height + 16;
    }
    const prefix = new PIXI.Text('需要 ', descStyle);
    const price = new PIXI.Text(String(deco.cost), descStyle);
    const suffix = new PIXI.Text(' 购买', descStyle);
    const gap = 5;
    const iconH = 22;
    let iconW = 0;
    let iconSp: PIXI.Sprite | undefined;
    const iconTex = TextureCache.get('icon_huayuan');
    if (iconTex?.width) {
      iconSp = new PIXI.Sprite(iconTex);
      iconSp.height = iconH;
      iconSp.width = (iconTex.width / iconTex.height) * iconH;
      iconW = iconSp.width;
    }
    const totalW =
      prefix.width + price.width + (iconW > 0 ? gap + iconW : 0) + suffix.width;
    const row = new PIXI.Container();
    row.position.set(cx - totalW / 2, y);
    let x = 0;
    prefix.position.set(x, 0);
    x += prefix.width;
    price.position.set(x, 0);
    x += price.width;
    if (iconSp) {
      iconSp.position.set(x + gap, (descStyle.fontSize - iconH) / 2);
      x += gap + iconW;
    }
    suffix.position.set(x, 0);
    row.addChild(prefix, price);
    if (iconSp) row.addChild(iconSp);
    row.addChild(suffix);
    mount.addChild(row);
    return y + Math.max(descStyle.fontSize, iconH) + 16;
  }

  /** 广告完成后：教程绘制壳体；购买资格已开，仍须花愿购入 */
  private _showAdGateUnlockedPopup(deco: DecoDef): void {
    this._dismissUnlockPopup();
    const W = DESIGN_WIDTH;
    const H = Game.logicHeight;

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

    const BTN_W = 148;
    const BTN_H = 54;
    const BTN_GAP = 14;
    const ICON_MAX = 108;
    const contentW = BTN_W * 2 + BTN_GAP;
    const contentH = 30 + ICON_MAX + 36 + BTN_H;

    const frame = createTutorialStyleModalFrame({
      viewW: W,
      viewH: H,
      title: '家具已解锁',
      contentWidth: contentW,
      contentHeight: contentH,
      onCloseTap: () => this._dismissUnlockPopup(),
    });
    root.addChild(frame.root);

    const mount = frame.contentMount;
    const cx = contentW / 2;
    let y = 0;

    const sub = new PIXI.Text(`「${getDecoDisplayName(deco.id)}」`, {
      fontSize: 19,
      fill: 0x5c4a3d,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: 0xfffcf5,
      strokeThickness: 2,
    });
    sub.anchor.set(0.5, 0);
    sub.position.set(cx, y);
    mount.addChild(sub);
    y += sub.height + 12;

    const tex = TextureCache.get(deco.icon);
    if (tex?.width) {
      const sp = new PIXI.Sprite(tex);
      const ms = Math.min(ICON_MAX / tex.width, ICON_MAX / tex.height);
      sp.scale.set(ms);
      sp.anchor.set(0.5, 0);
      sp.position.set(cx, y);
      mount.addChild(sp);
    }
    y += ICON_MAX + 10;

    y = this._layoutAdGatePurchaseHint(mount, deco, cx, y);

    this._addPastelModalButton(
      mount,
      '稍后',
      BTN_W / 2,
      y,
      BTN_W,
      BTN_H,
      'secondary',
      () => this._dismissUnlockPopup(),
    );
    const canBuyNow = deco.cost <= 0 || CurrencyManager.state.huayuan >= deco.cost;
    this._addPastelModalButton(
      mount,
      canBuyNow ? '直接购买' : '去购买',
      BTN_W + BTN_GAP + BTN_W / 2,
      y,
      BTN_W,
      BTN_H,
      'primary',
      () => {
        if (!canBuyNow && deco.cost > 0) {
          ToastMessage.show(`花愿不足，需要 ${deco.cost} 花愿`);
        }
        this._dismissUnlockPopup();
        if (canBuyNow) {
          this._purchaseDeco(deco, this);
          return;
        }
        this._decoInvFilter = 'not_purchased';
        this._scrollY = 0;
        this._refreshAll();
      },
    );
  }

  /** 与 ConfirmDialog 同款圆钮 */
  private _addPastelModalButton(
    parent: PIXI.Container,
    label: string,
    cx: number,
    topY: number,
    btnW: number,
    btnH: number,
    variant: 'primary' | 'secondary',
    onTap: () => void,
  ): PIXI.Container {
    const hit = new PIXI.Container();
    hit.position.set(cx, topY);
    hit.eventMode = 'static';
    hit.cursor = 'pointer';
    hit.hitArea = new PIXI.Rectangle(-btnW / 2, 0, btnW, btnH);

    const g = new PIXI.Graphics();
    const r = btnH / 2;
    if (variant === 'primary') {
      g.beginFill(COLORS.BUTTON_PRIMARY);
      g.drawRoundedRect(-btnW / 2, 0, btnW, btnH, r);
      g.endFill();
      g.lineStyle(2, 0xffffff, 0.58);
      g.drawRoundedRect(-btnW / 2 + 3, 3, btnW - 6, btnH - 6, r - 3);
    } else {
      g.beginFill(0xe8dff7, 0.98);
      g.drawRoundedRect(-btnW / 2, 0, btnW, btnH, r);
      g.endFill();
      g.lineStyle(2.5, 0xffffff, 0.85);
      g.drawRoundedRect(-btnW / 2 + 2.5, 2.5, btnW - 5, btnH - 5, Math.max(8, r - 4));
    }
    hit.addChild(g);

    const t = new PIXI.Text(label, {
      fontSize: 19,
      fill: variant === 'primary' ? 0xffffff : 0x6a4a2f,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: variant === 'primary' ? 0x8b4513 : 0xfffcf5,
      strokeThickness: variant === 'primary' ? 2 : 1.5,
    });
    t.anchor.set(0.5, 0.5);
    t.position.set(0, btnH / 2);
    hit.addChild(t);
    hit.on('pointertap', e => {
      e.stopPropagation();
      onTap();
    });
    parent.addChild(hit);
    return hit;
  }

  /** 购买成功后：教程绘制壳体，可立即进店摆放 */
  private _showNewDecoUnlockPopup(deco: DecoDef): void {
    this._dismissUnlockPopup();
    const W = DESIGN_WIDTH;
    const H = Game.logicHeight;

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

    const BTN_W = 148;
    const BTN_H = 54;
    const BTN_GAP = 14;
    const ICON_MAX = 116;
    const contentW = BTN_W * 2 + BTN_GAP;
    const contentH = 30 + ICON_MAX + 20 + BTN_H;

    const frame = createTutorialStyleModalFrame({
      viewW: W,
      viewH: H,
      title: '获得新家具',
      contentWidth: contentW,
      contentHeight: contentH,
      onCloseTap: () => this._dismissUnlockPopup(),
    });
    root.addChild(frame.root);

    const mount = frame.contentMount;
    const cx = contentW / 2;
    let y = 0;

    const sub = new PIXI.Text(`「${getDecoDisplayName(deco.id)}」`, {
      fontSize: 19,
      fill: 0x5c4a3d,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: 0xfffcf5,
      strokeThickness: 2,
    });
    sub.anchor.set(0.5, 0);
    sub.position.set(cx, y);
    mount.addChild(sub);
    y += sub.height + 14;

    const tex = TextureCache.get(deco.icon);
    if (tex?.width) {
      const sp = new PIXI.Sprite(tex);
      const ms = Math.min(ICON_MAX / tex.width, ICON_MAX / tex.height);
      sp.scale.set(ms);
      sp.anchor.set(0.5, 0);
      sp.position.set(cx, y);
      mount.addChild(sp);
    }
    y += ICON_MAX + 18;

    this._addPastelModalButton(
      mount,
      '稍后',
      BTN_W / 2,
      y,
      BTN_W,
      BTN_H,
      'secondary',
      () => this._dismissUnlockPopup(),
    );
    this._unlockPlaceRoomHit = this._addPastelModalButton(
      mount,
      '放入房间',
      BTN_W + BTN_GAP + BTN_W / 2,
      y,
      BTN_W,
      BTN_H,
      'primary',
      () => {
        this._dismissUnlockPopup();
        this._goToPlaceDeco(deco.id);
      },
    );

    if (TutorialManager.isActive && TutorialManager.currentStep === TutorialStep.GUIDE_BUY_FURNITURE) {
      EventBus.emit('decoration:tutorialUnlockPlaceReady');
    }
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
        if (
          style.id === 'style_qinglian_lotus_shop_nb2'
          && NewbieGiftPackManager.shouldShowEntry
        ) {
          EventBus.emit('panel:openNewbieGiftPack');
          return;
        }
        ToastMessage.show(`${requirementHintText(req)}`);
        return;
      }
      if (style.cost > 0 && CurrencyManager.state.huayuan < style.cost) {
        ToastMessage.show(`花愿不足，需要 ${style.cost} 花愿`);
        return;
      }
      if (DecorationManager.unlockRoomStyle(style.id)) {
        if (style.cost > 0) AudioManager.play('purchase_tap');
        DecorationManager.equipRoomStyle(style.id);
        this._emitShopStarFly(flyCard, style.starValue);
        ToastMessage.show(`已解锁「${style.name}」！`);
        this._refreshAll();
      } else {
        ToastMessage.show(`花愿不足，需要 ${style.cost} 花愿`);
      }
    }
  }

  // ─── utils ────────────────────────────────────────────────

  /** 网格重建后保留当前滚动位置（购买/刷新卡片时不跳回顶部） */
  private _restoreGridScrollAfterRebuild(): void {
    this._scrollY = Math.max(-this._maxScrollY, Math.min(0, this._scrollY));
    this._applyScroll();
  }

  private _applyScroll(): void {
    const inner = this._gridContainer.children[0] as PIXI.Container | undefined;
    if (inner) inner.y = this._scrollY;
  }
}
