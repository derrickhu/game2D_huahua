/**
 * 客人管理器 - 客人刷新、需求生成、自动锁定棋盘物品、交付结算
 *
 * 重构：需求由 OrderTierConfig 档位模板驱动，不再依赖 CustomerConfig 写死的 demands。
 */
import { EventBus } from '@/core/EventBus';
import { BoardManager } from './BoardManager';
import { CurrencyManager } from './CurrencyManager';
import { RegularCustomerManager } from './RegularCustomerManager';
import { LevelManager } from './LevelManager';
import { CUSTOMER_TYPES, type CustomerDemandDef } from '@/config/CustomerConfig';
import { CellState } from '@/config/BoardLayout';
import { TOOL_DEFS } from '@/config/BuildingConfig';
import { findItemId, Category, FlowerLine, ToolLine } from '@/config/ItemConfig';
import {
  ORDER_TIERS,
  getOrderTierWeights,
  pickTierByWeight,
  type OrderTier,
  type OrderType,
  type UnlockedLines,
} from '@/config/OrderTierConfig';
import { MAX_CUSTOMERS, ACTIVE_CUSTOMER_SLOTS, CUSTOMER_REFRESH_MIN, CUSTOMER_REFRESH_MAX } from '@/config/Constants';

export interface DemandSlot {
  itemId: string;
  lockedCellIndex: number;
}

export interface CustomerInstance {
  uid: number;
  typeId: string;
  name: string;
  emoji: string;
  slots: DemandSlot[];
  allSatisfied: boolean;
  huayuanReward: number;
  hualuReward: number;
  tier: OrderTier;
  orderType: OrderType;
  timeLimit: number | null;
  expReward: number;
  /** 预留：连续订单序号 */
  chainIndex?: number;
  /** 预留：奖励倍率 */
  bonusMultiplier?: number;
}

class CustomerManagerClass {
  private _customers: CustomerInstance[] = [];
  private _refreshTimer = 0;
  private _nextUid = 1;
  private _started = false;

  get customers(): readonly CustomerInstance[] {
    return this._customers;
  }

  init(): void {
    this._customers = [];
    this._nextUid = 1;
    this._started = true;
    this._refreshTimer = CUSTOMER_REFRESH_MAX - 3;

    this._bindBoardEvents();
    this._rescanAll();
  }

  update(dt: number): void {
    if (!this._started) return;

    if (this._customers.length < MAX_CUSTOMERS) {
      this._refreshTimer += dt;
      const threshold = CUSTOMER_REFRESH_MIN +
        Math.random() * (CUSTOMER_REFRESH_MAX - CUSTOMER_REFRESH_MIN);
      if (this._refreshTimer >= threshold) {
        this._refreshTimer = 0;
        this._spawnCustomer();
      }
    }
  }

  deliver(uid: number): boolean {
    const idx = this._customers.findIndex(c => c.uid === uid);
    if (idx < 0) return false;
    const customer = this._customers[idx];
    if (!customer.allSatisfied) return false;

    for (const slot of customer.slots) {
      if (slot.lockedCellIndex >= 0) {
        BoardManager.removeItem(slot.lockedCellIndex);
      }
    }

    const bonus = RegularCustomerManager.getRewardBonus(customer.typeId);
    const finalHuayuan = Math.round(customer.huayuanReward * (1 + bonus));
    CurrencyManager.addHuayuan(finalHuayuan);
    if (customer.hualuReward > 0) CurrencyManager.addHualu(Math.round(customer.hualuReward * (1 + bonus)));

    customer.huayuanReward = finalHuayuan;

    console.log(`[Customer] 交付完成: ${customer.name}(${customer.tier}), 花愿+${finalHuayuan}${bonus > 0 ? ` (熟客加成+${Math.round(bonus * 100)}%)` : ''}`);

    this._customers.splice(idx, 1);
    EventBus.emit('customer:delivered', uid, customer);

    this._rescanAll();
    return true;
  }

