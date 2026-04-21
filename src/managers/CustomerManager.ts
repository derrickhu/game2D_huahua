/**
 * 客人管理器 - 客人刷新、需求生成、自动锁定棋盘物品、交付结算
 *
 * 需求由 OrderGeneratorRegistry + OrderTierConfig 模板档驱动；角标 tier 由槽位物品内容统一计算（computeTierFromOrderSlots）。
 */
import { EventBus } from '@/core/EventBus';
import { BoardManager } from './BoardManager';
import { CurrencyManager } from './CurrencyManager';
import { LevelManager } from './LevelManager';
import { TutorialManager, TutorialStep } from './TutorialManager';
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
import { ORDER_SPAWN_MAX_ATTEMPTS } from '@/config/OrderSpawnConfig';
import { computeUnlockedLines } from '@/orders/unlockedLines';
import {
  generateOrderDemands,
  validateOrderSlotsToolCap,
} from '@/orders/OrderGeneratorRegistry';
import type { OrderGenResult, OrderGenerationKind, OrderPreferLine } from '@/orders/types';
import { AffinityManager } from './AffinityManager';
import {
  EXCLUSIVE_ORDER_BONUS,
  EXCLUSIVE_ORDER_HUAYUAN_MULTIPLIER,
} from '@/config/AffinityConfig';
import { FlowerSignTicketManager } from './FlowerSignTicketManager';

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
  /** 熟客专属订单标记：交付时按 EXCLUSIVE_ORDER_HUAYUAN_MULTIPLIER 加成 + 必给体力/许愿币 */
  isExclusive?: boolean;
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
  /** 熟客专属订单（持久化，避免 reload 后丢失加成） */
  isExclusive?: boolean;
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
      isExclusive: r.isExclusive === true ? true : undefined,
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

