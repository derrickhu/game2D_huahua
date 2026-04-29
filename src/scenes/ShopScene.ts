/**
 * 花店场景 — 参考四季物语的"故事/装修场景"
 *
 * 从合成棋盘场景切换过来的独立全屏场景：
 * - 全屏展示花店内部，有角色、装饰家具、温馨氛围
 * - 装修进度条（解锁装饰的收集进度）
 * - 可交互元素：装修入口、装扮入口、图鉴入口
 * - 左侧活动入口（签到、任务等）
 * - 右下角大的返回按钮，切回合成棋盘
 * - 顶部复用 TopBar（花愿/体力/钻石/内购商店；星星进度在下方进度条）
 *
 * 对标四季物语第二张截图的交互体验
 */
import * as PIXI from 'pixi.js';
import { Scene, SceneManager } from '@/core/SceneManager';
import { Game } from '@/core/Game';
import { getNextLevelStarRequired } from '@/config/StarLevelConfig';
import { LevelManager } from '@/managers/LevelManager';
import { EventBus } from '@/core/EventBus';
import { OverlayManager } from '@/core/OverlayManager';
import { RewardFlyCoordinator, type RewardFlyBindings } from '@/core/RewardFlyCoordinator';
import { TweenManager, Ease } from '@/core/TweenManager';
import { TopBar, TOP_BAR_HEIGHT } from '@/gameobjects/ui/TopBar';
import { DecorationManager } from '@/managers/DecorationManager';
import { FURNITURE_TRAY_SPAWN_ROOM_LOCAL, RoomLayoutManager, type FurniturePlacement } from '@/managers/RoomLayoutManager';
import { CurrencyManager } from '@/managers/CurrencyManager';
import { CheckInManager } from '@/managers/CheckInManager';
import { QuestManager } from '@/managers/QuestManager';
import { SaveManager } from '@/managers/SaveManager';
import { DressUpManager } from '@/managers/DressUpManager';
import { getOwnerShopDisplayScale } from '@/config/DressUpConfig';
import { FurnitureDragSystem } from '@/systems/FurnitureDragSystem';
import {
  FurnitureTray,
  FURNITURE_TRAY_H,
  FURNITURE_TRAY_OPEN_OFFSET_UP,
  FURNITURE_TRAY_OPEN_NUDGE_DOWN,
} from '@/gameobjects/ui/FurnitureTray';
import { RoomEditToolbar } from '@/gameobjects/ui/RoomEditToolbar';
import { TextureCache } from '@/utils/TextureCache';
import { DECO_MAP, DecoDef, DecoSlot, SHOP_FURNITURE_TEX_BASE_PX } from '@/config/DecorationConfig';
import { DESIGN_WIDTH, COLORS, FONT_FAMILY } from '@/config/Constants';
import { roomDepthZForPlacement, roomDepthZForOwner } from '@/config/RoomDepthSort';
import { ToastMessage } from '@/gameobjects/ui/ToastMessage';
import { LevelUpPopup } from '@/gameobjects/ui/LevelUpPopup';
import { LIVE_HOUSE_THUMB_CAPTURE_MAX, WORLD_MAP_UNLOCK_LEVEL } from '@/config/WorldMapConfig';
import { RewardBoxManager } from '@/managers/RewardBoxManager';
import { WarehouseManager } from '@/managers/WarehouseManager';
import { ITEM_DEFS } from '@/config/ItemConfig';
import { takePendingPlaceDeco } from '@/core/DecoPlaceIntent';
import { SoundSystem } from '@/systems/SoundSystem';
import { TutorialManager, TutorialStep } from '@/managers/TutorialManager';
import { AffinityManager } from '@/managers/AffinityManager';
import { TutorialOverlay } from '@/systems/TutorialOverlay';
import { playShopDecorationStarFly } from '@/gameobjects/ui/ShopDecorationStarFly';
import { Platform } from '@/core/PlatformService';
import { SocialManager } from '@/managers/SocialManager';
import { SettingsPanel } from '@/gameobjects/ui/SettingsPanel';

// ── 布局常量 ──
const PROGRESS_BAR_W = 400;
const PROGRESS_BAR_H = 28;
const RETURN_BTN_SIZE = 80;   // ← 放大返回按钮

/** 底部浅绿条逻辑顶边 y = h - offset；大地图整体须在此线之下（不冒出条外）；随大地图放大+上移留高 */
const SHOP_BOTTOM_STRIP_TOP_OFFSET = 280;
/** 大地图（图标+「地图」字）底边与「营业」圆形上沿的间距 */
const WORLD_MAP_ABOVE_OPERATE_GAP = 8;
/** 相对自动排版结果整体上移（像素） */
const WORLD_MAP_BTN_LIFT_PX = 50;
/** 大地图入口：图标半径（逻辑 px） */
const WORLD_MAP_ICON_R = 40;
/** 「地图」字号；与 WORLD_MAP_LABEL_Y 一起参与 mapExtentBelowCenter 估算 */
const WORLD_MAP_LABEL_FONT = 14;
const WORLD_MAP_LABEL_H = 18;
/** 左下隐藏功能条：收起态小竖签 + 展开态横条 */
const MISC_DRAWER_Y_FROM_BOTTOM = 236;
const MISC_DRAWER_TAB_W = 24;
const MISC_DRAWER_TAB_H = 74;
const MISC_DRAWER_PANEL_H = 76;
const MISC_DRAWER_PANEL_SIDE_PAD = 14;
const MISC_DRAWER_ITEM_W = 74;
const MISC_DRAWER_ITEM_GAP = 10;

/** 与 FurnitureTray 一致，避免遮挡过多场景 */
/** 编辑态托盘顶边设计坐标：logicH - 高度 - 上移量 */
const trayOpenTopY = (logicH: number) =>
  logicH -
  FURNITURE_TRAY_H -
  FURNITURE_TRAY_OPEN_OFFSET_UP +
  FURNITURE_TRAY_OPEN_NUDGE_DOWN;

/** 托盘内「完成装修」：顶部水平居中，贴在手柄带下方。 */
const TRAY_EDIT_COMPLETE_TOP_Y = 36;
const TRAY_EDIT_COMPLETE_MAX_W = 268;
const TRAY_EDIT_COMPLETE_MAX_H = 72;

/** 「装修花店」主按钮宽度（与 _buildEditButton 一致） */
const EDIT_MAIN_BTN_W = (): number => Math.round(DESIGN_WIDTH * 0.58);
const EDIT_MAIN_BTN_H = 76;
const EDIT_MAIN_BTN_R = 22;
/** 标题字相对按钮中心的水平偏移（略偏右，给左侧施工图标留空） */
const EDIT_MAIN_BTN_LABEL_OFFSET_X = 24;

/**
 * 底部「装修花店」标题：柔和圆角字感（重字重 + 描边），配色走暖花粉橘系，与仓库紫系区分；阴影刻意偏弱。
 */
const SHOP_EDIT_BTN_LABEL_STYLE: Partial<PIXI.ITextStyle> = {
  fontSize: 25,
  fill: 0xfffcf8,
  fontFamily: FONT_FAMILY,
  fontWeight: '900',
  stroke: 0xe8a598,
  strokeThickness: 3,
  dropShadow: true,
  dropShadowColor: 0x8d6e63,
  dropShadowAlpha: 0.14,
  dropShadowBlur: 1,
  dropShadowDistance: 1,
};

/** 花店建筑竖直位置：中心 Y ≈ logicH * ratio + offset，ratio 增大则整体下移（原 0.405 偏上易顶到进度条） */
const SHOP_BUILDING_CENTER_Y_RATIO = 0.442;
const SHOP_BUILDING_ANCHOR_OFFSET_Y = 18;

/** 装修/花店场景中店主全身像目标高度（设计分辨率）。基准原为 150，现为 ×1.1。 */
const SHOP_OWNER_TARGET_H = 165;
/** 店主点击热区（锚点在脚底）：相对原 Circle(0,-40,60) 同比例 ×1.1 */
const SHOP_OWNER_HIT_CY = -44;
const SHOP_OWNER_HIT_R = 66;

/** 非编辑模式：家具双击进装修的连点间隔（ms） */
const SHOP_DOUBLE_TAP_MS = 300;
/** 非编辑模式：在店主上按下后，手指移动超过该屏幕像素即开始拖动（跟手，无需长按等待） */
const SHOP_OWNER_DRAG_THRESHOLD_PX = 12;

// ── 颜色（偏白天花店，与合成页明度更接近；无 house_bg 时 fallback 不再用夜间深蓝） ──
const C = {
  BG_TOP: 0xE8F0E5,          // 浅薄荷灰绿 fallback
  BG_BOTTOM: 0xC8D9C4,       // 柔和绿底（备用）
  FLOOR: 0x8B7355,           // 地板色
  WALL: 0x5D4E37,            // 墙壁色
  WARM_LIGHT: 0xFFF0D8,      // 略偏晨黄的暖光
  PROGRESS_BG: 0xFFE0C0,     // 进度条背景
  PROGRESS_FILL: 0xFF8C69,   // 进度条填充
  PROGRESS_BORDER: 0xD4A574, // 进度条边框
  ACTIVITY_BG: 0xFFFFFF,     // 活动按钮底色
  RETURN_BG: 0x4CAF50,       // 返回按钮底色（绿色，参考四季物语）
  RETURN_ARROW: 0xFFFFFF,    // 返回箭头色
  SIDE_BTN_BG: 0xFFFFFF,     // 侧边胶囊按钮底色
  SIDE_BTN_SHADOW: 0x000000, // 侧边按钮阴影
};

/** 侧边功能按钮定义 */
interface SideBtnDef {
  id: string;
  icon: string;       // 主图标占位（纹理不可用时用 label 首字）
  texKey?: string;     // TextureCache 图标 key
  label: string;
  event: string;
  iconBg: number;
  labelColor: number;
}

interface MiscDrawerBtnDef {
  id: string;
  label: string;
  shortLabel: string;
  fill: number;
  stroke: number;
}

/** 左下角横排 — 家具 / 装扮（无遮罩，大图标） */
const DECO_PAIR_BUTTONS: SideBtnDef[] = [
  { id: 'deco',    icon: '', texKey: 'icon_furniture', label: '家具', event: 'nav:openDeco',    iconBg: 0xFFB347, labelColor: 0xD48B2E },
  { id: 'dressup', icon: '', texKey: 'icon_dress',      label: '装扮', event: 'nav:openDressup', iconBg: 0xFF7EB3, labelColor: 0xE0559C },
];

/** 左上角 — 图鉴竖排：花语图鉴 / 友谊卡（friend codex 在玩家 6 级前隐藏，由 ShopScene 在 _buildLeftTopButtons 中按等级控制可见性） */
const LEFT_TOP_BUTTONS: SideBtnDef[] = [
  { id: 'album',  icon: '', texKey: 'icon_book',          label: '图鉴',   event: 'nav:openAlbum',       iconBg: 0xA78BFA, labelColor: 0x7C5FC5 },
  { id: 'affinity_codex', icon: '', texKey: 'affinity_codex_btn', label: '友谊卡', event: 'affinityCodex:open', iconBg: 0xFFB1CC, labelColor: 0xC75D8B },
];

/** 右侧 — 活动快捷按钮（签到/任务） */
const RIGHT_BUTTONS: SideBtnDef[] = [
  { id: 'checkin', icon: '', texKey: 'icon_checkin', label: '签到', event: 'nav:openCheckIn', iconBg: 0xFFA726, labelColor: 0xD48B2E },
  { id: 'quest',   icon: '', texKey: 'icon_quest',   label: '任务', event: 'nav:openQuest',   iconBg: 0x42A5F5, labelColor: 0x1976D2 },
];

/** 左下折叠冷门功能区；当前先放「游戏圈」，后续可继续追加。 */
const MISC_DRAWER_BUTTONS: MiscDrawerBtnDef[] = [
  { id: 'invite_friend', label: '邀友', shortLabel: '邀', fill: 0xFFB347, stroke: 0xD48B2E },
  { id: 'settings', label: '设置', shortLabel: '设', fill: 0xA78BFA, stroke: 0x7C5FC5 },
  { id: 'game_club', label: '游戏圈', shortLabel: '圈', fill: 0x8BCF63, stroke: 0x4D8F34 },
];

export class ShopScene implements Scene {
  readonly name = 'shop';
  readonly container: PIXI.Container;

  private _topBar!: TopBar;
  private _progressText!: PIXI.Text;
  private _progressBar!: PIXI.Graphics;
  private _progressFill!: PIXI.Graphics;
  /** 进度条整行容器（用于星星飞入目标定位） */
  private _progressBarRoot!: PIXI.Container;
  /** 左侧星标 + 中央等级数字（脉冲整组） */
  private _progressStarGroup: PIXI.Container | null = null;
  /** 用于检测花店顶条「累积星星」是否变化，避免首帧与重复刷新误触 */
  private _lastShopProgressStar: number | null = null;
  private _progressLevelText: PIXI.Text | null = null;
  /** 飞星动画层（盖在房间之上） */
  private _starFlyLayer!: PIXI.Container;
  /** 装修全屏遮罩打开时，进度条+飞星曾挂到 overlay，关闭时还原 */
  private _shopHudLiftedForDeco = false;
  private _shopHudSavedIndices: { progress: number; star: number } | null = null;
  /** 升星/星级礼包预览弹窗 */
  private _levelUpPopup!: LevelUpPopup;
  private _returnBtn!: PIXI.Container;
  private _roomContainer!: PIXI.Container;
  private _activityBtns: Map<string, { container: PIXI.Container; redDot: PIXI.Graphics }> = new Map();

  // ── 编辑模式相关 ──
  private _isEditMode = false;
  private _editBtn!: PIXI.Container;
  private _furnitureTray!: FurnitureTray;
  /** 编辑态托盘右下角「完成编辑」贴图（与 _editBtn 互斥显示） */
  private _editCompletePill: PIXI.Container | null = null;
  private _editToolbar!: RoomEditToolbar;
  private _shopBuildingSprite: PIXI.Sprite | null = null;
  private _textureRefreshUnsub: (() => void) | null = null;
  private _pendingPlaceTextureUnsub: (() => void) | null = null;

  // ── 大地图（面板在 OverlayManager，此处仅入口按钮） ──
  private _worldMapBtn: PIXI.Container | null = null;
  /** 左下隐藏功能条：收起竖签 + 展开横条 */
  private _miscDrawerRoot: PIXI.Container | null = null;
  private _miscDrawerTab: PIXI.Container | null = null;
  private _miscDrawerArrow: PIXI.Graphics | null = null;
  private _miscDrawerPanel: PIXI.Container | null = null;
  private _miscDrawerExpanded = false;
  private _miscDrawerButtons = new Map<string, PIXI.Container>();
  /** 微信原生游戏圈按钮（透明热区，视觉仍由 Canvas 绘制） */
  private _gameClubNativeBtn: any = null;

  // ── 教程引导 ──
  private _tutorialOverlay: TutorialOverlay | null = null;

  // ── 店主 ──
  private _ownerContainer: PIXI.Container | null = null;
  private _ownerSprite: PIXI.Sprite | null = null;

  private readonly _onDressUpEquipped = (): void => {
    this._refreshShopOwnerOutfitTextures();
  };

  private readonly _onDecorationShopStarFly = (payload: { globalX: number; globalY: number; amount: number }): void => {
    if (SceneManager.current?.name !== 'shop') return;
    this._playStarFlyFromGlobal(payload.globalX, payload.globalY, payload.amount);
  };

  private readonly _onShopCurrencyForProgress = (): void => {
    this._updateProgressBar();
  };

  /** 大地图切换装修房后刷新房间底板、家具与店主站位 */
  private readonly _onRenovationSceneChanged = (): void => {
    if (SceneManager.current?.name !== 'shop') return;
    this._refreshShopBuildingTexture();
    this._renderFurnitureLayout();
    this._updateProgressBar();
    const w = DESIGN_WIDTH;
    const h = Game.logicHeight;
    const centerX = w / 2;
    const centerY = h * SHOP_BUILDING_CENTER_Y_RATIO;
    const savedPos = RoomLayoutManager.ownerPos;
    const ownerX = savedPos?.x ?? (centerX + 140);
    const ownerY = savedPos?.y ?? (centerY + 120);
    if (this._ownerContainer) {
      this._ownerContainer.position.set(ownerX, ownerY);
      this._ownerContainer.zIndex = roomDepthZForOwner(ownerY);
      this._roomContainer.sortChildren();
    }
  };

  private readonly _onWorldMapSwitchScene = (sceneId: string): void => {
    CurrencyManager.setActiveRenovationScene(sceneId);
    if (!this._isEditMode) {
      this._enterEditMode();
    }
  };

