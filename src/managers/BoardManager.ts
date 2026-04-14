/**
 * 棋盘管理器 - 数据层
 */
import { EventBus } from '@/core/EventBus';
import { BOARD_COLS, BOARD_ROWS, BOARD_TOTAL } from '@/config/Constants';

import { CellState, BOARD_PRESETS, KeyUnlockMode } from '@/config/BoardLayout';
import {
  ITEM_DEFS,
  LEGACY_FLOWER_SIGN_COIN_ITEM_ID,
  findItemId,
  getDowngradeResultId,
  getLuckyCoinDirection,
  getMergeResultId,
  isCrystalBallItem,
  isCrystalScissorsValidTargetDef,
  isGoldenScissorsItem,
  isLuckyCoinItem,
  isLuckyCoinValidTarget,
  pickLuckyCoinNewItemId,
} from '@/config/ItemConfig';
import { FlowerSignTicketManager } from '@/managers/FlowerSignTicketManager';
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
  /** 当前格物品是否已被幸运金币作用过（参与合成后由 doMerge 重置） */
  luckyCoinConsumed: boolean;
}

/** 尝试用幸运金币作用目标格（源格须为金币）；非金币源返回 not_applicable */
export type LuckyCoinApplyResult =
  | { kind: 'not_applicable' }
  | { kind: 'fail'; toast: string }
  | { kind: 'ok'; direction: 'up' | 'down'; newId: string };

export type CrystalBallPreviewResult =
  | { kind: 'not_applicable' }
  | { kind: 'fail'; toast: string }
  | { kind: 'ok'; newId: string };

