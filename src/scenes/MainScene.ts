/**
 * 主场景 - 合成经营主界面
 *
 * 集成所有系统：
 * - 核心玩法：棋盘、合成、建筑、客人
 * - 留存系统：新手引导、每日挑战（周积分）、签到、离线收益（`OFFLINE_REWARD_UI_ENABLED` 关闭时不弹窗）
 * - 体验增强：季节、彩蛋、提示、统计
 * - 等级经验系统
 */
import * as PIXI from 'pixi.js';
import { Scene, SceneManager } from '@/core/SceneManager';
import { Game } from '@/core/Game';
import { EventBus } from '@/core/EventBus';
import { OverlayManager } from '@/core/OverlayManager';
import { RewardFlyCoordinator, type RewardFlyBindings } from '@/core/RewardFlyCoordinator';
import { BoardManager } from '@/managers/BoardManager';
import { MergeCompanionManager } from '@/managers/MergeCompanionManager';
import { CurrencyManager } from '@/managers/CurrencyManager';
import { WarehouseManager } from '@/managers/WarehouseManager';
import { CustomerManager, DemandSlot } from '@/managers/CustomerManager';
import { SaveManager } from '@/managers/SaveManager';
import { QuestManager } from '@/managers/QuestManager';
import {
  CheckInManager,
  MILESTONES,
  milestoneRewardToLevelUpPayload,
} from '@/managers/CheckInManager';
import { IdleManager } from '@/managers/IdleManager';
import { LevelManager } from '@/managers/LevelManager';
import { DailyCandyManager } from '@/managers/DailyCandyManager';
import { AffinityManager } from '@/managers/AffinityManager';
import { AffinityCardManager } from '@/managers/AffinityCardManager';
import { TweenManager, Ease } from '@/core/TweenManager';
import { BoardView } from '@/gameobjects/board/BoardView';
import { CustomerScrollArea } from '@/gameobjects/customer/CustomerScrollArea';
import { TopBar, TOP_BAR_HEIGHT } from '@/gameobjects/ui/TopBar';
import { ItemInfoBar } from '@/gameobjects/ui/ItemInfoBar';
import { MergeChainPanel } from '@/gameobjects/ui/MergeChainPanel';
import { WarehousePanel } from '@/gameobjects/ui/WarehousePanel';
import { ToastMessage } from '@/gameobjects/ui/ToastMessage';
import { CheckInPanel } from '@/gameobjects/ui/CheckInPanel';
import { QuestPanel } from '@/gameobjects/ui/QuestPanel';
import { OfflineRewardPanel } from '@/gameobjects/ui/OfflineRewardPanel';
import { LevelUpPopup } from '@/gameobjects/ui/LevelUpPopup';
import { ShopRowPanoramaScroll, SHOP_PANORAMA_VIEW_H } from '@/gameobjects/ui/ShopRowPanoramaScroll';
import { FlowerEasterEggSystem } from '@/systems/FlowerEasterEggSystem';
import { MergeStatsSystem } from '@/systems/MergeStatsSystem';
import { TutorialManager, TutorialStep } from '@/managers/TutorialManager';
import { TutorialOverlay } from '@/systems/TutorialOverlay';
import { SoundSystem } from '@/systems/SoundSystem';
import { AudioManager } from '@/core/AudioManager';
import { GMPanel } from '@/gameobjects/ui/GMPanel';
import { DecorationManager } from '@/managers/DecorationManager';
import { StaminaPanel } from '@/gameobjects/ui/StaminaPanel';
import { DecorationPanel } from '@/gameobjects/ui/DecorationPanel';
import { FloatingMenu } from '@/gameobjects/ui/FloatingMenu';
import { SceneSwitch } from '@/gameobjects/ui/SceneSwitch';
import {
  DESIGN_WIDTH,
  COLORS,
  FONT_FAMILY,
  INFO_BAR_HEIGHT,
  BOARD_BAR_HEIGHT,
  BoardMetrics,
} from '@/config/Constants';
import { ITEM_DEFS } from '@/config/ItemConfig';
import { TextureCache } from '@/utils/TextureCache';
import { AdManager } from '@/managers/AdManager';
import { CollectionManager } from '@/managers/CollectionManager';
import { FlowerCardManager } from '@/managers/FlowerCardManager';
import { DressUpManager } from '@/managers/DressUpManager';
import { getOwnerBoardDisplayScale } from '@/config/DressUpConfig';
import { SocialManager } from '@/managers/SocialManager';
import { EventManager } from '@/managers/EventManager';
import { ENABLE_CHALLENGE_LEVEL_FEATURE } from '@/config/FeatureFlags';
import { ChallengeManager } from '@/managers/ChallengeManager';
import { HapticSystem } from '@/systems/HapticSystem';
import { CollectionPanel } from '@/gameobjects/ui/CollectionPanel';
import { FlowerCardPanel } from '@/gameobjects/ui/FlowerCardPanel';
import { DressUpPanel } from '@/gameobjects/ui/DressUpPanel';
import {
  getShopProgressStarTargetLocalInSceneRoot,
  playShopDecorationStarFly,
} from '@/gameobjects/ui/ShopDecorationStarFly';
import { EventPanel } from '@/gameobjects/ui/EventPanel';
import { ChallengePanel } from '@/gameobjects/ui/ChallengePanel';
import { LeaderboardPanel } from '@/gameobjects/ui/LeaderboardPanel';
import { RewardBoxButton } from '@/gameobjects/ui/RewardBoxButton';
import { RewardBoxPanel } from '@/gameobjects/ui/RewardBoxPanel';
import { PopupShopPanel } from '@/gameobjects/ui/PopupShopPanel';
import { MerchShopPanel } from '@/gameobjects/ui/MerchShopPanel';
import { AffinityCardDropPopup } from '@/gameobjects/ui/AffinityCardDropPopup';
import { AffinityCodexPanel } from '@/gameobjects/ui/AffinityCodexPanel';
import {
  hasCardsForOwner,
  type CardReward,
  type CustomerMilestone,
} from '@/config/AffinityCardConfig';
import { ItemObtainOverlay, type ItemObtainEntry } from '@/gameobjects/ui/ItemObtainOverlay';
import { WorldMapPanel } from '@/gameobjects/ui/WorldMapPanel';
import { FlowerSignGachaPanel } from '@/gameobjects/ui/FlowerSignGachaPanel';
import { ShopScene } from '@/scenes/ShopScene';
import { LIVE_HOUSE_THUMB_CAPTURE_MAX } from '@/config/WorldMapConfig';
import { RewardBoxManager } from '@/managers/RewardBoxManager';
import { MERGE_BUBBLE_DISPLAY_NAME } from '@/config/MergeCompanionConfig';
import { RoomLayoutManager } from '@/managers/RoomLayoutManager';

/** 合成页左侧店主半身：目标高度与最大宽度（设计 px），统一 scale=min(宽限,高限) 保持宽高比、避免栏内「压扁」感 */
const BOARD_OWNER_TARGET_H = 208;
const BOARD_OWNER_MAX_W = 126;
/** 合成页店主整体再放大倍率（与 DressUpConfig.ownerBoardDisplayScale 叠乘） */
const BOARD_OWNER_SIZE_MULT = 1.1;
/**
 * 合成页店主容器在店铺区内的 Y（局部坐标，越大整体越靠下）。
 * 须与 `_update` 里呼吸动画的基准一致，勿只改 `_buildShopArea`。
 */
const BOARD_OWNER_BASE_Y = 250;
/** 店主与收纳格整体右移，与左侧「展开」按钮留缝（设计 px） */
const SHOP_OWNER_BLOCK_NUDGE_X = 6;
const MAIN_SCENE_RED_DOT_REFRESH_INTERVAL = 5;

export class MainScene implements Scene {
  readonly name = 'main';
  readonly container: PIXI.Container;

