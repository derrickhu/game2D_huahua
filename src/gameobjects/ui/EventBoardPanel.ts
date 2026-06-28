import * as PIXI from 'pixi.js';
import { Game } from '@/core/Game';
import { EventBus } from '@/core/EventBus';
import { TweenManager, Ease } from '@/core/TweenManager';
import { CellState } from '@/config/BoardLayout';
import { BoardMetrics, DESIGN_WIDTH, FONT_FAMILY } from '@/config/Constants';
import {
  EVENT_BOARD_COLS,
  EVENT_BOARD_MAX_TOTAL,
  EVENT_CODEX_ITEM_IDS,
  EVENT_KEY_BADGE_LEVELS,
  EVENT_PRODUCER_TOTAL_DROPS,
  isJewelryEventUnlocked,
  JEWELRY_EVENT_ID,
  JEWELRY_EVENT_UNLOCK_LEVEL,
  type EventProgressEchoMilestoneDef,
  type EventRewardDef,
} from '@/config/EventBoardConfig';
import {
  Category,
  CRYSTAL_BALL_ITEM_ID,
  GOLDEN_SCISSORS_ITEM_ID,
  ITEM_DEFS,
  LUCKY_COIN_ITEM_ID,
  getMergeResultId,
  isEventProducerItem,
} from '@/config/ItemConfig';
import { DECO_DEFS } from '@/config/DecorationConfig';
import { getOwnerChibiTextureKey, OUTFIT_MAP } from '@/config/DressUpConfig';
import { EventBoardManager, type EventMergeDropPlacement } from '@/managers/EventBoardManager';
import { LevelManager } from '@/managers/LevelManager';
import { CellView } from '@/gameobjects/board/CellView';
import { ItemView } from '@/gameobjects/board/ItemView';
import { TextureCache } from '@/utils/TextureCache';
import { AdManager, AdScene, type AdFailReason } from '@/managers/AdManager';
import { ConfirmDialog } from './ConfirmDialog';
import { ToastMessage } from './ToastMessage';
import { TutorialDialogBubble } from './TutorialDialogBubble';
import { SoundSystem } from '@/systems/SoundSystem';
import {
  layoutObtainStyleRewardBlock,
  type ItemObtainEntry,
} from '@/gameobjects/ui/ItemObtainOverlay';

const CELL = 104;
const GAP = 8;
const HEADER_H = 96;
/** 阶段信息条（横幅底图 + 仅叠绘进度条/图标）高度；新版长条需要更厚避免变形 */
const STAGE_CARD_H = 124;
/** 阶段信息条宽度：占满整个横向（横幅按此宽度横向拉伸填满） */
const STAGE_CARD_W = DESIGN_WIDTH - 16;
/** 背景图中部纯色面板（棋盘区）的上 / 下边界占图高比例（由底图实测） */
const PANEL_TOP_FRAC = 0.28;
const PANEL_BOTTOM_FRAC = 0.855;
/** 起拖判定：拖动超过该设计像素才算拖拽，否则按点击处理（货币双击领取） */
const DRAG_THRESHOLD = 10;
/** 货币块双击间隔（与主棋盘 BoardView 一致） */
const CURRENCY_DOUBLE_TAP_MS = 300;
/** 底部珠宝匣投放器尺寸 */
const DISPENSER_W = 168;
const DISPENSER_H = 142;
const DISPENSER_STONE_FIT = 64;
const DISPENSER_STONE_LOCAL_Y = 18;
/** 图鉴与进度回响入口：位于活动页左上装饰区，避开返回按钮与阶段横幅 */
const REWARD_CATALOG_BTN_SIZE = 78;
/** 阶段文字保持在横幅上方，避开背景分割线。 */
const STAGE_LABEL_ABOVE_CARD = 34;
/** 阶段条与上方图鉴/回响入口保持间距，避免真机 cover 缩放后互相遮挡。 */
const STAGE_CARD_TOP_ICON_GAP = 10;
/** 棋盘底边与底部珠宝匣保持间距。 */
const BOARD_TO_DISPENSER_GAP = 28;
/** 活动首屏优先资源：先保证关键 UI，不让整套活动图标拖慢首饰箱 / 背景出现。 */
const JEWELRY_EVENT_CRITICAL_KEYS: readonly string[] = [
  'event_board_bg',
  'event_stage_card_bg',
  'event_jewelry_casket',
  'event_portal_gate',
  'event_cell_fog',
  'event_cell_peek',
  'event_key_badge',
  'event_jewelry_reward_book_icon',
  'event_jewelry_codex_reward_icon',
  'event_jewelry_codex_panel_shell',
  'event_jewelry_codex_reward_panel_shell',
  'event_jewelry_1',
];

/**
 * 花间珠匣活动 —— 独立整页（铺满不透明背景 + 顶部返回栏）。
 *
 * 显示与交互完全复用主棋盘的成熟组件：
 *  - 每格用 `CellView`（格底 / 雾锁）+ `ItemView`（仅图片，无名称）按面板格尺寸缩放渲染；
 *  - 拖拽合成照搬主棋盘策略：pointerdown 走 PixiJS 容器事件，
 *    pointermove / pointerup 直接注册在 canvas 上（微信小游戏里 PixiJS 的
 *    move/up 注册在 window，触摸事件传不到，故必须监听 canvas）。
 */
export class EventBoardPanel extends PIXI.Container {
  private _bg!: PIXI.Graphics;
  private _bgImage!: PIXI.Sprite;
  private _bgTexUnsub: (() => void) | null = null;
  private _content!: PIXI.Container;
  private _shellLayer!: PIXI.Container;
  private _gridLayer!: PIXI.Container;
  private _ghostLayer!: PIXI.Container;
  private _codexLayer!: PIXI.Container;

  private _wrappers: PIXI.Container[] = [];
  private _cellViews: CellView[] = [];
  private _itemViews: ItemView[] = [];
  /** 半锁（PEEK）覆盖层：面板自管，不改 CellView/ItemView，避免影响主棋盘 */
  private _peekViews: PIXI.Container[] = [];
  /** 全锁（FOG）关闭首饰箱覆盖层：盖住整格 */
  private _fogViews: PIXI.Container[] = [];
  /** 时空门棋子覆盖层（仅门格显示） */
  private _portalViews: PIXI.Container[] = [];

  /** 内层缩放：主棋盘格尺寸 → 面板格尺寸 */
  private _cellScale = 1;
  /** 棋盘左上角在 content 本地坐标（== 设计坐标） */
  private _gridStartX = 0;
  private _gridStartY = 0;
  /** 背景图中部纯色面板（棋盘区）在设计坐标的上 / 下边界 */
  private _panelTopY = 0;
  private _panelBottomY = 0;
  /** 阶段信息卡顶部 Y / 实际宽高（宽高随纯色底图比例计算） */
  private _stageCardY = 0;
  private _stageCardW = STAGE_CARD_W;
  private _stageCardH = STAGE_CARD_H;

  private _dragSrcIndex = -1;
  private _dragItemId: string | null = null;
  private _dragStarted = false;
  private _dragStartDesign = { x: 0, y: 0 };
  private _dragGhost: ItemView | null = null;
  private _hoverIndex = -1;
  /** 货币块双击检测（与主棋盘一致） */
  private _lastCurrencyTapIndex = -1;
  private _lastCurrencyTapTime = 0;
  private _currencyTapTimer: ReturnType<typeof setTimeout> | null = null;

  /** 珠宝匣投放器根节点（用于飞行动画取起点） */
  private _dispenserRoot: PIXI.Container | null = null;
  /** 飞行动画进行中：目标格暂不显示物品，避免与飞行幽灵重叠 */
  private _flyStoneTargetIndex = -1;
  private _stoneFlyGhost: ItemView | null = null;
  private _stoneFlyAnim: { t: number } | null = null;
  /** placeStarterStone 同步 emit changed 期间，避免整页重绘打断飞行动画 */
  private _stonePlaceAnimating = false;
  private _codexPanelOpen = false;
  private _codexRewardPanelOpen = false;
  private _codexScrollY = 0;
  private _codexScrollListening = false;
  private _codexScrollStartDesignY = 0;
  private _codexScrollStartY = 0;
  private _codexScrollMaxY = 0;
  private _codexScroller: PIXI.Container | null = null;
  private _codexScrollerViewportY = 0;
  private _codexScrollViewport = { x: 0, y: 0, w: 0, h: 0 };
  private _codexCloseHit = { x: 0, y: 0, r: 0 };
  private _progressEchoAdRequesting = false;
  private _pendingProgressEchoClaim: { id: string; type: 'primary' | 'ad' } | null = null;
  private _codexRewardAssetsLoading = false;
  private _progressEchoRewardAssetsLoading = false;
  private _codexUnlockAnimating = false;
  private _codexRewardShowcasePlaying = false;
  private _pendingCodexRewardShowcases: { section: 'jewelry' | 'dian_cui'; reward: EventRewardDef }[] = [];
  private _starterStoneHint: TutorialDialogBubble | null = null;
  private _pendingProgressRevealItemIds: Set<string> = new Set();

  private _isOpen = false;

  constructor() {
    super();
    this.visible = false;
    this.zIndex = 5200;
    this._cellScale = CELL / BoardMetrics.cellSize;
    this._build();
    this._bindEvents();
    this._setupCanvasDrag();
    this._setupCanvasRewardCodexScroll();
  }

  open(): void {
    if (this._isOpen) return;
    if (!isJewelryEventUnlocked(LevelManager.level)) {
      ToastMessage.show(`花间珠匣将在 ${JEWELRY_EVENT_UNLOCK_LEVEL}级 开放`);
      return;
    }
    this._isOpen = true;
    this.visible = true;
    SoundSystem.playWorldMapBGM();
    this._clearDragGhost();
    this._content.alpha = 0;
    this._content.position.x = 40;

    const cachedBg = TextureCache.get('event_board_bg');
    if (cachedBg?.width) this._applyBgTexture(cachedBg);
    this._computeLayout();
    this._layoutWrappers();
    this._syncLockOverlays();
    this._refresh();
    TweenManager.to({ target: this._content, props: { alpha: 1 }, duration: 0.2, ease: Ease.easeOutQuad });
    TweenManager.to({ target: this._content.position, props: { x: 0 }, duration: 0.24, ease: Ease.easeOutQuad });

    void TextureCache.preloadEventKeys(JEWELRY_EVENT_ID, JEWELRY_EVENT_CRITICAL_KEYS).catch(err => {
      console.warn('[EventBoardPanel] 活动首屏资源预加载失败，已使用兜底绘制继续显示', err);
    }).finally(() => {
      if (!this._isOpen || this._dragSrcIndex >= 0) return;
      this._computeLayout();
      this._layoutWrappers();
      this._syncLockOverlays();
      this._refresh();
    });
    setTimeout(() => {
      requestAnimationFrame(() => {
        if (this._isOpen && this._dragSrcIndex < 0) {
          void TextureCache.preloadEventAssets(JEWELRY_EVENT_ID).catch(err => {
            console.warn('[EventBoardPanel] 活动资源后台预热失败', err);
          });
        }
      });
    }, 1600);
  }

  close(): void {
    if (!this._isOpen) return;
    this._isOpen = false;
    this._resetCurrencyTapDetect();
    this._hideStarterStoneHint();
    this._pendingProgressRevealItemIds.clear();
    this._pendingCodexRewardShowcases.length = 0;
    this._codexUnlockAnimating = false;
    this._codexRewardShowcasePlaying = false;
    this._hideRewardCodexPanel();
    this._clearDragGhost();
    this._clearStoneFly();
    this._flyStoneTargetIndex = -1;
    TweenManager.to({
      target: this._content,
      props: { alpha: 0 },
      duration: 0.14,
      ease: Ease.easeInQuad,
      onComplete: () => {
        this.visible = false;
        SoundSystem.resumeSceneBGMAfterWorldMap();
        EventBus.emit('panel:closeEventBoard');
      },
    });
  }

  private _bindEvents(): void {
    EventBus.on('panel:openEventBoard', () => this.open());
    EventBus.on('eventBoard:changed', () => {
      if (!this._isOpen || this._dragSrcIndex >= 0) return;
      // 原石飞行中仅刷新棋盘格与徽标，勿销毁珠宝匣节点
      if (this._stonePlaceAnimating || this._flyStoneTargetIndex >= 0) {
        this._refreshGrid();
        if (!this._stonePlaceAnimating) this._updateDispenserBadge();
        return;
      }
      this._refresh();
    });
    EventBus.on('eventBoard:starterStoneGranted', (_total: number, granted?: number) => {
      ToastMessage.show(`订单送来 ${Math.max(1, Math.floor(granted ?? 1))} 个原石`);
      if (this._isOpen && this._dragSrcIndex < 0) this._refresh();
    });
    EventBus.on('eventBoard:discovered', (itemId: string) => {
      const name = ITEM_DEFS.get(itemId)?.name ?? '新首饰';
      if (this._isOpen) {
        this._pendingProgressRevealItemIds.add(itemId);
        this._drawShell();
        this._playCodexUnlockFly(itemId, name);
      }
    });
    EventBus.on('eventBoard:codexSectionRewardAutoClaimed', (section: 'jewelry' | 'dian_cui', reward: EventRewardDef) => {
      if (!this._isOpen) return;
      this._pendingCodexRewardShowcases.push({ section, reward });
      this._playNextCodexRewardShowcase();
      if (this._codexPanelOpen) this._drawRewardCodexPanel();
    });
    EventBus.on('eventBoard:stageCompleted', (stage: { name: string }) => {
      ToastMessage.show(`${stage.name}完成，获得钥匙`);
    });
    EventBus.on('eventBoard:mergeDrop', (rewards: EventRewardDef[], placements?: EventMergeDropPlacement[]) => {
      if (!this._isOpen || !Array.isArray(rewards)) return;
      const label = rewards.map(r => this._rewardLabel(r)).filter(Boolean).join(' ');
      if (label) ToastMessage.show(`合成掉落：${label}`);
      if (Array.isArray(placements) && placements.length > 0) {
        window.setTimeout(() => this._playMergeRewardDrop(placements), 0);
      }
    });
  }

  private _rewardLabel(r: EventRewardDef): string {
    switch (r.kind) {
      case 'stamina': return `体力+${r.amount}`;
      case 'diamond': return `钻石+${r.amount}`;
      case 'huayuan': return `花愿+${r.amount}`;
      case 'flowerSignTickets': return `许愿硬币+${r.amount}`;
      case 'boxItem':
      case 'boxReward': {
        const name = ITEM_DEFS.get(r.itemId)?.name ?? '奖励';
        return r.count > 1 ? `${name}×${r.count}` : name;
      }
      case 'deco':
        return DECO_DEFS.find(d => d.id === r.decoId)?.name ?? '限定家具';
      case 'outfit':
        return OUTFIT_MAP.get(r.outfitId)?.name ?? '限定形象';
      default: return '';
    }
  }

  private _currencyCollectLabel(type?: 'stamina' | 'diamond' | 'huayuan'): string {
    switch (type) {
      case 'stamina': return '体力';
      case 'diamond': return '钻石';
      case 'huayuan': return '花愿';
      default: return '奖励';
    }
  }

  // ========== 构建 ==========

