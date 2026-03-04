import Phaser from 'phaser';
import { LINE_COLORS } from '../../config/Constants';
import { CustomerConfig, OrderTemplate, DemandSlot } from '../../data/CustomerData';
import { getCategoryIcon } from '../../data/ItemData';
import { BoardItem } from '../board/BoardItem';

/**
 * 需求槽位的运行时状态
 */
export interface DemandSlotState {
  demand: DemandSlot;
  locked: boolean;         // 是否已被棋盘物品锁定
  lockedItem: BoardItem | null; // 锁定的物品引用
}

/**
 * 客人 — 支持组合订单（1~3个需求槽位）
 */
export class Customer extends Phaser.GameObjects.Container {
  public customerId: string;
  public customerName: string;
  public order: OrderTemplate;
  public slotIndex: number;   // 0 或 1，客人位置
  public demandStates: DemandSlotState[];

  private bodyGfx: Phaser.GameObjects.Graphics;
  private nameText: Phaser.GameObjects.Text;
  private bubble: Phaser.GameObjects.Container;
  private slotIcons: Phaser.GameObjects.Container[] = [];
  private completeBtn: Phaser.GameObjects.Container | null = null;
  private waitTimer: Phaser.Time.TimerEvent | null = null;
  private onTimeout: (() => void) | null = null;
  private onComplete: (() => void) | null = null;

  constructor(
    scene: Phaser.Scene,
    config: CustomerConfig,
    order: OrderTemplate,
    slotIndex: number,
    onTimeout: () => void,
    onComplete: () => void,
  ) {
    super(scene, 0, 0);

    this.customerId = config.id;
    this.customerName = config.name;
    this.order = order;
    this.slotIndex = slotIndex;
    this.onTimeout = onTimeout;
    this.onComplete = onComplete;

    // 初始化需求槽位状态
    this.demandStates = order.demands.map(d => ({
      demand: d,
      locked: false,
      lockedItem: null,
    }));

    // 身体
    this.bodyGfx = new Phaser.GameObjects.Graphics(scene);
    this.drawBody(config.color);
    this.add(this.bodyGfx);

    // 名字
    this.nameText = new Phaser.GameObjects.Text(scene, 0, 48, config.name, {
      fontSize: '14px',
      fontFamily: 'Arial',
      color: '#5A4A3A',
    }).setOrigin(0.5);
    this.add(this.nameText);

    // 需求气泡
    this.bubble = new Phaser.GameObjects.Container(scene, 0, -60);
    this.drawBubble();
    this.add(this.bubble);

    // 奖励预览
    const rewardParts: string[] = [];
    if (order.goldReward > 0) rewardParts.push(`💰${order.goldReward}`);
    if (order.wishReward > 0) rewardParts.push(`🌸${order.wishReward}`);
    if (order.dewReward > 0) rewardParts.push(`💧${order.dewReward}`);
    const rewardText = new Phaser.GameObjects.Text(scene, 0, 68, rewardParts.join(' '), {
      fontSize: '11px',
      fontFamily: 'Arial',
      color: '#8A7A6A',
    }).setOrigin(0.5);
    this.add(rewardText);

    this.setSize(110, 150);
    scene.add.existing(this);
  }

  private drawBody(color: number): void {
    this.bodyGfx.clear();
    this.bodyGfx.fillStyle(color, 0.8);
    this.bodyGfx.fillEllipse(0, 20, 50, 60);
    this.bodyGfx.fillStyle(0xFFE0BD, 1);
    this.bodyGfx.fillCircle(0, -12, 22);
    this.bodyGfx.fillStyle(0x333333, 1);
    this.bodyGfx.fillCircle(-7, -14, 3);
    this.bodyGfx.fillCircle(7, -14, 3);
    this.bodyGfx.lineStyle(2, 0x333333, 1);
    this.bodyGfx.beginPath();
    this.bodyGfx.arc(0, -8, 8, 0.1, Math.PI - 0.1);
    this.bodyGfx.strokePath();
  }