  /** 花店内升星：弹窗展示奖励；确定后货币飞顶栏、宝箱飞回「营业返回」钮再入库 */
  private readonly _onShopLevelUp = (level: number, reward: any, oldLevel?: number): void => {
    if (SceneManager.current?.name !== 'shop') return;
    const flyTarget = this._returnBtn?.toGlobal(new PIXI.Point(0, 0));
    this._levelUpPopup.show(
      level,
      {
        huayuan: 0,
        stamina: reward.stamina ?? 0,
        diamond: reward.diamond ?? 0,
        rewardBoxItems: reward.rewardBoxItems,
      },
      {
        rewardFlyTargetGlobal: flyTarget ?? undefined,
        previousLevel: oldLevel,
        onGrantRewardBoxItems: entries => {
          let any = false;
          for (const { itemId, count } of entries) {
            if (ITEM_DEFS.has(itemId) && count > 0) {
              RewardBoxManager.addItem(itemId, count);
              any = true;
            }
          }
          if (any) SaveManager.save();
        },
        onFullyClosed: () => {
          EventBus.emit('shop:levelUpPopupClosed');
        },
      },
    );
    OverlayManager.bringToFront();
    this._levelUpPopup.parent?.sortChildren();
  };
  private _settingsPanel: SettingsPanel | null = null;

  /** 装修面板全屏遮罩：把星级进度条+飞星层提到 overlay，盖在遮罩之上 */
  private readonly _onDecoPanelBackdrop = (payload: { open: boolean }): void => {
    if (SceneManager.current?.name !== 'shop') return;
    if (payload.open) this._liftShopHudOverDecoBackdrop();
    else this._restoreShopHudAfterDecoPanel();
  };

  private _blinkTimer = 0;
  private _blinkInterval = 3.5;
  private _isBlinking = false;
  private _ownerDragging = false;
  private _ownerDragOffset = { x: 0, y: 0 };
  private _onOwnerRawMove: ((e: any) => void) | null = null;
  private _onOwnerRawUp: ((e: any) => void) | null = null;
  /** 非编辑模式：在店主上按下待判定（点按对话 vs 移动拖动） */
  private _ownerPointerDownOwner: PIXI.Container | null = null;
  private _ownerPointerDownId: number | null = null;
  private _ownerPressStartClient: { x: number; y: number } | null = null;
  /** 非编辑模式：家具双击进装修的第一下计时 */
  private _furnitureBrowseTapTimer: ReturnType<typeof setTimeout> | null = null;
  private _furnitureBrowsePendingDecoId: string | null = null;

  // ── 编辑模式缩放相关 ──
  private _viewScale = 1.0;                   // 当前视图缩放倍数
  private _viewScaleMin = 1.0;
  private _viewScaleMax = 2.0;
  /** 装修模式缩放后平移视图（设计坐标，叠在 position 上） */
  private _roomPanX = 0;
  private _roomPanY = 0;
  /** 单指拖场景平移（点在底板/空白处） */
  private _roomPanDragging = false;
  private _roomPanPointerId = 0;
  private _roomPanDragStartClientX = 0;
  private _roomPanDragStartClientY = 0;
  private _roomPanDragStartPanX = 0;
  private _roomPanDragStartPanY = 0;
  private _onRoomPanCanvasMove: ((ev: PointerEvent) => void) | null = null;
  private _onRoomPanCanvasUp: ((ev: PointerEvent) => void) | null = null;
  /** 编辑模式下垫在建筑背后的全屏命中层，便于点在留白处也能平移 */
  private _roomPanHitLayer: PIXI.Graphics | null = null;
  /** 编辑模式：贴右缘的缩放滑杆 */
  private _zoomSlider: PIXI.Container | null = null;
  private _zoomSliderThumb: PIXI.Graphics | null = null;
  /** 滑杆可视高度（触摸区会再上下各扩一点） */
  private _zoomSliderTrackH = 280;
  private _zoomSliderDragging = false;
  /** 已为 true 时才开始改缩放（长按或滑出阈值后） */
  private _zoomSliderDragActive = false;
  private _zoomSliderLastTap = 0;
  private _zoomSliderPointerId = 0;
  private _onZoomSliderCanvasMove: ((e: Event) => void) | null = null;
  private _onZoomSliderCanvasUp: ((e: Event) => void) | null = null;
  // pinch 手势追踪
  private _pinchPointers = new Map<number, { x: number; y: number }>();
  private _pinchStartDist = 0;
  private _pinchStartScale = 1;
  private _onPinchDown: ((e: any) => void) | null = null;
  private _onPinchMove: ((e: any) => void) | null = null;
  private _onPinchUp: ((e: any) => void) | null = null;

  constructor() {
    this.container = new PIXI.Container();
  }

  onEnter(): void {
    // 确保容器 transform 干净
    this.container.position.set(0, 0);
    this.container.scale.set(1, 1);
    this.container.pivot.set(0, 0);
    this.container.alpha = 1;

    // 初始化房间布局管理器
    RoomLayoutManager.init();

    this._textureRefreshUnsub?.();
    this._textureRefreshUnsub = TextureCache.observeTextureDependencies(
      { groups: ['main', 'shop', 'deco', 'items', 'panels', 'affinity', 'customers', 'ownerOutfits'] },
      () => {
        if (SceneManager.current?.name !== 'shop') return;
        this._refreshActivityButtonTextures();
        this._refreshShopBuildingTexture();
        if (this._isEditMode) {
          this._ensureEditModeFurnitureSprites();
        } else {
          this._renderFurnitureLayout();
        }
        this._refreshShopOwnerOutfitTextures();
        this._customerScrollArea?.refresh();
        if (this._isEditMode) this._ensureEditCompletePill();
      },
    );
    void TextureCache.preloadShopScene().catch(err => {
      console.warn('[ShopScene] 花店首屏资源预加载未完全成功:', err);
    });

    this._build();
    this._playEnterAnim();
    Game.ticker.add(this._update, this);

    const pendingPlace = takePendingPlaceDeco();
    if (pendingPlace) {
      requestAnimationFrame(() => this._consumePendingPlaceDeco(pendingPlace));
    }

    RewardFlyCoordinator.setBindings(this._createShopRewardFlyBindings());

    SoundSystem.playShopBGM();

    // 教程：从合成页切入花店时推进步骤，然后绑定花店引导 UI
    if (TutorialManager.isActive) {
      void TextureCache.preloadTutorialDeco();
      if (TutorialManager.currentStep === TutorialStep.SWITCH_TO_SHOP) {
        TutorialManager.advanceTo(TutorialStep.SHOP_TOUR);
      }
      if (TutorialManager.isShopSceneStep()
        || TutorialManager.currentStep === TutorialStep.SWITCH_BACK_MERGE) {
        this._tutorialOverlay = new TutorialOverlay(this.container);
        this._tutorialOverlay.bind('shop');
      }
    }
  }

  onExit(): void {
    // 清理教程引导
    if (this._tutorialOverlay) {
      this._tutorialOverlay.destroy();
      this._tutorialOverlay = null;
    }

    this._restoreShopHudAfterDecoPanel();
    RewardFlyCoordinator.setBindings(null);
    this._textureRefreshUnsub?.();
    this._textureRefreshUnsub = null;
    this._pendingPlaceTextureUnsub?.();
    this._pendingPlaceTextureUnsub = null;
    this._clearPendingDoubleTapStates();
    EventBus.off('decoration:room_style', this._refreshShopBuildingTexture);
    EventBus.off('decoration:decoPanelBackdrop', this._onDecoPanelBackdrop);
    EventBus.off('dressup:equipped', this._onDressUpEquipped);
    EventBus.off('decoration:shopStarFly', this._onDecorationShopStarFly);
    EventBus.off('currency:changed', this._onShopCurrencyForProgress);
    EventBus.off('level:up', this._onShopLevelUp);
    EventBus.off('renovation:sceneChanged', this._onRenovationSceneChanged);
    EventBus.off('worldmap:switchScene', this._onWorldMapSwitchScene);
    EventBus.off('scene:switchToShop', this._onSwitchToShopConsumePendingPlace);
    this._destroyGameClubNativeButton();
    // 如果在编辑模式，退出时自动保存
    if (this._isEditMode) {
      this._exitEditMode();
    }
    // 清理店主拖拽的 canvas 事件
    this._cleanupOwnerDragEvents();
    // 无论是否编辑模式，都强制刷写布局存档（防止防抖 timer 未触发）
    RoomLayoutManager.saveNow();
    Game.ticker.remove(this._update, this);
    if (this._levelUpPopup) {
      this._levelUpPopup.parent?.removeChild(this._levelUpPopup);
      this._levelUpPopup.destroy({ children: true });
    }
    if (this._settingsPanel) {
      this._settingsPanel.parent?.removeChild(this._settingsPanel);
      this._settingsPanel.destroy({ children: true });
      this._settingsPanel = null;
    }
    this.container.removeChildren();
  }

  private _cleanupOwnerDragEvents(): void {
    const canvas = Game.app.view as any;
    if (this._onOwnerRawMove) {
      canvas.removeEventListener('pointermove', this._onOwnerRawMove);
      this._onOwnerRawMove = null;
    }
    if (this._onOwnerRawUp) {
      canvas.removeEventListener('pointerup', this._onOwnerRawUp);
      canvas.removeEventListener('pointercancel', this._onOwnerRawUp);
      this._onOwnerRawUp = null;
    }
  }

  private _build(): void {
    const w = DESIGN_WIDTH;
    const h = Game.logicHeight;

    // ============== 1. 背景（花店内部氛围） ==============
    this._buildBackground(w, h);

    // ============== 2. 花店房间内容 ==============
    this._roomContainer = new PIXI.Container();
    this._buildRoom(w, h);
    this.container.addChild(this._roomContainer);

    // ============== 3. 顶部 TopBar ==============
    this._topBar = new TopBar();
    this._topBar.position.set(0, Game.safeTop);
    this.container.addChild(this._topBar);

    // ============== 4. 装修进度条（TopBar 下方） ==============
    this._buildProgressBar(w);

    // ============== 5. 左上角按钮（图鉴） ==============
    this._buildLeftTopButtons();

    // ============== 6. 右侧快捷按钮（签到/任务） ==============
    this._buildQuickButtons();

    // ============== 7. 左下横排装修/装扮按钮（无遮罩，大图标） ==============
    this._buildDecoPairBtns();

    // ============== 7b. 左下隐藏功能条（冷门功能折叠入口） ==============
    this._buildMiscDrawer();

    // ============== 8. 右下角返回按钮（参考四季物语的大箭头） ==============
    this._buildReturnButton(w, h);

    // ============== 8b. 大地图按钮（右下营业钮正上方、落在底部浅绿条内，配置等级解锁） ==============
    this._buildWorldMapButton(w, h);

    // ============== 9. 编辑模式组件（初始隐藏） ==============
    this._furnitureTray = new FurnitureTray();
    this.container.addChild(this._furnitureTray);

    this._editToolbar = new RoomEditToolbar();
    this.container.addChild(this._editToolbar);

    // ============== 10. 编辑模式按钮（放在最后，确保在最顶层） ==============
    this._buildEditButton(w, h);

    // ============== 11. 飞星层（购买家具 → 飞入进度条） ==============
    this.container.sortableChildren = true;
    this._starFlyLayer = new PIXI.Container();
    this._starFlyLayer.zIndex = 8000;
    this._starFlyLayer.eventMode = 'none';
    this._starFlyLayer.interactiveChildren = true;
    this.container.addChild(this._starFlyLayer);

    this._levelUpPopup = new LevelUpPopup();
    this._levelUpPopup.zIndex = ShopScene._LEVEL_UP_OVERLAY_Z;
    const ov = OverlayManager.container;
    ov.addChild(this._levelUpPopup);
    this._settingsPanel = new SettingsPanel();
    ov.addChild(this._settingsPanel);
    ov.sortChildren();

    // ============== 12. 绑定事件 ==============
    this._bindEvents();
  }

  // ─────────────────── 背景 ───────────────────

  private _buildBackground(w: number, h: number): void {
    // 使用 house/bg.jpg（室外草地，TextureCache.house_bg）作为背景
    const bgTex = TextureCache.get('house_bg');
    if (bgTex) {
      const bgSprite = new PIXI.Sprite(bgTex);
      const bgScale = Math.max(w / bgTex.width, h / bgTex.height);
      bgSprite.scale.set(bgScale);
      bgSprite.anchor.set(0.5, 0.5);
      bgSprite.position.set(w / 2, h / 2);
      this.container.addChild(bgSprite);
      // 均匀薄提亮（无形状边缘），略压暗的贴图整体抬一档明度
      const lift = new PIXI.Graphics();
      lift.beginFill(0xFFFAF2, 0.045);
      lift.drawRect(0, 0, w, h * 0.88);
      lift.endFill();
      this.container.addChild(lift);
    } else {
      const bg = new PIXI.Graphics();
      bg.beginFill(C.BG_TOP);
      bg.drawRect(0, 0, w, h);
      bg.endFill();
      this.container.addChild(bg);
      const lower = new PIXI.Graphics();
      lower.beginFill(C.BG_BOTTOM, 0.45);
      lower.drawRect(0, h * 0.55, w, h * 0.45);
      lower.endFill();
      this.container.addChild(lower);
    }

    // 底部地面区域（略提亮）
    const ground = new PIXI.Graphics();
    ground.beginFill(0xE8DFD2, 0.42);
    ground.drawRect(0, h * 0.82, w, h * 0.18);
    ground.endFill();
    this.container.addChild(ground);

    // 自然环境光：模拟天光自上而下的漫反射，全宽水平带叠层，不用椭圆以免「舞台灯」感
    this._addSkyAmbientBands(w, h);
  }

  /** 水平分层环境光（无径向聚光），与等轴房间的「顶亮底稳」更一致 */
  private _addSkyAmbientBands(w: number, h: number): void {
    const g = new PIXI.Graphics();
    const maxY = h * 0.78;
    const bands = 9;
    for (let i = 0; i < bands; i++) {
      const y0 = (maxY * i) / bands;
      const y1 = (maxY * (i + 1)) / bands + 1;
      const falloff = 1 - i / (bands + 1);
      const a = 0.052 * falloff * falloff;
      g.beginFill(0xFFFCF8, a);
      g.drawRect(0, y0, w, y1 - y0);
      g.endFill();
    }
    // 极轻的暖色空气透视（仍无圆形），与 C.WARM_LIGHT 色温一致
    g.beginFill(C.WARM_LIGHT, 0.018);
    g.drawRect(0, 0, w, h * 0.35);
    g.endFill();
    this.container.addChild(g);
  }

  // ─────────────────── 花店房间 ───────────────────

  private _buildRoom(w: number, h: number): void {
    const centerX = w / 2;
    const centerY = h * SHOP_BUILDING_CENTER_Y_RATIO;

    // ---- 花店建筑底板：房间风格图 bg_room_*（TextureCache 键），缺省回退 shop.png ----
    const bgKey = DecorationManager.getRoomBgTextureKey();
    const shopTex = TextureCache.get(bgKey) ?? TextureCache.get('house_shop');
    if (shopTex) {
      this._shopBuildingSprite = new PIXI.Sprite(shopTex);
      this._layoutShopBuildingSprite(w, h, centerX, centerY);
      this._roomContainer.addChild(this._shopBuildingSprite);
    }

    // ---- 从 RoomLayoutManager 渲染所有已放置的家具 ----
    this._renderFurnitureLayout();

    // ---- 店主角色（位置可由玩家在编辑模式自定义） ----
    const savedPos = RoomLayoutManager.ownerPos;
    const ownerX = savedPos?.x ?? (centerX + 140);
    const ownerY = savedPos?.y ?? (centerY + 120);
    this._drawShopOwner(ownerX, ownerY);

  }

  /** 按当前纹理尺寸缩放、定位建筑底板 */
  private _layoutShopBuildingSprite(w: number, h: number, centerX: number, centerY: number): void {
    if (!this._shopBuildingSprite) return;
    const tex = this._shopBuildingSprite.texture;
    const shopScale = Math.min((w * 1.18) / tex.width, (h * 0.72) / tex.height);
    this._shopBuildingSprite.scale.set(shopScale);
    this._shopBuildingSprite.anchor.set(0.5, 0.5);
    this._shopBuildingSprite.position.set(centerX, centerY + SHOP_BUILDING_ANCHOR_OFFSET_Y);
  }

  /** 切换房间风格后刷新建筑贴图 */
  private _refreshShopBuildingTexture = (): void => {
    if (!this._shopBuildingSprite) return;
    const w = DESIGN_WIDTH;
    const h = Game.logicHeight;
    const centerX = w / 2;
    const centerY = h * SHOP_BUILDING_CENTER_Y_RATIO;
    const bgKey = DecorationManager.getRoomBgTextureKey();
    const tex = TextureCache.get(bgKey) ?? TextureCache.get('house_shop');
    if (!tex) return;
    this._shopBuildingSprite.texture = tex;
    this._layoutShopBuildingSprite(w, h, centerX, centerY);
    this._refreshShopBuildingPanHitAreaIfNeeded();
  };