  // ---- private ----

  private _bindBoardEvents(): void {
    const rescan = () => this._rescanAll();
    EventBus.on('board:merged', rescan);
    EventBus.on('board:moved', rescan);
    EventBus.on('board:swapped', rescan);
    EventBus.on('board:itemPlaced', rescan);
    EventBus.on('board:itemRemoved', rescan);
    EventBus.on('board:cellUnlocked', rescan);
    EventBus.on('board:buildingConverted', rescan);
    EventBus.on('building:produced', rescan);
    EventBus.on('building:exhausted', rescan);
  }

  // ---------- 产线解锁检测 ----------

  private _getUnlockedLines(): UnlockedLines {
    return {
      hasBouquet: this._hasBouquetProducerOnBoard(),
      hasGreen: this._hasGreenProducerOnBoard(),
      hasDrink: this._hasDrinkProducerOnBoard(),
    };
  }

  private _hasDrinkProducerOnBoard(): boolean {
    for (const c of BoardManager.cells) {
      if (c.state !== CellState.OPEN || !c.itemId) continue;
      const def = TOOL_DEFS.get(c.itemId);
      if (def && def.produceCategory === Category.DRINK && def.canProduce) return true;
    }
    return false;
  }

  private _hasBouquetProducerOnBoard(): boolean {
    for (const c of BoardManager.cells) {
      if (c.state !== CellState.OPEN || !c.itemId) continue;
      if (c.itemId === 'flower_wrap_4') return true;
      const m = /^tool_arrange_(\d+)$/.exec(c.itemId);
      if (m && parseInt(m[1], 10) >= 3) return true;
    }
    return false;
  }

  private _hasGreenProducerOnBoard(): boolean {
    for (const c of BoardManager.cells) {
      if (c.state !== CellState.OPEN || !c.itemId) continue;
      const def = TOOL_DEFS.get(c.itemId);
      if (def?.toolLine === ToolLine.PLANT && def.canProduce) return true;
    }
    return false;
  }

  // ---------- 产线过滤 ----------

  private _eligibleFlowerLines(lines: readonly string[]): string[] {
    return lines.filter(line => {
      if (line === FlowerLine.BOUQUET) return this._hasBouquetProducerOnBoard();
      if (line === FlowerLine.GREEN) return this._hasGreenProducerOnBoard();
      return true;
    });
  }

  private _eligibleDemandLines(demandDef: CustomerDemandDef): string[] {
    if (demandDef.category === Category.DRINK) {
      if (!this._hasDrinkProducerOnBoard()) return [];
      return [...demandDef.lines];
    }
    if (demandDef.category === Category.FLOWER) {
      return this._eligibleFlowerLines(demandDef.lines);
    }
    return [...demandDef.lines];
  }

  // ---------- 新的刷客流程 ----------

  private _spawnCustomer(): void {
    const level = LevelManager.level;
    const lines = this._getUnlockedLines();
    const weights = getOrderTierWeights(level, lines);
    const tier = pickTierByWeight(weights);
    const tierDef = ORDER_TIERS[tier];

    const pool = CUSTOMER_TYPES.filter(t =>
      t.tiers.includes(tier) && this._isTypeAvailableForTier(t.id, tier),
    );
    if (pool.length === 0) return;

    const type = pool[Math.floor(Math.random() * pool.length)];
    const slots = this._generateDemands(tierDef.demandPool, tierDef.slotRange);
    if (slots.length === 0) return;

    const [minHy, maxHy] = tierDef.huayuanRange;
    const huayuan = minHy + Math.floor(Math.random() * (maxHy - minHy + 1));

    const customer: CustomerInstance = {
      uid: this._nextUid++,
      typeId: type.id,
      name: type.name,
      emoji: type.emoji,
      slots,
      allSatisfied: false,
      huayuanReward: huayuan,
      hualuReward: Math.random() < tierDef.hualuChance ? Math.ceil(huayuan * 0.1) : 0,
      tier,
      orderType: tierDef.orderType,
      timeLimit: tierDef.timeLimit,
      expReward: tierDef.expReward,
    };

    this._customers.push(customer);
    console.log(`[Customer] 新客人: ${customer.name}(${customer.emoji}) [${tier}], 需求: ${customer.slots.map(s => s.itemId).join(', ')}`);
    EventBus.emit('customer:arrived', customer);

    this._rescanAll();
  }

