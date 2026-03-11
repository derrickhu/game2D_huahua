/**
 * 棋盘管理器 - 数据层
 */
import { EventBus } from '@/core/EventBus';
import { BOARD_COLS, BOARD_ROWS, BOARD_TOTAL } from '@/config/Constants';
import { CellState, BOARD_PRESETS } from '@/config/BoardLayout';
import { ITEM_DEFS, getMergeResultId, Category, FlowerLine } from '@/config/ItemConfig';
import { BUILDING_DEFS } from '@/config/BuildingConfig';
import { SeasonSystem } from '@/systems/SeasonSystem';

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
          reserved: false,
        });
      }
    }

    this._randomizeInitialOpenItems();
    this._ensureAtLeastOneMergePair();

    // 兜底校验：如果 init 后棋盘竟然没物品，用预设数据恢复
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

  /** 初始化随机开局：保留预设的建筑/材料/宝箱，仅随机填充花束/花饮类空位 */
  private _randomizeInitialOpenItems(): void {
    const openCells = this.cells.filter(c => c.state === CellState.OPEN);
    if (openCells.length < 2) return;

    // 先检查填充池，池子为空则不做任何修改，保留预设物品
    const mergeableLv1 = this._buildMergeableLv1Pool();
    if (mergeableLv1.length === 0) {
      console.warn('[Board] 可合成物品池为空，保留预设物品, ITEM_DEFS.size:', ITEM_DEFS.size);
      return;
    }

    // 保留建筑、建筑材料、宝箱等特殊预设物品
    // 注意：ITEM_DEFS 中找不到的物品也保留（安全起见不清除未知物品）
    const preserveCategories = new Set([
      Category.BUILDING, Category.BUILDING_MAT, Category.CHEST,
    ]);
    const fillable = openCells.filter(c => {
      if (!c.itemId) return true;
      const def = ITEM_DEFS.get(c.itemId);
      if (!def) return false; // 未知物品保留，不清除
      return !preserveCategories.has(def.category);
    });

    if (fillable.length < 2) return;

    // 清空可填充格，准备重新随机
    for (const c of fillable) c.itemId = null;

    // 至少保留 2 个空格供建筑产出使用
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
    // 当前只有日常花系有真实图片资源，优先使用
    return [...ITEM_DEFS.values()]
      .filter(def => def.level === 1 && def.maxLevel > 1)
      .filter(def => def.category === Category.FLOWER && def.line === FlowerLine.DAILY)
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

  /** 判断两个物品是否可以合成（含跨格合成） */
  canMerge(srcIndex: number, dstIndex: number): boolean {
    const src = this.cells[srcIndex];
    const dst = this.cells[dstIndex];
    if (!src || !dst) return false;
    if (!src.itemId || !dst.itemId) return false;
    if (src.itemId !== dst.itemId) return false;

    const def = ITEM_DEFS.get(src.itemId);
    if (!def) return false;
    if (def.level >= def.maxLevel) return false;

    // 来源格必须是已开放格
    if (src.state !== CellState.OPEN) return false;
    // 目标格可以是 OPEN 或 PEEK（跨格合成）
    if (dst.state !== CellState.OPEN && dst.state !== CellState.PEEK) return false;

    // PEEK 跨格合成要求两格相邻
    if (dst.state === CellState.PEEK) {
      if (!this._isAdjacent(src, dst)) return false;
    }

    return true;
  }

  /** 执行合成（含跨格合成 + 建筑材料满级自动转化 + 季节跳级） */
  doMerge(srcIndex: number, dstIndex: number): string | null {
    if (!this.canMerge(srcIndex, dstIndex)) return null;

    const src = this.cells[srcIndex];
    const dst = this.cells[dstIndex];
    let resultId = getMergeResultId(src.itemId!);
    if (!resultId) return null;

    // 春天日常花系跳级：20%概率产物再升一级
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
      dst.itemId = null;
      dst.state = CellState.OPEN;
      src.itemId = resultId;
      resultCellIndex = srcIndex;
      EventBus.emit('board:merged', srcIndex, dstIndex, resultId, resultCellIndex);
      EventBus.emit('board:cellUnlocked', dstIndex);
      this._checkRippleUnlock(dstIndex);
      this._checkRippleUnlock(srcIndex);
    } else {
      dst.itemId = resultId;
      dst.reserved = false;
      resultCellIndex = dstIndex;
      EventBus.emit('board:merged', srcIndex, dstIndex, resultId, resultCellIndex);
      this._checkRippleUnlock(dstIndex);
    }

    // 建筑材料满级 → 自动转化为功能建筑
    const finalId = this._checkBuildingMatConversion(resultCellIndex, resultId);
    return finalId || resultId;
  }

  /** 检查建筑材料是否满级需要自动转化为建筑 */
  private _checkBuildingMatConversion(cellIndex: number, itemId: string): string | null {
    const def = ITEM_DEFS.get(itemId);
    if (!def || def.category !== Category.BUILDING_MAT) return null;
    if (def.level < def.maxLevel) return null;

    for (const [buildingId, bDef] of BUILDING_DEFS) {
      if (bDef.requireMatId === itemId) {
        this.cells[cellIndex].itemId = buildingId;
        console.log(`[Board] 建筑材料 ${def.name} 满级自动转化为建筑: ${bDef.name}`);
        EventBus.emit('board:buildingConverted', cellIndex, itemId, buildingId);
        return buildingId;
      }
    }
    return null;
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

    // 确保至少有一对可合成物品（防止玩家完全卡死）
    // 注意：不再重新随机填充，只在完全无可操作时补一对
    this._ensureAtLeastOneMergePair();

    const openCells = this.cells.filter(c => c.state === CellState.OPEN);
    const itemCount = openCells.filter(c => c.itemId).length;
    console.log(`[Board] loadState 完成: ${openCells.length} OPEN, ${itemCount} 有物品`);

    EventBus.emit('board:loaded');
  }
}

export const BoardManager = new BoardManagerClass();
