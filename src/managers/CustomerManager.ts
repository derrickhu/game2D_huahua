import Phaser from 'phaser';
import { CUSTOMER, LAYOUT, ItemCategory } from '../config/Constants';
import { Customer } from '../gameobjects/customer/Customer';
import { getRandomCustomerConfig, generateOrder, OrderTemplate } from '../data/CustomerData';
import { CurrencyManager } from './CurrencyManager';
import { EventManager, GameEvents } from './EventManager';
import { BoardItem } from '../gameobjects/board/BoardItem';
import { Board } from '../gameobjects/board/Board';
import { getBuildingConfig } from '../data/BuildingData';

export class CustomerManager {
  private scene: Phaser.Scene;
  private board: Board | null = null;
  private activeCustomers: Customer[] = [];
  private refreshTimer: Phaser.Time.TimerEvent | null = null;
  private scanTimer: Phaser.Time.TimerEvent | null = null;
  private customerContainer: Phaser.GameObjects.Container;
  private drinkUnlocked: boolean = false;

  // 客人位置（2个槽位）
  private readonly SLOT_POSITIONS = [
    { x: 250, y: LAYOUT.SHOP_AREA_Y + 240 },
    { x: 500, y: LAYOUT.SHOP_AREA_Y + 240 },
  ];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.customerContainer = new Phaser.GameObjects.Container(scene, 0, 0);
    scene.add.existing(this.customerContainer);
  }

  setBoard(board: Board): void {
    this.board = board;
  }

  setDrinkUnlocked(unlocked: boolean): void {
    this.drinkUnlocked = unlocked;
  }

  /** 检查是否已解锁饮品建筑（通过扫描棋盘上的建筑） */
  checkDrinkUnlocked(): boolean {
    if (!this.board) return false;
    const buildings = this.board.getAllBuildings();
    for (const { building } of buildings) {
      const config = getBuildingConfig(building.buildingId);
      if (config && config.category === ItemCategory.DRINK) {
        this.drinkUnlocked = true;
        return true;
      }
    }
    return this.drinkUnlocked;
  }

  startRefreshLoop(): void {
    this.checkDrinkUnlocked();
    this.spawnCustomer();

    this.refreshTimer = this.scene.time.addEvent({
      delay: Phaser.Math.Between(CUSTOMER.REFRESH_MIN, CUSTOMER.REFRESH_MAX),
      callback: () => {
        this.trySpawnCustomer();
        if (this.refreshTimer) {
          this.refreshTimer.destroy();
        }
        this.refreshTimer = this.scene.time.addEvent({
          delay: Phaser.Math.Between(CUSTOMER.REFRESH_MIN, CUSTOMER.REFRESH_MAX),
          callback: () => {
            this.trySpawnCustomer();
          },
          loop: true,
        });
      },
      loop: true,
    });

    // 定时扫描棋盘，为客人自动匹配物品（每500ms）
    this.scanTimer = this.scene.time.addEvent({
      delay: 500,
      callback: () => this.scanAndReserve(),
      loop: true,
    });

    // 监听物品变化事件，立即触发扫描
    EventManager.on(GameEvents.ITEM_MERGED, this.onItemChanged, this);
    EventManager.on(GameEvents.ITEM_PLACED, this.onItemChanged, this);
    EventManager.on(GameEvents.ITEM_CONSUMED, this.onItemConsumed, this);
    // 兼容旧事件
    EventManager.on(GameEvents.FLOWER_MERGED, this.onItemChanged, this);
    EventManager.on(GameEvents.FLOWER_PLACED, this.onItemChanged, this);
    EventManager.on(GameEvents.BUILDING_PRODUCED, () => {
      this.checkDrinkUnlocked();
      this.scene.time.delayedCall(100, () => this.scanAndReserve());
    });
  }

  private onItemChanged = (): void => {
    this.scanAndReserve();
  };

  /**
   * 物品被合成消耗时：解锁相关客人槽位，然后重新扫描
   * data: { item: BoardItem }
   */
  private onItemConsumed = (data: { item: BoardItem }): void => {
    const consumedItem = data.item;
    for (const customer of this.activeCustomers) {
      for (let i = 0; i < customer.demandStates.length; i++) {
        const ds = customer.demandStates[i];
        if (ds.locked && ds.lockedItem === consumedItem) {
          customer.unlockDemandSlot(i);
        }
      }
    }
    // 延迟一帧后重新扫描（等新物品放置完）
    this.scene.time.delayedCall(50, () => this.scanAndReserve());
  };

  private trySpawnCustomer(): void {
    if (this.activeCustomers.length >= CUSTOMER.MAX_ACTIVE) return;
    this.spawnCustomer();
  }

  private spawnCustomer(): void {
    const slotIndex = this.getAvailableSlot();
    if (slotIndex === -1) return;

    const config = getRandomCustomerConfig(this.drinkUnlocked);
    const order = generateOrder(config, this.drinkUnlocked);
    const pos = this.SLOT_POSITIONS[slotIndex];

    const customer = new Customer(
      this.scene,
      config,
      order,
      slotIndex,
      () => this.onCustomerTimeout(customer),
      () => this.onCustomerComplete(customer),
    );

    customer.playEnterAnimation(pos.x, pos.y);
    customer.startWaitTimer(CUSTOMER.WAIT_TIMEOUT);

    this.activeCustomers.push(customer);
    this.customerContainer.add(customer);

    EventManager.emit(GameEvents.CUSTOMER_ARRIVED, { customerId: config.id });

    // 新客人到达后延迟扫描
    this.scene.time.delayedCall(900, () => this.scanAndReserve());
  }

  private getAvailableSlot(): number {
    const usedSlots = this.activeCustomers.map(c => c.slotIndex);
    if (!usedSlots.includes(0)) return 0;
    if (!usedSlots.includes(1)) return 1;
    return -1;
  }

  /**
   * 核心：自动扫描棋盘，为每个客人的未满足需求槽位寻找匹配物品并锁定
   *
   * 策略：
   * 1. 遍历每个客人每个未锁定的需求槽位
   * 2. 检查已锁定物品是否还有效（未被销毁）
   * 3. 在棋盘物品中寻找匹配的、未被锁定的物品
   * 4. 优先选等级最低的（节约高级物品）
   * 5. 锁定后物品仍可拖拽和合成（策划案核心策略点）
   */
  scanAndReserve(): void {
    if (!this.board) return;

    for (const customer of this.activeCustomers) {
      // 先检查已锁定的槽位，清理无效的
      for (let i = 0; i < customer.demandStates.length; i++) {
        const ds = customer.demandStates[i];
        if (ds.locked && ds.lockedItem) {
          if (!ds.lockedItem.scene) {
            // 物品已被销毁，解锁槽位
            customer.unlockDemandSlot(i);
          }
        }
      }

      // 为每个未锁定的需求槽位寻找匹配物品
      for (let i = 0; i < customer.demandStates.length; i++) {
        const ds = customer.demandStates[i];
        if (ds.locked) continue;

        const allItems = this.board.getAllItems();
        let bestMatch: BoardItem | null = null;

        for (const { item } of allItems) {
          // 跳过已被锁定的物品
          if (item.isReserved) continue;

          // 检查是否匹配需求
          if (customer.itemMatchesDemand(item, ds.demand)) {
            // 优先选等级最低的（节约高级物品）
            if (!bestMatch || item.level < bestMatch.level) {
              bestMatch = item;
            }
          }
        }

        if (bestMatch) {
          // 锁定物品（仅视觉标记，不阻止拖拽）
          bestMatch.setReserved(true, customer.slotIndex, i);
          customer.lockDemandSlot(i, bestMatch);
        }
      }
    }
  }

  /** 点击"完成"按钮回调 — 交付所有锁定物品 */
  private onCustomerComplete(customer: Customer): void {
    if (!customer.isAllSatisfied()) return;

    const order = customer.order;
    const lockedItems = customer.getLockedItems();

    // 发放奖励
    CurrencyManager.addGold(order.goldReward);
    CurrencyManager.addWish(order.wishReward);
    if (order.dewReward > 0) {
      CurrencyManager.addDew(order.dewReward);
    }

    this.showRewardFloating(customer.x, customer.y - 80, order);

    // 移除所有锁定的物品
    if (this.board) {
      for (const item of lockedItems) {
        if (!item.scene) continue;
        const cell = this.board.getCellAt(item.row, item.col);
        if (cell && cell.item === item) {
          this.board.removeItem(cell);
        } else {
          item.destroy();
        }
      }
    }

    // 清理客人状态
    customer.unlockAllSlots();

    // 客人满意离开
    customer.playHappyAnimation(() => {
      this.removeCustomer(customer);
      this.scanAndReserve();
    });

    EventManager.emit(GameEvents.ORDER_COMPLETED, {
      customerId: customer.customerId,
      rewards: order,
    });
  }

  private onCustomerTimeout(customer: Customer): void {
    customer.unlockAllSlots();

    customer.playHappyAnimation(() => {
      this.removeCustomer(customer);
      this.scanAndReserve();
    });
  }

  private removeCustomer(customer: Customer): void {
    const index = this.activeCustomers.indexOf(customer);
    if (index !== -1) {
      this.activeCustomers.splice(index, 1);
    }
    customer.destroy();
    EventManager.emit(GameEvents.CUSTOMER_LEFT, { customerId: customer.customerId });
  }

  private showRewardFloating(x: number, y: number, order: OrderTemplate): void {
    const parts: string[] = [];
    if (order.goldReward > 0) parts.push(`+${order.goldReward}💰`);
    if (order.wishReward > 0) parts.push(`+${order.wishReward}🌸`);
    if (order.dewReward > 0) parts.push(`+${order.dewReward}💧`);

    const text = this.scene.add.text(x, y, parts.join(' '), {
      fontSize: '18px',
      fontFamily: 'Arial',
      color: '#FFD700',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5);

    this.scene.tweens.add({
      targets: text,
      y: y - 60,
      alpha: 0,
      duration: 1200,
      ease: 'Power2',
      onComplete: () => text.destroy(),
    });
  }

  private showRejectTip(x: number, y: number): void {
    const tip = this.scene.add.text(x, y, '不是我要的~', {
      fontSize: '14px',
      fontFamily: 'Arial',
      color: '#FF4444',
      fontStyle: 'bold',
      stroke: '#FFFFFF',
      strokeThickness: 3,
    }).setOrigin(0.5);

    this.scene.tweens.add({
      targets: tip,
      y: y - 40,
      alpha: 0,
      duration: 1000,
      ease: 'Power2',
      onComplete: () => tip.destroy(),
    });
  }

  getActiveCustomers(): Customer[] {
    return this.activeCustomers;
  }

  isInCustomerArea(worldX: number, worldY: number): boolean {
    for (const customer of this.activeCustomers) {
      const bounds = customer.getBubbleBounds();
      if (bounds.contains(worldX, worldY)) {
        return true;
      }
    }
    return false;
  }

  destroy(): void {
    EventManager.off(GameEvents.ITEM_MERGED, this.onItemChanged, this);
    EventManager.off(GameEvents.ITEM_PLACED, this.onItemChanged, this);
    EventManager.off(GameEvents.ITEM_CONSUMED, this.onItemConsumed, this);
    EventManager.off(GameEvents.FLOWER_MERGED, this.onItemChanged, this);
    EventManager.off(GameEvents.FLOWER_PLACED, this.onItemChanged, this);
    if (this.refreshTimer) {
      this.refreshTimer.destroy();
    }
    if (this.scanTimer) {
      this.scanTimer.destroy();
    }
    for (const customer of this.activeCustomers) {
      customer.destroy();
    }
    this.activeCustomers = [];
  }
}
