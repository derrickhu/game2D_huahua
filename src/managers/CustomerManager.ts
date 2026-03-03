import Phaser from 'phaser';
import { CUSTOMER, LAYOUT } from '../config/Constants';
import { Customer } from '../gameobjects/customer/Customer';
import { CustomerRequest, getRandomCustomerConfig, generateRequest } from '../data/CustomerData';
import { CurrencyManager } from './CurrencyManager';
import { EventManager, GameEvents } from './EventManager';
import { FlowerItem } from '../gameobjects/board/FlowerItem';
import { Board } from '../gameobjects/board/Board';

export class CustomerManager {
  private scene: Phaser.Scene;
  private board: Board | null = null;
  private activeCustomers: Customer[] = [];
  private refreshTimer: Phaser.Time.TimerEvent | null = null;
  private scanTimer: Phaser.Time.TimerEvent | null = null;
  private customerContainer: Phaser.GameObjects.Container;

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

  // 设置棋盘引用，用于自动扫描
  setBoard(board: Board): void {
    this.board = board;
  }

  startRefreshLoop(): void {
    this.spawnCustomer();

    this.refreshTimer = this.scene.time.addEvent({
      delay: Phaser.Math.Between(CUSTOMER.REFRESH_MIN, CUSTOMER.REFRESH_MAX),
      callback: () => {
        this.trySpawnCustomer();
        // 重建timer以使用新的随机间隔
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

    // 定时扫描棋盘，为客人自动匹配花朵（每500ms扫一次）
    this.scanTimer = this.scene.time.addEvent({
      delay: 500,
      callback: () => this.scanAndReserveFlowers(),
      loop: true,
    });

    // 监听花朵合成/放置事件，立即触发扫描
    EventManager.on(GameEvents.FLOWER_MERGED, this.scanAndReserveFlowers, this);
    EventManager.on(GameEvents.FLOWER_PLACED, this.scanAndReserveFlowers, this);
    EventManager.on(GameEvents.BUILDING_PRODUCED, () => {
      // 延迟一帧再扫描，等花朵放置完成
      this.scene.time.delayedCall(100, () => this.scanAndReserveFlowers());
    });
  }

  private trySpawnCustomer(): void {
    if (this.activeCustomers.length >= CUSTOMER.MAX_ACTIVE) return;
    this.spawnCustomer();
  }

  private spawnCustomer(): void {
    const slotIndex = this.getAvailableSlot();
    if (slotIndex === -1) return;

    const config = getRandomCustomerConfig();
    const request = generateRequest(config);
    const pos = this.SLOT_POSITIONS[slotIndex];

    const customer = new Customer(
      this.scene,
      config,
      request,
      slotIndex,
      () => this.onCustomerTimeout(customer),
      () => this.onCustomerComplete(customer),
    );

    customer.playEnterAnimation(pos.x, pos.y);
    customer.startWaitTimer(CUSTOMER.WAIT_TIMEOUT);

    this.activeCustomers.push(customer);
    this.customerContainer.add(customer);

    EventManager.emit(GameEvents.CUSTOMER_ARRIVED, { customerId: config.id });

    // 新客人到达后立即扫描
    this.scene.time.delayedCall(900, () => this.scanAndReserveFlowers());
  }

  private getAvailableSlot(): number {
    const usedSlots = this.activeCustomers.map(c => c.slotIndex);
    if (!usedSlots.includes(0)) return 0;
    if (!usedSlots.includes(1)) return 1;
    return -1;
  }

  // 核心：自动扫描棋盘，为未匹配的客人找花并锁定
  scanAndReserveFlowers(): void {
    if (!this.board) return;

    for (const customer of this.activeCustomers) {
      // 已经有锁定的花 → 检查是否还有效
      if (customer.reservedFlower) {
        // 花朵可能被销毁了（不应该发生，但防御性检查）
        if (!customer.reservedFlower.scene) {
          customer.reservedFlower = null;
          customer.hideCompleteButton();
        } else {
          continue; // 已锁定，跳过
        }
      }

      // 在棋盘中寻找匹配的花
      const allFlowers = this.board.getAllFlowers();
      let bestMatch: FlowerItem | null = null;

      for (const { flower } of allFlowers) {
        // 跳过已被其他客人锁定的花
        if (flower.isReserved) continue;
        // 检查是否匹配
        if (customer.canAccept(flower.family, flower.level)) {
          // 优先选等级最低的（节约高级花）
          if (!bestMatch || flower.level < bestMatch.level) {
            bestMatch = flower;
          }
        }
      }

      if (bestMatch) {
        // 锁定花朵
        bestMatch.setReserved(true, customer.slotIndex);
        customer.reservedFlower = bestMatch;
        customer.showCompleteButton();
      }
    }
  }

  // 点击"完成"按钮回调
  private onCustomerComplete(customer: Customer): void {
    const flower = customer.reservedFlower;
    if (!flower || !flower.scene) return;

    const request = customer.request;

    // 发放奖励
    CurrencyManager.addGold(request.goldReward);
    CurrencyManager.addWish(request.wishReward);
    if (request.dewReward > 0) {
      CurrencyManager.addDew(request.dewReward);
    }

    // 奖励飘字
    this.showRewardFloating(customer.x, customer.y - 80, request);

    // 移除花朵（从棋盘格子中）
    if (this.board) {
      const cell = this.board.getCellAt(flower.row, flower.col);
      if (cell && cell.flower === flower) {
        this.board.removeFlower(cell);
      } else {
        flower.destroy();
      }
    } else {
      flower.destroy();
    }

    customer.reservedFlower = null;

    // 客人满意离开
    customer.playHappyAnimation(() => {
      this.removeCustomer(customer);
      // 客人离开后重新扫描（可能释放的花可以给其他客人）
      this.scanAndReserveFlowers();
    });

    EventManager.emit(GameEvents.ORDER_COMPLETED, {
      customerId: customer.customerId,
      flowerId: flower.flowerId,
      rewards: request,
    });
  }

  // 旧的拖拽交付（保留作为备用，但主要用自动锁定机制）
  tryDeliver(flower: FlowerItem, worldX: number, worldY: number): boolean {
    for (const customer of this.activeCustomers) {
      const bounds = customer.getBubbleBounds();
      if (bounds.contains(worldX, worldY)) {
        if (customer.canAccept(flower.family, flower.level)) {
          this.doDeliver(customer, flower);
          return true;
        } else {
          customer.playRejectAnimation();
          this.showRejectTip(customer.x, customer.y - 100);
          return false;
        }
      }
    }
    return false;
  }

  private doDeliver(customer: Customer, flower: FlowerItem): void {
    const request = customer.request;

    CurrencyManager.addGold(request.goldReward);
    CurrencyManager.addWish(request.wishReward);
    if (request.dewReward > 0) {
      CurrencyManager.addDew(request.dewReward);
    }

    this.showRewardFloating(customer.x, customer.y - 80, request);

    // 解除客人的锁定（如果有）
    if (customer.reservedFlower && customer.reservedFlower !== flower) {
      customer.reservedFlower.setReserved(false);
    }
    customer.reservedFlower = null;
    customer.hideCompleteButton();

    customer.playHappyAnimation(() => {
      this.removeCustomer(customer);
      this.scanAndReserveFlowers();
    });

    EventManager.emit(GameEvents.ORDER_COMPLETED, {
      customerId: customer.customerId,
      flowerId: flower.flowerId,
      rewards: request,
    });
  }

  private showRewardFloating(x: number, y: number, request: CustomerRequest): void {
    const parts: string[] = [];
    if (request.goldReward > 0) parts.push(`+${request.goldReward}💰`);
    if (request.wishReward > 0) parts.push(`+${request.wishReward}🌸`);
    if (request.dewReward > 0) parts.push(`+${request.dewReward}💧`);

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

  private onCustomerTimeout(customer: Customer): void {
    // 解除锁定
    if (customer.reservedFlower) {
      customer.reservedFlower.setReserved(false);
      customer.reservedFlower = null;
    }
    customer.hideCompleteButton();

    customer.playHappyAnimation(() => {
      this.removeCustomer(customer);
      this.scanAndReserveFlowers();
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

  private showRejectTip(x: number, y: number): void {
    const tip = this.scene.add.text(x, y, '不是我要的花~', {
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
    EventManager.off(GameEvents.FLOWER_MERGED, this.scanAndReserveFlowers, this);
    EventManager.off(GameEvents.FLOWER_PLACED, this.scanAndReserveFlowers, this);
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
