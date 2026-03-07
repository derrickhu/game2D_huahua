/**
 * 棋盘视图 - 管理所有格子和物品的渲染与交互
 */
import * as PIXI from 'pixi.js';
import { EventBus } from '@/core/EventBus';
import { Game } from '@/core/Game';
import { BOARD_COLS, BOARD_ROWS, CELL_GAP, BoardMetrics, COLORS, DESIGN_WIDTH } from '@/config/Constants';
import { BoardManager, CellData } from '@/managers/BoardManager';
import { MergeManager } from '@/managers/MergeManager';
import { CellView } from './CellView';
import { ItemView } from './ItemView';

export class BoardView extends PIXI.Container {
  private _cellViews: CellView[] = [];
  private _itemViews: ItemView[] = [];
  private _dragGhost: ItemView | null = null;
  private _dragSrcIndex = -1;
  private _gridOffsetY = 0;

  constructor() {
    super();
    this.position.set(0, BoardMetrics.topY);
    this._drawBoardArea();
    this._buildGrid();
    this._bindEvents();
    this._setupInteraction();
  }

  private _drawBoardArea(): void {
    const bg = new PIXI.Graphics();
    bg.beginFill(COLORS.CELL_OPEN, 0.35);
    bg.drawRoundedRect(0, 0, DESIGN_WIDTH, BoardMetrics.areaHeight, 16);
    bg.endFill();
    this.addChild(bg);
  }

  private _buildGrid(): void {
    const cs = BoardMetrics.cellSize;
    this._gridOffsetY = 0;


    for (let r = 0; r < BOARD_ROWS; r++) {
      for (let c = 0; c < BOARD_COLS; c++) {
        const idx = r * BOARD_COLS + c;
        const x = BoardMetrics.paddingX + c * (cs + CELL_GAP);
        const y = this._gridOffsetY + r * (cs + CELL_GAP);

        const cellView = new CellView(idx);
        cellView.position.set(x, y);
        this.addChild(cellView);
        this._cellViews.push(cellView);

        const itemView = new ItemView();
        itemView.position.set(x, y);
        this.addChild(itemView);
        this._itemViews.push(itemView);
      }
    }
  }

  /** 根据 BoardManager 数据刷新所有视图 */
  refresh(): void {
    for (let i = 0; i < BoardManager.cells.length; i++) {
      const cell = BoardManager.cells[i];
      const cellView = this._cellViews[i];
      const itemView = this._itemViews[i];

      cellView.setState(cell.state);
      itemView.setItem(cell.state === 'open' ? cell.itemId : (cell.state === 'peek' ? cell.itemId : null));

      if (cell.state === 'peek' && cell.itemId) {
        itemView.setItem(cell.itemId);
        itemView.alpha = 0.5;
      } else if (cell.state === 'open') {
        itemView.alpha = 1;
      }
    }
  }

  private _bindEvents(): void {
    EventBus.on('board:merged', () => this.refresh());
    EventBus.on('board:moved', () => this.refresh());
    EventBus.on('board:cellUnlocked', () => this.refresh());
    EventBus.on('board:itemPlaced', () => this.refresh());
    EventBus.on('board:itemRemoved', () => this.refresh());
    EventBus.on('board:initialized', () => this.refresh());
    EventBus.on('board:loaded', () => this.refresh());
  }

  /** 拖拽交互 */
  private _setupInteraction(): void {
    const cs = BoardMetrics.cellSize;
    this.eventMode = 'static';
    this.hitArea = new PIXI.Rectangle(
      0, 0,
      DESIGN_WIDTH,
      BoardMetrics.areaHeight,
    );

    this.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      const localPos = this.toLocal(e.global);
      const cellIdx = this._hitTestCell(localPos.x, localPos.y);
      if (cellIdx < 0) return;

      if (MergeManager.startDrag(cellIdx)) {
        this._dragSrcIndex = cellIdx;
        this._startDragGhost(cellIdx, localPos);
        this._highlightMergeTargets(cellIdx);
      }
    });

    this.on('pointermove', (e: PIXI.FederatedPointerEvent) => {
      if (!this._dragGhost) return;
      const localPos = this.toLocal(e.global);
      const half = BoardMetrics.cellSize / 2;
      this._dragGhost.position.set(localPos.x - half, localPos.y - half);
    });

    this.on('pointerup', (e: PIXI.FederatedPointerEvent) => {
      if (this._dragSrcIndex < 0) return;
      const localPos = this.toLocal(e.global);
      const targetIdx = this._hitTestCell(localPos.x, localPos.y);

      if (targetIdx >= 0) {
        MergeManager.endDrag(targetIdx);
      } else {
        MergeManager.cancelDrag();
      }

      this._clearDragGhost();
      this._clearHighlights();
      this._dragSrcIndex = -1;
    });

    this.on('pointerupoutside', () => {
      MergeManager.cancelDrag();
      this._clearDragGhost();
      this._clearHighlights();
      this._dragSrcIndex = -1;
    });
  }

  private _hitTestCell(x: number, y: number): number {
    const cs = BoardMetrics.cellSize;
    const localX = x - BoardMetrics.paddingX;
    const localY = y - this._gridOffsetY;
    if (localX < 0 || localY < 0) return -1;

    const col = Math.floor(localX / (cs + CELL_GAP));
    const row = Math.floor(localY / (cs + CELL_GAP));
    if (col < 0 || col >= BOARD_COLS || row < 0 || row >= BOARD_ROWS) return -1;

    const cellX = localX - col * (cs + CELL_GAP);
    const cellY = localY - row * (cs + CELL_GAP);
    if (cellX > cs || cellY > cs) return -1;

    return row * BOARD_COLS + col;
  }

  private _startDragGhost(cellIdx: number, pos: PIXI.IPointData): void {
    this._clearDragGhost();
    const cell = BoardManager.getCellByIndex(cellIdx);
    if (!cell?.itemId) return;

    const half = BoardMetrics.cellSize / 2;
    this._dragGhost = new ItemView();
    this._dragGhost.setItem(cell.itemId);
    this._dragGhost.alpha = 0.7;
    this._dragGhost.position.set(pos.x - half, pos.y - half);
    this.addChild(this._dragGhost);

    this._itemViews[cellIdx].alpha = 0.3;
  }

  private _clearDragGhost(): void {
    if (this._dragGhost) {
      this.removeChild(this._dragGhost);
      this._dragGhost.destroy();
      this._dragGhost = null;
    }
    if (this._dragSrcIndex >= 0) {
      const cell = BoardManager.getCellByIndex(this._dragSrcIndex);
      if (cell?.state === 'open') {
        this._itemViews[this._dragSrcIndex].alpha = 1;
      }
    }
  }

  private _highlightMergeTargets(srcIndex: number): void {
    for (let i = 0; i < BoardManager.cells.length; i++) {
      if (i === srcIndex) continue;
      if (BoardManager.canMerge(srcIndex, i)) {
        this._cellViews[i].setHighlight(true);
      }
    }
  }

  private _clearHighlights(): void {
    for (const cv of this._cellViews) {
      cv.setHighlight(false);
    }
  }
}