/** 与上一单需求去重：槽位无序，同 multiset 视为相同 */
function orderSlotsFingerprint(slots: readonly { itemId: string }[]): string {
  return [...slots.map(s => s.itemId)].sort().join('|');
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
  /** 上一刷客人的 typeId，用于避免连续同人设（池子 >1 时） */
  private _lastSpawnTypeId: string | null = null;
  /** 上一刷订单需求 fingerprint，用于避免连续完全相同需求 */
  private _lastOrderFingerprint: string | null = null;

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
        isExclusive: c.isExclusive,
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
        isExclusive: e.isExclusive === true ? true : undefined,
      }));
      this._nextUid = p.nextUid;
      this._refreshTimer = p.refreshTimer;
      const maxCap = getDynamicMaxCustomers(LevelManager.level);
      if (this._customers.length > maxCap) {
        this._customers = this._customers.slice(0, maxCap);
        console.warn(`[Customer] 读档客人超过当前上限 ${maxCap}，已截断`);
      }
    } else {
      this._customers = [];
      this._nextUid = 1;
      this._refreshTimer = CUSTOMER_REFRESH_MAX - 3;
    }

    this._syncAntiRepeatFromQueueTail();
    this._bindBoardEvents();
    this._rescanAll();
  }

  /**
   * 读档或初始化后：用「uid 最大」的客人同步去重状态（最近一单），避免首刷立刻撞脸上一会话最后一单。
   * 队列会因可完成订单前置而重排，不能再用数组末尾。
   */
  private _syncAntiRepeatFromQueueTail(): void {
    if (this._customers.length === 0) {
      this._lastSpawnTypeId = null;
      this._lastOrderFingerprint = null;
      return;
    }
    const latest = this._customers.reduce((a, b) => (a.uid >= b.uid ? a : b));
    this._lastSpawnTypeId = latest.typeId;
    this._lastOrderFingerprint = orderSlotsFingerprint(latest.slots);
  }

  get maxCustomers(): number {
    return getDynamicMaxCustomers(LevelManager.level);
  }

  update(dt: number): void {
    if (!this._started) return;

    // 教程期间限制最多 1 位客人
    const maxC = TutorialManager.isActive ? 1 : this.maxCustomers;
    if (this._customers.length < maxC) {
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

    // 即时为本客人查找可用格子（因 allSatisfied 不再独占锁格，
    // 部分 slot 的 lockedCellIndex 可能为 -1）
    const usedCells = new Set<number>();
    for (const slot of customer.slots) {
      if (slot.lockedCellIndex >= 0) {
        usedCells.add(slot.lockedCellIndex);
        continue;
      }
      for (const cell of BoardManager.cells) {
        if (cell.state !== 'open' || !cell.itemId) continue;
        if (usedCells.has(cell.index)) continue;
        if (cell.itemId !== slot.itemId) continue;
        slot.lockedCellIndex = cell.index;
        usedCells.add(cell.index);
        break;
      }
    }
    if (!customer.slots.every(s => s.lockedCellIndex >= 0)) return false;

    for (const slot of customer.slots) {
      BoardManager.removeItem(slot.lockedCellIndex);
    }

    const hy = customer.huayuanReward;
    CurrencyManager.addHuayuan(hy);

    // 熟客专属订单的额外随礼（必给 5 体力 + 1 许愿币）
    if (customer.isExclusive) {
      if (EXCLUSIVE_ORDER_BONUS.stamina > 0) {
        CurrencyManager.addStamina(EXCLUSIVE_ORDER_BONUS.stamina);
      }
      if (EXCLUSIVE_ORDER_BONUS.flowerSignTickets > 0) {
        FlowerSignTicketManager.add(EXCLUSIVE_ORDER_BONUS.flowerSignTickets);
      }
    }

    // 熟客 Bond 累计：普通单 +1 / 专属单 +2，且发放里程碑奖励
    if (AffinityManager.isAffinityType(customer.typeId)) {
      AffinityManager.onCustomerDelivered(customer.typeId, {
        isExclusive: !!customer.isExclusive,
      });
    }

    console.log(
      `[Customer] 交付完成: ${customer.name}(${customer.tier})${customer.isExclusive ? '[熟客专属]' : ''}, 花愿+${hy}`,
    );

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
    EventBus.on('star:levelUp', rescan);
  }

  private _spawnCustomer(): void {
    const level = LevelManager.level;
    const lines = computeUnlockedLines(BoardManager.cells);
    const weights = getOrderTierWeights(level, lines, {
      greenLineUnlockBoostSpawns: this._greenLineUnlockBoostSpawns,
    });

    const tier = pickTierByWeight(weights);

    // 熟客专属订单优先掷骰：命中后强制使用该熟客 typeId + 软偏好 lines；
    // 若该 typeId 不在当前 tier 的可用池里，仍允许出（熟客不受 tier 限制，已解锁即可上单）。
    const exclusiveRoll = AffinityManager.rollExclusiveCustomer({
      playerLevel: level,
      lastSpawnTypeId: this._lastSpawnTypeId,
    });
    let preferLines: OrderPreferLine[] | undefined;
    let isExclusive = false;
    let forcedTypeId: string | null = null;
    if (exclusiveRoll) {
      forcedTypeId = exclusiveRoll.typeId;
      preferLines = exclusiveRoll.preferLines.map(p => ({
        category: p.category,
        line: p.line,
        weight: p.weight,
      }));
      isExclusive = true;
    }

    const pool = CUSTOMER_TYPES.filter(t =>
      t.tiers.includes(tier) && this._isTypeAvailableForTier(t.id, tier, lines),
    );
    if (pool.length === 0 && !forcedTypeId) return;

    let type;
    if (forcedTypeId) {
      type = CUSTOMER_TYPES.find(t => t.id === forcedTypeId);
      if (!type) {
        // 防御：熟客 typeId 在 CustomerConfig 不存在 → 回退普通刷
        forcedTypeId = null;
        isExclusive = false;
        preferLines = undefined;
      }
    }
    if (!type) {
      let typePool = pool;
      if (this._lastSpawnTypeId && pool.length > 1) {
        const avoid = pool.filter(t => t.id !== this._lastSpawnTypeId);
        if (avoid.length > 0) typePool = avoid;
      }
      type = typePool[Math.floor(Math.random() * typePool.length)]!;
    }
    const forceGreen =
      lines.hasGreen &&
      this._spawnsWithoutGreenDemand >= GREEN_PITY_THRESHOLD;

    let gen: OrderGenResult | null = null;
    let fallbackGen: OrderGenResult | null = null;
    for (let attempt = 0; attempt < ORDER_SPAWN_MAX_ATTEMPTS; attempt++) {
      const g = generateOrderDemands({
        tier,
        lines,
        playerLevel: level,
        forceGreenFlowerSlot: forceGreen,
        rng: Math.random,
        preferLines,
        isExclusive: isExclusive ? true : undefined,
      });
      if (!g || g.slots.length === 0) continue;
      if (!validateOrderSlotsToolCap(g.slots, lines)) continue;
      fallbackGen = g;
      const fp = orderSlotsFingerprint(g.slots);
      if (!this._lastOrderFingerprint || fp !== this._lastOrderFingerprint) {
        gen = g;
        break;
      }
    }
    if (!gen) gen = fallbackGen;
    if (!gen || gen.slots.length === 0) return;

    const slots: DemandSlot[] = gen.slots.map(s => ({
      itemId: s.itemId,
      lockedCellIndex: -1,
    }));

    const exclusive = isExclusive || gen.isExclusive === true;
    // 熟客专属订单：在 base 算完后再乘上 EXCLUSIVE 倍率（不进 computeOrderHuayuan，避免污染读档路径）
    let huayuan = CustomerManagerClass.computeOrderHuayuan(
      slots,
      gen.bonusMultiplier,
      gen.orderType,
    );
    if (exclusive) {
      huayuan = Math.max(1, Math.round(huayuan * EXCLUSIVE_ORDER_HUAYUAN_MULTIPLIER));
    } else if (AffinityManager.huayuanMultFor(type.id) !== 1) {
      // Bond Lv5 软 buff（仅普通单）
      huayuan = Math.max(1, Math.round(huayuan * AffinityManager.huayuanMultFor(type.id)));
    }

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
      isExclusive: exclusive ? true : undefined,
    };

    if (lines.hasGreen) {
      const hasGreenItem = slots.some(s => s.itemId.startsWith('flower_green_'));
      if (hasGreenItem) this._spawnsWithoutGreenDemand = 0;
      else this._spawnsWithoutGreenDemand++;
    }

    this._lastSpawnTypeId = type.id;
    this._lastOrderFingerprint = orderSlotsFingerprint(slots);

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

  /**
   * 教程专用：清空当前所有客人队列，防止随机客人干扰脚本流程。
   */
  clearAllCustomers(): void {
    for (const c of this._customers) {
      for (const s of c.slots) {
        if (s.lockedCellIndex >= 0) {
          const cell = BoardManager.getCellByIndex(s.lockedCellIndex);
          if (cell) cell.reserved = false;
        }
      }
    }
    this._customers = [];
    EventBus.emit('customer:lockChanged');
  }

  /**
   * 教程专用：清空已有客人后插入一个固定订单的客人。
   * @param itemIds 订单槽物品 ID 列表，如 ['flower_fresh_1']
   * @param typeId  客人类型 ID，默认 'child'
   */
  spawnScriptedCustomer(itemIds: string[], typeId = 'child'): void {
    this.clearAllCustomers();
    const type = CUSTOMER_TYPES.find(t => t.id === typeId) ?? CUSTOMER_TYPES[0];
    const slots: DemandSlot[] = itemIds.map(id => ({ itemId: id, lockedCellIndex: -1 }));
    const huayuan = CustomerManagerClass.computeOrderHuayuan(slots, 1, 'normal');

    const customer: CustomerInstance = {
      uid: this._nextUid++,
      typeId: type.id,
      name: type.name,
      emoji: type.emoji,
      slots,
      allSatisfied: false,
      huayuanReward: huayuan,
      tier: computeTierFromOrderSlots(itemIds) as OrderTier,
      orderType: 'normal' as OrderType,
      timeLimit: null,
      bonusMultiplier: 1,
      orderKind: 'eventStub',
    };

    this._customers.push(customer);
    console.log(`[Customer] 教程客人: ${customer.name} 需求: ${itemIds.join(', ')}`);
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

    // 先抹掉全棋盘 reserved：`moveItem`/`swap` 会复制 reserved，若与槽位索引短暂脱节，
    // 仅靠「按槽位清格」会留下幽灵 true → 格子上对钩但没有任何订单槽绑定该格。
    for (const cell of BoardManager.cells) {
      cell.reserved = false;
    }

    for (const cust of this._customers) {
      for (const slot of cust.slots) {
        slot.lockedCellIndex = -1;
      }
      cust.allSatisfied = false;
    }

    const activeCount = Math.min(this._customers.length, this.maxCustomers);

    // 第一遍：独占锁格，用于棋盘格 reserved 高亮（仅第一位匹配的客人占格）
    const globallyUsedCells = new Set<number>();
    for (let ci = 0; ci < activeCount; ci++) {
      const cust = this._customers[ci];
      const usedCellsThisCustomer = new Set<number>();
      for (const slot of cust.slots) {
        let bestIndex = -1;

        for (const cell of BoardManager.cells) {
          if (cell.state !== 'open' || !cell.itemId) continue;
          if (globallyUsedCells.has(cell.index)) continue;
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
          globallyUsedCells.add(bestIndex);
        }
      }
    }

    // 第二遍：独立判定每位客人能否完成（不互斥），
    // 允许多位客人同时显示「完成」按钮，由玩家决定提交哪个。
    for (let ci = 0; ci < activeCount; ci++) {
      const cust = this._customers[ci];
      const usedCells = new Set<number>();
      let satisfied = true;
      for (const slot of cust.slots) {
        let found = false;
        for (const cell of BoardManager.cells) {
          if (cell.state !== 'open' || !cell.itemId) continue;
          if (usedCells.has(cell.index)) continue;
          if (cell.itemId !== slot.itemId) continue;
          usedCells.add(cell.index);
          found = true;
          break;
        }
        if (!found) { satisfied = false; break; }
      }
      cust.allSatisfied = satisfied;
    }

    const queueOrderChanged = this._prioritizeReadyCustomers();
    EventBus.emit('customer:lockChanged');
    if (queueOrderChanged) {
      EventBus.emit('customer:queueReordered');
    }
  }

  /**
   * 已可点「完成」的客人排到队首（稳定排序：同组内保持原相对顺序）。
   * @returns 队列顺序是否相对调用前发生变化
   */
  private _prioritizeReadyCustomers(): boolean {
    const list = this._customers;
    if (list.length <= 1) return false;
    const before = list.map(c => c.uid);
    list.sort((a, b) => {
      if (a.allSatisfied === b.allSatisfied) return 0;
      return a.allSatisfied ? -1 : 1;
    });
    const after = list.map(c => c.uid);
    return before.some((uid, i) => uid !== after[i]);
  }
}

export const CustomerManager = new CustomerManagerClass();