  // ---- 核心视图 ----
  private _boardView!: BoardView;
  private _topBar!: TopBar;
  private _infoBar!: ItemInfoBar;
  private _mergeChainPanel!: MergeChainPanel;
  private _warehousePanel!: WarehousePanel;
  private _shopArea!: PIXI.Container;
  private _customerScrollArea!: CustomerScrollArea;
  private _shopRowPanorama!: ShopRowPanoramaScroll;
  private _shopMainBlock!: PIXI.Container;

  // ---- 体验增强系统 ----
  private _flowerEasterEgg!: FlowerEasterEggSystem;
  private _mergeStats!: MergeStatsSystem;

  // ---- 留存系统 ----
  private _tutorialOverlay!: TutorialOverlay;
  private _checkInPanel!: CheckInPanel;
  private _questPanel!: QuestPanel;
  private _offlineRewardPanel!: OfflineRewardPanel;
  private _levelUpPopup!: LevelUpPopup;

  // ---- GM 调试 ----
  private _gmPanel!: GMPanel;

  // ---- 新增系统 ----
  private _staminaPanel!: StaminaPanel;
  private _decoPanel!: DecorationPanel;

  // ---- 新UI架构 ----
  private _floatingMenu!: FloatingMenu;
  private _sceneSwitch!: SceneSwitch;

  // ---- 新增系统 Phase 7+ ----
  private _hapticSystem!: HapticSystem;
  private _collectionPanel!: CollectionPanel;
  private _flowerCardPanel!: FlowerCardPanel;
  private _dressUpPanel!: DressUpPanel;
  /** 主场景：与花店 `decoration:shopStarFly` 同款飞星粒子层（装扮解锁用） */
  private _dressShopStarFlyLayer: PIXI.Container | null = null;
  private _eventPanel!: EventPanel;
  private _challengePanel!: ChallengePanel;
  private _leaderboardPanel!: LeaderboardPanel;

  // ---- 奖励收纳框 ----
  private _rewardBoxButton!: RewardBoxButton;
  private _rewardBoxPanel!: RewardBoxPanel;

  // ---- 大地图弹框商店 ----
  private _popupShopPanel!: PopupShopPanel;

  /** 合成顶栏 · 全屏摊位购买商店（NB2 框体） */
  private _merchShopPanel!: MerchShopPanel;

  private _affinityCardDropPopup!: AffinityCardDropPopup;
  private _affinityCodexPanel!: AffinityCodexPanel;
  private _pendingAffinityRewardOverlays: ItemObtainEntry[][] = [];
  private _showingAffinityRewardOverlay = false;

  /** 大地图全屏页（覆盖层，非花店子节点） */
  private _worldMapPanel!: WorldMapPanel;

  // ---- 离线计时 ----
  private _idleSaveTimer = 0;
  private _initialized = false;
  private _redDotTimer = MAIN_SCENE_RED_DOT_REFRESH_INTERVAL;
  private _redDotDirty = true;
  private _textureRefreshUnsub: (() => void) | null = null;
  private _switchingToShop = false;

  constructor() {
    this.container = new PIXI.Container();
  }

  onEnter(): void {
    // 确保容器 transform 干净（从花店等其他场景切回后可能有残留状态）
    this.container.position.set(0, 0);
    this.container.scale.set(1, 1);
    this.container.pivot.set(0, 0);
    this.container.alpha = 1;

    if (!this._initialized) {
      this._buildUI();
      this._boardView.refresh();

      // 启动核心管理器
      CustomerManager.init();
      QuestManager.init();
      CheckInManager.init();
      DailyCandyManager.init();
      AffinityManager.init();
      AffinityCardManager.init();
      IdleManager.init();
      LevelManager.init();
      RoomLayoutManager.init();
      SoundSystem.init();

      // Phase 7+ 新系统初始化
      AdManager.init();
      CollectionManager.init();
      DecorationManager.init();
      FlowerCardManager.init();
      DressUpManager.init();
      // 店主半身像在 _buildShopArea 里已刷新过，但当时尚未 _loadState，须在换装存档加载后再刷一次
      this._refreshOwnerOutfit();
      SocialManager.init();
      EventManager.init();
      ChallengeManager.init();

      this._bindCustomerEvents();
      this._bindBoardCurrencyFly();
      this._bindSystemEvents();

      this._initialized = true;

      // 启动后处理（延迟一帧确保UI就绪）
      setTimeout(() => this._onGameReady(), 100);
    } else {
      // 从花店切回时同步 DressUpManager 当前装扮（避免仅依赖 dressup:equipped 漏刷新）
      this._refreshOwnerOutfit();
      SoundSystem.playMainBGM();

      // 从花店返回后恢复教程引导
      if (TutorialManager.isActive) {
        if (TutorialManager.currentStep === TutorialStep.SWITCH_BACK_MERGE) {
          TutorialManager.advanceTo(TutorialStep.TUTORIAL_GIFT);
        }
        this._tutorialOverlay.bind('main');
      }
    }

    Game.ticker.add(this._update, this);
    this._redDotDirty = true;
    this._redDotTimer = MAIN_SCENE_RED_DOT_REFRESH_INTERVAL;
    this._updateRedDots();

    if (this._initialized) {
      RewardFlyCoordinator.setBindings(this._createMainRewardFlyBindings());
    }
    this._textureRefreshUnsub?.();
    this._textureRefreshUnsub = TextureCache.observeTextureDependencies(
      { groups: ['items', 'chars', 'panels', 'ownerOutfits', 'customers', 'affinityCards'] },
      () => {
        if (SceneManager.current?.name !== 'main') return;
        this._boardView?.refresh();
        this._customerScrollArea?.refresh();
        this._refreshOwnerOutfit();
      },
    );
  }

  onExit(): void {
    Game.ticker.remove(this._update, this);
    RewardFlyCoordinator.setBindings(null);
    this._textureRefreshUnsub?.();
    this._textureRefreshUnsub = null;

    // 解除教程 UI 绑定
    if (this._tutorialOverlay) {
      this._tutorialOverlay.unbind();
    }

    // 停止触觉反馈层上的粒子等效果
    if (this._hapticSystem) {
      this._hapticSystem.stopAll();
    }
  }

  /** 游戏就绪后的启动流程 */
  private _onGameReady(): void {
    // 先恢复/启动新手状态，再判断离线收益、签到等弹窗。
    // 云端无存档时启动期会按云端权威清空本地缓存，此处应立即进入新手流程。
    TutorialManager.start();
    this._tutorialOverlay.bind('main');

    // 1. 离线收益（关闭时 IdleManager 仅同步时间戳，此处恒为 null）
    // 教程期间跳过离线收益弹窗
    const offlineReward = IdleManager.calculateOfflineReward();
    if (offlineReward && !TutorialManager.isActive) {
      this._offlineRewardPanel.show(offlineReward);
      return;
    }

    // 2. 检查签到
    if (CheckInManager.canCheckIn) {
      // 延迟弹出签到面板
      setTimeout(() => {
        if (!TutorialManager.isActive) {
          this._checkInPanel.open();
        }
      }, 500);
    }

    // 4. 任务完成提示
    if (QuestManager.hasClaimableQuest && !TutorialManager.isActive) {
      ToastMessage.show('每日挑战有可领取奖励！');
    }
  }