export type GoldenScissorsPreviewResult =
  | { kind: 'not_applicable' }
  | { kind: 'fail'; toast: string }
  | { kind: 'ok'; splitId: string };

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
          luckyCoinConsumed: false,
        });
      }
    }

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

    if (src.state !== CellState.OPEN && src.state !== CellState.PEEK) return false;
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

    const dstWasPeek = dst.state === CellState.PEEK;
    const srcWasPeek = src.state === CellState.PEEK;
    /** 任一侧为半解锁则视为「波及解锁」合成，须 3×3 辐射（含拖到全解锁格、源格为 PEEK 的情况） */
    const isPeekMerge = dstWasPeek || srcWasPeek;
    let resultCellIndex: number;

    src.itemId = null;
    src.reserved = false;
    src.luckyCoinConsumed = false;

    if (dstWasPeek) {
      dst.state = CellState.OPEN;
      dst.itemId = resultId;
      dst.reserved = false;
      dst.luckyCoinConsumed = false;
      resultCellIndex = dstIndex;
      EventBus.emit('board:merged', srcIndex, dstIndex, resultId, resultCellIndex, isPeekMerge);
      EventBus.emit('board:cellUnlocked', dstIndex);
      this._checkRippleUnlock(dstIndex);
    } else {
      dst.itemId = resultId;
      dst.reserved = false;
      dst.luckyCoinConsumed = false;
      resultCellIndex = dstIndex;
      EventBus.emit('board:merged', srcIndex, dstIndex, resultId, resultCellIndex, isPeekMerge);
      if (srcWasPeek) {
        this._checkRippleUnlock(dstIndex);
      }
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
    if (dst.state !== CellState.OPEN || src.state !== CellState.OPEN) return false;

    dst.itemId = src.itemId;
    dst.reserved = src.reserved;
    dst.luckyCoinConsumed = src.luckyCoinConsumed;
    src.itemId = null;
    src.reserved = false;
    src.luckyCoinConsumed = false;

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
    const luckA = src.luckyCoinConsumed;
    src.itemId = dst.itemId;
    src.reserved = dst.reserved;
    src.luckyCoinConsumed = dst.luckyCoinConsumed;
    dst.itemId = itemA;
    dst.reserved = resA;
    dst.luckyCoinConsumed = luckA;

    EventBus.emit('board:swapped', srcIndex, dstIndex);
    return true;
  }

  /** 在指定格子放置物品（工具产出等） */
  placeItem(index: number, itemId: string): boolean {
    const cell = this.cells[index];
    if (!cell || cell.itemId) return false;
    if (cell.state !== CellState.OPEN && cell.state !== CellState.PEEK) return false;
    if (!ITEM_DEFS.has(itemId)) return false;
    cell.itemId = itemId;
    cell.luckyCoinConsumed = false;
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
    cell.luckyCoinConsumed = false;
    EventBus.emit('board:itemRemoved', index, removed);
    return removed;
  }

  /** 获取第一个空的已开放格 */
  findEmptyOpenCell(): number {
    for (const cell of this.cells) {
      if (!cell.itemId && (cell.state === CellState.OPEN || cell.state === CellState.PEEK)) {
        return cell.index;
      }
    }
    return -1;
  }

  /** 所有空格（已开放且无物），索引升序，用于宝箱批量散落 */
  getEmptyOpenCellIndices(): number[] {
    return this.cells
      .filter(c => !c.itemId && (c.state === CellState.OPEN || c.state === CellState.PEEK))
      .map(c => c.index);
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

  /**
   * 周围 3×3 的 FOG 格：有物品→PEEK，无物品→OPEN。
   * 调用时机：`doMerge` 当合成涉及半解锁格（目标 PEEK 升为 OPEN，或源为 PEEK）；`unlockKeyCell` 钥匙格花钱解锁后。
   */
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

  /**
   * 拖拽幸运金币时，目标格是否应高亮为可吸附（与 tryApplyLuckyCoin 成功条件一致，且至少可升或可降）
   */
  isLuckyCoinHighlightTarget(srcIndex: number, dstIndex: number): boolean {
    if (srcIndex === dstIndex) return false;
    const src = this.cells[srcIndex];
    const dst = this.cells[dstIndex];
    if (!src?.itemId || !isLuckyCoinItem(src.itemId)) return false;
    if (src.state !== CellState.OPEN || dst?.state !== CellState.OPEN) return false;
    if (!dst?.itemId) return false;
    if (dst.luckyCoinConsumed) return false;
    const def = ITEM_DEFS.get(dst.itemId);
    if (!def || !isLuckyCoinValidTarget(def)) return false;
    return !!(getMergeResultId(dst.itemId) || getDowngradeResultId(dst.itemId));
  }

  /**
   * 源格为幸运金币时尝试作用目标格；非金币源返回 not_applicable。
   * 目标为空、非 OPEN、非合法合成链物品时返回 not_applicable，以便走移动/互换。
   */
  tryApplyLuckyCoin(srcIndex: number, dstIndex: number): LuckyCoinApplyResult {
    const src = this.cells[srcIndex];
    const dst = this.cells[dstIndex];
    if (!src?.itemId || !isLuckyCoinItem(src.itemId)) return { kind: 'not_applicable' };
    if (!dst) return { kind: 'not_applicable' };
    if (src.state !== CellState.OPEN) return { kind: 'not_applicable' };
    if (dst.state !== CellState.OPEN) return { kind: 'not_applicable' };
    if (!dst.itemId) return { kind: 'not_applicable' };

    if (dst.luckyCoinConsumed) {
      return { kind: 'fail', toast: '这件物品已使用过幸运金币，合成后可再次使用' };
    }

    const def = ITEM_DEFS.get(dst.itemId);
    if (!def || !isLuckyCoinValidTarget(def)) return { kind: 'not_applicable' };

    const newId = pickLuckyCoinNewItemId(dst.itemId);
    if (!newId) {
      return { kind: 'fail', toast: '该物品无法再升或降级' };
    }

    const oldTargetId = dst.itemId;
    const direction = getLuckyCoinDirection(oldTargetId, newId);
    const coinId = src.itemId;

    src.itemId = null;
    src.reserved = false;
    src.luckyCoinConsumed = false;
    EventBus.emit('board:itemRemoved', srcIndex, coinId);

    dst.itemId = newId;
    dst.luckyCoinConsumed = true;
    dst.reserved = false;

    EventBus.emit('board:luckyCoinApplied', srcIndex, dstIndex, newId, direction);
    EventBus.emit('board:itemPlaced', dstIndex, newId);

    return { kind: 'ok', direction, newId };
  }

  /** 第一个空的 OPEN 格（不含指定索引），无则 -1 */
  findEmptyOpenCellExcluding(excludeIndex: number): number {
    for (const cell of this.cells) {
      if (cell.index === excludeIndex) continue;
      if (!cell.itemId && (cell.state === CellState.OPEN || cell.state === CellState.PEEK)) {
        return cell.index;
      }
    }
    return -1;
  }

  isCrystalBallHighlightTarget(srcIndex: number, dstIndex: number): boolean {
    if (srcIndex === dstIndex) return false;
    const src = this.cells[srcIndex];
    const dst = this.cells[dstIndex];
    if (!src?.itemId || !isCrystalBallItem(src.itemId)) return false;
    if (src.state !== CellState.OPEN || dst?.state !== CellState.OPEN) return false;
    if (!dst?.itemId) return false;
    const def = ITEM_DEFS.get(dst.itemId);
    if (!def || !isCrystalScissorsValidTargetDef(def)) return false;
    return !!getMergeResultId(dst.itemId);
  }

  isGoldenScissorsHighlightTarget(srcIndex: number, dstIndex: number): boolean {
    if (srcIndex === dstIndex) return false;
    const src = this.cells[srcIndex];
    const dst = this.cells[dstIndex];
    if (!src?.itemId || !isGoldenScissorsItem(src.itemId)) return false;
    if (src.state !== CellState.OPEN || dst?.state !== CellState.OPEN) return false;
    if (!dst?.itemId) return false;
    const def = ITEM_DEFS.get(dst.itemId);
    if (!def || !isCrystalScissorsValidTargetDef(def)) return false;
    if (def.level < 2) return false;
    const splitId = findItemId(def.category, def.line, def.level - 1);
    if (!splitId) return false;
    return this.findEmptyOpenCellExcluding(dstIndex) >= 0;
  }

  previewCrystalBallApply(srcIndex: number, dstIndex: number): CrystalBallPreviewResult {
    const src = this.cells[srcIndex];
    const dst = this.cells[dstIndex];
    if (!src?.itemId || !isCrystalBallItem(src.itemId)) return { kind: 'not_applicable' };
    if (!dst) return { kind: 'not_applicable' };
    if (src.state !== CellState.OPEN) return { kind: 'not_applicable' };
    if (dst.state !== CellState.OPEN) return { kind: 'not_applicable' };
    if (!dst.itemId) return { kind: 'not_applicable' };
    const def = ITEM_DEFS.get(dst.itemId);
    if (!def || !isCrystalScissorsValidTargetDef(def)) return { kind: 'not_applicable' };
    const newId = getMergeResultId(dst.itemId);
    if (!newId) return { kind: 'fail', toast: '该物品已满级，无法升级' };
    return { kind: 'ok', newId };
  }

  previewGoldenScissorsApply(srcIndex: number, dstIndex: number): GoldenScissorsPreviewResult {
    const src = this.cells[srcIndex];
    const dst = this.cells[dstIndex];
    if (!src?.itemId || !isGoldenScissorsItem(src.itemId)) return { kind: 'not_applicable' };
    if (!dst) return { kind: 'not_applicable' };
    if (src.state !== CellState.OPEN) return { kind: 'not_applicable' };
    if (dst.state !== CellState.OPEN) return { kind: 'not_applicable' };
    if (!dst.itemId) return { kind: 'not_applicable' };
    const def = ITEM_DEFS.get(dst.itemId);
    if (!def || !isCrystalScissorsValidTargetDef(def)) return { kind: 'not_applicable' };
    if (def.level < 2) return { kind: 'fail', toast: '一级物品无法再拆分' };
    const splitId = findItemId(def.category, def.line, def.level - 1);
    if (!splitId) return { kind: 'fail', toast: '无法拆出低一级的物品' };
    if (this.findEmptyOpenCellExcluding(dstIndex) < 0) {
      return { kind: 'fail', toast: '棋盘没有空位放置第二件' };
    }
    return { kind: 'ok', splitId };
  }

  commitCrystalBallApply(srcIndex: number, dstIndex: number): boolean {
    const prev = this.previewCrystalBallApply(srcIndex, dstIndex);
    if (prev.kind !== 'ok') return false;
    const src = this.cells[srcIndex];
    const dst = this.cells[dstIndex];
    const toolId = src.itemId!;
    const newId = prev.newId;

    src.itemId = null;
    src.reserved = false;
    src.luckyCoinConsumed = false;
    EventBus.emit('board:itemRemoved', srcIndex, toolId);

    dst.itemId = newId;
    dst.reserved = false;

    EventBus.emit('board:specialConsumableApplied', srcIndex, dstIndex);
    EventBus.emit('board:itemPlaced', dstIndex, newId);
    return true;
  }

  commitGoldenScissorsApply(srcIndex: number, dstIndex: number): boolean {
    const prev = this.previewGoldenScissorsApply(srcIndex, dstIndex);
    if (prev.kind !== 'ok') return false;
    const secondIdx = this.findEmptyOpenCellExcluding(dstIndex);
    if (secondIdx < 0) return false;

    const src = this.cells[srcIndex];
    const dst = this.cells[dstIndex];
    const toolId = src.itemId!;
    const splitId = prev.splitId;

    src.itemId = null;
    src.reserved = false;
    src.luckyCoinConsumed = false;
    EventBus.emit('board:itemRemoved', srcIndex, toolId);

    dst.itemId = splitId;
    dst.reserved = false;
    EventBus.emit('board:itemPlaced', dstIndex, splitId);

    this.placeItem(secondIdx, splitId);

    EventBus.emit('board:specialConsumableApplied', srcIndex, dstIndex);
    return true;
  }

  /** 导出存档 */
  exportState(): { index: number; state: CellState; itemId: string | null; reserved: boolean; luckyCoinConsumed: boolean }[] {
    return this.cells.map(c => ({
      index: c.index,
      state: c.state,
      itemId: c.itemId,
      reserved: c.reserved,
      luckyCoinConsumed: c.luckyCoinConsumed,
    }));
  }

  /** 加载存档 */
  loadState(
    savedCells: { index: number; state: CellState; itemId: string | null; reserved: boolean; luckyCoinConsumed?: boolean }[],
  ): void {
    for (const saved of savedCells) {
      const cell = this.cells[saved.index];
      if (cell) {
        cell.state = saved.state;
        if (saved.itemId === LEGACY_FLOWER_SIGN_COIN_ITEM_ID) {
          FlowerSignTicketManager.add(1);
          cell.itemId = null;
        } else {
          cell.itemId = saved.itemId;
        }
        // reserved 由 CustomerManager 按当前客人队列实时计算，不读档（客人未持久化时会导致幽灵锁格+假满足标）
        cell.reserved = false;
        cell.luckyCoinConsumed = saved.luckyCoinConsumed === true;
      }
    }

    const openCells = this.cells.filter(c => c.state === CellState.OPEN);
    const itemCount = openCells.filter(c => c.itemId).length;
    console.log(`[Board] loadState 完成: ${openCells.length} OPEN, ${itemCount} 有物品`);

    EventBus.emit('board:loaded');
  }

  /**
   * 已开放格上是否存在该物品（与订单扫描一致：仅 OPEN）。
   * 用于需求槽 UI：棋盘上有时所有需要该物的客人都显示对勾；物理格仍由 CustomerManager 独占锁定。
   */
  hasOpenCellWithItem(itemId: string): boolean {
    return this.cells.some(
      c => c.state === CellState.OPEN && c.itemId === itemId,
    );
  }
}

export const BoardManager = new BoardManagerClass();
