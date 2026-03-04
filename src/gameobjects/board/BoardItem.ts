import Phaser from 'phaser';
import { ItemCategory, BOARD, LINE_COLORS } from '../../config/Constants';
import { getItemInfo, getItemShapeDrawer, getCategoryIcon, getItemTexture, ItemInfo } from '../../data/ItemData';

/**
 * 棋盘上的通用物品（花束 or 花饮）
 * 重命名自 FlowerItem，统一处理双品类
 *
 * 关键策略变化：锁定物品仍然可以被拖拽和合成！
 * 锁定只是特效提醒，不阻止操作。
 */
export class BoardItem extends Phaser.GameObjects.Container {
  public itemId: string;
  public category: ItemCategory;
  public line: string;         // FlowerFamily 或 DrinkLine
  public level: number;
  public row: number;
  public col: number;
  public isReserved: boolean = false;
  public reservedBySlot: number = -1;   // 被哪个客人槽位锁定
  public reservedDemandIdx: number = -1; // 被锁定到客人的第几个需求槽位

  private bg: Phaser.GameObjects.Graphics;
  private itemImage: Phaser.GameObjects.Image | null = null;
  private levelText: Phaser.GameObjects.Text;
  private info: ItemInfo;
  private glowTimer?: Phaser.Time.TimerEvent;
  private reserveMark: Phaser.GameObjects.Graphics | null = null;
  private reserveGlowTween?: Phaser.Tweens.Tween;

  constructor(scene: Phaser.Scene, row: number, col: number, itemId: string) {
    super(scene, 0, 0);

    const info = getItemInfo(itemId);
    if (!info) throw new Error(`Unknown item: ${itemId}`);

    this.itemId = itemId;
    this.category = info.category;
    this.line = info.line;
    this.level = info.level;
    this.row = row;
    this.col = col;
    this.info = info;

    // 占位图
    this.bg = new Phaser.GameObjects.Graphics(scene);
    this.drawItem();
    this.add(this.bg);

    // 有图片纹理时不显示文字覆盖层
    const hasTexture = !!this.itemImage;

    // 等级数字
    this.levelText = new Phaser.GameObjects.Text(scene, 0, 0, `${info.level}`, {
      fontSize: '20px',
      fontFamily: 'Arial',
      color: '#FFFFFF',
      fontStyle: 'bold',
      stroke: '#00000066',
      strokeThickness: 2,
    }).setOrigin(0.5);
    this.levelText.setVisible(!hasTexture);
    this.add(this.levelText);

    // 产出线颜色标识（底部小点）
    const lineDot = new Phaser.GameObjects.Graphics(scene);
    if (!hasTexture) {
      lineDot.fillStyle(LINE_COLORS[info.line] || 0x999999, 1);
      lineDot.fillCircle(0, 24, 5);
    }
    this.add(lineDot);

    // 品类图标（从注册表获取，新品类只需 registerCategoryIcon 即可）
    const categoryIcon = getCategoryIcon(info.category);
    const iconText = new Phaser.GameObjects.Text(scene, -22, -24, categoryIcon, {
      fontSize: '10px',
    }).setOrigin(0.5);
    iconText.setVisible(!hasTexture);
    this.add(iconText);

    // 物品名
    const nameText = new Phaser.GameObjects.Text(scene, 4, -28, info.name, {
      fontSize: '11px',
      fontFamily: 'Arial',
      color: '#5A4A3A',
    }).setOrigin(0.5);
    nameText.setVisible(!hasTexture);
    this.add(nameText);

    this.setSize(BOARD.CELL_SIZE - 16, BOARD.CELL_SIZE - 16);
    this.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, BOARD.CELL_SIZE - 16, BOARD.CELL_SIZE - 16),
      Phaser.Geom.Rectangle.Contains,
    );
    scene.input.setDraggable(this);
    scene.add.existing(this);
  }

  private drawItem(): void {
    this.bg.clear();
    const r = (BOARD.CELL_SIZE - 24) / 2;
    const color = this.info.color;

    // 优先使用图片纹理（如果已注册）
    const textureKey = getItemTexture(this.itemId);
    if (textureKey && this.scene.textures.exists(textureKey)) {
      const size = BOARD.CELL_SIZE - 16;
      this.itemImage = new Phaser.GameObjects.Image(this.scene, 0, 0, textureKey);
      this.itemImage.setDisplaySize(size, size);
      this.add(this.itemImage);
      return;
    }

    // 降级：通过注册表获取品类绘制器（新增品类只需 registerItemShape 即可）
    const drawer = getItemShapeDrawer(this.category);
    if (drawer) {
      drawer(this.bg, color, r);
    } else {
      // 未注册品类的默认绘制：菱形
      this.bg.fillStyle(color, 0.9);
      this.bg.fillPoints([
        new Phaser.Geom.Point(0, -r),
        new Phaser.Geom.Point(r, 0),
        new Phaser.Geom.Point(0, r),
        new Phaser.Geom.Point(-r, 0),
      ], true);
    }
  }

  // =============================================
  // 锁定状态（策划案：锁定物品仍可拖拽合成！）
  // =============================================
  setReserved(reserved: boolean, slotIndex: number = -1, demandIdx: number = -1): void {
    this.isReserved = reserved;
    this.reservedBySlot = slotIndex;
    this.reservedDemandIdx = demandIdx;

    if (reserved) {
      // 不禁止拖拽！只显示锁定特效
      if (!this.reserveMark) {
        this.reserveMark = new Phaser.GameObjects.Graphics(this.scene);
        this.add(this.reserveMark);
      }
      this.reserveMark.clear();
      const s = BOARD.CELL_SIZE;
      // 金色边框特效
      this.reserveMark.lineStyle(3, 0xFFD700, 0.8);
      this.reserveMark.strokeRoundedRect(-s / 2 + 2, -s / 2 + 2, s - 4, s - 4, 8);
      // 客人头像标记（右上角小圆圈）
      this.reserveMark.fillStyle(0x4CAF50, 1);
      this.reserveMark.fillCircle(s / 2 - 10, -s / 2 + 10, 8);
      // 对勾
      this.reserveMark.lineStyle(2, 0xFFFFFF, 1);
      this.reserveMark.beginPath();
      this.reserveMark.moveTo(s / 2 - 15, -s / 2 + 10);
      this.reserveMark.lineTo(s / 2 - 11, -s / 2 + 14);
      this.reserveMark.lineTo(s / 2 - 5, -s / 2 + 5);
      this.reserveMark.strokePath();

      // 金色边框持续闪烁动画
      this.reserveMark.setAlpha(1);
      this.reserveGlowTween = this.scene.tweens.add({
        targets: this.reserveMark,
        alpha: { from: 1, to: 0.4 },
        duration: 800,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    } else {
      // 清除锁定特效
      if (this.reserveGlowTween) {
        this.reserveGlowTween.destroy();
        this.reserveGlowTween = undefined;
      }
      if (this.reserveMark) {
        this.reserveMark.clear();
        this.reserveMark.setAlpha(1);
      }
    }
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

  // 兼容旧接口
  get flowerId(): string { return this.itemId; }
  get family(): string { return this.line; }

  destroy(fromScene?: boolean): void {
    if (this.glowTimer) {
      this.glowTimer.destroy();
    }
    if (this.reserveGlowTween) {
      this.reserveGlowTween.destroy();
    }
    super.destroy(fromScene);
  }
}