  private _buildUI(): void {
    let y = Game.safeTop;

    // 上半部分花店场景背景（从屏幕顶部 y=0 覆盖到棋盘顶部）
    const sceneBgTex =
      TextureCache.get('shop_scene_bg_floral_nb2') ?? TextureCache.get('shop_scene_bg');
    if (sceneBgTex) {
      const sceneBg = new PIXI.Sprite(sceneBgTex);
      sceneBg.position.set(0, 0);
      sceneBg.width = DESIGN_WIDTH;
      sceneBg.height = BoardMetrics.topY;
      this.container.addChild(sceneBg);
    }

    // 顶部信息栏（紧贴安全区下方）
    this._topBar = new TopBar();
    this._topBar.position.set(0, y);
    this.container.addChild(this._topBar);
    y += TOP_BAR_HEIGHT + 4;

    // 店铺区域（店主左侧 + 客人横向滚动；任务/活动入口在客人区上方）
    this._shopArea = new PIXI.Container();
    this._shopArea.position.set(0, y);
    this._buildShopArea();
    this.container.addChild(this._shopArea);

    // 棋盘
    this._boardView = new BoardView();
    this.container.addChild(this._boardView);

    // 底部物品信息栏（紧贴棋盘下方装饰条之后，填满剩余空间）
    const barY = BoardMetrics.topY + BoardMetrics.areaHeight + BOARD_BAR_HEIGHT;
    const barH = Game.logicHeight - barY;
    this._infoBar = new ItemInfoBar(barH);
    this._infoBar.position.set(0, barY);
    this.container.addChild(this._infoBar);

    // 合成线可视化面板（全屏覆盖层，初始隐藏）
    this._mergeChainPanel = new MergeChainPanel();
    this.container.addChild(this._mergeChainPanel);

    EventBus.on('mergeChain:open', (itemId: string) => {
      void TextureCache.preloadPanelAssets('mergeChain')
        .finally(() => this._mergeChainPanel.open(itemId));
    });

    // 仓库面板
    this._warehousePanel = new WarehousePanel();
    this.container.addChild(this._warehousePanel);

    EventBus.on('nav:openWarehouse', () => {
      void TextureCache.preloadPanelAssets('warehouse')
        .finally(() => this._warehousePanel.open());
    });

    // 花语合成彩蛋系统
    this._flowerEasterEgg = new FlowerEasterEggSystem(this.container);

    // 合成统计系统
    this._mergeStats = new MergeStatsSystem(this.container);

    // HapticSystem 占位（粒子/闪光/震动均已关闭）
    this._hapticSystem = new HapticSystem(this.container);

    // 左侧悬浮功能按钮组（签到/任务等，纵向排列在棋盘左侧）
    // 参考 Merge Mansion / Travel Town：功能入口悬浮在棋盘边缘，不占用独立行空间
    this._floatingMenu = new FloatingMenu();
    this.container.addChild(this._floatingMenu);

    // 右下角场景切换按钮（参考四季物语 → 切换到花店场景）
    this._sceneSwitch = new SceneSwitch();
    this.container.addChild(this._sceneSwitch);

    // ---- 留存系统 UI（全局覆盖层，任何场景都能使用） ----
    const overlay = OverlayManager.container;

    // 新手引导 UI 覆盖层
    this._tutorialOverlay = new TutorialOverlay(this.container, {
      customerScrollArea: this._customerScrollArea,
      itemInfoBar: this._infoBar,
    });

    // 签到面板
    this._checkInPanel = new CheckInPanel();
    overlay.addChild(this._checkInPanel);
    RewardFlyCoordinator.setCheckInPanel(this._checkInPanel);
    RewardFlyCoordinator.initCheckInFlyListeners();

    // 每日任务面板
    this._questPanel = new QuestPanel();
    overlay.addChild(this._questPanel);

    // 离线收益面板
    this._offlineRewardPanel = new OfflineRewardPanel();
    overlay.addChild(this._offlineRewardPanel);

    // 升级弹窗
    this._levelUpPopup = new LevelUpPopup();
    overlay.addChild(this._levelUpPopup);

    // 体力购买面板（体力不足或顶栏 + 打开）
    this._staminaPanel = new StaminaPanel();
    overlay.addChild(this._staminaPanel);

    // 花店装修面板
    this._decoPanel = new DecorationPanel();
    overlay.addChild(this._decoPanel);

    // GM 调试面板（最高层级）
    this._gmPanel = new GMPanel();
    overlay.addChild(this._gmPanel);

    // ---- Phase 7+ 新面板（全局覆盖层） ----
    this._collectionPanel = new CollectionPanel();
    overlay.addChild(this._collectionPanel);

    this._flowerCardPanel = new FlowerCardPanel();
    overlay.addChild(this._flowerCardPanel);

    this._dressUpPanel = new DressUpPanel();
    overlay.addChild(this._dressUpPanel);

    this._eventPanel = new EventPanel();
    overlay.addChild(this._eventPanel);

    this._challengePanel = new ChallengePanel();
    overlay.addChild(this._challengePanel);

    this._leaderboardPanel = new LeaderboardPanel();
    overlay.addChild(this._leaderboardPanel);

    // 奖励收纳框面板
    this._rewardBoxPanel = new RewardBoxPanel();
    overlay.addChild(this._rewardBoxPanel);

    // 大地图弹框商店
    this._popupShopPanel = new PopupShopPanel();
    overlay.addChild(this._popupShopPanel);

    this._merchShopPanel = new MerchShopPanel();
    overlay.addChild(this._merchShopPanel);

    this._affinityCardDropPopup = new AffinityCardDropPopup();
    overlay.addChild(this._affinityCardDropPopup);

    this._affinityCodexPanel = new AffinityCodexPanel();
    overlay.addChild(this._affinityCodexPanel);
    EventBus.on('affinityCodex:open', (typeId?: string) => {
      this._affinityCodexPanel.open(typeId);
      void TextureCache.preloadPanelAssets('affinity');
    });
    EventBus.on(
      'affinityCard:milestone',
      (_typeId: string, milestone: CustomerMilestone) => this._queueAffinityRewardOverlay(
        this._affinityMilestoneToObtainEntries(milestone),
      ),
    );
    EventBus.on('affinityCard:seasonComplete', (_seasonId: string, reward: CardReward & { decoUnlockId?: string }) => {
      this._queueAffinityRewardOverlay(this._affinityRewardToObtainEntries(reward, reward.decoUnlockId));
    });
    EventBus.on('affinityCard:dropPopupClosed', () => this._drainAffinityRewardOverlays());

    // 大地图全屏页（盖住花店/顶栏；惯性滚动在面板内自注册 ticker）
    this._worldMapPanel = new WorldMapPanel();
    overlay.addChild(this._worldMapPanel);

    overlay.addChild(new FlowerSignGachaPanel());

    EventBus.on('rewardBox:open', () => {
      const parent = this._rewardBoxPanel.parent;
      if (!parent) return;
      const { w, h } = RewardBoxButton.layoutSize();
      const p = new PIXI.Point(w / 2, h);
      const global = this._rewardBoxButton.toGlobal(p);
      const local = parent.toLocal(global);
      this._rewardBoxPanel.openNear(local.x, local.y);
    });

    // 棋盘拖拽幽灵挂到场景根容器，避免被 ItemInfoBar / 仓库条等后添加的兄弟节点遮挡
    this._boardView.setDragGhostParent(this.container);
  }

  private _affinityMilestoneToObtainEntries(milestone: CustomerMilestone): ItemObtainEntry[] {
    return this._affinityRewardToObtainEntries(milestone.reward, milestone.decoUnlockId);
  }

  private _affinityRewardToObtainEntries(reward: CardReward, decoUnlockId?: string): ItemObtainEntry[] {
    const entries: ItemObtainEntry[] = [];
    if (reward.huayuan) entries.push({ kind: 'direct_currency', currency: 'huayuan', amount: reward.huayuan });
    if (reward.stamina) entries.push({ kind: 'direct_currency', currency: 'stamina', amount: reward.stamina });
    if (reward.diamond) entries.push({ kind: 'direct_currency', currency: 'diamond', amount: reward.diamond });
    if (reward.flowerSignTickets) {
      entries.push({ kind: 'direct_currency', currency: 'flowerSign', amount: reward.flowerSignTickets });
    }
    if (decoUnlockId) entries.push({ kind: 'deco', decoId: decoUnlockId, label: '专属家具' });
    return entries;
  }

  private _queueAffinityRewardOverlay(entries: ItemObtainEntry[]): void {
    if (entries.length === 0) return;
    this._pendingAffinityRewardOverlays.push(entries);
    this._drainAffinityRewardOverlays();
  }

