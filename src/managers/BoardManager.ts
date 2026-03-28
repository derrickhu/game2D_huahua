/**
 * 棋盘管理器 - 数据层
 */
import { EventBus } from '@/core/EventBus';
import { BOARD_COLS, BOARD_ROWS, BOARD_TOTAL } from '@/config/Constants';
import { CellState, BOARD_PRESETS, KeyUnlockMode } from '@/config/BoardLayout';
import { ITEM_DEFS, getMergeResultId, Category, InteractType, FlowerLine } from '@/config/ItemConfig';
import { SeasonSystem } from '@/systems/SeasonSystem';

export interface CellData {
  index: number;
  row: number;
  col: number;
  state: CellState;
  itemId: string | null;
  keyPrice: number;
  unlockPriority: number;
  /** 钥匙格解锁方式 */
  keyUnlockMode: KeyUnlockMode;
  /** 是否被客人锁定 */
  reserved: boolean;
}

class BoardManagerClass {
  cells: CellData[] = [];

  init(): void {
    this.cells = [];

    const presetMap = new Map<string, typeof BOARD_PRESETS[number]>();
    for (const p of BOARD_PRESETS) {
      presetMap.set(`${p.row}_${p.col}`, p);
    }

    let prioritySeed = BOARD_PRESETS.length + 1;
    for (let r = 0; r < BOARD_ROWS; r++) {
      for (let c = 0; c < BOARD_COLS; c++) {
        const index = r * BOARD_COLS + c;
        const preset = presetMap.get(`${r}_${c}`);

        this.cells.push({
          index,
          row: r,
          col: c,
          state: preset?.state ?? CellState.FOG,
          itemId: preset?.itemId ?? null,
          keyPrice: preset?.keyPrice ?? 0,
          unlockPriority: preset?.unlockPriority ?? prioritySeed++,
          keyUnlockMode: preset?.keyUnlockMode ?? 'huayuan',
          reserved: false,
        });
      }
    }

    this._randomizeInitialOpenItems();
    this._ensureAtLeastOneMergePair();

    const itemCount = this.cells.filter(c => c.itemId).length;
    if (itemCount === 0) {
      console.error('[Board] 初始化后无物品！用预设数据恢复...');
      for (const p of BOARD_PRESETS) {
        const idx = p.row * BOARD_COLS + p.col;
        if (this.cells[idx]) {
          this.cells[idx].state = p.state;
          this.cells[idx].itemId = p.itemId;
          this.cells[idx].keyPrice = p.keyPrice;
        }
      }
    }

    const finalItemCount = this.cells.filter(c => c.itemId).length;
    const openCount = this.cells.filter(c => c.state === CellState.OPEN).length;
    const fogCount = this.cells.filter(c => c.state === CellState.FOG).length;
    console.log(`[Board] init 完成: ${this.cells.length} 格, ${openCount} OPEN, ${fogCount} FOG, ${finalItemCount} 有物品, ITEM_DEFS.size=${ITEM_DEFS.size}`);

    EventBus.emit('board:initialized');
  }

  getCell(row: number, col: number): CellData | null {
    if (row < 0 || row >= BOARD_ROWS || col < 0 || col >= BOARD_COLS) return null;
    return this.cells[row * BOARD_COLS + col];
  }

  getCellByIndex(index: number): CellData | null {
    return this.cells[index] || null;
  }

