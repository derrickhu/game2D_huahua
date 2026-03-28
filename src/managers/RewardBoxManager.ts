/**
 * 奖励收纳框管理器
 *
 * 所有非玩家主动操作产出的物品（离线产出、建筑产出、连击溢出等）
 * 进入收纳框堆叠存储，玩家手动取出放入棋盘。
 */
import { EventBus } from '@/core/EventBus';
import { ITEM_DEFS } from '@/config/ItemConfig';

export interface RewardBoxState {
  items: [string, number][];
}

class RewardBoxManagerClass {
  /** itemId → count */
  private _items: Map<string, number> = new Map();
  /** 维护插入顺序 */
  private _order: string[] = [];

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

  /** 返回第一个物品的 itemId（用于收起态图标显示） */
  firstItemId(): string | null {
    for (const id of this._order) {
      if (this._items.has(id)) return id;
    }
    return null;
  }

  addItem(itemId: string, count = 1): void {
    const existing = this._items.get(itemId) || 0;
    this._items.set(itemId, existing + count);
    if (!this._order.includes(itemId)) {
      this._order.push(itemId);
    }
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
    EventBus.emit('rewardBox:changed');
    return true;
  }

  exportState(): RewardBoxState {
    return { items: this.entries() };
  }

  loadState(state: RewardBoxState): void {
    this._items.clear();
    this._order = [];
    if (state.items) {
      for (const [itemId, count] of state.items) {
        if (itemId && ITEM_DEFS.has(itemId) && count > 0) {
          this._items.set(itemId, count);
          this._order.push(itemId);
        }
      }
    }
    EventBus.emit('rewardBox:changed');
  }
}

export const RewardBoxManager = new RewardBoxManagerClass();
