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
import { TopBar } from '@/gameobjects/ui/TopBar';
import { BottomNav } from '@/gameobjects/ui/BottomNav';
import { ToastMessage } from '@/gameobjects/ui/ToastMessage';
import { DESIGN_WIDTH, COLORS, FONT_FAMILY, MAX_CUSTOMERS } from '@/config/Constants';

export class MainScene implements Scene {
  readonly name = 'main';
  readonly container: PIXI.Container;

  private _boardView!: BoardView;
  private _topBar!: TopBar;
  private _bottomNav!: BottomNav;
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
    // 顶部信息栏
    this._topBar = new TopBar();
    this._topBar.position.set(0, 0);
    this.container.addChild(this._topBar);

    // 店铺区域（含客人）
    this._shopArea = new PIXI.Container();
    this._shopArea.position.set(0, 90);
    this._buildShopArea();
    this.container.addChild(this._shopArea);

    // 棋盘
    this._boardView = new BoardView();
    this.container.addChild(this._boardView);

    // 底部导航栏
    const navY = Game.logicHeight - 90;
    this._bottomNav = new BottomNav();
    this._bottomNav.position.set(0, navY);
    this.container.addChild(this._bottomNav);
  }

  private _buildShopArea(): void {
    // 店铺背景
    const bg = new PIXI.Graphics();
    bg.beginFill(0xFFF0E0, 0.6);
    bg.drawRoundedRect(20, 0, DESIGN_WIDTH - 40, 260, 16);
    bg.endFill();
    this._shopArea.addChild(bg);

    // 花店招牌
    const title = new PIXI.Text('🌸 花语小筑 🌸', {
      fontSize: 24,
      fill: COLORS.TEXT_DARK,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    title.anchor.set(0.5, 0);
    title.position.set(DESIGN_WIDTH / 2, 10);
    this._shopArea.addChild(title);

    // 店主（Q版占位）
    const owner = new PIXI.Graphics();
    owner.beginFill(0xFFDDB8);
    owner.drawCircle(DESIGN_WIDTH / 2, 80, 32);
    owner.endFill();
    owner.beginFill(0x4A3728);
    owner.drawCircle(DESIGN_WIDTH / 2 - 10, 74, 3);
    owner.drawCircle(DESIGN_WIDTH / 2 + 10, 74, 3);
    owner.endFill();
    owner.lineStyle(2, 0x4A3728);
    owner.arc(DESIGN_WIDTH / 2, 86, 10, 0, Math.PI);
    this._shopArea.addChild(owner);

    const ownerLabel = new PIXI.Text('店主', {
      fontSize: 11,
      fill: COLORS.TEXT_LIGHT,
      fontFamily: FONT_FAMILY,
    });
    ownerLabel.anchor.set(0.5, 0);
    ownerLabel.position.set(DESIGN_WIDTH / 2, 116);
    this._shopArea.addChild(ownerLabel);

    // 柜台
    const counter = new PIXI.Graphics();
    counter.beginFill(0xD2B48C);
    counter.drawRoundedRect(60, 138, DESIGN_WIDTH - 120, 36, 8);
    counter.endFill();
    counter.beginFill(0xC4A882);
    counter.drawRoundedRect(60, 156, DESIGN_WIDTH - 120, 18, 8);
    counter.endFill();
    this._shopArea.addChild(counter);

    // 客人区域（柜台下方）
    this._customerViews = [];
    const slotPositions = [
      { x: DESIGN_WIDTH * 0.3, y: 210 },
      { x: DESIGN_WIDTH * 0.7, y: 210 },
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
  }
}
