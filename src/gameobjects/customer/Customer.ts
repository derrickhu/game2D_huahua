import Phaser from 'phaser';
import { FlowerFamily, FAMILY_COLORS, FAMILY_NAMES, COLORS } from '../../config/Constants';
import { CustomerConfig, CustomerRequest } from '../../data/CustomerData';

export class Customer extends Phaser.GameObjects.Container {
  public customerId: string;
  public customerName: string;
  public request: CustomerRequest;
  public slotIndex: number;  // 0 或 1，表示左边或右边的客人位

  private body: Phaser.GameObjects.Graphics;
  private nameText: Phaser.GameObjects.Text;
  private bubble: Phaser.GameObjects.Container;
  private bubbleBg: Phaser.GameObjects.Graphics;
  private demandText: Phaser.GameObjects.Text;
  private rewardText: Phaser.GameObjects.Text;
  private waitTimer: Phaser.Time.TimerEvent | null = null;
  private onTimeout: (() => void) | null = null;

  constructor(
    scene: Phaser.Scene,
    config: CustomerConfig,
    request: CustomerRequest,
    slotIndex: number,
    onTimeout: () => void,
  ) {
    super(scene, 0, 0);

    this.customerId = config.id;
    this.customerName = config.name;
    this.request = request;
    this.slotIndex = slotIndex;
    this.onTimeout = onTimeout;

    // 客人身体（占位：彩色椭圆+头部）
    this.body = new Phaser.GameObjects.Graphics(scene);
    this.drawBody(config.color);
    this.add(this.body);

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

    // 需求花系和等级
    const familyName = FAMILY_NAMES[request.family];
    this.demandText = new Phaser.GameObjects.Text(scene, 0, -22, `${familyName} Lv${request.minLevel}`, {
      fontSize: '16px',
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

    // 设置交互区域（用于接收花朵拖拽）
    this.setSize(110, 130);

    scene.add.existing(this);
  }

  private drawBody(color: number): void {
    this.body.clear();
    // 身体（椭圆）
    this.body.fillStyle(color, 0.8);
    this.body.fillEllipse(0, 20, 50, 60);
    // 头部
    this.body.fillStyle(0xFFE0BD, 1);
    this.body.fillCircle(0, -12, 22);
    // 眼睛
    this.body.fillStyle(0x333333, 1);
    this.body.fillCircle(-7, -14, 3);
    this.body.fillCircle(7, -14, 3);
    // 微笑
    this.body.lineStyle(2, 0x333333, 1);
    this.body.beginPath();
    this.body.arc(0, -8, 8, 0.1, Math.PI - 0.1);
    this.body.strokePath();
  }

  // 检查花朵是否满足需求
  canAccept(family: FlowerFamily, level: number): boolean {
    return family === this.request.family && level >= this.request.minLevel;
  }

  // 播放满意动画
  playHappyAnimation(onComplete: () => void): void {
    // 头顶冒出爱心
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

    // 客人向右走出
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

  // 播放拒绝动画
  playRejectAnimation(): void {
    this.scene.tweens.add({
      targets: this,
      x: this.x - 5,
      duration: 50,
      yoyo: true,
      repeat: 3,
    });
  }

  // 播放走入动画
  playEnterAnimation(targetX: number, targetY: number): void {
    this.setPosition(-100, targetY);
    this.scene.tweens.add({
      targets: this,
      x: targetX,
      duration: 800,
      ease: 'Back.easeOut',
    });
  }

  // 开始等待计时
  startWaitTimer(timeout: number): void {
    this.waitTimer = this.scene.time.delayedCall(timeout, () => {
      if (this.onTimeout) {
        this.onTimeout();
      }
    });
  }

  // 获取气泡的世界坐标范围（用于拖拽检测）
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
    super.destroy(fromScene);
  }
}
