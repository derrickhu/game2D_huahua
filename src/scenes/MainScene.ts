/**
 * 主场景 - 合成经营主界面
 *
 * 集成所有系统：
 * - 核心玩法：棋盘、合成、建筑、客人
 * - 留存系统：新手引导、每日任务、成就、签到、离线收益
 * - 体验增强：连击、季节、彩蛋、提示、统计
 * - 等级经验系统
 */
import * as PIXI from 'pixi.js';
import { Scene, SceneManager } from '@/core/SceneManager';
import { Game } from '@/core/Game';
import { EventBus } from '@/core/EventBus';
import { OverlayManager } from '@/core/OverlayManager';
import { BoardManager } from '@/managers/BoardManager';
import { CurrencyManager } from '@/managers/CurrencyManager';
import { BuildingManager } from '@/managers/BuildingManager';
import { CustomerManager } from '@/managers/CustomerManager';
import { SaveManager } from '@/managers/SaveManager';
import { QuestManager } from '@/managers/QuestManager';
import { CheckInManager } from '@/managers/CheckInManager';
import { IdleManager } from '@/managers/IdleManager';
import { LevelManager } from '@/managers/LevelManager';
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
import { ActivityBanner, BANNER_HEIGHT } from '@/gameobjects/ui/ActivityBanner';
import { ComboSystem } from '@/systems/ComboSystem';
import { FlowerEasterEggSystem } from '@/systems/FlowerEasterEggSystem';
import { MergeStatsSystem } from '@/systems/MergeStatsSystem';
import { TutorialSystem } from '@/systems/TutorialSystem';
import { SoundSystem } from '@/systems/SoundSystem';
import { GMManager } from '@/managers/GMManager';
import { GMPanel } from '@/gameobjects/ui/GMPanel';
import { RegularCustomerManager } from '@/managers/RegularCustomerManager';
import { DecorationManager } from '@/managers/DecorationManager';
import { StaminaPanel } from '@/gameobjects/ui/StaminaPanel';
import { RegularCustomerPanel } from '@/gameobjects/ui/RegularCustomerPanel';
import { StoryPopup } from '@/gameobjects/ui/StoryPopup';
import { DecorationPanel } from '@/gameobjects/ui/DecorationPanel';
import { FloatingMenu } from '@/gameobjects/ui/FloatingMenu';
import { SceneSwitch } from '@/gameobjects/ui/SceneSwitch';
import { CUSTOMER_TYPES } from '@/config/CustomerConfig';
import { DESIGN_WIDTH, COLORS, FONT_FAMILY, INFO_BAR_HEIGHT, BoardMetrics } from '@/config/Constants';
import { TextureCache } from '@/utils/TextureCache';
import { AdManager } from '@/managers/AdManager';
import { CollectionManager } from '@/managers/CollectionManager';
import { FlowerCardManager } from '@/managers/FlowerCardManager';
import { DressUpManager } from '@/managers/DressUpManager';
import { SocialManager } from '@/managers/SocialManager';
import { EventManager } from '@/managers/EventManager';
import { ChallengeManager } from '@/managers/ChallengeManager';
import { HapticSystem } from '@/systems/HapticSystem';
import { CollectionPanel } from '@/gameobjects/ui/CollectionPanel';
import { FlowerCardPanel } from '@/gameobjects/ui/FlowerCardPanel';
import { DressUpPanel } from '@/gameobjects/ui/DressUpPanel';
import { EventPanel } from '@/gameobjects/ui/EventPanel';
import { ChallengePanel } from '@/gameobjects/ui/ChallengePanel';
import { LeaderboardPanel } from '@/gameobjects/ui/LeaderboardPanel';

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
  private _activityBanner!: ActivityBanner;

  // ---- 体验增强系统 ----
  private _comboSystem!: ComboSystem;
  private _flowerEasterEgg!: FlowerEasterEggSystem;
  private _mergeStats!: MergeStatsSystem;

  // ---- 留存系统 ----
  private _tutorialSystem!: TutorialSystem;
  private _checkInPanel!: CheckInPanel;
  private _questPanel!: QuestPanel;
  private _offlineRewardPanel!: OfflineRewardPanel;
  private _levelUpPopup!: LevelUpPopup;

  // ---- GM 调试 ----
  private _gmPanel!: GMPanel;

  // ---- 新增系统 ----
  private _staminaPanel!: StaminaPanel;
  private _regularPanel!: RegularCustomerPanel;
  private _storyPopup!: StoryPopup;
  private _decoPanel!: DecorationPanel;

  // ---- 新UI架构 ----
  private _floatingMenu!: FloatingMenu;
  private _sceneSwitch!: SceneSwitch;

  // ---- 新增系统 Phase 7+ ----
  private _hapticSystem!: HapticSystem;
  private _collectionPanel!: CollectionPanel;
  private _flowerCardPanel!: FlowerCardPanel;
  private _dressUpPanel!: DressUpPanel;
  private _eventPanel!: EventPanel;
  private _challengePanel!: ChallengePanel;
  private _leaderboardPanel!: LeaderboardPanel;

  // ---- 离线计时 ----
  private _idleSaveTimer = 0;
  private _initialized = false;

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
      IdleManager.init();
      LevelManager.init();
      RegularCustomerManager.init();
      DecorationManager.init();
      SoundSystem.init();

      // Phase 7+ 新系统初始化
      AdManager.init();
      CollectionManager.init();
      FlowerCardManager.init();
      DressUpManager.init();
      SocialManager.init();
      EventManager.init();
      ChallengeManager.init();

      this._bindCustomerEvents();
      this._bindSystemEvents();

      this._initialized = true;

      // 启动后处理（延迟一帧确保UI就绪）
      setTimeout(() => this._onGameReady(), 100);
    }

    Game.ticker.add(this._update, this);
  }

  onExit(): void {
    Game.ticker.remove(this._update, this);

    // 停止所有触觉反馈效果，恢复容器位置（防止抖动残留导致坐标错乱）
    if (this._hapticSystem) {
      this._hapticSystem.stopAll();
    }
  }

  /** 游戏就绪后的启动流程 */
  private _onGameReady(): void {
    // 1. 检查离线收益
    const offlineReward = IdleManager.calculateOfflineReward();
    if (offlineReward) {
      this._offlineRewardPanel.show(offlineReward);
      return; // 先展示离线收益，后续引导在关闭后触发
    }

    // 2. 检查签到
    if (CheckInManager.canCheckIn) {
      // 延迟弹出签到面板
      setTimeout(() => {
        if (!this._tutorialSystem.isActive) {
          this._checkInPanel.open();
        }
      }, 500);
    }

    // 3. 启动新手引导（如果需要）
    this._tutorialSystem.start();

    // 4. 任务完成提示
    if (QuestManager.hasClaimableQuest) {
      ToastMessage.show('📋 有已完成的每日任务可领取！');
    }
    if (QuestManager.hasClaimableAchievement) {
      ToastMessage.show('🏆 有成就奖励可领取！');
    }
  }

  private _buildUI(): void {
    let y = Game.safeTop;

    // 上半部分花店场景背景（从屏幕顶部 y=0 覆盖到棋盘顶部）
    const sceneBgTex = TextureCache.get('shop_scene_bg');
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

    // 活动横幅（限时活动 / 每日任务 / 挑战入口）
    this._activityBanner = new ActivityBanner(DESIGN_WIDTH - 24);
    this._activityBanner.position.set(12, y);
    this.container.addChild(this._activityBanner);
    y += BANNER_HEIGHT + 4;

    // 店铺区域（店主左侧 + 客人横向滚动）
    this._shopArea = new PIXI.Container();
    this._shopArea.position.set(0, y);
    this._buildShopArea();
    this.container.addChild(this._shopArea);

    // 棋盘
    this._boardView = new BoardView();
    this.container.addChild(this._boardView);

    // 底部物品信息栏（紧贴棋盘下方装饰条之后，填满剩余空间）
    const barY = BoardMetrics.topY + BoardMetrics.areaHeight + 18;
    const barH = Game.logicHeight - barY;
    this._infoBar = new ItemInfoBar(barH);
    this._infoBar.position.set(0, barY);
    this.container.addChild(this._infoBar);

    // 合成线可视化面板（全屏覆盖层，初始隐藏）
    this._mergeChainPanel = new MergeChainPanel();
    this.container.addChild(this._mergeChainPanel);

    EventBus.on('mergeChain:open', (itemId: string) => {
      this._mergeChainPanel.open(itemId);
    });

    // 仓库面板
    this._warehousePanel = new WarehousePanel();
    this.container.addChild(this._warehousePanel);

    EventBus.on('nav:openWarehouse', () => {
      this._warehousePanel.open();
    });

    // 连击系统
    this._comboSystem = new ComboSystem(this.container);

    // 花语合成彩蛋系统
    this._flowerEasterEgg = new FlowerEasterEggSystem(this.container);

    // 合成统计系统
    this._mergeStats = new MergeStatsSystem(this.container);

    // 触觉反馈系统（震动+粒子+屏幕抖动）
    // 传入 this.container 作为抖动目标，避免修改 Game.stage.pivot 导致场景切换后坐标错乱
    this._hapticSystem = new HapticSystem(this.container, this.container);

    // 左侧悬浮功能按钮组（签到/任务/熟客，纵向排列在棋盘左侧）
    // 参考 Merge Mansion / Travel Town：功能入口悬浮在棋盘边缘，不占用独立行空间
    this._floatingMenu = new FloatingMenu();
    this.container.addChild(this._floatingMenu);

    // 右下角场景切换按钮（参考四季物语 → 切换到花店场景）
    this._sceneSwitch = new SceneSwitch();
    this.container.addChild(this._sceneSwitch);

    // ---- 留存系统 UI（全局覆盖层，任何场景都能使用） ----
    const overlay = OverlayManager.container;

    // 新手引导系统
    this._tutorialSystem = new TutorialSystem(this.container);

    // 签到面板
    this._checkInPanel = new CheckInPanel();
    overlay.addChild(this._checkInPanel);

    // 每日任务面板
    this._questPanel = new QuestPanel();
    overlay.addChild(this._questPanel);

    // 离线收益面板
    this._offlineRewardPanel = new OfflineRewardPanel();
    overlay.addChild(this._offlineRewardPanel);

    // 升级弹窗
    this._levelUpPopup = new LevelUpPopup();
    overlay.addChild(this._levelUpPopup);

    // 体力不足面板
    this._staminaPanel = new StaminaPanel();
    overlay.addChild(this._staminaPanel);

    // 熟客档案面板
    this._regularPanel = new RegularCustomerPanel();
    overlay.addChild(this._regularPanel);

    // 花语故事弹窗
    this._storyPopup = new StoryPopup();
    overlay.addChild(this._storyPopup);

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
  }

  /** 店铺区域高度（设计坐标），供外部布局计算 */
  static readonly SHOP_HEIGHT = 250;

  private _ownerContainer!: PIXI.Container;
  private _ownerSprite!: PIXI.Sprite;
  private _ownerBreathT = 0;

  private _buildShopArea(): void {
    const H = MainScene.SHOP_HEIGHT;
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

    // GM 激活点击移至店主精灵
    this._ownerSprite.eventMode = 'static';
    this._ownerSprite.cursor = 'pointer';
    this._ownerSprite.on('pointerdown', () => GMManager.onTitleTap());

    // GM 入口按钮（隐藏于店主区域角落，激活后可见）
    const gmBtn = new PIXI.Text('🛠️', { fontSize: 12, fontFamily: FONT_FAMILY });
    gmBtn.anchor.set(0.5, 0.5);
    gmBtn.position.set(OWNER_W / 2 - 6, -120);
    gmBtn.eventMode = 'static';
    gmBtn.cursor = 'pointer';
    gmBtn.visible = GMManager.isEnabled;
    gmBtn.name = 'gmBtn';
    gmBtn.on('pointerdown', () => GMManager.openPanel());
    this._ownerContainer.addChild(gmBtn);
    EventBus.on('gm:activated', () => { gmBtn.visible = true; });

    this._ownerContainer.position.set(ownerCX, CHAR_BOTTOM_Y);
    // 点击店主 → 打开换装面板
    this._ownerContainer.eventMode = 'static';
    this._ownerContainer.cursor = 'pointer';
    this._ownerContainer.hitArea = new PIXI.Circle(0, 0, 48);
    this._ownerContainer.on('pointertap', () => {
      EventBus.emit('panel:openDressUp');
    });
    this._shopArea.addChild(this._ownerContainer);

    // 刷新装备显示
    this._refreshOwnerOutfit();

    // 监听换装变化
    EventBus.on('dressup:equipped', () => this._refreshOwnerOutfit());

    // ═══════ 2. 客人横向滚动区（可左右滑动） ═══════
    const customerAreaW = W - CUSTOMER_LEFT - PAD;
    this._customerScrollArea = new CustomerScrollArea(customerAreaW);
    this._customerScrollArea.position.set(CUSTOMER_LEFT, 0);
    this._shopArea.addChild(this._customerScrollArea);
  }

  /** 刷新店主形象外观 */
  private _refreshOwnerOutfit(): void {
    const outfit = DressUpManager.getEquipped();
    const outfitId = outfit?.id || 'outfit_default';

    // 尝试加载当前形象的 chibi 纹理，回退到默认
    const tex = TextureCache.get(`owner_chibi_${outfitId}`)
             || TextureCache.get('owner_chibi_default');

    if (tex && this._ownerSprite) {
      this._ownerSprite.texture = tex;
      const targetH = 180;
      const scale = targetH / tex.height;
      this._ownerSprite.scale.set(scale);
    }
  }

  /** 绑定客人相关事件 */
  private _bindCustomerEvents(): void {
    // 点击"完成"后：先播放飞行动画，动画结束后再真正执行交付
    EventBus.on('customer:requestDeliver', (uid: number, customer: any, globalPos: PIXI.Point) => {
      const startLocal = this.container.toLocal(globalPos);

      let pendingAnims = 0;
      const onAnimDone = () => {
        pendingAnims--;
        if (pendingAnims <= 0) {
          CustomerManager.deliver(uid);
        }
      };

      // 花愿飞行动画
      if (customer.huayuanReward > 0) {
        pendingAnims++;
        const targetPos = this._topBar.getHuayuanIconPos();
        const endX = this._topBar.x + targetPos.x;
        const endY = this._topBar.y + targetPos.y;
        this._playRewardFly('icon_huayuan', startLocal.x, startLocal.y, endX, endY, customer.huayuanReward, () => {
          this._topBar.flashHuayuan();
          onAnimDone();
        });
      }

      // 花露飞行动画（略微延迟）
      if (customer.hualuReward > 0) {
        pendingAnims++;
        const targetPos = this._topBar.getHualuIconPos();
        const endX = this._topBar.x + targetPos.x;
        const endY = this._topBar.y + targetPos.y;
        this._playRewardFly('icon_hualu', startLocal.x, startLocal.y - 10, endX, endY, customer.hualuReward, () => {
          this._topBar.flashHualu();
          onAnimDone();
        }, 0.08);
      }

      // 无奖励时直接交付
      if (pendingAnims === 0) {
        CustomerManager.deliver(uid);
      }
    });

    // 交付完成后的 Toast 提示
    EventBus.on('customer:delivered', (_uid: number, customer: any) => {
      ToastMessage.show(`${customer.name} 满意离开！🌸花愿+${customer.huayuanReward}${customer.hualuReward > 0 ? ` 💧花露+${customer.hualuReward}` : ''}`);
    });
  }

  /**
   * 播放奖励图标飞行动画
   * 生成多个小图标从起点散开，沿弧线飞向终点
   */
  private _playRewardFly(
    texKey: string,
    sx: number, sy: number,
    ex: number, ey: number,
    _amount: number,
    onAllArrived: () => void,
    initialDelay = 0,
  ): void {
    const tex = TextureCache.get(texKey);
    const COUNT = Math.min(Math.max(3, Math.ceil(_amount / 5)), 8);
    const ICON_SIZE = 28;
    const FLY_DURATION = 0.5;
    const STAGGER = 0.04;
    let arrived = 0;

    for (let i = 0; i < COUNT; i++) {
      const icon = tex
        ? new PIXI.Sprite(tex)
        : new PIXI.Text('🌸', { fontSize: 20 });

      icon.anchor.set(0.5);

      // 计算目标 scale（让图标显示为 ICON_SIZE x ICON_SIZE）
      let targetScale = 1;
      if (icon instanceof PIXI.Sprite && tex) {
        targetScale = ICON_SIZE / Math.max(tex.width, tex.height);
      }

      const randX = (Math.random() - 0.5) * 60;
      const randY = (Math.random() - 0.5) * 40;
      icon.position.set(sx + randX, sy + randY);
      icon.alpha = 0;
      icon.scale.set(targetScale * 0.3);

      this.container.addChild(icon);

      const delay = initialDelay + i * STAGGER;

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
          const cpx = (icon.x + ex) / 2 + (Math.random() - 0.5) * 80;
          const cpy = Math.min(icon.y, ey) - 30 - Math.random() * 40;
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
              icon.x = mt * mt * startX + 2 * mt * t * cpx + t * t * ex;
              icon.y = mt * mt * startY + 2 * mt * t * cpy + t * t * ey;
              icon.scale.set(targetScale * (1 - t * 0.5));
              icon.alpha = t < 0.8 ? 1 : 1 - (t - 0.8) / 0.2;
            },
            onComplete: () => {
              icon.destroy();
              arrived++;
              if (arrived === COUNT) {
                onAllArrived();
              }
            },
          });
        },
      });
    }
  }

  /** 绑定留存系统事件 */
  private _bindSystemEvents(): void {
    // 签到面板
    EventBus.on('nav:openCheckIn', () => this._checkInPanel.open());

    // 签到成功
    EventBus.on('checkin:signed', (reward: any, streakBonus: number) => {
      let msg = `✅ 签到成功！${reward.desc}`;
      if (streakBonus > 0) msg += ` (连续加成 +${streakBonus}💰)`;
      ToastMessage.show(msg);
    });

    // 任务面板
    EventBus.on('nav:openQuest', () => this._questPanel.open());

    // 任务完成提示
    EventBus.on('quest:taskCompleted', (defId: string) => {
      const def = QuestManager.getQuestDef(defId);
      if (def) ToastMessage.show(`✅ 任务完成：${def.name}！`);
    });

    // 成就解锁提示
    EventBus.on('achievement:unlocked', (defId: string, _tierIndex: number) => {
      const def = QuestManager.getAchievementDef(defId);
      if (def) ToastMessage.show(`🏆 成就达成：${def.name}！`);
    });

    // 活动/任务赠送整套形象
    EventBus.on('event:grantOutfit', (outfitId: string) => {
      if (DressUpManager.grantOutfit(outfitId)) {
        ToastMessage.show('🎁 获得新形象，快去换装看看！');
      }
    });

    // 升级弹窗
    EventBus.on('level:up', (level: number, reward: any) => {
      this._levelUpPopup.show(level, reward);
    });

    // 离线收益领取后检查签到
    EventBus.on('idle:claimed', () => {
      setTimeout(() => {
        if (CheckInManager.canCheckIn && !this._tutorialSystem.isActive) {
          this._checkInPanel.open();
        }
        this._tutorialSystem.start();
      }, 500);
    });

    // 引导完成
    EventBus.on('tutorial:completed', () => {
      ToastMessage.show('🌸 欢迎来到花语小筑！');
      if (CheckInManager.canCheckIn) {
        setTimeout(() => this._checkInPanel.open(), 1000);
      }
    });

    // ---- 体力系统事件 ----

    // 体力不足 → 弹出体力面板引导
    EventBus.on('building:noStamina', () => {
      this._staminaPanel.open();
    });

    // ---- 熟客系统事件 ----

    // 打开熟客面板
    EventBus.on('nav:openRegular', () => this._regularPanel.open());

    // 熟客问候（到店时的对话气泡）
    EventBus.on('regular:greeting', (_typeId: string, name: string, greeting: string) => {
      ToastMessage.show(`💬 ${name}：「${greeting}」`);
    });

    // 熟客感谢（交付后的对话）
    EventBus.on('regular:thanks', (_typeId: string, name: string, thanks: string) => {
      ToastMessage.show(`💝 ${name}：「${thanks}」`);
    });

    // 好感度升级提示
    EventBus.on('regular:favorLevelUp', (typeId: string, level: number) => {
      const type = CUSTOMER_TYPES.find(t => t.id === typeId);
      if (type) {
        const levelNames = ['陌生', '熟悉', '亲密', '挚友'];
        ToastMessage.show(`✨ ${type.name}的好感度升至「${levelNames[level] || ''}」！`);
      }
    });

    // 新故事可解锁提示
    EventBus.on('regular:storyAvailable', (typeId: string, _chapterIdx: number) => {
      const type = CUSTOMER_TYPES.find(t => t.id === typeId);
      if (type) {
        ToastMessage.show(`📖 ${type.name}的新花语故事可以阅读了！`);
      }
    });

    // 展示故事弹窗
    EventBus.on('regular:showStory', (typeId: string, chapterIdx: number, chapter: any) => {
      this._storyPopup.show(typeId, chapterIdx, chapter);
    });

    // ---- 装修系统事件 ----
    EventBus.on('nav:openDeco', () => this._decoPanel.open());

    EventBus.on('decoration:unlocked', (_decoId: string, deco: any) => {
      ToastMessage.show(`✨ 解锁新装饰：「${deco.name}」！`);
    });

    EventBus.on('decoration:equipped', (slot: string, _decoId: string) => {
      ToastMessage.show(`🏠 已装备新${slot}装饰！`);
    });

    // ---- 场景入口事件（左侧浮动按钮） ----
    EventBus.on('nav:openDressup', () => {
      ToastMessage.show('👗 主角装扮系统已上线！');
      EventBus.emit('panel:openDressUp');
    });

    EventBus.on('nav:openAlbum', () => {
      ToastMessage.show('📖 花语图鉴已上线！');
      EventBus.emit('panel:openCollection');
    });

    // ---- 限时活动入口 ----
    EventBus.on('nav:openEvent', () => {
      EventBus.emit('panel:openEvent');
    });

    // ---- 挑战关卡入口 ----
    EventBus.on('nav:openChallenge', () => {
      EventBus.emit('panel:openChallenge');
    });

    // ---- 排行榜入口 ----
    EventBus.on('nav:openLeaderboard', () => {
      EventBus.emit('panel:openLeaderboard');
    });

    // ---- 花语卡片收集事件 ----
    EventBus.on('flowerCard:collected', (card: any) => {
      ToastMessage.show(`🌸 获得花语卡片：「${card.name}」！`);
    });

    EventBus.on('flowerCard:complete', () => {
      ToastMessage.show('🎉 集齐所有花语卡片！获得传说奖励！');
    });

    // ---- 图鉴发现事件 ----
    EventBus.on('collection:discovered', (_cat: string, _itemId: string) => {
      // 新发现不打扰游戏，只更新红点
    });

    EventBus.on('collection:milestoneReady', (percent: number) => {
      ToastMessage.show(`📖 图鉴收集达到 ${percent}%！有里程碑奖励可领取！`);
    });

    // ---- 限时活动事件 ----
    EventBus.on('event:taskCompleted', (_taskId: string, task: any) => {
      ToastMessage.show(`🎪 活动任务完成：${task.name}！`);
    });

    EventBus.on('event:started', (event: any) => {
      ToastMessage.show(`🎉 限时活动开启：${event.name}！`);
    });

    // ---- 挑战事件 ----
    EventBus.on('challenge:ended', (_levelId: string, success: boolean, stars: number) => {
      if (success) {
        ToastMessage.show(`⭐ 挑战成功！获得 ${'⭐'.repeat(stars)} 评价！`);
      } else {
        ToastMessage.show('💔 挑战失败，再试一次？');
      }
    });

    // ---- 场景切换事件（切换到花店场景） ----
    EventBus.on('scene:switchToShop', () => {
      this._switchToShopScene();
    });
  }

  /** 更新红点 */
  private _updateRedDots(): void {
    // 活动红点
    this._floatingMenu.setRedDot('event', EventManager.hasClaimableTask);
    this._floatingMenu.setRedDot('quest', QuestManager.hasClaimableQuest || QuestManager.hasClaimableAchievement);

    // 底部栏红点（装修按钮）
    this._infoBar.updateQuickBtnRedDots();

    // 活动横幅红点
    this._activityBanner.updateRedDots();
  }

  /** 切换到花店场景（带过渡动画） */
  private _switchToShopScene(): void {
    // 淡出当前场景 → 切换到花店场景
    TweenManager.to({
      target: this.container,
      props: { alpha: 0 },
      duration: 0.3,
      ease: Ease.easeInQuad,
      onComplete: () => {
        this.container.alpha = 1; // 恢复（下次进入时用）
        SceneManager.switchTo('shop');
      },
    });
  }

  private _update(): void {
    const dt = Game.ticker.deltaMS / 1000;
    CurrencyManager.update(dt);
    BuildingManager.update(dt);
    CustomerManager.update(dt);
    // 注意：TweenManager.update 已在 Game.init 的全局 ticker 中注册，
    // 此处不再重复调用，避免动画速度翻倍
    SaveManager.update(dt);

    this._boardView.updateCdDisplay();
    this._topBar.updateTimer();
    this._staminaPanel.updateTimer();
    this._comboSystem.update(dt);
    this._hapticSystem.update(dt);
    ChallengeManager.update(dt);

    // 客人滚动区惯性动画
    this._customerScrollArea.update(dt);

    const ownerBaseY = 195;
    this._ownerBreathT += dt;
    if (this._ownerContainer && !this._ownerContainer.destroyed) {
      this._ownerContainer.y = ownerBaseY + Math.sin(this._ownerBreathT * 1.8) * 2;
    }

    // 定期保存离线时间戳
    this._idleSaveTimer += dt;
    if (this._idleSaveTimer >= 30) {
      this._idleSaveTimer = 0;
      IdleManager.recordOnline();
    }

    // 每5秒更新红点
    this._updateRedDots();
  }
}
