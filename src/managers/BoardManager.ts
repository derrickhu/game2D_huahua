/**
 * 棋盘管理器 - 数据层
 */
import { EventBus } from '@/core/EventBus';
import { BOARD_COLS, BOARD_ROWS, BOARD_TOTAL } from '@/config/Constants';
import { CellState, CellPreset, BOARD_PRESETS } from '@/config/BoardLayout';
import { ITEM_DEFS, getMergeResultId, Category } from '@/config/ItemConfig';

export interface CellData {
  index: number;
  row: number;
  col: number;
  state: CellState;
  itemId: string | null;
  keyPrice: number;
  unlockPriority: number;
  /** 是否被客人锁定 */
  reserved: boolean;
}

class BoardManagerClass {
  cells: CellData[] = [];

  init(): void {
    this.cells = [];
    for (let i = 0; i < BOARD_TOTAL; i++) {
      const preset = BOARD_PRESETS[i];
      this.cells.push({
        index: i,
        row: preset.row,
        col: preset.col,
        state: preset.state,
        itemId: preset.itemId,
        keyPrice: preset.keyPrice,
        unlockPriority: preset.unlockPriority,
        reserved: false,
      });
    }
    EventBus.emit('board:initialized');
  }

  getCell(row: number, col: number): CellData | null {
    if (row < 0 || row >= BOARD_ROWS || col < 0 || col >= BOARD_COLS) return null;
    return this.cells[row * BOARD_COLS + col];
  }

  getCellByIndex(index: number): CellData | null {
    return this.cells[index] || null;
  }

  /** 判断两个物品是否可以合成 */
  canMerge(srcIndex: number, dstIndex: number): boolean {
    const src = this.cells[srcIndex];
    const dst = this.cells[dstIndex];
    if (!src || !dst) return false;
    if (!src.itemId || !dst.itemId) return false;
    if (src.itemId !== dst.itemId) return false;

    const def = ITEM_DEFS.get(src.itemId);
    if (!def) return false;
    if (def.level >= def.maxLevel) return false;

    // 目标格必须是已开放格
    if (dst.state !== CellState.OPEN) return false;
    // 来源格必须是已开放格
    if (src.state !== CellState.OPEN) return false;

    return true;
  }

  /** 执行合成 */
  doMerge(srcIndex: number, dstIndex: number): string | null {
    if (!this.canMerge(srcIndex, dstIndex)) return null;

    const src = this.cells[srcIndex];
    const dst = this.cells[dstIndex];
    const resultId = getMergeResultId(src.itemId!);
    if (!resultId) return null;

    // 来源格清空
    src.itemId = null;
    src.reserved = false;
    // 目标格放置结果
    dst.itemId = resultId;
    dst.reserved = false;

    EventBus.emit('board:merged', srcIndex, dstIndex, resultId);

    // 合成波及：检查相邻格是否可以解锁
    this._checkRippleUnlock(dstIndex);

    return resultId;
  }

  /** 移动物品 */
  moveItem(srcIndex: number, dstIndex: number): boolean {
    const src = this.cells[srcIndex];
    const dst = this.cells[dstIndex];
    if (!src || !dst) return false;
    if (!src.itemId) return false;
    if (dst.itemId) return false;
    if (dst.state !== CellState.OPEN) return false;
    if (src.state !== CellState.OPEN) return false;

    dst.itemId = src.itemId;
    dst.reserved = src.reserved;
    src.itemId = null;
    src.reserved = false;

    EventBus.emit('board:moved', srcIndex, dstIndex);
    return true;
  }

  /** 在指定格子放置物品（建筑产出等） */
  placeItem(index: number, itemId: string): boolean {
    const cell = this.cells[index];
    if (!cell || cell.state !== CellState.OPEN || cell.itemId) return false;
    cell.itemId = itemId;
    EventBus.emit('board:itemPlaced', index, itemId);
    return true;
  }

  /** 移除物品（交付客人等） */
  removeItem(index: number): string | null {
    const cell = this.cells[index];
    if (!cell || !cell.itemId) return null;
    const removed = cell.itemId;
    cell.itemId = null;
    cell.reserved = false;
    EventBus.emit('board:itemRemoved', index, removed);
    return removed;
  }

  /** 获取第一个空的已开放格 */
  findEmptyOpenCell(): number {
    for (const cell of this.cells) {
      if (cell.state === CellState.OPEN && !cell.itemId) return cell.index;
    }
    return -1;
  }

  /** 用金币解锁钥匙格 */
  unlockKeyCell(index: number): boolean {
    const cell = this.cells[index];
    if (!cell || cell.state !== CellState.KEY) return false;
    cell.state = CellState.OPEN;
    EventBus.emit('board:cellUnlocked', index);
    return true;
  }

  /** 合成波及解锁 */
  private _checkRippleUnlock(centerIndex: number): void {
    const center = this.cells[centerIndex];
    const resultDef = center.itemId ? ITEM_DEFS.get(center.itemId) : null;
    const resultLevel = resultDef?.level || 1;

    // 根据合成结果等级决定解锁数量
    const unlockCount = resultLevel >= 3 ? 2 : 1;

    const neighbors = this._getNeighbors(center.row, center.col);
    const candidates = neighbors
      .filter(c => c.state === CellState.FOG || c.state === CellState.PEEK)
      .sort((a, b) => a.unlockPriority - b.unlockPriority);

    let unlocked = 0;
    for (const cell of candidates) {
      if (unlocked >= unlockCount) break;
      cell.state = CellState.OPEN;
      unlocked++;
      EventBus.emit('board:cellUnlocked', cell.index);
    }
  }

  /** 获取相邻格子（上下左右） */
  private _getNeighbors(row: number, col: number): CellData[] {
    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    const result: CellData[] = [];
    for (const [dr, dc] of dirs) {
      const cell = this.getCell(row + dr, col + dc);
      if (cell) result.push(cell);
    }
    return result;
  }

  /** 导出存档 */
  exportState(): { index: number; state: CellState; itemId: string | null; reserved: boolean }[] {
    return this.cells.map(c => ({
      index: c.index,
      state: c.state,
      itemId: c.itemId,
      reserved: c.reserved,
    }));
  }

  /** 加载存档 */
  loadState(savedCells: { index: number; state: CellState; itemId: string | null; reserved: boolean }[]): void {
    for (const saved of savedCells) {
      const cell = this.cells[saved.index];
      if (cell) {
        cell.state = saved.state;
        cell.itemId = saved.itemId;
        cell.reserved = saved.reserved;
      }
    }
    EventBus.emit('board:loaded');
  }
}

export const BoardManager = new BoardManagerClass();
