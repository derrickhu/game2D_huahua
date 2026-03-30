/**
 * 仓库管理器 - 棋盘外暂存空间
 *
 * - 初始 4 格，最大扩容至 8 格
 * - 仓库物品不参与客人订单锁定
 * - 仓库物品不可在仓库内合成
 * - 工具在 CD 中入仓时记录 cdDeadlineMs（真实时间戳），在仓内与离线均按墙钟流逝；CD 结束时写回 toolState（与棋盘 BuildingManager.update 一致）
 */
import { EventBus } from '@/core/EventBus';
import { ITEM_DEFS } from '@/config/ItemConfig';
import { findBoardProducerDef } from '@/config/BuildingConfig';
import { CurrencyManager } from './CurrencyManager';
import type { ToolStateSnapshot } from './BuildingManager';

/** 扩容价格表：第 N 格的钻石价格 */
const EXPAND_COSTS: Record<number, number> = {
  5: 50,
  6: 100,
  7: 200,
  8: 400,
};

const INITIAL_CAPACITY = 4;
const MAX_CAPACITY = 8;

export interface WarehouseSlotEntry {
  itemId: string;
  toolState?: ToolStateSnapshot;
  /** 工具在 CD 中时：CD 结束的 epoch 毫秒时间戳（与 cdRemaining 墙钟对齐） */
  cdDeadlineMs?: number;
}

export interface WarehouseState {
  capacity: number;
  /** 兼容旧存档：string 或完整格子条目 */
  items: (WarehouseSlotEntry | string | null)[];
}

function cloneToolState(ts: ToolStateSnapshot): ToolStateSnapshot {
  return {
    ...ts,
    chestQueue: ts.chestQueue ? [...ts.chestQueue] : undefined,
  };
}

/** CD 已结束时与棋盘逻辑一致：清零 CD、补满周期内免费次数 */
function applyCooldownFinishedToToolState(itemId: string, ts: ToolStateSnapshot): void {
  const td = findBoardProducerDef(itemId);
  ts.cdRemaining = 0;
  if (td && td.cooldown > 0) {
    ts.freeProducesLeft = Math.max(1, td.producesBeforeCooldown);
  }
}

/** 若已过截止时刻，将槽位 toolState 更新为「CD 结束」并清除 deadline */
function reconcileDeadlineIfPast(entry: WarehouseSlotEntry): boolean {
  if (!entry.toolState || entry.cdDeadlineMs === undefined) return false;
  if (Date.now() < entry.cdDeadlineMs) return false;
  applyCooldownFinishedToToolState(entry.itemId, entry.toolState);
  entry.cdDeadlineMs = undefined;
  return true;
}

function normalizeSlot(raw: unknown): WarehouseSlotEntry | null {
  if (raw == null) return null;
  if (typeof raw === 'string') {
    return ITEM_DEFS.has(raw) ? { itemId: raw } : null;
  }
  if (typeof raw === 'object' && raw !== null && 'itemId' in raw) {
    const itemId = (raw as WarehouseSlotEntry).itemId;
    if (!itemId || !ITEM_DEFS.has(itemId)) return null;
    const toolState = (raw as WarehouseSlotEntry).toolState;
    if (toolState && typeof toolState === 'object' && toolState.boundItemId === itemId) {
      const entry: WarehouseSlotEntry = { itemId, toolState: cloneToolState(toolState) };
      const d = (raw as WarehouseSlotEntry).cdDeadlineMs;
      if (typeof d === 'number' && d > 0) entry.cdDeadlineMs = d;
      // 旧存档仅有 cdRemaining、无 deadline：从加载时刻起按真实时间倒计时
      if (entry.toolState.cdRemaining > 0 && entry.cdDeadlineMs === undefined) {
        entry.cdDeadlineMs = Date.now() + entry.toolState.cdRemaining * 1000;
      }
      return entry;
    }
    return { itemId };
  }
  return null;
}

class WarehouseManagerClass {
  private _capacity = INITIAL_CAPACITY;
  private _items: (WarehouseSlotEntry | null)[] = [];

  constructor() {
    this._items = new Array(INITIAL_CAPACITY).fill(null);
  }

  get capacity(): number { return this._capacity; }
  get slots(): readonly (WarehouseSlotEntry | null)[] { return this._items; }
  get items(): readonly (string | null)[] {
    return this._items.map(e => e?.itemId ?? null);
  }
  get usedSlots(): number { return this._items.filter(Boolean).length; }
  get isFull(): boolean { return this.usedSlots >= this._capacity; }
  get canExpand(): boolean { return this._capacity < MAX_CAPACITY; }