  /** 初始化随机开局：保留预设的建筑/宝箱，仅随机填充花/饮品类空位 */
  private _randomizeInitialOpenItems(): void {
    const openCells = this.cells.filter(c => c.state === CellState.OPEN);
    if (openCells.length < 2) return;

    const mergeableLv1 = this._buildMergeableLv1Pool();
    if (mergeableLv1.length === 0) {
      console.warn('[Board] 可合成物品池为空，保留预设物品, ITEM_DEFS.size:', ITEM_DEFS.size);
      return;
    }

    const fillable = openCells.filter(c => {
      if (!c.itemId) return true;
      const def = ITEM_DEFS.get(c.itemId);
      if (!def) return false;
      return def.interactType === InteractType.NONE;
    });

    if (fillable.length < 2) return;

    for (const c of fillable) c.itemId = null;

    const emptyReserve = 2;
    const maxFill = Math.max(2, fillable.length - emptyReserve);

    const pairId = this._pickRandom(mergeableLv1);
    fillable[0].itemId = pairId;
    fillable[1].itemId = pairId;

    if (fillable[2] && maxFill > 2) fillable[2].itemId = pairId;

    for (let i = 3; i < maxFill; i++) {
      fillable[i].itemId = Math.random() < 0.35 ? pairId : this._pickRandom(mergeableLv1);
    }
  }

  private _buildMergeableLv1Pool(): string[] {
    return [...ITEM_DEFS.values()]
      .filter(def => def.level === 1 && def.maxLevel > 1)
      .filter(def => def.category === Category.FLOWER && def.line === FlowerLine.FRESH)
      .map(def => def.id);
  }

  private _pickRandom<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  private _hasMergeablePair(): boolean {
    const countMap = new Map<string, number>();
    for (const c of this.cells) {
      if (c.state !== CellState.OPEN || !c.itemId) continue;
      const def = ITEM_DEFS.get(c.itemId);
      if (!def || def.level >= def.maxLevel) continue;
      countMap.set(c.itemId, (countMap.get(c.itemId) || 0) + 1);
      if ((countMap.get(c.itemId) || 0) >= 2) return true;
    }
    return false;
  }

  /** 兜底：如果当前开放格没有可合成对，则注入一对 */
  private _ensureAtLeastOneMergePair(): void {
    if (this._hasMergeablePair()) return;

    const openCells = this.cells.filter(c => c.state === CellState.OPEN);
    if (openCells.length < 2) return;

    const pool = this._buildMergeableLv1Pool();
    if (pool.length === 0) return;

    const pairId = this._pickRandom(pool);
    const first = openCells.find(c => !c.itemId) ?? openCells[0];
    const second = openCells.find(c => c.index !== first.index && !c.itemId) ?? openCells.find(c => c.index !== first.index);
    if (!second) return;

    first.itemId = pairId;
    second.itemId = pairId;
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

    if (src.state !== CellState.OPEN) return false;
    if (dst.state !== CellState.OPEN && dst.state !== CellState.PEEK) return false;

    return true;
  }

  /** 执行合成（含跨格合成 + 季节跳级） */
  doMerge(srcIndex: number, dstIndex: number): string | null {
    if (!this.canMerge(srcIndex, dstIndex)) return null;

    const src = this.cells[srcIndex];
    const dst = this.cells[dstIndex];
    let resultId = getMergeResultId(src.itemId!);
    if (!resultId) return null;

    // 季节跳级
    const srcDef = ITEM_DEFS.get(src.itemId!);
    if (srcDef) {
      const skipChance = SeasonSystem.getSkipLevelChance(srcDef.line);
      if (skipChance > 0 && Math.random() < skipChance) {
        const skipId = getMergeResultId(resultId);
        if (skipId) {
          resultId = skipId;
          console.log(`[Board] 季节跳级! ${srcDef.name} → 跳升至 ${ITEM_DEFS.get(skipId)?.name}`);
        }
      }
    }

    const isPeekMerge = dst.state === CellState.PEEK;
    let resultCellIndex: number;

    src.itemId = null;
    src.reserved = false;

    if (isPeekMerge) {
      dst.state = CellState.OPEN;
      dst.itemId = resultId;
      dst.reserved = false;
      resultCellIndex = dstIndex;
      EventBus.emit('board:merged', srcIndex, dstIndex, resultId, resultCellIndex);
      EventBus.emit('board:cellUnlocked', dstIndex);
      this._checkRippleUnlock(dstIndex);
    } else {
      dst.itemId = resultId;
      dst.reserved = false;
      resultCellIndex = dstIndex;
      EventBus.emit('board:merged', srcIndex, dstIndex, resultId, resultCellIndex);
      this._checkRippleUnlock(dstIndex);
    }

    return resultId;
  }

