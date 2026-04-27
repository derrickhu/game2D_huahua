/**
 * 奖励收纳框管理器
 *
 * 所有非玩家主动操作产出的物品（离线产出、建筑产出等）
 * 进入收纳框堆叠存储，玩家手动取出放入棋盘。
 */
import { EventBus } from '@/core/EventBus';
import { Category, ITEM_DEFS, LEGACY_FLOWER_SIGN_COIN_ITEM_ID } from '@/config/ItemConfig';
import { FlowerSignTicketManager } from '@/managers/FlowerSignTicketManager';

export interface RewardBoxState {
  items: [string, number][];
  /** 最近一次写入收纳盒的物品 id（用于店主下方收起态图标；读档可恢复） */
  lastAddedItemId?: string | null;
}

class RewardBoxManagerClass {
  /** itemId → count */
  private _items: Map<string, number> = new Map();
  /** 维护插入顺序 */
  private _order: string[] = [];
  /** 最近一次入盒的物品（同 id 再入盒也会更新，用于「最新获得」展示） */
  private _lastAddedItemId: string | null = null;

  get totalCount(): number {
    let sum = 0;
    for (const c of this._items.values()) sum += c;
    return sum;
  }

  get isEmpty(): boolean { return this._items.size === 0; }

  /** 按插入顺序返回所有条目 */
  entries(): [string, number][] {
    const result: [string, number][] = [];
    for (const id of this._order) {
      const c = this._items.get(id);
      if (c && c > 0) result.push([id, c]);
    }
    return result;
  }

  organize(): boolean {
    const categoryOrder: Record<string, number> = {
      [Category.FLOWER]: 0,
      [Category.DRINK]: 1,
      [Category.BUILDING]: 2,
      [Category.CHEST]: 3,
      [Category.CURRENCY]: 4,
    };
    const before = this._order.join('|');
    this._order = this._order
      .filter(id => (this._items.get(id) ?? 0) > 0)
      .sort((a, b) => {
        const da = ITEM_DEFS.get(a);
        const db = ITEM_DEFS.get(b);
        if (!da || !db) return a.localeCompare(b);
        if (da.category !== db.category) {
          return (categoryOrder[da.category] ?? 99) - (categoryOrder[db.category] ?? 99);
        }
        if (da.line !== db.line) return da.line.localeCompare(db.line);
        if (da.level !== db.level) return da.level - db.level;
        return da.name.localeCompare(db.name);
      });
    const changed = before !== this._order.join('|');
    EventBus.emit('rewardBox:changed');
    return changed;
  }

  /** 返回第一个物品的 itemId（用于收起态图标显示） */
  firstItemId(): string | null {
    for (const id of this._order) {
      if (this._items.has(id)) return id;
    }
    return null;
  }

  /**
   * 收起态应显示的物品：优先「最近一次入盒」且仍有库存；否则取 order 中最后一类仍有货的。
   */
  latestDisplayItemId(): string | null {
    if (this.isEmpty) return null;
    if (this._lastAddedItemId) {
      const c = this._items.get(this._lastAddedItemId);
      if (c && c > 0) return this._lastAddedItemId;
    }
    for (let i = this._order.length - 1; i >= 0; i--) {
      const id = this._order[i];
      const c = this._items.get(id);
      if (c && c > 0) return id;
    }
    return null;
  }

  private _syncDisplayPointer(): void {
    if (this.isEmpty) {
      this._lastAddedItemId = null;
      return;
    }
    if (this._lastAddedItemId && (this._items.get(this._lastAddedItemId) ?? 0) > 0) {
      return;
    }
    for (let i = this._order.length - 1; i >= 0; i--) {
      const id = this._order[i];
      if ((this._items.get(id) ?? 0) > 0) {
        this._lastAddedItemId = id;
        return;
      }
    }
    this._lastAddedItemId = null;
  }

  addItem(itemId: string, count = 1): void {
    if (itemId === LEGACY_FLOWER_SIGN_COIN_ITEM_ID) {
      if (count > 0) FlowerSignTicketManager.add(count);
      EventBus.emit('rewardBox:changed');
      return;
    }
    const existing = this._items.get(itemId) || 0;
    this._items.set(itemId, existing + count);
    if (!this._order.includes(itemId)) {
      this._order.push(itemId);
    }
    this._lastAddedItemId = itemId;
    EventBus.emit('rewardBox:changed');
  }

  /** 取出一个，成功返回 true */
  takeItem(itemId: string): boolean {
    const c = this._items.get(itemId);
    if (!c || c <= 0) return false;
    if (c === 1) {
      this._items.delete(itemId);
      this._order = this._order.filter(id => id !== itemId);
    } else {
      this._items.set(itemId, c - 1);
    }
    this._syncDisplayPointer();
    EventBus.emit('rewardBox:changed');
    return true;
  }

  exportState(): RewardBoxState {
    return { items: this.entries(), lastAddedItemId: this._lastAddedItemId };
  }

  loadState(state: RewardBoxState): void {
    this._items.clear();
    this._order = [];
    this._lastAddedItemId = null;
    if (state.items) {
      for (const [itemId, count] of state.items) {
        if (!itemId || count <= 0) continue;
        if (itemId === LEGACY_FLOWER_SIGN_COIN_ITEM_ID) {
          FlowerSignTicketManager.add(count);
          continue;
        }
        if (ITEM_DEFS.has(itemId)) {
          this._items.set(itemId, count);
          this._order.push(itemId);
        }
      }
    }
    if (this.isEmpty) {
      this._lastAddedItemId = null;
    } else {
      const saved = state.lastAddedItemId;
      if (saved && (this._items.get(saved) ?? 0) > 0) {
        this._lastAddedItemId = saved;
      } else {
        this._syncDisplayPointer();
      }
    }
    EventBus.emit('rewardBox:changed');
  }
}

export const RewardBoxManager = new RewardBoxManagerClass();