  private _drainAffinityRewardOverlays(): void {
    if (this._showingAffinityRewardOverlay || this._affinityCardDropPopup.isOpen) return;
    const entries = this._pendingAffinityRewardOverlays.shift();
    if (!entries) return;
    this._showingAffinityRewardOverlay = true;
    ItemObtainOverlay.show(entries, () => {
      this._showingAffinityRewardOverlay = false;
      this._drainAffinityRewardOverlays();
    });
  }

  /**
   * 店铺区域占位高度（供 topReserved / 棋盘 topY），须与改版前一致以免店主客人与棋盘之间出现大缝。
   * 全景行 `ShopRowPanoramaScroll` 自身仍用 SHOP_PANORAMA_VIEW_H 做遮罩，多出的像素与原先客人区一样可压在棋盘上方。
   */
  static readonly SHOP_HEIGHT = 250;

  private _ownerContainer!: PIXI.Container;
  private _ownerSprite!: PIXI.Sprite;
  private _ownerBreathT = 0;

  private _buildShopArea(): void {
    const W = DESIGN_WIDTH;
    const PAD = 12;

    // ═══════ 店主区域宽度 ═══════
    const OWNER_W = 140;  // 左侧店主区宽度
    const CUSTOMER_LEFT = OWNER_W + 28; // 客人区起始 x（留间距）

    // 所有人物底边对齐的 Y 坐标（shopArea 内）
    const CHAR_BOTTOM_Y = 195;

    // ═══════ 1. 店主半身像（左侧大区域） ═══════
    this._ownerContainer = new PIXI.Container();
    const ownerCX = PAD + OWNER_W / 2;

    // 店主形象 Sprite — 底部锚点对齐 CHAR_BOTTOM_Y
    this._ownerSprite = new PIXI.Sprite();
    this._ownerSprite.anchor.set(0.5, 1.0);
    this._ownerSprite.position.set(0, 0);
    this._ownerContainer.addChild(this._ownerSprite);

    this._ownerSprite.eventMode = 'none';

    this._ownerContainer.position.set(ownerCX + SHOP_OWNER_BLOCK_NUDGE_X, BOARD_OWNER_BASE_Y);
    // 点击店主 → 打开换装面板
    this._ownerContainer.eventMode = 'static';
    this._ownerContainer.cursor = 'pointer';
    this._ownerContainer.hitArea = new PIXI.Circle(0, 0, 48);
    this._ownerContainer.on('pointertap', () => {
      EventBus.emit('panel:openDressUp');
    });

    // 刷新装备显示
    this._refreshOwnerOutfit();

    // 监听换装变化
    EventBus.on('dressup:equipped', () => this._refreshOwnerOutfit());

    // ═══════ 店铺主块（店主 + 礼包 + 客人），将装入整行全景滑动 ═══════
    this._shopMainBlock = new PIXI.Container();
    this._shopMainBlock.sortableChildren = true;
    this._shopMainBlock.addChild(this._ownerContainer);
    this._ownerContainer.zIndex = 0;

    this._rewardBoxButton = new RewardBoxButton();
    this._rewardBoxButton.position.set(
      ownerCX + SHOP_OWNER_BLOCK_NUDGE_X - RewardBoxButton.layoutSize().w / 2,
      CHAR_BOTTOM_Y + 8,
    );
    this._shopMainBlock.addChild(this._rewardBoxButton);
    // 礼包后绘，保证叠在店主之上（人物略放大时可压在礼盒底下由礼盒盖住边缘）
    this._rewardBoxButton.zIndex = 5;

    const customerAreaW = W - CUSTOMER_LEFT - PAD;
    // 左侧活动列仅按钮展开；客人区全高可横向拖，避免与整行滑动抢手势
    this._customerScrollArea = new CustomerScrollArea(customerAreaW, 0);
    this._customerScrollArea.position.set(CUSTOMER_LEFT, 0);
    this._shopMainBlock.addChild(this._customerScrollArea);
    this._customerScrollArea.zIndex = 10;
    this._shopMainBlock.sortChildren();

    this._shopRowPanorama = new ShopRowPanoramaScroll(DESIGN_WIDTH, SHOP_PANORAMA_VIEW_H);
    this._shopRowPanorama.setShopBlock(this._shopMainBlock);
    this._shopArea.addChild(this._shopRowPanorama);
  }

  /** 刷新店主形象外观 */
  private _refreshOwnerOutfit(): void {
    const outfit = DressUpManager.getEquipped();
    const outfitId = outfit?.id || 'outfit_default';

    // TextureCache 中默认套 key 为 owner_chibi_default，其余为 owner_chibi_<outfitId>
    const chibiKey =
      outfitId === 'outfit_default' ? 'owner_chibi_default' : `owner_chibi_${outfitId}`;
    const tex = TextureCache.get(chibiKey) ?? TextureCache.get('owner_chibi_default');

    if (tex && tex.width > 0 && tex.height > 0 && this._ownerSprite) {
      this._ownerSprite.texture = tex;
      const mult = getOwnerBoardDisplayScale(outfitId) * BOARD_OWNER_SIZE_MULT;
      const targetH = BOARD_OWNER_TARGET_H * mult;
      const maxW = BOARD_OWNER_MAX_W * mult;
      const scale = Math.min(maxW / tex.width, targetH / tex.height);
      this._ownerSprite.scale.set(scale);
    }
  }

  /** 绑定客人相关事件 */
  private _bindCustomerEvents(): void {
    // 点击"完成"后：先播放飞行动画，动画结束后再真正执行交付
    EventBus.on('customer:requestDeliver', (uid: number, customer: any, globalPos: PIXI.Point) => {
      AudioManager.play('customer_deliver', { bypassThrottle: true });
      const startLocal = this.container.toLocal(globalPos);

      let pendingAnims = 0;
      const onAnimDone = () => {
        pendingAnims--;
        if (pendingAnims <= 0) {
          CustomerManager.deliver(uid);
        }
      };

      // 棋盘上已锁定的物品 → 飞到对应需求槽位
      const cv = this._customerScrollArea.customerViews.find(v => v.customerUid === uid) ?? null;
      const slotsToFly: { slotIndex: number; cellIndex: number; itemId: string }[] = [];
      (customer.slots as DemandSlot[]).forEach((slot, idx) => {
        if (slot.lockedCellIndex >= 0) {
          slotsToFly.push({ slotIndex: idx, cellIndex: slot.lockedCellIndex, itemId: slot.itemId });
        }
      });
      if (cv && slotsToFly.length > 0) {
        for (const s of slotsToFly) {
          this._boardView.setItemHiddenForDelivery(s.cellIndex, true);
        }
        slotsToFly.forEach((s, i) => {
          const start = this._boardView.getCellCenterLocal(s.cellIndex);
          const endLocal = cv.getDemandSlotIconLocalCenter(s.slotIndex);
          if (!start || !endLocal) {
            this._boardView.setItemHiddenForDelivery(s.cellIndex, false);
            return;
          }
          const sg = this._boardView.toGlobal(new PIXI.Point(start.x, start.y));
          const eg = cv.toGlobal(endLocal);
          const sx = this.container.toLocal(sg).x;
          const sy = this.container.toLocal(sg).y;
          const ex = this.container.toLocal(eg).x;
          const ey = this.container.toLocal(eg).y;
          const def = ITEM_DEFS.get(s.itemId);
          const texKey = def?.icon ?? '';
          pendingAnims++;
          this._playDeliverItemFly(texKey, sx, sy, ex, ey, onAnimDone, i * 0.07);
        });
      }

      const hyFly = customer.huayuanReward;
      if (hyFly > 0) {
        pendingAnims++;
        const targetPos = this._topBar.getHuayuanIconPos();
        const endX = this._topBar.x + targetPos.x;
        const endY = this._topBar.y + targetPos.y;
        this._playRewardFly('icon_huayuan', startLocal.x, startLocal.y, endX, endY, hyFly, () => {
          this._topBar.flashHuayuan();
          onAnimDone();
        }, 0, false);
      }

      // 无奖励时直接交付
      if (pendingAnims === 0) {
        CustomerManager.deliver(uid);
      }
    });
  }