  private _build(): void {
    const H = Game.logicHeight;
    // 铺满整页的不透明背景（淡丁香渐层感，自带顶栏色带）；珠匣华丽底图加载后覆盖其上
    this._bg = new PIXI.Graphics();
    this._bg.beginFill(0xf3ecff, 1);
    this._bg.drawRect(0, 0, DESIGN_WIDTH, H);
    this._bg.endFill();
    this._bg.beginFill(0xe9dcff, 1);
    this._bg.drawRect(0, 0, DESIGN_WIDTH, Game.safeTop + HEADER_H);
    this._bg.endFill();
    // 拦截所有点击，避免穿透到底层主棋盘；整页不再点击空白关闭（用返回按钮）
    this._bg.eventMode = 'static';
    this._bg.on('pointerdown', e => e.stopPropagation());
    this.addChild(this._bg);

    // 珠匣华丽整页背景图（顶部金标题牌「花间珠匣」+ 中部纯色棋盘区 + 底部花纹）
    this._bgImage = new PIXI.Sprite();
    this._bgImage.eventMode = 'none';
    this._bgImage.visible = false;
    this.addChild(this._bgImage);
    this._bgTexUnsub = TextureCache.onTextureLoaded(key => {
      if (key === 'event_board_bg') this._applyBgTexture(TextureCache.get('event_board_bg'));
      // 阶段底图加载后需按其比例重算卡片宽高与棋盘起点，再整体刷新
      else if (key === 'event_stage_card_bg') {
        this._computeLayout();
        this._layoutWrappers();
        if (this._canRefreshShell()) this._refresh();
      }
      else if (
        key === 'event_jewelry_codex_panel_shell' ||
        key === 'event_jewelry_codex_reward_section_shell'
      ) {
        if (this._codexPanelOpen) this._drawRewardCodexPanel();
      }
      else if (key === 'event_jewelry_codex_reward_panel_shell') {
        if (this._codexRewardPanelOpen) this._drawCodexRewardMilestonePanel();
      }
      // 珠宝匣 / 进度条首饰图标等 shell 贴图：异步加载后须重绘整页壳层
      else if (
        key === 'event_jewelry_casket' ||
        key === 'event_key_badge' ||
        key === 'event_jewelry_reward_book_icon' ||
        key.startsWith('event_jewelry_')
      ) {
        if (this._canRefreshShell()) this._refresh();
        if (this._codexPanelOpen) this._drawRewardCodexPanel();
        if (this._codexRewardPanelOpen) this._drawCodexRewardMilestonePanel();
      }
      // 棋盘覆盖层贴图：正式锁格图加载完成后替换临时绘制图。
      else if (
        key === 'event_portal_gate' ||
        key === 'event_cell_fog' ||
        key === 'event_cell_peek' ||
        key === 'warehouse_slot_lock' ||
        key === 'cell_locked'
      ) {
        this._syncLockOverlays();
        if (this._isOpen && this._dragSrcIndex < 0) this._refreshGrid();
      }
    });

    this._content = new PIXI.Container();
    this.addChild(this._content);

    this._shellLayer = new PIXI.Container();
    this._gridLayer = new PIXI.Container();
    this._ghostLayer = new PIXI.Container();
    this._codexLayer = new PIXI.Container();
    this._content.addChild(this._shellLayer);
    this._content.addChild(this._gridLayer);
    this._content.addChild(this._ghostLayer);
    this._content.addChild(this._codexLayer);

    this._buildGrid();
  }

  private _canRefreshShell(): boolean {
    return (
      this._isOpen &&
      this._dragSrcIndex < 0 &&
      !this._stonePlaceAnimating &&
      this._flyStoneTargetIndex < 0
    );
  }

  /** 应用珠匣背景图：按"cover"铺满整屏并水平居中 */
  private _applyBgTexture(tex: PIXI.Texture | null): void {
    if (!tex || !this._bgImage) return;
    this._bgImage.texture = tex;
    const W = DESIGN_WIDTH;
    const H = Game.logicHeight;
    const scale = Math.max(W / tex.width, H / tex.height);
    this._bgImage.scale.set(scale);
    this._bgImage.position.set((W - tex.width * scale) / 2, 0);
    this._bgImage.visible = true;
    // 背景就绪后按面板区域重排棋盘 / 阶段卡
    this._computeLayout();
    this._layoutWrappers();
    if (this._isOpen) this._refresh();
  }

  /**
   * 计算棋盘 / 阶段卡布局：锚定到背景图中部纯色面板区域（往下放，避免压住金标题牌）。
   * 背景图未就绪时用兜底估算。
   */
  private _computeLayout(): void {
    let panelTop = Game.safeTop + HEADER_H + 150;
    let panelBottom = Game.logicHeight - 260;
    const tex = this._bgImage?.texture;
    if (tex && this._bgImage.visible && tex.height > 1) {
      const scale = this._bgImage.scale.y;
      const oy = this._bgImage.position.y;
      panelTop = oy + PANEL_TOP_FRAC * tex.height * scale;
      panelBottom = oy + PANEL_BOTTOM_FRAC * tex.height * scale;
    }
    this._panelTopY = panelTop;
    this._panelBottomY = panelBottom;

    // 阶段卡：占满整个横向（固定满宽 + 固定高度，横幅底图横向拉伸填满）
    this._stageCardW = STAGE_CARD_W;
    this._stageCardH = STAGE_CARD_H;

    const gridW = EVENT_BOARD_COLS * CELL + (EVENT_BOARD_COLS - 1) * GAP;
    const gridH = EventBoardManager.currentRows * CELL + (EventBoardManager.currentRows - 1) * GAP;
    const stageBaseY = panelTop - STAGE_CARD_H * 0.6;
    const topIconBottomY = Game.safeTop + HEADER_H + 112 + REWARD_CATALOG_BTN_SIZE;
    const minStageY = topIconBottomY + STAGE_CARD_TOP_ICON_GAP;
    const dispenserTopY = this._computeDispenserY() - DISPENSER_H / 2;
    const maxStageY = dispenserTopY
      - BOARD_TO_DISPENSER_GAP
      - (STAGE_CARD_H + 8 + gridH + 16);
    const stageY = Math.max(stageBaseY, minStageY);
    this._stageCardY = Math.round(maxStageY >= minStageY ? Math.min(stageY, maxStageY) : maxStageY);

    this._gridStartX = Math.round((DESIGN_WIDTH - gridW) / 2);
    this._gridStartY = Math.round(this._stageCardY + STAGE_CARD_H + 8);
  }

  /** 珠宝匣 Y：落在面板底边以下的花卉装饰带内（略低于纯色面板区） */
  private _computeDispenserY(): number {
    const H = Game.logicHeight;
    if (this._panelBottomY > 0) {
      // 面板底边再往下，进入底图花卉装饰区
      return Math.round(Math.min(this._panelBottomY + 62, H - DISPENSER_H * 0.32));
    }
    return Math.round(H - 96);
  }

  /** 背景图加载完成 / 布局变化后，重新摆放已建好的棋盘格 */
  private _layoutWrappers(): void {
    for (let idx = 0; idx < this._wrappers.length; idx++) {
      const col = idx % EVENT_BOARD_COLS;
      const row = Math.floor(idx / EVENT_BOARD_COLS);
      this._wrappers[idx].position.set(
        this._gridStartX + col * (CELL + GAP),
        this._gridStartY + row * (CELL + GAP),
      );
    }
  }

  /** 棋盘格只构建一次，刷新时仅更新 state / item，不销毁视图 */
  private _buildGrid(): void {
    this._computeLayout();

    for (let idx = 0; idx < EVENT_BOARD_MAX_TOTAL; idx++) {
      const col = idx % EVENT_BOARD_COLS;
      const row = Math.floor(idx / EVENT_BOARD_COLS);
      const wrapper = new PIXI.Container();
      wrapper.position.set(
        this._gridStartX + col * (CELL + GAP),
        this._gridStartY + row * (CELL + GAP),
      );
      wrapper.eventMode = 'static';
      wrapper.cursor = 'pointer';
      wrapper.hitArea = new PIXI.Rectangle(0, 0, CELL, CELL);
      wrapper.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
        e.stopPropagation();
        this._onCellDown(idx);
      });

      const cellView = new CellView(idx);
      cellView.scale.set(this._cellScale);
      wrapper.addChild(cellView);

      const itemView = new ItemView();
      itemView.scale.set(this._cellScale);
      wrapper.addChild(itemView);

      const peekView = this._createPeekOverlay();
      peekView.visible = false;
      wrapper.addChild(peekView);

      const fogView = this._createFogOverlay();
      fogView.visible = false;
      wrapper.addChild(fogView);

      const portalView = this._createPortalView();
      portalView.visible = false;
      wrapper.addChild(portalView);