  /** 从 RoomLayoutManager 渲染家具布局 */
  private _renderFurnitureLayout(): void {
    // 移除旧家具（保留建筑底板、店主、桌面装饰）
    const toRemove: PIXI.DisplayObject[] = [];
    for (const child of this._roomContainer.children) {
      if ((child as any)._decoId) toRemove.push(child);
    }
    toRemove.forEach(c => this._roomContainer.removeChild(c));

    // 启用排序
    this._roomContainer.sortableChildren = true;

    const layout = RoomLayoutManager.getLayout();
    for (let pi = 0; pi < layout.length; pi++) {
      const placement = layout[pi];
      const sprite = this._createFurnitureSpriteFromPlacement(placement, pi);
      if (!sprite) continue;
      this._roomContainer.addChild(sprite);

      if (!this._isEditMode) {
        this._attachFurnitureBrowseDoubleTap(sprite, placement.decoId);
      }
    }

    this._roomContainer.sortChildren();
  }

  private _createFurnitureSpriteFromPlacement(placement: FurniturePlacement, stackIndex: number): PIXI.Sprite | null {
    const deco = DECO_MAP.get(placement.decoId);
    if (!deco) return null;
    const texture = TextureCache.get(deco.icon);
    if (!texture) return null;

    const sprite = new PIXI.Sprite(texture);
    const baseSize = SHOP_FURNITURE_TEX_BASE_PX;
    const s = Math.min(baseSize / texture.width, baseSize / texture.height) * placement.scale;
    sprite.scale.set(placement.flipped ? -s : s, s);
    sprite.anchor.set(0.5, 0.8);
    sprite.position.set(placement.x, placement.y);
    const stackTie = Math.min(stackIndex, 999);
    sprite.zIndex = roomDepthZForPlacement(
      placement.y,
      placement.zLayer ?? 0,
      stackTie,
      deco,
      placement.depthManualBias,
    );
    (sprite as any)._decoId = placement.decoId;
    return sprite;
  }

  /** 编辑模式下不能全量重建；只补回被资源刷新误删或晚加载缺失的家具 Sprite。 */
  private _ensureEditModeFurnitureSprites(): void {
    const layout = RoomLayoutManager.getLayout();
    for (let pi = 0; pi < layout.length; pi++) {
      const placement = layout[pi];
      const existing = FurnitureDragSystem.getSpriteByDecoId(placement.decoId);
      if (existing && existing.parent === this._roomContainer && !existing.destroyed) continue;
      const sprite = this._createFurnitureSpriteFromPlacement(placement, pi);
      if (!sprite) continue;
      this._roomContainer.addChild(sprite);
      FurnitureDragSystem.registerSprite(sprite, placement.decoId);
    }
    FurnitureDragSystem.sortByDepth();
  }

  /** 取消家具/店主的「待判定单击」定时器（进编辑或离场景时调用） */
  private _clearPendingDoubleTapStates(): void {
    if (this._furnitureBrowseTapTimer != null) {
      clearTimeout(this._furnitureBrowseTapTimer);
      this._furnitureBrowseTapTimer = null;
    }
    this._furnitureBrowsePendingDecoId = null;
    this._clearOwnerPressTracking();
  }

  /** 非编辑模式：双击家具进入装修并选中该件 */
  private _attachFurnitureBrowseDoubleTap(sprite: PIXI.Sprite, decoId: string): void {
    sprite.eventMode = 'static';
    sprite.cursor = 'pointer';
    sprite.on('pointertap', () => {
      if (this._isEditMode) return;
      if (this._furnitureBrowseTapTimer != null) {
        clearTimeout(this._furnitureBrowseTapTimer);
        this._furnitureBrowseTapTimer = null;
        if (this._furnitureBrowsePendingDecoId === decoId) {
          this._furnitureBrowsePendingDecoId = null;
          this._enterEditModeForFurniture(decoId);
          return;
        }
      }
      this._furnitureBrowsePendingDecoId = decoId;
      this._furnitureBrowseTapTimer = setTimeout(() => {
        this._furnitureBrowseTapTimer = null;
        this._furnitureBrowsePendingDecoId = null;
      }, SHOP_DOUBLE_TAP_MS);
    });
  }

  private _enterEditModeForFurniture(decoId: string): void {
    if (this._isEditMode) return;
    const deco = DECO_MAP.get(decoId);
    this._enterEditMode(deco ? { deco } : undefined);
    FurnitureDragSystem.select(decoId);
  }

  private _designPosFromFederated(e: PIXI.FederatedPointerEvent): { x: number; y: number } {
    const designX = (e.global.x / Game.dpr) * Game.designWidth / Game.screenWidth;
    const designY = (e.global.y / Game.dpr) * Game.designHeight / Game.screenHeight;
    return { x: designX, y: designY };
  }

  private _roomLocalFromDesign(designX: number, designY: number): { x: number; y: number } {
    const c = this._roomContainer;
    const s = c.scale.x || 1;
    return {
      x: (designX - c.position.x) / s + c.pivot.x,
      y: (designY - c.position.y) / s + c.pivot.y,
    };
  }

  private _clientXYFromFederated(e: PIXI.FederatedPointerEvent): { x: number; y: number } {
    const native = e.nativeEvent as PointerEvent | MouseEvent | undefined;
    if (native && typeof (native as PointerEvent).clientX === 'number') {
      return { x: (native as PointerEvent).clientX, y: (native as PointerEvent).clientY };
    }
    const g = this._designPosFromFederated(e);
    return {
      x: (g.x / Game.designWidth) * Game.screenWidth,
      y: (g.y / Game.designHeight) * Game.screenHeight,
    };
  }

  private _beginOwnerDragFromClient(clientX: number, clientY: number, owner: PIXI.Container): void {
    if (this._ownerDragging) return;
    this._ownerDragging = true;
    const designX = clientX * Game.designWidth / Game.screenWidth;
    const designY = clientY * Game.designHeight / Game.screenHeight;
    const local = this._roomLocalFromDesign(designX, designY);
    this._ownerDragOffset.x = owner.x - local.x;
    this._ownerDragOffset.y = owner.y - local.y;
    owner.alpha = 0.7;
  }

  private _beginOwnerDrag(e: PIXI.FederatedPointerEvent, owner: PIXI.Container): void {
    const { x, y } = this._clientXYFromFederated(e);
    this._beginOwnerDragFromClient(x, y, owner);
  }

  private _clearOwnerPressTracking(): void {
    this._ownerPointerDownOwner = null;
    this._ownerPointerDownId = null;
    this._ownerPressStartClient = null;
    if (!this._ownerDragging && this._ownerSprite) {
      this._ownerSprite.tint = 0xffffff;
    }
  }

  /** 非编辑：按下店主，移动超过阈值则开始跟手拖动 */
  private _armOwnerPressForDragOrTap(e: PIXI.FederatedPointerEvent, owner: PIXI.Container): void {
    this._clearOwnerPressTracking();
    const { x: cx, y: cy } = this._clientXYFromFederated(e);
    this._ownerPressStartClient = { x: cx, y: cy };
    this._ownerPointerDownOwner = owner;
    this._ownerPointerDownId = e.pointerId;
  }

  private _ownerFullOpenTexKey(): string {
    const id = DressUpManager.getEquipped()?.id ?? 'outfit_default';
    return id === 'outfit_default' ? 'owner_full_default' : `owner_full_${id}`;
  }

  private _ownerFullBlinkTexKey(): string {
    const id = DressUpManager.getEquipped()?.id ?? 'outfit_default';
    return id === 'outfit_default' ? 'owner_full_default_blink' : `owner_full_${id}_blink`;
  }

  /** 按当前换装刷新花店店主全身贴图与缩放（含眨眼所用睁眼/闭眼键） */
  private _refreshShopOwnerOutfitTextures(): void {
    if (!this._ownerSprite) return;
    const openKey = this._ownerFullOpenTexKey();
    const blinkKey = this._ownerFullBlinkTexKey();
    const openTex = TextureCache.get(openKey) ?? TextureCache.get('owner_full_default');
    const blinkTex = TextureCache.get(blinkKey) ?? TextureCache.get('owner_full_default_blink');
    if (!openTex?.width) return;
    const useClosed = this._isBlinking && blinkTex?.width;
    this._ownerSprite.texture = useClosed ? blinkTex! : openTex;
    const outfitId = DressUpManager.getEquipped()?.id ?? 'outfit_default';
    const targetH = SHOP_OWNER_TARGET_H * getOwnerShopDisplayScale(outfitId);
    const scale = targetH / this._ownerSprite.texture.height;
    this._ownerSprite.scale.set(scale);
  }

