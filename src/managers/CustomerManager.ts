/**
 * 客人管理器 - 客人刷新、需求生成、自动锁定棋盘物品、交付结算
 *
 * 重构：需求由 OrderTierConfig 档位模板驱动，不再依赖 CustomerConfig 写死的 demands。
 * 棋盘匹配：盘上有所需物品则每位客人都可完成；多客人可共用同一格（交付时再消耗）；同一客人多槽不得抢同一格。
 */
import { EventBus } from '@/core/EventBus';
import { BoardManager } from './BoardManager';
import { CurrencyManager } from './CurrencyManager';
import { RegularCustomerManager } from './RegularCustomerManager';
import { LevelManager } from './LevelManager';
import { CUSTOMER_TYPES, type CustomerDemandDef } from '@/config/CustomerConfig';
import { CellState } from '@/config/BoardLayout';
import { TOOL_DEFS } from '@/config/BuildingConfig';
import { findItemId, Category, FlowerLine, ToolLine, ITEM_DEFS } from '@/config/ItemConfig';
import {
  ORDER_TIERS,
  getOrderTierWeights,
  getEffectiveMaxLevel,
  getDynamicMaxCustomers,
  pickTierByWeight,
  type OrderTier,
  type OrderType,
  type UnlockedLines,
} from '@/config/OrderTierConfig';
import { CUSTOMER_REFRESH_MIN, CUSTOMER_REFRESH_MAX } from '@/config/Constants';

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
  tier: OrderTier;
  orderType: OrderType;
  timeLimit: number | null;
  /** 预留：连续订单序号 */
  chainIndex?: number;
  /** 预留：奖励倍率 */
  bonusMultiplier?: number;
  /** 本单交付时应用的熟客花愿加成比例（仅 emit 前写入，供 Toast 等；非熟客或未加成不设） */
  settledRegularBonus?: number;
}

/** 存档用需求槽（无 lockedCellIndex，读档后由 _rescanAll 绑定棋盘） */
export interface CustomerSaveSlot {
  itemId: string;
}

export interface CustomerSaveEntry {
  uid: number;
  typeId: string;
  name: string;
  emoji: string;
  slots: CustomerSaveSlot[];
  huayuanReward: number;
  tier: OrderTier;
  orderType: OrderType;
  timeLimit: number | null;
  chainIndex?: number;
  bonusMultiplier?: number;
}

export interface CustomerPersistState {
  list: CustomerSaveEntry[];
  nextUid: number;
  refreshTimer: number;
}

const VALID_ORDER_TIERS = new Set<OrderTier>(['C', 'B', 'A', 'S']);
const VALID_ORDER_TYPES = new Set<OrderType>(['normal', 'timed', 'chain', 'challenge']);