  /** 绘制需求气泡（多槽位） */
  private drawBubble(): void {
    // 先清空
    this.bubble.removeAll(true);
    this.slotIcons = [];

    const demands = this.demandStates;
    const slotW = 36;
    const gap = 4;
    const totalW = demands.length * slotW + (demands.length - 1) * gap;
    const bubbleW = Math.max(totalW + 16, 60);
    const bubbleH = 52;

    // 背景
    const bg = new Phaser.GameObjects.Graphics(this.scene);
    bg.fillStyle(0xFFFFFF, 0.95);
    bg.fillRoundedRect(-bubbleW / 2, -bubbleH / 2, bubbleW, bubbleH, 12);
    bg.fillTriangle(-5, bubbleH / 2, 5, bubbleH / 2, 0, bubbleH / 2 + 10);
    bg.lineStyle(2, 0xE0D0C0, 0.6);
    bg.strokeRoundedRect(-bubbleW / 2, -bubbleH / 2, bubbleW, bubbleH, 12);
    this.bubble.add(bg);

    // 每个需求槽位
    const startX = -totalW / 2 + slotW / 2;
    demands.forEach((ds, i) => {
      const x = startX + i * (slotW + gap);
      const slotContainer = new Phaser.GameObjects.Container(this.scene, x, 0);

      // 槽位背景（根据品类着色）
      const lineColor = LINE_COLORS[ds.demand.line] || 0x999999;
      const slotBg = new Phaser.GameObjects.Graphics(this.scene);
      slotBg.fillStyle(lineColor, 0.15);
      slotBg.fillRoundedRect(-slotW / 2, -slotW / 2, slotW, slotW, 6);
      slotBg.lineStyle(2, lineColor, 0.5);
      slotBg.strokeRoundedRect(-slotW / 2, -slotW / 2, slotW, slotW, 6);
      slotContainer.add(slotBg);

      // 品类图标（从注册表获取）
      const icon = getCategoryIcon(ds.demand.category);
      const iconText = new Phaser.GameObjects.Text(this.scene, 0, -6, icon, {
        fontSize: '14px',
      }).setOrigin(0.5);
      slotContainer.add(iconText);

      // 等级需求
      const lvText = new Phaser.GameObjects.Text(this.scene, 0, 10, `≥${ds.demand.minLevel}`, {
        fontSize: '10px',
        fontFamily: 'Arial',
        color: `#${lineColor.toString(16).padStart(6, '0')}`,
        fontStyle: 'bold',
      }).setOrigin(0.5);
      slotContainer.add(lvText);

      this.bubble.add(slotContainer);
      this.slotIcons.push(slotContainer);
    });
  }

  /** 检查某个物品是否能满足某个未锁定的需求槽位 */
  getMatchingDemandIndex(item: BoardItem): number {
    for (let i = 0; i < this.demandStates.length; i++) {
      const ds = this.demandStates[i];
      if (ds.locked) continue;
      if (this.itemMatchesDemand(item, ds.demand)) {
        return i;
      }
    }
    return -1;
  }

  /** 检查物品是否满足某个需求 */
  itemMatchesDemand(item: BoardItem, demand: DemandSlot): boolean {
    return item.category === demand.category
      && item.line === demand.line
      && item.level >= demand.minLevel;
  }

  /** 锁定某个槽位 */
  lockDemandSlot(demandIdx: number, item: BoardItem): void {
    const ds = this.demandStates[demandIdx];
    ds.locked = true;
    ds.lockedItem = item;

    // 更新槽位视觉 — 打上绿色对勾
    this.updateSlotVisual(demandIdx, true);

    // 检查是否全部满足
    if (this.isAllSatisfied()) {
      this.showCompleteButton();
    }
  }

  /** 解锁某个槽位（物品被合成消耗时调用） */
  unlockDemandSlot(demandIdx: number): void {
    const ds = this.demandStates[demandIdx];
    ds.locked = false;
    ds.lockedItem = null;
    this.updateSlotVisual(demandIdx, false);
    this.hideCompleteButton();
  }

  /** 解锁所有槽位 */
  unlockAllSlots(): void {
    for (let i = 0; i < this.demandStates.length; i++) {
      const ds = this.demandStates[i];
      if (ds.locked && ds.lockedItem) {
        ds.lockedItem.setReserved(false);
      }
      ds.locked = false;
      ds.lockedItem = null;
      this.updateSlotVisual(i, false);
    }
    this.hideCompleteButton();
  }

  /** 是否全部需求都已锁定满足 */
  isAllSatisfied(): boolean {
    return this.demandStates.every(ds => ds.locked);
  }

  /** 获取所有锁定的物品 */
  getLockedItems(): BoardItem[] {
    return this.demandStates
      .filter(ds => ds.locked && ds.lockedItem)
      .map(ds => ds.lockedItem!);
  }

  private updateSlotVisual(idx: number, satisfied: boolean): void {
    if (idx >= this.slotIcons.length) return;
    const container = this.slotIcons[idx];

    // 移除旧的对勾标记
    const existing = container.getByName('checkmark');
    if (existing) existing.destroy();

    if (satisfied) {
      const check = new Phaser.GameObjects.Text(this.scene, 0, 0, '✓', {
        fontSize: '24px',
        fontFamily: 'Arial',
        color: '#4CAF50',
        fontStyle: 'bold',
      }).setOrigin(0.5).setName('checkmark');
      container.add(check);
    }
  }