  /** 棋盘货币物品双击：弧线飞入 TopBar（与客人花愿飞入同一套），到账在动画结束后执行 */
  private _bindBoardCurrencyFly(): void {
    EventBus.on('board:currencyUseFly', (payload: {
      cellIndex: number;
      itemId: string;
      currencyType: 'stamina' | 'huayuan' | 'diamond';
      iconKey: string;
      amount: number;
    }) => {
      const { cellIndex, itemId, currencyType, iconKey, amount } = payload;

      const start = this._boardView.getCellCenterLocal(cellIndex);
      if (!start) {
        this._boardView.setItemHiddenForDelivery(cellIndex, false);
        return;
      }
      const sg = this._boardView.toGlobal(new PIXI.Point(start.x, start.y));
      const sx = this.container.toLocal(sg).x;
      const sy = this.container.toLocal(sg).y;

      const posMap: Record<string, { x: number; y: number }> = {
        stamina: this._topBar.getStaminaIconPos(),
        huayuan: this._topBar.getHuayuanIconPos(),
        diamond: this._topBar.getDiamondIconPos(),
      };
      const lp = posMap[currencyType];
      if (!lp) {
        this._boardView.setItemHiddenForDelivery(cellIndex, false);
        return;
      }
      const endX = this._topBar.x + lp.x;
      const endY = this._topBar.y + lp.y;

      const labelMap: Record<string, string> = {
        stamina: '体力',
        huayuan: '花愿',
        diamond: '钻石',
      };

      this._playRewardFly(iconKey, sx, sy, endX, endY, amount, () => {
        switch (currencyType) {
          case 'stamina': CurrencyManager.addStamina(amount); break;
          case 'huayuan': CurrencyManager.addHuayuan(amount); break;
          case 'diamond': CurrencyManager.addDiamond(amount); break;
        }
        ToastMessage.show(`+${amount} ${labelMap[currencyType] ?? currencyType}`);

        const cur = BoardManager.getCellByIndex(cellIndex);
        if (cur?.itemId === itemId) {
          BoardManager.removeItem(cellIndex);
        }
        this._boardView.setItemHiddenForDelivery(cellIndex, false);

        if (currencyType === 'stamina') this._topBar.flashStamina();
        else if (currencyType === 'huayuan') this._topBar.flashHuayuan();
        else if (currencyType === 'diamond') this._topBar.flashDiamond();
      });
    });

    /** 合成气泡倒计时结束未购买：1 级体力瓶落棋盘，满格则进奖励箱（逻辑在 MergeCompanionManager） */
    EventBus.on('mergeCompanion:bubbleExpireBottle', (payload: { dest: 'board' | 'box' }) => {
      const msg =
        payload.dest === 'board'
          ? `${MERGE_BUBBLE_DISPLAY_NAME}散了，已在棋盘放入体力瓶`
          : `${MERGE_BUBBLE_DISPLAY_NAME}散了，棋盘已满，体力瓶已放入奖励箱`;
      ToastMessage.show(msg);
      SaveManager.save();
    });

    /** 钻石解锁花语泡泡：破裂特效 → 物品出现并弧线飞入空格或收纳礼包，落地后再入库 */
    EventBus.on(
      'mergeCompanion:bubbleUnlockVfx',
      (payload: {
        bubbleId: string;
        ruleId: string;
        diamondPrice: number;
        itemId: string;
        boardLocalX: number;
        boardLocalY: number;
      }) => {
        if (SceneManager.current?.name !== 'main') {
          const dest = MergeCompanionManager.completeBubbleUnlockGrant(payload.itemId);
          EventBus.emit(
            'mergeCompanion:unlockDiamond',
            payload.bubbleId,
            payload.ruleId,
            payload.diamondPrice,
            payload.itemId,
            dest,
          );
          console.log(
            `[MergeCompanion] 埋点 unlockDiamond id=${payload.bubbleId} rule=${payload.ruleId} price=${payload.diamondPrice} item=${payload.itemId} dest=${dest} (no main scene)`,
          );
          SaveManager.save();
          return;
        }

        const sg = this._boardView.toGlobal(
          new PIXI.Point(payload.boardLocalX, payload.boardLocalY),
        );
        const sx = this.container.toLocal(sg).x;
        const sy = this.container.toLocal(sg).y;

        let predictedIdx = BoardManager.findEmptyOpenCell();
        let ex = 0;
        let ey = 0;
        if (predictedIdx >= 0) {
          const local = this._boardView.getCellCenterLocal(predictedIdx);
          if (local) {
            const eg = this._boardView.toGlobal(new PIXI.Point(local.x, local.y));
            const el = this.container.toLocal(eg);
            ex = el.x;
            ey = el.y;
          } else {
            predictedIdx = -1;
          }
        }
        if (predictedIdx < 0) {
          const g = this._rewardBoxButton.toGlobal(this._rewardBoxButton.getItemSlotCenterLocal());
          const el = this.container.toLocal(g);
          ex = el.x;
          ey = el.y;
        }

        const def = ITEM_DEFS.get(payload.itemId);
        const texKey = def?.icon ?? '';

        this._playBubblePopBurst(sx, sy, () => {
          this._playDeliverItemFly(texKey, sx, sy, ex, ey, () => {
            const dest = MergeCompanionManager.completeBubbleUnlockGrant(
              payload.itemId,
              predictedIdx >= 0 ? predictedIdx : undefined,
            );
            EventBus.emit(
              'mergeCompanion:unlockDiamond',
              payload.bubbleId,
              payload.ruleId,
              payload.diamondPrice,
              payload.itemId,
              dest,
            );
            console.log(
              `[MergeCompanion] 埋点 unlockDiamond id=${payload.bubbleId} rule=${payload.ruleId} price=${payload.diamondPrice} item=${payload.itemId} dest=${dest}`,
            );
            SaveManager.save();
          });
        });
      },
    );
  }

  /**
   * 合成页内奖励飞入：起点/终点为 MainScene.container 局部坐标，实际绘制在 Overlay 层。
   */
  private _playRewardFly(
    texKey: string,
    sx: number,
    sy: number,
    ex: number,
    ey: number,
    _amount: number,
    onAllArrived: () => void,
    initialDelay = 0,
    playEntrySound = true,
  ): void {
    const layer = OverlayManager.container;
    const startL = layer.toLocal(this.container.toGlobal(new PIXI.Point(sx, sy)));
    const endL = layer.toLocal(this.container.toGlobal(new PIXI.Point(ex, ey)));
    RewardFlyCoordinator.playRewardFlyLayerLocal(
      texKey,
      startL.x,
      startL.y,
      endL.x,
      endL.y,
      _amount,
      onAllArrived,
      initialDelay,
      playEntrySound,
    );
  }

  /** 体力面板到账后：从对应列体力图标飞向顶栏闪电位 */
  private _playStaminaRecoverFly(amount: number, source: 'diamond' | 'ad'): void {
    const startGlobal = source === 'diamond'
      ? this._staminaPanel.getStaminaFlyStartGlobalDiamond()
      : this._staminaPanel.getStaminaFlyStartGlobalAd();
    const sp = this._topBar.getStaminaIconPos();
    const endGlobal = this._topBar.toGlobal(new PIXI.Point(sp.x, sp.y));
    RewardFlyCoordinator.playRewardFlyGlobal(
      'icon_energy',
      startGlobal,
      endGlobal,
      amount,
      () => { this._topBar.flashStamina(); },
      0,
      true,
    );
  }

  private _ensureDressShopStarFlyLayer(): PIXI.Container {
    if (!this._dressShopStarFlyLayer) {
      const ly = new PIXI.Container();
      ly.eventMode = 'none';
      ly.zIndex = 8010;
      this.container.sortableChildren = true;
      this.container.addChild(ly);
      this.container.sortChildren();
      this._dressShopStarFlyLayer = ly;
    }
    return this._dressShopStarFlyLayer;
  }