function normalizeCustomerPersistState(raw: unknown): CustomerPersistState | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const listRaw = o.list;
  if (!Array.isArray(listRaw) || listRaw.length === 0) return null;

  const list: CustomerSaveEntry[] = [];
  for (const row of listRaw) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const typeId = typeof r.typeId === 'string' ? r.typeId : '';
    const typeDef = CUSTOMER_TYPES.find(t => t.id === typeId);
    if (!typeDef) continue;

    const slotsRaw = r.slots;
    const slots: CustomerSaveSlot[] = [];
    if (Array.isArray(slotsRaw)) {
      for (const s of slotsRaw) {
        if (!s || typeof s !== 'object') continue;
        const itemId = (s as Record<string, unknown>).itemId;
        if (typeof itemId === 'string' && ITEM_DEFS.has(itemId)) {
          slots.push({ itemId });
        }
      }
    }
    if (slots.length === 0) continue;

    const tier = VALID_ORDER_TIERS.has(r.tier as OrderTier) ? (r.tier as OrderTier) : 'C';
    const orderType = VALID_ORDER_TYPES.has(r.orderType as OrderType)
      ? (r.orderType as OrderType)
      : 'normal';
    const huayuanReward =
      typeof r.huayuanReward === 'number' && Number.isFinite(r.huayuanReward) && r.huayuanReward >= 0
        ? Math.floor(r.huayuanReward)
        : 10;
    const timeLimit =
      r.timeLimit === null || (typeof r.timeLimit === 'number' && Number.isFinite(r.timeLimit))
        ? (r.timeLimit as number | null)
        : null;
    const uid =
      typeof r.uid === 'number' && r.uid >= 1 ? Math.floor(r.uid) : list.length + 1;

    list.push({
      uid,
      typeId,
      name: typeof r.name === 'string' && r.name ? r.name : typeDef.name,
      emoji: typeof r.emoji === 'string' && r.emoji ? r.emoji : typeDef.emoji,
      slots,
      huayuanReward,
      tier,
      orderType,
      timeLimit,
      chainIndex: typeof r.chainIndex === 'number' ? r.chainIndex : undefined,
      bonusMultiplier: typeof r.bonusMultiplier === 'number' ? r.bonusMultiplier : undefined,
    });
  }

  if (list.length === 0) return null;

  const maxUid = list.reduce((m, e) => Math.max(m, e.uid), 0);
  let nextUid =
    typeof o.nextUid === 'number' && o.nextUid >= 1 ? Math.floor(o.nextUid) : maxUid + 1;
  nextUid = Math.max(nextUid, maxUid + 1);

  const refreshTimer =
    typeof o.refreshTimer === 'number' && o.refreshTimer >= 0 && Number.isFinite(o.refreshTimer)
      ? o.refreshTimer
      : CUSTOMER_REFRESH_MAX - 3;

  return { list, nextUid, refreshTimer };
}

class CustomerManagerClass {
  private _customers: CustomerInstance[] = [];
  private _refreshTimer = 0;
  private _nextUid = 1;
  private _started = false;
  /** SaveManager.load 在 MainScene 初始化前写入；init() 消费后清空 */
  private _preparedFromSave: CustomerPersistState | null = null;

  get customers(): readonly CustomerInstance[] {
    return this._customers;
  }

  /**
   * 读档后、init 前调用：恢复队列与刷怪计时（棋盘须已 loadState）
   */
  prepareFromSave(raw: unknown): void {
    this._preparedFromSave = normalizeCustomerPersistState(raw);
  }

  exportState(): CustomerPersistState {
    if (this._preparedFromSave) {
      const p = this._preparedFromSave;
      return {
        list: p.list.map(e => ({
          ...e,
          slots: e.slots.map(s => ({ itemId: s.itemId })),
        })),
        nextUid: p.nextUid,
        refreshTimer: p.refreshTimer,
      };
    }
    return {
      list: this._customers.map(c => ({
        uid: c.uid,
        typeId: c.typeId,
        name: c.name,
        emoji: c.emoji,
        slots: c.slots.map(s => ({ itemId: s.itemId })),
        huayuanReward: c.huayuanReward,
        tier: c.tier,
        orderType: c.orderType,
        timeLimit: c.timeLimit,
        chainIndex: c.chainIndex,
        bonusMultiplier: c.bonusMultiplier,
      })),
      nextUid: this._nextUid,
      refreshTimer: this._refreshTimer,
    };
  }

  init(): void {
    this._started = true;

    if (this._preparedFromSave) {
      const p = this._preparedFromSave;
      this._preparedFromSave = null;
      this._customers = p.list.map(e => ({
        uid: e.uid,
        typeId: e.typeId,
        name: e.name,
        emoji: e.emoji,
        slots: e.slots.map(s => ({ itemId: s.itemId, lockedCellIndex: -1 })),
        allSatisfied: false,
        huayuanReward: e.huayuanReward,
        tier: e.tier,
        orderType: e.orderType,
        timeLimit: e.timeLimit,
        chainIndex: e.chainIndex,
        bonusMultiplier: e.bonusMultiplier,
      }));
      this._nextUid = p.nextUid;
      this._refreshTimer = p.refreshTimer;
      const maxCap = getDynamicMaxCustomers(this._getUnlockedLines());
      if (this._customers.length > maxCap) {
        this._customers = this._customers.slice(0, maxCap);
        console.warn(`[Customer] 读档客人超过当前上限 ${maxCap}，已截断`);
      }
    } else {
      this._customers = [];
      this._nextUid = 1;
      this._refreshTimer = CUSTOMER_REFRESH_MAX - 3;
    }

    this._bindBoardEvents();
    this._rescanAll();
  }