  /** 判断两个格子是否相邻（上下左右） */
  private _isAdjacent(a: CellData, b: CellData): boolean {
    return (Math.abs(a.row - b.row) + Math.abs(a.col - b.col)) === 1;
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

  /**
   * 交换两格上的物品（均须为已开放且均有物品；不可合成时用于拖拽互换）
   */
  swapItems(srcIndex: number, dstIndex: number): boolean {
    const src = this.cells[srcIndex];
    const dst = this.cells[dstIndex];
    if (!src || !dst) return false;
    if (!src.itemId || !dst.itemId) return false;
    if (src.state !== CellState.OPEN || dst.state !== CellState.OPEN) return false;

    const itemA = src.itemId;
    const resA = src.reserved;
    src.itemId = dst.itemId;
    src.reserved = dst.reserved;
    dst.itemId = itemA;
    dst.reserved = resA;

    EventBus.emit('board:swapped', srcIndex, dstIndex);
    return true;
  }

  /** 在指定格子放置物品（工具产出等） */
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

  /** 所有空格（已开放且无物），索引升序，用于宝箱批量散落 */
  getEmptyOpenCellIndices(): number[] {
    return this.cells.filter(c => c.state === CellState.OPEN && !c.itemId).map(c => c.index);
  }

  /** 用金币解锁钥匙格（需调用方先检查并扣除金币） */
  unlockKeyCell(index: number): boolean {
    const cell = this.cells[index];
    if (!cell || cell.state !== CellState.KEY) return false;
    cell.state = CellState.OPEN;
    EventBus.emit('board:cellUnlocked', index);
    this._checkRippleUnlock(index);
    return true;
  }

  /** 获取钥匙格价格 */
  getKeyCellPrice(index: number): number {
    const cell = this.cells[index];
    return cell?.state === CellState.KEY ? cell.keyPrice : 0;
  }

  /** 获取钥匙格解锁方式 */
  getKeyCellUnlockMode(index: number): KeyUnlockMode {
    const cell = this.cells[index];
    return cell?.keyUnlockMode ?? 'huayuan';
  }

  /** 合成波及：周围 3×3 的 FOG 格，有物品→PEEK，无物品→直接 OPEN */
  private _checkRippleUnlock(centerIndex: number): void {
    const center = this.cells[centerIndex];
    const neighbors3x3 = this._getNeighbors3x3(center.row, center.col);

    const peeked: number[] = [];
    for (const cell of neighbors3x3) {
      if (cell.state === CellState.FOG) {
        if (cell.itemId) {
          cell.state = CellState.PEEK;
          peeked.push(cell.index);
        } else {
          cell.state = CellState.OPEN;
          EventBus.emit('board:cellUnlocked', cell.index);
        }
      }
    }

    if (peeked.length > 0) {
      EventBus.emit('board:cellsPeeked', peeked);
    }
  }

  /** 获取 3×3 邻域（8 方向） */
  private _getNeighbors3x3(row: number, col: number): CellData[] {
    const result: CellData[] = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const cell = this.getCell(row + dr, col + dc);
        if (cell) result.push(cell);
      }
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
        // reserved 由 CustomerManager 按当前客人队列实时计算，不读档（客人未持久化时会导致幽灵锁格+假满足标）
        cell.reserved = false;
      }
    }

    this._ensureAtLeastOneMergePair();

    const openCells = this.cells.filter(c => c.state === CellState.OPEN);
    const itemCount = openCells.filter(c => c.itemId).length;
    console.log(`[Board] loadState 完成: ${openCells.length} OPEN, ${itemCount} 有物品`);

    EventBus.emit('board:loaded');
  }
}

export const BoardManager = new BoardManagerClass();
