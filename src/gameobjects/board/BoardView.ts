/**
 * 棋盘视图 - 管理所有格子和物品的渲染与交互
 */
import * as PIXI from 'pixi.js';
import { EventBus } from '@/core/EventBus';
import { Game } from '@/core/Game';
import { BOARD_COLS, BOARD_ROWS, CELL_SIZE, CELL_GAP, BOARD_PADDING_X, BOARD_TOP_Y } from '@/config/Constants';
import { BoardManager, CellData } from '@/managers/BoardManager';
import { MergeManager } from '@/managers/MergeManager';
import { CellView } from './CellView';
import { ItemView } from './ItemView';

export class BoardView extends PIXI.Container {
  private _cellViews: CellView[] = [];
  private _itemViews: ItemView[] = [];
  private _dragGhost: ItemView | null = null;
  private _dragSrcIndex = -1;

  constructor() {
    super();
    this.position.set(BOARD_PADDING_X, BOARD_TOP_Y);
    this._buildGrid();
    this._bindEvents();
    this._setupInteraction();
  }

  private _buildGrid(): void {
    for (let r = 0; r < BOARD_ROWS; r++) {
      for (let c = 0; c < BOARD_COLS; c++) {
        const idx = r * BOARD_COLS + c;
        const x = c * (CELL_SIZE + CELL_GAP);
        const y = r * (CELL_SIZE + CELL_GAP);

        // 格子
        const cellView = new CellView(idx);
        cellView.position.set(x, y);
        this.addChild(cellView);
        this._cellViews.push(cellView);

        // 物品层
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

      // peek 状态也显示物品但半透明
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
    this.eventMode = 'static';
    this.hitArea = new PIXI.Rectangle(
      0, 0,
      BOARD_COLS * (CELL_SIZE + CELL_GAP) - CELL_GAP,
      BOARD_ROWS * (CELL_SIZE + CELL_GAP) - CELL_GAP,
    );

    this.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      const localPos = this.toLocal(e.global);
      const cellIdx = this._hitTestCell(localPos.x, localPos.y);
      if (cellIdx < 0) return;

      if (MergeManager.startDrag(cellIdx)) {
        this._dragSrcIndex = cellIdx;
        this._startDragGhost(cellIdx, localPos);
        // 高亮可合成的目标格
        this._highlightMergeTargets(cellIdx);
      }
    });

    this.on('pointermove', (e: PIXI.FederatedPointerEvent) => {
      if (!this._dragGhost) return;
      const localPos = this.toLocal(e.global);
      this._dragGhost.position.set(localPos.x - CELL_SIZE / 2, localPos.y - CELL_SIZE / 2);
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
    const col = Math.floor(x / (CELL_SIZE + CELL_GAP));
    const row = Math.floor(y / (CELL_SIZE + CELL_GAP));
    if (col < 0 || col >= BOARD_COLS || row < 0 || row >= BOARD_ROWS) return -1;

    // 确认点击在格子内（不在间隙中）
    const cellX = x - col * (CELL_SIZE + CELL_GAP);
    const cellY = y - row * (CELL_SIZE + CELL_GAP);
    if (cellX > CELL_SIZE || cellY > CELL_SIZE) return -1;

    return row * BOARD_COLS + col;
  }

  private _startDragGhost(cellIdx: number, pos: PIXI.IPointData): void {
    this._clearDragGhost();
    const cell = BoardManager.getCellByIndex(cellIdx);
    if (!cell?.itemId) return;

    this._dragGhost = new ItemView();
    this._dragGhost.setItem(cell.itemId);
    this._dragGhost.alpha = 0.7;
    this._dragGhost.position.set(pos.x - CELL_SIZE / 2, pos.y - CELL_SIZE / 2);
    this.addChild(this._dragGhost);

    // 原位置物品半透明
    this._itemViews[cellIdx].alpha = 0.3;
  }

  private _clearDragGhost(): void {
    if (this._dragGhost) {
      this.removeChild(this._dragGhost);
      this._dragGhost.destroy();
      this._dragGhost = null;
    }
    // 恢复原位物品透明度
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
