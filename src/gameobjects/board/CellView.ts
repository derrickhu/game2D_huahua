/**
 * 单格视图
 */
import * as PIXI from 'pixi.js';
import { BoardMetrics, COLORS, FONT_FAMILY } from '@/config/Constants';
import { CellState } from '@/config/BoardLayout';

export class CellView extends PIXI.Container {
  readonly cellIndex: number;

  private _bg: PIXI.Graphics;
  private _border: PIXI.Graphics;
  private _fogOverlay: PIXI.Graphics | null = null;
  private _keyIcon: PIXI.Text | null = null;
  private _state: CellState = CellState.OPEN;

  constructor(cellIndex: number) {
    super();
    this.cellIndex = cellIndex;

    this._bg = new PIXI.Graphics();
    this.addChild(this._bg);

    this._border = new PIXI.Graphics();
    this.addChild(this._border);

    // 立即绘制初始状态
    this._redraw();
  }

  setState(state: CellState): void {
    if (this._state === state) return;
    this._state = state;
    this._redraw();
  }

  get cellState(): CellState {
    return this._state;
  }

  setHighlight(on: boolean): void {
    const cs = BoardMetrics.cellSize;
    this._border.clear();
    if (on) {
      this._border.lineStyle(2.5, 0xFF8C69, 0.9);
      this._border.drawRoundedRect(0, 0, cs, cs, 8);
    } else {
      this._drawBorder();
    }
  }

  private _drawBorder(): void {
    const cs = BoardMetrics.cellSize;
    this._border.clear();
    if (this._state === CellState.OPEN) {
      // 开放格：极淡的细线边框
      this._border.lineStyle(1, COLORS.CELL_BORDER, 0.3);
      this._border.drawRoundedRect(0, 0, cs, cs, 8);
    }
    // 迷雾/钥匙/窥视格不画边框，靠背景色区分
  }

  private _redraw(): void {
    const cs = BoardMetrics.cellSize;

    // 背景
    this._bg.clear();
    switch (this._state) {
      case CellState.OPEN:
        this._bg.beginFill(0xFFFBF5, 0.9);
        this._bg.drawRoundedRect(0, 0, cs, cs, 8);
        this._bg.endFill();
        break;
      case CellState.FOG:
        this._bg.beginFill(0xD8CCBE, 0.7);
        this._bg.drawRoundedRect(0, 0, cs, cs, 8);
        this._bg.endFill();
        break;
      case CellState.PEEK:
        this._bg.beginFill(0xEDE6DD, 0.8);
        this._bg.drawRoundedRect(0, 0, cs, cs, 8);
        this._bg.endFill();
        break;
      case CellState.KEY:
        this._bg.beginFill(0xFFF3D0, 0.85);
        this._bg.drawRoundedRect(0, 0, cs, cs, 8);
        this._bg.endFill();
        break;
    }

    this._drawBorder();

    // 清理覆盖层
    if (this._fogOverlay) {
      this.removeChild(this._fogOverlay);
      this._fogOverlay.destroy();
      this._fogOverlay = null;
    }
    if (this._keyIcon) {
      this.removeChild(this._keyIcon);
      this._keyIcon.destroy();
      this._keyIcon = null;
    }

    // 迷雾格：加细微纹理点
    if (this._state === CellState.FOG) {
      this._fogOverlay = new PIXI.Graphics();
      const step = cs / 4;
      for (let x = step; x < cs; x += step) {
        for (let y = step; y < cs; y += step) {
          this._fogOverlay.beginFill(0xBBAAAA, 0.25);
          this._fogOverlay.drawCircle(x, y, 2);
          this._fogOverlay.endFill();
        }
      }
      this.addChild(this._fogOverlay);
    }

    // 钥匙格
    if (this._state === CellState.KEY) {
      this._keyIcon = new PIXI.Text('🔑', { fontSize: 20 });
      this._keyIcon.anchor.set(0.5, 0.5);
      this._keyIcon.position.set(cs / 2, cs / 2);
      this.addChild(this._keyIcon);
    }

    // 窥视格：半透明遮罩
    if (this._state === CellState.PEEK) {
      this._fogOverlay = new PIXI.Graphics();
      this._fogOverlay.beginFill(0xCCC0B0, 0.25);
      this._fogOverlay.drawRoundedRect(0, 0, cs, cs, 8);
      this._fogOverlay.endFill();
      this.addChild(this._fogOverlay);
    }
  }
}
