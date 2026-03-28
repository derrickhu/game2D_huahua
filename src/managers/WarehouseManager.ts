/**
 * 仓库管理器 - 棋盘外暂存空间
 *
 * - 初始 4 格，最大扩容至 8 格
 * - 仓库物品不参与客人订单锁定
 * - 仓库物品不可在仓库内合成
 */
import { EventBus } from '@/core/EventBus';
import { ITEM_DEFS } from '@/config/ItemConfig';
import { CurrencyManager } from './CurrencyManager';

/** 扩容价格表：第 N 格的钻石价格 */
const EXPAND_COSTS: Record<number, number> = {
  5: 50,
  6: 100,
  7: 200,
  8: 400,
};

const INITIAL_CAPACITY = 4;
const MAX_CAPACITY = 8;

export interface WarehouseState {
  capacity: number;
  items: (string | null)[];
}

class WarehouseManagerClass {
  private _capacity = INITIAL_CAPACITY;
  private _items: (string | null)[] = [];

  constructor() {
    this._items = new Array(INITIAL_CAPACITY).fill(null);
  }

  get capacity(): number { return this._capacity; }
  get items(): readonly (string | null)[] { return this._items; }
  get usedSlots(): number { return this._items.filter(Boolean).length; }
  get isFull(): boolean { return this.usedSlots >= this._capacity; }
  get canExpand(): boolean { return this._capacity < MAX_CAPACITY; }

  /** 获取下次扩容价格 */
  get expandCost(): number {
    return EXPAND_COSTS[this._capacity + 1] || 0;
  }

  /** 存入物品 */
  storeItem(itemId: string): boolean {
    // 验证可存入类型
    const def = ITEM_DEFS.get(itemId);
    if (!def) return false;
    if (!def.storable) return false;

    if (this.isFull) {
      EventBus.emit('warehouse:full');
      return false;
    }

    // 找第一个空位
    const emptyIdx = this._items.indexOf(null);
    if (emptyIdx < 0) return false;

    this._items[emptyIdx] = itemId;
    EventBus.emit('warehouse:changed');
    return true;
  }

  /** 取出物品（返回物品ID） */
  retrieveItem(slotIndex: number): string | null {
    if (slotIndex < 0 || slotIndex >= this._capacity) return null;
    const itemId = this._items[slotIndex];
    if (!itemId) return null;

    this._items[slotIndex] = null;
    EventBus.emit('warehouse:changed');
    return itemId;
  }

  /** 扩容 */
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

  /** 导出存档 */
  exportState(): WarehouseState {
    return {
      capacity: this._capacity,
      items: [...this._items],
    };
  }

  /** 加载存档 */
  loadState(state: WarehouseState): void {
    this._capacity = Math.max(INITIAL_CAPACITY, Math.min(MAX_CAPACITY, state.capacity || INITIAL_CAPACITY));
    this._items = new Array(this._capacity).fill(null);
    if (state.items) {
      for (let i = 0; i < Math.min(state.items.length, this._capacity); i++) {
        const itemId = state.items[i];
        // 清理无效物品ID
        if (itemId && ITEM_DEFS.has(itemId)) {
          this._items[i] = itemId;
        }
      }
    }
    EventBus.emit('warehouse:changed');
  }
}

export const WarehouseManager = new WarehouseManagerClass();
