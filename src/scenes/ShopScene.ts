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
import { RoomLayoutManager } from '@/managers/RoomLayoutManager';
import { CurrencyManager } from '@/managers/CurrencyManager';
import { CheckInManager } from '@/managers/CheckInManager';
import { QuestManager } from '@/managers/QuestManager';
import { SaveManager } from '@/managers/SaveManager';
import { DressUpManager } from '@/managers/DressUpManager';
import { getOwnerShopDisplayScale } from '@/config/DressUpConfig';
import { FurnitureDragSystem } from '@/systems/FurnitureDragSystem';
import { FurnitureTray, FURNITURE_TRAY_H } from '@/gameobjects/ui/FurnitureTray';
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

// ── 布局常量 ──
const PROGRESS_BAR_W = 400;
const PROGRESS_BAR_H = 28;
const RETURN_BTN_SIZE = 80;   // ← 放大返回按钮

/** 与 FurnitureTray 一致，避免遮挡过多场景 */
const TRAY_HEIGHT = FURNITURE_TRAY_H;

/** 「装修花店」主按钮宽度（与 _buildEditButton 一致） */
const EDIT_MAIN_BTN_W = (): number => Math.round(DESIGN_WIDTH * 0.5);
const EDIT_MAIN_BTN_H = 64;
const EDIT_MAIN_BTN_R = 18;

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
  icon: string;       // 主图标 emoji（图标纹理不可用时降级）
  texKey?: string;     // TextureCache 图标 key
  label: string;
  event: string;
  iconBg: number;
  labelColor: number;
}

/** 左下角横排 — 家具 / 装扮（无遮罩，大图标） */
const DECO_PAIR_BUTTONS: SideBtnDef[] = [
  { id: 'deco',    icon: '🛋️', texKey: 'icon_furniture', label: '家具', event: 'nav:openDeco',    iconBg: 0xFFB347, labelColor: 0xD48B2E },
  { id: 'dressup', icon: '👗', texKey: 'icon_dress',      label: '装扮', event: 'nav:openDressup', iconBg: 0xFF7EB3, labelColor: 0xE0559C },
];

/** 左上角 — 图鉴（竖排） */
const LEFT_TOP_BUTTONS: SideBtnDef[] = [
  { id: 'album',   icon: '📖', texKey: 'icon_book',  label: '图鉴', event: 'nav:openAlbum',   iconBg: 0xA78BFA, labelColor: 0x7C5FC5 },
];