  /**
   * 判断某客人类型在指定档位下是否可用（检查该档位需求池的产线是否已解锁）。
   * 如果档位 demandPool 含饮品但棋盘无饮品工具 → 不可用（防止无法完成的订单）。
   */
  private _isTypeAvailableForTier(_typeId: string, tier: OrderTier): boolean {
    const tierDef = ORDER_TIERS[tier];
    const hasDrinkInPool = tierDef.demandPool.some(d => d.category === Category.DRINK);
    if (hasDrinkInPool && !this._hasDrinkProducerOnBoard()) {
      const hasFlowerOnly = tierDef.demandPool.some(d => d.category === Category.FLOWER);
      if (!hasFlowerOnly) return false;
    }
    return true;
  }

  /** 从档位的 demandPool 和 slotRange 生成具体需求 */
  private _generateDemands(
    demandPool: CustomerDemandDef[],
    slotRange: [number, number],
  ): DemandSlot[] {
    const [minSlots, maxSlots] = slotRange;
    const slotCount = minSlots + Math.floor(Math.random() * (maxSlots - minSlots + 1));
    const slots: DemandSlot[] = [];

    for (let i = 0; i < slotCount; i++) {
      const demandDef = demandPool[i % demandPool.length];
      const eligibleLines = this._eligibleDemandLines(demandDef);
      if (eligibleLines.length === 0) {
        if (demandPool.length > 1) continue;
        return [];
      }

      const [minLv, maxLv] = demandDef.levelRange;
      let itemId: string | null = null;
      for (let attempt = 0; attempt < 16; attempt++) {
        const line = eligibleLines[Math.floor(Math.random() * eligibleLines.length)];
        const level = minLv + Math.floor(Math.random() * (maxLv - minLv + 1));
        const cand = findItemId(demandDef.category, line, level);
        if (cand && !slots.some(s => s.itemId === cand)) {
          itemId = cand;
          break;
        }
      }
      if (itemId) {
        slots.push({ itemId, lockedCellIndex: -1 });
      }
    }

    return slots;
  }

  /** 重新扫描所有客人需求并锁定棋盘物品 */
  private _rescanAll(): void {
    for (const cust of this._customers) {
      for (const slot of cust.slots) {
        if (slot.lockedCellIndex >= 0) {
          const cell = BoardManager.getCellByIndex(slot.lockedCellIndex);
          if (cell) cell.reserved = false;
          slot.lockedCellIndex = -1;
        }
      }
      cust.allSatisfied = false;
    }

    const locked = new Set<number>();
    const activeCount = Math.min(this._customers.length, ACTIVE_CUSTOMER_SLOTS);
    for (let ci = 0; ci < activeCount; ci++) {
      const cust = this._customers[ci];
      for (const slot of cust.slots) {
        let bestIndex = -1;

        for (const cell of BoardManager.cells) {
          if (cell.state !== 'open' || !cell.itemId) continue;
          if (locked.has(cell.index)) continue;
          if (cell.itemId !== slot.itemId) continue;
          bestIndex = cell.index;
          break;
        }

        if (bestIndex >= 0) {
          const cell = BoardManager.getCellByIndex(bestIndex)!;
          cell.reserved = true;
          slot.lockedCellIndex = bestIndex;
          locked.add(bestIndex);
        }
      }

      cust.allSatisfied = cust.slots.every(s => s.lockedCellIndex >= 0);
    }

    EventBus.emit('customer:lockChanged');
  }
}

export const CustomerManager = new CustomerManagerClass();
