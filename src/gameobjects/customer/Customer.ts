import Phaser from 'phaser';
import { FlowerFamily, FAMILY_COLORS, FAMILY_NAMES } from '../../config/Constants';
import { CustomerConfig, CustomerRequest } from '../../data/CustomerData';
import { getFlowerConfig } from '../../data/FlowerData';
import { FlowerItem } from '../board/FlowerItem';

export class Customer extends Phaser.GameObjects.Container {
  public customerId: string;
  public customerName: string;
  public request: CustomerRequest;
  public slotIndex: number;  // 0 或 1，表示左边或右边的客人位
  public reservedFlower: FlowerItem | null = null;  // 被锁定的花朵引用

  private bodyGfx: Phaser.GameObjects.Graphics;
  private nameText: Phaser.GameObjects.Text;
  private bubble: Phaser.GameObjects.Container;
  private bubbleBg: Phaser.GameObjects.Graphics;
  private demandText: Phaser.GameObjects.Text;
  private rewardText: Phaser.GameObjects.Text;
  private completeBtn: Phaser.GameObjects.Container | null = null;
  private waitTimer: Phaser.Time.TimerEvent | null = null;
  private onTimeout: (() => void) | null = null;
  private onComplete: (() => void) | null = null;

  constructor(
    scene: Phaser.Scene,
    config: CustomerConfig,
    request: CustomerRequest,
    slotIndex: number,
    onTimeout: () => void,
    onComplete: () => void,
  ) {
    super(scene, 0, 0);

    this.customerId = config.id;
    this.customerName = config.name;
    this.request = request;
    this.slotIndex = slotIndex;
    this.onTimeout = onTimeout;
    this.onComplete = onComplete;

    // 客人身体
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

    this.bubbleBg = new Phaser.GameObjects.Graphics(scene);
    this.bubbleBg.fillStyle(0xFFFFFF, 0.95);
    this.bubbleBg.fillRoundedRect(-55, -35, 110, 60, 12);
    // 小三角
    this.bubbleBg.fillTriangle(-5, 25, 5, 25, 0, 35);
    // 边框
    this.bubbleBg.lineStyle(2, FAMILY_COLORS[request.family], 0.8);
    this.bubbleBg.strokeRoundedRect(-55, -35, 110, 60, 12);
    this.bubble.add(this.bubbleBg);

    // 需求花系和等级 — 显示具体花名
    const flowerConfig = getFlowerConfig(`${request.family}_${request.minLevel}`);
    const demandLabel = flowerConfig ? flowerConfig.name : `${FAMILY_NAMES[request.family]} Lv${request.minLevel}`;
    this.demandText = new Phaser.GameObjects.Text(scene, 0, -22, `求：${demandLabel}`, {
      fontSize: '14px',
      fontFamily: 'Arial',
      color: `#${FAMILY_COLORS[request.family].toString(16).padStart(6, '0')}`,
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.bubble.add(this.demandText);

    // 奖励预览
    const rewardParts: string[] = [];
    if (request.goldReward > 0) rewardParts.push(`💰${request.goldReward}`);
    if (request.wishReward > 0) rewardParts.push(`🌸${request.wishReward}`);
    if (request.dewReward > 0) rewardParts.push(`💧${request.dewReward}`);
    this.rewardText = new Phaser.GameObjects.Text(scene, 0, 0, rewardParts.join(' '), {
      fontSize: '12px',
      fontFamily: 'Arial',
      color: '#8A7A6A',
    }).setOrigin(0.5);
    this.bubble.add(this.rewardText);

    this.add(this.bubble);

    this.setSize(110, 130);
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

  canAccept(family: FlowerFamily, level: number): boolean {
    return family === this.request.family && level >= this.request.minLevel;
  }

  // 显示"完成"按钮（花朵已锁定时调用）
  showCompleteButton(): void {
    if (this.completeBtn) return;

    this.completeBtn = new Phaser.GameObjects.Container(this.scene, 0, -110);

    // 按钮背景
    const btnBg = new Phaser.GameObjects.Graphics(this.scene);
    btnBg.fillStyle(0x4CAF50, 1);
    btnBg.fillRoundedRect(-32, -16, 64, 32, 12);
    // 高光
    btnBg.fillStyle(0xFFFFFF, 0.15);
    btnBg.fillRoundedRect(-32, -16, 64, 16, { tl: 12, tr: 12, bl: 0, br: 0 });
    this.completeBtn.add(btnBg);

    // 文字
    const btnText = new Phaser.GameObjects.Text(this.scene, 0, 0, '完成', {
      fontSize: '16px',
      fontFamily: 'Arial',
      color: '#FFFFFF',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.completeBtn.add(btnText);

    this.completeBtn.setSize(64, 32);
    this.completeBtn.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, 64, 32),
      Phaser.Geom.Rectangle.Contains,
    );

    // 点击完成按钮
    this.completeBtn.on('pointerdown', () => {
      if (this.onComplete) {
        this.onComplete();
      }
    });

    this.add(this.completeBtn);

    // 弹出动画
    this.completeBtn.setScale(0);
    this.scene.tweens.add({
      targets: this.completeBtn,
      scaleX: 1,
      scaleY: 1,
      duration: 300,
      ease: 'Back.easeOut',
    });
  }

  // 隐藏完成按钮
  hideCompleteButton(): void {
    if (!this.completeBtn) return;
    const btn = this.completeBtn;
    this.completeBtn = null;
    this.scene.tweens.add({
      targets: btn,
      scaleX: 0,
      scaleY: 0,
      duration: 200,
      onComplete: () => btn.destroy(),
    });
  }

  // 满意离开动画
  playHappyAnimation(onComplete: () => void): void {
    const heart = new Phaser.GameObjects.Text(this.scene, 0, -90, '❤️', {
      fontSize: '24px',
    }).setOrigin(0.5);
    this.add(heart);

    this.scene.tweens.add({
      targets: heart,
      y: -120,
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
    this.waitTimer = this.scene.time.delayedCall(timeout, () => {
      if (this.onTimeout) {
        this.onTimeout();
      }
    });
  }

  getBubbleBounds(): Phaser.Geom.Rectangle {
    return new Phaser.Geom.Rectangle(
      this.x - 55,
      this.y - 95,
      110,
      130,
    );
  }

  destroy(fromScene?: boolean): void {
    if (this.waitTimer) {
      this.waitTimer.destroy();
    }
    // 解除花朵锁定
    if (this.reservedFlower && !this.reservedFlower.scene) {
      // 花朵已被销毁
    } else if (this.reservedFlower) {
      this.reservedFlower.setReserved(false);
    }
    this.reservedFlower = null;
    super.destroy(fromScene);
  }
}