      this._gridLayer.addChild(wrapper);
      this._wrappers.push(wrapper);
      this._cellViews.push(cellView);
      this._itemViews.push(itemView);
      this._peekViews.push(peekView);
      this._fogViews.push(fogView);
      this._portalViews.push(portalView);
    }
  }

  /** 时空门棋子覆盖层：门贴图 + 钥匙/锁角标（钥匙状态在刷新时切换） */
  private _createPortalView(): PIXI.Container {
    const c = new PIXI.Container();
    c.eventMode = 'none';

    const glow = new PIXI.Container();
    glow.name = 'glow';
    glow.visible = false;
    c.addChild(glow);

    const sp = new PIXI.Sprite(TextureCache.get('event_portal_gate') ?? PIXI.Texture.EMPTY);
    sp.anchor.set(0.5);
    sp.position.set(CELL / 2, CELL / 2);
    sp.name = 'gate';
    c.addChild(sp);
    const fallback = new PIXI.Graphics();
    fallback.name = 'gateFallback';
    c.addChild(fallback);

    // 门锁覆盖层：未获得钥匙时显示家具同款锁，获得钥匙后隐藏
    const badge = new PIXI.Graphics();
    badge.name = 'badgeBg';
    c.addChild(badge);
    const badgeIcon = new PIXI.Sprite(PIXI.Texture.EMPTY);
    badgeIcon.anchor.set(0.5);
    badgeIcon.name = 'badgeIcon';
    c.addChild(badgeIcon);
    return c;
  }

  /** 门锁贴图：使用装修面板同款锁 */
  private _portalBadgeIconTexture(hasKey: boolean): PIXI.Texture | null {
    if (hasKey) return null;
    const lockTex = TextureCache.get('warehouse_slot_lock') ?? TextureCache.get('cell_locked');
    return lockTex && lockTex.width > 1 ? lockTex : null;
  }

  /** 刷新门锁（无钥匙=门中心锁图标；有钥匙=移除锁），并补齐门贴图 */
  private _updatePortalBadge(view: PIXI.Container, hasKey: boolean): void {
    const badge = view.getChildByName('badgeBg') as PIXI.Graphics | null;
    const icon = view.getChildByName('badgeIcon') as PIXI.Sprite | null;
    const gate = view.getChildByName('gate') as PIXI.Sprite | null;
    const glow = view.getChildByName('glow') as PIXI.Container | null;
    const lockCx = CELL / 2;
    const lockCy = CELL / 2;
    if (glow) {
      glow.visible = hasKey;
      glow.removeChildren();
      if (hasKey) this._drawPortalReadyGlow(glow);
    }
    if (gate) {
      const tex = TextureCache.get('event_portal_gate');
      if (tex && gate.texture !== tex) gate.texture = tex;
      if (gate.texture && gate.texture.width > 1) {
        const fit = CELL * 0.98;
        gate.scale.set(Math.min(fit / gate.texture.width, fit / gate.texture.height));
      }
      const hasGateTexture = !!gate.texture && gate.texture.width > 1;
      gate.visible = hasGateTexture;
      gate.alpha = hasKey ? 1 : 0.82;
      const fallback = view.getChildByName('gateFallback') as PIXI.Graphics | null;
      if (fallback) {
        fallback.clear();
        fallback.visible = !hasGateTexture;
        if (!hasGateTexture) this._drawPortalFallbackGate(fallback, hasKey);
      }
    }
    if (badge) {
      badge.clear();
    }
    if (icon) {
      const tex = this._portalBadgeIconTexture(hasKey);
      if (tex) {
        icon.texture = tex;
        icon.visible = true;
        const fit = 34;
        icon.scale.set(Math.min(fit / tex.width, fit / tex.height));
        icon.position.set(lockCx, lockCy);
      } else {
        icon.visible = false;
      }
    }
  }

  private _drawPortalReadyGlow(target: PIXI.Container): void {
    const cx = CELL / 2;
    const cy = CELL / 2;
    const halo = new PIXI.Graphics();
    halo.beginFill(0xfff1a6, 0.28);
    halo.drawCircle(cx, cy, CELL * 0.46);
    halo.endFill();
    halo.beginFill(0xffffff, 0.18);
    halo.drawCircle(cx, cy, CELL * 0.32);
    halo.endFill();
    target.addChild(halo);

    const sparkle = new PIXI.Graphics();
    sparkle.lineStyle(3, 0xffffff, 0.55);
    sparkle.moveTo(cx - 28, cy);
    sparkle.lineTo(cx + 28, cy);
    sparkle.moveTo(cx, cy - 28);
    sparkle.lineTo(cx, cy + 28);
    sparkle.lineStyle(2, 0xffe082, 0.46);
    sparkle.moveTo(cx - 18, cy - 18);
    sparkle.lineTo(cx + 18, cy + 18);
    sparkle.moveTo(cx + 18, cy - 18);
    sparkle.lineTo(cx - 18, cy + 18);
    target.addChild(sparkle);
  }

  private _drawPortalFallbackGate(target: PIXI.Graphics, hasKey: boolean): void {
    const cx = CELL / 2;
    const cy = CELL / 2;
    target.beginFill(0x6ed7d2, hasKey ? 0.95 : 0.72);
    target.lineStyle(4, 0x7a5aaf, 0.95);
    target.drawRoundedRect(cx - 28, cy - 36, 56, 72, 16);
    target.endFill();
    target.beginFill(0xeefcff, hasKey ? 0.45 : 0.28);
    target.drawEllipse(cx, cy - 4, 18, 27);
    target.endFill();
    target.lineStyle(3, 0xffdc7c, 0.9);
    target.drawCircle(cx, cy, 23);
  }

  /** 半锁格覆盖层：紫色缎带（上半透明露出压着的物品） */
  private _createPeekOverlay(): PIXI.Container {
    const c = new PIXI.Container();
    c.eventMode = 'none';
    this._applyPeekOverlaySprite(c);
    return c;
  }

  /** 全锁格覆盖层：关闭首饰箱盖住格子 */
  private _createFogOverlay(): PIXI.Container {
    const c = new PIXI.Container();
    c.eventMode = 'none';
    this._applyFogOverlaySprite(c);
    return c;
  }

  /** 刷新所有锁格覆盖层；正式 PNG 未就绪时才用程序绘制兜底。 */
  private _syncLockOverlays(): void {
    for (const view of this._peekViews) this._applyPeekOverlaySprite(view);
    for (const view of this._fogViews) this._applyFogOverlaySprite(view);
  }

  private _applyPeekOverlaySprite(container: PIXI.Container): void {
    const tex = TextureCache.get('event_cell_peek');
    if (tex && tex.width > 1) {
      let sp = container.getChildByName('lockOverlay') as PIXI.Sprite | null;
      if (!sp) {
        container.removeChildren();
        sp = new PIXI.Sprite(tex);
        sp.name = 'lockOverlay';
        container.addChild(sp);
      } else {
        sp.texture = tex;
      }
      sp.anchor.set(0, 0);
      sp.width = CELL;
      sp.height = CELL;
      sp.position.set(0, 0);
      return;
    }
    if (container.getChildByName('lockOverlay') || container.getChildByName('lockFallback')) return;
    container.removeChildren();
    const r = Math.max(4, Math.round(CELL * 0.08));
    const dim = new PIXI.Graphics();
    dim.name = 'lockFallback';
    dim.beginFill(0x9b78d6, 0.5);
    dim.drawRoundedRect(0, CELL * 0.45, CELL, CELL * 0.55, r);
    dim.endFill();
    container.addChild(dim);
  }

  private _applyFogOverlaySprite(container: PIXI.Container): void {
    const tex = TextureCache.get('event_cell_fog');
    if (tex && tex.width > 1) {
      let sp = container.getChildByName('lockOverlay') as PIXI.Sprite | null;
      if (!sp) {
        container.removeChildren();
        sp = new PIXI.Sprite(tex);
        sp.name = 'lockOverlay';
        container.addChild(sp);
      } else {
        sp.texture = tex;
      }
      const fit = CELL * 1.02;
      sp.anchor.set(0.5);
      sp.scale.set(Math.min(fit / tex.width, fit / tex.height));
      sp.position.set(CELL / 2, CELL / 2);
      return;
    }
    if (container.getChildByName('lockOverlay') || container.getChildByName('lockFallback')) return;
    container.removeChildren();
    const r = Math.max(4, Math.round(CELL * 0.08));
    const g = new PIXI.Graphics();
    g.name = 'lockFallback';
    g.beginFill(0x8a6bd0, 0.92);
    g.drawRoundedRect(2, 2, CELL - 4, CELL - 4, r);
    g.endFill();
    container.addChild(g);
  }

  // ========== 刷新 ==========

  private _refresh(): void {
    this._drawShell();
    this._refreshGrid();
  }

  private _refreshGrid(): void {
    this._syncLockOverlays();
    const cells = EventBoardManager.cells;
    const hasKey = EventBoardManager.keys > 0;
    const total = EventBoardManager.currentTotal;
    for (let i = 0; i < this._cellViews.length; i++) {
      // 超出本层棋盘格数的视图整体隐藏（后期层 6×7 才用满）
      if (i >= total) {
        this._wrappers[i].visible = false;
        continue;
      }
      this._wrappers[i].visible = true;
      const cell = cells[i];
      const cellView = this._cellViews[i];
      const itemView = this._itemViews[i];
      const peekView = this._peekViews[i];
      const fogView = this._fogViews[i];
      const portalView = this._portalViews[i];
      this._wrappers[i].scale.set(1);
      cellView.setMergePartnerHint(false);
      if (!cell) {
        cellView.setState(CellState.FOG);
        itemView.setItem(null);
        if (peekView) peekView.visible = false;
        if (fogView) fogView.visible = false;
        if (portalView) portalView.visible = false;
        continue;
      }
      // 时空门格：显示门棋子，不显示普通物品
      if (cell.isPortal) {
        cellView.setState(CellState.OPEN);
        itemView.setItem(null);
        itemView.alpha = 1;
        if (peekView) peekView.visible = false;
        if (fogView) fogView.visible = false;
        if (portalView) {
          portalView.visible = true;
          this._updatePortalBadge(portalView, hasKey);
        }
        continue;
      }
      if (portalView) portalView.visible = false;
      // 全锁格：底格保持 OPEN，不用主棋盘 cell_locked；首饰箱 overlay 盖住
      const isFog = cell.state === CellState.FOG;
      cellView.setState(isFog ? CellState.OPEN : cell.state);
      itemView.snapToCellLayout();
      // 半锁格也显示压着的物品（正常不透明），紫色缎带 overlay 提示需合成解锁
      const showItem = cell.state === CellState.OPEN || cell.state === CellState.PEEK;
      itemView.setItem(showItem ? cell.itemId : null);
      const isEventProducer = showItem && !!cell.itemId && isEventProducerItem(cell.itemId);
      if (isEventProducer) {
        itemView.setUsesLeft(cell.chestQueue?.length ?? EVENT_PRODUCER_TOTAL_DROPS);
      } else {
        itemView.setUsesLeft(0);
      }
      // 与主棋盘 BoardView 一致：宝箱/红包待散落件数不在格子上显示金色角标
      itemView.setChestDispatch(0, 0);
      itemView.alpha = 1;
      // 飞行动画进行中：落点格先不显示，避免与飞行幽灵重叠
      if (this._flyStoneTargetIndex === i) itemView.setItem(null);
      if (peekView) peekView.visible = cell.state === CellState.PEEK;
      if (fogView) fogView.visible = isFog;
    }
  }

  private _drawShell(): void {
    this._dispenserRoot = null;
    while (this._shellLayer.children.length > 0) {
      const child = this._shellLayer.children[0];
      this._shellLayer.removeChild(child);
      child.destroy({ children: true });
    }

    const top = Game.safeTop;
    const H = Game.logicHeight;

    // ---- 顶部返回栏（标题「花间珠匣」已在背景图金标题牌中，不再重复绘制） ----
    this._drawBackButton(56, top + HEADER_H / 2);
    this._drawRewardCatalogButton();
    this._drawStageNumberLabel();

    // ---- 棋盘外框底板（格子由 _gridLayer 渲染）----
    this._drawBoardBackdrop();

    // ---- 阶段信息卡（木牌，上移到面板顶部色带；绘制在底板之上避免被压边）----
    this._drawStageCard(this._stageCardY);

    // ---- 底部操作区 ----
    this._drawActions();
  }

  private _drawBackButton(cx: number, cy: number): void {
    const root = new PIXI.Container();
    root.position.set(cx, cy);
    root.eventMode = 'static';
    root.cursor = 'pointer';
    root.hitArea = new PIXI.Circle(0, 0, 40);
    root.on('pointerdown', e => {
      e.stopPropagation();
      this.close();
    });
    this._shellLayer.addChild(root);

    const circle = new PIXI.Graphics();
    circle.beginFill(0xffffff, 0.92);
    circle.lineStyle(3, 0xcaa6ff, 1);
    circle.drawCircle(0, 0, 32);
    circle.endFill();
    root.addChild(circle);

    const arrow = new PIXI.Graphics();
    arrow.lineStyle(5, 0x8a5cc8, 1);
    arrow.moveTo(8, -12);
    arrow.lineTo(-8, 0);
    arrow.lineTo(8, 12);
    root.addChild(arrow);
  }

  /** 珠宝图鉴入口：只放图标，具体红点 / 进度由后续奖励页逻辑叠绘 */
  private _drawRewardCatalogButton(): void {
    const size = REWARD_CATALOG_BTN_SIZE;
    const x = 108;
    const y = Math.max(Game.safeTop + HEADER_H + 112, this._stageCardY - size - 18);

    const root = new PIXI.Container();
    root.position.set(x, y);
    root.eventMode = 'static';
    root.cursor = 'pointer';
    root.hitArea = new PIXI.RoundedRectangle(-22, -18, size + 48, size + 58, 22);
    const openPanel = (e: PIXI.FederatedPointerEvent): void => {
      e.stopPropagation();
      if (this._codexPanelOpen) return;
      this._showRewardCodexPanel();
    };
    root.on('pointerdown', openPanel);
    root.on('pointertap', openPanel);
    this._shellLayer.addChild(root);

    const shadow = new PIXI.Graphics();
    shadow.beginFill(0x6b4c78, 0.2);
    shadow.drawEllipse(size / 2, size - 4, size * 0.36, size * 0.11);
    shadow.endFill();
    root.addChild(shadow);

    const tex = TextureCache.get('event_jewelry_reward_book_icon');
    if (tex && tex.width > 1) {
      const icon = new PIXI.Sprite(tex);
      const fit = size;
      icon.anchor.set(0.5);
      icon.scale.set(Math.min(fit / tex.width, fit / tex.height));
      icon.position.set(size / 2, size / 2);
      root.addChild(icon);
    } else {
      const book = new PIXI.Graphics();
      book.beginFill(0xf58c8f, 1);
      book.lineStyle(4, 0x8b4a42, 1);
      book.drawRoundedRect(10, 8, 58, 64, 10);
      book.endFill();
      book.beginFill(0xffd574, 1);
      book.drawCircle(40, 40, 14);
      book.endFill();
      root.addChild(book);
    }
    this._drawRewardCatalogProgress(root, size);
    if (EventBoardManager.hasClaimableDiscoveryReward) {
      this._drawRewardCatalogNotice(root, size - 2, 4);
    }
    this._drawCodexRewardMilestoneButton(x + size + 26, y);
  }

  private _drawCodexRewardMilestoneButton(x: number, y: number): void {
    const size = REWARD_CATALOG_BTN_SIZE;
    const root = new PIXI.Container();
    root.position.set(x, y);
    root.eventMode = 'static';
    root.cursor = 'pointer';
    root.hitArea = new PIXI.RoundedRectangle(-10, -8, size + 28, size + 28, 16);
    root.on('pointerdown', e => {
      e.stopPropagation();
      this._showCodexRewardMilestonePanel();
    });
    this._shellLayer.addChild(root);

    const shadow = new PIXI.Graphics();
    shadow.beginFill(0x6b4c78, 0.22);
    shadow.drawEllipse(size / 2, size - 3, size * 0.38, size * 0.11);
    shadow.endFill();
    root.addChild(shadow);

    const tex = TextureCache.get('event_jewelry_codex_reward_icon');
    if (tex && tex.width > 1) {
      const icon = new PIXI.Sprite(tex);
      icon.anchor.set(0.5);
      const fit = size * 1.48;
      icon.scale.set(Math.min(fit / tex.width, fit / tex.height));
      icon.position.set(size / 2, size / 2);
      root.addChild(icon);
    } else {
      const box = new PIXI.Graphics();
      box.beginFill(0xd7a8f0, 1);
      box.lineStyle(4, 0x8b5f42, 1);
      box.drawRoundedRect(10, 18, size - 20, size - 24, 12);
      box.endFill();
      box.beginFill(0xffd36f, 1);
      box.drawCircle(size / 2, size * 0.62, 12);
      box.endFill();
      root.addChild(box);
    }

    if (EventBoardManager.hasClaimableProgressEchoReward) {
      this._drawRewardCatalogNotice(root, size - 4, 4);
    }
  }

  private _drawRewardCatalogProgress(root: PIXI.Container, size: number): void {
    const total = Math.max(1, EventBoardManager.codexTotalCount);
    const current = Math.max(0, Math.min(total, EventBoardManager.codexDiscoveredCount));
    const w = 102;
    const h = 20;
    const x = Math.round((size - w) / 2);
    const y = size - 3;
    const innerPad = 3;
    const fillW = Math.max(0, Math.round((w - innerPad * 2) * current / total));
    const r = h / 2;

    const bg = new PIXI.Graphics();
    bg.beginFill(0x7c5a74, 0.18);
    bg.drawRoundedRect(x + 1, y + 2, w, h, r);
    bg.endFill();
    bg.beginFill(0xfff2c9, 0.98);
    bg.lineStyle(2, 0xff91a6, 1);
    bg.drawRoundedRect(x, y, w, h, r);
    bg.endFill();
    bg.lineStyle(1, 0xffffff, 0.85);
    bg.drawRoundedRect(x + 2, y + 2, w - 4, h - 4, r - 2);

    if (fillW > 0) {
      const fillR = Math.min(r - innerPad, fillW / 2);
      bg.beginFill(0xffc95f, 1);
      bg.drawRoundedRect(x + innerPad, y + innerPad, fillW, h - innerPad * 2, fillR);
      bg.endFill();
      bg.beginFill(0xffe39a, 0.78);
      bg.drawRoundedRect(x + innerPad + 2, y + innerPad + 2, Math.max(0, fillW - 4), Math.max(2, (h - innerPad * 2) * 0.36), fillR * 0.7);
      bg.endFill();
    }
    root.addChild(bg);

    const label = new PIXI.Text(`${current}/${total}`, {
      fontSize: 14,
      fill: 0x7b4b3a,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: 0xfff8e7,
      strokeThickness: 3,
    });
    label.anchor.set(0.5);
    label.position.set(size / 2, y + h / 2 + 1);
    root.addChild(label);
  }

  private _drawRewardCatalogNotice(root: PIXI.Container, x: number, y: number): void {
    const badge = new PIXI.Graphics();
    badge.beginFill(0xff4f64, 1);
    badge.lineStyle(3, 0xffffff, 1);
    badge.drawCircle(x, y, 14);
    badge.endFill();
    root.addChild(badge);

    const mark = new PIXI.Text('!', {
      fontSize: 20,
      fill: 0xffffff,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    mark.anchor.set(0.5);
    mark.position.set(x, y + 1);
    root.addChild(mark);
  }

  private _showRewardCodexPanel(): void {
    this._hideStarterStoneHint();
    this._hideCodexRewardMilestonePanel();
    this._codexPanelOpen = true;
    this._drawRewardCodexPanel();
  }

  private _hideRewardCodexPanel(): void {
    this._finishRewardCodexScroll();
    this._codexScroller = null;
    this._codexScrollMaxY = 0;
    this._codexScrollViewport = { x: 0, y: 0, w: 0, h: 0 };
    this._codexCloseHit = { x: 0, y: 0, r: 0 };
    this._codexPanelOpen = false;
    this._codexRewardPanelOpen = false;
    while (this._codexLayer.children.length > 0) {
      const child = this._codexLayer.children[0];
      this._codexLayer.removeChild(child);
      child.destroy({ children: true });
    }
  }

  private _showCodexRewardMilestonePanel(): void {
    this._hideStarterStoneHint();
    this._hideRewardCodexPanel();
    this._codexRewardPanelOpen = true;
    this._drawCodexRewardMilestonePanel();
    requestAnimationFrame(() => {
      if (this._isOpen && this._codexRewardPanelOpen) this._ensureProgressEchoRewardAssets();
    });
  }

  private _hideCodexRewardMilestonePanel(): void {
    if (!this._codexRewardPanelOpen && this._codexLayer.children.length === 0) return;
    this._finishRewardCodexScroll();
    this._codexScroller = null;
    this._codexScrollMaxY = 0;
    this._codexScrollViewport = { x: 0, y: 0, w: 0, h: 0 };
    this._codexCloseHit = { x: 0, y: 0, r: 0 };
    this._codexRewardPanelOpen = false;
    while (this._codexLayer.children.length > 0) {
      const child = this._codexLayer.children[0];
      this._codexLayer.removeChild(child);
      child.destroy({ children: true });
    }
  }

  /** 进度回响页空壳：后续在中间空白区绘制一条条达标奖励。 */
  private _drawCodexRewardMilestonePanel(): void {
    this._codexRewardPanelOpen = true;
    while (this._codexLayer.children.length > 0) {
      const child = this._codexLayer.children[0];
      this._codexLayer.removeChild(child);
      child.destroy({ children: true });
    }

    const blocker = new PIXI.Graphics();
    blocker.beginFill(0x000000, 0.34);
    blocker.drawRect(0, 0, DESIGN_WIDTH, Game.logicHeight);
    blocker.endFill();
    blocker.eventMode = 'static';
    blocker.on('pointerdown', e => {
      e.stopPropagation();
      this._hideCodexRewardMilestonePanel();
    });
    this._codexLayer.addChild(blocker);

    const shellTex = TextureCache.get('event_jewelry_codex_reward_panel_shell');
    if (shellTex && shellTex.width > 1) {
      const shell = new PIXI.Sprite(shellTex);
      const scale = Math.min((DESIGN_WIDTH * 0.94) / shellTex.width, (Game.logicHeight * 0.88) / shellTex.height);
      shell.scale.set(scale);
      shell.anchor.set(0.5);
      shell.position.set(DESIGN_WIDTH / 2, Game.logicHeight / 2 + 18);
      this._codexLayer.addChild(shell);

      const shellW = shellTex.width * scale;
      const shellH = shellTex.height * scale;
      const shellHit = new PIXI.Container();
      shellHit.eventMode = 'static';
      shellHit.hitArea = new PIXI.Rectangle(shell.position.x - shellW / 2, shell.position.y - shellH / 2, shellW, shellH);
      shellHit.on('pointerdown', e => e.stopPropagation());
      this._codexLayer.addChild(shellHit);

      const closeX = shell.position.x + shellW * 0.43;
      const closeY = shell.position.y - shellH * 0.34;
      this._drawProgressEchoMilestones(shell.position.x, shell.position.y, shellW, shellH);
      this._drawCodexRewardMilestoneCloseHit(closeX, closeY, Math.max(64, shellW * 0.11));
    } else {
      const fallback = new PIXI.Graphics();
      fallback.beginFill(0xfdf2de, 1);
      fallback.lineStyle(4, 0x4db7bd, 1);
      fallback.drawRoundedRect(58, Game.safeTop + 120, DESIGN_WIDTH - 116, Game.logicHeight - Game.safeTop - 220, 30);
      fallback.endFill();
      this._codexLayer.addChild(fallback);
      this._codexCloseHit = { x: DESIGN_WIDTH - 58, y: Game.safeTop + 184, r: 58 };
      this._drawProgressEchoMilestones(DESIGN_WIDTH / 2, Game.logicHeight / 2, DESIGN_WIDTH - 116, Game.logicHeight - Game.safeTop - 220);
      this._drawCodexRewardMilestoneCloseHit(DESIGN_WIDTH - 58, Game.safeTop + 184, 64);
    }
  }

  private _drawCodexRewardMilestoneCloseHit(x: number, y: number, r: number): void {
    this._codexCloseHit = { x, y, r };
    const closeHit = new PIXI.Container();
    closeHit.position.set(x, y);
    closeHit.eventMode = 'static';
    closeHit.cursor = 'pointer';
    closeHit.zIndex = 10000;
    closeHit.hitArea = new PIXI.Rectangle(-r, -r, r * 2, r * 2);
    closeHit.on('pointerdown', e => {
      e.stopPropagation();
      this._hideCodexRewardMilestonePanel();
    });
    this._codexLayer.addChild(closeHit);
    this._codexLayer.sortChildren();
  }

  private _drawProgressEchoMilestones(shellCx: number, shellCy: number, shellW: number, shellH: number): void {
    const milestones = EventBoardManager.progressEchoMilestones;
    const listW = shellW * 0.82;
    const rowH = Math.min(116, shellH * 0.088);
    const gap = Math.max(14, shellH * 0.014);
    const x = shellCx - listW / 2;
    const viewportW = shellW * 0.84;
    const viewportH = shellH * 0.43;
    const viewportX = shellCx - viewportW / 2;
    const viewportY = shellCy - shellH * 0.2;
    const contentH = milestones.length * rowH + Math.max(0, milestones.length - 1) * gap;
    const maxScroll = Math.max(0, contentH - viewportH);
    this._codexScrollY = Math.max(0, Math.min(maxScroll, this._codexScrollY));
    this._codexScrollViewport = { x: viewportX, y: viewportY, w: viewportW, h: viewportH };
    this._codexScrollMaxY = maxScroll;

    const mask = new PIXI.Graphics();
    mask.beginFill(0xffffff, 1);
    mask.drawRoundedRect(viewportX, viewportY, viewportW, viewportH, 18);
    mask.endFill();
    this._codexLayer.addChild(mask);

    const scroller = new PIXI.Container();
    scroller.position.set(0, viewportY - this._codexScrollY);
    scroller.mask = mask;
    this._codexLayer.addChild(scroller);
    this._codexScroller = scroller;
    this._codexScrollerViewportY = viewportY;

    for (let i = 0; i < milestones.length; i++) {
      const milestone = milestones[i];
      this._drawProgressEchoMilestoneRow(scroller, x, i * (rowH + gap), listW, rowH, milestone);
    }
  }

  private _drawProgressEchoMilestoneRow(
    target: PIXI.Container,
    x: number,
    y: number,
    w: number,
    h: number,
    milestone: EventProgressEchoMilestoneDef,
  ): void {
    const completed = EventBoardManager.isProgressEchoCompleted(milestone);
    const current = EventBoardManager.progressEchoCurrentValue(milestone);
    const targetValue = EventBoardManager.progressEchoTargetValue(milestone);

    const bg = new PIXI.Graphics();
    bg.beginFill(completed ? 0xf7fff5 : 0xfffbf2, 0.96);
    bg.lineStyle(2, completed ? 0x72c6a0 : 0xe5c6a4, 0.9);
    bg.drawRoundedRect(x, y, w, h, 16);
    bg.endFill();
    target.addChild(bg);

    this._drawProgressEchoObjective(target, x + 24, y + h * 0.32, milestone, completed);

    const progress = new PIXI.Text(`${Math.min(current, targetValue)}/${targetValue}`, {
      fontSize: 18,
      fill: completed ? 0x3a9b72 : 0x9a7a60,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    progress.anchor.set(0, 0.5);
    progress.position.set(x + 24, y + h * 0.68);
    target.addChild(progress);

    const rewardW = 150;
    const gapX = 12;
    const adX = x + w - rewardW - 18;
    const primaryX = adX - rewardW - gapX;
    this._drawProgressEchoRewardCell(target, primaryX, y + 12, rewardW, h - 24, milestone, 'primary');
    this._drawProgressEchoRewardCell(target, adX, y + 12, rewardW, h - 24, milestone, 'ad');
  }

  private _drawProgressEchoObjective(
    target: PIXI.Container,
    x: number,
    y: number,
    milestone: EventProgressEchoMilestoneDef,
    completed: boolean,
  ): void {
    const fill = completed ? 0x3a7b68 : 0x7b5b42;
    if (milestone.objective.kind !== 'item_discovered') {
      const title = new PIXI.Text(milestone.title, {
        fontSize: 21,
        fill,
        fontFamily: FONT_FAMILY,
        fontWeight: 'bold',
        stroke: 0xffffff,
        strokeThickness: 3,
      });
      title.anchor.set(0, 0.5);
      title.position.set(x, y);
      target.addChild(title);
      return;
    }

    const label = new PIXI.Text('解锁', {
      fontSize: 21,
      fill,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: 0xffffff,
      strokeThickness: 3,
    });
    label.anchor.set(0, 0.5);
    label.position.set(x, y);
    target.addChild(label);

    const itemId = milestone.objective.itemId;
    const tex = TextureCache.get(itemId);
    if (tex && tex.width > 1) {
      const icon = new PIXI.Sprite(tex);
      icon.anchor.set(0.5);
      icon.scale.set(Math.min(42 / tex.width, 42 / tex.height));
      icon.position.set(x + 82, y);
      icon.alpha = completed ? 1 : 0.72;
      target.addChild(icon);
      return;
    }

    const fallbackName = ITEM_DEFS.get(itemId)?.name ?? '首饰';
    const fallback = new PIXI.Text(fallbackName, {
      fontSize: 18,
      fill,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: 0xffffff,
      strokeThickness: 3,
    });
    fallback.anchor.set(0, 0.5);
    fallback.position.set(x + 58, y);
    target.addChild(fallback);
  }

  private _drawProgressEchoRewardCell(
    target: PIXI.Container,
    x: number,
    y: number,
    w: number,
    h: number,
    milestone: EventProgressEchoMilestoneDef,
    type: 'primary' | 'ad',
  ): void {
    const reward = type === 'primary' ? milestone.primaryReward : milestone.adReward;
    const completed = EventBoardManager.isProgressEchoCompleted(milestone);
    const claimed = type === 'primary'
      ? EventBoardManager.isProgressEchoPrimaryClaimed(milestone.id)
      : EventBoardManager.isProgressEchoAdClaimed(milestone.id);
    const claimable = completed && !claimed;

    const typeLabelText = this._progressEchoRewardTypeLabel(reward);
    const iconFit = typeLabelText ? 52 : 58;
    const iconCx = typeLabelText ? x + w * 0.5 : x + w * 0.34;
    const amountX = typeLabelText ? x + w * 0.74 : x + w * 0.57;
    if (typeLabelText) {
      const typeLabel = new PIXI.Text(typeLabelText, {
        fontSize: 17,
        fill: completed || claimed ? 0x7b4c32 : 0xa28b76,
        fontFamily: FONT_FAMILY,
        fontWeight: 'bold',
        stroke: 0xffffff,
        strokeThickness: 2,
      });
      typeLabel.anchor.set(0.5);
      typeLabel.position.set(x + w * 0.17, y + 25);
      typeLabel.alpha = completed || claimed ? 1 : 0.55;
      target.addChild(typeLabel);
    }

    const iconKey = this._rewardIconKey(reward);
    const tex = TextureCache.get(iconKey);
    if (tex && tex.width > 1) {
      const icon = new PIXI.Sprite(tex);
      icon.anchor.set(0.5);
      icon.scale.set(Math.min(iconFit / tex.width, iconFit / tex.height));
      icon.position.set(iconCx, y + 25);
      icon.alpha = completed || claimed ? 1 : 0.55;
      target.addChild(icon);
    }

    const amount = new PIXI.Text(`x${this._rewardAmount(reward)}`, {
      fontSize: 19,
      fill: completed || claimed ? 0x6b4b35 : 0xa28b76,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: 0xffffff,
      strokeThickness: 2,
    });
    amount.anchor.set(0, 0.5);
    amount.position.set(amountX, y + 25);
    target.addChild(amount);

    const btnH = 34;
    const btnY = y + h - btnH;
    const btn = new PIXI.Graphics();
    const fill = claimed ? 0xa6d9a7 : claimable ? (type === 'ad' ? 0x6bbbd1 : 0xffcf75) : 0xd2c9bd;
    btn.beginFill(fill, 1);
    btn.lineStyle(2, 0xffffff, 0.95);
    btn.drawRoundedRect(x + 4, btnY, w - 8, btnH, 12);
    btn.endFill();
    target.addChild(btn);

    const btnText = claimed ? '已领取' : claimable ? (type === 'ad' ? '看广告领取' : '领取') : '未完成';
    const label = new PIXI.Text(btnText, {
      fontSize: type === 'ad' ? 14 : 16,
      fill: claimed ? 0x2f7d42 : claimable ? 0x6b4b35 : 0x8d7f72,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    label.anchor.set(0.5);
    label.position.set(x + w / 2, btnY + btnH / 2 + 1);
    target.addChild(label);

    if (claimed) {
      this._drawRewardCodexClaimCheck(target, x + w - 8, y + 5, 26);
      return;
    }
    if (!claimable) return;

    const hit = new PIXI.Container();
    hit.position.set(x, y);
    hit.eventMode = 'static';
    hit.cursor = 'pointer';
    hit.hitArea = new PIXI.Rectangle(0, 0, w, h);
    hit.on('pointerdown', e => {
      e.stopPropagation();
      this._pendingProgressEchoClaim = { id: milestone.id, type };
    });
    target.addChild(hit);
  }

  private _progressEchoRewardTypeLabel(reward: EventRewardDef): string | null {
    switch (reward.kind) {
      case 'deco':
        return '家具';
      case 'outfit':
        return '装扮';
      default:
        return null;
    }
  }

  private _ensureProgressEchoRewardAssets(): void {
    if (this._progressEchoRewardAssetsLoading) return;
    const rewards = EventBoardManager.progressEchoMilestones.flatMap(m => [m.primaryReward, m.adReward]);
    const keys = Array.from(new Set(rewards.map(reward => this._rewardIconKey(reward))));
    const missing = keys.some(key => {
      const tex = TextureCache.get(key);
      return !tex || tex.width <= 1;
    });
    if (!missing) return;

    this._progressEchoRewardAssetsLoading = true;
    void TextureCache.preloadKeys(keys).finally(() => {
      this._progressEchoRewardAssetsLoading = false;
      if (this._isOpen && this._codexRewardPanelOpen) this._drawCodexRewardMilestonePanel();
    });
  }

  private _claimProgressEchoPrimary(id: string): void {
    if (!EventBoardManager.claimProgressEchoPrimaryReward(id)) return;
    ToastMessage.show('奖励已领取');
    this._drawCodexRewardMilestonePanel();
  }

  private _claimProgressEchoAd(id: string): void {
    if (this._progressEchoAdRequesting) return;
    this._progressEchoAdRequesting = true;
    AdManager.showRewardedAd(AdScene.EVENT_PROGRESS_ECHO, (success, reason?: AdFailReason) => {
      this._progressEchoAdRequesting = false;
      if (!success) {
        ToastMessage.show(this._progressEchoAdFailMessage(reason));
        return;
      }
      if (!EventBoardManager.claimProgressEchoAdReward(id)) {
        ToastMessage.show('该广告奖励暂不可领取');
        this._drawCodexRewardMilestonePanel();
        return;
      }
      ToastMessage.show('广告奖励已领取');
      this._drawCodexRewardMilestonePanel();
    });
  }

  private _progressEchoAdFailMessage(reason?: AdFailReason): string {
    if (reason === 'skipped') return '广告未看完，未领取奖励';
    if (reason === 'busy') return '广告正在播放中，请稍候';
    return '广告暂不可用，请稍后再试';
  }

  private _rewardIconKey(reward: EventRewardDef): string {
    switch (reward.kind) {
      case 'stamina': return 'icon_energy';
      case 'diamond': return 'icon_gem';
      case 'huayuan': return 'icon_huayuan';
      case 'flowerSignTickets': return 'icon_flower_sign_coin';
      case 'boxItem':
      case 'boxReward':
        if (reward.itemId === LUCKY_COIN_ITEM_ID) return 'icon_coin';
        if (reward.itemId === CRYSTAL_BALL_ITEM_ID) return 'icon_crystal_ball';
        if (reward.itemId === GOLDEN_SCISSORS_ITEM_ID) return 'icon_golden_scissors';
        return reward.itemId;
      case 'deco':
        return DECO_DEFS.find(d => d.id === reward.decoId)?.icon ?? reward.decoId;
      case 'outfit':
        return getOwnerChibiTextureKey(reward.outfitId);
    }
  }

  private _codexRewardShowcaseEntry(reward: EventRewardDef): ItemObtainEntry {
    if (reward.kind === 'deco') {
      return {
        kind: 'deco',
        decoId: reward.decoId,
        label: DECO_DEFS.find(d => d.id === reward.decoId)?.name ?? '限定家具',
      };
    }
    return {
      kind: 'unlock_icon',
      iconKey: this._rewardIconKey(reward),
      label: this._rewardLabel(reward),
    };
  }

  private _rewardAmount(reward: EventRewardDef): number {
    switch (reward.kind) {
      case 'stamina':
      case 'diamond':
      case 'huayuan':
      case 'flowerSignTickets':
        return reward.amount;
      case 'boxItem':
      case 'boxReward':
        return reward.count;
      case 'deco':
      case 'outfit':
        return 1;
    }
  }

  /** 珠宝图鉴页空壳：背景壳只提供上下花纹和关闭按钮，中间内容后续由程序叠绘 */
  private _drawRewardCodexPanel(): void {
    this._hideRewardCodexPanel();
    this._codexPanelOpen = true;

    const blocker = new PIXI.Graphics();
    blocker.beginFill(0x000000, 0.34);
    blocker.drawRect(0, 0, DESIGN_WIDTH, Game.logicHeight);
    blocker.endFill();
    blocker.eventMode = 'static';
    blocker.on('pointerdown', e => {
      e.stopPropagation();
      this._hideRewardCodexPanel();
    });
    this._codexLayer.addChild(blocker);

    const shellTex = TextureCache.get('event_jewelry_codex_panel_shell');
    if (shellTex && shellTex.width > 1) {
      const shell = new PIXI.Sprite(shellTex);
      const scale = Math.min((DESIGN_WIDTH * 0.96) / shellTex.width, (Game.logicHeight * 0.9) / shellTex.height);
      shell.scale.set(scale);
      shell.anchor.set(0.5);
      shell.position.set(DESIGN_WIDTH / 2, Game.logicHeight / 2 + 20);
      this._codexLayer.addChild(shell);

      const shellHit = new PIXI.Container();
      shellHit.eventMode = 'static';
      shellHit.hitArea = new PIXI.Rectangle(
        shell.position.x - shellTex.width * scale / 2,
        shell.position.y - shellTex.height * scale / 2,
        shellTex.width * scale,
        shellTex.height * scale,
      );
      shellHit.on('pointerdown', e => e.stopPropagation());
      this._codexLayer.addChild(shellHit);

      this._drawRewardCodexSectionPreview(shell.position.x, shell.position.y, shellTex.width * scale, shellTex.height * scale);

      const shellW = shellTex.width * scale;
      const shellH = shellTex.height * scale;
      const closeX = shell.position.x + shellW * 0.42;
      const closeY = shell.position.y - shellH * 0.35;
      this._codexCloseHit = { x: closeX, y: closeY, r: Math.max(54, shellW * 0.09) };
      this._drawRewardCodexCloseHit(closeX, closeY);
    } else {
      const fallback = new PIXI.Graphics();
      fallback.beginFill(0xfff2df, 1);
      fallback.lineStyle(4, 0xe8b9ce, 1);
      fallback.drawRoundedRect(44, Game.safeTop + 90, DESIGN_WIDTH - 88, Game.logicHeight - Game.safeTop - 150, 28);
      fallback.endFill();
      fallback.beginFill(0xbdeff0, 1);
      fallback.drawRoundedRect(44, Game.logicHeight - 150, DESIGN_WIDTH - 88, 70, 26);
      fallback.endFill();
      this._codexLayer.addChild(fallback);

      const close = new PIXI.Graphics();
      close.beginFill(0xd8faf2, 1);
      close.lineStyle(4, 0x7dc3bd, 1);
      close.drawCircle(0, 0, 36);
      close.endFill();
      close.lineStyle(8, 0x407f7b, 1);
      close.moveTo(-12, -12);
      close.lineTo(12, 12);
      close.moveTo(12, -12);
      close.lineTo(-12, 12);
      close.position.set(DESIGN_WIDTH - 58, Game.safeTop + 154);
      this._codexLayer.addChild(close);
      const fallbackHit = new PIXI.Container();
      fallbackHit.eventMode = 'static';
      fallbackHit.hitArea = new PIXI.Rectangle(44, Game.safeTop + 90, DESIGN_WIDTH - 88, Game.logicHeight - Game.safeTop - 150);
      fallbackHit.on('pointerdown', e => e.stopPropagation());
      this._codexLayer.addChild(fallbackHit);
      this._codexCloseHit = { x: DESIGN_WIDTH - 58, y: Game.safeTop + 154, r: 58 };
      this._drawRewardCodexCloseHit(DESIGN_WIDTH - 58, Game.safeTop + 154);
    }
    requestAnimationFrame(() => {
      if (this._isOpen && this._codexPanelOpen) this._ensureCodexRewardAssets();
    });
  }

  private _ensureCodexRewardAssets(): void {
    if (this._codexRewardAssetsLoading) return;
    const keys = [getOwnerChibiTextureKey('outfit_jewel_bloom'), 'event_jewelry_jade_curtain'];
    const missing = keys.some(key => {
      const tex = TextureCache.get(key);
      return !tex || tex.width <= 1;
    });
    if (!missing) return;

    this._codexRewardAssetsLoading = true;
    void TextureCache.preloadKeys(keys).finally(() => {
      this._codexRewardAssetsLoading = false;
      if (this._isOpen && this._codexPanelOpen) this._drawRewardCodexPanel();
    });
  }

  private _drawRewardCodexSectionPreview(shellCx: number, shellCy: number, shellW: number, shellH: number): void {
    const targetW = shellW * 0.66;
    const tallSectionH = targetW * 0.74;
    const gap = shellH * 0.025;
    const viewportW = shellW * 0.72;
    const viewportH = shellH * 0.43;
    const viewportX = shellCx - viewportW / 2;
    const viewportY = shellCy - shellH * 0.21;
    const contentH = tallSectionH * 2 + gap;
    const maxScroll = Math.max(0, contentH - viewportH);
    this._codexScrollY = Math.max(0, Math.min(maxScroll, this._codexScrollY));
    this._codexScrollViewport = { x: viewportX, y: viewportY, w: viewportW, h: viewportH };
    this._codexScrollMaxY = maxScroll;

    const mask = new PIXI.Graphics();
    mask.beginFill(0xffffff, 1);
    mask.drawRect(viewportX, viewportY, viewportW, viewportH);
    mask.endFill();
    this._codexLayer.addChild(mask);

    const scroller = new PIXI.Container();
    scroller.position.set(0, viewportY - this._codexScrollY);
    scroller.mask = mask;
    this._codexLayer.addChild(scroller);
    this._codexScroller = scroller;
    this._codexScrollerViewportY = viewportY;

    this._drawRewardCodexSection(scroller, {
      x: shellCx,
      y: 0,
      w: targetW,
      h: tallSectionH,
      title: '首饰',
      section: 'jewelry',
      rewardTextureKey: getOwnerChibiTextureKey('outfit_jewel_bloom'),
      rewardCount: 1,
      itemIds: EVENT_CODEX_ITEM_IDS.slice(0, 13),
      cols: 5,
    });
    this._drawRewardCodexSection(scroller, {
      x: shellCx,
      y: tallSectionH + gap,
      w: targetW,
      h: tallSectionH,
      title: '点翠',
      section: 'dian_cui',
      rewardTextureKey: 'event_jewelry_jade_curtain',
      rewardCount: 1,
      itemIds: EVENT_CODEX_ITEM_IDS.slice(13),
      cols: 4,
    });
  }

  private _setupCanvasRewardCodexScroll(): void {
    const canvas = Game.app.view as unknown as HTMLCanvasElement | undefined;
    if (!canvas?.addEventListener) return;
    canvas.addEventListener('pointerdown', this._onCanvasRewardCodexDown);
    canvas.addEventListener('pointermove', this._onCanvasRewardCodexMove);
    canvas.addEventListener('pointerup', this._onCanvasRewardCodexUp);
    canvas.addEventListener('pointercancel', this._onCanvasRewardCodexUp);
  }

  private readonly _onCanvasRewardCodexDown = (ev: PointerEvent): void => {
    if (!this._isOpen || (!this._codexPanelOpen && !this._codexRewardPanelOpen)) return;
    const p = this._rawToDesign(ev);
    const c = this._codexCloseHit;
    if (c.r > 0 && Math.hypot(p.x - c.x, p.y - c.y) <= c.r) {
      ev.preventDefault?.();
      if (this._codexRewardPanelOpen) this._hideCodexRewardMilestonePanel();
      else this._hideRewardCodexPanel();
      return;
    }
    if (this._codexScrollMaxY <= 0 || !this._codexScroller) return;
    const r = this._codexScrollViewport;
    if (p.x < r.x || p.x > r.x + r.w || p.y < r.y || p.y > r.y + r.h) return;
    this._codexScrollListening = true;
    this._codexScrollStartDesignY = p.y;
    this._codexScrollStartY = this._codexScrollY;
    ev.preventDefault?.();
  };

  private readonly _onCanvasRewardCodexMove = (ev: PointerEvent): void => {
    if (
      !this._isOpen ||
      (!this._codexPanelOpen && !this._codexRewardPanelOpen) ||
      !this._codexScrollListening ||
      !this._codexScroller
    ) return;
    const dy = this._rawToDesign(ev).y - this._codexScrollStartDesignY;
    this._codexScrollY = Math.max(0, Math.min(this._codexScrollMaxY, this._codexScrollStartY - dy));
    this._codexScroller.position.y = this._codexScrollerViewportY - this._codexScrollY;
    ev.preventDefault?.();
  };

  private readonly _onCanvasRewardCodexUp = (ev: PointerEvent): void => {
    this._finishRewardCodexScroll(ev);
  };

  private _finishRewardCodexScroll(ev?: PointerEvent): void {
    if (!this._codexScrollListening) return;
    const endY = ev != null ? this._rawToDesign(ev).y : this._codexScrollStartDesignY;
    const movedPx = Math.abs(endY - this._codexScrollStartDesignY);
    const pending = this._pendingProgressEchoClaim;
    this._pendingProgressEchoClaim = null;
    this._codexScrollListening = false;
    if (movedPx < 12 && pending) {
      if (pending.type === 'primary') this._claimProgressEchoPrimary(pending.id);
      else this._claimProgressEchoAd(pending.id);
    }
  }

  private _drawRewardCodexSection(target: PIXI.Container, args: {
    x: number;
    y: number;
    w: number;
    h: number;
    title: string;
    section: 'jewelry' | 'dian_cui';
    rewardTextureKey: string;
    rewardCount: number;
    itemIds: readonly string[];
    cols: number;
  }): void {
    const w = args.w;
    const h = args.h;
    const headerH = Math.min(w * 0.15, 82);
    const left = args.x - w / 2;
    this._drawRewardCodexSectionShell(target, left, args.y, w, h, headerH);

    const title = new PIXI.Text(args.title, {
      fontSize: Math.round(headerH * 0.36),
      fill: 0x6d4a3d,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: 0xffffff,
      strokeThickness: 3,
    });
    title.anchor.set(0.5);
    title.position.set(left + w * 0.255, args.y + headerH * 0.5);
    target.addChild(title);

    this._drawRewardCodexSectionReward(
      target,
      left + w * 0.78,
      args.y + headerH * 0.5,
      headerH * 0.78,
      args.rewardTextureKey,
      args.rewardCount,
      args.section,
      w * 0.38,
      headerH * 0.84,
    );
    this._drawRewardCodexItemGrid(
      target,
      left + w * 0.075,
      args.y + headerH + h * 0.06,
      w * 0.85,
      h - headerH - h * 0.12,
      args.itemIds,
      args.cols,
    );
  }

  private _drawRewardCodexSectionShell(
    target: PIXI.Container,
    x: number,
    y: number,
    w: number,
    h: number,
    headerH: number,
  ): void {
    const r = 22;
    const header = new PIXI.Graphics();
    header.beginFill(0xd9b2f1, 0.96);
    header.lineStyle(2, 0xb87bc3, 0.9);
    header.drawRoundedRect(x, y, w, headerH, r);
    header.endFill();
    target.addChild(header);

    const titlePlate = new PIXI.Graphics();
    titlePlate.beginFill(0xfff1d7, 0.98);
    titlePlate.drawRoundedRect(x + w * 0.08, y + headerH * 0.18, w * 0.34, headerH * 0.64, 13);
    titlePlate.endFill();
    target.addChild(titlePlate);

    const rewardPlate = new PIXI.Graphics();
    rewardPlate.beginFill(0xffe7ad, 0.98);
    rewardPlate.drawRoundedRect(x + w * 0.56, y + headerH * 0.06, w * 0.38, headerH * 0.88, 18);
    rewardPlate.endFill();
    target.addChild(rewardPlate);

    const body = new PIXI.Graphics();
    body.beginFill(0xffefd9, 0.98);
    body.lineStyle(2, 0xf0a9b3, 0.9);
    body.drawRoundedRect(x, y + headerH + 6, w, h - headerH - 6, 18);
    body.endFill();
    body.lineStyle(3, 0x8fd6ca, 0.9);
    body.drawRoundedRect(x + 10, y + headerH + 18, w - 20, h - headerH - 36, 12);
    target.addChild(body);

    const pearl = new PIXI.Graphics();
    pearl.beginFill(0xfff2e4, 1);
    pearl.lineStyle(2, 0xb98a65, 1);
    pearl.drawCircle(x + w / 2, y + headerH - 3, 6);
    pearl.endFill();
    target.addChild(pearl);
  }

  private _drawRewardCodexSectionReward(
    target: PIXI.Container,
    cx: number,
    cy: number,
    iconFit: number,
    textureKey: string,
    count: number,
    section: 'jewelry' | 'dian_cui',
    hitW: number,
    hitH: number,
  ): void {
    const claimed = EventBoardManager.isCodexSectionRewardClaimed(section);
    const claimable = EventBoardManager.isCodexSectionRewardClaimable(section);
    const active = claimable || claimed;
    const labelText = section === 'jewelry' ? '装扮' : '家具';

    const typeLabel = new PIXI.Text(labelText, {
      fontSize: Math.round(iconFit * 0.32),
      fill: 0x8b5a3d,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: 0xffffff,
      strokeThickness: 3,
    });
    typeLabel.anchor.set(0.5);
    typeLabel.position.set(cx - hitW * 0.32, cy);
    typeLabel.alpha = active ? 1 : 0.58;
    target.addChild(typeLabel);

    const tex = TextureCache.get(textureKey);
    if (tex && tex.width > 1) {
      const sp = new PIXI.Sprite(tex);
      sp.anchor.set(0.5);
      sp.scale.set(Math.min(iconFit / tex.width, iconFit / tex.height));
      sp.position.set(cx - iconFit * 0.2, cy);
      sp.alpha = active ? 1 : 0.58;
      target.addChild(sp);
    }

    const label = new PIXI.Text(`x${count}`, {
      fontSize: Math.round(iconFit * 0.38),
      fill: 0x7b4c32,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: 0xffffff,
      strokeThickness: 3,
    });
    label.anchor.set(0, 0.5);
    label.position.set(cx + iconFit * 0.34, cy + 1);
    label.alpha = active ? 1 : 0.58;
    target.addChild(label);

    if (claimed) {
      this._drawRewardCodexClaimCheck(target, cx + hitW * 0.34, cy + hitH * 0.2, Math.max(26, iconFit * 0.5));
    }
  }

  private _drawRewardCodexClaimCheck(target: PIXI.Container, cx: number, cy: number, size: number): void {
    const badgeTex = TextureCache.get('ui_order_check_badge');
    if (badgeTex && badgeTex.width > 1) {
      const badge = new PIXI.Sprite(badgeTex);
      badge.anchor.set(0.5);
      badge.scale.set(size / Math.max(badgeTex.width, badgeTex.height));
      badge.position.set(cx, cy);
      target.addChild(badge);
      return;
    }
    const g = new PIXI.Graphics();
    g.beginFill(0x4caf50, 1);
    g.lineStyle(3, 0xffffff, 1);
    g.drawCircle(cx, cy, size / 2);
    g.endFill();
    g.lineStyle(5, 0xffffff, 1);
    g.moveTo(cx - size * 0.22, cy);
    g.lineTo(cx - size * 0.06, cy + size * 0.16);
    g.lineTo(cx + size * 0.24, cy - size * 0.18);
    target.addChild(g);
  }

  private _drawRewardCodexItemGrid(
    target: PIXI.Container,
    x: number,
    y: number,
    w: number,
    h: number,
    itemIds: readonly string[],
    cols: number,
  ): void {
    const rows = Math.ceil(itemIds.length / cols);
    const cell = Math.min(w / cols, h / rows);
    const iconFit = cell * 0.72;
    const gridW = cell * cols;
    const startX = x + (w - gridW) / 2;

    for (let i = 0; i < itemIds.length; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cx = startX + col * cell + cell / 2;
      const cy = y + row * cell + cell / 2;
      const itemId = itemIds[i];
      const discovered = EventBoardManager.isDiscovered(itemId);

      const tile = new PIXI.Graphics();
      tile.beginFill(discovered ? 0xffefd0 : 0xf8e8cf, discovered ? 0.72 : 0.56);
      tile.lineStyle(1.5, discovered ? 0xe3bf80 : 0xd8c8ae, discovered ? 0.72 : 0.68);
      tile.drawRoundedRect(cx - cell * 0.39, cy - cell * 0.39, cell * 0.78, cell * 0.78, 10);
      tile.endFill();
      tile.rotation = Math.PI / 4;
      tile.position.set(cx, cy);
      tile.pivot.set(cx, cy);
      target.addChild(tile);

      if (!discovered) {
        const question = new PIXI.Text('?', {
          fontSize: Math.round(cell * 0.5),
          fill: 0xb6a58f,
          fontFamily: FONT_FAMILY,
          fontWeight: 'bold',
          stroke: 0xffffff,
          strokeThickness: 3,
        });
        question.anchor.set(0.5);
        question.position.set(cx, cy - 1);
        target.addChild(question);
        continue;
      }

      const tex = TextureCache.get(itemId);
      if (tex && tex.width > 1) {
        const sp = new PIXI.Sprite(tex);
        sp.anchor.set(0.5);
        sp.scale.set(Math.min(iconFit / tex.width, iconFit / tex.height));
        sp.position.set(cx, cy);
        target.addChild(sp);
      }
    }
  }

  private _drawRewardCodexCloseHit(x: number, y: number): void {
    const closeHit = new PIXI.Container();
    closeHit.position.set(x, y);
    closeHit.eventMode = 'static';
    closeHit.cursor = 'pointer';
    closeHit.hitArea = new PIXI.Circle(0, 0, Math.max(52, this._codexCloseHit.r));
    closeHit.on('pointerdown', e => {
      e.stopPropagation();
      this._hideRewardCodexPanel();
    });
    this._codexLayer.addChild(closeHit);
  }

  private _drawStageCard(y: number): void {
    const w = this._stageCardW;
    const h = this._stageCardH;
    const x = Math.round((DESIGN_WIDTH - w) / 2);

    // 宝石横幅底图（NB2 生成，pastel 珠宝风）；未就绪时退化为纯色淡紫圆角条
    const cardTex = TextureCache.get('event_stage_card_bg');
    if (cardTex && cardTex.width > 1) {
      const sp = new PIXI.Sprite(cardTex);
      sp.width = w;
      sp.height = h;
      sp.position.set(x, y);
      this._shellLayer.addChild(sp);
    } else {
      const r = 20;
      const card = new PIXI.Graphics();
      card.beginFill(0xf3c9e0, 1);
      card.drawRoundedRect(x - 3, y - 3, w + 6, h + 6, r + 3);
      card.endFill();
      card.beginFill(0xc9b6ec, 1);
      card.drawRoundedRect(x, y, w, h, r);
      card.endFill();
      card.beginFill(0xffffff, 0.22);
      card.drawRoundedRect(x + 6, y + 5, w - 12, h * 0.32, r - 6);
      card.endFill();
      this._shellLayer.addChild(card);
    }

    // 仅在横幅中央叠绘进度条 + 9 个阶段图标（左右两端预留给底图宝石装饰）
    const inset = Math.round(w * 0.115);
    this._drawProgressTrack(x + inset, y + Math.round(h / 2) - 12, w - inset * 2);
  }

  private _drawProgressTrack(x: number, y: number, w: number): void {
    // 第一阶段显示前 9 个图标（L1–L9）；其余阶段显示后 9 个（L5–L13）。
    const startLevel = EventBoardManager.stageIndex === 0 ? 1 : 5;
    const ids: string[] = [];
    for (let lv = startLevel; lv <= startLevel + 8; lv++) ids.push(`event_jewelry_${lv}`);

    const n = ids.length;
    const cy = y + 12;
    let unlockedIndex = -1;
    for (let i = 0; i < n; i++) {
      if (this._isProgressTrackItemLit(ids[i]!)) unlockedIndex = i;
    }

    const trackY = y + 8;
    const trackH = 8;
    const trackBg = new PIXI.Graphics();
    trackBg.beginFill(0xb8b6bc, 0.88);
    trackBg.drawRoundedRect(x, trackY, w, trackH, trackH / 2);
    trackBg.endFill();
    this._shellLayer.addChild(trackBg);

    if (unlockedIndex >= 0) {
      const progressW = n <= 1 ? w : (w * unlockedIndex) / (n - 1);
      const trackFg = new PIXI.Graphics();
      trackFg.beginFill(0xb7a1df, 0.86);
      trackFg.drawRoundedRect(x, trackY, Math.max(trackH, progressW), trackH, trackH / 2);
      trackFg.endFill();
      this._shellLayer.addChild(trackFg);
    }

    for (let i = 0; i < n; i++) {
      const itemId = ids[i];
      const level = startLevel + i;
      const nx = x + (n <= 1 ? 0 : (w * i) / (n - 1));
      const unlocked = this._isProgressTrackItemLit(itemId);

      const tex = TextureCache.get(itemId);
      if (tex) {
        const sp = new PIXI.Sprite(tex);
        const fit = unlocked ? 54 : 48;
        sp.anchor.set(0.5);
        sp.scale.set(Math.min(fit / tex.width, fit / tex.height));
        sp.position.set(nx, cy);
        if (!unlocked) {
          sp.tint = 0x17110f;
          sp.alpha = 0.92;
        }
        this._shellLayer.addChild(sp);
      } else {
        const shadow = new PIXI.Graphics();
        shadow.beginFill(unlocked ? 0xffc94d : 0x17110f, unlocked ? 1 : 0.9);
        shadow.drawEllipse(nx, cy, 11, 8);
        shadow.endFill();
        this._shellLayer.addChild(shadow);
      }

      if (EVENT_KEY_BADGE_LEVELS.includes(level)) {
        this._drawProgressKeyBadge(nx, cy);
      }
    }
  }

  private _isProgressTrackItemLit(itemId: string): boolean {
    return EventBoardManager.isDiscovered(itemId) && !this._pendingProgressRevealItemIds.has(itemId);
  }

  private _progressTrackItemCenter(itemId: string): { x: number; y: number } | null {
    const match = /^event_jewelry_(\d+)$/.exec(itemId);
    if (!match) return null;
    const level = Number(match[1]);
    if (!Number.isFinite(level)) return null;
    const startLevel = EventBoardManager.stageIndex === 0 ? 1 : 5;
    const endLevel = startLevel + 8;
    if (level < startLevel || level > endLevel) return null;

    const cardX = Math.round((DESIGN_WIDTH - this._stageCardW) / 2);
    const inset = Math.round(this._stageCardW * 0.115);
    const x = cardX + inset;
    const w = this._stageCardW - inset * 2;
    const i = level - startLevel;
    return {
      x: x + (w * i) / 8,
      y: this._stageCardY + Math.round(this._stageCardH / 2),
    };
  }

  /** 顶部色带居中显示当前阶段，避免占用棋盘下方空间。 */
  private _drawStageNumberLabel(): void {
    const stageNo = EventBoardManager.stageIndex + 1;
    const total = EventBoardManager.stageCount;
    const label = new PIXI.Text(`阶段 ${stageNo}/${total}`, {
      fontSize: 26,
      fill: 0x7b5aa0,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: 0xffffff,
      strokeThickness: 4,
    });
    label.anchor.set(0.5);
    label.position.set(DESIGN_WIDTH / 2, this._stageCardY - STAGE_LABEL_ABOVE_CARD);
    this._shellLayer.addChild(label);
  }

  /** 进度条钥匙角标：白色气泡牌 + 金钥匙贴图，叠在物品节点上方 */
  private _drawProgressKeyBadge(cx: number, itemCy: number): void {
    const bubbleW = 56;
    const bubbleH = 48;
    const bubbleTop = itemCy - 68;
    const bubbleLeft = cx - bubbleW / 2;
    const pointerW = 14;
    const pointerH = 12;

    const bubble = new PIXI.Graphics();
    bubble.beginFill(0x000000, 0.12);
    bubble.drawRoundedRect(bubbleLeft + 2, bubbleTop + 2, bubbleW, bubbleH, 6);
    bubble.endFill();
    bubble.lineStyle(1.5, 0xd8c8b5, 0.85);
    bubble.beginFill(0xffffff, 0.98);
    bubble.drawRoundedRect(bubbleLeft, bubbleTop, bubbleW, bubbleH, 6);
    bubble.endFill();
    bubble.beginFill(0xffffff, 0.98);
    bubble.moveTo(cx - pointerW / 2, bubbleTop + bubbleH - 1);
    bubble.lineTo(cx + pointerW / 2, bubbleTop + bubbleH - 1);
    bubble.lineTo(cx, bubbleTop + bubbleH + pointerH);
    bubble.closePath();
    bubble.endFill();
    bubble.lineStyle(1.5, 0xd8c8b5, 0.85);
    bubble.moveTo(cx - pointerW / 2, bubbleTop + bubbleH - 1);
    bubble.lineTo(cx, bubbleTop + bubbleH + pointerH);
    bubble.lineTo(cx + pointerW / 2, bubbleTop + bubbleH - 1);
    this._shellLayer.addChild(bubble);

    const keyTex = TextureCache.get('event_key_badge');
    if (keyTex && keyTex.width > 1) {
      const sp = new PIXI.Sprite(keyTex);
      const fit = 42;
      sp.anchor.set(0.5);
      sp.scale.set(Math.min(fit / keyTex.width, fit / keyTex.height));
      sp.position.set(cx, bubbleTop + bubbleH / 2 + 1);
      this._shellLayer.addChild(sp);
    } else {
      const fb = new PIXI.Text('🔑', { fontSize: 30 });
      fb.anchor.set(0.5);
      fb.position.set(cx, bubbleTop + bubbleH / 2);
      this._shellLayer.addChild(fb);
    }
  }

  /** 棋盘外框底板（格子本身由 _gridLayer 中的 CellView 渲染） */
  private _drawBoardBackdrop(): void {
    const rows = EventBoardManager.currentRows;
    const gridW = EVENT_BOARD_COLS * CELL + (EVENT_BOARD_COLS - 1) * GAP;
    const gridH = rows * CELL + (rows - 1) * GAP;
    const boardBg = new PIXI.Graphics();
    boardBg.beginFill(0xffffff, 0.5);
    boardBg.lineStyle(3, 0xcaa6ff, 0.8);
    boardBg.drawRoundedRect(
      this._gridStartX - 16,
      this._gridStartY - 16,
      gridW + 32,
      gridH + 32,
      20,
    );
    boardBg.endFill();
    this._shellLayer.addChild(boardBg);
  }

  /** 棋盘底边 Y（含外框 padding） */
  private _computeBoardBottomY(): number {
    const rows = EventBoardManager.currentRows;
    const gridH = rows * CELL + (rows - 1) * GAP;
    return this._gridStartY + gridH + 16;
  }

  private _drawActions(): void {
    this._drawStoneDispenser(DESIGN_WIDTH / 2, this._computeDispenserY());
  }

  /** 珠宝匣投放器：打开珠宝匣 + 绒布上原石 + 红色库存徽标 */
  private _drawStoneDispenser(cx: number, cy: number): void {
    const count = EventBoardManager.pendingStarterStones;
    const stageTransitionReady = this._isStageTransitionReady();
    const w = DISPENSER_W;
    const h = DISPENSER_H;

    const root = new PIXI.Container();
    root.position.set(cx, cy);
    root.eventMode = 'static';
    root.cursor = 'pointer';
    root.hitArea = new PIXI.Rectangle(-w / 2 - 12, -h / 2 - 12, w + 24, h + 24);
    root.on('pointerdown', e => {
      e.stopPropagation();
      this._onDispenserTap();
    });
    this._shellLayer.addChild(root);
    this._dispenserRoot = root;

    // 珠宝匣贴图（NB2）；未加载时退化为程序绘制的小匣
    const casketTex = TextureCache.get('event_jewelry_casket');
    if (casketTex) {
      const sp = new PIXI.Sprite(casketTex);
      const fit = Math.max(w, h) + 28;
      sp.scale.set(Math.min(fit / casketTex.width, fit / casketTex.height));
      sp.anchor.set(0.5);
      sp.position.set(0, 0);
      root.addChild(sp);
    } else {
      const box = new PIXI.Graphics();
      box.lineStyle(4, 0x9c6a1e, 1);
      box.beginFill(0xf6c65a, 1);
      box.drawRoundedRect(-w / 2, -h / 2 + 32, w, h - 32, 18);
      box.endFill();
      box.lineStyle(4, 0x6b4aa0, 1);
      box.beginFill(0x9b78d6, 1);
      box.moveTo(-w / 2, -h / 2 + 36);
      box.bezierCurveTo(-w / 2, -h / 2 - 10, w / 2, -h / 2 - 10, w / 2, -h / 2 + 36);
      box.closePath();
      box.endFill();
      root.addChild(box);
    }

    if (stageTransitionReady || count > 0) {
      // 原石图标（绒布展示台上，石头是视觉重点）
      const stoneTex = TextureCache.get('event_jewelry_1');
      if (stoneTex) {
        const sp = new PIXI.Sprite(stoneTex);
        sp.scale.set(Math.min(DISPENSER_STONE_FIT / stoneTex.width, DISPENSER_STONE_FIT / stoneTex.height));
        sp.anchor.set(0.5);
        sp.position.set(0, DISPENSER_STONE_LOCAL_Y);
        sp.name = 'dispenserStone';
        root.addChild(sp);
      } else {
        const gem = new PIXI.Graphics();
        gem.beginFill(0xb56cf0, 1);
        gem.lineStyle(2, 0xffffff, 0.8);
        gem.drawPolygon([0, -22, 20, -3, 0, 28, -20, -3]);
        gem.endFill();
        gem.position.set(0, DISPENSER_STONE_LOCAL_Y);
        gem.name = 'dispenserStone';
        root.addChild(gem);
      }

      if (stageTransitionReady) {
        this._drawDispenserStageLock(root);
      } else {
        // 右上角红色库存徽标
        const badge = new PIXI.Graphics();
        const bx = w / 2 - 2;
        const by = -h / 2 + 6;
        badge.lineStyle(3, 0xffffff, 1);
        badge.beginFill(0xff5167, 1);
        badge.drawCircle(bx, by, 24);
        badge.endFill();
        badge.name = 'dispenserBadgeBg';
        root.addChild(badge);

        const num = new PIXI.Text(`${count}`, {
          fontSize: count >= 100 ? 24 : 28,
          fill: 0xffffff,
          fontFamily: FONT_FAMILY,
          fontWeight: 'bold',
        });
        num.anchor.set(0.5);
        num.position.set(bx, by);
        num.name = 'dispenserBadge';
        root.addChild(num);
      }
    }
  }

  /** 点击珠宝匣：逻辑落子 + 飞行动画 */
  private _onDispenserTap(): void {
    if (this._isStageTransitionReady()) {
      ToastMessage.show('阶段钥匙已到手，先点击棋盘中的门进入下一阶段吧');
      return;
    }
    if (EventBoardManager.pendingStarterStones <= 0) {
      this._showStarterStoneHint();
      return;
    }
    this._hideStarterStoneHint();
    if (EventBoardManager.emptyOpenCellCount < 1) {
      ToastMessage.show('活动棋盘空位不足');
      return;
    }
    this._stonePlaceAnimating = true;
    const idx = EventBoardManager.placeStarterStone();
    this._stonePlaceAnimating = false;
    if (idx < 0) return;

    this._flyStoneTargetIndex = idx;
    this._updateDispenserBadge();
    this._refreshGrid();
    this._playDispenserPop();
    this._playStoneFlyToCell(idx, EventBoardManager.cells[idx]?.itemId ?? 'event_jewelry_1');
  }

  /** 仅更新珠宝匣右上角库存数字（飞行中不重绘整匣） */
  private _updateDispenserBadge(): void {
    const root = this._dispenserRoot;
    if (!root) return;
    const badgeText = root.getChildByName('dispenserBadge') as PIXI.Text | null;
    if (!badgeText) return;
    const count = EventBoardManager.pendingStarterStones;
    badgeText.text = `${count}`;
    badgeText.style.fontSize = count >= 100 ? 24 : 28;
    if (count <= 0) this._refresh();
  }

  private _isStageTransitionReady(): boolean {
    return EventBoardManager.keys > 0 && EventBoardManager.stageIndex < EventBoardManager.stageCount - 1;
  }

  private _drawDispenserStageLock(root: PIXI.Container): void {
    const tex = this._portalBadgeIconTexture(false);
    if (tex && tex.width > 1) {
      const icon = new PIXI.Sprite(tex);
      icon.anchor.set(0.5);
      const fit = 28;
      icon.scale.set(Math.min(fit / tex.width, fit / tex.height));
      icon.position.set(24, DISPENSER_STONE_LOCAL_Y - 24);
      root.addChild(icon);
      return;
    }

    const fallback = new PIXI.Text('锁', {
      fontSize: 18,
      fill: 0x7b5aa0,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: 0xffffff,
      strokeThickness: 3,
    });
    fallback.anchor.set(0.5);
    fallback.position.set(24, DISPENSER_STONE_LOCAL_Y - 24);
    root.addChild(fallback);
  }

  private _showStarterStoneHint(): void {
    if (this._starterStoneHint?.parent) return;
    this._hideRewardCodexPanel();
    const cy = this._computeDispenserY();
    const spotlightTop = cy - DISPENSER_H / 2 - 10;
    const spotlightBottom = cy + DISPENSER_H / 2 + 10;
    const bubble = new TutorialDialogBubble({
      title: '原石从订单来',
      body: '这里存放活动原石。\n完成原石订单后，会自动放进珠宝匣。',
      actionText: '有库存时点击珠宝匣，投放原石到活动棋盘。',
      buttonText: '知道了',
      spotlightTop,
      spotlightBottom,
      spotlightCenterX: DESIGN_WIDTH / 2,
      preferAboveSpotlight: true,
      variant: 'dialog',
      onButton: () => this._hideStarterStoneHint(),
    });
    this._starterStoneHint = bubble;
    this._codexLayer.addChild(bubble);
  }

  private _hideStarterStoneHint(): void {
    if (!this._starterStoneHint) return;
    this._starterStoneHint.dispose();
    this._starterStoneHint = null;
  }

  /** 珠宝匣点击反馈：轻微缩放弹跳 */
  private _playDispenserPop(): void {
    const root = this._dispenserRoot;
    if (!root) return;
    TweenManager.cancelTarget(root.scale);
    root.scale.set(1);
    TweenManager.to({
      target: root.scale,
      props: { x: 0.92, y: 0.92 },
      duration: 0.08,
      ease: Ease.easeOutQuad,
      onComplete: () => {
        TweenManager.to({
          target: root.scale,
          props: { x: 1.06, y: 1.06 },
          duration: 0.12,
          ease: Ease.easeOutQuad,
          onComplete: () => {
            TweenManager.to({
              target: root.scale,
              props: { x: 1, y: 1 },
              duration: 0.1,
              ease: Ease.easeOutQuad,
            });
          },
        });
      },
    });
    // 匣内原石短暂隐藏（已「发射」出去）
    const stone = root.getChildByName('dispenserStone');
    if (stone) {
      stone.visible = false;
      const proxy = { v: 0 };
      TweenManager.to({
        target: proxy,
        props: { v: 1 },
        duration: 0,
        delay: 0.44,
        onComplete: () => { if (stone.parent) stone.visible = true; },
      });
    }
  }

  /** 原石从珠宝匣飞向棋盘落点格 */
  private _playStoneFlyToCell(cellIndex: number, itemId: string): void {
    this._clearStoneFly();

    const col = cellIndex % EVENT_BOARD_COLS;
    const row = Math.floor(cellIndex / EVENT_BOARD_COLS);
    const tx = this._gridStartX + col * (CELL + GAP) + CELL / 2;
    const ty = this._gridStartY + row * (CELL + GAP) + CELL / 2;

    const root = this._dispenserRoot;
    const sx = root?.position.x ?? DESIGN_WIDTH / 2;
    const sy = (root?.position.y ?? this._computeDispenserY()) + DISPENSER_STONE_LOCAL_Y;

    const ghost = new ItemView();
    ghost.setItem(itemId);
    const startScale = this._cellScale * (DISPENSER_STONE_FIT / CELL);
    ghost.scale.set(startScale);
    ghost.position.set(sx, sy);
    this._ghostLayer.addChild(ghost);
    this._stoneFlyGhost = ghost;

    const midX = (sx + tx) / 2;
    const midY = Math.min(sy, ty) - 72;
    const anim = { t: 0 };
    this._stoneFlyAnim = anim;
    TweenManager.to({
      target: anim,
      props: { t: 1 },
      duration: 0.44,
      ease: Ease.easeOutQuad,
      onUpdate: () => {
        const t = anim.t;
        const u = 1 - t;
        ghost.position.set(
          u * u * sx + 2 * u * t * midX + t * t * tx,
          u * u * sy + 2 * u * t * midY + t * t * ty,
        );
        const s = startScale + (this._cellScale - startScale) * t;
        ghost.scale.set(s);
      },
      onComplete: () => {
        this._stoneFlyAnim = null;
        this._clearStoneFly();
        this._flyStoneTargetIndex = -1;
        this._refreshGrid();
        this._playStoneLandPop(tx, ty, cellIndex);
      },
    });
  }

  private _clearStoneFly(): void {
    if (this._stoneFlyAnim) {
      TweenManager.cancelTarget(this._stoneFlyAnim);
      this._stoneFlyAnim = null;
    }
    if (!this._stoneFlyGhost) return;
    TweenManager.cancelTarget(this._stoneFlyGhost);
    TweenManager.cancelTarget(this._stoneFlyGhost.scale);
    if (this._stoneFlyGhost.parent) this._stoneFlyGhost.parent.removeChild(this._stoneFlyGhost);
    this._stoneFlyGhost.destroy();
    this._stoneFlyGhost = null;
  }

  /** 原石落格：格子弹跳 + 闪光 */
  private _playStoneLandPop(cx: number, cy: number, cellIndex: number): void {
    const wrapper = this._wrappers[cellIndex];
    if (wrapper) {
      TweenManager.cancelTarget(wrapper.scale);
      wrapper.scale.set(0.82);
      TweenManager.to({
        target: wrapper.scale,
        props: { x: 1.12, y: 1.12 },
        duration: 0.14,
        ease: Ease.easeOutQuad,
        onComplete: () => {
          TweenManager.to({
            target: wrapper.scale,
            props: { x: 1, y: 1 },
            duration: 0.16,
            ease: Ease.easeOutBack,
          });
        },
      });
    }

    const flash = new PIXI.Graphics();
    flash.position.set(cx, cy);
    flash.beginFill(0xffffff, 0.85);
    flash.drawCircle(0, 0, 18);
    flash.endFill();
    flash.beginFill(0xe8d4ff, 0.55);
    flash.drawCircle(0, 0, 32);
    flash.endFill();
    flash.scale.set(0.4);
    this._ghostLayer.addChild(flash);
    TweenManager.to({ target: flash, props: { alpha: 0 }, duration: 0.38, ease: Ease.easeOutQuad });
    TweenManager.to({
      target: flash.scale,
      props: { x: 1.6, y: 1.6 },
      duration: 0.38,
      ease: Ease.easeOutQuad,
      onComplete: () => {
        if (flash.parent) flash.parent.removeChild(flash);
        flash.destroy();
      },
    });
  }

  /** 合成爆奖：奖励物品从上方落到实际空出的源格，并在落地时闪光弹跳 */
  private _playMergeRewardDrop(placements: EventMergeDropPlacement[]): void {
    if (!this._isOpen) return;
    this._refreshGrid();

    placements.forEach((p, i) => {
      if (p.cellIndex < 0 || p.cellIndex >= this._itemViews.length) return;
      const itemView = this._itemViews[p.cellIndex];
      const col = p.cellIndex % EVENT_BOARD_COLS;
      const row = Math.floor(p.cellIndex / EVENT_BOARD_COLS);
      const tx = this._gridStartX + col * (CELL + GAP) + CELL / 2;
      const ty = this._gridStartY + row * (CELL + GAP) + CELL / 2;
      const delay = i * 0.08;

      itemView.visible = false;

      const ghost = new ItemView();
      ghost.setItem(p.itemId);
      ghost.scale.set(this._cellScale * 0.72);
      ghost.alpha = 0;
      ghost.position.set(tx, ty - 74);
      this._ghostLayer.addChild(ghost);

      const anim = { t: 0 };
      TweenManager.to({
        target: anim,
        props: { t: 1 },
        delay,
        duration: 0.28,
        ease: Ease.easeInQuad,
        onUpdate: () => {
          const t = anim.t;
          ghost.alpha = Math.min(1, t * 1.5);
          ghost.position.set(tx, ty - 74 + 74 * t);
          const s = this._cellScale * (0.72 + 0.34 * t);
          ghost.scale.set(s);
        },
        onComplete: () => {
          if (ghost.parent) ghost.parent.removeChild(ghost);
          ghost.destroy();
          itemView.visible = true;
          this._playStoneLandPop(tx, ty, p.cellIndex);
        },
      });
    });
  }

  /** 首次解锁图鉴：全屏遮罩展示大图标与名称，随后图标飞入左上图鉴入口。 */
  private _playCodexUnlockFly(itemId: string, itemName: string): void {
    const tex = TextureCache.get(itemId);
    if (!tex || tex.width <= 1) {
      this._pendingProgressRevealItemIds.delete(itemId);
      this._drawShell();
      this._codexUnlockAnimating = false;
      this._playNextCodexRewardShowcase();
      return;
    }
    this._codexUnlockAnimating = true;

    const target = this._progressTrackItemCenter(itemId) ?? this._rewardCatalogButtonCenter();
    const root = new PIXI.Container();
    root.position.set(0, 0);
    root.alpha = 0;
    root.eventMode = 'static';
    root.hitArea = new PIXI.Rectangle(0, 0, DESIGN_WIDTH, Game.logicHeight);
    root.on('pointerdown', e => e.stopPropagation());
    this._ghostLayer.addChild(root);

    const dim = new PIXI.Graphics();
    dim.beginFill(0x2c2130, 0.52);
    dim.drawRect(0, 0, DESIGN_WIDTH, Game.logicHeight);
    dim.endFill();
    root.addChild(dim);

    const title = new PIXI.Text('解锁新图鉴', {
      fontSize: 42,
      fill: 0xfff3c2,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: 0x6f4a3d,
      strokeThickness: 6,
    });
    title.anchor.set(0.5);
    title.position.set(DESIGN_WIDTH / 2, Game.logicHeight * 0.32);
    root.addChild(title);

    const icon = new PIXI.Sprite(tex);
    icon.anchor.set(0.5);
    icon.scale.set(Math.min(168 / tex.width, 168 / tex.height));
    icon.position.set(DESIGN_WIDTH / 2, Game.logicHeight * 0.47);
    root.addChild(icon);

    const name = new PIXI.Text(itemName, {
      fontSize: 34,
      fill: 0xffffff,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: 0x6f4a3d,
      strokeThickness: 5,
      wordWrap: true,
      wordWrapWidth: DESIGN_WIDTH - 100,
    });
    name.anchor.set(0.5);
    name.position.set(DESIGN_WIDTH / 2, Game.logicHeight * 0.63);
    root.addChild(name);

    icon.scale.set(0);
    TweenManager.to({
      target: root,
      props: { alpha: 1 },
      duration: 0.18,
      ease: Ease.easeOutQuad,
    });
    TweenManager.to({
      target: icon.scale,
      props: {
        x: Math.min(168 / tex.width, 168 / tex.height),
        y: Math.min(168 / tex.width, 168 / tex.height),
      },
      duration: 0.32,
      ease: Ease.easeOutBack,
      onComplete: () => {
        const hold = { v: 0 };
        TweenManager.to({
          target: hold,
          props: { v: 1 },
          duration: 0.01,
          delay: 1,
          onComplete: () => {
            const startGlobal = root.toGlobal(icon.position);
            if (root.parent) root.parent.removeChild(root);
            root.destroy({ children: true });
            this._playCodexIconFly(tex, startGlobal.x / Game.scale, startGlobal.y / Game.scale, target.x, target.y, () => {
              this._pendingProgressRevealItemIds.delete(itemId);
              this._drawShell();
              this._playProgressTrackItemPulse(target.x, target.y);
              this._codexUnlockAnimating = false;
              this._playNextCodexRewardShowcase();
            });
          },
        });
      },
    });
  }

  private _playNextCodexRewardShowcase(): void {
    if (!this._isOpen || this._codexUnlockAnimating || this._codexRewardShowcasePlaying) return;
    const next = this._pendingCodexRewardShowcases.shift();
    if (!next) return;
    this._playCodexRewardShowcase(next.section, next.reward);
  }

  private _playCodexRewardShowcase(_section: 'jewelry' | 'dian_cui', reward: EventRewardDef, retry = true): void {
    const textureKey = this._rewardIconKey(reward);
    const ribbonKey = TextureCache.get('pink_bar')?.width ? 'pink_bar' : 'merge_chain_ribbon';
    const pendingKeys = [textureKey, ribbonKey].filter(key => !TextureCache.get(key)?.width);
    if (pendingKeys.length > 0 && retry) {
      void TextureCache.preloadKeys(pendingKeys).finally(() => this._playCodexRewardShowcase(_section, reward, false));
      return;
    }

    this._codexRewardShowcasePlaying = true;
    let dismissing = false;
    let canDismissByTap = false;
    const root = new PIXI.Container();
    root.position.set(0, 0);
    root.alpha = 0;
    root.eventMode = 'static';
    root.hitArea = new PIXI.Rectangle(0, 0, DESIGN_WIDTH, Game.logicHeight);
    this._ghostLayer.addChild(root);

    const dim = new PIXI.Graphics();
    dim.beginFill(0x2c2130, 0.52);
    dim.drawRect(0, 0, DESIGN_WIDTH, Game.logicHeight);
    dim.endFill();
    root.addChild(dim);

    const content = new PIXI.Container();
    content.eventMode = 'none';
    root.addChild(content);
    layoutObtainStyleRewardBlock(content, DESIGN_WIDTH, Game.logicHeight, [this._codexRewardShowcaseEntry(reward)], {
      ribbonTexKey: ribbonKey,
      titleText: '获得图鉴奖励',
      cellSize: 168,
      qtyFontSize: 28,
    });

    const finish = (): void => {
      if (dismissing) return;
      dismissing = true;
      TweenManager.to({
        target: root,
        props: { alpha: 0 },
        duration: 0.22,
        ease: Ease.easeInQuad,
        onComplete: () => {
          if (root.parent) root.parent.removeChild(root);
          root.destroy({ children: true });
          this._codexRewardShowcasePlaying = false;
          if (this._codexPanelOpen) this._drawRewardCodexPanel();
          this._playNextCodexRewardShowcase();
        },
      });
    };
    root.on('pointerdown', e => e.stopPropagation());
    root.on('pointertap', e => {
      e.stopPropagation();
      if (!canDismissByTap) return;
      finish();
    });

    TweenManager.to({
      target: root,
      props: { alpha: 1 },
      duration: 0.18,
      ease: Ease.easeOutQuad,
      onComplete: () => {
        window.setTimeout(() => {
          canDismissByTap = true;
        }, 180);
      },
    });
  }

  private _rewardCatalogButtonCenter(): { x: number; y: number } {
    const size = REWARD_CATALOG_BTN_SIZE;
    const x = 108;
    const y = Math.max(Game.safeTop + HEADER_H + 112, this._stageCardY - size - 18);
    return { x: x + size / 2, y: y + size / 2 };
  }

  private _playCodexIconFly(
    tex: PIXI.Texture,
    sx: number,
    sy: number,
    tx: number,
    ty: number,
    onComplete?: () => void,
  ): void {
    if (!this._isOpen) return;
    const icon = new PIXI.Sprite(tex);
    icon.anchor.set(0.5);
    icon.position.set(sx, sy);
    icon.scale.set(Math.min(80 / tex.width, 80 / tex.height));
    this._ghostLayer.addChild(icon);

    const midY = Math.min(sy, ty) - 90;
    const anim = { t: 0 };
    TweenManager.to({
      target: anim,
      props: { t: 1 },
      duration: 0.52,
      ease: Ease.easeInOutQuad,
      onUpdate: () => {
        const t = anim.t;
        const omt = 1 - t;
        icon.position.set(
          omt * omt * sx + 2 * omt * t * ((sx + tx) / 2) + t * t * tx,
          omt * omt * sy + 2 * omt * t * midY + t * t * ty,
        );
        const s = (1 - t) * Math.min(80 / tex.width, 80 / tex.height) + t * Math.min(34 / tex.width, 34 / tex.height);
        icon.scale.set(s);
        icon.alpha = 1 - Math.max(0, t - 0.82) / 0.18;
      },
      onComplete: () => {
        if (icon.parent) icon.parent.removeChild(icon);
        icon.destroy();
        if (onComplete) onComplete();
        else this._playRewardCatalogButtonPulse();
      },
    });
  }

  private _playProgressTrackItemPulse(x: number, y: number): void {
    const ring = new PIXI.Graphics();
    ring.lineStyle(5, 0xffe082, 0.95);
    ring.drawCircle(x, y, 30);
    ring.alpha = 1;
    ring.scale.set(0.55);
    this._ghostLayer.addChild(ring);
    TweenManager.to({ target: ring, props: { alpha: 0 }, duration: 0.36, ease: Ease.easeOutQuad });
    TweenManager.to({
      target: ring.scale,
      props: { x: 1.75, y: 1.75 },
      duration: 0.36,
      ease: Ease.easeOutQuad,
      onComplete: () => {
        if (ring.parent) ring.parent.removeChild(ring);
        ring.destroy();
      },
    });
  }

  private _playRewardCatalogButtonPulse(): void {
    // 图鉴入口在 shell 重绘时会重建，这里用轻量光圈提示飞入终点。
    const p = this._rewardCatalogButtonCenter();
    const ring = new PIXI.Graphics();
    ring.lineStyle(5, 0xffe082, 0.95);
    ring.drawCircle(p.x, p.y, 28);
    ring.alpha = 1;
    ring.scale.set(0.6);
    this._ghostLayer.addChild(ring);
    TweenManager.to({ target: ring, props: { alpha: 0 }, duration: 0.36, ease: Ease.easeOutQuad });
    TweenManager.to({
      target: ring.scale,
      props: { x: 1.8, y: 1.8 },
      duration: 0.36,
      ease: Ease.easeOutQuad,
      onComplete: () => {
        if (ring.parent) ring.parent.removeChild(ring);
        ring.destroy();
      },
    });
  }

  // ========== 拖拽交互（照搬主棋盘：pointerdown 走 PixiJS，move/up 走 canvas）==========

  private _onCellDown(index: number): void {
    // 上一次手势若有残留先清干净，避免幽灵叠加
    if (this._dragSrcIndex >= 0 || this._dragGhost) this._clearDragGhost();
    const cell = EventBoardManager.cells[index];
    // 时空门格：按钮式点击，集齐钥匙进入下一层
    if (cell?.isPortal) {
      void this._tryOpenPortal();
      return;
    }
    if (!cell || cell.state !== CellState.OPEN || !cell.itemId) return;

    this._dragSrcIndex = index;
    this._dragItemId = cell.itemId;
    this._dragStarted = false;
    // 选中即显示主棋盘同款黄色选择框（按下立即高亮，松手/合成后清除）
    this._cellViews[index]?.setHighlight(true);
    // pointerdown 时未拿到原始坐标，move 第一帧记录起点。
    // 关键：此处不创建幽灵、不隐藏物品；待 pointermove 越过阈值才真正起拖，
    // 这样纯点击不会产生残留幽灵，也不会把原格物品藏掉。
    this._dragStartDesign = { x: NaN, y: NaN };
  }

  private async _tryOpenPortal(): Promise<void> {
    if (EventBoardManager.keys <= 0) {
      ToastMessage.show('集齐钥匙后可开启时空门');
      return;
    }
    const mergeableName = EventBoardManager.mergeableCarryEventItemName;
    if (mergeableName) {
      ToastMessage.show(`还有可合成的${mergeableName}，先合成后再进入下一阶段`);
      return;
    }
    const carryCount = EventBoardManager.carryableEventItemCount;
    const rewardBoxCount = EventBoardManager.rewardBoxItemCountOnStageChange;
    const carryLine = carryCount > 0
      ? `当前棋盘上的 ${carryCount} 个首饰/点翠物品将进入下一阶段。`
      : '当前棋盘上没有可进入下一阶段的首饰/点翠物品。';
    const rewardBoxLine = rewardBoxCount > 0
      ? `其余 ${rewardBoxCount} 个物品会放入奖励箱。`
      : '没有其他物品需要放入奖励箱。';
    const msg = `${carryLine}\n${rewardBoxLine}`;
    const confirmed = await ConfirmDialog.show('前往下一层', msg, '继续', '取消');
    if (!confirmed) return;
    if (EventBoardManager.nextStage()) {
      if (carryCount > 0 && rewardBoxCount > 0) ToastMessage.show(`带入 ${carryCount} 个首饰，${rewardBoxCount} 个物品已放入奖励箱`);
      else if (carryCount > 0) ToastMessage.show(`开启时空门，带入 ${carryCount} 个首饰`);
      else if (rewardBoxCount > 0) ToastMessage.show(`开启时空门，${rewardBoxCount} 个物品已放入奖励箱`);
      else ToastMessage.show('开启时空门，进入下一层！');
    } else {
      ToastMessage.show(EventBoardManager.mergeableCarryEventItemName ? '还有首饰/点翠可以合成，先合成后再进入下一阶段' : '集齐钥匙后可开启时空门');
    }
  }

  /** 移动越过阈值，正式开始拖拽：创建跟手幽灵 + 隐藏原物品 + 高亮可合成格 */
  private _beginDrag(): void {
    if (this._dragStarted || this._dragSrcIndex < 0 || !this._dragItemId) return;
    if (
      EventBoardManager.isRewardBoxCollectibleCell(this._dragSrcIndex)
      && !EventBoardManager.isRewardBoxMergeableCell(this._dragSrcIndex)
    ) return;
    this._dragStarted = true;
    this._createDragGhost(this._dragItemId);
    this._itemViews[this._dragSrcIndex].visible = false;
    this._setMergeHints(this._dragSrcIndex, true);
  }

  private _setupCanvasDrag(): void {
    const canvas = Game.app.view as any;
    if (!canvas?.addEventListener) return;

    canvas.addEventListener('pointermove', (e: any) => {
      if (!this._isOpen || this._dragSrcIndex < 0) return;
      const d = this._rawToDesign(e);
      if (Number.isNaN(this._dragStartDesign.x)) {
        this._dragStartDesign = { x: d.x, y: d.y };
      }
      if (!this._dragStarted) {
        const dx = d.x - this._dragStartDesign.x;
        const dy = d.y - this._dragStartDesign.y;
        if (dx * dx + dy * dy < DRAG_THRESHOLD * DRAG_THRESHOLD) return;
        this._beginDrag();
      }
      this._moveDragGhost(d);
    });

    const handleUp = (e: any) => {
      if (!this._isOpen || this._dragSrcIndex < 0) return;
      const src = this._dragSrcIndex;
      const d = this._rawToDesign(e);
      const started = this._dragStarted;
      this._clearDragGhost();

      if (!started) {
        // 纯点击（未起拖，幽灵从未创建、物品也未隐藏）
        const cell = EventBoardManager.cells[src];
        const def = cell?.itemId ? ITEM_DEFS.get(cell.itemId) : null;
        // 货币块：双击领取（与主棋盘一致）
        if (def?.category === Category.CURRENCY) {
          const now = Date.now();
          if (src === this._lastCurrencyTapIndex && now - this._lastCurrencyTapTime < CURRENCY_DOUBLE_TAP_MS) {
            this._resetCurrencyTapDetect();
            const r = EventBoardManager.collectCurrencyCell(src);
            if (!r.collected) return;
            ToastMessage.show(`获得${this._currencyCollectLabel(r.type)} +${r.amount ?? 0}`);
            this._refresh();
            return;
          }
          this._lastCurrencyTapIndex = src;
          this._lastCurrencyTapTime = now;
          if (this._currencyTapTimer) clearTimeout(this._currencyTapTimer);
          this._currencyTapTimer = setTimeout(() => {
            this._currencyTapTimer = null;
            this._itemViews[src]?.playTapFeedback();
          }, CURRENCY_DOUBLE_TAP_MS);
          return;
        }
        if (EventBoardManager.isRewardBoxCollectibleCell(src)) {
          const now = Date.now();
          if (src === this._lastCurrencyTapIndex && now - this._lastCurrencyTapTime < CURRENCY_DOUBLE_TAP_MS) {
            this._resetCurrencyTapDetect();
            const r = EventBoardManager.collectRewardBoxItemCell(src);
            if (!r.collected) return;
            ToastMessage.show(`已放入奖励箱：${r.name ?? '奖励'}`);
            this._refresh();
            return;
          }
          this._lastCurrencyTapIndex = src;
          this._lastCurrencyTapTime = now;
          if (this._currencyTapTimer) clearTimeout(this._currencyTapTimer);
          this._currencyTapTimer = setTimeout(() => {
            this._currencyTapTimer = null;
            this._itemViews[src]?.playTapFeedback();
          }, CURRENCY_DOUBLE_TAP_MS);
          return;
        }
        this._resetCurrencyTapDetect();
        // 活动满级产出工具（主线 L13 / 点翠 L8）：点击随机产出奖励块，不耗体力
        if (EventBoardManager.isEventProducerCell(src)) {
          const r = EventBoardManager.produceEventToolCell(src);
          if (r.result === 'noSpace') {
            ToastMessage.show('棋盘空位不足，先清理一下');
          } else if (r.result === 'produced') {
            const name = r.itemId ? ITEM_DEFS.get(r.itemId)?.name ?? r.itemId : '奖励';
            ToastMessage.show(r.remaining > 0
              ? `产出 ${name}，还剩 ${r.remaining} 次`
              : `产出 ${name}，已用完并消失`);
            if (typeof r.cellIndex === 'number') this._playDropBounce(r.cellIndex);
          }
          this._refresh();
          return;
        }
        // 容器（宝箱/红包/钻石袋/体力箱）：开箱散落货币块
        if (EventBoardManager.isContainerCell(src)) {
          const r = EventBoardManager.openContainerCell(src);
          if (r.result === 'noSpace') ToastMessage.show('棋盘空位不足，先清理一下');
          else if (r.result === 'partial') ToastMessage.show(`散落 ${r.placed} 件，还剩 ${r.remaining} 件（清空位后继续点）`);
          else if (r.result === 'opened') ToastMessage.show(r.placed > 0 ? `开箱散落 ${r.placed} 件，双击收取` : '开箱完成');
          this._refresh();
          return;
        }
        return;
      }

      const dst = this._hitTest(d);
      if (dst >= 0 && dst !== src) {
        const result = EventBoardManager.moveOrMerge(src, dst);
        if (result === 'blocked') ToastMessage.show('这里不能合成或移动');
        else if (result === 'merged' || result === 'unlocked') this._playDropBounce(dst);
        if (result === 'unlocked') ToastMessage.show('解锁新格子');
      }
      this._refresh();
    };

    canvas.addEventListener('pointerup', handleUp);
    canvas.addEventListener('pointercancel', () => {
      if (this._dragSrcIndex < 0) return;
      this._clearDragGhost();
      this._refresh();
    });
  }

  private _rawToDesign(e: any): { x: number; y: number } {
    const t0 = e.touches?.[0] ?? e.changedTouches?.[0];
    const cx = e.clientX ?? t0?.clientX ?? e.x ?? 0;
    const cy = e.clientY ?? t0?.clientY ?? e.y ?? 0;
    const k = Game.designWidth / Game.screenWidth;
    return { x: cx * k, y: cy * k };
  }

  private _createDragGhost(itemId: string): void {
    this._clearDragGhostNode();
    const ghost = new ItemView();
    ghost.setItem(itemId);
    ghost.scale.set(this._cellScale * 1.08);
    ghost.alpha = 0.92;
    this._ghostLayer.addChild(ghost);
    this._dragGhost = ghost;
  }

  private _moveDragGhost(d: { x: number; y: number }): void {
    if (!this._dragGhost) return;
    const w = CELL * 1.08;
    this._dragGhost.position.set(d.x - w / 2, d.y - w / 2 - CELL * 0.35);

    const hover = this._hitTest(d);
    if (hover === this._hoverIndex) return;
    if (this._hoverIndex >= 0 && this._hoverIndex < this._wrappers.length) {
      this._wrappers[this._hoverIndex].scale.set(1);
    }
    this._hoverIndex = -1;
    if (hover >= 0 && hover !== this._dragSrcIndex && this._isValidTarget(hover)) {
      this._wrappers[hover].scale.set(1.06);
      this._hoverIndex = hover;
    }
  }

  private _isValidTarget(index: number): boolean {
    const src = this._dragSrcIndex;
    if (src < 0) return false;
    return EventBoardManager.isDropTarget(src, index);
  }

  /** 拿起物品时高亮可合成的同款格（复用 CellView 的合成伙伴提示） */
  private _setMergeHints(srcIndex: number, on: boolean): void {
    if (!on) {
      for (const cv of this._cellViews) cv.setMergePartnerHint(false);
      return;
    }
    const src = EventBoardManager.cells[srcIndex];
    if (!src?.itemId || !getMergeResultId(src.itemId)) return;
    for (let i = 0; i < this._cellViews.length; i++) {
      if (i === srcIndex) continue;
      if (EventBoardManager.canMerge(srcIndex, i)) {
        this._cellViews[i].setMergePartnerHint(true);
      }
    }
  }

  private _playDropBounce(index: number): void {
    const iv = this._itemViews[index];
    if (!iv) return;
    iv.scale.set(this._cellScale * 1.15);
    TweenManager.to({
      target: iv.scale,
      props: { x: this._cellScale, y: this._cellScale },
      duration: 0.2,
      ease: Ease.easeOutBack,
    });
  }

  /** 仅移除幽灵节点（不重置拖拽状态） */
  private _clearDragGhostNode(): void {
    if (this._dragGhost) {
      this._ghostLayer.removeChild(this._dragGhost);
      this._dragGhost.destroy({ children: true });
      this._dragGhost = null;
    }
  }

  private _resetCurrencyTapDetect(): void {
    if (this._currencyTapTimer) {
      clearTimeout(this._currencyTapTimer);
      this._currencyTapTimer = null;
    }
    this._lastCurrencyTapIndex = -1;
    this._lastCurrencyTapTime = 0;
  }

  private _clearDragGhost(): void {
    this._clearDragGhostNode();
    if (this._dragSrcIndex >= 0 && this._dragSrcIndex < this._itemViews.length) {
      this._itemViews[this._dragSrcIndex].visible = true;
      this._cellViews[this._dragSrcIndex]?.setHighlight(false);
    }
    if (this._hoverIndex >= 0 && this._hoverIndex < this._wrappers.length) {
      this._wrappers[this._hoverIndex].scale.set(1);
    }
    this._setMergeHints(-1, false);
    this._dragSrcIndex = -1;
    this._dragItemId = null;
    this._dragStarted = false;
    this._hoverIndex = -1;
  }

  private _hitTest(d: { x: number; y: number }): number {
    const gx = d.x - this._gridStartX;
    const gy = d.y - this._gridStartY;
    if (gx < 0 || gy < 0) return -1;
    const step = CELL + GAP;
    const col = Math.floor(gx / step);
    const row = Math.floor(gy / step);
    if (col < 0 || col >= EVENT_BOARD_COLS || row < 0 || row >= EventBoardManager.currentRows) return -1;
    if (gx - col * step > CELL || gy - row * step > CELL) return -1;
    const idx = row * EVENT_BOARD_COLS + col;
    return idx < EventBoardManager.currentTotal ? idx : -1;
  }
}