  /** 与花店购买家具相同：`decoration:shopStarFly` → 飞入「花店进度条星标」屏幕位置 */
  private readonly _onMainSceneDecorationShopStarFly = (payload: {
    globalX: number;
    globalY: number;
    amount: number;
  }): void => {
    if (SceneManager.current?.name !== 'main') return;
    const t = getShopProgressStarTargetLocalInSceneRoot();
    playShopDecorationStarFly({
      flyLayer: this._ensureDressShopStarFlyLayer(),
      startGlobalX: payload.globalX,
      startGlobalY: payload.globalY,
      targetLocalX: t.x,
      targetLocalY: t.y,
      amount: payload.amount,
      onComplete: () => EventBus.emit('decoration:shopStarFlyComplete'),
    });
  };

  private _createMainRewardFlyBindings(): RewardFlyBindings {
    const topBar = this._topBar;
    const boardView = this._boardView;
    const rewardBoxBtn = this._rewardBoxButton;
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
        const empties = BoardManager.getEmptyOpenCellIndices();
        const plans: { textureKey: string; endGlobal: PIXI.IPointData; onLand: () => void }[] = [];
        for (let b = 0; b < pieces.length && b < empties.length; b++) {
          const cellIdx = empties[b];
          const local = boardView.getCellCenterLocal(cellIdx);
          if (!local) continue;
          const endGlobal = boardView.toGlobal(new PIXI.Point(local.x, local.y));
          const itemId = pieces[b].itemId;
          plans.push({
            textureKey: pieces[b].textureKey,
            endGlobal,
            onLand: () => { BoardManager.placeItem(cellIdx, itemId); },
          });
        }
        return { plans, overflowCount: pieces.length - plans.length };
      },
      getRewardBoxFlyTarget() {
        const endGlobal = rewardBoxBtn.toGlobal(rewardBoxBtn.getItemSlotCenterLocal());
        return { endGlobal };
      },
    };
  }

  /** 花语泡泡破裂：局部坐标为 MainScene.container */
  private _playBubblePopBurst(cx: number, cy: number, onDone: () => void): void {
    const root = new PIXI.Container();
    root.position.set(cx, cy);
    this.container.addChild(root);

    const n = 12;
    for (let i = 0; i < n; i++) {
      const g = new PIXI.Graphics();
      const r = 2.5 + (i % 4) * 1.2;
      g.beginFill(0xfff5e6, 0.92);
      g.drawCircle(0, 0, r);
      g.endFill();
      const ang = (i / n) * Math.PI * 2;
      g.position.set(Math.cos(ang) * 10, Math.sin(ang) * 10);
      root.addChild(g);
      const dist = 44 + (i % 4) * 10;
      const tx = Math.cos(ang) * dist;
      const ty = Math.sin(ang) * dist;
      const o = { x: g.x, y: g.y, a: 1 };
      TweenManager.to({
        target: o,
        props: { x: tx, y: ty, a: 0 },
        duration: 0.4,
        ease: Ease.easeOutQuad,
        onUpdate: () => {
          g.position.set(o.x, o.y);
          g.alpha = o.a;
        },
      });
    }

    const ring = new PIXI.Graphics();
    root.addChildAt(ring, 0);
    const ro = { rad: 14, a: 0.75 };
    TweenManager.to({
      target: ro,
      props: { rad: 56, a: 0 },
      duration: 0.36,
      ease: Ease.easeOutQuad,
      onUpdate: () => {
        ring.clear();
        ring.lineStyle(2.5, 0xffe4c4, ro.a);
        ring.drawCircle(0, 0, ro.rad);
      },
      onComplete: () => {
        root.destroy({ children: true });
        onDone();
      },
    });
  }

  /**
   * 交付时：单个物品图标从棋盘格中心沿弧线飞到顾客需求槽位
   */
  private _playDeliverItemFly(
    texKey: string,
    sx: number,
    sy: number,
    ex: number,
    ey: number,
    onComplete: () => void,
    delay = 0,
  ): void {
    const tex = TextureCache.get(texKey);
    const cs = BoardMetrics.cellSize;
    const startMax = cs * 0.72;
    const endMax = 60;

    const icon = tex
      ? new PIXI.Sprite(tex)
      : new PIXI.Text('愿', { fontSize: 26, fontFamily: FONT_FAMILY, fill: COLORS.TEXT_DARK });

    icon.anchor.set(0.5);

    let startScale = 1;
    let endScale = 0.85;
    if (icon instanceof PIXI.Sprite && tex) {
      const m = Math.max(tex.width, tex.height);
      startScale = startMax / m;
      endScale = endMax / m;
    }

    icon.position.set(sx, sy);
    icon.alpha = 0;
    icon.scale.set(startScale * 0.85);

    this.container.addChild(icon);

    TweenManager.to({
      target: icon,
      props: { alpha: 1 },
      duration: 0.1,
      delay,
    });
    TweenManager.to({
      target: icon.scale,
      props: { x: startScale, y: startScale },
      duration: 0.15,
      delay,
      ease: Ease.easeOutBack,
      onComplete: () => {
        const FLY_DURATION = 0.52;
        const cpx = (sx + ex) / 2 + (Math.random() - 0.5) * 36;
        const cpy = Math.min(sy, ey) - 36 - Math.random() * 28;
        const progress = { t: 0 };

        TweenManager.to({
          target: progress,
          props: { t: 1 },
          duration: FLY_DURATION,
          ease: Ease.easeInQuad,
          onUpdate: () => {
            const t = progress.t;
            const mt = 1 - t;
            icon.x = mt * mt * sx + 2 * mt * t * cpx + t * t * ex;
            icon.y = mt * mt * sy + 2 * mt * t * cpy + t * t * ey;
            const sc = startScale + (endScale - startScale) * t;
            icon.scale.set(sc);
            icon.alpha = t < 0.88 ? 1 : 1 - (t - 0.88) / 0.12;
          },
          onComplete: () => {
            icon.destroy();
            onComplete();
          },
        });
      },
    });
  }

  /**
   * 里程碑祝贺弹窗关闭时「飞入收纳盒」落点。合成页用左下礼包按钮；花店等场景 Main 未挂在 stage 时用屏幕右下近似点。
   */
  private _milestoneRewardFlyTargetGlobal(): PIXI.Point {
    if (SceneManager.current?.name === 'main' && this._rewardBoxButton.parent) {
      return this._rewardBoxButton.toGlobal(this._rewardBoxButton.getItemSlotCenterLocal());
    }
    return new PIXI.Point(DESIGN_WIDTH * 0.88, Game.safeTop + 96);
  }

  /** 绑定留存系统事件 */
  private _bindSystemEvents(): void {
    EventBus.on('cloud:saveReloaded', () => {
      this._boardView.refresh();
      this._customerScrollArea.refresh();
      this._checkInPanel.refreshIfOpen();
      this._markRedDotsDirty();
    });

    // 签到面板
    EventBus.on('nav:openCheckIn', () => this._checkInPanel.open());
    EventBus.on('checkin:gmVirtualDayAdvanced', () => this._checkInPanel.refreshIfOpen());
    EventBus.on('checkin:decoUnlocked', (decoId: string, source: 'daily' | 'milestone') => {
      if (source !== 'daily') return;
      setTimeout(() => {
        ItemObtainOverlay.show([{ kind: 'deco', decoId, label: '专属家具' }], () => {});
      }, 760);
    });

    // 累计签到里程碑：领取 → 全屏「恭喜获得」（与升星同款）；关闭后若仍有可领则连弹
    // 注意：签到面板在 Overlay 上，花店场景也会打开；不得限制为 main，否则礼包红点可点但无任何弹窗。
    EventBus.on('checkin:requestMilestoneClaim', (threshold: number) => {
      if (!CheckInManager.canClaimMilestone(threshold)) return;
      const ms = CheckInManager.claimMilestone(threshold);
      if (!ms) return;
      SaveManager.save();
      const payload = milestoneRewardToLevelUpPayload(ms);
      const g = this._milestoneRewardFlyTargetGlobal();
      const chainNext = (): void => {
        this._checkInPanel.refreshIfOpen();
        if (CheckInManager.hasClaimableMilestone) {
          const next = MILESTONES.find(m => CheckInManager.canClaimMilestone(m.threshold));
          if (next) {
            requestAnimationFrame(() => EventBus.emit('checkin:requestMilestoneClaim', next.threshold));
          }
        }
      };
      OverlayManager.bringToFront();
      this._levelUpPopup.show(0, payload, {
        rewardFlyTargetGlobal: g,
        celebrationTitle: '恭喜获得',
        onFullyClosed: chainNext,
      });
      this._levelUpPopup.parent?.sortChildren();
    });

    // 累计签到里程碑：点击礼包预览（与升星礼包预览同款底板）
    EventBus.on('checkin:requestMilestonePreview', (threshold: number) => {
      const ms = MILESTONES.find(m => m.threshold === threshold);
      if (!ms) return;
      const payload = milestoneRewardToLevelUpPayload(ms);
      OverlayManager.bringToFront();
      this._levelUpPopup.show(0, payload, {
        previewOnly: true,
        bannerTitle: `累计签到 ${ms.threshold} 天 · 礼包预览`,
      });
      this._levelUpPopup.parent?.sortChildren();
    });

    // 签到飞入由 RewardFlyCoordinator 统一处理（粒子挂在 Overlay）

    // 首次合成解锁：若有花愿则飞向顶栏（当前为 0，仅回调完成）
    EventBus.on('firstMergeUnlock:claimFly', (payload: {
      source: { x: number; y: number };
      huayuanReward: number;
      onComplete: () => void;
    }) => {
      const { source, huayuanReward, onComplete } = payload;
      if (huayuanReward <= 0) {
        onComplete();
        return;
      }
      let pending = 0;
      const doneOne = (): void => {
        pending--;
        if (pending <= 0) onComplete();
      };

      const runFly = (
        texKey: string,
        amount: number,
        targetPos: { x: number; y: number },
        grant: () => void,
        flash: () => void,
        delay: number,
      ): void => {
        if (amount <= 0) return;
        pending++;
        const endX = this._topBar.x + targetPos.x;
        const endY = this._topBar.y + targetPos.y;
        this._playRewardFly(texKey, source.x, source.y, endX, endY, amount, () => {
          grant();
          flash();
          doneOne();
        }, delay);
      };

      runFly(
        'icon_huayuan',
        huayuanReward,
        this._topBar.getHuayuanIconPos(),
        () => CurrencyManager.addHuayuan(huayuanReward),
        () => this._topBar.flashHuayuan(),
        0,
      );
    });

    // 任务面板
    EventBus.on('nav:openQuest', () => {
      void TextureCache.preloadPanelAssets('quest')
        .finally(() => this._questPanel.open());
    });
    EventBus.on('currency:changed', () => this._markRedDotsDirty());
    EventBus.on('currency:loaded', () => this._markRedDotsDirty());
    EventBus.on('quest:updated', () => this._markRedDotsDirty());
    EventBus.on('event:rewardClaimed', () => this._markRedDotsDirty());
    EventBus.on('event:ended', () => this._markRedDotsDirty());
    EventBus.on('event:shopBought', () => this._markRedDotsDirty());

    // 任务完成提示
    EventBus.on('quest:taskCompleted', (templateId: string) => {
      this._markRedDotsDirty();
      const t = QuestManager.getTemplate(templateId);
      if (t) ToastMessage.show(`任务完成：${QuestManager.describeTemplate(t)}`);
    });

    // 活动/任务赠送整套形象
    EventBus.on('event:grantOutfit', (outfitId: string) => {
      if (DressUpManager.grantOutfit(outfitId)) {
        ToastMessage.show('获得新形象，快去换装看看！');
      }
    });

    EventBus.on('decoration:shopStarFly', this._onMainSceneDecorationShopStarFly);

    // 升级弹窗（收纳盒物品在飞入礼包动画结束后再写入）；仅主场景处理，避免与花店场景重复弹窗/重复入库
    EventBus.on('level:up', (level: number, reward: any, oldLevel?: number) => {
      if (SceneManager.current?.name !== 'main') return;
      const g = this._rewardBoxButton.toGlobal(this._rewardBoxButton.getItemSlotCenterLocal());
      this._levelUpPopup.show(level, reward, {
        rewardFlyTargetGlobal: g,
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
      });
    });

    // 离线收益领取后检查签到
    EventBus.on('idle:claimed', () => {
      setTimeout(() => {
        if (CheckInManager.canCheckIn && !TutorialManager.isActive) {
          this._checkInPanel.open();
        }
        TutorialManager.start();
        this._tutorialOverlay.bind('main');
      }, 500);
    });

    // 引导完成
    EventBus.on('tutorial:completed', () => {
      this._tutorialOverlay?.unbind();
      ToastMessage.show('欢迎来到花花妙屋！');
      if (CheckInManager.canCheckIn) {
        setTimeout(() => this._checkInPanel.open(), 1000);
      }
    });

    // ---- 体力系统事件 ----

    // 体力不足 → 弹出体力面板引导
    EventBus.on('building:noStamina', () => {
      this._staminaPanel.open();
    });
    // 顶栏体力「+」：主动打开购买/广告体力面板（与 building:noStamina 共用 overlay）
    EventBus.on('panel:openStamina', () => {
      this._staminaPanel.open();
    });
    // 花店等场景无 MainScene._update 时，仍刷新体力购买面板上的恢复倒计时
    EventBus.on('staminaPanel:updateTimer', () => {
      this._staminaPanel.updateTimer();
    });

    // 体力购买 / 广告恢复：闪电飞入顶栏体力位（与棋盘货币飞入同一套）
    EventBus.on('stamina:bought', (amount: number) => {
      this._playStaminaRecoverFly(amount, 'diamond');
    });
    EventBus.on('stamina:adRecovered', (amount: number) => {
      this._playStaminaRecoverFly(amount, 'ad');
    });

    // 顶栏商店图标 → 全屏摊位购买面板（合成主界面与花店场景共用 overlay 上面板）
    EventBus.on('panel:openMerchShop', () => {
      if (TutorialManager.isActive) return;
      const cur = SceneManager.current?.name;
      if (cur !== 'main' && cur !== 'shop') return;
      this._merchShopPanel.open();
    });

    // 兼容旧事件：熟客资料卡已废弃，统一跳友谊图鉴
    EventBus.on('panel:openCustomerProfile', (typeId: string) => {
      if (TutorialManager.isActive) return;
      const cur = SceneManager.current?.name;
      if (cur !== 'main' && cur !== 'shop') return;
      if (!typeId) return;
      if (!AffinityManager.isCardSystemUnlocked()) return;
      if (!hasCardsForOwner(typeId)) return;
      void TextureCache.preloadPanelAssets('affinity')
        .finally(() => this._affinityCodexPanel.open(typeId));
    });

    // 客人解锁 / 图鉴集满后：刷新订单区让心形角标即时出现或消失
    EventBus.on('affinity:unlocked', () => {
      this._customerScrollArea.refresh();
    });
    EventBus.on('affinityCard:complete', () => {
      this._customerScrollArea.refresh();
    });

    // GM「模拟离线回归」/「强制糖果」入口：直接弹离线回礼面板
    EventBus.on('panel:showOfflineReward', (reward: any) => {
      if (!reward) return;
      if (this._offlineRewardPanel.visible) return;
      this._offlineRewardPanel.show(reward);
    });

    // ---- 装修系统事件 ----
    EventBus.on('nav:openDeco', () => {
      if (TutorialManager.isActive
        && TutorialManager.currentStep !== TutorialStep.GUIDE_BUY_FURNITURE) return;
      const preload = TutorialManager.isActive
        ? TextureCache.preloadTutorialDeco()
        : TextureCache.preloadSceneWarmup('deco');
      void preload.finally(() => this._decoPanel.open());
    });

    // ---- 场景入口事件（左侧浮动按钮） ----
    EventBus.on('nav:openDressup', () => {
      ToastMessage.show('主角装扮系统已上线！');
      void TextureCache.preloadPanelAssets('dressup')
        .finally(() => EventBus.emit('panel:openDressUp'));
    });

    EventBus.on('nav:openAlbum', () => {
      ToastMessage.show('花语图鉴已上线！');
      void TextureCache.preloadPanelAssets('collection')
        .finally(() => EventBus.emit('panel:openCollection'));
    });

    // ---- 限时活动入口 ----
    EventBus.on('nav:openEvent', () => {
      EventBus.emit('panel:openEvent');
    });

    // ---- 挑战关卡入口（关闭时事件无效果，面板与 Manager 内亦有开关） ----
    EventBus.on('nav:openChallenge', () => {
      if (!ENABLE_CHALLENGE_LEVEL_FEATURE) return;
      EventBus.emit('panel:openChallenge');
    });

    // ---- 排行榜入口 ----
    EventBus.on('nav:openLeaderboard', () => {
      EventBus.emit('panel:openLeaderboard');
    });

    // ---- 花语卡片收集事件 ----
    EventBus.on('flowerCard:collected', (card: any) => {
      ToastMessage.show(`获得花语卡片：「${card.name}」！`);
    });

    EventBus.on('flowerCard:complete', () => {
      ToastMessage.show('集齐所有花语卡片！获得传说奖励！');
    });

    // ---- 图鉴发现事件 ----
    EventBus.on('collection:discovered', (_cat: string, _itemId: string) => {
      // 新发现不打扰游戏，只更新红点
      this._markRedDotsDirty();
    });

    // ---- 限时活动事件 ----
    EventBus.on('event:taskCompleted', (_taskId: string, task: any) => {
      this._markRedDotsDirty();
      ToastMessage.show(`活动任务完成：${task.name}！`);
    });

    EventBus.on('event:started', (event: any) => {
      this._markRedDotsDirty();
      ToastMessage.show(`限时活动开启：${event.name}！`);
    });

    // ---- 挑战事件 ----
    EventBus.on('challenge:ended', (_levelId: string, success: boolean, stars: number) => {
      if (success) {
        ToastMessage.show(`挑战成功！获得 ${stars} 星评价！`);
      } else {
        ToastMessage.show('挑战失败，再试一次？');
      }
    });

    // ---- 进入花店/房屋装修场景（底栏 ，非「购买商店」；购买商店为顶栏 panel:openMerchShop） ----
    EventBus.on('scene:switchToShop', () => {
      if (SceneManager.current?.name !== 'main') return;
      // 教程期间：第 13 步是主动引导进花店；若存档已在花店步骤但当前仍在主场景，
      // 也允许进入花店恢复教程，避免卡在 GUIDE_BUY_FURNITURE 等步骤。
      if (TutorialManager.isActive
        && TutorialManager.currentStep !== TutorialStep.SWITCH_TO_SHOP
        && !TutorialManager.isShopSceneStep()) {
        console.warn('[MainScene] switchToShop blocked by tutorial step', TutorialManager.currentStep);
        return;
      }
      this._switchToShopScene();
    });

    // ---- 大地图（花店按钮 → 全屏覆盖层） ----
    EventBus.on('worldmap:open', () => {
      if (TutorialManager.isActive) return;
      const cur = SceneManager.current;
      const finish = (liveRt: PIXI.RenderTexture | null) => {
        OverlayManager.bringToFront();
        this._worldMapPanel.setLiveHouseThumbnail(liveRt);
        void TextureCache.preloadPanelAssets('worldmap')
          .finally(() => this._worldMapPanel.open());
      };
      // 延后一帧再截屏，避免与当帧主渲染竞争导致部分机型截到透明空图
      if (cur?.name === 'shop') {
        Game.ticker.addOnce(() => {
          const liveRt = (cur as ShopScene).captureRoomThumbnailForMap(LIVE_HOUSE_THUMB_CAPTURE_MAX);
          finish(liveRt);
        });
      } else {
        finish(null);
      }
    });
  }

  /** 更新红点 */
  private _updateRedDots(): void {
    // 活动红点
    this._floatingMenu.setRedDot('event', EventManager.hasClaimableTask);
    this._floatingMenu.setRedDot('quest', QuestManager.hasClaimableQuest);

    // 底部栏红点（装修按钮）
    this._infoBar.updateQuickBtnRedDots();

    this._shopRowPanorama.updateRedDots();
  }

  private _markRedDotsDirty(): void {
    this._redDotDirty = true;
  }

  private _tickRedDots(dt: number): void {
    this._redDotTimer += dt;
    if (this._redDotTimer < MAIN_SCENE_RED_DOT_REFRESH_INTERVAL) return;
    this._redDotTimer = 0;
    if (!this._redDotDirty) return;
    this._redDotDirty = false;
    this._updateRedDots();
  }

  /** 切换到花店场景（带过渡动画） */
  private _switchToShopScene(): void {
    if (SceneManager.current?.name === 'shop' || this._switchingToShop) return;
    this._switchingToShop = true;

    const preload = TutorialManager.isActive
      ? TextureCache.preloadTutorialDeco()
      : TextureCache.preloadShopScene();

    void preload.catch(err => {
      console.warn('[MainScene] 花店首屏资源预加载未完全成功:', err);
    }).then(() => {
      if (SceneManager.current?.name !== 'main') {
        this._switchingToShop = false;
        return;
      }
      // 淡出当前场景 → 切换到花店场景。预加载先完成，真机首帧不再依赖本地兜底。
      TweenManager.to({
        target: this.container,
        props: { alpha: 0 },
        duration: 0.3,
        ease: Ease.easeInQuad,
        onComplete: () => {
          this.container.alpha = 1; // 恢复（下次进入时用）
          this._switchingToShop = false;
          SceneManager.switchTo('shop');
        },
      });
    });
  }

  private _update(): void {
    const dt = Game.ticker.deltaMS / 1000;
    CurrencyManager.update(dt);
    // BuildingManager.update：已在 Game.init 全局 ticker 注册，避免离店场景时 CD 暂停
    WarehouseManager.updateWarehouseCooldowns(dt);
    CustomerManager.update(dt);
    // 注意：TweenManager.update 已在 Game.init 的全局 ticker 中注册，
    // 此处不再重复调用，避免动画速度翻倍
    SaveManager.update(dt);
    MergeCompanionManager.setMergeCompanionBlocked(
      TutorialManager.isActive && TutorialManager.currentStep < TutorialStep.COMPLETED,
    );
    MergeCompanionManager.update(dt);

    this._infoBar.tickMergeBubbleCountdown();
    this._infoBar.tickSelectedToolCooldownUi();
    this._infoBar.tickHouseShopAffordHint(dt);
    this._boardView.refreshMergeCompanionHud();
    this._boardView.updateCdDisplay();
    this._topBar.updateTimer();
    this._staminaPanel.updateTimer();
    this._hapticSystem.update(dt);
    ChallengeManager.update(dt);

    // 客人滚动区惯性动画
    this._customerScrollArea.update(dt);
    this._shopRowPanorama.update(dt);

    // 奖励收纳框滚动惯性
    this._rewardBoxPanel.update(dt);

    this._ownerBreathT += dt;
    if (this._ownerContainer && !this._ownerContainer.destroyed) {
      this._ownerContainer.y = BOARD_OWNER_BASE_Y + Math.sin(this._ownerBreathT * 1.8) * 2;
    }

    // 定期保存离线时间戳
    this._idleSaveTimer += dt;
    if (this._idleSaveTimer >= 30) {
      this._idleSaveTimer = 0;
      IdleManager.recordOnline();
    }

    this._tickRedDots(dt);
  }
}
