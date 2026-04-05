/**
 * 客人管理器 - 客人刷新、需求生成、自动锁定棋盘物品、交付结算
 *
 * 需求由 OrderGeneratorRegistry + OrderTierConfig 模板档驱动；角标 tier 由槽位物品内容统一计算（computeTierFromOrderSlots）。
 */
import { EventBus } from '@/core/EventBus';
import { BoardManager } from './BoardManager';
import { CurrencyManager } from './CurrencyManager';
import { LevelManager } from './LevelManager';
import {
  CHALLENGE_ORDER_HUAYUAN_MULT,
  MULTI_SLOT_BONUS_RATE,
  SINGLE_SLOT_MERGE_PARITY_FACTOR,
} from '@/config/OrderHuayuanConfig';
import { CUSTOMER_TYPES } from '@/config/CustomerConfig';
import { Category, ITEM_DEFS, findItemId } from '@/config/ItemConfig';
import {
  ORDER_TIERS,
  computeTierFromOrderSlots,
  getOrderTierWeights,
  getDynamicMaxCustomers,
  pickTierByWeight,
  type OrderTier,
  type OrderType,
  type UnlockedLines,
} from '@/config/OrderTierConfig';
import { CUSTOMER_REFRESH_MIN, CUSTOMER_REFRESH_MAX } from '@/config/Constants';
import { ORDER_SPAWN_VALIDATE_MAX_ATTEMPTS } from '@/config/OrderSpawnConfig';
import { computeUnlockedLines } from '@/orders/unlockedLines';
import {
  generateOrderDemands,
  validateOrderSlotsToolCap,
} from '@/orders/OrderGeneratorRegistry';
import type { OrderGenResult, OrderGenerationKind } from '@/orders/types';

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
  /** 生成语义：基础 / 成长 / 组合（与角标 tier 独立） */
  orderKind: OrderGenerationKind;
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
  /** 缺省时读档按 orderType + bonusMultiplier 推断 */
  orderKind?: OrderGenerationKind;
}

export interface CustomerPersistState {
  list: CustomerSaveEntry[];
  nextUid: number;
  refreshTimer: number;
}

const VALID_ORDER_TYPES = new Set<OrderType>(['normal', 'timed', 'chain', 'challenge']);

const VALID_ORDER_KINDS = new Set<OrderGenerationKind>(['basic', 'growth', 'combo', 'eventStub']);

const GREEN_PITY_THRESHOLD = 3;
const GREEN_UNLOCK_BOOST_SPAWNS = 5;

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

    const contentTier = computeTierFromOrderSlots(slots.map(s => s.itemId));
    const tier = contentTier;
    const orderType = VALID_ORDER_TYPES.has(r.orderType as OrderType)
      ? (r.orderType as OrderType)
      : 'normal';
    const bonusMultiplier =
      typeof r.bonusMultiplier === 'number' && Number.isFinite(r.bonusMultiplier)
        ? r.bonusMultiplier
        : undefined;
    const rawKind = r.orderKind;
    const orderKind: OrderGenerationKind =
      typeof rawKind === 'string' && VALID_ORDER_KINDS.has(rawKind as OrderGenerationKind)
        ? (rawKind as OrderGenerationKind)
        : inferOrderKindFromLegacy({ orderType, bonusMultiplier });
    const huayuanReward =
      typeof r.huayuanReward === 'number' && Number.isFinite(r.huayuanReward) && r.huayuanReward >= 0
        ? Math.floor(r.huayuanReward)
        : CustomerManagerClass.computeOrderHuayuan(slots, bonusMultiplier, orderType);
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
      bonusMultiplier,
      orderKind,
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

function inferOrderKindFromLegacy(entry: {
  orderType: OrderType;
  bonusMultiplier?: number;
}): OrderGenerationKind {
  if (entry.orderType === 'challenge') return 'combo';
  if (entry.bonusMultiplier && entry.bonusMultiplier > 1) return 'growth';
  return 'basic';
}