  /** 绘制店主形象 */
  private _drawShopOwner(cx: number, cy: number): void {
    const owner = new PIXI.Container();
    owner.position.set(cx, cy);
    this._ownerContainer = owner;

    const openKey = this._ownerFullOpenTexKey();
    const tex = TextureCache.get(openKey) ?? TextureCache.get('owner_full_default');
    if (tex) {
      this._ownerSprite = new PIXI.Sprite(tex);
      this._ownerSprite.anchor.set(0.5, 1);
      const outfitId = DressUpManager.getEquipped()?.id ?? 'outfit_default';
      const targetH = SHOP_OWNER_TARGET_H * getOwnerShopDisplayScale(outfitId);
      const scale = targetH / tex.height;
      this._ownerSprite.scale.set(scale);
      owner.addChild(this._ownerSprite);
    }

    owner.zIndex = roomDepthZForOwner(cy);
    owner.eventMode = 'static';
    owner.cursor = 'pointer';
    owner.hitArea = new PIXI.Circle(0, SHOP_OWNER_HIT_CY, SHOP_OWNER_HIT_R);

    // 交互：编辑模式下单击拖动；非编辑下轻点对话、按住并滑动即跟手拖动（不进装修）
    owner.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      if (this._isEditMode) {
        this._beginOwnerDrag(e, owner);
        return;
      }
      this._armOwnerPressForDragOrTap(e, owner);
      if (this._ownerSprite) {
        this._ownerSprite.tint = 0xe8f2ff;
      }
    });

    // 使用 canvas 级别事件处理拖拽（与 FurnitureDragSystem 一致，兼容微信小游戏）
    const canvas = Game.app.view as any;
    this._onOwnerRawMove = (rawEvt: any) => {
      const clientX = rawEvt.clientX ?? rawEvt.pageX ?? 0;
      const clientY = rawEvt.clientY ?? rawEvt.pageY ?? 0;

      if (
        !this._ownerDragging
        && this._ownerPointerDownOwner
        && this._ownerPressStartClient
        && (this._ownerPointerDownId == null || rawEvt.pointerId === this._ownerPointerDownId)
      ) {
        const dx = clientX - this._ownerPressStartClient.x;
        const dy = clientY - this._ownerPressStartClient.y;
        if (Math.hypot(dx, dy) > SHOP_OWNER_DRAG_THRESHOLD_PX) {
          const o = this._ownerPointerDownOwner;
          this._clearOwnerPressTracking();
          this._beginOwnerDragFromClient(clientX, clientY, o);
        }
      }

      if (!this._ownerDragging) return;
      const designX = clientX * Game.designWidth / Game.screenWidth;
      const designY = clientY * Game.designHeight / Game.screenHeight;
      const c = this._roomContainer;
      const s = c.scale.x || 1;
      const localX = (designX - c.position.x) / s + c.pivot.x;
      const localY = (designY - c.position.y) / s + c.pivot.y;
      owner.x = localX + this._ownerDragOffset.x;
      owner.y = localY + this._ownerDragOffset.y;
      owner.zIndex = roomDepthZForOwner(owner.y);
      this._roomContainer.sortChildren();
    };
    this._onOwnerRawUp = (rawEvt: any) => {
      if (this._ownerDragging) {
        this._ownerDragging = false;
        owner.alpha = 1;
        if (this._ownerSprite) {
          this._ownerSprite.tint = 0xffffff;
        }
        RoomLayoutManager.setOwnerPos(owner.x, owner.y);
        return;
      }
      const upId = rawEvt?.pointerId;
      if (rawEvt?.type === 'pointercancel') {
        if (
          this._ownerPointerDownOwner
          && (this._ownerPointerDownId == null || upId === this._ownerPointerDownId)
        ) {
          this._clearOwnerPressTracking();
        }
        return;
      }
      // 轻点：未触发拖动阈值就松手 → 播对话
      if (
        this._ownerPointerDownOwner
        && (this._ownerPointerDownId == null || upId === this._ownerPointerDownId)
      ) {
        const tapped = this._ownerPointerDownOwner;
        this._clearOwnerPressTracking();
        if (!this._isEditMode) {
          const greetings = [
            '欢迎来到花花妙屋~',
            '今天想做什么呢？可以装修花店哦！',
            '新的花材到了，快去合成吧~',
            '花店越来越漂亮了呢！',
            '记得每天签到领奖励呀~',
          ];
          const msg = greetings[Math.floor(Math.random() * greetings.length)];
          ToastMessage.show(`店主：「${msg}」`);
          TweenManager.cancelTarget(tapped.scale);
          tapped.scale.set(0.9);
          TweenManager.to({
            target: tapped.scale,
            props: { x: 1, y: 1 },
            duration: 0.3,
            ease: Ease.easeOutBack,
          });
        }
      }
    };
    canvas.addEventListener('pointermove', this._onOwnerRawMove);
    canvas.addEventListener('pointerup', this._onOwnerRawUp);
    canvas.addEventListener('pointercancel', this._onOwnerRawUp);

    this._roomContainer.addChild(owner);
  }

  // ─────────────────── 装修进度条 ───────────────────

  private _buildProgressBar(w: number): void {
    const y = Game.safeTop + TOP_BAR_HEIGHT + 16;
    const cx = w / 2;

    const barContainer = new PIXI.Container();
    this._progressBarRoot = barContainer;
    barContainer.position.set(cx - PROGRESS_BAR_W / 2, y);
    barContainer.zIndex = 7000;
    /**
     * 须用 `passive` 而非 `none`：Pixi 7 对 `eventMode==='none'` 会整枝剪掉子树，子节点（礼包热区）永不参与命中。
     * `passive` + interactiveChildren：条身各 Graphics/Text 仍为 none，点击会穿过落到下层；仅礼包等为 static 可点。
     */
    barContainer.eventMode = 'passive';
    barContainer.interactiveChildren = true;

    // 星星图标 + 星心等级数字（level，非累积 star）
    const starGroup = new PIXI.Container();
    starGroup.eventMode = 'none';
    starGroup.position.set(-22, PROGRESS_BAR_H / 2);
    this._progressStarGroup = starGroup;
    const starTex = TextureCache.get('icon_star');
    if (starTex) {
      const starSp = new PIXI.Sprite(starTex);
      starSp.anchor.set(0.5, 0.5);
      starSp.width = 36;
      starSp.height = 36;
      starSp.eventMode = 'none';
      starGroup.addChild(starSp);
    } else {
      const fb = new PIXI.Text('★', { fontSize: 28, fontFamily: FONT_FAMILY });
      fb.anchor.set(0.5, 0.5);
      fb.eventMode = 'none';
      starGroup.addChild(fb);
    }
    const lv0 = CurrencyManager.state.level;
    this._progressLevelText = new PIXI.Text(String(lv0), {
      fontSize: 15,
      fill: 0xffffff,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: 0x8B4513,
      strokeThickness: 3,
    } as any);
    this._progressLevelText.anchor.set(0.5, 0.52);
    this._progressLevelText.eventMode = 'none';
    starGroup.addChild(this._progressLevelText);
    barContainer.addChild(starGroup);

    // 进度条背景
    this._progressBar = new PIXI.Graphics();
    this._progressBar.eventMode = 'none';
    this._progressBar.beginFill(C.PROGRESS_BG);
    this._progressBar.drawRoundedRect(0, 0, PROGRESS_BAR_W, PROGRESS_BAR_H, PROGRESS_BAR_H / 2);
    this._progressBar.endFill();
    this._progressBar.lineStyle(2, C.PROGRESS_BORDER);
    this._progressBar.drawRoundedRect(0, 0, PROGRESS_BAR_W, PROGRESS_BAR_H, PROGRESS_BAR_H / 2);
    barContainer.addChild(this._progressBar);

    // 进度条填充
    this._progressFill = new PIXI.Graphics();
    this._progressFill.eventMode = 'none';
    barContainer.addChild(this._progressFill);
    this._updateProgressBar();

    // 星级进度文字（累积星星 / 下一星级门槛）
    const star = CurrencyManager.state.star;
    const lv = CurrencyManager.state.level;
    const sceneId = CurrencyManager.state.sceneId;
    const nextReq = getNextLevelStarRequired(sceneId, lv);
    const label = nextReq >= 0 ? `${star}/${nextReq}` : `${star}`;
    this._progressText = new PIXI.Text(label, {
      fontSize: 17, fill: COLORS.TEXT_DARK, fontFamily: FONT_FAMILY, fontWeight: 'bold',
      stroke: 0xFFFFFF, strokeThickness: 2,
    });
    this._progressText.anchor.set(0.5, 0.5);
    this._progressText.position.set(PROGRESS_BAR_W / 2, PROGRESS_BAR_H / 2);
    this._progressText.eventMode = 'none';
    barContainer.addChild(this._progressText);

    // 右端礼盒：点击预览「下一星级」礼包内容
    const giftTap = new PIXI.Container();
    giftTap.position.set(PROGRESS_BAR_W + 24, PROGRESS_BAR_H / 2);
    const giftHit = 44;
    giftTap.hitArea = new PIXI.Rectangle(-giftHit / 2, -giftHit / 2, giftHit, giftHit);
    giftTap.eventMode = 'static';
    giftTap.cursor = 'pointer';
    const giftTex = TextureCache.get('icon_gift');
    if (giftTex) {
      const giftSp = new PIXI.Sprite(giftTex);
      giftSp.anchor.set(0.5, 0.5);
      giftSp.width = 30;
      giftSp.height = 30;
      giftSp.eventMode = 'none';
      giftTap.addChild(giftSp);
    } else {
      const gift = new PIXI.Text('礼', { fontSize: 20, fontFamily: FONT_FAMILY, fill: COLORS.TEXT_DARK });
      gift.anchor.set(0.5, 0.5);
      gift.eventMode = 'none';
      giftTap.addChild(gift);
    }
    // 微信等环境 pointertap 常不触发；按下在礼包热区内再松手（区内或区外）都应打开，与 HTML Pointer 行为一致
    let giftPointerArmed = false;
    giftTap.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      giftPointerArmed = true;
    });
    const tryOpenGiftPreview = (e: PIXI.FederatedPointerEvent): void => {
      e.stopPropagation();
      if (!giftPointerArmed) return;
      giftPointerArmed = false;
      setTimeout(() => {
        if (SceneManager.current?.name !== 'shop') return;
        this._showNextStarGiftPreview();
      }, 40);
    };
    giftTap.on('pointerup', tryOpenGiftPreview);
    giftTap.on('pointerupoutside', tryOpenGiftPreview);
    giftTap.on('pointercancel', () => {
      giftPointerArmed = false;
    });
    barContainer.addChild(giftTap);

    this.container.addChild(barContainer);
  }

  private _updateProgressBar(): void {
    const ratio = LevelManager.starProgress;
    const star = CurrencyManager.state.star;
    const lv = CurrencyManager.state.level;
    const sceneId = CurrencyManager.state.sceneId;
    const nextReq = getNextLevelStarRequired(sceneId, lv);

    const prevStar = this._lastShopProgressStar;
    this._lastShopProgressStar = star;
    const starCountChanged =
      this._progressStarGroup != null && prevStar !== null && prevStar !== star;

    this._progressFill.clear();
    if (ratio > 0) {
      const fillW = Math.max(PROGRESS_BAR_H, PROGRESS_BAR_W * ratio);
      this._progressFill.beginFill(C.PROGRESS_FILL);
      this._progressFill.drawRoundedRect(0, 0, fillW, PROGRESS_BAR_H, PROGRESS_BAR_H / 2);
      this._progressFill.endFill();
    }

    if (this._progressText) {
      this._progressText.text = nextReq >= 0 ? `${star}/${nextReq}` : `${star}`;
    }
    if (this._progressLevelText) {
      this._progressLevelText.text = String(lv);
    }

    if (starCountChanged) {
      this._flashProgressStarIcon();
    }
  }

  /** 高于 DecorationPanel(5000)，低于同 overlay 内升星弹窗等 */
  private static readonly _HUD_OVER_DECO_Z_PROGRESS = 5600;
  private static readonly _HUD_OVER_DECO_Z_STARFLY = 5610;
  /** 升星奖励：盖住装修面板与抬升的进度条，略低于 GM(9000) */
  private static readonly _LEVEL_UP_OVERLAY_Z = 8800;

  private _liftShopHudOverDecoBackdrop(): void {
    if (this._shopHudLiftedForDeco) return;
    if (!this._progressBarRoot || !this._starFlyLayer) return;
    if (this._progressBarRoot.parent !== this.container || this._starFlyLayer.parent !== this.container) {
      return;
    }

    const pIdx = this.container.getChildIndex(this._progressBarRoot);
    const sIdx = this.container.getChildIndex(this._starFlyLayer);
    this._shopHudSavedIndices = { progress: pIdx, star: sIdx };

    this.container.removeChild(this._progressBarRoot);
    this.container.removeChild(this._starFlyLayer);

    const ov = OverlayManager.container;
    this._progressBarRoot.zIndex = ShopScene._HUD_OVER_DECO_Z_PROGRESS;
    this._starFlyLayer.zIndex = ShopScene._HUD_OVER_DECO_Z_STARFLY;
    ov.addChild(this._progressBarRoot);
    ov.addChild(this._starFlyLayer);
    ov.sortChildren();

    this._shopHudLiftedForDeco = true;
    OverlayManager.bringToFront();
  }

  private _restoreShopHudAfterDecoPanel(): void {
    if (!this._shopHudLiftedForDeco) return;
    this._shopHudLiftedForDeco = false;
    const saved = this._shopHudSavedIndices;
    this._shopHudSavedIndices = null;

    const ov = OverlayManager.container;
    if (this._progressBarRoot.parent === ov) ov.removeChild(this._progressBarRoot);
    if (this._starFlyLayer.parent === ov) ov.removeChild(this._starFlyLayer);

    this._progressBarRoot.zIndex = 7000;
    this._starFlyLayer.zIndex = 8000;
    if (saved) {
      const moves = [
        { c: this._starFlyLayer, i: saved.star },
        { c: this._progressBarRoot, i: saved.progress },
      ].sort((a, b) => b.i - a.i);
      for (const { c, i } of moves) {
        const n = this.container.children.length;
        this.container.addChildAt(c, Math.min(i, n));
      }
    } else {
      this.container.addChild(this._progressBarRoot);
      this.container.addChild(this._starFlyLayer);
    }
    this.container.sortChildren();
  }

  /** 点击进度条旁礼包：预览升至下一星级时的礼包（与实际升星发放一致） */
  private _showNextStarGiftPreview(): void {
    const preview = LevelManager.getNextStarLevelRewardPreview();
    if (!preview) {
      ToastMessage.show('当前场景已满星，暂无下一档礼包~');
      return;
    }
    const nextLv = CurrencyManager.state.level + 1;
    const payload = {
      huayuan: 0,
      stamina: preview.stamina,
      diamond: preview.diamond,
      rewardBoxItems: preview.rewardBoxItems,
      flowerSignTickets: preview.flowerSignTickets ?? 0,
    };
    const bannerTitle = `升至 ${nextLv}星 · 礼包预览`;
    if (!this._levelUpPopup) return;
    this._levelUpPopup.show(nextLv, payload, {
      previewOnly: true,
      bannerTitle,
    });
    OverlayManager.bringToFront();
    this._levelUpPopup.parent?.sortChildren();
  }

  /** 家具购买后：星星从全局坐标飞入进度条左侧星标 */
  private _playStarFlyFromGlobal(globalX: number, globalY: number, amount: number): void {
    if (!this._starFlyLayer || !this._progressBarRoot) return;
    playShopDecorationStarFly({
      flyLayer: this._starFlyLayer,
      startGlobalX: globalX,
      startGlobalY: globalY,
      targetLocalX: this._progressBarRoot.x - 22,
      targetLocalY: this._progressBarRoot.y + PROGRESS_BAR_H / 2,
      amount,
      onComplete: () => EventBus.emit('decoration:shopStarFlyComplete'),
    });
  }

  /** 累积星星数值变化时：左侧星标闪动 + 放大回弹（连续触发先取消，避免 scale 叠乘） */
  private _flashProgressStarIcon(): void {
    const g = this._progressStarGroup;
    if (!g) return;
    TweenManager.cancelTarget(g);
    TweenManager.cancelTarget(g.scale);
    const base = 1;
    g.scale.set(base, base);
    g.alpha = 1;
    TweenManager.to({
      target: g.scale,
      props: { x: base * 1.26, y: base * 1.26 },
      duration: 0.11,
      ease: Ease.easeOutQuad,
      onComplete: () => {
        TweenManager.to({
          target: g.scale,
          props: { x: base, y: base },
          duration: 0.26,
          ease: Ease.easeOutBounce,
        });
      },
    });
    TweenManager.to({
      target: g,
      props: { alpha: 0.72 },
      duration: 0.07,
      ease: Ease.easeOutQuad,
      onComplete: () => {
        TweenManager.to({
          target: g,
          props: { alpha: 1 },
          duration: 0.12,
          ease: Ease.easeOutQuad,
        });
      },
    });
  }

  // ─────────────────── 左上角按钮（图鉴） ───────────────────

  private _buildLeftTopButtons(): void {
    const btnW = 84;
    const btnH = 84;
    const gap = 10;
    const startY = Game.safeTop + TOP_BAR_HEIGHT + PROGRESS_BAR_H + 66 + btnH / 2;
    const cx = btnW / 2 + 14;

    for (let i = 0; i < LEFT_TOP_BUTTONS.length; i++) {
      const def = LEFT_TOP_BUTTONS[i];
      const y = startY + i * (btnH + gap);
      const btn = this._createSideButton(def, cx, y, btnW, btnH);
      this.container.addChild(btn.container);
      this._activityBtns.set(def.id, btn);

      // 友谊卡：6 级前隐藏，监听 level:up 解锁瞬间淡入显示
      if (def.id === 'affinity_codex') {
        const unlocked = AffinityManager.isCardSystemUnlocked();
        btn.container.visible = unlocked;
        btn.container.eventMode = unlocked ? 'static' : 'none';
        if (!unlocked) {
          const onLevelUp = (): void => {
            if (AffinityManager.isCardSystemUnlocked()) {
              btn.container.visible = true;
              btn.container.eventMode = 'static';
              btn.container.alpha = 0;
              TweenManager.to({ target: btn.container, props: { alpha: 1 }, duration: 0.25, ease: Ease.easeOutQuad });
              EventBus.off('level:up', onLevelUp);
            }
          };
          EventBus.on('level:up', onLevelUp);
        }
      }
    }
  }

  /** 左侧「友谊卡」入口须与 `AffinityManager.isCardSystemUnlocked()` 一致（编辑态结束勿强行设为可见）。 */
  private _syncAffinityCodexButtonVisibility(): void {
    const entry = this._activityBtns.get('affinity_codex');
    if (!entry) return;
    const unlocked = AffinityManager.isCardSystemUnlocked();
    entry.container.visible = unlocked;
    entry.container.eventMode = unlocked ? 'static' : 'none';
  }

  private _refreshActivityButtonTextures(): void {
    for (const def of LEFT_TOP_BUTTONS) {
      const btn = this._activityBtns.get(def.id);
      if (btn) this._refreshSideButtonIcon(btn.container, def, 84, 84);
    }
    for (const def of RIGHT_BUTTONS) {
      const btn = this._activityBtns.get(def.id);
      if (btn) this._refreshSideButtonIcon(btn.container, def, 84, 84);
    }
    for (const def of DECO_PAIR_BUTTONS) {
      const btn = this._activityBtns.get(def.id);
      if (btn) this._refreshBareIconButtonIcon(btn.container, def, 40);
    }
  }

  private _refreshSideButtonIcon(
    container: PIXI.Container,
    def: SideBtnDef,
    btnW: number,
    btnH: number,
  ): void {
    if (!def.texKey) return;
    const tex = TextureCache.get(def.texKey);
    if (!tex?.width) return;
    const old = container.children[1];
    if (old instanceof PIXI.Sprite && old.texture === tex) return;

    const halfH = btnH / 2;
    const iconSize = btnW * 0.72;
    const iconCY = -halfH * 0.15;
    const sp = new PIXI.Sprite(tex);
    sp.anchor.set(0.5);
    sp.width = iconSize;
    sp.height = iconSize;
    sp.position.set(0, iconCY);
    container.addChildAt(sp, 1);
    if (old) {
      container.removeChild(old);
      old.destroy({ children: true });
    }
  }

  private _refreshBareIconButtonIcon(container: PIXI.Container, def: SideBtnDef, iconR: number): void {
    if (!def.texKey) return;
    const tex = TextureCache.get(def.texKey);
    if (!tex?.width) return;
    const old = container.children[0];
    if (old instanceof PIXI.Sprite && old.texture === tex) return;

    const iconSize = iconR * 2;
    const sp = new PIXI.Sprite(tex);
    sp.anchor.set(0.5);
    sp.width = iconSize;
    sp.height = iconSize;
    container.addChildAt(sp, 0);
    if (old) {
      container.removeChild(old);
      old.destroy({ children: true });
    }
  }

  // ─────────────────── 左下横排装修/装扮按钮 ───────────────────

  private _buildDecoPairBtns(): void {
    const ICON_R = 40;
    const GAP = 18;
    const pairY = Game.logicHeight - 92;
    const startX = ICON_R + 14;      // 第一个按钮中心 x
    const stepX = ICON_R * 2 + GAP;  // 两按钮间距

    for (let i = 0; i < DECO_PAIR_BUTTONS.length; i++) {
      const def = DECO_PAIR_BUTTONS[i];
      const cx = startX + i * stepX;
      const btn = this._createBareIconBtn(def, cx, pairY, ICON_R);
      this.container.addChild(btn.container);
      this._activityBtns.set(def.id, btn);
    }
  }

  private _buildMiscDrawer(): void {
    const root = new PIXI.Container();
    const drawerY = Game.logicHeight - MISC_DRAWER_Y_FROM_BOTTOM;

    const tab = new PIXI.Container();
    tab.position.set(18, drawerY);

    const tabShadow = new PIXI.Graphics();
    tabShadow.beginFill(0x7f6755, 0.18);
    tabShadow.drawRoundedRect(2, 3, MISC_DRAWER_TAB_W, MISC_DRAWER_TAB_H, 12);
    tabShadow.endFill();
    tab.addChild(tabShadow);

    const tabBg = new PIXI.Graphics();
    tabBg.beginFill(0xfffbf3, 0.84);
    tabBg.drawRoundedRect(0, 0, MISC_DRAWER_TAB_W, MISC_DRAWER_TAB_H, 12);
    tabBg.endFill();
    tabBg.lineStyle(2, 0xf0d4ab, 0.95);
    tabBg.drawRoundedRect(0, 0, MISC_DRAWER_TAB_W, MISC_DRAWER_TAB_H, 12);
    tab.addChild(tabBg);

    this._miscDrawerArrow = new PIXI.Graphics();
    this._miscDrawerArrow.lineStyle(3.2, 0x9b7653, 0.95, 0.5);
    this._miscDrawerArrow.moveTo(-3, -7);
    this._miscDrawerArrow.lineTo(5, 0);
    this._miscDrawerArrow.lineTo(-3, 7);
    this._miscDrawerArrow.position.set(MISC_DRAWER_TAB_W / 2 + 1, MISC_DRAWER_TAB_H / 2);
    tab.addChild(this._miscDrawerArrow);

    tab.eventMode = 'static';
    tab.cursor = 'pointer';
    tab.hitArea = new PIXI.Rectangle(-6, -6, MISC_DRAWER_TAB_W + 12, MISC_DRAWER_TAB_H + 12);
    tab.on('pointerdown', () => {
      TweenManager.cancelTarget(tab.scale);
      tab.scale.set(0.92);
      TweenManager.to({
        target: tab.scale,
        props: { x: 1, y: 1 },
        duration: 0.2,
        ease: Ease.easeOutBack,
      });
      this._toggleMiscDrawer();
    });

    const panel = new PIXI.Container();
    panel.position.set(54, drawerY - 1);
    panel.visible = false;
    panel.alpha = 0;
    panel.scale.set(0.94, 1);

    const panelW = MISC_DRAWER_PANEL_SIDE_PAD * 2
      + MISC_DRAWER_BUTTONS.length * MISC_DRAWER_ITEM_W
      + Math.max(0, MISC_DRAWER_BUTTONS.length - 1) * MISC_DRAWER_ITEM_GAP;

    const panelShadow = new PIXI.Graphics();
    panelShadow.beginFill(0x7f6755, 0.16);
    panelShadow.drawRoundedRect(2, 3, panelW, MISC_DRAWER_PANEL_H, 22);
    panelShadow.endFill();
    panel.addChild(panelShadow);

    const panelBg = new PIXI.Graphics();
    panelBg.beginFill(0xfffbf3, 0.78);
    panelBg.drawRoundedRect(0, 0, panelW, MISC_DRAWER_PANEL_H, 22);
    panelBg.endFill();
    panelBg.lineStyle(2, 0xf2d6aa, 0.95);
    panelBg.drawRoundedRect(0, 0, panelW, MISC_DRAWER_PANEL_H, 22);
    panel.addChild(panelBg);

    this._miscDrawerButtons.clear();
    for (let i = 0; i < MISC_DRAWER_BUTTONS.length; i++) {
      const def = MISC_DRAWER_BUTTONS[i];
      const cx = MISC_DRAWER_PANEL_SIDE_PAD + i * (MISC_DRAWER_ITEM_W + MISC_DRAWER_ITEM_GAP) + MISC_DRAWER_ITEM_W / 2;
      const btn = this._createMiscDrawerButton(def, cx, MISC_DRAWER_PANEL_H / 2);
      panel.addChild(btn);
      this._miscDrawerButtons.set(def.id, btn);
    }

    root.addChild(panel);
    root.addChild(tab);
    this.container.addChild(root);

    this._miscDrawerRoot = root;
    this._miscDrawerTab = tab;
    this._miscDrawerPanel = panel;
  }

  private _createMiscDrawerButton(def: MiscDrawerBtnDef, cx: number, cy: number): PIXI.Container {
    const btn = new PIXI.Container();
    btn.position.set(cx, cy);

    const cardW = 64;
    const cardH = 58;
    const iconR = 18;

    const hoverBg = new PIXI.Graphics();
    hoverBg.beginFill(0xffffff, 0.12);
    hoverBg.drawRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 18);
    hoverBg.endFill();
    btn.addChild(hoverBg);

    const iconBg = new PIXI.Graphics();
    iconBg.beginFill(def.fill, 1);
    iconBg.drawCircle(0, -7, iconR + 3);
    iconBg.endFill();
    iconBg.lineStyle(2.5, def.stroke, 0.95);
    iconBg.drawCircle(0, -7, iconR + 3);
    iconBg.beginFill(0xffffff, 0.18);
    iconBg.drawCircle(-6, -13, iconR - 6);
    iconBg.endFill();
    btn.addChild(iconBg);

    const icon = new PIXI.Text(def.shortLabel, {
      fontSize: 20,
      fill: 0xffffff,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: def.stroke,
      strokeThickness: 2.5,
    });
    icon.anchor.set(0.5);
    icon.position.set(0, -7);
    btn.addChild(icon);

    const label = new PIXI.Text(def.label, {
      fontSize: 13,
      fill: 0x7b6250,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    label.anchor.set(0.5);
    label.position.set(0, 18);
    btn.addChild(label);

    btn.eventMode = 'static';
    btn.cursor = 'pointer';
    btn.hitArea = new PIXI.RoundedRectangle(-cardW / 2, -cardH / 2, cardW, cardH, 18);
    btn.on('pointerdown', () => {
      TweenManager.cancelTarget(btn.scale);
      btn.scale.set(0.9);
      TweenManager.to({
        target: btn.scale,
        props: { x: 1, y: 1 },
        duration: 0.22,
        ease: Ease.easeOutBack,
      });
      this._handleMiscDrawerButtonTap(def.id);
    });

    return btn;
  }

  private _toggleMiscDrawer(nextExpanded = !this._miscDrawerExpanded): void {
    if (!this._miscDrawerPanel || !this._miscDrawerArrow) return;
    if (nextExpanded === this._miscDrawerExpanded && this._miscDrawerPanel.visible === nextExpanded) return;

    this._miscDrawerExpanded = nextExpanded;
    const panel = this._miscDrawerPanel;
    const arrow = this._miscDrawerArrow;

    TweenManager.cancelTarget(panel);
    TweenManager.cancelTarget(panel.scale);
    TweenManager.cancelTarget(arrow);

    if (nextExpanded) {
      panel.visible = true;
      panel.eventMode = 'passive';
      TweenManager.to({
        target: panel,
        props: { alpha: 1 },
        duration: 0.18,
        ease: Ease.easeOutQuad,
      });
      TweenManager.to({
        target: panel.scale,
        props: { x: 1, y: 1 },
        duration: 0.22,
        ease: Ease.easeOutBack,
        onComplete: () => this._syncGameClubNativeButton(),
      });
    } else {
      this._hideGameClubNativeButton();
      panel.eventMode = 'none';
      TweenManager.to({
        target: panel,
        props: { alpha: 0 },
        duration: 0.16,
        ease: Ease.easeOutQuad,
        onComplete: () => {
          if (!this._miscDrawerExpanded && this._miscDrawerPanel) {
            this._miscDrawerPanel.visible = false;
          }
        },
      });
      TweenManager.to({
        target: panel.scale,
        props: { x: 0.94, y: 1 },
        duration: 0.16,
        ease: Ease.easeOutQuad,
      });
    }

    TweenManager.to({
      target: arrow,
      props: { rotation: nextExpanded ? Math.PI : 0 },
      duration: 0.2,
      ease: Ease.easeOutQuad,
    });
  }

  private _handleMiscDrawerButtonTap(id: string): void {
    if (id === 'invite_friend') {
      SocialManager.shareShop();
      ToastMessage.show('已打开分享邀请');
      return;
    }

    if (id === 'settings') {
      this._toggleMiscDrawer(false);
      this._settingsPanel?.show();
      return;
    }

    if (id !== 'game_club') return;

    if (Platform.isWechat && this._gameClubNativeBtn) {
      return;
    }
    ToastMessage.show(Platform.isWechat ? '当前环境暂不支持打开游戏圈' : '游戏圈仅支持微信小游戏');
  }

  private _syncGameClubCanvasButtonInteractivity(nativeVisible: boolean): void {
    const target = this._miscDrawerButtons.get('game_club');
    if (!target) return;
    // 微信真机上由原生 GameClubButton 接管点击；Canvas 视觉层不能再吞事件。
    target.eventMode = Platform.isWechat && nativeVisible ? 'none' : 'static';
    target.cursor = Platform.isWechat && nativeVisible ? 'default' : 'pointer';
  }

  private _getGameClubNativeRectPx(): { left: number; top: number; width: number; height: number } | null {
    const target = this._miscDrawerButtons.get('game_club');
    if (!target) return null;
    const lb = target.getLocalBounds();
    const topLeft = target.toGlobal(new PIXI.Point(lb.x, lb.y));
    const bottomRight = target.toGlobal(new PIXI.Point(lb.x + lb.width, lb.y + lb.height));
    const left = topLeft.x / Game.dpr;
    const top = topLeft.y / Game.dpr;
    const width = (bottomRight.x - topLeft.x) / Game.dpr;
    const height = (bottomRight.y - topLeft.y) / Game.dpr;
    return {
      left: Math.round(left),
      top: Math.round(top),
      width: Math.max(1, Math.round(width)),
      height: Math.max(1, Math.round(height)),
    };
  }

  private _ensureGameClubNativeButton(): void {
    if (this._gameClubNativeBtn || !Platform.isWechat) return;
    const rect = this._getGameClubNativeRectPx();
    if (!rect) return;

    const btn = Platform.createGameClubButton({
      type: 'text',
      text: '',
      style: {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        backgroundColor: 'rgba(0,0,0,0.01)',
        color: 'rgba(0,0,0,0)',
        borderColor: 'rgba(0,0,0,0)',
        borderWidth: 0,
        borderRadius: Math.round(rect.height / 2),
        lineHeight: rect.height,
        fontSize: 1,
      },
    });
    if (!btn) return;
    try { btn.hide?.(); } catch (_) {}
    this._gameClubNativeBtn = btn;
  }

  private _hideGameClubNativeButton(): void {
    if (!this._gameClubNativeBtn) return;
    try { this._gameClubNativeBtn.hide?.(); } catch (_) {}
    this._syncGameClubCanvasButtonInteractivity(false);
  }

  private _syncGameClubNativeButton(): void {
    if (!Platform.isWechat) return;
    this._ensureGameClubNativeButton();
    if (!this._gameClubNativeBtn) {
      this._syncGameClubCanvasButtonInteractivity(false);
      return;
    }

    const shouldShow = !!this._miscDrawerRoot?.visible
      && this._miscDrawerExpanded
      && !this._isEditMode
      && SceneManager.current?.name === 'shop';
    if (!shouldShow) {
      this._hideGameClubNativeButton();
      return;
    }

    const rect = this._getGameClubNativeRectPx();
    if (!rect) {
      this._hideGameClubNativeButton();
      return;
    }
    try {
      if (this._gameClubNativeBtn.style) {
        Object.assign(this._gameClubNativeBtn.style, {
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
          borderRadius: Math.round(rect.height / 2),
          lineHeight: rect.height,
        });
      }
      this._gameClubNativeBtn.show?.();
      this._syncGameClubCanvasButtonInteractivity(true);
      console.log('[ShopScene] 游戏圈原生按钮 rect=', rect);
    } catch (e) {
      this._syncGameClubCanvasButtonInteractivity(false);
      console.warn('[ShopScene] 游戏圈按钮位置同步失败:', e);
    }
  }

  private _destroyGameClubNativeButton(): void {
    if (!this._gameClubNativeBtn) return;
    try { this._gameClubNativeBtn.destroy?.(); } catch (_) {}
    this._gameClubNativeBtn = null;
    this._syncGameClubCanvasButtonInteractivity(false);
  }

  /** 无遮罩底板的纯图标按钮（用于左下横排） */
  private _createBareIconBtn(
    def: SideBtnDef, cx: number, cy: number, iconR: number,
  ): { container: PIXI.Container; redDot: PIXI.Graphics } {
    const container = new PIXI.Container();
    container.position.set(cx, cy);

    // 图标（优先纹理，否则 emoji）
    const iconSize = iconR * 2;
    const tex = def.texKey ? TextureCache.get(def.texKey) : null;
    if (tex) {
      const sp = new PIXI.Sprite(tex);
      sp.anchor.set(0.5);
      sp.width = iconSize;
      sp.height = iconSize;
      container.addChild(sp);
    } else {
      const fb = def.label.charAt(0) || '?';
      const icon = new PIXI.Text(fb, {
        fontSize: iconR * 1.1, fontFamily: FONT_FAMILY, fill: COLORS.TEXT_DARK,
      });
      icon.anchor.set(0.5, 0.5);
      container.addChild(icon);
    }

    // 红点
    const redDot = new PIXI.Graphics();
    redDot.beginFill(0xFF3333);
    redDot.drawCircle(iconR - 4, -iconR + 4, 6);
    redDot.endFill();
    redDot.lineStyle(2, 0xFFFFFF);
    redDot.drawCircle(iconR - 4, -iconR + 4, 6);
    redDot.visible = false;
    container.addChild(redDot);

    container.eventMode = 'static';
    container.cursor = 'pointer';
    container.hitArea = new PIXI.Circle(0, 0, iconR + 10);
    container.on('pointerdown', () => {
      TweenManager.cancelTarget(container.scale);
      container.scale.set(0.85);
      TweenManager.to({
        target: container.scale,
        props: { x: 1, y: 1 },
        duration: 0.25,
        ease: Ease.easeOutBack,
      });
      EventBus.emit(def.event);
    });

    return { container, redDot };
  }

  // ─────────────────── 右侧快捷按钮（签到/任务） ───────────────────

  private _buildQuickButtons(): void {
    const btnW = 84;
    const btnH = 84;
    const gap = 10;
    const startY = Game.safeTop + TOP_BAR_HEIGHT + PROGRESS_BAR_H + 66 + btnH / 2;
    const w = DESIGN_WIDTH;

    for (let i = 0; i < RIGHT_BUTTONS.length; i++) {
      const def = RIGHT_BUTTONS[i];
      const y = startY + i * (btnH + gap);
      const btn = this._createSideButton(def, w - btnW / 2 - 14, y, btnW, btnH);
      this.container.addChild(btn.container);
      this._activityBtns.set(def.id, btn);
    }
  }

  /**
   * 创建侧边按钮（半透明底板 + 大图标 + 白色描边标签压底边）
   */
  private _createSideButton(
    def: SideBtnDef, cx: number, cy: number, btnW: number, btnH: number,
  ): { container: PIXI.Container; redDot: PIXI.Graphics } {
    const container = new PIXI.Container();
    container.position.set(cx, cy);

    const halfW = btnW / 2;
    const halfH = btnH / 2;

    // 1. 半透明白色圆角底板
    const bg = new PIXI.Graphics();
    bg.beginFill(0xFFFFFF, 0.40);
    bg.drawRoundedRect(-halfW, -halfH, btnW, btnH, 18);
    bg.endFill();
    container.addChild(bg);

    // 2. 图标（优先纹理，占满大部分区域，中心偏上）
    const iconSize = btnW * 0.72;  // 约60px（84×0.72）
    const iconCY = -halfH * 0.15;  // 图标中心偏上
    const tex = def.texKey ? TextureCache.get(def.texKey) : null;
    if (tex) {
      const sp = new PIXI.Sprite(tex);
      sp.anchor.set(0.5);
      sp.width = iconSize;
      sp.height = iconSize;
      sp.position.set(0, iconCY);
      container.addChild(sp);
    } else {
      const fb = def.label.charAt(0) || '?';
      const icon = new PIXI.Text(fb, { fontSize: iconSize * 0.7, fontFamily: FONT_FAMILY, fill: 0x333333 });
      icon.anchor.set(0.5, 0.5);
      icon.position.set(0, iconCY);
      container.addChild(icon);
    }

    // 3. 文字标签：白色+描边，压在图标底边（参考 TopBar 星星样式）
    const labelY = iconCY + iconSize / 2 - 2; // 与图标底边重合
    const label = new PIXI.Text(def.label, {
      fontSize: 16,
      fill: 0xFFFFFF,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: 0x00000040,   // 半透明黑色描边增加对比
      strokeThickness: 3,
    });
    label.anchor.set(0.5, 0.5);
    label.position.set(0, labelY);
    container.addChild(label);

    // 4. 红点（右上角）
    const redDot = new PIXI.Graphics();
    redDot.beginFill(0xFF3333);
    redDot.drawCircle(halfW - 6, -halfH + 6, 7);
    redDot.endFill();
    redDot.lineStyle(2, 0xFFFFFF);
    redDot.drawCircle(halfW - 6, -halfH + 6, 7);
    redDot.visible = false;
    container.addChild(redDot);

    // 5. 点击交互
    container.eventMode = 'static';
    container.cursor = 'pointer';
    container.hitArea = new PIXI.Rectangle(-halfW - 6, -halfH - 6, btnW + 12, btnH + 12);
    container.on('pointerdown', () => {
      TweenManager.cancelTarget(container.scale);
      container.scale.set(0.88);
      TweenManager.to({
        target: container.scale,
        props: { x: 1, y: 1 },
        duration: 0.25,
        ease: Ease.easeOutBack,
      });
      EventBus.emit(def.event);
    });

    return { container, redDot };
  }

  // ─────────────────── 返回按钮（右下角，醒目大按钮） ───────────────────

  private _buildReturnButton(w: number, h: number): void {
    this._returnBtn = new PIXI.Container();
    const cx = w - 72;
    const cy = h - 90;

    const r = RETURN_BTN_SIZE / 2;

    // 1. 外层阴影
    const shadow = new PIXI.Graphics();
    shadow.beginFill(0x2E7D32, 0.3);
    shadow.drawCircle(2, 3, r + 3);
    shadow.endFill();
    this._returnBtn.addChild(shadow);

    // 2. 营业按钮图标
    const backTex = TextureCache.get('icon_operate');
    if (backTex) {
      const sp = new PIXI.Sprite(backTex);
      sp.anchor.set(0.5);
      sp.width = r * 2;
      sp.height = r * 2;
      this._returnBtn.addChild(sp);
    } else {
      const bg = new PIXI.Graphics();
      bg.beginFill(C.RETURN_BG);
      bg.drawCircle(0, 0, r);
      bg.endFill();
      bg.beginFill(0x66BB6A, 0.45);
      bg.drawCircle(-6, -6, r - 10);
      bg.endFill();
      bg.lineStyle(2.5, 0xFFFFFF, 0.35);
      bg.drawCircle(0, 0, r);
      this._returnBtn.addChild(bg);

      const arrow = new PIXI.Graphics();
      arrow.lineStyle(6, C.RETURN_ARROW, 1, 0.5);
      arrow.arc(2, -4, 20, -Math.PI * 0.8, Math.PI * 0.25);
      const endX = 2 + 20 * Math.cos(Math.PI * 0.25);
      const endY = -4 + 20 * Math.sin(Math.PI * 0.25);
      arrow.lineStyle(5, C.RETURN_ARROW, 1, 0.5);
      arrow.moveTo(endX, endY);
      arrow.lineTo(endX - 10, endY - 6);
      arrow.moveTo(endX, endY);
      arrow.lineTo(endX + 2, endY - 12);
      this._returnBtn.addChild(arrow);
    }

    this._returnBtn.position.set(cx, cy);
    this._returnBtn.eventMode = 'static';
    this._returnBtn.cursor = 'pointer';
    this._returnBtn.hitArea = new PIXI.Circle(0, 0, r + 12);
    this._returnBtn.on('pointerdown', () => {
      this._playReturnAnim();
    });
    this.container.addChild(this._returnBtn);

    // 呼吸动画
    this._pulseReturnBtn();
  }

  /** 返回按钮呼吸脉冲 */
  private _pulseReturnBtn(): void {
    const pulse = () => {
      TweenManager.to({
        target: this._returnBtn.scale,
        props: { x: 1.08, y: 1.08 },
        duration: 0.8,
        ease: Ease.easeInOutQuad,
        onComplete: () => {
          TweenManager.to({
            target: this._returnBtn.scale,
            props: { x: 1, y: 1 },
            duration: 0.8,
            ease: Ease.easeInOutQuad,
            onComplete: pulse,
          });
        },
      });
    };
    pulse();
  }

  // ─────────────────── 大地图入口 ───────────────────

  private _buildWorldMapButton(w: number, h: number): void {
    const btn = new PIXI.Container();
    const r = WORLD_MAP_ICON_R;
    // 与「营业」同列；整体上沿受底部浅绿条顶边限制（见 SHOP_BOTTOM_STRIP_TOP_OFFSET）
    const cx = w - 72;
    const operateCY = h - 90;
    const operateR = RETURN_BTN_SIZE / 2;
    const operateTopY = operateCY - operateR;
    // 文案上提、略压图标下缘：锚点顶对齐，y < r 形成重叠
    const labelY = r - 10;
    const mapExtentBelowCenter = labelY + WORLD_MAP_LABEL_H;
    const stripTopY = h - SHOP_BOTTOM_STRIP_TOP_OFFSET;
    const cyFromOperate =
      operateTopY - WORLD_MAP_ABOVE_OPERATE_GAP - mapExtentBelowCenter;
    const cyMinForStrip = stripTopY + r + 2;
    let cy = Math.max(cyFromOperate, cyMinForStrip) - WORLD_MAP_BTN_LIFT_PX;
    if (cy - r < stripTopY) cy = stripTopY + r + 2;

    const tex = TextureCache.get('icon_worldmap');
    if (tex && tex.width > 1) {
      const sp = new PIXI.Sprite(tex);
      sp.anchor.set(0.5);
      sp.width = r * 2;
      sp.height = r * 2;
      btn.addChild(sp);
    } else {
      const bg = new PIXI.Graphics();
      bg.beginFill(0x4DB6AC, 0.85);
      bg.drawCircle(0, 0, r);
      bg.endFill();
      bg.lineStyle(2.5, 0xFFFFFF, 0.6);
      bg.drawCircle(0, 0, r);
      btn.addChild(bg);

      const icon = new PIXI.Text('图', { fontSize: Math.round(r * 0.72), fontFamily: FONT_FAMILY, fill: COLORS.TEXT_DARK });
      icon.anchor.set(0.5);
      btn.addChild(icon);
    }

    const label = new PIXI.Text('地图', {
      fontSize: WORLD_MAP_LABEL_FONT,
      fill: 0xFFFFFF,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: 0x3E2723,
      strokeThickness: 2.5,
    });
    label.anchor.set(0.5, 0);
    label.y = labelY;
    btn.addChild(label);

    btn.position.set(cx, cy);
    btn.eventMode = 'static';
    btn.cursor = 'pointer';
    btn.hitArea = new PIXI.Circle(0, 0, r + 22);
    btn.on('pointerdown', () => {
      TweenManager.cancelTarget(btn.scale);
      btn.scale.set(0.85);
      TweenManager.to({
        target: btn.scale, props: { x: 1, y: 1 },
        duration: 0.25, ease: Ease.easeOutBack,
      });
      EventBus.emit('worldmap:open');
    });

    btn.visible = CurrencyManager.state.level >= WORLD_MAP_UNLOCK_LEVEL;
    this._worldMapBtn = btn;
    this.container.addChild(btn);
  }

  private _refreshWorldMapBtnVisibility(): void {
    if (this._worldMapBtn) {
      this._worldMapBtn.visible = CurrencyManager.state.level >= WORLD_MAP_UNLOCK_LEVEL;
    }
  }

  // ─────────────────── 事件 ───────────────────

  private _bindEvents(): void {
    EventBus.on('decoration:decoPanelBackdrop', this._onDecoPanelBackdrop);
    EventBus.on('decoration:room_style', this._refreshShopBuildingTexture);
    EventBus.on('dressup:equipped', this._onDressUpEquipped);
    EventBus.on('decoration:shopStarFly', this._onDecorationShopStarFly);
    EventBus.on('currency:changed', this._onShopCurrencyForProgress);
    EventBus.on('level:up', this._onShopLevelUp);

    EventBus.on('renovation:sceneChanged', this._onRenovationSceneChanged);
    EventBus.on('worldmap:switchScene', this._onWorldMapSwitchScene);
    EventBus.on('scene:switchToShop', this._onSwitchToShopConsumePendingPlace);

    // 监听布局变化 — 仅在非编辑模式下才完整重渲染
    // 编辑模式下由 FurnitureDragSystem 直接操控 Sprite
    EventBus.on('roomlayout:changed', () => {
      if (!this._isEditMode) {
        this._renderFurnitureLayout();
      }
    });

    // 添加家具：编辑模式下只刷新托盘（Sprite已由DragSystem创建）
    EventBus.on('roomlayout:added', () => {
      if (!this._isEditMode) {
        this._renderFurnitureLayout();
      }
      if (this._furnitureTray.isOpen) this._furnitureTray.refresh();
    });

    // 移除家具：编辑模式下Sprite已由Toolbar移除
    EventBus.on('roomlayout:removed', () => {
      if (!this._isEditMode) {
        this._renderFurnitureLayout();
      }
      if (this._furnitureTray.isOpen) this._furnitureTray.refresh();
    });

    // 缩放/翻转：编辑模式下实时更新 Sprite 视觉
    EventBus.on('roomlayout:updated', (placement: any) => {
      if (this._isEditMode && placement && placement.decoId) {
        this._updateSpriteVisual(placement);
        // 置前/置后改的是 zLayer、depthManualBias，须重算 zIndex（不仅依赖工具栏里的 sortByDepth）
        FurnitureDragSystem.sortByDepth();
      }
    });
  }

  /**
   * 装修面板「去放置 / 放入房间」进店后：进编辑模式、托盘切到对应槽位；
   * 若该 deco 尚未摆放则自动从门廊木台前景（房间内本地坐标）拉起拖入。
   *
   * 注意：面板可在花店场景内打开（current 已是 shop），此时不会走 MainScene 切场景、
   * onEnter 也不会再执行，须由 `scene:switchToShop` 的另一路监听消费 pending。
   * 若用户已处于装修模式，不可因 `_isEditMode` 提前 return，否则无法拉起拖入。
   */
  private _consumePendingPlaceDeco(decoId: string): void {
    if (SceneManager.current?.name !== 'shop') return;
    const deco = DECO_MAP.get(decoId);
    if (!deco) return;
    void TextureCache.preloadKeys([deco.icon]);

    const wasEdit = this._isEditMode;
    const placed = !!RoomLayoutManager.getPlacement(decoId);

    if (!wasEdit) {
      this._enterEditMode({ deco });
    } else if (!placed) {
      this._furnitureTray.open({ deco });
    }

    if (placed) {
      this._ensureEditModeFurnitureSprites();
      FurnitureDragSystem.select(decoId);
      ToastMessage.show('该家具已在房间中，可在装修模式下调整位置');
      return;
    }

    this._startPendingPlaceDragWhenTextureReady(decoId);
  }

  private _startPendingPlaceDragWhenTextureReady(decoId: string): void {
    const deco = DECO_MAP.get(decoId);
    if (!deco) return;

    const startDrag = (): boolean => {
      if (SceneManager.current?.name !== 'shop' || !this._isEditMode) return true;
      if (RoomLayoutManager.getPlacement(decoId)) return true;
      if (!TextureCache.get(deco.icon)) return false;
      const { x: spawnDesignX, y: spawnDesignY } = this._roomLocalToDesign(
        FURNITURE_TRAY_SPAWN_ROOM_LOCAL.x,
        FURNITURE_TRAY_SPAWN_ROOM_LOCAL.y,
      );
      FurnitureDragSystem.startDragFromTray(decoId, spawnDesignX, spawnDesignY);
      return true;
    };

    this._pendingPlaceTextureUnsub?.();
    this._pendingPlaceTextureUnsub = null;
    if (startDrag()) return;

    this._pendingPlaceTextureUnsub = TextureCache.onKeysLoaded([deco.icon], () => {
      if (startDrag()) {
        this._pendingPlaceTextureUnsub?.();
        this._pendingPlaceTextureUnsub = null;
      }
    });
  }

  /**
   * 已在花店时从装修面板点「放入房间」：pending 只能在此消费（onEnter 不会触发）。
   */
  private readonly _onSwitchToShopConsumePendingPlace = (): void => {
    if (SceneManager.current?.name !== 'shop') return;
    const pendingPlace = takePendingPlaceDeco();
    if (!pendingPlace) return;
    requestAnimationFrame(() => this._consumePendingPlaceDeco(pendingPlace));
  };

  /** 编辑模式下实时更新家具 Sprite 的缩放/翻转视觉（不重建） */
  private _updateSpriteVisual(placement: { decoId: string; scale: number; flipped: boolean }): void {
    for (const child of this._roomContainer.children) {
      if ((child as any)._decoId === placement.decoId && child instanceof PIXI.Sprite) {
        const texture = child.texture;
        const baseSize = SHOP_FURNITURE_TEX_BASE_PX;
        const s = Math.min(baseSize / texture.width, baseSize / texture.height) * placement.scale;
        child.scale.set(
          placement.flipped ? -s : s,
          s
        );
        break;
      }
    }
  }

  // ─────────────────── 编辑模式 ───────────────────

  /** 创建编辑模式入口按钮（胶囊贴图 + 左叠施工图标 + 居中标题字） */
  private _buildEditButton(w: number, h: number): void {
    this._editBtn = new PIXI.Container();
    const btnW = EDIT_MAIN_BTN_W();
    const btnH = EDIT_MAIN_BTN_H;
    const cornerR = EDIT_MAIN_BTN_R;

    let halfW: number;
    let halfH: number;

    const pillTex = TextureCache.get('shop_edit_deco_pill_4x2_nb2');
    if (pillTex?.width) {
      const ps = Math.min(btnW / pillTex.width, btnH / pillTex.height);
      const sw = pillTex.width * ps;
      const sh = pillTex.height * ps;
      halfW = sw / 2;
      halfH = sh / 2;
      const pillSp = new PIXI.Sprite(pillTex);
      pillSp.anchor.set(0.5, 0.5);
      pillSp.scale.set(ps);
      pillSp.position.set(0, 0);
      this._editBtn.addChild(pillSp);
    } else {
      halfW = btnW / 2;
      halfH = btnH / 2;
      const bg = new PIXI.Graphics();
      bg.beginFill(0xffffff, 0.97);
      bg.drawRoundedRect(-halfW, -halfH, btnW, btnH, cornerR);
      bg.endFill();
      bg.lineStyle(2.5, COLORS.BUTTON_PRIMARY, 0.55);
      bg.drawRoundedRect(-halfW, -halfH, btnW, btnH, cornerR);
      this._editBtn.addChild(bg);
    }

    const label = new PIXI.Text('装修花店', SHOP_EDIT_BTN_LABEL_STYLE);
    label.anchor.set(0.5, 0.5);
    label.position.set(EDIT_MAIN_BTN_LABEL_OFFSET_X, 0);
    this._editBtn.addChild(label);

    const pencilTex = TextureCache.get('icon_build');
    const pillH = halfH * 2;
    const iconMaxH = Math.min(60, Math.floor(pillH * 0.88));
    const iconMaxW = Math.min(70, Math.floor(halfW * 2 * 0.38));
    const iconPadL = 12;
    if (pencilTex?.width) {
      const sp = new PIXI.Sprite(pencilTex);
      sp.anchor.set(0.5);
      const s = Math.min(iconMaxH / pencilTex.height, iconMaxW / pencilTex.width);
      sp.scale.set(s);
      const iw = pencilTex.width * s;
      sp.position.set(-halfW + iconPadL + iw / 2, 0);
      this._editBtn.addChild(sp);
    } else {
      const fs = Math.min(iconMaxH, iconMaxW);
      const iconText = new PIXI.Text('修', { fontSize: Math.round(fs * 0.72), fontFamily: FONT_FAMILY, fill: COLORS.TEXT_DARK });
      iconText.anchor.set(0.5, 0.5);
      iconText.position.set(-halfW + iconPadL + fs * 0.42, 0);
      this._editBtn.addChild(iconText);
    }

    // 底部居中，略上移避免与系统安全区/返回键重叠
    this._editBtn.position.set(w / 2, h - 118);
    this._editBtn.eventMode = 'static';
    this._editBtn.cursor = 'pointer';
    this._editBtn.hitArea = new PIXI.Rectangle(-halfW - 14, -halfH - 14, halfW * 2 + 28, halfH * 2 + 28);
    this._editBtn.on('pointerdown', () => {
      TweenManager.cancelTarget(this._editBtn.scale);
      this._editBtn.scale.set(0.92);
      TweenManager.to({
        target: this._editBtn.scale,
        props: { x: 1, y: 1 },
        duration: 0.2,
        ease: Ease.easeOutBack,
      });

      if (this._isEditMode) {
        this._exitEditMode();
      } else {
        this._enterEditMode();
      }
    });

    this.container.addChild(this._editBtn);

    // 编辑按钮微弱脉冲引导注意力
    this._pulseEditBtn();
  }

  /** 编辑按钮柔和脉冲（吸引玩家注意） */
  private _pulseEditBtn(): void {
    const pulse = () => {
      TweenManager.to({
        target: this._editBtn.scale,
        props: { x: 1.04, y: 1.04 },
        duration: 1.2,
        ease: Ease.easeInOutQuad,
        onComplete: () => {
          TweenManager.to({
            target: this._editBtn.scale,
            props: { x: 1, y: 1 },
            duration: 1.2,
            ease: Ease.easeInOutQuad,
            onComplete: pulse,
          });
        },
      });
    };
    pulse();
  }

  /**
   * 进入编辑模式
   * @param trayArg 不传则托盘默认花房；传 `{ deco }` 时与装修面板「去放置」一致（含家具 Tab）
   */
  private _enterEditMode(trayArg?: DecoSlot | { deco: DecoDef }): void {
    if (this._isEditMode) return;
    this._clearPendingDoubleTapStates();
    this._isEditMode = true;

    // 停止脉冲动画
    TweenManager.cancelTarget(this._editBtn.scale);
    this._editBtn.scale.set(1);

    // 编辑态：隐藏底部「装修花店」主按钮；完成编辑为托盘右下角贴图
    this._editBtn.visible = false;

    const h = Game.logicHeight;
    const trayTopY = trayOpenTopY(h);
    RoomLayoutManager.updateBounds({
      minX: 50,
      maxX: 700,
      minY: 280,
      // 完成钮移入托盘后，房间可摆放区可更接近托盘顶边（不再预留悬浮大钮）
      maxY: trayTopY - 24,
    });

    // 启用拖拽系统
    FurnitureDragSystem.enable(this._roomContainer);

    // 打开家具托盘
    if (trayArg != null && typeof trayArg === 'object' && 'deco' in trayArg) {
      this._furnitureTray.open(trayArg);
    } else {
      this._furnitureTray.open(trayArg as DecoSlot | undefined);
    }

    this._ensureEditCompletePill();

    // 隐藏返回按钮和侧边按钮（编辑模式下不能退出场景）
    this._returnBtn.visible = false;
    if (this._worldMapBtn) this._worldMapBtn.visible = false;
    this._toggleMiscDrawer(false);
    if (this._miscDrawerRoot) this._miscDrawerRoot.visible = false;
    for (const { container } of this._activityBtns.values()) {
      container.visible = false;
    }

    // 添加缩放控件 + 双指缩放手势
    this._buildZoomControls();
    this._enablePinchZoom();
    this._enableRoomPanSurface();

    ToastMessage.show('装修模式：拖动家具；放大后可拖底板/空白平移；拖右侧圆点缩放，双击圆点恢复 1×');
    EventBus.emit('furniture:edit_enabled');
  }

  /** 「完成装修」白字：深绿描边 + 轻阴影，浅绿底上可读 */
  private static readonly _EDIT_COMPLETE_LABEL_STYLE: Partial<PIXI.ITextStyle> = {
    fontSize: 20,
    fill: 0xffffff,
    fontFamily: FONT_FAMILY,
    fontWeight: 'bold',
    stroke: 0x14532a,
    strokeThickness: 4,
    dropShadow: true,
    dropShadowColor: 0x000000,
    dropShadowAlpha: 0.42,
    dropShadowBlur: 2,
    dropShadowDistance: 1,
  };

  private _makeEditCompletePillLabel(): PIXI.Text {
    const label = new PIXI.Text('完成装修', ShopScene._EDIT_COMPLETE_LABEL_STYLE);
    label.anchor.set(0.5, 0.5);
    label.position.set(0, 0);
    label.eventMode = 'none';
    return label;
  }

  private _makeEditCompletePillFallbackBg(): PIXI.Graphics {
    const g = new PIXI.Graphics();
    const w = TRAY_EDIT_COMPLETE_MAX_W;
    const h = TRAY_EDIT_COMPLETE_MAX_H;
    g.beginFill(0xbbe68d, 1);
    g.lineStyle(4, 0x5a7a38, 0.85);
    g.drawRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    g.endFill();
    g.lineStyle(2, 0xe8ffd0, 0.7);
    g.drawRoundedRect(-w / 2 + 5, -h / 2 + 5, w - 10, h - 10, Math.max(8, h / 2 - 5));
    return g;
  }

  /** 顶中大钮：贴图与热区以容器中心为锚点 */
  private _syncEditCompletePillLayout(wrap: PIXI.Container): void {
    let bw = TRAY_EDIT_COMPLETE_MAX_W;
    let bh = TRAY_EDIT_COMPLETE_MAX_H;
    const bg = wrap.children[0];
    if (bg instanceof PIXI.Sprite && bg.texture?.width > 0) {
      const tex = bg.texture;
      const s = Math.min(
        TRAY_EDIT_COMPLETE_MAX_W / tex.width,
        TRAY_EDIT_COMPLETE_MAX_H / tex.height,
      );
      bg.anchor.set(0.5, 0.5);
      bg.position.set(0, 0);
      bg.scale.set(s);
      bw = tex.width * s;
      bh = tex.height * s;
    }
    wrap.position.set(DESIGN_WIDTH / 2, TRAY_EDIT_COMPLETE_TOP_Y);
    wrap.hitArea = new PIXI.Rectangle(-bw / 2, -bh / 2, bw, bh);
    for (const c of wrap.children) {
      if (c instanceof PIXI.Text && c.text === '完成装修') {
        c.anchor.set(0.5, 0.5);
        c.position.set(0, 0);
        Object.assign(c.style, ShopScene._EDIT_COMPLETE_LABEL_STYLE);
        break;
      }
    }
  }

  /** 完成装修钮柔和呼吸（吸引注意；退出编辑时取消） */
  private _pulseEditCompletePill(): void {
    const pill = this._editCompletePill;
    if (!pill?.visible) return;
    TweenManager.cancelTarget(pill.scale);
    pill.scale.set(1);
    const step = () => {
      if (!this._isEditMode || !this._editCompletePill?.visible) return;
      TweenManager.to({
        target: pill.scale,
        props: { x: 1.06, y: 1.06 },
        duration: 1.15,
        ease: Ease.easeInOutQuad,
        onComplete: () => {
          if (!this._isEditMode || !this._editCompletePill?.visible) return;
          TweenManager.to({
            target: pill.scale,
            props: { x: 1, y: 1 },
            duration: 1.15,
            ease: Ease.easeInOutQuad,
            onComplete: step,
          });
        },
      });
    };
    step();
  }

  /** 托盘右下角「完成编辑」贴图（懒创建，随托盘位移） */
  private _ensureEditCompletePill(): void {
    if (this._editCompletePill) {
      const p = this._editCompletePill;
      p.visible = true;
      p.eventMode = 'static';
      if (p.children.length === 1) {
        p.addChild(this._makeEditCompletePillLabel());
      } else {
        for (const c of p.children) {
          if (c instanceof PIXI.Text && c.text === '完成装修') {
            Object.assign(c.style, ShopScene._EDIT_COMPLETE_LABEL_STYLE);
            break;
          }
        }
      }
      this._syncEditCompletePillLayout(p);
      this._furnitureTray.addChild(p);
      this._refreshEditCompletePillTexture();
      this._pulseEditCompletePill();
      return;
    }
    const tex = TextureCache.get('edit_complete_pill_4x2_nb2');
    const wrap = new PIXI.Container();
    wrap.addChild(tex ? new PIXI.Sprite(tex) : this._makeEditCompletePillFallbackBg());
    wrap.addChild(this._makeEditCompletePillLabel());
    this._syncEditCompletePillLayout(wrap);
    wrap.eventMode = 'static';
    wrap.cursor = 'pointer';
    wrap.on('pointertap', () => {
      this._exitEditMode();
    });
    this._editCompletePill = wrap;
    this._furnitureTray.addChild(wrap);
    this._pulseEditCompletePill();
  }

  private _refreshEditCompletePillTexture(): void {
    const pill = this._editCompletePill;
    const tex = TextureCache.get('edit_complete_pill_4x2_nb2');
    if (!pill || !tex?.width) return;
    if (pill.children[0] instanceof PIXI.Sprite && (pill.children[0] as PIXI.Sprite).texture === tex) return;
    const oldBg = pill.children[0];
    const sp = new PIXI.Sprite(tex);
    pill.addChildAt(sp, 0);
    if (oldBg) {
      pill.removeChild(oldBg);
      oldBg.destroy({ children: true });
    }
    this._syncEditCompletePillLayout(pill);
  }

  private _hideEditCompletePill(): void {
    if (!this._editCompletePill) return;
    TweenManager.cancelTarget(this._editCompletePill.scale);
    this._editCompletePill.scale.set(1);
    this._editCompletePill.visible = false;
    this._editCompletePill.eventMode = 'none';
    if (this._editCompletePill.parent === this._furnitureTray) {
      this._furnitureTray.removeChild(this._editCompletePill);
    }
  }

  /** 退出编辑模式 */
  private _exitEditMode(): void {
    if (!this._isEditMode) return;
    this._isEditMode = false;

    this._hideEditCompletePill();

    // 移除绿色完成按钮背景（旧版编辑态兼容）
    const toRemoveBg: PIXI.DisplayObject[] = [];
    for (const child of this._editBtn.children) {
      if ((child as any)._editModeBg) toRemoveBg.push(child);
    }
    toRemoveBg.forEach(c => { this._editBtn.removeChild(c); c.destroy(); });

    // 还原编辑按钮（新版编辑态不再改文案，仅恢复显隐与布局）
    this._editBtn.visible = true;
    const children = this._editBtn.children;
    const btnW = EDIT_MAIN_BTN_W();
    for (const child of children) {
      child.visible = true;
      if (child instanceof PIXI.Text) {
        if (child.text.includes('完成编辑')) {
          child.text = '装修花店';
          Object.assign(child.style, SHOP_EDIT_BTN_LABEL_STYLE);
          child.anchor.set(0.5, 0.5);
          child.position.set(EDIT_MAIN_BTN_LABEL_OFFSET_X, 0);
        }
        if (child.text.includes('摆放家具')) {
          child.visible = true;
        }
      }
      if (child instanceof PIXI.Graphics) {
        child.visible = true;
      }
    }

    const h = Game.logicHeight;
    this._editBtn.position.set(DESIGN_WIDTH / 2, h - 118);

    // 恢复脉冲动画
    this._pulseEditBtn();

    // 禁用拖拽系统（自动保存）
    FurnitureDragSystem.disable();

    // 恢复默认可摆放区域（maxY 限制在地面遮罩上方）
    RoomLayoutManager.updateBounds({
      minX: 50,
      maxX: 700,
      minY: 280,
      maxY: Math.round(Game.logicHeight * 0.80),
    });

    // 关闭家具托盘和工具栏
    this._furnitureTray.close();
    this._editToolbar.hide();

    // 恢复视图缩放 + 移除缩放控件
    this._disableRoomPanSurface();
    this._resetViewZoom();
    this._removeZoomControls();
    this._disablePinchZoom();

    // 恢复按钮显示
    this._returnBtn.visible = true;
    this._refreshWorldMapBtnVisibility();
    if (this._miscDrawerRoot) this._miscDrawerRoot.visible = true;
    this._syncGameClubNativeButton();
    for (const { container } of this._activityBtns.values()) {
      container.visible = true;
    }
    // 友谊卡未达开放等级时须保持隐藏；上面对全部入口统一 visible=true 会误显示，且 eventMode 仍为 none 导致点不动
    this._syncAffinityCodexButtonVisibility();

    // 刷新房间渲染
    this._renderFurnitureLayout();

    ToastMessage.show('布局已保存');
    EventBus.emit('furniture:edit_disabled');
  }

  // ─────────────────── 编辑模式缩放控制 ───────────────────

  /** 放大后限制平移范围，避免拉出过多留白 */
  private _clampRoomPan(): void {
    const s = this._viewScale;
    if (s <= 1.001) {
      this._roomPanX = 0;
      this._roomPanY = 0;
      return;
    }
    const maxX = DESIGN_WIDTH * 0.44 * (s - 1);
    const maxY = Game.logicHeight * 0.32 * (s - 1);
    this._roomPanX = Math.max(-maxX, Math.min(maxX, this._roomPanX));
    this._roomPanY = Math.max(-maxY, Math.min(maxY, this._roomPanY));
  }

  /** 以屏幕中心为缩放基点，并叠加大画面平移 */
  private _syncRoomContainerTransform(): void {
    this._clampRoomPan();
    const cx = DESIGN_WIDTH / 2;
    const cy = Game.logicHeight * SHOP_BUILDING_CENTER_Y_RATIO + SHOP_BUILDING_ANCHOR_OFFSET_Y;
    this._roomContainer.pivot.set(cx, cy);
    this._roomContainer.position.set(cx + this._roomPanX, cy + this._roomPanY);
    this._roomContainer.scale.set(this._viewScale);
  }

  /**
   * 房间内容本地坐标 → 设计坐标（与 FurnitureDragSystem 内 _designToLocal 互逆）。
   * 用于把「房间内本地」默认落点换算到设计坐标；落点取自 FURNITURE_TRAY_SPAWN_ROOM_LOCAL（门廊前景）。
   */
  private _roomLocalToDesign(localX: number, localY: number): { x: number; y: number } {
    const c = this._roomContainer;
    const s = c.scale.x || 1;
    return {
      x: c.position.x + s * (localX - c.pivot.x),
      y: c.position.y + s * (localY - c.pivot.y),
    };
  }

  private _ensureRoomPanHitLayer(): void {
    if (this._roomPanHitLayer) return;
    const g = new PIXI.Graphics();
    g.eventMode = 'static';
    g.cursor = 'grab';
    g.hitArea = new PIXI.Rectangle(0, 0, DESIGN_WIDTH, Game.logicHeight);
    g.zIndex = -8000;
    this._roomPanHitLayer = g;
    this._roomContainer.addChildAt(g, 0);
  }

  private _refreshShopBuildingPanHitAreaIfNeeded(): void {
    if (!this._isEditMode || !this._shopBuildingSprite) return;
    const sp = this._shopBuildingSprite;
    const bw = sp.width;
    const bh = sp.height;
    sp.hitArea = new PIXI.Rectangle(-bw / 2, -bh / 2, bw, bh);
  }

  private _enableRoomPanSurface(): void {
    this._ensureRoomPanHitLayer();
    const layer = this._roomPanHitLayer!;
    layer.eventMode = 'static';
    layer.cursor = 'grab';
    layer.removeAllListeners('pointerdown');
    layer.on('pointerdown', this._handleRoomPanSurfaceDown);

    const sp = this._shopBuildingSprite;
    if (sp) {
      sp.eventMode = 'static';
      sp.cursor = 'grab';
      this._refreshShopBuildingPanHitAreaIfNeeded();
      sp.removeAllListeners('pointerdown');
      sp.on('pointerdown', this._handleRoomPanSurfaceDown);
    }
  }

  private _disableRoomPanSurface(): void {
    this._cleanupRoomPanCanvasListeners();
    if (this._roomPanHitLayer) {
      this._roomPanHitLayer.eventMode = 'none';
      this._roomPanHitLayer.cursor = 'default';
      this._roomPanHitLayer.removeAllListeners('pointerdown');
    }
    const sp = this._shopBuildingSprite;
    if (sp) {
      sp.off('pointerdown', this._handleRoomPanSurfaceDown);
      sp.eventMode = 'auto';
      sp.cursor = 'default';
      sp.hitArea = null;
    }
  }

  private _cleanupRoomPanCanvasListeners(): void {
    const canvas = Game.app.view as HTMLCanvasElement;
    if (this._onRoomPanCanvasMove) {
      canvas.removeEventListener('pointermove', this._onRoomPanCanvasMove);
      this._onRoomPanCanvasMove = null;
    }
    if (this._onRoomPanCanvasUp) {
      canvas.removeEventListener('pointerup', this._onRoomPanCanvasUp);
      canvas.removeEventListener('pointercancel', this._onRoomPanCanvasUp);
      this._onRoomPanCanvasUp = null;
    }
    this._roomPanDragging = false;
  }

  /** 点在建筑底板或房间底层留白处时平移镜头（需已放大） */
  private _handleRoomPanSurfaceDown = (e: PIXI.FederatedPointerEvent): void => {
    if (!this._isEditMode || this._viewScale <= 1.001) return;
    if (this._roomPanDragging) return;
    const native = e.nativeEvent as PointerEvent | undefined;
    if (!native) return;
    e.stopPropagation();
    this._roomPanDragging = true;
    this._roomPanPointerId = native.pointerId;
    this._roomPanDragStartClientX = native.clientX;
    this._roomPanDragStartClientY = native.clientY;
    this._roomPanDragStartPanX = this._roomPanX;
    this._roomPanDragStartPanY = this._roomPanY;

    const canvas = Game.app.view as HTMLCanvasElement;
    if (canvas.setPointerCapture) {
      try {
        canvas.setPointerCapture(native.pointerId);
      } catch (_) { /* 部分环境不支持 */ }
    }

    this._onRoomPanCanvasMove = (ev: PointerEvent) => {
      if (!this._roomPanDragging || ev.pointerId !== this._roomPanPointerId) return;
      const dxClient = ev.clientX - this._roomPanDragStartClientX;
      const dyClient = ev.clientY - this._roomPanDragStartClientY;
      this._roomPanX = this._roomPanDragStartPanX + dxClient * Game.designWidth / Game.screenWidth;
      this._roomPanY = this._roomPanDragStartPanY + dyClient * Game.designHeight / Game.screenHeight;
      this._syncRoomContainerTransform();
    };

    this._onRoomPanCanvasUp = (ev: PointerEvent) => {
      if (ev.pointerId !== this._roomPanPointerId) return;
      this._roomPanDragging = false;
      if (canvas.releasePointerCapture) {
        try {
          canvas.releasePointerCapture(ev.pointerId);
        } catch (_) { /* */ }
      }
      if (this._onRoomPanCanvasMove) {
        canvas.removeEventListener('pointermove', this._onRoomPanCanvasMove);
        this._onRoomPanCanvasMove = null;
      }
      if (this._onRoomPanCanvasUp) {
        canvas.removeEventListener('pointerup', this._onRoomPanCanvasUp);
        canvas.removeEventListener('pointercancel', this._onRoomPanCanvasUp);
        this._onRoomPanCanvasUp = null;
      }
    };

    canvas.addEventListener('pointermove', this._onRoomPanCanvasMove);
    canvas.addEventListener('pointerup', this._onRoomPanCanvasUp);
    canvas.addEventListener('pointercancel', this._onRoomPanCanvasUp);
  };

  /** 应用视图缩放 — 以屏幕中心为基点缩放 roomContainer */
  private _applyViewZoom(newScale: number): void {
    const s = Math.max(this._viewScaleMin, Math.min(this._viewScaleMax, newScale));
    this._viewScale = s;
    if (s <= 1.001) {
      this._roomPanX = 0;
      this._roomPanY = 0;
    } else {
      this._clampRoomPan();
    }
    this._syncRoomContainerTransform();
    this._syncZoomSliderThumb();
  }

  /** 重置缩放 */
  private _resetViewZoom(): void {
    this._viewScale = 1.0;
    this._roomPanX = 0;
    this._roomPanY = 0;
    this._roomContainer.pivot.set(0, 0);
    this._roomContainer.position.set(0, 0);
    this._roomContainer.scale.set(1);
  }

  /**
   * 屏幕 clientY → 滑杆轨道局部 y（0~轨道高度）。
   * 场景高度必须用 Game.logicHeight，若误用 designHeight 会导致 y 系统性偏小、始终夹到轨道顶端（最大缩放）。
   */
  private _sliderLocalYFromClientY(clientY: number): number {
    const H = this._zoomSliderTrackH;
    const gh = clientY * Game.logicHeight / Game.screenHeight;
    const topY = this._zoomSlider?.position.y ?? (Game.logicHeight - H) / 2;
    return Math.max(0, Math.min(H, gh - topY));
  }

  /** 画布级监听用：部分环境 federated nativeEvent 无 clientY，用 Touch 兜底 */
  private _clientYFromBrowserEvent(ev: Event): number | null {
    const pe = ev as PointerEvent & MouseEvent;
    if (typeof pe.clientY === 'number') return pe.clientY;
    const te = ev as TouchEvent;
    const t = te.changedTouches?.[0] ?? te.touches?.[0];
    return t ? t.clientY : null;
  }

  private _pointerIdFromBrowserEvent(ev: Event): number {
    const pe = ev as PointerEvent;
    if (typeof pe.pointerId === 'number') return pe.pointerId;
    const te = ev as TouchEvent;
    const t = te.changedTouches?.[0] ?? te.touches?.[0];
    return t?.identifier ?? 0;
  }

  /** 构建缩放滑杆：整体靠右减少挡家具；仅圆形滑块可交互，轨道不响应 */
  private _buildZoomControls(): void {
    if (this._zoomSlider) return;

    /** 尽量贴右，竖条少盖住房间画面 */
    const EDGE_INSET = 6;
    const TRACK_W = 16;
    const H = this._zoomSliderTrackH;
    const cy = (Game.logicHeight - H) / 2;

    const root = new PIXI.Container();
    root.position.set(DESIGN_WIDTH - EDGE_INSET, cy);
    /** `none` 会在 Pixi 命中阶段整枝子树，thumb 永远点不到；`passive` 自身不挡点、子节点仍可测 */
    root.eventMode = 'passive';
    root.interactiveChildren = true;
    /** 高于房间与飞星，低于升星弹窗(8500) */
    root.zIndex = 8300;

    const track = new PIXI.Graphics();
    track.eventMode = 'none';
    track.beginFill(0xFFFFFF, 0.38);
    track.drawRoundedRect(-TRACK_W, 0, TRACK_W, H, Math.min(8, TRACK_W / 2));
    track.endFill();
    track.lineStyle(2, 0x2C1810, 0.18);
    track.drawRoundedRect(-TRACK_W, 0, TRACK_W, H, Math.min(8, TRACK_W / 2));
    root.addChild(track);

    const thumb = new PIXI.Graphics();
    thumb.eventMode = 'static';
    thumb.cursor = 'pointer';
    root.addChild(thumb);
    this._zoomSliderThumb = thumb;

    this._zoomSlider = root;
    this.container.addChild(root);
    this._syncZoomSliderThumb();

    thumb.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      const native = e.nativeEvent as Event | undefined;
      if (!native) return;
      const startY = this._clientYFromBrowserEvent(native);
      if (startY == null) return;

      const now = Date.now();
      if (now - this._zoomSliderLastTap < 280) {
        this._applyViewZoom(1.0);
        this._zoomSliderLastTap = 0;
        return;
      }
      this._zoomSliderLastTap = now;

      if (this._zoomSliderDragging) return;
      this._zoomSliderDragging = true;
      this._zoomSliderDragActive = true;
      const pid = this._pointerIdFromBrowserEvent(native);
      this._zoomSliderPointerId = pid;

      const canvas = Game.app.view as HTMLCanvasElement;
      if (canvas.setPointerCapture && typeof (native as PointerEvent).pointerId === 'number') {
        try {
          canvas.setPointerCapture((native as PointerEvent).pointerId);
        } catch (_) { /* */ }
      }

      const ly0 = this._sliderLocalYFromClientY(startY);
      this._applyViewZoom(this._scaleFromTrackY(ly0));

      this._onZoomSliderCanvasMove = (ev: Event) => {
        if (!this._zoomSliderDragging || !this._zoomSlider) return;
        const movePid = this._pointerIdFromBrowserEvent(ev);
        if (this._zoomSliderPointerId && movePid !== this._zoomSliderPointerId) return;
        const cy = this._clientYFromBrowserEvent(ev);
        if (cy == null) return;
        const ly2 = this._sliderLocalYFromClientY(cy);
        this._applyViewZoom(this._scaleFromTrackY(ly2));
      };

      this._onZoomSliderCanvasUp = (ev: Event) => {
        const upPid = this._pointerIdFromBrowserEvent(ev);
        if (this._zoomSliderPointerId && upPid !== this._zoomSliderPointerId) return;
        this._zoomSliderDragging = false;
        this._zoomSliderDragActive = false;
        this._zoomSliderPointerId = 0;
        const pe = ev as PointerEvent;
        if (canvas.releasePointerCapture && typeof pe.pointerId === 'number') {
          try {
            canvas.releasePointerCapture(pe.pointerId);
          } catch (_) { /* */ }
        }
        if (this._onZoomSliderCanvasMove) {
          canvas.removeEventListener('pointermove', this._onZoomSliderCanvasMove);
          this._onZoomSliderCanvasMove = null;
        }
        if (this._onZoomSliderCanvasUp) {
          canvas.removeEventListener('pointerup', this._onZoomSliderCanvasUp);
          canvas.removeEventListener('pointercancel', this._onZoomSliderCanvasUp);
          this._onZoomSliderCanvasUp = null;
        }
      };

      canvas.addEventListener('pointermove', this._onZoomSliderCanvasMove);
      canvas.addEventListener('pointerup', this._onZoomSliderCanvasUp);
      canvas.addEventListener('pointercancel', this._onZoomSliderCanvasUp);
    });
  }

  /** 滑杆 y（0=顶）→ 缩放值 */
  private _scaleFromTrackY(y: number): number {
    const t = 1 - y / this._zoomSliderTrackH;
    return this._viewScaleMin + t * (this._viewScaleMax - this._viewScaleMin);
  }

  private _syncZoomSliderThumb(): void {
    if (!this._zoomSliderThumb || !this._zoomSlider) return;
    const H = this._zoomSliderTrackH;
    const t = (this._viewScale - this._viewScaleMin) / (this._viewScaleMax - this._viewScaleMin);
    const y = H * (1 - Math.max(0, Math.min(1, t)));
    const cx = -8;
    const r = 22;
    const g = this._zoomSliderThumb;
    g.clear();
    g.beginFill(0xFFFDF8, 0.92);
    g.lineStyle(2.5, 0x5D4037, 0.35);
    g.drawCircle(cx, y, r);
    g.endFill();
    g.beginFill(0xFFFFFF, 0.45);
    g.drawCircle(cx - 5, y - 5, r * 0.35);
    g.endFill();
    const hitR = 28;
    g.hitArea = new PIXI.Circle(cx, y, hitR);
  }

  /** 移除缩放滑杆 */
  private _removeZoomControls(): void {
    this._zoomSliderDragging = false;
    this._zoomSliderDragActive = false;
    const canvas = Game.app.view as HTMLCanvasElement;
    if (this._onZoomSliderCanvasMove) {
      canvas.removeEventListener('pointermove', this._onZoomSliderCanvasMove);
      this._onZoomSliderCanvasMove = null;
    }
    if (this._onZoomSliderCanvasUp) {
      canvas.removeEventListener('pointerup', this._onZoomSliderCanvasUp);
      canvas.removeEventListener('pointercancel', this._onZoomSliderCanvasUp);
      this._onZoomSliderCanvasUp = null;
    }
    if (this._zoomSlider) {
      this._zoomSlider.parent?.removeChild(this._zoomSlider);
      this._zoomSlider.destroy({ children: true });
      this._zoomSlider = null;
    }
    this._zoomSliderThumb = null;
  }

  /** 启用双指捏合缩放手势 */
  private _enablePinchZoom(): void {
    const canvas = Game.app.view as any;

    this._onPinchDown = (e: PointerEvent) => {
      if (!this._isEditMode) return;
      this._pinchPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    };

    this._onPinchMove = (e: PointerEvent) => {
      if (!this._isEditMode) return;
      if (!this._pinchPointers.has(e.pointerId)) return;

      this._pinchPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (this._pinchPointers.size === 2) {
        const pts = Array.from(this._pinchPointers.values());
        const dx = pts[0].x - pts[1].x;
        const dy = pts[0].y - pts[1].y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (this._pinchStartDist === 0) {
          // 首次检测到双指 → 记录初始距离和缩放
          this._pinchStartDist = dist;
          this._pinchStartScale = this._viewScale;
        } else {
          // 计算缩放比例
          const ratio = dist / this._pinchStartDist;
          this._applyViewZoom(this._pinchStartScale * ratio);
        }
      }
    };

    this._onPinchUp = (e: PointerEvent) => {
      this._pinchPointers.delete(e.pointerId);
      if (this._pinchPointers.size < 2) {
        this._pinchStartDist = 0;
      }
    };

    canvas.addEventListener('pointerdown', this._onPinchDown);
    canvas.addEventListener('pointermove', this._onPinchMove);
    canvas.addEventListener('pointerup', this._onPinchUp);
    canvas.addEventListener('pointercancel', this._onPinchUp);
  }

  /** 禁用双指缩放手势 */
  private _disablePinchZoom(): void {
    const canvas = Game.app.view as any;
    if (this._onPinchDown) {
      canvas.removeEventListener('pointerdown', this._onPinchDown);
      this._onPinchDown = null;
    }
    if (this._onPinchMove) {
      canvas.removeEventListener('pointermove', this._onPinchMove);
      this._onPinchMove = null;
    }
    if (this._onPinchUp) {
      canvas.removeEventListener('pointerup', this._onPinchUp);
      canvas.removeEventListener('pointercancel', this._onPinchUp);
      this._onPinchUp = null;
    }
    this._pinchPointers.clear();
    this._pinchStartDist = 0;
  }

  // ─────────────────── 动画 ───────────────────

  /** 进入花店场景的过渡动画 */
  private _playEnterAnim(): void {
    // 整体淡入
    this.container.alpha = 0;
    TweenManager.to({
      target: this.container,
      props: { alpha: 1 },
      duration: 0.4,
      ease: Ease.easeOutQuad,
    });

    // 房间从下方滑入
    if (this._roomContainer) {
      const origY = this._roomContainer.y;
      this._roomContainer.y = origY + 60;
      TweenManager.to({
        target: this._roomContainer,
        props: { y: origY },
        duration: 0.5,
        delay: 0.1,
        ease: Ease.easeOutBack,
      });
    }
  }

  /** 返回棋盘的过渡动画 */
  private _playReturnAnim(): void {
    // 按钮弹跳
    TweenManager.cancelTarget(this._returnBtn.scale);
    this._returnBtn.scale.set(0.8);
    TweenManager.to({
      target: this._returnBtn.scale,
      props: { x: 1, y: 1 },
      duration: 0.2,
      ease: Ease.easeOutBack,
    });

    // 整体淡出 → 切换场景
    TweenManager.to({
      target: this.container,
      props: { alpha: 0 },
      duration: 0.3,
      delay: 0.1,
      ease: Ease.easeInQuad,
      onComplete: () => {
        SceneManager.switchTo('main');
      },
    });
  }

  /** 花店场景：货币飞当前 TopBar；棋盘类奖励飞回合成入口并入收纳盒 */
  private _createShopRewardFlyBindings(): RewardFlyBindings {
    const topBar = this._topBar;
    const returnBtn = this._returnBtn;
    return {
      getCurrencyTarget(type: string) {
        const posMap: Record<string, { pos: { x: number; y: number }; flash: () => void }> = {
          gold: { pos: topBar.getHuayuanIconPos(), flash: () => topBar.flashHuayuan() },
          huayuan: { pos: topBar.getHuayuanIconPos(), flash: () => topBar.flashHuayuan() },
          diamond: { pos: topBar.getDiamondIconPos(), flash: () => topBar.flashDiamond() },
          stamina: { pos: topBar.getStaminaIconPos(), flash: () => topBar.flashStamina() },
          flowerSignTicket: { pos: topBar.getDiamondIconPos(), flash: () => topBar.flashDiamond() },
        };
        const info = posMap[type];
        if (!info) return null;
        const endGlobal = topBar.toGlobal(new PIXI.Point(info.pos.x, info.pos.y));
        return { endGlobal, onArrived: info.flash };
      },
      planBoardPieces(pieces) {
        const endGlobal = returnBtn.toGlobal(new PIXI.Point(0, 0));
        const plans = pieces.map(p => ({
          textureKey: p.textureKey,
          endGlobal,
          onLand: () => { RewardBoxManager.addItem(p.itemId, 1); },
        }));
        return { plans, overflowCount: 0 };
      },
      getRewardBoxFlyTarget() {
        const endGlobal = returnBtn.toGlobal(new PIXI.Point(0, 0));
        return { endGlobal };
      },
    };
  }

  // ─────────────────── 更新 ───────────────────

  private _update = (): void => {
    const dt = Game.ticker.deltaMS / 1000;
    CurrencyManager.update(dt);
    WarehouseManager.updateWarehouseCooldowns(dt);
    SaveManager.update(dt);
    this._topBar.updateTimer();
    EventBus.emit('staminaPanel:updateTimer');
    this._updateRedDots();
    this._updateOwnerBlink(dt);
  };

  /** 店主眨眼动画：每隔一段时间闭眼 0.15 秒 */
  private _updateOwnerBlink(dt: number): void {
    if (!this._ownerSprite) return;

    this._blinkTimer += dt;

    if (this._isBlinking) {
      if (this._blinkTimer >= 0.15) {
        this._isBlinking = false;
        this._blinkTimer = 0;
        this._blinkInterval = 2.5 + Math.random() * 3;
        const openTex = TextureCache.get(this._ownerFullOpenTexKey())
          ?? TextureCache.get('owner_full_default');
        if (openTex) this._ownerSprite.texture = openTex;
      }
    } else {
      if (this._blinkTimer >= this._blinkInterval) {
        this._isBlinking = true;
        this._blinkTimer = 0;
        const closedTex = TextureCache.get(this._ownerFullBlinkTexKey())
          ?? TextureCache.get('owner_full_default_blink');
        if (closedTex) this._ownerSprite.texture = closedTex;
      }
    }
  }

  private _updateRedDots(): void {
    // 签到红点
    const checkinBtn = this._activityBtns.get('checkin');
    if (checkinBtn) checkinBtn.redDot.visible = CheckInManager.canCheckIn;

    // 任务红点
    const questBtn = this._activityBtns.get('quest');
    if (questBtn) questBtn.redDot.visible = QuestManager.hasClaimableQuest;

    // 装修红点（有可购买的新装饰）
    const decoBtn = this._activityBtns.get('deco');
    if (decoBtn) decoBtn.redDot.visible = DecorationManager.hasAffordableNew();

    this._refreshWorldMapBtnVisibility();
  }

  /**
   * 截取当前装修房间（建筑底板 + 家具 + 店主）供大地图「花花妙屋」节点展示。
   * 仅在花店场景内调用；返回的 RenderTexture 由调用方（WorldMapPanel）负责 destroy。
   *
   * 微信等环境下 `generateTexture` 偶发空图/失败，故优先用 **world getBounds + render(transform)**。
   */
  captureRoomThumbnailForMap(maxSide: number = LIVE_HOUSE_THUMB_CAPTURE_MAX): PIXI.RenderTexture | null {
    const room = this._roomContainer;
    if (!room || room.destroyed || !this._shopBuildingSprite) return null;
    const renderer = Game.app.renderer as PIXI.Renderer;
    try {
      // 勿对 Game.stage 链式调用 updateTransform：stage.parent 为 null 时 Pixi Container 会读 parent.transform 崩溃。
      // 变换已由每帧 render(stage) 更新；getBounds/getLocalBounds 会自根向上 _recursivePostUpdateTransform。

      const manual = this._captureRoomToRtViaWorldBounds(renderer, room, maxSide);
      if (manual) return manual;

      const lb = room.getLocalBounds();
      if (lb.width < 4 || lb.height < 4) {
        console.warn('[ShopScene] captureRoomThumbnailForMap: empty local bounds', lb.x, lb.y, lb.width, lb.height);
        return null;
      }

      let fullRt: PIXI.RenderTexture | null = null;
      try {
        fullRt = renderer.generateTexture(room, { resolution: 1 });
      } catch (e) {
        console.warn('[ShopScene] generateTexture failed', e);
        return null;
      }
      if (!fullRt || fullRt.destroyed || fullRt.width < 2 || fullRt.height < 2) {
        fullRt?.destroy(true);
        return null;
      }
      return this._downscaleRenderTextureToMaxSide(renderer, fullRt, maxSide);
    } catch (e) {
      console.warn('[ShopScene] captureRoomThumbnailForMap failed', e);
      return null;
    }
  }

  /**
   * 用世界轴对齐包围盒截图（与 generateTexture 内部 tempTransform 路径解耦）。
   */
  private _captureRoomToRtViaWorldBounds(
    renderer: PIXI.Renderer,
    room: PIXI.Container,
    maxSide: number,
  ): PIXI.RenderTexture | null {
    try {
      const b = room.getBounds(false);
      if (!b || b.width < 4 || b.height < 4) {
        console.warn('[ShopScene] world bounds too small for thumb', b?.width, b?.height);
        return null;
      }
      const rw = Math.min(2048, Math.max(2, Math.ceil(b.width)));
      const rh = Math.min(2048, Math.max(2, Math.ceil(b.height)));
      const cap = PIXI.RenderTexture.create({ width: rw, height: rh });
      const m = new PIXI.Matrix();
      m.translate(-b.x, -b.y);
      renderer.render(room, { renderTexture: cap, clear: true, transform: m });
      return this._downscaleRenderTextureToMaxSide(renderer, cap, maxSide);
    } catch (e) {
      console.warn('[ShopScene] _captureRoomToRtViaWorldBounds failed', e);
      return null;
    }
  }

  /** 将已生成的 RT 最长边压到 maxSide；若已足够小则原样返回 */
  private _downscaleRenderTextureToMaxSide(
    renderer: PIXI.Renderer,
    src: PIXI.RenderTexture,
    maxSide: number,
  ): PIXI.RenderTexture {
    const fw = src.width;
    const fh = src.height;
    const maxD = Math.max(fw, fh);
    if (maxD <= maxSide) return src;

    const scale = maxSide / maxD;
    const outW = Math.max(2, Math.round(fw * scale));
    const outH = Math.max(2, Math.round(fh * scale));
    const outRt = PIXI.RenderTexture.create({ width: outW, height: outH });
    const spr = new PIXI.Sprite(src);
    spr.position.set(0, 0);
    spr.scale.set(scale, scale);
    renderer.render(spr, { renderTexture: outRt, clear: true });
    spr.texture = PIXI.Texture.EMPTY;
    spr.destroy({ children: true });
    src.destroy(true);
    return outRt;
  }

}
