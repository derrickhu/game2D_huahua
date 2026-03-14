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
import { CustomerView } from '@/gameobjects/customer/CustomerView';
import { TopBar, TOP_BAR_HEIGHT } from '@/gameobjects/ui/TopBar';
import { ItemInfoBar } from '@/gameobjects/ui/ItemInfoBar';
import { MergeChainPanel } from '@/gameobjects/ui/MergeChainPanel';
import { WarehousePanel } from '@/gameobjects/ui/WarehousePanel';
import { ToastMessage } from '@/gameobjects/ui/ToastMessage';
import { CheckInPanel } from '@/gameobjects/ui/CheckInPanel';
import { QuestPanel } from '@/gameobjects/ui/QuestPanel';
import { OfflineRewardPanel } from '@/gameobjects/ui/OfflineRewardPanel';
import { LevelUpPopup } from '@/gameobjects/ui/LevelUpPopup';
import { MergeHintSystem } from '@/systems/MergeHintSystem';
import { ComboSystem } from '@/systems/ComboSystem';
import { FlowerEasterEggSystem } from '@/systems/FlowerEasterEggSystem';
import { SeasonSystem } from '@/systems/SeasonSystem';
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
import { DESIGN_WIDTH, COLORS, FONT_FAMILY, MAX_CUSTOMERS, INFO_BAR_HEIGHT } from '@/config/Constants';

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
  private _customerViews: CustomerView[] = [];

  // ---- 体验增强系统 ----
  private _mergeHintSystem!: MergeHintSystem;
  private _comboSystem!: ComboSystem;
  private _flowerEasterEgg!: FlowerEasterEggSystem;
  private _seasonSystem!: SeasonSystem;
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

  // ---- 离线计时 ----
  private _idleSaveTimer = 0;
  private _initialized = false;

  constructor() {
    this.container = new PIXI.Container();
  }

  onEnter(): void {
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

    // 顶部信息栏（紧贴安全区下方）
    this._topBar = new TopBar();
    this._topBar.position.set(0, y);
    this.container.addChild(this._topBar);
    y += TOP_BAR_HEIGHT + 8;

    // 店铺区域（含客人）
    this._shopArea = new PIXI.Container();
    this._shopArea.position.set(0, y);
    this._buildShopArea();
    this.container.addChild(this._shopArea);

    // 棋盘
    this._boardView = new BoardView();
    this.container.addChild(this._boardView);

    // 底部物品信息栏（紧贴屏幕底部）
    const barY = Game.logicHeight - INFO_BAR_HEIGHT;
    this._infoBar = new ItemInfoBar();
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

    // 可合成提示系统
    this._mergeHintSystem = new MergeHintSystem(this._boardView);

    // 连击系统
    this._comboSystem = new ComboSystem(this.container);

    // 操作时通知提示系统重置空闲计时
    EventBus.on('board:merged', () => this._mergeHintSystem.notifyInteraction());
    EventBus.on('board:moved', () => this._mergeHintSystem.notifyInteraction());
    EventBus.on('board:itemSelected', () => this._mergeHintSystem.notifyInteraction());

    // 花语合成彩蛋系统
    this._flowerEasterEgg = new FlowerEasterEggSystem(this.container);

    // 季节主题系统
    this._seasonSystem = new SeasonSystem(this.container);

    // 合成统计系统
    this._mergeStats = new MergeStatsSystem(this.container);

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
  }

  /** 店铺区域高度（设计坐标），供外部布局计算 */
  static readonly SHOP_HEIGHT = 160;

  private _buildShopArea(): void {
    // 店铺背景（柔和的花店氛围）
    const bg = new PIXI.Graphics();
    bg.beginFill(0xFFF3E8, 0.7);
    bg.drawRoundedRect(12, 0, DESIGN_WIDTH - 24, MainScene.SHOP_HEIGHT, 16);
    bg.endFill();
    bg.beginFill(0xFFE8D0, 0.3);
    bg.drawRoundedRect(12, MainScene.SHOP_HEIGHT - 12, DESIGN_WIDTH - 24, 12, 8);
    bg.endFill();
    this._shopArea.addChild(bg);

    // 花店招牌（居中，精致胶囊样式）
    const titleBg = new PIXI.Graphics();
    titleBg.beginFill(0xFFFFFF, 0.6);
    titleBg.drawRoundedRect(DESIGN_WIDTH / 2 - 90, 4, 180, 30, 15);
    titleBg.endFill();
    titleBg.lineStyle(1.5, 0xFFD4A8, 0.5);
    titleBg.drawRoundedRect(DESIGN_WIDTH / 2 - 90, 4, 180, 30, 15);
    this._shopArea.addChild(titleBg);

    const title = new PIXI.Text('🌸 花语小筑 🌸', {
      fontSize: 18,
      fill: COLORS.TEXT_DARK,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    title.anchor.set(0.5, 0);
    title.position.set(DESIGN_WIDTH / 2, 8);
    title.eventMode = 'static';
    title.cursor = 'pointer';
    title.on('pointerdown', () => GMManager.onTitleTap());
    this._shopArea.addChild(title);

    // GM 入口按钮
    const gmBtn = new PIXI.Text('🛠️', { fontSize: 16, fontFamily: FONT_FAMILY });
    gmBtn.anchor.set(0.5, 0.5);
    gmBtn.position.set(DESIGN_WIDTH - 40, 18);
    gmBtn.eventMode = 'static';
    gmBtn.cursor = 'pointer';
    gmBtn.visible = GMManager.isEnabled;
    gmBtn.name = 'gmBtn';
    gmBtn.on('pointerdown', () => GMManager.openPanel());
    this._shopArea.addChild(gmBtn);

    EventBus.on('gm:activated', () => { gmBtn.visible = true; });

    // 店主 Q 版形象（居中）
    const ownerContainer = new PIXI.Container();
    const ownerBg = new PIXI.Graphics();
    ownerBg.beginFill(0xFFE4CC, 0.8);
    ownerBg.drawCircle(0, 0, 20);
    ownerBg.endFill();
    ownerBg.lineStyle(2, 0xFFD4A8);
    ownerBg.drawCircle(0, 0, 20);
    ownerContainer.addChild(ownerBg);

    const face = new PIXI.Graphics();
    face.beginFill(0xFFDDB8);
    face.drawCircle(0, 0, 16);
    face.endFill();
    face.beginFill(0x4A3728);
    face.drawCircle(-5, -2, 2);
    face.drawCircle(5, -2, 2);
    face.endFill();
    face.lineStyle(1.5, 0x4A3728);
    face.arc(0, 4, 5, 0, Math.PI);
    ownerContainer.addChild(face);
    ownerContainer.position.set(DESIGN_WIDTH / 2, 56);
    this._shopArea.addChild(ownerContainer);

    const ownerLabel = new PIXI.Text('店主', {
      fontSize: 10, fill: COLORS.TEXT_LIGHT, fontFamily: FONT_FAMILY,
    });
    ownerLabel.anchor.set(0.5, 0);
    ownerLabel.position.set(DESIGN_WIDTH / 2, 80);
    this._shopArea.addChild(ownerLabel);

    // 柜台（精致木纹风格）
    const counter = new PIXI.Graphics();
    counter.beginFill(0xD2B48C);
    counter.drawRoundedRect(60, 95, DESIGN_WIDTH - 120, 24, 8);
    counter.endFill();
    counter.beginFill(0xC4A882);
    counter.drawRoundedRect(60, 107, DESIGN_WIDTH - 120, 12, 6);
    counter.endFill();
    counter.beginFill(0xFFFFFF, 0.15);
    counter.drawRoundedRect(80, 97, DESIGN_WIDTH - 160, 6, 3);
    counter.endFill();
    this._shopArea.addChild(counter);

    // 客人区域（柜台下方）
    this._customerViews = [];
    const slotPositions = [
      { x: DESIGN_WIDTH * 0.3, y: 132 },
      { x: DESIGN_WIDTH * 0.7, y: 132 },
    ];

    for (let i = 0; i < MAX_CUSTOMERS; i++) {
      const cv = new CustomerView();
      cv.position.set(slotPositions[i].x, slotPositions[i].y);
      this._shopArea.addChild(cv);
      this._customerViews.push(cv);
    }
  }

  /** 绑定客人相关事件 */
  private _bindCustomerEvents(): void {
    EventBus.on('customer:arrived', () => this._refreshCustomerViews());
    EventBus.on('customer:lockChanged', () => this._refreshCustomerViews());
    EventBus.on('customer:delivered', (_uid: number, customer: any) => {
      ToastMessage.show(`${customer.name} 满意离开！💰+${customer.goldReward}`);
      this._refreshCustomerViews();
    });
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
      // TODO: 主角换装系统（独立全屏场景）
      ToastMessage.show('👗 主角装扮系统即将开放~');
    });

    EventBus.on('nav:openAlbum', () => {
      // TODO: 图鉴社交系统（独立全屏场景）
      ToastMessage.show('📖 图鉴系统即将开放~');
    });

    // ---- 场景切换事件（切换到花店场景） ----
    EventBus.on('scene:switchToShop', () => {
      this._switchToShopScene();
    });
  }

  /** 刷新客人视图 */
  private _refreshCustomerViews(): void {
    const customers = CustomerManager.customers;
    for (let i = 0; i < this._customerViews.length; i++) {
      if (i < customers.length) {
        this._customerViews[i].setCustomer(customers[i]);
      } else {
        this._customerViews[i].setCustomer(null);
      }
    }
  }

  /** 更新红点 */
  private _updateRedDots(): void {
    // 通过 FloatingMenu 设置红点状态（ItemInfoBar 会读取这些状态）
    this._floatingMenu.setRedDot('checkin', CheckInManager.canCheckIn);
    this._floatingMenu.setRedDot('quest', QuestManager.hasClaimableQuest || QuestManager.hasClaimableAchievement);

    // 熟客红点：有可阅读的新故事
    const hasNewStory = RegularCustomerManager.getAllRegulars().some(d => {
      return RegularCustomerManager.getUnlockableStory(d.typeId) !== null;
    });
    this._floatingMenu.setRedDot('regular', hasNewStory);

    // InfoBar 功能快捷按钮红点更新
    this._infoBar.updateQuickBtnRedDots();
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
    TweenManager.update(dt);
    SaveManager.update(dt);

    this._boardView.updateCdDisplay();
    this._topBar.updateTimer();
    this._staminaPanel.updateTimer();
    this._mergeHintSystem.update(dt);
    this._comboSystem.update(dt);
    this._seasonSystem.update(dt);

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