class CustomerManagerClass {
  private _customers: CustomerInstance[] = [];
  private _refreshTimer = 0;
  private _nextUid = 1;
  private _started = false;
  /** SaveManager.load 在 MainScene 初始化前写入；init() 消费后清空 */
  private _preparedFromSave: CustomerPersistState | null = null;
  /** 解锁绿植后若干次刷单的档位偏置 */
  private _greenLineUnlockBoostSpawns = 0;
  /** 上一帧棋盘产线快照（用于检测解锁） */
  private _unlockSnapshot: UnlockedLines | null = null;
  /** 已解锁绿植但连续多单一株绿植都不要时的保底计数 */
  private _spawnsWithoutGreenDemand = 0;

  get customers(): readonly CustomerInstance[] {
    return this._customers;
  }

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
        orderKind: c.orderKind,
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
        huayuanReward: CustomerManagerClass.computeOrderHuayuan(e.slots, e.bonusMultiplier, e.orderType),
        tier: computeTierFromOrderSlots(e.slots.map(s => s.itemId)),
        orderType: e.orderType,
        timeLimit: e.timeLimit,
        chainIndex: e.chainIndex,
        bonusMultiplier: e.bonusMultiplier,
        orderKind: e.orderKind ?? inferOrderKindFromLegacy(e),
      }));
      this._nextUid = p.nextUid;
      this._refreshTimer = p.refreshTimer;
      const maxCap = getDynamicMaxCustomers(computeUnlockedLines(BoardManager.cells));
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

  get maxCustomers(): number {
    return getDynamicMaxCustomers(computeUnlockedLines(BoardManager.cells));
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

  /**
   * 订单花愿 = ΣorderHuayuan×(1+多槽加成) → 单槽合成软保底 → 成长倍率 → 组合单倍率。
   * 读档缺 huayuanReward 时与新生成共用本函数。
   */
  static computeOrderHuayuan(
    slots: { itemId: string }[],
    bonusMultiplier?: number,
    orderType?: OrderType,
  ): number {
    let sum = 0;
    for (const s of slots) {
      sum += ITEM_DEFS.get(s.itemId)?.orderHuayuan ?? 0;
    }
    const n = slots.length;
    if (n <= 0) return 0;
    let base = Math.max(1, Math.round(sum * (1 + MULTI_SLOT_BONUS_RATE * (n - 1))));
    base = CustomerManagerClass._applySingleSlotMergeParityFloor(slots, base);
    if (bonusMultiplier && bonusMultiplier > 0 && bonusMultiplier !== 1) {
      base = Math.max(1, Math.round(base * bonusMultiplier));
    }
    if (orderType === 'challenge') {
      base = Math.max(1, Math.round(base * CHALLENGE_ORDER_HUAYUAN_MULT));
    }
    return base;
  }

  /** 单槽 FLOWER/DRINK：不低于 0.9×2×H(L−1)，避免相对「两单 L−1」过亏 */
  private static _applySingleSlotMergeParityFloor(
    slots: { itemId: string }[],
    preliminaryBase: number,
  ): number {
    if (slots.length !== 1) return preliminaryBase;
    const def = ITEM_DEFS.get(slots[0]!.itemId);
    if (!def?.orderHuayuan || def.level <= 1) return preliminaryBase;
    if (def.category !== Category.FLOWER && def.category !== Category.DRINK) {
      return preliminaryBase;
    }
    const prevId = findItemId(def.category, def.line, def.level - 1);
    const prevHy = prevId ? ITEM_DEFS.get(prevId)?.orderHuayuan : undefined;
    if (prevHy === undefined || prevHy < 1) return preliminaryBase;
    const floor = Math.round(SINGLE_SLOT_MERGE_PARITY_FACTOR * 2 * prevHy);
    return Math.max(preliminaryBase, floor);
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

    const hy = customer.huayuanReward;
    CurrencyManager.addHuayuan(hy);

    console.log(`[Customer] 交付完成: ${customer.name}(${customer.tier}), 花愿+${hy}`);

    this._customers.splice(idx, 1);
    EventBus.emit('customer:delivered', uid, customer);

    this._rescanAll();
    return true;
  }

  /**
   * 撕单：移除该客人且无交付奖励（供后续 UI/消耗接入；当前无扣费）。
   */
  ditchCustomerOrder(uid: number): boolean {
    if (!this._started) return false;
    const idx = this._customers.findIndex(c => c.uid === uid);
    if (idx < 0) return false;
    const [removed] = this._customers.splice(idx, 1);
    if (!removed) return false;
    EventBus.emit('customer:ditched', uid, removed);
    this._rescanAll();
    return true;
  }

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

  private _spawnCustomer(): void {
    const level = LevelManager.level;
    const lines = computeUnlockedLines(BoardManager.cells);
    const weights = getOrderTierWeights(level, lines, {
      greenLineUnlockBoostSpawns: this._greenLineUnlockBoostSpawns,
    });

    const tier = pickTierByWeight(weights);
    const pool = CUSTOMER_TYPES.filter(t =>
      t.tiers.includes(tier) && this._isTypeAvailableForTier(t.id, tier, lines),
    );
    if (pool.length === 0) return;

    const type = pool[Math.floor(Math.random() * pool.length)]!;
    const forceGreen =
      lines.hasGreen &&
      this._spawnsWithoutGreenDemand >= GREEN_PITY_THRESHOLD;

    let gen: OrderGenResult | null = null;
    for (let attempt = 0; attempt < ORDER_SPAWN_VALIDATE_MAX_ATTEMPTS; attempt++) {
      const g = generateOrderDemands({
        tier,
        lines,
        playerLevel: level,
        forceGreenFlowerSlot: forceGreen,
        rng: Math.random,
      });
      if (!g || g.slots.length === 0) continue;
      if (!validateOrderSlotsToolCap(g.slots, lines)) continue;
      gen = g;
      break;
    }
    if (!gen || gen.slots.length === 0) return;

    const slots: DemandSlot[] = gen.slots.map(s => ({
      itemId: s.itemId,
      lockedCellIndex: -1,
    }));

    const huayuan = CustomerManagerClass.computeOrderHuayuan(
      slots,
      gen.bonusMultiplier,
      gen.orderType,
    );

    const contentTier = computeTierFromOrderSlots(slots.map(s => s.itemId));

    const customer: CustomerInstance = {
      uid: this._nextUid++,
      typeId: type.id,
      name: type.name,
      emoji: type.emoji,
      slots,
      allSatisfied: false,
      huayuanReward: huayuan,
      tier: contentTier,
      orderType: gen.orderType,
      timeLimit: gen.timeLimit,
      bonusMultiplier: gen.bonusMultiplier,
      orderKind: gen.generationKind,
    };

    if (lines.hasGreen) {
      const hasGreenItem = slots.some(s => s.itemId.startsWith('flower_green_'));
      if (hasGreenItem) this._spawnsWithoutGreenDemand = 0;
      else this._spawnsWithoutGreenDemand++;
    }

    this._customers.push(customer);
    if (this._greenLineUnlockBoostSpawns > 0) {
      this._greenLineUnlockBoostSpawns--;
    }
    console.log(
      `[Customer] 新客人: ${customer.name}(${customer.emoji}) [${contentTier}] (tpl ${tier}) ${customer.orderKind}, 需求: ${customer.slots.map(s => s.itemId).join(', ')}`,
    );
    EventBus.emit('customer:arrived', customer);

    this._rescanAll();
  }

  private _isTypeAvailableForTier(_typeId: string, tier: OrderTier, ulk: UnlockedLines): boolean {
    const tierDef = ORDER_TIERS[tier];
    const hasDrinkInPool = tierDef.demandPool.some(d => d.category === Category.DRINK);
    if (hasDrinkInPool && !ulk.hasDrink) {
      const hasFlowerOnly = tierDef.demandPool.some(d => d.category === Category.FLOWER);
      if (!hasFlowerOnly) return false;
    }
    return true;
  }

  private _rescanAll(): void {
    const prevSnap = this._unlockSnapshot;
    const nextLines = computeUnlockedLines(BoardManager.cells);
    if (this._started && prevSnap && !prevSnap.hasGreen && nextLines.hasGreen) {
      this._greenLineUnlockBoostSpawns = GREEN_UNLOCK_BOOST_SPAWNS;
      this._refreshTimer = Math.min(this._refreshTimer, 2);
    }
    this._unlockSnapshot = nextLines;

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
