import Phaser from 'phaser';
import { BOARD, COLORS, LINE_COLORS, LINE_NAMES } from '../../config/Constants';
import { BuildingConfig, getBuildingConfig, rollOutputLevel } from '../../data/BuildingData';
import { getBuildingStyle } from '../../data/ItemData';
import { EventManager, GameEvents } from '../../managers/EventManager';

export class Building extends Phaser.GameObjects.Container {
  public buildingId: string;
  public row: number = 0;
  public col: number = 0;

  private config: BuildingConfig;
  private bg: Phaser.GameObjects.Graphics;
  private nameText: Phaser.GameObjects.Text;
  private readyDot: Phaser.GameObjects.Graphics;
  private selectorPopup: Phaser.GameObjects.Container | null = null;

  constructor(scene: Phaser.Scene, buildingId: string) {
    super(scene, 0, 0);

    const config = getBuildingConfig(buildingId);
    if (!config) throw new Error(`Unknown building: ${buildingId}`);

    this.buildingId = buildingId;
    this.config = config;

    this.bg = new Phaser.GameObjects.Graphics(scene);
    this.drawBuilding();
    this.add(this.bg);

    this.nameText = new Phaser.GameObjects.Text(scene, 0, 2, config.name, {
      fontSize: '10px',
      fontFamily: 'Arial',
      color: '#FFFFFF',
      fontStyle: 'bold',
      stroke: '#00000066',
      strokeThickness: 2,
    }).setOrigin(0.5);
    this.add(this.nameText);

    this.readyDot = new Phaser.GameObjects.Graphics(scene);
    this.drawReadyDot();
    this.add(this.readyDot);

    this.setSize(BOARD.CELL_SIZE - 8, BOARD.CELL_SIZE - 8);
    this.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, BOARD.CELL_SIZE - 8, BOARD.CELL_SIZE - 8),
      Phaser.Geom.Rectangle.Contains,
    );
    this.on('pointerdown', this.onTap, this);
    scene.add.existing(this);
  }

  private drawBuilding(): void {
    this.bg.clear();
    const s = BOARD.CELL_SIZE - 12;

    // 通过注册表获取品类建筑样式（新增品类只需 registerBuildingStyle 即可）
    const style = getBuildingStyle(this.config.category);
    if (style) {
      this.bg.fillStyle(style.bgColor, style.bgAlpha);
      this.bg.fillRoundedRect(-s / 2, -s / 2, s, s, 10);
      style.drawDecoration(this.bg, s);
    } else {
      // 未注册品类的默认样式：灰色方块
      this.bg.fillStyle(0x9E9E9E, 0.9);
      this.bg.fillRoundedRect(-s / 2, -s / 2, s, s, 8);
    }
  }

  private drawReadyDot(): void {
    this.readyDot.clear();
    this.readyDot.fillStyle(COLORS.GREEN, 1);
    this.readyDot.fillCircle((BOARD.CELL_SIZE - 8) / 2 - 6, -(BOARD.CELL_SIZE - 8) / 2 + 6, 5);
  }

  private onTap(): void {
    if (this.config.selectableLines.length <= 1) {
      // 初级建筑，无需选择，直接产出
      this.produce(this.config.selectableLines[0]);
    } else {
      // 中高级建筑，弹出产出线选择浮层
      this.showLineSelector();
    }
  }

  /** 弹出花系/饮品线选择浮层 */
  private showLineSelector(): void {
    if (this.selectorPopup) {
      this.closeSelectorPopup();
      return;
    }

    this.selectorPopup = new Phaser.GameObjects.Container(this.scene, 0, -BOARD.CELL_SIZE);

    // 半透明背景
    const lines = this.config.selectableLines;
    const popW = Math.max(lines.length * 68 + 8, 140);
    const popH = 56;

    const bg = new Phaser.GameObjects.Graphics(this.scene);
    bg.fillStyle(0xFFFFFF, 0.95);
    bg.fillRoundedRect(-popW / 2, -popH / 2, popW, popH, 12);
    bg.lineStyle(2, 0xE0D0C0, 0.8);
    bg.strokeRoundedRect(-popW / 2, -popH / 2, popW, popH, 12);
    // 小三角指向建筑
    bg.fillStyle(0xFFFFFF, 0.95);
    bg.fillTriangle(-6, popH / 2, 6, popH / 2, 0, popH / 2 + 8);
    this.selectorPopup.add(bg);

    // 每个可选线一个按钮
    const startX = -(lines.length - 1) * 34;
    lines.forEach((line, i) => {
      const btnX = startX + i * 68;
      const color = LINE_COLORS[line] || 0x999999;
      const name = LINE_NAMES[line] || line;

      const btn = new Phaser.GameObjects.Container(this.scene, btnX, 0);

      const btnBg = new Phaser.GameObjects.Graphics(this.scene);
      btnBg.fillStyle(color, 0.2);
      btnBg.fillRoundedRect(-28, -20, 56, 40, 8);
      btnBg.lineStyle(2, color, 0.6);
      btnBg.strokeRoundedRect(-28, -20, 56, 40, 8);
      btn.add(btnBg);

      // 颜色圆点
      const dot = new Phaser.GameObjects.Graphics(this.scene);
      dot.fillStyle(color, 1);
      dot.fillCircle(0, -6, 8);
      btn.add(dot);

      const txt = new Phaser.GameObjects.Text(this.scene, 0, 10, name, {
        fontSize: '12px',
        fontFamily: 'Arial',
        color: '#5A4A3A',
        fontStyle: 'bold',
      }).setOrigin(0.5);
      btn.add(txt);

      btn.setSize(56, 40);
      btn.setInteractive(
        new Phaser.Geom.Rectangle(0, 0, 56, 40),
        Phaser.Geom.Rectangle.Contains,
      );
      btn.on('pointerdown', () => {
        this.produce(line);
        this.closeSelectorPopup();
      });

      this.selectorPopup!.add(btn);
    });

    this.add(this.selectorPopup);

    // 弹出动画
    this.selectorPopup.setScale(0);
    this.scene.tweens.add({
      targets: this.selectorPopup,
      scaleX: 1, scaleY: 1,
      duration: 200,
      ease: 'Back.easeOut',
    });

    // 点击其他地方关闭
    this.scene.time.delayedCall(100, () => {
      this.scene.input.once('pointerdown', (p: Phaser.Input.Pointer) => {
        // 给一帧延迟避免和按钮点击冲突
        this.scene.time.delayedCall(50, () => {
          if (this.selectorPopup) this.closeSelectorPopup();
        });
      });
    });
  }

  private closeSelectorPopup(): void {
    if (!this.selectorPopup) return;
    const popup = this.selectorPopup;
    this.selectorPopup = null;
    this.scene.tweens.add({
      targets: popup,
      scaleX: 0, scaleY: 0,
      duration: 150,
      onComplete: () => popup.destroy(),
    });
  }

  produce(line: string): void {
    const level = rollOutputLevel(this.config.outputTable);
    const itemId = `${line}_${level}`;

    EventManager.emit(GameEvents.BUILDING_PRODUCED, {
      buildingId: this.buildingId,
      itemId,
      row: this.row,
      col: this.col,
    });

    // 产出反馈动画
    this.scene.tweens.add({
      targets: this,
      scaleX: 1.15,
      scaleY: 1.15,
      duration: 100,
      yoyo: true,
      ease: 'Back.easeOut',
    });
  }

  getCdRemaining(): number { return 0; }
}