  showCompleteButton(): void {
    if (this.completeBtn) return;

    this.completeBtn = new Phaser.GameObjects.Container(this.scene, 0, -115);

    const btnBg = new Phaser.GameObjects.Graphics(this.scene);
    btnBg.fillStyle(0x4CAF50, 1);
    btnBg.fillRoundedRect(-36, -18, 72, 36, 14);
    btnBg.fillStyle(0xFFFFFF, 0.15);
    btnBg.fillRoundedRect(-36, -18, 72, 18, { tl: 14, tr: 14, bl: 0, br: 0 });
    this.completeBtn.add(btnBg);

    const btnText = new Phaser.GameObjects.Text(this.scene, 0, 0, '完成', {
      fontSize: '18px',
      fontFamily: 'Arial',
      color: '#FFFFFF',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.completeBtn.add(btnText);

    this.completeBtn.setSize(72, 36);
    this.completeBtn.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, 72, 36),
      Phaser.Geom.Rectangle.Contains,
    );

    this.completeBtn.on('pointerdown', () => {
      if (this.onComplete) this.onComplete();
    });

    this.add(this.completeBtn);

    // 弹出动画
    this.completeBtn.setScale(0);
    this.scene.tweens.add({
      targets: this.completeBtn,
      scaleX: 1, scaleY: 1,
      duration: 300,
      ease: 'Back.easeOut',
    });

    // 持续弹跳吸引注意
    this.scene.tweens.add({
      targets: this.completeBtn,
      y: -120,
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  hideCompleteButton(): void {
    if (!this.completeBtn) return;
    const btn = this.completeBtn;
    this.completeBtn = null;
    this.scene.tweens.killTweensOf(btn);
    this.scene.tweens.add({
      targets: btn,
      scaleX: 0, scaleY: 0,
      duration: 200,
      onComplete: () => btn.destroy(),
    });
  }

  // 兼容旧接口
  canAccept(family: string, level: number): boolean {
    return this.demandStates.some(ds =>
      !ds.locked && ds.demand.line === family && level >= ds.demand.minLevel
    );
  }
  get request(): OrderTemplate { return this.order; }
  get reservedFlower(): BoardItem | null {
    const locked = this.demandStates.find(ds => ds.locked && ds.lockedItem);
    return locked?.lockedItem || null;
  }
  set reservedFlower(_v: BoardItem | null) { /* no-op, use demand slots */ }

  playHappyAnimation(onComplete: () => void): void {
    const heart = new Phaser.GameObjects.Text(this.scene, 0, -90, '❤️', {
      fontSize: '24px',
    }).setOrigin(0.5);
    this.add(heart);

    this.scene.tweens.add({
      targets: heart,
      y: -130,
      alpha: 0,
      duration: 800,
      ease: 'Power2',
      onComplete: () => heart.destroy(),
    });

    this.scene.tweens.add({
      targets: this,
      x: 850,
      alpha: 0,
      duration: 600,
      delay: 400,
      ease: 'Power2',
      onComplete,
    });
  }

  playRejectAnimation(): void {
    this.scene.tweens.add({
      targets: this,
      x: this.x - 5,
      duration: 50,
      yoyo: true,
      repeat: 3,
    });
  }

  playEnterAnimation(targetX: number, targetY: number): void {
    this.setPosition(-100, targetY);
    this.scene.tweens.add({
      targets: this,
      x: targetX,
      duration: 800,
      ease: 'Back.easeOut',
    });
  }

  startWaitTimer(timeout: number): void {
    // 组合订单等待时间随槽位数增加
    const adjustedTimeout = timeout + (this.demandStates.length - 1) * 20000;
    this.waitTimer = this.scene.time.delayedCall(adjustedTimeout, () => {
      if (this.onTimeout) this.onTimeout();
    });
  }

  getBubbleBounds(): Phaser.Geom.Rectangle {
    return new Phaser.Geom.Rectangle(
      this.x - 60,
      this.y - 95,
      120,
      160,
    );
  }

  destroy(fromScene?: boolean): void {
    if (this.waitTimer) {
      this.waitTimer.destroy();
    }
    // 解除所有物品锁定
    for (const ds of this.demandStates) {
      if (ds.locked && ds.lockedItem && ds.lockedItem.scene) {
        ds.lockedItem.setReserved(false);
      }
      ds.lockedItem = null;
    }
    if (this.completeBtn) {
      this.scene.tweens.killTweensOf(this.completeBtn);
    }
    super.destroy(fromScene);
  }
}
