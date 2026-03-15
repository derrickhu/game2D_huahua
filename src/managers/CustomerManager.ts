/**
 * 客人管理器 - 客人刷新、需求生成、自动锁定棋盘物品、交付结算
 */
import { EventBus } from '@/core/EventBus';
import { BoardManager } from './BoardManager';
import { CurrencyManager } from './CurrencyManager';
import { RegularCustomerManager } from './RegularCustomerManager';
import { CUSTOMER_TYPES, CustomerTypeDef } from '@/config/CustomerConfig';
import { ITEM_DEFS, findItemId } from '@/config/ItemConfig';
import { MAX_CUSTOMERS, ACTIVE_CUSTOMER_SLOTS, CUSTOMER_REFRESH_MIN, CUSTOMER_REFRESH_MAX } from '@/config/Constants';

export interface DemandSlot {
  /** 需要的具体物品 ID */
  itemId: string;
  /** 已锁定的棋盘格索引，-1 = 未锁定 */
  lockedCellIndex: number;
}

export interface CustomerInstance {
  uid: number;
  typeId: string;
  name: string;
  emoji: string;
  slots: DemandSlot[];
  allSatisfied: boolean;
  goldReward: number;
  huayuanReward: number;
  hualuReward: number;
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
    // 首位客人 3 秒后到达
    this._refreshTimer = CUSTOMER_REFRESH_MAX - 3;

    this._bindBoardEvents();
  }

  /** 每帧更新：客人刷新计时 */
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

  /** 交付客人订单 */
  deliver(uid: number): boolean {
    const idx = this._customers.findIndex(c => c.uid === uid);
    if (idx < 0) return false;
    const customer = this._customers[idx];
    if (!customer.allSatisfied) return false;

    // 扣除锁定的物品
    for (const slot of customer.slots) {
      if (slot.lockedCellIndex >= 0) {
        BoardManager.removeItem(slot.lockedCellIndex);
      }
    }

    // 发放奖励（含熟客加成）
    const bonus = RegularCustomerManager.getRewardBonus(customer.typeId);
    const finalGold = Math.round(customer.goldReward * (1 + bonus));
    CurrencyManager.addGold(finalGold);
    if (customer.huayuanReward > 0) CurrencyManager.addHuayuan(Math.round(customer.huayuanReward * (1 + bonus)));
    if (customer.hualuReward > 0) CurrencyManager.addHualu(Math.round(customer.hualuReward * (1 + bonus)));

    // 更新 goldReward 为实际发放值（供 Toast 显示）
    customer.goldReward = finalGold;

    console.log(`[Customer] 交付完成: ${customer.name}, 金币+${finalGold}${bonus > 0 ? ` (熟客加成+${Math.round(bonus * 100)}%)` : ''}`);

    // 移除客人
    this._customers.splice(idx, 1);
    EventBus.emit('customer:delivered', uid, customer);

    // 重新扫描剩余客人锁定
    this._rescanAll();

    return true;
  }

  // ---- 私有方法 ----

  /** 监听棋盘变化，自动重新扫描锁定 */
  private _bindBoardEvents(): void {
    const rescan = () => this._rescanAll();
    EventBus.on('board:merged', rescan);
    EventBus.on('board:moved', rescan);
    EventBus.on('board:itemPlaced', rescan);
    EventBus.on('board:itemRemoved', rescan);
    EventBus.on('board:cellUnlocked', rescan);
    EventBus.on('board:buildingConverted', rescan);
    EventBus.on('building:produced', rescan);
    EventBus.on('building:exhausted', rescan);
  }

  /** 生成一位新客人 */
  private _spawnCustomer(): void {
    // 当前阶段只选花束类客人（前 4 种），后期扩展 unlockPhase
    const pool = CUSTOMER_TYPES.filter(t => this._isTypeAvailable(t));
    if (pool.length === 0) return;

    const type = pool[Math.floor(Math.random() * pool.length)];
    const slots = this._generateDemands(type);
    if (slots.length === 0) return;

    const goldRange = type.goldReward;
    const gold = goldRange[0] + Math.floor(Math.random() * (goldRange[1] - goldRange[0] + 1));

    const customer: CustomerInstance = {
      uid: this._nextUid++,
      typeId: type.id,
      name: type.name,
      emoji: type.emoji,
      slots,
      allSatisfied: false,
      goldReward: gold,
      huayuanReward: Math.random() < type.huayuanChance ? Math.ceil(gold * 0.1) : 0,
      hualuReward: Math.random() < type.hualuChance ? Math.ceil(gold * 0.05) : 0,
    };

    this._customers.push(customer);
    console.log(`[Customer] 新客人: ${customer.name}(${customer.emoji}), 需求: ${customer.slots.map(s => s.itemId).join(', ')}`);
    EventBus.emit('customer:arrived', customer);

    this._rescanAll();
  }

  /** 判断某个客人类型当前是否可用 */
  private _isTypeAvailable(type: CustomerTypeDef): boolean {
    // 简化：有饮品需求的客人需要棋盘上已有饮品建筑
    const hasDrinkDemand = type.demands.some(d => d.category === 'drink');
    if (hasDrinkDemand) {
      const hasDrinkBuilding = BoardManager.cells.some(c =>
        c.state === 'open' && c.itemId?.startsWith('building_perm_5')
      );
      // 暂时全部允许：早期也可能看到少量饮品需求客人
      // 后期可根据 unlockPhase 精确控制
      if (hasDrinkDemand && !hasDrinkBuilding) return false;
    }
    return true;
  }

  /** 为客人生成具体需求 */
  private _generateDemands(type: CustomerTypeDef): DemandSlot[] {
    const [minSlots, maxSlots] = type.slotRange;
    const slotCount = minSlots + Math.floor(Math.random() * (maxSlots - minSlots + 1));
    const slots: DemandSlot[] = [];

    for (let i = 0; i < slotCount; i++) {
      const demandDef = type.demands[i % type.demands.length];
      const line = demandDef.lines[Math.floor(Math.random() * demandDef.lines.length)];
      const [minLv, maxLv] = demandDef.levelRange;
      const level = minLv + Math.floor(Math.random() * (maxLv - minLv + 1));
      const itemId = findItemId(demandDef.category, line, level);

      if (itemId) {
        // 避免同一客人出现重复需求
        if (!slots.some(s => s.itemId === itemId)) {
          slots.push({ itemId, lockedCellIndex: -1 });
        }
      }
    }

    return slots;
  }

  /** 重新扫描所有客人需求并锁定棋盘物品（仅服务中的客人） */
  private _rescanAll(): void {
    // 清除所有客人锁定
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

    // 已锁定的格子集合
    const locked = new Set<number>();

    // 只有前 ACTIVE_CUSTOMER_SLOTS 位客人（服务中）可以锁定物品
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
