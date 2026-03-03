import Phaser from 'phaser';
import { BOARD, COLORS, FlowerFamily } from '../../config/Constants';
import { BuildingConfig, getBuildingConfig } from '../../data/BuildingData';
import { EventManager, GameEvents } from '../../managers/EventManager';

export class Building extends Phaser.GameObjects.Container {
  public buildingId: string;
  public row: number = 0;
  public col: number = 0;

  private config: BuildingConfig;
  private isReady: boolean = true;
  private cdRemaining: number = 0;
  private cdTimer: Phaser.Time.TimerEvent | null = null;

  private bg: Phaser.GameObjects.Graphics;
  private nameText: Phaser.GameObjects.Text;
  private cdText: Phaser.GameObjects.Text;
  private cdOverlay: Phaser.GameObjects.Graphics;
  private readyDot: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, buildingId: string) {
    super(scene, 0, 0);

    const config = getBuildingConfig(buildingId);
    if (!config) throw new Error(`Unknown building: ${buildingId}`);

    this.buildingId = buildingId;
    this.config = config;

    // 建筑占位图
    this.bg = new Phaser.GameObjects.Graphics(scene);
    this.drawBuilding();
    this.add(this.bg);

    // 名称
    this.nameText = new Phaser.GameObjects.Text(scene, 0, 0, config.name, {
      fontSize: '14px',
      fontFamily: 'Arial',
      color: '#FFFFFF',
      fontStyle: 'bold',
      stroke: '#00000066',
      strokeThickness: 2,
    }).setOrigin(0.5);
    this.add(this.nameText);

    // CD 文本（默认隐藏）
    this.cdText = new Phaser.GameObjects.Text(scene, 0, 20, '', {
      fontSize: '18px',
      fontFamily: 'Arial',
      color: '#FFFFFF',
      fontStyle: 'bold',
    }).setOrigin(0.5).setVisible(false);
    this.add(this.cdText);

    // CD 遮罩
    this.cdOverlay = new Phaser.GameObjects.Graphics(scene);
    this.cdOverlay.setAlpha(0);
    this.add(this.cdOverlay);

    // 就绪圆点
    this.readyDot = new Phaser.GameObjects.Graphics(scene);
    this.drawReadyDot();
    this.add(this.readyDot);

    // 交互
    this.setSize(BOARD.CELL_SIZE - 8, BOARD.CELL_SIZE - 8);
    this.setInteractive(
      new Phaser.Geom.Rectangle(
        -(BOARD.CELL_SIZE - 8) / 2,
        -(BOARD.CELL_SIZE - 8) / 2,
        BOARD.CELL_SIZE - 8,
        BOARD.CELL_SIZE - 8,
      ),
      Phaser.Geom.Rectangle.Contains,
    );

    this.on('pointerdown', this.onTap, this);
    scene.add.existing(this);
  }

  private drawBuilding(): void {
    this.bg.clear();
    const s = BOARD.CELL_SIZE - 12;
    this.bg.fillStyle(0x8D6E63, 0.9);
    this.bg.fillRoundedRect(-s / 2, -s / 2, s, s, 10);
    // 屋顶三角形
    this.bg.fillStyle(0xA1887F, 1);
    this.bg.fillTriangle(0, -s / 2 - 10, -s / 2, -s / 2 + 8, s / 2, -s / 2 + 8);
  }

  private drawReadyDot(): void {
    this.readyDot.clear();
    this.readyDot.fillStyle(COLORS.GREEN, 1);
    this.readyDot.fillCircle((BOARD.CELL_SIZE - 8) / 2 - 8, -(BOARD.CELL_SIZE - 8) / 2 + 8, 6);
  }

  private onTap(): void {
    if (!this.isReady) return;

    // 阶段1：花艺操作台只产日常花系，无需选择
    this.produce(this.config.selectableFamilies[0]);
  }

  produce(family: FlowerFamily): void {
    // 随机产出等级
    const { min, max } = this.config.outputLevels;
    const level = Phaser.Math.Between(min, max);
    const flowerId = `${family}_${level}`;

    // 通知外部处理（Board 负责找空格并放置花朵）
    EventManager.emit(GameEvents.BUILDING_PRODUCED, {
      buildingId: this.buildingId,
      flowerId,
      row: this.row,
      col: this.col,
    });

    this.startCooldown();
  }

  private startCooldown(): void {
    this.isReady = false;
    this.cdRemaining = this.config.cd;
    this.showCdState();

    this.cdTimer = this.scene.time.addEvent({
      delay: 1000,
      repeat: this.config.cd - 1,
      callback: () => {
        this.cdRemaining--;
        this.updateCdDisplay();
        if (this.cdRemaining <= 0) {
          this.onCdComplete();
        }
      },
    });
  }

  private showCdState(): void {
    this.readyDot.setVisible(false);
    this.cdText.setVisible(true);
    this.cdOverlay.setAlpha(0.5);
    this.updateCdDisplay();
  }

  private updateCdDisplay(): void {
    this.cdText.setText(`${this.cdRemaining}s`);

    // CD 遮罩
    this.cdOverlay.clear();
    const s = BOARD.CELL_SIZE - 12;
    const progress = this.cdRemaining / this.config.cd;
    this.cdOverlay.fillStyle(0x000000, 0.4);
    this.cdOverlay.fillRoundedRect(-s / 2, -s / 2, s, s * progress, 10);
  }

  private onCdComplete(): void {
    this.isReady = true;
    this.cdText.setVisible(false);
    this.cdOverlay.clear();
    this.cdOverlay.setAlpha(0);
    this.readyDot.setVisible(true);
    this.drawReadyDot();

    EventManager.emit(GameEvents.BUILDING_CD_COMPLETE, { buildingId: this.buildingId });

    // 弹跳动画提示就绪
    this.scene.tweens.add({
      targets: this,
      scaleX: 1.1,
      scaleY: 1.1,
      duration: 150,
      yoyo: true,
      repeat: 1,
      ease: 'Bounce.easeOut',
    });
  }

  // 用于存档恢复 CD 状态
  setCdState(remaining: number): void {
    if (remaining > 0) {
      this.cdRemaining = remaining;
      this.isReady = false;
      this.showCdState();
      this.cdTimer = this.scene.time.addEvent({
        delay: 1000,
        repeat: remaining - 1,
        callback: () => {
          this.cdRemaining--;
          this.updateCdDisplay();
          if (this.cdRemaining <= 0) {
            this.onCdComplete();
          }
        },
      });
    }
  }

  getIsReady(): boolean {
    return this.isReady;
  }

  getCdRemaining(): number {
    return this.cdRemaining;
  }

  destroy(fromScene?: boolean): void {
    if (this.cdTimer) {
      this.cdTimer.destroy();
    }
    super.destroy(fromScene);
  }
}
