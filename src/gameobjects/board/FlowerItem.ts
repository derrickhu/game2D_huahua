import Phaser from 'phaser';
import { FlowerFamily, BOARD, FAMILY_COLORS } from '../../config/Constants';
import { getFlowerConfig, FlowerConfig } from '../../data/FlowerData';

export class FlowerItem extends Phaser.GameObjects.Container {
  public flowerId: string;
  public family: FlowerFamily;
  public level: number;
  public row: number;
  public col: number;

  private bg: Phaser.GameObjects.Graphics;
  private levelText: Phaser.GameObjects.Text;
  private config: FlowerConfig;
  private glowTimer?: Phaser.Time.TimerEvent;

  constructor(scene: Phaser.Scene, row: number, col: number, flowerId: string) {
    super(scene, 0, 0);

    const config = getFlowerConfig(flowerId);
    if (!config) throw new Error(`Unknown flower: ${flowerId}`);

    this.flowerId = flowerId;
    this.family = config.family;
    this.level = config.level;
    this.row = row;
    this.col = col;
    this.config = config;

    // 花朵占位图：彩色圆形
    this.bg = new Phaser.GameObjects.Graphics(scene);
    this.drawFlower(config.color);
    this.add(this.bg);

    // 等级数字
    this.levelText = new Phaser.GameObjects.Text(scene, 0, 0, `${config.level}`, {
      fontSize: '28px',
      fontFamily: 'Arial',
      color: '#FFFFFF',
      fontStyle: 'bold',
      stroke: '#00000066',
      strokeThickness: 3,
    }).setOrigin(0.5);
    this.add(this.levelText);

    // 花系颜色标识（底部小点）
    const familyDot = new Phaser.GameObjects.Graphics(scene);
    familyDot.fillStyle(FAMILY_COLORS[config.family], 1);
    familyDot.fillCircle(0, 32, 6);
    this.add(familyDot);

    // 花名（小文字显示在下方）
    const nameText = new Phaser.GameObjects.Text(scene, 0, -38, config.name, {
      fontSize: '14px',
      fontFamily: 'Arial',
      color: '#5A4A3A',
    }).setOrigin(0.5);
    this.add(nameText);

    this.setSize(BOARD.CELL_SIZE - 16, BOARD.CELL_SIZE - 16);
    this.setInteractive(
      new Phaser.Geom.Rectangle(
        -(BOARD.CELL_SIZE - 16) / 2,
        -(BOARD.CELL_SIZE - 16) / 2,
        BOARD.CELL_SIZE - 16,
        BOARD.CELL_SIZE - 16,
      ),
      Phaser.Geom.Rectangle.Contains,
    );

    scene.input.setDraggable(this);
    scene.add.existing(this);
  }

  private drawFlower(color: number): void {
    this.bg.clear();
    const r = (BOARD.CELL_SIZE - 24) / 2;

    // 外圈光晕
    this.bg.fillStyle(color, 0.2);
    this.bg.fillCircle(0, 0, r + 4);

    // 主体圆
    this.bg.fillStyle(color, 0.9);
    this.bg.fillCircle(0, 0, r);

    // 高光
    this.bg.fillStyle(0xFFFFFF, 0.3);
    this.bg.fillCircle(-r * 0.25, -r * 0.25, r * 0.4);
  }

  playNewGlow(): void {
    let visible = true;
    this.glowTimer = this.scene.time.addEvent({
      delay: 300,
      repeat: 9,
      callback: () => {
        visible = !visible;
        this.setAlpha(visible ? 1 : 0.6);
      },
    });
    this.scene.time.delayedCall(3000, () => {
      this.setAlpha(1);
    });
  }

  playMergeAnimation(targetX: number, targetY: number, onComplete: () => void): void {
    this.scene.tweens.add({
      targets: this,
      x: targetX,
      y: targetY,
      scaleX: 0,
      scaleY: 0,
      duration: 200,
      ease: 'Back.easeIn',
      onComplete,
    });
  }

  playSpawnAnimation(): void {
    this.setScale(0);
    this.scene.tweens.add({
      targets: this,
      scaleX: 1,
      scaleY: 1,
      duration: 300,
      ease: 'Back.easeOut',
    });
  }

  destroy(fromScene?: boolean): void {
    if (this.glowTimer) {
      this.glowTimer.destroy();
    }
    super.destroy(fromScene);
  }
}