/** 右侧 — 活动快捷按钮（签到/任务） */
const RIGHT_BUTTONS: SideBtnDef[] = [
  { id: 'checkin', icon: '📅', texKey: 'icon_checkin', label: '签到', event: 'nav:openCheckIn', iconBg: 0xFFA726, labelColor: 0xD48B2E },
  { id: 'quest',   icon: '📋', texKey: 'icon_quest',   label: '任务', event: 'nav:openQuest',   iconBg: 0x42A5F5, labelColor: 0x1976D2 },
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
  private _editToolbar!: RoomEditToolbar;
  private _particleContainer!: PIXI.Container;
  private _shopBuildingSprite: PIXI.Sprite | null = null;

  // ── 大地图（面板在 OverlayManager，此处仅入口按钮） ──
  private _worldMapBtn: PIXI.Container | null = null;

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
  };

  /** 花店内升星：弹窗展示奖励；确定后货币飞顶栏、宝箱飞回「营业返回」钮再入库 */
  private readonly _onShopLevelUp = (level: number, reward: any): void => {
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
        bannerTitle: `恭喜升至 ${level}星`,
        rewardFlyTargetGlobal: flyTarget ?? undefined,
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
  private _onZoomSliderCanvasMove: ((e: PointerEvent) => void) | null = null;
  private _onZoomSliderCanvasUp: ((e: PointerEvent) => void) | null = null;
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

    this._build();
    this._playEnterAnim();
    Game.ticker.add(this._update, this);

    const pendingPlace = takePendingPlaceDeco();
    if (pendingPlace) {
      requestAnimationFrame(() => this._consumePendingPlaceDeco(pendingPlace));
    }

    RewardFlyCoordinator.setBindings(this._createShopRewardFlyBindings());
  }

  onExit(): void {
    this._restoreShopHudAfterDecoPanel();
    RewardFlyCoordinator.setBindings(null);
    this._clearPendingDoubleTapStates();
    EventBus.off('decoration:room_style', this._refreshShopBuildingTexture);
    EventBus.off('decoration:decoPanelBackdrop', this._onDecoPanelBackdrop);
    EventBus.off('dressup:equipped', this._onDressUpEquipped);
    EventBus.off('decoration:shopStarFly', this._onDecorationShopStarFly);
    EventBus.off('currency:changed', this._onShopCurrencyForProgress);
    EventBus.off('level:up', this._onShopLevelUp);
    EventBus.off('renovation:sceneChanged', this._onRenovationSceneChanged);
    EventBus.off('worldmap:switchScene', this._onWorldMapSwitchScene);
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

    // ============== 8. 右下角返回按钮（参考四季物语的大箭头） ==============
    this._buildReturnButton(w, h);

    // ============== 8b. 大地图按钮（返回按钮上方，10 星解锁） ==============
    this._buildWorldMapButton(w, h);

    // ============== 9. 编辑模式组件（初始隐藏） ==============
    this._furnitureTray = new FurnitureTray();
    this.container.addChild(this._furnitureTray);

    this._editToolbar = new RoomEditToolbar();
    this.container.addChild(this._editToolbar);

    // ============== 10. 编辑模式按钮（放在最后，确保在最顶层） ==============
    this._buildEditButton(w, h);

    // ============== 11. 氛围粒子 ==============
    this._particleContainer = new PIXI.Container();
    this._particleContainer.zIndex = 100;
    this.container.addChild(this._particleContainer);
    this._spawnAmbientParticles(w, h);

    // ============== 11b. 飞星层（购买家具 → 飞入进度条） ==============
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
      const deco = DECO_MAP.get(placement.decoId);
      if (!deco) continue;

      const texture = TextureCache.get(deco.icon);
      if (!texture) continue;

      const sprite = new PIXI.Sprite(texture);
      const baseSize = SHOP_FURNITURE_TEX_BASE_PX;
      const s = Math.min(baseSize / texture.width, baseSize / texture.height) * placement.scale;
      sprite.scale.set(
        placement.flipped ? -s : s,
        s
      );
      sprite.anchor.set(0.5, 0.8); // 底部偏中心
      sprite.position.set(placement.x, placement.y);
      // 2.5D：Y 为主；台面小物 typeLift + depthManualBias + zLayer/stackTie（见 RoomDepthSort）
      const stackTie = Math.min(pi, 999);
      sprite.zIndex = roomDepthZForPlacement(
        placement.y,
        placement.zLayer ?? 0,
        stackTie,
        deco,
        placement.depthManualBias,
      );

      // 标记 decoId（用于拖拽系统识别）
      (sprite as any)._decoId = placement.decoId;

      this._roomContainer.addChild(sprite);

      if (!this._isEditMode) {
        this._attachFurnitureBrowseDoubleTap(sprite, placement.decoId);
      }
    }

    this._roomContainer.sortChildren();
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
            '欢迎来到花语小筑~ 🌸',
            '今天想做什么呢？可以装修花店哦！',
            '新的花材到了，快去合成吧~',
            '花店越来越漂亮了呢！💕',
            '记得每天签到领奖励呀~',
          ];
          const msg = greetings[Math.floor(Math.random() * greetings.length)];
          ToastMessage.show(`💬 店主：「${msg}」`);
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
    /** 家具面板遮罩在面板之下、进度条抬升到 overlay 之上；条身穿透点击以落到遮罩关闭 */
    barContainer.eventMode = 'none';
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
      const fb = new PIXI.Text('⭐', { fontSize: 28, fontFamily: FONT_FAMILY });
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
      const gift = new PIXI.Text('🎁', { fontSize: 22, fontFamily: FONT_FAMILY });
      gift.anchor.set(0.5, 0.5);
      gift.eventMode = 'none';
      giftTap.addChild(gift);
    }
    giftTap.on('pointertap', () => this._showNextStarGiftPreview());
    barContainer.addChild(giftTap);

    this.container.addChild(barContainer);
  }

  private _updateProgressBar(): void {
    const ratio = LevelManager.starProgress;
    const star = CurrencyManager.state.star;
    const lv = CurrencyManager.state.level;
    const sceneId = CurrencyManager.state.sceneId;
    const nextReq = getNextLevelStarRequired(sceneId, lv);

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
    this._levelUpPopup.show(
      nextLv,
      {
        huayuan: 0,
        stamina: preview.stamina,
        diamond: preview.diamond,
        rewardBoxItems: preview.rewardBoxItems,
      },
      {
        previewOnly: true,
        bannerTitle: `升至 ${nextLv}星 · 礼包预览`,
      },
    );
  }

  /** 家具购买后：星星从全局坐标飞入进度条左侧星标 */
  private _playStarFlyFromGlobal(globalX: number, globalY: number, amount: number): void {
    if (!this._starFlyLayer || !this._progressBarRoot) return;
    const tex = TextureCache.get('icon_star');
    const targetLocal = new PIXI.Point(
      this._progressBarRoot.x - 22,
      this._progressBarRoot.y + PROGRESS_BAR_H / 2,
    );
    const startLocal = new PIXI.Point();
    this.container.toLocal({ x: globalX, y: globalY }, undefined, startLocal);

    const ICON_SIZE = 30;
    const COUNT = Math.min(Math.max(1, Math.ceil(amount / 2)), 10);
    const FLY_DURATION = 0.52;
    const STAGGER = 0.045;
    let arrived = 0;

    for (let i = 0; i < COUNT; i++) {
      const icon = tex
        ? new PIXI.Sprite(tex)
        : new PIXI.Text('⭐', { fontSize: 22, fontFamily: FONT_FAMILY });
      icon.anchor.set(0.5);
      icon.eventMode = 'none';
      let targetScale = 1;
      if (icon instanceof PIXI.Sprite && tex) {
        targetScale = ICON_SIZE / Math.max(tex.width, tex.height);
      }
      const randX = (Math.random() - 0.5) * 48;
      const randY = (Math.random() - 0.5) * 36;
      icon.position.set(startLocal.x + randX, startLocal.y + randY);
      icon.alpha = 0;
      icon.scale.set(targetScale * 0.35);
      this._starFlyLayer.addChild(icon);

      const delay = i * STAGGER;
      TweenManager.to({
        target: icon,
        props: { alpha: 1 },
        duration: 0.12,
        delay,
      });
      TweenManager.to({
        target: icon.scale,
        props: { x: targetScale, y: targetScale },
        duration: 0.2,
        delay,
        ease: Ease.easeOutBack,
        onComplete: () => {
          const cpx = (icon.x + targetLocal.x) / 2 + (Math.random() - 0.5) * 70;
          const cpy = Math.min(icon.y, targetLocal.y) - 28 - Math.random() * 36;
          const startX = icon.x;
          const startY = icon.y;
          const progress = { t: 0 };
          TweenManager.to({
            target: progress,
            props: { t: 1 },
            duration: FLY_DURATION,
            ease: Ease.easeInQuad,
            onUpdate: () => {
              const t = progress.t;
              const mt = 1 - t;
              icon.x = mt * mt * startX + 2 * mt * t * cpx + t * t * targetLocal.x;
              icon.y = mt * mt * startY + 2 * mt * t * cpy + t * t * targetLocal.y;
              icon.scale.set(targetScale * (1 - t * 0.45));
              icon.alpha = t < 0.82 ? 1 : 1 - (t - 0.82) / 0.18;
            },
            onComplete: () => {
              icon.destroy();
              arrived++;
              if (arrived >= COUNT) {
                this._pulseProgressStar();
                EventBus.emit('decoration:shopStarFlyComplete');
              }
            },
          });
        },
      });
    }
  }

  private _pulseProgressStar(): void {
    const g = this._progressStarGroup;
    if (!g) return;
    const ox = g.scale.x;
    const oy = g.scale.y;
    TweenManager.to({
      target: g.scale,
      props: { x: ox * 1.18, y: oy * 1.18 },
      duration: 0.12,
      ease: Ease.easeOutQuad,
      onComplete: () => {
        TweenManager.to({
          target: g.scale,
          props: { x: ox, y: oy },
          duration: 0.28,
          ease: Ease.easeOutBounce,
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
      const icon = new PIXI.Text(def.icon, {
        fontSize: iconR * 1.1, fontFamily: FONT_FAMILY,
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
      const icon = new PIXI.Text(def.icon, { fontSize: iconSize * 0.7, fontFamily: FONT_FAMILY });
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
    // 与右下角「营业」按钮同一行，在其左侧（示意图红框区域）
    const cx = w - 72 - 82;
    const cy = h - 90;
    const r = 32;

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

      const icon = new PIXI.Text('🗺️', { fontSize: 28, fontFamily: FONT_FAMILY });
      icon.anchor.set(0.5);
      btn.addChild(icon);
    }

    const label = new PIXI.Text('地图', {
      fontSize: 12, fill: 0xFFFFFF, fontFamily: FONT_FAMILY, fontWeight: 'bold',
      stroke: 0x3E2723, strokeThickness: 2,
    });
    label.anchor.set(0.5, 0);
    label.y = r + 4;
    btn.addChild(label);

    btn.position.set(cx, cy);
    btn.eventMode = 'static';
    btn.cursor = 'pointer';
    btn.hitArea = new PIXI.Circle(0, 0, r + 12);
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
   * 若该 deco 尚未摆放则自动从屏幕中心拉起拖入。
   */
  private _consumePendingPlaceDeco(decoId: string): void {
    if (SceneManager.current?.name !== 'shop') return;
    const deco = DECO_MAP.get(decoId);
    if (!deco || this._isEditMode) return;

    this._enterEditMode({ deco });

    if (RoomLayoutManager.getPlacement(decoId)) {
      ToastMessage.show('该家具已在房间中，可在装修模式下调整位置');
      return;
    }

    const cx = DESIGN_WIDTH / 2;
    const cy = Game.logicHeight * 0.42;
    FurnitureDragSystem.startDragFromTray(decoId, cx, cy);
  }

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

  /** 创建编辑模式入口按钮（加宽双行文案，主 CTA 更醒目） */
  private _buildEditButton(w: number, h: number): void {
    this._editBtn = new PIXI.Container();
    const btnW = EDIT_MAIN_BTN_W();
    const btnH = EDIT_MAIN_BTN_H;
    const cornerR = EDIT_MAIN_BTN_R;

    // 1. 阴影层
    const shadow = new PIXI.Graphics();
    shadow.beginFill(0x000000, 0.14);
    shadow.drawRoundedRect(-btnW / 2 + 2, -btnH / 2 + 4, btnW, btnH, cornerR);
    shadow.endFill();
    this._editBtn.addChild(shadow);

    // 2. 白色胶囊底板
    const bg = new PIXI.Graphics();
    bg.beginFill(0xFFFFFF, 0.97);
    bg.drawRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, cornerR);
    bg.endFill();
    bg.lineStyle(2.5, COLORS.BUTTON_PRIMARY, 0.55);
    bg.drawRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, cornerR);
    this._editBtn.addChild(bg);

    // 3. 施工图标
    const pencilTex = TextureCache.get('icon_build');
    const iconX = -btnW / 2 + 36;
    if (pencilTex) {
      const sp = new PIXI.Sprite(pencilTex);
      sp.anchor.set(0.5);
      sp.width = 34;
      sp.height = 34;
      sp.position.set(iconX, -6);
      this._editBtn.addChild(sp);
    } else {
      const iconText = new PIXI.Text('✏️', { fontSize: 24, fontFamily: FONT_FAMILY });
      iconText.anchor.set(0.5, 0.5);
      iconText.position.set(iconX, -6);
      this._editBtn.addChild(iconText);
    }

    const label = new PIXI.Text('装修花店', {
      fontSize: 20, fill: COLORS.BUTTON_PRIMARY, fontFamily: FONT_FAMILY, fontWeight: 'bold',
    });
    label.anchor.set(0, 0.5);
    label.position.set(-btnW / 2 + 62, -14);
    this._editBtn.addChild(label);

    const sub = new PIXI.Text('摆放家具 · 拖动调整', {
      fontSize: 13, fill: COLORS.TEXT_LIGHT, fontFamily: FONT_FAMILY,
    });
    sub.anchor.set(0, 0.5);
    sub.position.set(-btnW / 2 + 62, 12);
    this._editBtn.addChild(sub);

    // 底部居中，略上移避免与系统安全区/返回键重叠
    this._editBtn.position.set(w / 2, h - 118);
    this._editBtn.eventMode = 'static';
    this._editBtn.cursor = 'pointer';
    this._editBtn.hitArea = new PIXI.Rectangle(-btnW / 2 - 12, -btnH / 2 - 12, btnW + 24, btnH + 24);
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

    const bw = EDIT_MAIN_BTN_W();
    const bh = EDIT_MAIN_BTN_H;
    const br = EDIT_MAIN_BTN_R;

    const children = this._editBtn.children;
    for (const child of children) {
      if (child instanceof PIXI.Text) {
        if (child.text === '装修花店') child.text = '✅ 完成编辑';
        if (child.text.includes('摆放家具')) child.visible = false;
      }
      if (child instanceof PIXI.Graphics) {
        child.visible = false;
      }
    }

    const completeBg = new PIXI.Graphics();
    completeBg.beginFill(0x4CAF50, 0.95);
    completeBg.drawRoundedRect(-bw / 2, -bh / 2, bw, bh, br);
    completeBg.endFill();
    completeBg.lineStyle(2, 0x388E3C, 0.5);
    completeBg.drawRoundedRect(-bw / 2, -bh / 2, bw, bh, br);
    (completeBg as any)._editModeBg = true;
    this._editBtn.addChildAt(completeBg, 0);

    for (const child of this._editBtn.children) {
      if (child instanceof PIXI.Text && child.text === '✅ 完成编辑') {
        child.style.fill = 0xFFFFFF;
        child.style.fontSize = 20;
        child.anchor.set(0.5, 0.5);
        child.position.set(0, 0);
      }
    }

    const h = Game.logicHeight;
    const trayTopY = h - TRAY_HEIGHT;
    this._editBtn.position.set(DESIGN_WIDTH / 2, trayTopY - 36);

    const editBtnY = trayTopY - 36;
    RoomLayoutManager.updateBounds({
      minX: 50,
      maxX: 700,
      minY: 280,
      maxY: editBtnY - 60,
    });

    // 启用拖拽系统
    FurnitureDragSystem.enable(this._roomContainer);

    // 打开家具托盘
    if (trayArg != null && typeof trayArg === 'object' && 'deco' in trayArg) {
      this._furnitureTray.open(trayArg);
    } else {
      this._furnitureTray.open(trayArg as DecoSlot | undefined);
    }

    // 隐藏返回按钮和侧边按钮（编辑模式下不能退出场景）
    this._returnBtn.visible = false;
    if (this._worldMapBtn) this._worldMapBtn.visible = false;
    for (const { container } of this._activityBtns.values()) {
      container.visible = false;
    }

    // 添加缩放控件 + 双指缩放手势
    this._buildZoomControls();
    this._enablePinchZoom();
    this._enableRoomPanSurface();

    ToastMessage.show('🔨 装修模式：拖动家具；放大后可拖底板/空白平移；拖右侧圆点缩放，双击圆点恢复 1×');
    EventBus.emit('furniture:edit_enabled');
  }

  /** 退出编辑模式 */
  private _exitEditMode(): void {
    if (!this._isEditMode) return;
    this._isEditMode = false;

    // 移除绿色完成按钮背景
    const toRemoveBg: PIXI.DisplayObject[] = [];
    for (const child of this._editBtn.children) {
      if ((child as any)._editModeBg) toRemoveBg.push(child);
    }
    toRemoveBg.forEach(c => { this._editBtn.removeChild(c); c.destroy(); });

    // 还原编辑按钮
    const children = this._editBtn.children;
    const btnW = EDIT_MAIN_BTN_W();
    for (const child of children) {
      child.visible = true;
      if (child instanceof PIXI.Text) {
        if (child.text === '✅ 完成编辑') {
          child.text = '装修花店';
          child.style.fill = COLORS.BUTTON_PRIMARY;
          child.style.fontSize = 20;
          child.anchor.set(0, 0.5);
          child.position.set(-btnW / 2 + 62, -14);
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
    for (const { container } of this._activityBtns.values()) {
      container.visible = true;
    }

    // 刷新房间渲染
    this._renderFurnitureLayout();

    ToastMessage.show('💾 布局已保存');
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
    root.eventMode = 'none';
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
      const native = e.nativeEvent as PointerEvent | undefined;
      if (!native) return;

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
      this._zoomSliderPointerId = native.pointerId ?? 0;

      const canvas = Game.app.view as HTMLCanvasElement;
      if (canvas.setPointerCapture && native.pointerId != null) {
        try {
          canvas.setPointerCapture(native.pointerId);
        } catch (_) { /* */ }
      }

      const ly0 = this._sliderLocalYFromClientY(native.clientY);
      this._applyViewZoom(this._scaleFromTrackY(ly0));

      this._onZoomSliderCanvasMove = (ev: PointerEvent) => {
        if (!this._zoomSliderDragging || !this._zoomSlider) return;
        if (this._zoomSliderPointerId && ev.pointerId !== this._zoomSliderPointerId) return;
        const ly2 = this._sliderLocalYFromClientY(ev.clientY);
        this._applyViewZoom(this._scaleFromTrackY(ly2));
      };

      this._onZoomSliderCanvasUp = (ev: PointerEvent) => {
        if (this._zoomSliderPointerId && ev.pointerId !== this._zoomSliderPointerId) return;
        this._zoomSliderDragging = false;
        this._zoomSliderDragActive = false;
        this._zoomSliderPointerId = 0;
        if (canvas.releasePointerCapture && ev.pointerId != null) {
          try {
            canvas.releasePointerCapture(ev.pointerId);
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

  // ─────────────────── 氛围粒子 ───────────────────

  /** 生成飘落的花瓣/光斑粒子 */
  private _spawnAmbientParticles(w: number, h: number): void {
    const emojis = ['🌸', '✨', '🌿', '💫', '🍃'];
    const count = 13;

    for (let i = 0; i < count; i++) {
      const emoji = emojis[Math.floor(Math.random() * emojis.length)];
      const particle = new PIXI.Text(emoji, {
        fontSize: 10 + Math.random() * 10,
        fontFamily: FONT_FAMILY,
      });
      particle.anchor.set(0.5, 0.5);
      particle.alpha = 0.35 + Math.random() * 0.35;
      particle.position.set(
        Math.random() * w,
        Math.random() * h * 0.6
      );
      this._particleContainer.addChild(particle);

      // 缓慢飘落动画（循环）
      this._animateParticle(particle, w, h);
    }
  }

  /** 单个粒子的飘落动画（循环） */
  private _animateParticle(particle: PIXI.Text, w: number, h: number): void {
    const duration = 4 + Math.random() * 6;
    const startX = Math.random() * w;
    const startY = -20;
    const endX = startX + (Math.random() - 0.5) * 100;
    const endY = h * 0.7 + Math.random() * h * 0.3;

    particle.position.set(startX, startY);
    particle.alpha = 0.3 + Math.random() * 0.3;

    TweenManager.to({
      target: particle,
      props: { x: endX, y: endY, alpha: 0 },
      duration,
      ease: Ease.linear,
      onComplete: () => {
        // 循环
        this._animateParticle(particle, w, h);
      },
    });
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
    };
  }

  // ─────────────────── 更新 ───────────────────

  private _update = (): void => {
    const dt = Game.ticker.deltaMS / 1000;
    CurrencyManager.update(dt);
    WarehouseManager.updateWarehouseCooldowns(dt);
    SaveManager.update(dt);
    this._topBar.updateTimer();
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
    if (questBtn) questBtn.redDot.visible = QuestManager.hasClaimableQuest || QuestManager.hasClaimableAchievement;

    // 装修红点（有可购买的新装饰）
    const decoBtn = this._activityBtns.get('deco');
    if (decoBtn) decoBtn.redDot.visible = DecorationManager.hasAffordableNew();

    this._refreshWorldMapBtnVisibility();
  }

  /**
   * 截取当前装修房间（建筑底板 + 家具 + 店主）供大地图「花语小筑」节点展示。
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
