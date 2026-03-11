/**
 * 主场景 - 合成经营主界面
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
import { TweenManager } from '@/core/TweenManager';
import { BoardView } from '@/gameobjects/board/BoardView';
import { CustomerView } from '@/gameobjects/customer/CustomerView';
import { TopBar, TOP_BAR_HEIGHT } from '@/gameobjects/ui/TopBar';
import { ItemInfoBar } from '@/gameobjects/ui/ItemInfoBar';
import { MergeChainPanel } from '@/gameobjects/ui/MergeChainPanel';
import { WarehousePanel } from '@/gameobjects/ui/WarehousePanel';
import { ToastMessage } from '@/gameobjects/ui/ToastMessage';
import { MergeHintSystem } from '@/systems/MergeHintSystem';
import { ComboSystem } from '@/systems/ComboSystem';
import { FlowerEasterEggSystem } from '@/systems/FlowerEasterEggSystem';
import { SeasonSystem } from '@/systems/SeasonSystem';
import { MergeStatsSystem } from '@/systems/MergeStatsSystem';
import { DESIGN_WIDTH, COLORS, FONT_FAMILY, MAX_CUSTOMERS, INFO_BAR_HEIGHT } from '@/config/Constants';

export class MainScene implements Scene {
  readonly name = 'main';
  readonly container: PIXI.Container;

  private _boardView!: BoardView;
  private _topBar!: TopBar;
  private _infoBar!: ItemInfoBar;
  private _mergeChainPanel!: MergeChainPanel;
  private _warehousePanel!: WarehousePanel;
  private _mergeHintSystem!: MergeHintSystem;
  private _comboSystem!: ComboSystem;
  private _flowerEasterEgg!: FlowerEasterEggSystem;
  private _seasonSystem!: SeasonSystem;
  private _mergeStats!: MergeStatsSystem;
  private _shopArea!: PIXI.Container;
  private _customerViews: CustomerView[] = [];

  constructor() {
    this.container = new PIXI.Container();
  }

  onEnter(): void {
    this._buildUI();
    this._boardView.refresh();

    // 启动客人系统
    CustomerManager.init();
    this._bindCustomerEvents();

    Game.ticker.add(this._update, this);
  }

  onExit(): void {
    Game.ticker.remove(this._update, this);
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

    // 合成线面板事件
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
    this._shopArea.addChild(title);

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

  /** 绑定客人相关事件 */
  private _bindCustomerEvents(): void {
    EventBus.on('customer:arrived', () => this._refreshCustomerViews());
    EventBus.on('customer:lockChanged', () => this._refreshCustomerViews());
    EventBus.on('customer:delivered', (_uid: number, customer: any) => {
      ToastMessage.show(`${customer.name} 满意离开！💰+${customer.goldReward}`);
      this._refreshCustomerViews();
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
  }
}
