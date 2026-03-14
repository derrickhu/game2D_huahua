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
import { Scene } from '@/core/SceneManager';
import { Game } from '@/core/Game';
import { EventBus } from '@/core/EventBus';
import { BoardManager } from '@/managers/BoardManager';
import { CurrencyManager } from '@/managers/CurrencyManager';
import { BuildingManager } from '@/managers/BuildingManager';
import { CustomerManager } from '@/managers/CustomerManager';
import { SaveManager } from '@/managers/SaveManager';
import { QuestManager } from '@/managers/QuestManager';
import { CheckInManager } from '@/managers/CheckInManager';
import { IdleManager } from '@/managers/IdleManager';
import { LevelManager } from '@/managers/LevelManager';
import { TweenManager } from '@/core/TweenManager';
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
import { GMManager } from '@/managers/GMManager';
import { GMPanel } from '@/gameobjects/ui/GMPanel';
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

  // ---- 离线计时 ----
  private _idleSaveTimer = 0;

  constructor() {
    this.container = new PIXI.Container();
  }

  onEnter(): void {
    this._buildUI();
    this._boardView.refresh();

    // 启动核心管理器
    CustomerManager.init();
    QuestManager.init();
    CheckInManager.init();
    IdleManager.init();
    LevelManager.init();

    this._bindCustomerEvents();
    this._bindSystemEvents();

    Game.ticker.add(this._update, this);

    // 启动后处理（延迟一帧确保UI就绪）
    setTimeout(() => this._onGameReady(), 100);
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

    // 底部物品信息栏
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

    // ---- 留存系统 UI ----

    // 新手引导系统
    this._tutorialSystem = new TutorialSystem(this.container);

    // 签到面板
    this._checkInPanel = new CheckInPanel();
    this.container.addChild(this._checkInPanel);

    // 每日任务面板
    this._questPanel = new QuestPanel();
    this.container.addChild(this._questPanel);

    // 离线收益面板
    this._offlineRewardPanel = new OfflineRewardPanel();
    this.container.addChild(this._offlineRewardPanel);

    // 升级弹窗
    this._levelUpPopup = new LevelUpPopup();
    this.container.addChild(this._levelUpPopup);

    // GM 调试面板（最高层级）
    this._gmPanel = new GMPanel();
    this.container.addChild(this._gmPanel);
  }

  /** 店铺区域高度（设计坐标），供外部布局计算 */
  static readonly SHOP_HEIGHT = 220;

  private _buildShopArea(): void {
    // 店铺背景
    const bg = new PIXI.Graphics();
    bg.beginFill(0xFFF0E0, 0.6);
    bg.drawRoundedRect(20, 0, DESIGN_WIDTH - 40, MainScene.SHOP_HEIGHT, 16);
    bg.endFill();
    this._shopArea.addChild(bg);

    // 花店招牌
    const title = new PIXI.Text('🌸 花语小筑 🌸', {
      fontSize: 22,
      fill: COLORS.TEXT_DARK,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    title.anchor.set(0.5, 0);
    title.position.set(DESIGN_WIDTH / 2, 6);
    title.eventMode = 'static';
    title.cursor = 'pointer';
    title.on('pointerdown', () => GMManager.onTitleTap());
    this._shopArea.addChild(title);

    // GM 入口按钮（已激活 GM 模式时显示在店铺右上角）
    const gmBtn = new PIXI.Text('🛠️', { fontSize: 18, fontFamily: FONT_FAMILY });
    gmBtn.anchor.set(0.5, 0.5);
    gmBtn.position.set(DESIGN_WIDTH - 50, 16);
    gmBtn.eventMode = 'static';
    gmBtn.cursor = 'pointer';
    gmBtn.visible = GMManager.isEnabled;
    gmBtn.name = 'gmBtn';
    gmBtn.on('pointerdown', () => GMManager.openPanel());
    this._shopArea.addChild(gmBtn);

    // 监听 GM 激活事件，显示入口
    EventBus.on('gm:activated', () => {
      gmBtn.visible = true;
    });

    // 店主（Q版占位，稍小）
    const owner = new PIXI.Graphics();
    owner.beginFill(0xFFDDB8);
    owner.drawCircle(DESIGN_WIDTH / 2, 58, 26);
    owner.endFill();
    owner.beginFill(0x4A3728);
    owner.drawCircle(DESIGN_WIDTH / 2 - 8, 53, 3);
    owner.drawCircle(DESIGN_WIDTH / 2 + 8, 53, 3);
    owner.endFill();
    owner.lineStyle(2, 0x4A3728);
    owner.arc(DESIGN_WIDTH / 2, 63, 8, 0, Math.PI);
    this._shopArea.addChild(owner);

    const ownerLabel = new PIXI.Text('店主', {
      fontSize: 11,
      fill: COLORS.TEXT_LIGHT,
      fontFamily: FONT_FAMILY,
    });
    ownerLabel.anchor.set(0.5, 0);
    ownerLabel.position.set(DESIGN_WIDTH / 2, 88);
    this._shopArea.addChild(ownerLabel);

    // 柜台
    const counter = new PIXI.Graphics();
    counter.beginFill(0xD2B48C);
    counter.drawRoundedRect(60, 106, DESIGN_WIDTH - 120, 30, 8);
    counter.endFill();
    counter.beginFill(0xC4A882);
    counter.drawRoundedRect(60, 122, DESIGN_WIDTH - 120, 14, 8);
    counter.endFill();
    this._shopArea.addChild(counter);

    // 功能按钮区（签到、任务）
    this._buildShopButtons();

    // 客人区域（柜台下方）
    this._customerViews = [];
    const slotPositions = [
      { x: DESIGN_WIDTH * 0.3, y: 168 },
      { x: DESIGN_WIDTH * 0.7, y: 168 },
    ];

    for (let i = 0; i < MAX_CUSTOMERS; i++) {
      const cv = new CustomerView();
      cv.position.set(slotPositions[i].x, slotPositions[i].y);
      this._shopArea.addChild(cv);
      this._customerViews.push(cv);
    }
  }

  /** 店铺区域内的快捷入口按钮 */
  private _buildShopButtons(): void {
    const buttons = [
      { icon: '📅', label: '签到', event: 'nav:openCheckIn', x: 40 },
      { icon: '📋', label: '任务', event: 'nav:openQuest', x: 110 },
    ];

    for (const btn of buttons) {
      // 按钮背景
      const bg = new PIXI.Graphics();
      bg.beginFill(0xFFFFFF, 0.6);
      bg.drawRoundedRect(btn.x, 36, 56, 56, 12);
      bg.endFill();
      bg.lineStyle(1, 0xE0D0C0, 0.5);
      bg.drawRoundedRect(btn.x, 36, 56, 56, 12);
      this._shopArea.addChild(bg);

      // 图标
      const icon = new PIXI.Text(btn.icon, { fontSize: 22, fontFamily: FONT_FAMILY });
      icon.anchor.set(0.5, 0.5);
      icon.position.set(btn.x + 28, 56);
      this._shopArea.addChild(icon);

      // 标签
      const label = new PIXI.Text(btn.label, {
        fontSize: 10, fill: COLORS.TEXT_LIGHT, fontFamily: FONT_FAMILY,
      });
      label.anchor.set(0.5, 0);
      label.position.set(btn.x + 28, 74);
      this._shopArea.addChild(label);

      // 交互
      const hit = new PIXI.Container();
      hit.hitArea = new PIXI.Rectangle(btn.x, 36, 56, 56);
      hit.eventMode = 'static';
      hit.cursor = 'pointer';
      hit.on('pointerdown', () => EventBus.emit(btn.event));
      this._shopArea.addChild(hit);

      // 红点标记（有可领取内容时显示）
      const redDot = new PIXI.Graphics();
      redDot.beginFill(0xFF3333);
      redDot.drawCircle(btn.x + 50, 40, 6);
      redDot.endFill();
      redDot.name = `redDot_${btn.event}`;
      redDot.visible = false;
      this._shopArea.addChild(redDot);
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
    const checkInDot = this._shopArea.getChildByName('redDot_nav:openCheckIn') as PIXI.Graphics;
    if (checkInDot) checkInDot.visible = CheckInManager.canCheckIn;

    const questDot = this._shopArea.getChildByName('redDot_nav:openQuest') as PIXI.Graphics;
    if (questDot) questDot.visible = QuestManager.hasClaimableQuest || QuestManager.hasClaimableAchievement;
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
