import Phaser from 'phaser';
import { BOARD, COLORS, FlowerFamily } from '../../config/Constants';
import { BuildingConfig, getBuildingConfig } from '../../data/BuildingData';
import { EventManager, GameEvents } from '../../managers/EventManager';

export class Building extends Phaser.GameObjects.Container {
  public buildingId: string;
  public row: number = 0;
  public col: number = 0;

  private config: BuildingConfig;
  private bg: Phaser.GameObjects.Graphics;
  private nameText: Phaser.GameObjects.Text;
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
      fontSize: '11px',
      fontFamily: 'Arial',
      color: '#FFFFFF',
      fontStyle: 'bold',
      stroke: '#00000066',
      strokeThickness: 2,
    }).setOrigin(0.5);
    this.add(this.nameText);

    // 就绪圆点
    this.readyDot = new Phaser.GameObjects.Graphics(scene);
    this.drawReadyDot();
    this.add(this.readyDot);

    // 交互
    this.setSize(BOARD.CELL_SIZE - 8, BOARD.CELL_SIZE - 8);
    this.setInteractive(
      new Phaser.Geom.Rectangle(
        0,
        0,
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
    this.bg.fillRoundedRect(-s / 2, -s / 2, s, s, 8);
    // 屋顶三角形
    this.bg.fillStyle(0xA1887F, 1);
    this.bg.fillTriangle(0, -s / 2 - 10, -s / 2, -s / 2 + 8, s / 2, -s / 2 + 8);
  }

  private drawReadyDot(): void {
    this.readyDot.clear();
    this.readyDot.fillStyle(COLORS.GREEN, 1);
    this.readyDot.fillCircle((BOARD.CELL_SIZE - 8) / 2 - 6, -(BOARD.CELL_SIZE - 8) / 2 + 6, 5);
  }

  private onTap(): void {
    // 点击即产出，无冷却
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

    // 产出反馈动画：弹跳
    this.scene.tweens.add({
      targets: this,
      scaleX: 1.15,
      scaleY: 1.15,
      duration: 100,
      yoyo: true,
      ease: 'Back.easeOut',
    });
  }

  // 保留接口兼容性（存档相关，现在不再需要但避免外部调用报错）
  getCdRemaining(): number {
    return 0;
  }
}