  get expandCost(): number {
    return EXPAND_COSTS[this._capacity + 1] || 0;
  }

  slotItemId(index: number): string | null {
    if (index < 0 || index >= this._capacity) return null;
    return this._items[index]?.itemId ?? null;
  }

  /**
   * 每帧调用：仓库内工具 CD 到点则刷新 toolState（与棋盘 CD 结束行为一致）
   */
  updateWarehouseCooldownsFromRealTime(): void {
    let changed = false;
    for (const entry of this._items) {
      if (!entry) continue;
      if (reconcileDeadlineIfPast(entry)) changed = true;
    }
    if (changed) EventBus.emit('warehouse:changed');
  }

  /**
   * 存入物品
   * @param toolState 自棋盘移入时的工具状态；普通物品不传
   */
  storeItem(itemId: string, toolState?: ToolStateSnapshot | null): boolean {
    const def = ITEM_DEFS.get(itemId);
    if (!def) return false;
    if (!def.storable) return false;

    if (this.isFull) {
      EventBus.emit('warehouse:full');
      return false;
    }

    const emptyIdx = this._items.indexOf(null);
    if (emptyIdx < 0) return false;

    const entry: WarehouseSlotEntry = { itemId };
    if (toolState && toolState.boundItemId === itemId) {
      entry.toolState = cloneToolState(toolState);
      if (entry.toolState.cdRemaining > 0) {
        entry.cdDeadlineMs = Date.now() + entry.toolState.cdRemaining * 1000;
      }
    }
    this._items[emptyIdx] = entry;
    EventBus.emit('warehouse:changed');
    return true;
  }

  /** 将 deadline 合并进 toolState，供取回棋盘使用 */
  private _finalizeToolStateForWithdraw(entry: WarehouseSlotEntry): void {
    if (!entry.toolState || entry.toolState.boundItemId !== entry.itemId) {
      entry.cdDeadlineMs = undefined;
      return;
    }
    if (entry.cdDeadlineMs === undefined) return;

    const now = Date.now();
    if (now >= entry.cdDeadlineMs) {
      applyCooldownFinishedToToolState(entry.itemId, entry.toolState);
    } else {
      entry.toolState.cdRemaining = Math.max(0, (entry.cdDeadlineMs - now) / 1000);
    }
    entry.cdDeadlineMs = undefined;
  }

  withdrawSlot(slotIndex: number): WarehouseSlotEntry | null {
    if (slotIndex < 0 || slotIndex >= this._capacity) return null;
    const entry = this._items[slotIndex];
    if (!entry) return null;
    this._finalizeToolStateForWithdraw(entry);
    this._items[slotIndex] = null;
    EventBus.emit('warehouse:changed');
    return entry;
  }

  expand(): boolean {
    if (!this.canExpand) return false;
    const cost = this.expandCost;
    if (cost <= 0) return false;

    if (CurrencyManager.state.diamond < cost) {
      EventBus.emit('warehouse:expandFailed', 'diamond');
      return false;
    }

    CurrencyManager.addDiamond(-cost);
    this._capacity++;
    this._items.push(null);
    EventBus.emit('warehouse:expanded', this._capacity);
    EventBus.emit('warehouse:changed');
    return true;
  }

  exportState(): WarehouseState {
    return {
      capacity: this._capacity,
      items: this._items.map(e => (
        e
          ? {
            itemId: e.itemId,
            toolState: e.toolState,
            cdDeadlineMs: e.cdDeadlineMs,
          }
          : null
      )),
    };
  }

  loadState(state: WarehouseState): void {
    this._capacity = Math.max(INITIAL_CAPACITY, Math.min(MAX_CAPACITY, state.capacity || INITIAL_CAPACITY));
    this._items = new Array(this._capacity).fill(null);
    if (state.items) {
      for (let i = 0; i < Math.min(state.items.length, this._capacity); i++) {
        const entry = normalizeSlot(state.items[i]);
        if (entry) {
          reconcileDeadlineIfPast(entry);
          this._items[i] = entry;
        }
      }
    }
    EventBus.emit('warehouse:changed');
  }
}

export const WarehouseManager = new WarehouseManagerClass();
