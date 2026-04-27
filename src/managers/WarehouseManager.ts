/**
 * 仓库管理器 - 棋盘外暂存空间
 *
 * - 初始 4 格，第二行可通过转发逐格解锁
 * - 仓库物品不参与客人订单锁定
 * - 仓库物品不可在仓库内合成
 * - 工具 CD：与棋盘一致，仅在 `updateWarehouseCooldowns(dt)` 局内递减，离线不流逝
 */
import { EventBus } from '@/core/EventBus';
import { Category, InteractType, ITEM_DEFS } from '@/config/ItemConfig';
import { findBoardProducerDef } from '@/config/BuildingConfig';
import { WAREHOUSE_SLOT_UNLOCK_MODES, type ExternalUnlockMode } from '@/config/AdConfig';
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
const SHARE_UNLOCK_START_CAPACITY = 4;
const SHARE_UNLOCK_END_CAPACITY = 10;
const MAX_CAPACITY = SHARE_UNLOCK_END_CAPACITY;

export interface WarehouseSlotEntry {
  itemId: string;
  count?: number;
  toolState?: ToolStateSnapshot;
  /**
   * @deprecated 旧存档墙钟 CD；读档时一次性折算进 toolState.cdRemaining 后清除
   */
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

/** 将旧版墙钟 deadline 折成剩余秒写入 toolState，并去掉 deadline */
function migrateLegacyDeadline(entry: WarehouseSlotEntry): void {
  if (!entry.toolState || entry.cdDeadlineMs === undefined) return;
  const now = Date.now();
  if (now >= entry.cdDeadlineMs) {
    applyCooldownFinishedToToolState(entry.itemId, entry.toolState);
  } else {
    entry.toolState.cdRemaining = Math.max(0, (entry.cdDeadlineMs - now) / 1000);
  }
  entry.cdDeadlineMs = undefined;
}

function normalizeSlot(raw: unknown): WarehouseSlotEntry | null {
  if (raw == null) return null;
  if (typeof raw === 'string') {
    return ITEM_DEFS.has(raw) ? { itemId: raw, count: 1 } : null;
  }
  if (typeof raw === 'object' && raw !== null && 'itemId' in raw) {
    const itemId = (raw as WarehouseSlotEntry).itemId;
    if (!itemId || !ITEM_DEFS.has(itemId)) return null;
    const rawCount = Number((raw as WarehouseSlotEntry).count ?? 1);
    const count = Math.max(1, Math.floor(Number.isFinite(rawCount) ? rawCount : 1));
    const toolState = (raw as WarehouseSlotEntry).toolState;
    if (toolState && typeof toolState === 'object' && toolState.boundItemId === itemId) {
      const entry: WarehouseSlotEntry = { itemId, count: 1, toolState: cloneToolState(toolState) };
      const d = (raw as WarehouseSlotEntry).cdDeadlineMs;
      if (typeof d === 'number' && d > 0) entry.cdDeadlineMs = d;
      return entry;
    }
    return { itemId, count };
  }
  return null;
}

function isStackableWarehouseEntry(entry: WarehouseSlotEntry): boolean {
  if (entry.toolState || entry.cdDeadlineMs !== undefined) return false;
  const def = ITEM_DEFS.get(entry.itemId);
  if (!def) return false;
  if (def.category === Category.BUILDING || def.category === Category.CHEST) return false;
  return def.interactType === InteractType.NONE;
}

function cloneEntry(entry: WarehouseSlotEntry): WarehouseSlotEntry {
  return {
    itemId: entry.itemId,
    count: Math.max(1, Math.floor(entry.count ?? 1)),
    toolState: entry.toolState ? cloneToolState(entry.toolState) : undefined,
    cdDeadlineMs: entry.cdDeadlineMs,
  };
}

function compareWarehouseEntries(a: WarehouseSlotEntry, b: WarehouseSlotEntry): number {
  const categoryOrder: Record<string, number> = {
    [Category.FLOWER]: 0,
    [Category.DRINK]: 1,
    [Category.BUILDING]: 2,
    [Category.CHEST]: 3,
    [Category.CURRENCY]: 4,
  };
  const da = ITEM_DEFS.get(a.itemId);
  const db = ITEM_DEFS.get(b.itemId);
  if (!da || !db) return a.itemId.localeCompare(b.itemId);
  if (da.category !== db.category) {
    return (categoryOrder[da.category] ?? 99) - (categoryOrder[db.category] ?? 99);
  }
  if (da.line !== db.line) return da.line.localeCompare(db.line);
  if (da.level !== db.level) return da.level - db.level;
  if (a.itemId !== b.itemId) return da.name.localeCompare(db.name);
  return (a.toolState ? 1 : 0) - (b.toolState ? 1 : 0);
}

function consolidateStackableEntries(entries: WarehouseSlotEntry[]): WarehouseSlotEntry[] {
  const out: WarehouseSlotEntry[] = [];
  const stackIndex = new Map<string, WarehouseSlotEntry>();
  for (const entry of entries) {
    if (!isStackableWarehouseEntry(entry)) {
      out.push(cloneEntry({ ...entry, count: 1 }));
      continue;
    }
    const existing = stackIndex.get(entry.itemId);
    if (existing) {
      existing.count = (existing.count ?? 1) + Math.max(1, Math.floor(entry.count ?? 1));
    } else {
      const cloned = cloneEntry(entry);
      out.push(cloned);
      stackIndex.set(entry.itemId, cloned);
    }
  }
  return out;
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
  get hasExternalUnlockSlot(): boolean {
    return this._capacity >= SHARE_UNLOCK_START_CAPACITY && this._capacity < SHARE_UNLOCK_END_CAPACITY;
  }

  /** @deprecated 外部解锁格可能是转发或广告，保留旧名兼容 UI 文案判断。 */
  get hasShareUnlockSlot(): boolean {
    return this.hasExternalUnlockSlot;
  }

  get expandCost(): number {
    return EXPAND_COSTS[this._capacity + 1] || 0;
  }

  isShareUnlockSlot(index: number): boolean {
    return index >= SHARE_UNLOCK_START_CAPACITY && index < SHARE_UNLOCK_END_CAPACITY;
  }

  getSlotUnlockMode(index: number): ExternalUnlockMode {
    return WAREHOUSE_SLOT_UNLOCK_MODES[index] ?? 'share';
  }

  canShareUnlockSlot(index: number): boolean {
    return this.isShareUnlockSlot(index) && index === this._capacity && this._capacity < MAX_CAPACITY;
  }

  canExternalUnlockSlot(index: number): boolean {
    return this.canShareUnlockSlot(index);
  }

  slotItemId(index: number): string | null {
    if (index < 0 || index >= this._capacity) return null;
    return this._items[index]?.itemId ?? null;
  }

  slotCount(index: number): number {
    if (index < 0 || index >= this._capacity) return 0;
    return Math.max(0, Math.floor(this._items[index]?.count ?? 0));
  }

  /**
   * 每帧调用：仓库内工具 CD 按局内 dt 递减（与 BuildingManager.update 一致）
   */
  updateWarehouseCooldowns(dt: number): void {
    if (dt <= 0) return;
    let changed = false;
    for (const entry of this._items) {
      if (!entry?.toolState || entry.toolState.cdRemaining <= 0) continue;
      const prev = entry.toolState.cdRemaining;
      entry.toolState.cdRemaining = Math.max(0, entry.toolState.cdRemaining - dt);
      if (prev > 0 && entry.toolState.cdRemaining <= 0) {
        applyCooldownFinishedToToolState(entry.itemId, entry.toolState);
        changed = true;
      }
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

    const entry: WarehouseSlotEntry = { itemId };
    if (toolState && toolState.boundItemId === itemId) {
      entry.toolState = cloneToolState(toolState);
    }
    entry.count = 1;

    if (isStackableWarehouseEntry(entry)) {
      const stacked = this._items.find(e => e?.itemId === itemId && isStackableWarehouseEntry(e));
      if (stacked) {
        stacked.count = Math.max(1, Math.floor(stacked.count ?? 1)) + 1;
        EventBus.emit('warehouse:changed');
        return true;
      }
    }

    if (this.isFull) {
      EventBus.emit('warehouse:full');
      return false;
    }

    const emptyIdx = this._items.indexOf(null);
    if (emptyIdx < 0) return false;

    this._items[emptyIdx] = entry;
    EventBus.emit('warehouse:changed');
    return true;
  }

  withdrawSlot(slotIndex: number): WarehouseSlotEntry | null {
    if (slotIndex < 0 || slotIndex >= this._capacity) return null;
    const entry = this._items[slotIndex];
    if (!entry) return null;
    if (entry.cdDeadlineMs !== undefined) {
      migrateLegacyDeadline(entry);
    }
    if (isStackableWarehouseEntry(entry) && (entry.count ?? 1) > 1) {
      entry.count = Math.max(1, Math.floor(entry.count ?? 1)) - 1;
      EventBus.emit('warehouse:changed');
      return { itemId: entry.itemId, count: 1 };
    }
    this._items[slotIndex] = null;
    EventBus.emit('warehouse:changed');
    return { ...entry, count: 1 };
  }

  expand(): boolean {
    if (!this.canExpand) return false;
    if (this.hasExternalUnlockSlot) {
      EventBus.emit('warehouse:expandFailed', 'share');
      return false;
    }
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

  expandByShare(slotIndex: number): boolean {
    return this.unlockSlotByExternalReward(slotIndex);
  }

  unlockSlotByExternalReward(slotIndex: number): boolean {
    if (!this.canExternalUnlockSlot(slotIndex)) return false;
    this._capacity++;
    this._items.push(null);
    EventBus.emit('warehouse:expanded', this._capacity);
    EventBus.emit('warehouse:changed');
    return true;
  }

  organize(): boolean {
    const before = JSON.stringify(this._items);
    const compacted = consolidateStackableEntries(
      this._items.filter((entry): entry is WarehouseSlotEntry => entry !== null),
    ).sort(compareWarehouseEntries);
    this._items = [
      ...compacted,
      ...new Array(this._capacity - compacted.length).fill(null),
    ];
    EventBus.emit('warehouse:changed');
    return before !== JSON.stringify(this._items);
  }

  exportState(): WarehouseState {
    return {
      capacity: this._capacity,
      items: this._items.map(e => (
        e
          ? {
            itemId: e.itemId,
            count: Math.max(1, Math.floor(e.count ?? 1)),
            toolState: e.toolState,
          }
          : null
      )),
    };
  }

  loadState(state: WarehouseState): void {
    this._capacity = Math.max(INITIAL_CAPACITY, Math.min(MAX_CAPACITY, state.capacity || INITIAL_CAPACITY));
    this._items = new Array(this._capacity).fill(null);
    if (state.items) {
      const loaded: WarehouseSlotEntry[] = [];
      for (let i = 0; i < Math.min(state.items.length, this._capacity); i++) {
        const entry = normalizeSlot(state.items[i]);
        if (entry) {
          if (entry.cdDeadlineMs !== undefined) {
            migrateLegacyDeadline(entry);
          }
          loaded.push(entry);
        }
      }
      const compacted = consolidateStackableEntries(loaded);
      for (let i = 0; i < Math.min(compacted.length, this._capacity); i++) {
        this._items[i] = compacted[i];
      }
    }
    EventBus.emit('warehouse:changed');
  }
}

export const WarehouseManager = new WarehouseManagerClass();