  /** 当前动态客人上限（基于已解锁产线数） */
  get maxCustomers(): number {
    return getDynamicMaxCustomers(this._getUnlockedLines());
  }

  update(dt: number): void {
    if (!this._started) return;

    if (this._customers.length < this.maxCustomers) {
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
    customer.settledRegularBonus =
      RegularCustomerManager.isRegularType(customer.typeId) && bonus > 0 ? bonus : undefined;
    const finalHuayuan = Math.round(customer.huayuanReward * (1 + bonus));
    CurrencyManager.addHuayuan(finalHuayuan);

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
    let maxPlantToolLevel = 0;
    let maxArrangeToolLevel = 0;
    let maxDrinkToolLevel = 0;
    let hasBouquet = false;
    let hasGreen = false;
    let hasDrink = false;
    const drinkLinesOnBoard = new Set<string>();

    for (const c of BoardManager.cells) {
      if (c.state !== CellState.OPEN || !c.itemId) continue;

      if (c.itemId === 'flower_wrap_4') {
        hasBouquet = true;
        continue;
      }

      const def = TOOL_DEFS.get(c.itemId);
      if (!def) continue;

      if (def.toolLine === ToolLine.PLANT) {
        maxPlantToolLevel = Math.max(maxPlantToolLevel, def.level);
        if (def.canProduce) hasGreen = true;
      } else if (def.toolLine === ToolLine.ARRANGE) {
        maxArrangeToolLevel = Math.max(maxArrangeToolLevel, def.level);
        if (def.level >= 3) hasBouquet = true;
      } else if (def.produceCategory === Category.DRINK && def.canProduce) {
        hasDrink = true;
        maxDrinkToolLevel = Math.max(maxDrinkToolLevel, def.level);
        drinkLinesOnBoard.add(def.produceLine);
      }
    }

    let unlockedLineCount = 0;
    if (hasBouquet) unlockedLineCount++;
    if (hasGreen) unlockedLineCount++;
    unlockedLineCount += drinkLinesOnBoard.size;

    return {
      hasBouquet, hasGreen, hasDrink,
      maxPlantToolLevel, maxArrangeToolLevel, maxDrinkToolLevel,
      unlockedLineCount,
    };
  }

  // ---------- 产线过滤 ----------

  private _eligibleFlowerLines(demandLines: readonly string[], ulk: UnlockedLines): string[] {
    return demandLines.filter(line => {
      if (line === FlowerLine.BOUQUET) return ulk.hasBouquet;
      if (line === FlowerLine.GREEN) return ulk.hasGreen;
      return true;
    });
  }

  private _eligibleDemandLines(demandDef: CustomerDemandDef, ulk: UnlockedLines): string[] {
    if (demandDef.category === Category.DRINK) {
      if (!ulk.hasDrink) return [];
      return [...demandDef.lines];
    }
    if (demandDef.category === Category.FLOWER) {
      return this._eligibleFlowerLines(demandDef.lines, ulk);
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
      t.tiers.includes(tier) && this._isTypeAvailableForTier(t.id, tier, lines),
    );
    if (pool.length === 0) return;

    const type = pool[Math.floor(Math.random() * pool.length)];
    const slots = this._generateDemands(tierDef.demandPool, tierDef.slotRange, lines);
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
      tier,
      orderType: tierDef.orderType,
      timeLimit: tierDef.timeLimit,
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
  private _isTypeAvailableForTier(_typeId: string, tier: OrderTier, ulk: UnlockedLines): boolean {
    const tierDef = ORDER_TIERS[tier];
    const hasDrinkInPool = tierDef.demandPool.some(d => d.category === Category.DRINK);
    if (hasDrinkInPool && !ulk.hasDrink) {
      const hasFlowerOnly = tierDef.demandPool.some(d => d.category === Category.FLOWER);
      if (!hasFlowerOnly) return false;
    }
    return true;
  }

  /**
   * 根据需求品类 + 产品线，查棋盘上对应工具等级 → 推算订单可要求的物品等级上限。
   * 游戏核心是合成，工具等级越高 → 订单可出越高级的物品（玩家多合成几次即可达到）。
   */
  private _getEffectiveMaxLevelForLine(category: Category, line: string, lines: UnlockedLines): number {
    let toolLevel = 0;
    if (category === Category.FLOWER) {
      if (line === FlowerLine.FRESH || line === FlowerLine.GREEN) {
        toolLevel = lines.maxPlantToolLevel;
      } else if (line === FlowerLine.BOUQUET) {
        toolLevel = Math.max(lines.maxArrangeToolLevel, lines.maxPlantToolLevel);
      }
    } else if (category === Category.DRINK) {
      toolLevel = lines.maxDrinkToolLevel;
    }
    const maxItemLevel = (category === Category.DRINK) ? 8 : 10;
    return getEffectiveMaxLevel(toolLevel, maxItemLevel);
  }

  /** 从档位的 demandPool 和 slotRange 生成具体需求（levelRange 根据工具等级动态提升） */
  private _generateDemands(
    demandPool: CustomerDemandDef[],
    slotRange: [number, number],
    lines: UnlockedLines,
  ): DemandSlot[] {
    const [minSlots, maxSlots] = slotRange;
    const slotCount = minSlots + Math.floor(Math.random() * (maxSlots - minSlots + 1));
    const slots: DemandSlot[] = [];

    for (let i = 0; i < slotCount; i++) {
      const demandDef = demandPool[i % demandPool.length];
      const eligibleLines = this._eligibleDemandLines(demandDef, lines);
      if (eligibleLines.length === 0) {
        if (demandPool.length > 1) continue;
        return [];
      }

      const [minLv, tierMaxLv] = demandDef.levelRange;
      let itemId: string | null = null;
      for (let attempt = 0; attempt < 16; attempt++) {
        const line = eligibleLines[Math.floor(Math.random() * eligibleLines.length)];
        const effectiveMax = Math.max(tierMaxLv, this._getEffectiveMaxLevelForLine(demandDef.category, line, lines));
        const range = effectiveMax - minLv + 1;
        const level = minLv + Math.floor(Math.pow(Math.random(), 1.4) * range);
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

    const activeCount = Math.min(this._customers.length, this.maxCustomers);
    for (let ci = 0; ci < activeCount; ci++) {
      const cust = this._customers[ci];
      /** 仅同一客人多槽时互斥：不能两格需求指向棋盘同一格；不同客人可共用盘上同一物品 */
      const usedCellsThisCustomer = new Set<number>();
      for (const slot of cust.slots) {
        let bestIndex = -1;

        for (const cell of BoardManager.cells) {
          if (cell.state !== 'open' || !cell.itemId) continue;
          if (usedCellsThisCustomer.has(cell.index)) continue;
          if (cell.itemId !== slot.itemId) continue;
          bestIndex = cell.index;
          break;
        }

        if (bestIndex >= 0) {
          const cell = BoardManager.getCellByIndex(bestIndex)!;
          cell.reserved = true;
          slot.lockedCellIndex = bestIndex;
          usedCellsThisCustomer.add(bestIndex);
        }
      }

      cust.allSatisfied = cust.slots.every(s => s.lockedCellIndex >= 0);
    }

    EventBus.emit('customer:lockChanged');
  }
}

export const CustomerManager = new CustomerManagerClass();
