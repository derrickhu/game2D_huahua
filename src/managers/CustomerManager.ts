import Phaser from 'phaser';
import { CUSTOMER, LAYOUT } from '../config/Constants';
import { Customer } from '../gameobjects/customer/Customer';
import { CustomerConfig, CustomerRequest, getRandomCustomerConfig, generateRequest } from '../data/CustomerData';
import { CurrencyManager } from './CurrencyManager';
import { EventManager, GameEvents } from './EventManager';
import { FlowerItem } from '../gameobjects/board/FlowerItem';

export class CustomerManager {
  private scene: Phaser.Scene;
  private activeCustomers: Customer[] = [];
  private refreshTimer: Phaser.Time.TimerEvent | null = null;
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

  startRefreshLoop(): void {
    this.spawnCustomer();

    this.refreshTimer = this.scene.time.addEvent({
      delay: Phaser.Math.Between(CUSTOMER.REFRESH_MIN, CUSTOMER.REFRESH_MAX),
      callback: () => {
        this.trySpawnCustomer();
        // 下一次使用新的随机间隔
        if (this.refreshTimer) {
          this.refreshTimer.delay = Phaser.Math.Between(CUSTOMER.REFRESH_MIN, CUSTOMER.REFRESH_MAX);
        }
      },
      loop: true,
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
    );

    customer.playEnterAnimation(pos.x, pos.y);
    customer.startWaitTimer(CUSTOMER.WAIT_TIMEOUT);

    this.activeCustomers.push(customer);
    this.customerContainer.add(customer);

    EventManager.emit(GameEvents.CUSTOMER_ARRIVED, { customerId: config.id });
  }

  private getAvailableSlot(): number {
    const usedSlots = this.activeCustomers.map(c => c.slotIndex);
    if (!usedSlots.includes(0)) return 0;
    if (!usedSlots.includes(1)) return 1;
    return -1;
  }

  // 尝试交付花朵给客人
  tryDeliver(flower: FlowerItem, worldX: number, worldY: number): boolean {
    for (const customer of this.activeCustomers) {
      const bounds = customer.getBubbleBounds();
      if (bounds.contains(worldX, worldY)) {
        if (customer.canAccept(flower.family, flower.level)) {
          this.doDeliver(customer, flower);
          return true;
        } else {
          customer.playRejectAnimation();
          return false;
        }
      }
    }
    return false;
  }

  private doDeliver(customer: Customer, flower: FlowerItem): void {
    const request = customer.request;

    // 发放奖励
    CurrencyManager.addGold(request.goldReward);
    CurrencyManager.addWish(request.wishReward);
    if (request.dewReward > 0) {
      CurrencyManager.addDew(request.dewReward);
    }

    // 播放奖励飘字
    this.showRewardFloating(customer.x, customer.y - 80, request);

    // 客人满意离开
    customer.playHappyAnimation(() => {
      this.removeCustomer(customer);
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
    // 客人超时离开（不给奖励）
    customer.playHappyAnimation(() => {
      this.removeCustomer(customer);
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

  getActiveCustomers(): Customer[] {
    return this.activeCustomers;
  }

  // 检查某个世界坐标是否在客人区域
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
    if (this.refreshTimer) {
      this.refreshTimer.destroy();
    }
    for (const customer of this.activeCustomers) {
      customer.destroy();
    }
    this.activeCustomers = [];
  }
}
