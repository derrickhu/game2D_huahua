import Phaser from 'phaser';
import { BOARD, LAYOUT } from '../../config/Constants';
import { Cell } from './Cell';
import { FlowerItem } from './FlowerItem';
import { Building } from './Building';
import { EventManager, GameEvents } from '../../managers/EventManager';

export class Board extends Phaser.GameObjects.Container {
  private cells: Cell[][] = [];
  private rows: number;
  private cols: number;

  constructor(scene: Phaser.Scene, rows: number = BOARD.INIT_ROWS, cols: number = BOARD.INIT_COLS) {
    // 棋盘居中
    const boardWidth = cols * (BOARD.CELL_SIZE + BOARD.CELL_PADDING) - BOARD.CELL_PADDING;
    const boardHeight = rows * (BOARD.CELL_SIZE + BOARD.CELL_PADDING) - BOARD.CELL_PADDING;
    const startX = (750 - boardWidth) / 2 + BOARD.CELL_SIZE / 2;
    const startY = LAYOUT.BOARD_AREA_Y + 40 + BOARD.CELL_SIZE / 2;

    super(scene, 0, 0);
    this.rows = rows;
    this.cols = cols;

    // 创建格子
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

    // 监听建筑产出事件
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
    // 如果相邻没空格，找所有空格
    if (result.length === 0) {
      return this.getEmptyCells();
    }
    return result;
  }

  placeFlower(cell: Cell, flowerId: string): FlowerItem {
    const flower = new FlowerItem(this.scene, cell.row, cell.col, flowerId);
    cell.placeFlower(flower);
    return flower;
  }

  placeFlowerAnywhere(flowerId: string): FlowerItem | null {
    const emptyCells = this.getEmptyCells();
    if (emptyCells.length === 0) {
      EventManager.emit(GameEvents.BOARD_FULL);
      return null;
    }
    const cell = Phaser.Utils.Array.GetRandom(emptyCells);
    const flower = this.placeFlower(cell, flowerId);
    flower.playSpawnAnimation();
    return flower;
  }

  placeBuilding(cell: Cell, buildingId: string): Building {
    const building = new Building(this.scene, buildingId);
    cell.placeBuilding(building);
    return building;
  }

  removeFlower(cell: Cell): void {
    const flower = cell.removeFlower();
    if (flower) {
      flower.destroy();
    }
  }

  isFull(): boolean {
    return this.getEmptyCells().length === 0;
  }

  // 获取所有花朵
  getAllFlowers(): { cell: Cell; flower: FlowerItem }[] {
    const result: { cell: Cell; flower: FlowerItem }[] = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const cell = this.cells[r][c];
        if (cell.hasFlower() && cell.flower) {
          result.push({ cell, flower: cell.flower });
        }
      }
    }
    return result;
  }

  // 获取所有建筑
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

  // 根据像素坐标找格子
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

  // 建筑产出回调
  private onBuildingProduced(data: { buildingId: string; flowerId: string; row: number; col: number }): void {
    const adjacentCells = this.getAdjacentEmptyCells(data.row, data.col);
    if (adjacentCells.length === 0) {
      // 棋盘满了
      EventManager.emit(GameEvents.BOARD_FULL);
      return;
    }

    const targetCell = adjacentCells[0];
    const flower = this.placeFlower(targetCell, data.flowerId);
    flower.playSpawnAnimation();
  }

  getRows(): number { return this.rows; }
  getCols(): number { return this.cols; }

  // 序列化棋盘状态
  serialize(): any {
    const cellStates: any[][] = [];
    for (let r = 0; r < this.rows; r++) {
      cellStates[r] = [];
      for (let c = 0; c < this.cols; c++) {
        const cell = this.cells[r][c];
        const state: any = { type: cell.contentType };
        if (cell.hasFlower() && cell.flower) {
          state.flowerId = cell.flower.flowerId;
        }
        if (cell.hasBuilding() && cell.building) {
          state.buildingId = cell.building.buildingId;
          state.cdRemaining = cell.building.getCdRemaining();
        }
        cellStates[r][c] = state;
      }
    }
    return { rows: this.rows, cols: this.cols, cells: cellStates };
  }

  destroy(fromScene?: boolean): void {
    EventManager.off(GameEvents.BUILDING_PRODUCED, this.onBuildingProduced, this);
    super.destroy(fromScene);
  }
}
