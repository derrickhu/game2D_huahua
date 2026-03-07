/**
 * 单格视图
 */
import * as PIXI from 'pixi.js';
import { BoardMetrics, COLORS } from '@/config/Constants';
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

    this._drawBorder();
  }

  setState(state: CellState): void {
    this._state = state;
    this._redraw();
  }

  get cellState(): CellState {
    return this._state;
  }

  setHighlight(on: boolean): void {
    const cs = BoardMetrics.cellSize;
    this._bg.clear();
    const color = on ? COLORS.CELL_HIGHLIGHT : this._getBgColor();
    this._bg.beginFill(color, on ? 0.9 : 0.8);
    this._bg.drawRoundedRect(0, 0, cs, cs, 8);
    this._bg.endFill();
  }

  private _getBgColor(): number {
    switch (this._state) {
      case CellState.OPEN: return COLORS.CELL_OPEN;
      case CellState.FOG: return COLORS.CELL_FOG;
      case CellState.PEEK: return COLORS.CELL_PEEK;
      case CellState.KEY: return COLORS.CELL_KEY;
    }
  }

  private _drawBorder(): void {
    const cs = BoardMetrics.cellSize;
    this._border.clear();
    this._border.lineStyle(2, COLORS.CELL_BORDER, 0.6);
    this._border.drawRoundedRect(0, 0, cs, cs, 8);
  }

  private _redraw(): void {
    const cs = BoardMetrics.cellSize;
    this._bg.clear();
    this._bg.beginFill(this._getBgColor(), 0.8);
    this._bg.drawRoundedRect(0, 0, cs, cs, 8);
    this._bg.endFill();

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

    if (this._state === CellState.FOG) {
      this._fogOverlay = new PIXI.Graphics();
      this._fogOverlay.beginFill(0xD4C4B0, 0.6);
      this._fogOverlay.drawRoundedRect(0, 0, cs, cs, 8);
      this._fogOverlay.endFill();
      this.addChild(this._fogOverlay);
    }

    if (this._state === CellState.KEY) {
      this._keyIcon = new PIXI.Text('🔑', {
        fontSize: 24,
      });
      this._keyIcon.anchor.set(0.5);
      this._keyIcon.position.set(cs / 2, cs - 14);
      this.addChild(this._keyIcon);
    }

    if (this._state === CellState.PEEK) {
      this._fogOverlay = new PIXI.Graphics();
      this._fogOverlay.beginFill(0xAAAAAA, 0.3);
      this._fogOverlay.drawRoundedRect(0, 0, cs, cs, 8);
      this._fogOverlay.endFill();
      this.addChild(this._fogOverlay);
    }
  }
}
