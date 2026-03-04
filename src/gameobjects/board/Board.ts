import Phaser from 'phaser';
import { BOARD, LAYOUT } from '../../config/Constants';
import { Cell } from './Cell';
import { BoardItem } from './BoardItem';
import { Building } from './Building';
import { EventManager, GameEvents } from '../../managers/EventManager';

export class Board extends Phaser.GameObjects.Container {
  private cells: Cell[][] = [];
  private rows: number;
  private cols: number;

  constructor(scene: Phaser.Scene, rows: number = BOARD.INIT_ROWS, cols: number = BOARD.INIT_COLS) {
    const boardWidth = cols * (BOARD.CELL_SIZE + BOARD.CELL_PADDING) - BOARD.CELL_PADDING;
    const boardHeight = rows * (BOARD.CELL_SIZE + BOARD.CELL_PADDING) - BOARD.CELL_PADDING;
    const startX = (750 - boardWidth) / 2 + BOARD.CELL_SIZE / 2;
    const areaTop = LAYOUT.BOARD_AREA_Y + 4;
    const areaBottom = LAYOUT.NAV_BAR_Y - 4;
    const areaHeight = areaBottom - areaTop;
    const startY = areaTop + (areaHeight - boardHeight) / 2 + BOARD.CELL_SIZE / 2;

    super(scene, 0, 0);
    this.rows = rows;
    this.cols = cols;

    for (let r = 0; r < rows; r++) {
      this.cells[r] = [];
      for (let c = 0; c < cols; c++) {
        const x = startX + c * (BOARD.CELL_SIZE + BOARD.CELL_PADDING);
        const y = startY + r * (BOARD.CELL_SIZE + BOARD.CELL_PADDING);
        const cell = new Cell(scene, r, c, false);
        cell.setPosition(x, y);
        this.cells[r][c] = cell;
        this.add(cell);
      }
    }

    EventManager.on(GameEvents.BUILDING_PRODUCED, this.onBuildingProduced, this);
    scene.add.existing(this);
  }

  getCellAt(row: number, col: number): Cell | null {
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return null;
    return this.cells[row][col];
  }

  getEmptyCells(): Cell[] {
    const result: Cell[] = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.cells[r][c].isEmpty()) {
          result.push(this.cells[r][c]);
        }
      }
    }
    return result;
  }

  getAdjacentEmptyCells(row: number, col: number): Cell[] {
    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    const result: Cell[] = [];
    for (const [dr, dc] of dirs) {
      const cell = this.getCellAt(row + dr, col + dc);
      if (cell && cell.isEmpty()) {
        result.push(cell);
      }
    }
    if (result.length === 0) {
      return this.getEmptyCells();
    }
    return result;
  }

  placeItem(cell: Cell, itemId: string): BoardItem {
    const item = new BoardItem(this.scene, cell.row, cell.col, itemId);
    cell.placeItem(item);
    return item;
  }

  placeItemAnywhere(itemId: string): BoardItem | null {
    const emptyCells = this.getEmptyCells();
    if (emptyCells.length === 0) {
      EventManager.emit(GameEvents.BOARD_FULL);
      return null;
    }
    const cell = Phaser.Utils.Array.GetRandom(emptyCells);
    const item = this.placeItem(cell, itemId);
    item.playSpawnAnimation();
    return item;
  }

  placeBuilding(cell: Cell, buildingId: string): Building {
    const building = new Building(this.scene, buildingId);
    cell.placeBuilding(building);
    return building;
  }

  removeItem(cell: Cell): void {
    const item = cell.removeItem();
    if (item) {
      item.destroy();
    }
  }

  isFull(): boolean {
    return this.getEmptyCells().length === 0;
  }

  getAllItems(): { cell: Cell; item: BoardItem }[] {
    const result: { cell: Cell; item: BoardItem }[] = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const cell = this.cells[r][c];
        if (cell.hasItem() && cell.item) {
          result.push({ cell, item: cell.item });
        }
      }
    }
    return result;
  }

  getAllBuildings(): { cell: Cell; building: Building }[] {
    const result: { cell: Cell; building: Building }[] = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const cell = this.cells[r][c];
        if (cell.hasBuilding() && cell.building) {
          result.push({ cell, building: cell.building });
        }
      }
    }
    return result;
  }

  getCellAtWorldPosition(worldX: number, worldY: number): Cell | null {
    const halfSize = BOARD.CELL_SIZE / 2;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const cell = this.cells[r][c];
        if (
          worldX >= cell.x - halfSize &&
          worldX <= cell.x + halfSize &&
          worldY >= cell.y - halfSize &&
          worldY <= cell.y + halfSize
        ) {
          return cell;
        }
      }
    }
    return null;
  }

  private onBuildingProduced(data: { buildingId: string; itemId: string; row: number; col: number }): void {
    const adjacentCells = this.getAdjacentEmptyCells(data.row, data.col);
    if (adjacentCells.length === 0) {
      EventManager.emit(GameEvents.BOARD_FULL);
      return;
    }
    const targetCell = adjacentCells[0];
    const item = this.placeItem(targetCell, data.itemId);
    item.playSpawnAnimation();
  }

  getRows(): number { return this.rows; }
  getCols(): number { return this.cols; }

  serialize(): any {
    const cellStates: any[][] = [];
    for (let r = 0; r < this.rows; r++) {
      cellStates[r] = [];
      for (let c = 0; c < this.cols; c++) {
        const cell = this.cells[r][c];
        const state: any = { type: cell.contentType };
        if (cell.hasItem() && cell.item) {
          state.itemId = cell.item.itemId;
        }
        if (cell.hasBuilding() && cell.building) {
          state.buildingId = cell.building.buildingId;
        }
        cellStates[r][c] = state;
      }
    }
    return { rows: this.rows, cols: this.cols, cells: cellStates };
  }

  // 兼容旧接口
  placeFlower(cell: Cell, flowerId: string): BoardItem { return this.placeItem(cell, flowerId); }
  placeFlowerAnywhere(flowerId: string): BoardItem | null { return this.placeItemAnywhere(flowerId); }
  removeFlower(cell: Cell): void { this.removeItem(cell); }
  getAllFlowers(): { cell: Cell; flower: BoardItem }[] {
    return this.getAllItems().map(({ cell, item }) => ({ cell, flower: item }));
  }

  destroy(fromScene?: boolean): void {
    EventManager.off(GameEvents.BUILDING_PRODUCED, this.onBuildingProduced, this);
    super.destroy(fromScene);
  }
}
