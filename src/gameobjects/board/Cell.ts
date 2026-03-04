import Phaser from 'phaser';
import { BOARD, COLORS } from '../../config/Constants';
import { BoardItem } from './BoardItem';
import { Building } from './Building';

export type CellContent = 'empty' | 'item' | 'building' | 'locked';

export class Cell extends Phaser.GameObjects.Container {
  public row: number;
  public col: number;
  public contentType: CellContent;
  public item: BoardItem | null = null;
  public building: Building | null = null;

  private bg: Phaser.GameObjects.Graphics;
  private lockIcon: Phaser.GameObjects.Text | null = null;
  private priceText: Phaser.GameObjects.Text | null = null;
  private highlightGfx: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, row: number, col: number, locked: boolean = false) {
    super(scene, 0, 0);

    this.row = row;
    this.col = col;
    this.contentType = locked ? 'locked' : 'empty';

    this.bg = new Phaser.GameObjects.Graphics(scene);
    this.drawCellBg(locked);
    this.add(this.bg);

    this.highlightGfx = new Phaser.GameObjects.Graphics(scene);
    this.highlightGfx.setAlpha(0);
    this.add(this.highlightGfx);

    if (locked) {
      this.lockIcon = new Phaser.GameObjects.Text(scene, 0, -6, '🔒', {
        fontSize: '20px',
      }).setOrigin(0.5);
      this.add(this.lockIcon);
    }

    this.setSize(BOARD.CELL_SIZE, BOARD.CELL_SIZE);
    scene.add.existing(this);
  }

  private drawCellBg(locked: boolean): void {
    this.bg.clear();
    const s = BOARD.CELL_SIZE;
    const r = 8;

    if (locked) {
      this.bg.fillStyle(COLORS.CELL_LOCKED, 0.5);
    } else {
      this.bg.fillStyle(COLORS.CELL_BG, 0.8);
    }
    this.bg.fillRoundedRect(-s / 2, -s / 2, s, s, r);
    this.bg.lineStyle(2, locked ? 0xBBBBBB : COLORS.CELL_BORDER, 0.6);
    this.bg.strokeRoundedRect(-s / 2, -s / 2, s, s, r);
  }

  isEmpty(): boolean {
    return this.contentType === 'empty';
  }

  isLocked(): boolean {
    return this.contentType === 'locked';
  }

  hasItem(): boolean {
    return this.contentType === 'item' && this.item !== null;
  }

  hasBuilding(): boolean {
    return this.contentType === 'building' && this.building !== null;
  }

  // 兼容旧接口
  hasFlower(): boolean { return this.hasItem(); }
  get flower(): BoardItem | null { return this.item; }

  placeItem(item: BoardItem): void {
    this.item = item;
    this.contentType = 'item';
    item.row = this.row;
    item.col = this.col;
    item.setPosition(0, 0);
    this.add(item);
  }

  removeItem(): BoardItem | null {
    const item = this.item;
    if (item) {
      this.remove(item);
      this.item = null;
      this.contentType = 'empty';
    }
    return item;
  }

  // 兼容旧接口
  placeFlower(flower: BoardItem): void { this.placeItem(flower); }
  removeFlower(): BoardItem | null { return this.removeItem(); }

  placeBuilding(building: Building): void {
    this.building = building;
    this.contentType = 'building';
    building.row = this.row;
    building.col = this.col;
    building.setPosition(0, 0);
    this.add(building);
  }

  unlock(): void {
    this.contentType = 'empty';
    if (this.lockIcon) {
      this.lockIcon.destroy();
      this.lockIcon = null;
    }
    if (this.priceText) {
      this.priceText.destroy();
      this.priceText = null;
    }
    this.drawCellBg(false);
  }

  setHighlight(on: boolean, valid: boolean = true): void {
    this.highlightGfx.clear();
    if (on) {
      const s = BOARD.CELL_SIZE;
      const color = valid ? 0x66FF66 : 0xFF6666;
      this.highlightGfx.fillStyle(color, 0.3);
      this.highlightGfx.fillRoundedRect(-s / 2, -s / 2, s, s, 8);
      this.highlightGfx.setAlpha(1);
    } else {
      this.highlightGfx.setAlpha(0);
    }
  }

  showUnlockPrice(price: number): void {
    if (this.priceText) return;
    this.priceText = new Phaser.GameObjects.Text(this.scene, 0, 18, `${price}金`, {
      fontSize: '16px',
      fontFamily: 'Arial',
      color: '#FFD700',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.add(this.priceText);
  }
}
