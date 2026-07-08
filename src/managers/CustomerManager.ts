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
  ORDER_TIER_HUAYUAN_MULT,
  SINGLE_SLOT_MERGE_PARITY_FACTOR,
} from '@/config/OrderHuayuanConfig';
import {
  getEventOrderStoneChance,
  rollEventOrderStoneAmount,
  isJewelryEventUnlocked,
} from '@/config/EventBoardConfig';
import { CUSTOMER_TYPES, CUSTOMER_TYPE_MAP, type CustomerTypeDef } from '@/config/CustomerConfig';
import { Category, ITEM_DEFS, findItemId } from '@/config/ItemConfig';
import {
  computeTierFromOrderSlots,
  getOrderTierWeights,
  getDynamicMaxCustomers,
  pickTierByWeight,
  type OrderTier,
  type OrderType,
} from '@/config/OrderTierConfig';
import {
  ORDER_SPAWN_MAX_ATTEMPTS,
  TIMED_DIAMOND_ORDER_DAILY_CAP,
  TIMED_DIAMOND_ORDER_MIN_PLAYER_LEVEL,
  TIMED_FLORIST_ORDER_DAILY_CAP,
  TIMED_FLORIST_ORDER_MIN_PLAYER_LEVEL,
  WORKSHOP_ORDER_DAILY_CAP,
  WORKSHOP_ORDER_MIN_PLAYER_LEVEL,
  computeFloristStaminaChestReward,
  computeTimedDiamondReward,
  getCustomerRefreshInitialDelay,
  getCustomerRefreshTier,
  rollCustomerRefreshInterval,
} from '@/config/OrderSpawnConfig';
import { computeUnlockedLines } from '@/orders/unlockedLines';
import {
  forceGenerateTimedDiamondOrder,
  forceGenerateTimedFloristOrder,
  forceGenerateWorkshopOrder,
  generateOrderDemands,
  validateOrderSlotsToolCap,
} from '@/orders/OrderGeneratorRegistry';
import { RewardBoxManager } from './RewardBoxManager';
import { FurnitureWorkshopManager } from '@/managers/FurnitureWorkshopManager';
import type { OrderGenResult, OrderGenerationKind } from '@/orders/types';
import {
  WORKSHOP_MATERIAL_ID,
  type WorkshopMaterialReward,
} from '@/config/FurnitureWorkshopConfig';
import { AffinityManager } from './AffinityManager';
import { WeekendHuayuanBoostManager } from './WeekendHuayuanBoostManager';

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
  /** 订单原始花愿收益（含订单类型 / 熟客图鉴倍率，不含限时活动额外加成） */
  huayuanReward: number;
  /** 周末广告活动额外花愿；当天 12 点重置后自动归零 */
  weekendHuayuanBonus?: number;
  tier: OrderTier;
  orderType: OrderType;
  timeLimit: number | null;
  /** 限时钻石单额外奖励；普通订单为 0/undefined */
  diamondReward?: number;
  /** 富贵花商限时单：体力箱奖励 itemId */
  staminaChestReward?: string;
  /** 家具工坊特殊订单：交付后进入工坊材料库存 */
  workshopMaterialRewards?: WorkshopMaterialReward[];
  /** 首饰活动原石奖励：命中的普通订单额外送 1 原石（生成时决定并展示） */
  eventStoneReward?: number;
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
  weekendHuayuanBonus?: number;
  tier: OrderTier;
  orderType: OrderType;
  timeLimit: number | null;
  diamondReward?: number;
  staminaChestReward?: string;
  workshopMaterialRewards?: WorkshopMaterialReward[];
  eventStoneReward?: number;
  chainIndex?: number;
  bonusMultiplier?: number;
  /** 缺省时读档按 orderType + bonusMultiplier 推断 */
  orderKind?: OrderGenerationKind;
}

export interface CustomerPersistState {
  list: CustomerSaveEntry[];
  nextUid: number;
  refreshTimer: number;
  timedDiamondOrderDate?: string;
  timedDiamondOrdersToday?: number;
  timedFloristOrderDate?: string;
  timedFloristOrdersToday?: number;
  workshopOrderDate?: string;
  workshopOrdersToday?: number;
}

const VALID_ORDER_TYPES = new Set<OrderType>(['normal', 'timed', 'chain', 'challenge']);

const VALID_ORDER_KINDS = new Set<OrderGenerationKind>([
  'basic',
  'combo',
  'timedDiamond',
  'timedFlorist',
  'timedWorkshop',
  'eventStub',
]);

const RECENT_CUSTOMER_AVOID_N = 4;

function localDateKey(ts = Date.now()): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const WORKSHOP_REWARD_MATERIAL_IDS = new Set([
  WORKSHOP_MATERIAL_ID,
  'workshop_wood',
  'workshop_fabric',
  'workshop_metal',
  'workshop_stardust',
  'workshop_dye',
  'workshop_dye_pink',
  'workshop_dye_yellow',
  'workshop_dye_blue',
  'workshop_dye_green',
  'dye_moon_blue',
  'dye_sakura_pink',
]);

function normalizeWorkshopMaterialRewards(raw: unknown): WorkshopMaterialReward[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const rewards: WorkshopMaterialReward[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const materialId = typeof r.materialId === 'string' ? r.materialId : '';
    const count = typeof r.count === 'number' && Number.isFinite(r.count) ? Math.floor(r.count) : 0;
    if (count > 0 && WORKSHOP_REWARD_MATERIAL_IDS.has(materialId)) {
      rewards.push({ materialId, count });
    }
  }
  return rewards.length > 0 ? rewards : undefined;
}

function normalizeCustomerPersistState(raw: unknown): CustomerPersistState | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const listRaw = o.list;
  const rows = Array.isArray(listRaw) ? listRaw : [];

  const list: CustomerSaveEntry[] = [];
  for (const row of rows) {
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

    const contentTier = computeTierFromOrderSlots(slots.map(s => s.itemId), LevelManager.level);
    const tier = contentTier;
    const orderType = VALID_ORDER_TYPES.has(r.orderType as OrderType)
      ? (r.orderType as OrderType)
      : 'normal';
    let bonusMultiplier =
      typeof r.bonusMultiplier === 'number' && Number.isFinite(r.bonusMultiplier)
        ? r.bonusMultiplier
        : undefined;
    const rawKind = r.orderKind;
    let orderKind: OrderGenerationKind =
      typeof rawKind === 'string' && VALID_ORDER_KINDS.has(rawKind as OrderGenerationKind)
        ? (rawKind as OrderGenerationKind)
        : inferOrderKindFromLegacy({ orderType, bonusMultiplier });
    /** 成长单已下线：读档归并为基础单，重算花愿（勿沿用旧 bonusMultiplier / 缓存高额） */
    const legacyGrowth =
      rawKind === 'growth'
      || (orderType === 'normal' && bonusMultiplier !== undefined && bonusMultiplier > 1);
    if (legacyGrowth) {
      orderKind = 'basic';
      bonusMultiplier = undefined;
    }
    const computedHuayuanReward = CustomerManagerClass.computeOrderHuayuan(slots, bonusMultiplier, orderType);
    const savedHuayuanReward =
      typeof r.huayuanReward === 'number' && Number.isFinite(r.huayuanReward) && r.huayuanReward >= 0
        ? Math.floor(r.huayuanReward)
        : undefined;
    const huayuanReward =
      legacyGrowth || savedHuayuanReward === undefined
        ? computedHuayuanReward
        : Math.max(savedHuayuanReward, computedHuayuanReward);
    const timeLimit =
      r.timeLimit === null || (typeof r.timeLimit === 'number' && Number.isFinite(r.timeLimit))
        ? (r.timeLimit as number | null)
        : null;
    const diamondReward =
      typeof r.diamondReward === 'number' && Number.isFinite(r.diamondReward) && r.diamondReward > 0
        ? Math.floor(r.diamondReward)
        : orderType === 'timed' && orderKind !== 'timedFlorist'
          ? computeTimedDiamondReward(slots)
          : undefined;
    const staminaChestReward =
      typeof r.staminaChestReward === 'string' && ITEM_DEFS.has(r.staminaChestReward)
        ? r.staminaChestReward
        : orderKind === 'timedFlorist'
          ? computeFloristStaminaChestReward(slots)
          : undefined;
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
      diamondReward,
      staminaChestReward,
      workshopMaterialRewards: normalizeWorkshopMaterialRewards(r.workshopMaterialRewards),
      eventStoneReward:
        typeof r.eventStoneReward === 'number' && r.eventStoneReward > 0
          ? Math.floor(r.eventStoneReward)
          : undefined,
      chainIndex: typeof r.chainIndex === 'number' ? r.chainIndex : undefined,
      bonusMultiplier,
      orderKind,
    });
  }

  const maxUid = list.reduce((m, e) => Math.max(m, e.uid), 0);
  let nextUid =
    typeof o.nextUid === 'number' && o.nextUid >= 1 ? Math.floor(o.nextUid) : maxUid + 1;
  nextUid = Math.max(nextUid, maxUid + 1);

  const refreshTimer =
    typeof o.refreshTimer === 'number' && o.refreshTimer >= 0 && Number.isFinite(o.refreshTimer)
      ? o.refreshTimer
      : getCustomerRefreshInitialDelay(LevelManager.level);

  const timedDiamondOrderDate =
    typeof o.timedDiamondOrderDate === 'string' && o.timedDiamondOrderDate
      ? o.timedDiamondOrderDate
      : localDateKey();
  const timedDiamondOrdersToday =
    typeof o.timedDiamondOrdersToday === 'number' && Number.isFinite(o.timedDiamondOrdersToday)
      ? Math.max(0, Math.floor(o.timedDiamondOrdersToday))
      : 0;

  const timedFloristOrderDate =
    typeof o.timedFloristOrderDate === 'string' && o.timedFloristOrderDate
      ? o.timedFloristOrderDate
      : localDateKey();
  const timedFloristOrdersToday =
    typeof o.timedFloristOrdersToday === 'number' && Number.isFinite(o.timedFloristOrdersToday)
      ? Math.max(0, Math.floor(o.timedFloristOrdersToday))
      : 0;

  const workshopOrderDate =
    typeof o.workshopOrderDate === 'string' && o.workshopOrderDate
      ? o.workshopOrderDate
      : localDateKey();
  const workshopOrdersToday =
    typeof o.workshopOrdersToday === 'number' && Number.isFinite(o.workshopOrdersToday)
      ? Math.max(0, Math.floor(o.workshopOrdersToday))
      : 0;

  return {
    list,
    nextUid,
    refreshTimer,
    timedDiamondOrderDate,
    timedDiamondOrdersToday,
    timedFloristOrderDate,
    timedFloristOrdersToday,
    workshopOrderDate,
    workshopOrdersToday,
  };
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
  if (entry.orderType === 'timed') return 'timedDiamond';
  return 'basic';
}

class CustomerManagerClass {
  private _customers: CustomerInstance[] = [];
  private _refreshTimer = 0;
  private _nextUid = 1;
  private _started = false;
  /** SaveManager.load 在 MainScene 初始化前写入；init() 消费后清空 */
  private _preparedFromSave: CustomerPersistState | null = null;
  private _timedDiamondOrderDate = localDateKey();
  private _timedDiamondOrdersToday = 0;
  private _timedFloristOrderDate = localDateKey();
  private _timedFloristOrdersToday = 0;
  private _workshopOrderDate = localDateKey();
  private _workshopOrdersToday = 0;
  private _preparedOfflineSeconds = 0;
  private _timedOrderRefreshTicker = 0;
  /** 上一刷客人的 typeId，用于避免连续同人设（池子 >1 时） */
  private _lastSpawnTypeId: string | null = null;
  /** 最近刷出的客人 typeId，用于普通订单多样性降权 */
  private _recentSpawnTypeIds: string[] = [];
  /** 上一刷订单需求 fingerprint，用于避免连续完全相同需求 */
  private _lastOrderFingerprint: string | null = null;

  get customers(): readonly CustomerInstance[] {
    return this._customers;
  }

  prepareFromSave(raw: unknown, offlineSeconds = 0): void {
    this._preparedFromSave = normalizeCustomerPersistState(raw);
    this._preparedOfflineSeconds = Math.max(0, Math.floor(offlineSeconds));
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
        timedDiamondOrderDate: p.timedDiamondOrderDate,
        timedDiamondOrdersToday: p.timedDiamondOrdersToday,
        timedFloristOrderDate: p.timedFloristOrderDate,
        timedFloristOrdersToday: p.timedFloristOrdersToday,
        workshopOrderDate: p.workshopOrderDate,
        workshopOrdersToday: p.workshopOrdersToday,
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
        weekendHuayuanBonus: c.weekendHuayuanBonus,
        tier: c.tier,
        orderType: c.orderType,
        timeLimit: c.timeLimit,
        diamondReward: c.diamondReward,
        staminaChestReward: c.staminaChestReward,
        workshopMaterialRewards: c.workshopMaterialRewards,
        eventStoneReward: c.eventStoneReward,
        chainIndex: c.chainIndex,
        bonusMultiplier: c.bonusMultiplier,
        orderKind: c.orderKind,
      })),
      nextUid: this._nextUid,
      refreshTimer: this._refreshTimer,
      timedDiamondOrderDate: this._timedDiamondOrderDate,
      timedDiamondOrdersToday: this._timedDiamondOrdersToday,
      timedFloristOrderDate: this._timedFloristOrderDate,
      timedFloristOrdersToday: this._timedFloristOrdersToday,
      workshopOrderDate: this._workshopOrderDate,
      workshopOrdersToday: this._workshopOrdersToday,
    };
  }

  init(): void {
    this._started = true;

    if (this._preparedFromSave) {
      const p = this._preparedFromSave;
      this._preparedFromSave = null;
      const offlineSeconds = this._preparedOfflineSeconds;
      this._preparedOfflineSeconds = 0;
      this._customers = p.list.map(e => ({
        uid: e.uid,
        typeId: e.typeId,
        name: e.name,
        emoji: e.emoji,
        slots: e.slots.map(s => ({ itemId: s.itemId, lockedCellIndex: -1 })),
        allSatisfied: false,
        huayuanReward: this._computeCustomerHuayuan(e.typeId, e.slots, e.bonusMultiplier, e.orderType),
        tier: computeTierFromOrderSlots(e.slots.map(s => s.itemId), LevelManager.level),
        orderType: e.orderType,
        timeLimit: e.orderType === 'timed' && e.timeLimit !== null
          ? Math.max(0, e.timeLimit - offlineSeconds)
          : e.timeLimit,
        diamondReward: e.diamondReward,
        staminaChestReward: e.staminaChestReward,
        workshopMaterialRewards: e.workshopMaterialRewards,
        eventStoneReward: e.eventStoneReward,
        chainIndex: e.chainIndex,
        bonusMultiplier: e.bonusMultiplier,
        orderKind: e.orderKind ?? inferOrderKindFromLegacy(e),
      })).filter(c => !(c.orderType === 'timed' && (c.timeLimit ?? 0) <= 0));
      this._refreshWeekendHuayuanBonuses(false);
      this._nextUid = p.nextUid;
      this._refreshTimer = p.refreshTimer;
      this._timedDiamondOrderDate = p.timedDiamondOrderDate ?? localDateKey();
      this._timedDiamondOrdersToday = p.timedDiamondOrdersToday ?? 0;
      this._timedFloristOrderDate = p.timedFloristOrderDate ?? localDateKey();
      this._timedFloristOrdersToday = p.timedFloristOrdersToday ?? 0;
      this._workshopOrderDate = p.workshopOrderDate ?? localDateKey();
      this._workshopOrdersToday = p.workshopOrdersToday ?? 0;
      const maxCap = getDynamicMaxCustomers(LevelManager.level);
      if (this._customers.length > maxCap) {
        this._customers = this._customers.slice(0, maxCap);
        console.warn(`[Customer] 读档客人超过当前上限 ${maxCap}，已截断`);
      }
    } else {
      this._customers = [];
      this._nextUid = 1;
      this._refreshTimer = getCustomerRefreshInitialDelay(LevelManager.level);
      this._timedDiamondOrderDate = localDateKey();
      this._timedDiamondOrdersToday = 0;
      this._timedFloristOrderDate = localDateKey();
      this._timedFloristOrdersToday = 0;
      this._workshopOrderDate = localDateKey();
      this._workshopOrdersToday = 0;
      this._preparedOfflineSeconds = 0;
    }

    this._syncTimedDiamondDailyState();
    this._syncTimedFloristDailyState();
    this._syncWorkshopDailyState();
    this._syncAntiRepeatFromQueueTail();
    this._bindBoardEvents();
    EventBus.on('tutorial:completed', this._onTutorialCompleted);
    this._refreshWeekendHuayuanBonuses(false);
    this._rescanAll();
    this._bootstrapLowLevelQueue();
  }

  private _onTutorialCompleted = (): void => {
    if (!this._started) return;
    this._bootstrapLowLevelQueue();
  };

  /**
   * 1～2 级非教程：开局预填少量客人，避免首屏长时间「等待客人中」。
   */
  private _bootstrapLowLevelQueue(): void {
    if (TutorialManager.isActive) return;
    const tier = getCustomerRefreshTier(LevelManager.level);
    if (tier.bootstrapCount <= 0) return;
    const target = Math.min(this.maxCustomers, tier.bootstrapCount);
    const need = target - this._customers.length;
    if (need <= 0) return;
    for (let i = 0; i < need; i++) {
      this._spawnCustomer();
    }
    this._refreshTimer = Math.min(this._refreshTimer, tier.minSec);
  }

  /**
   * 读档或初始化后：用「uid 最大」的客人同步去重状态（最近一单），避免首刷立刻撞脸上一会话最后一单。
   * 队列会因可完成订单前置而重排，不能再用数组末尾。
   */
  private _syncAntiRepeatFromQueueTail(): void {
    if (this._customers.length === 0) {
      this._lastSpawnTypeId = null;
      this._recentSpawnTypeIds = [];
      this._lastOrderFingerprint = null;
      return;
    }
    const latest = this._customers.reduce((a, b) => (a.uid >= b.uid ? a : b));
    this._lastSpawnTypeId = latest.typeId;
    this._recentSpawnTypeIds = [...this._customers]
      .sort((a, b) => b.uid - a.uid)
      .map(c => c.typeId)
      .slice(0, RECENT_CUSTOMER_AVOID_N);
    this._lastOrderFingerprint = orderSlotsFingerprint(latest.slots);
  }

  get maxCustomers(): number {
    return getDynamicMaxCustomers(LevelManager.level);
  }

  update(dt: number): void {
    if (!this._started) return;
    this._updateTimedOrders(dt);

    // 教程期间限制最多 1 位客人
    const maxC = TutorialManager.isActive ? 1 : this.maxCustomers;
    if (this._customers.length < maxC) {
      this._refreshTimer += dt;
      const threshold = rollCustomerRefreshInterval(LevelManager.level);
      if (this._refreshTimer >= threshold) {
        this._refreshTimer = 0;
        this._spawnCustomer();
      }
    }
  }

  /**
   * 订单花愿 = ΣorderHuayuan×(1+多槽加成) → 单槽合成软保底 → 内容档位倍率 → 组合单倍率。
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
    const tier = computeTierFromOrderSlots(slots.map(s => s.itemId), LevelManager.level);
    base = Math.max(1, Math.round(base * ORDER_TIER_HUAYUAN_MULT[tier]));
    if (bonusMultiplier && bonusMultiplier > 0 && bonusMultiplier !== 1) {
      base = Math.max(1, Math.round(base * bonusMultiplier));
    }
    if (orderType === 'challenge') {
      base = Math.max(1, Math.round(base * CHALLENGE_ORDER_HUAYUAN_MULT));
    }
    return base;
  }

  /** 单槽 FLOWER/DRINK/FOOD：不低于 0.9×2×H(L−1)，避免相对「两单 L−1」过亏 */
  private static _applySingleSlotMergeParityFloor(
    slots: { itemId: string }[],
    preliminaryBase: number,
  ): number {
    if (slots.length !== 1) return preliminaryBase;
    const def = ITEM_DEFS.get(slots[0]!.itemId);
    if (!def?.orderHuayuan || def.level <= 1) return preliminaryBase;
    if (def.category !== Category.FLOWER && def.category !== Category.DRINK && def.category !== Category.FOOD) {
      return preliminaryBase;
    }
    const prevId = findItemId(def.category, def.line, def.level - 1);
    const prevHy = prevId ? ITEM_DEFS.get(prevId)?.orderHuayuan : undefined;
    if (prevHy === undefined || prevHy < 1) return preliminaryBase;
    const floor = Math.round(SINGLE_SLOT_MERGE_PARITY_FACTOR * 2 * prevHy);
    return Math.max(preliminaryBase, floor);
  }

  /**
   * 解析交付时应扣除的棋盘格（与 deliver 一致）。
   * 供 MainScene 飞行动画使用；不写入 slot.lockedCellIndex，避免与 _rescanAll 竞态。
   */
  resolveDeliverCellIndices(customer: CustomerInstance): number[] | null {
    if (!customer.allSatisfied) return null;
    return this._resolveDeliverCellIndices(customer);
  }

  deliver(uid: number): boolean {
    const idx = this._customers.findIndex(c => c.uid === uid);
    if (idx < 0) return false;
    const customer = this._customers[idx];
    if (customer.orderType === 'timed' && (customer.timeLimit ?? 0) <= 0) {
      this._expireCustomerAt(idx);
      return false;
    }
    if (!customer.allSatisfied) return false;

    // 即时为本客人查找可用格子（因 allSatisfied 不再独占锁格，
    // 部分 slot 的 lockedCellIndex 可能为 -1）
    const cellIndices = this._resolveDeliverCellIndices(customer);
    if (!cellIndices) return false;

    // 须先快照索引再逐个 removeItem：每次 board:itemRemoved 会同步 _rescanAll，
    // 把 slot.lockedCellIndex 清成 -1，若边删边读 slot 会导致后续格扣不掉。
    for (const cellIndex of cellIndices) {
      BoardManager.removeItem(cellIndex);
    }

    const weekendBonus = customer.weekendHuayuanBonus ?? 0;
    const hy = customer.huayuanReward + weekendBonus;
    CurrencyManager.addHuayuan(hy);
    const diamonds = customer.orderType === 'timed' && customer.orderKind !== 'timedFlorist'
      ? Math.max(0, Math.floor(customer.diamondReward ?? 0))
      : 0;
    if (diamonds > 0) {
      CurrencyManager.addDiamond(diamonds);
    }
    if (customer.staminaChestReward) {
      RewardBoxManager.addItem(customer.staminaChestReward, 1);
    }
    if (customer.workshopMaterialRewards?.length) {
      for (const reward of customer.workshopMaterialRewards) {
        FurnitureWorkshopManager.addMaterial(reward.materialId, reward.count);
      }
    }

    // 友谊卡进度：普通订单交付后统一走掉卡/里程碑结算
    if (AffinityManager.isAffinityType(customer.typeId)) {
      AffinityManager.onCustomerDelivered(customer.typeId);
    }

    console.log(
      `[Customer] 交付完成: ${customer.name}(${customer.tier}), 花愿+${hy}${weekendBonus > 0 ? ` (周末+${weekendBonus})` : ''}${diamonds > 0 ? `, 钻石+${diamonds}` : ''}${customer.staminaChestReward ? `, 体力箱→收纳盒 ${customer.staminaChestReward}` : ''}${customer.workshopMaterialRewards?.length ? `, 工坊材料+${customer.workshopMaterialRewards.length}种` : ''}`,
    );

    // removeItem 会触发 _rescanAll，并可能把仍可完成的其它客人排到队首；
    // 因此这里不能再使用交付开始时缓存的 idx，否则会误删重排后的其它订单。
    const removeIdx = this._customers.findIndex(c => c.uid === uid);
    if (removeIdx < 0) return false;
    this._customers.splice(removeIdx, 1);
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
    EventBus.on('weekendHuayuanBoost:changed', () => this._refreshWeekendHuayuanBonuses(true));
  }

  private _computeCustomerHuayuan(
    typeId: string,
    slots: readonly { itemId: string }[],
    bonusMultiplier: number | undefined,
    orderType: OrderType,
  ): number {
    let huayuan = CustomerManagerClass.computeOrderHuayuan(slots, bonusMultiplier, orderType);
    const affinityMult = AffinityManager.huayuanMultFor(typeId);
    if (affinityMult !== 1) {
      huayuan = Math.max(1, Math.round(huayuan * affinityMult));
    }
    return huayuan;
  }

  private _refreshWeekendHuayuanBonuses(emitChanged: boolean): void {
    let changed = false;
    for (const customer of this._customers) {
      const next = WeekendHuayuanBoostManager.bonusFor(customer.huayuanReward);
      const prev = customer.weekendHuayuanBonus ?? 0;
      if (prev === next) continue;
      customer.weekendHuayuanBonus = next > 0 ? next : undefined;
      changed = true;
    }
    if (changed && emitChanged) {
      EventBus.emit('customer:rewardBonusChanged');
      this._rescanAll();
    }
  }

  private _rememberRecentCustomerType(typeId: string): void {
    this._recentSpawnTypeIds = [
      typeId,
      ...this._recentSpawnTypeIds.filter(id => id !== typeId),
    ].slice(0, RECENT_CUSTOMER_AVOID_N);
  }

  private _pickCustomerTypeForOrder(gen: OrderGenResult): CustomerTypeDef {
    const requested = gen.customerTypeId ? CUSTOMER_TYPE_MAP.get(gen.customerTypeId) : undefined;
    if (requested) return requested;

    const pool = CUSTOMER_TYPES.filter(t => !t.specialOnly);
    if (pool.length === 0) return CUSTOMER_TYPES[0]!;

    const queueCounts = new Map<string, number>();
    for (const c of this._customers) {
      queueCounts.set(c.typeId, (queueCounts.get(c.typeId) ?? 0) + 1);
    }

    const weighted = pool.map(type => {
      let weight = 1;
      if (type.id === this._lastSpawnTypeId && pool.length > 1) weight *= 0.08;
      const recentIndex = this._recentSpawnTypeIds.indexOf(type.id);
      if (recentIndex >= 0) weight *= 0.25 + recentIndex * 0.15;
      const inQueue = queueCounts.get(type.id) ?? 0;
      if (inQueue > 0) weight *= 1 / (1 + inQueue * 1.6);
      return { type, weight };
    });

    const total = weighted.reduce((sum, row) => sum + row.weight, 0);
    if (total <= 0) return pool[Math.floor(Math.random() * pool.length)]!;

    let r = Math.random() * total;
    for (const row of weighted) {
      r -= row.weight;
      if (r <= 0) return row.type;
    }
    return weighted[weighted.length - 1]!.type;
  }

  private _spawnCustomer(): void {
    const level = LevelManager.level;
    const lines = computeUnlockedLines(BoardManager.cells);
    this._syncTimedDiamondDailyState();
    this._syncTimedFloristDailyState();
    this._syncWorkshopDailyState();
    const weights = getOrderTierWeights(level, lines);

    const tier = pickTierByWeight(weights);

    const noTimedInQueue = !this._customers.some(c => c.orderType === 'timed');
    const allowWorkshopOrder =
      level >= WORKSHOP_ORDER_MIN_PLAYER_LEVEL &&
      this._workshopOrdersToday < WORKSHOP_ORDER_DAILY_CAP;
    const allowTimedFloristOrder =
      level >= TIMED_FLORIST_ORDER_MIN_PLAYER_LEVEL &&
      this._timedFloristOrdersToday < TIMED_FLORIST_ORDER_DAILY_CAP &&
      noTimedInQueue;
    const allowTimedDiamondOrder =
      level >= TIMED_DIAMOND_ORDER_MIN_PLAYER_LEVEL &&
      this._timedDiamondOrdersToday < TIMED_DIAMOND_ORDER_DAILY_CAP &&
      noTimedInQueue;

    let gen: OrderGenResult | null = null;
    let fallbackGen: OrderGenResult | null = null;
    for (let attempt = 0; attempt < ORDER_SPAWN_MAX_ATTEMPTS; attempt++) {
      const g = generateOrderDemands({
        tier,
        lines,
        playerLevel: level,
        allowWorkshopOrder,
        workshopOrdersToday: this._workshopOrdersToday,
        allowTimedFloristOrder,
        timedFloristOrdersToday: this._timedFloristOrdersToday,
        allowTimedDiamondOrder,
        timedDiamondOrdersToday: this._timedDiamondOrdersToday,
        rng: Math.random,
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
    const type = this._pickCustomerTypeForOrder(gen);

    const slots: DemandSlot[] = gen.slots.map(s => ({
      itemId: s.itemId,
      lockedCellIndex: -1,
    }));

    const huayuan = this._computeCustomerHuayuan(type.id, slots, gen.bonusMultiplier, gen.orderType);
    const weekendHuayuanBonus = WeekendHuayuanBoostManager.bonusFor(huayuan);

    const contentTier = computeTierFromOrderSlots(slots.map(s => s.itemId), level);

    const customer: CustomerInstance = {
      uid: this._nextUid++,
      typeId: type.id,
      name: type.name,
      emoji: type.emoji,
      slots,
      allSatisfied: false,
      huayuanReward: huayuan,
      weekendHuayuanBonus: weekendHuayuanBonus > 0 ? weekendHuayuanBonus : undefined,
      tier: contentTier,
      orderType: gen.orderType,
      timeLimit: gen.timeLimit,
      diamondReward: gen.diamondReward,
      staminaChestReward: gen.staminaChestReward,
      workshopMaterialRewards: gen.workshopMaterialRewards,
      bonusMultiplier: gen.bonusMultiplier,
      orderKind: gen.generationKind,
    };

    // 主玩法普通订单按档位概率携带原石（首饰活动）：越高级的单越容易出、数量越多，生成即定、订单上展示
    if (
      customer.orderType === 'normal'
      && isJewelryEventUnlocked(level)
      && Math.random() < getEventOrderStoneChance(customer.tier)
    ) {
      customer.eventStoneReward = rollEventOrderStoneAmount(customer.tier);
    }

    if (customer.orderKind === 'timedWorkshop') {
      this._workshopOrdersToday = Math.min(
        WORKSHOP_ORDER_DAILY_CAP,
        this._workshopOrdersToday + 1,
      );
    } else if (customer.orderKind === 'timedFlorist') {
      this._timedFloristOrdersToday = Math.min(
        TIMED_FLORIST_ORDER_DAILY_CAP,
        this._timedFloristOrdersToday + 1,
      );
    } else if (customer.orderType === 'timed') {
      this._timedDiamondOrdersToday = Math.min(
        TIMED_DIAMOND_ORDER_DAILY_CAP,
        this._timedDiamondOrdersToday + 1,
      );
    }

    this._lastSpawnTypeId = type.id;
    this._rememberRecentCustomerType(type.id);
    this._lastOrderFingerprint = orderSlotsFingerprint(slots);

    this._customers.push(customer);
    console.log(
      `[Customer] 新客人: ${customer.name}(${customer.emoji}) [${contentTier}] (tpl ${tier}) ${customer.orderKind}${customer.orderType === 'timed' ? ` timed +${customer.diamondReward ?? 0}钻` : ''}, 需求: ${customer.slots.map(s => s.itemId).join(', ')}`,
    );
    EventBus.emit('customer:arrived', customer);

    this._rescanAll();
  }

  private _syncTimedDiamondDailyState(): void {
    const today = localDateKey();
    if (this._timedDiamondOrderDate !== today) {
      this._timedDiamondOrderDate = today;
      this._timedDiamondOrdersToday = 0;
    }
  }

  private _syncTimedFloristDailyState(): void {
    const today = localDateKey();
    if (this._timedFloristOrderDate !== today) {
      this._timedFloristOrderDate = today;
      this._timedFloristOrdersToday = 0;
    }
  }

  private _syncWorkshopDailyState(): void {
    const today = localDateKey();
    if (this._workshopOrderDate !== today) {
      this._workshopOrderDate = today;
      this._workshopOrdersToday = 0;
    }
  }

  private _updateTimedOrders(dt: number): void {
    this._syncTimedDiamondDailyState();
    if (dt <= 0 || this._customers.length === 0) return;
    let hasTimed = false;
    let expired = false;

    for (const customer of this._customers) {
      if (customer.orderType !== 'timed' || customer.timeLimit === null) continue;
      hasTimed = true;
      customer.timeLimit = Math.max(0, customer.timeLimit - dt);
    }

    for (let i = this._customers.length - 1; i >= 0; i--) {
      const customer = this._customers[i];
      if (customer.orderType === 'timed' && (customer.timeLimit ?? 0) <= 0) {
        this._expireCustomerAt(i, false);
        expired = true;
      }
    }

    if (expired) {
      this._rescanAll();
      return;
    }

    if (hasTimed) {
      this._timedOrderRefreshTicker += dt;
      if (this._timedOrderRefreshTicker >= 1) {
        this._timedOrderRefreshTicker = 0;
        EventBus.emit('customer:timerTick');
      }
    } else {
      this._timedOrderRefreshTicker = 0;
    }
  }

  private _expireCustomerAt(index: number, rescan = true): void {
    const [removed] = this._customers.splice(index, 1);
    if (!removed) return;
    console.log(`[Customer] 限时订单过期: ${removed.name}(${removed.uid})`);
    EventBus.emit('customer:expired', removed.uid, removed);
    if (rescan) this._rescanAll();
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
  /**
   * GM 专用：立即刷出限时钻石特殊订单（大富翁），绕过概率、等级与每日上限。
   */
  gmSpawnTimedDiamondOrder(): string {
    return this.gmClearAndSpawnCustomer('tycoon');
  }

  /** GM 专用：立即刷出家具工匠材料单，绕过概率、等级与每日上限。 */
  gmSpawnWorkshopOrder(): string {
    return this.gmClearAndSpawnCustomer('furniture_craftswoman');
  }

  /**
   * GM 专用：清空现有客人队列，再刷出指定类型客人（含配套订单）。
   * 特殊客人（如大富翁）走限时钻石单；其余走常规订单生成并强制人设。
   */
  gmClearAndSpawnCustomer(typeId: string): string {
    if (!this._started) return '客人系统尚未启动';
    if (TutorialManager.isActive) return '教程进行中不可用';

    const typeDef = CUSTOMER_TYPE_MAP.get(typeId);
    if (!typeDef) return `未知客人类型：${typeId}`;

    this.clearAllCustomers();

    const level = LevelManager.level;
    const lines = computeUnlockedLines(BoardManager.cells);
    let gen: OrderGenResult | null = null;

    if (typeId === 'florist_merchant') {
      gen = forceGenerateTimedFloristOrder({
        tier: 'A',
        lines,
        playerLevel: level,
        rng: Math.random,
      });
      if (!gen || gen.slots.length === 0) {
        return '无法生成富贵花商单：需有园艺工具且可产出 L6+ 鲜花/绿植';
      }
    } else if (typeId === 'tycoon') {
      gen = forceGenerateTimedDiamondOrder({
        tier: 'B',
        lines,
        playerLevel: level,
        rng: Math.random,
      });
      if (!gen || gen.slots.length === 0) {
        return '无法生成限时钻石单：需有足够解锁产线且物品等级≥6';
      }
    } else if (typeId === 'furniture_craftswoman') {
      gen = forceGenerateWorkshopOrder({
        tier: 'A',
        lines,
        playerLevel: level,
        rng: Math.random,
      });
      if (!gen || gen.slots.length === 0) {
        return '无法生成家具工匠单：需至少解锁 2 条产线、已解锁花束且包装工具可产出 L6+ 花束';
      }
    } else if (typeDef.specialOnly) {
      return `未配置特殊订单生成：${typeId}`;
    } else {
      const tierCandidates: OrderTier[] = ['B', 'A', 'C', 'S'];
      for (const tier of tierCandidates) {
        for (let attempt = 0; attempt < ORDER_SPAWN_MAX_ATTEMPTS; attempt++) {
          const g = generateOrderDemands({
            tier,
            lines,
            playerLevel: level,
            allowTimedDiamondOrder: false,
            rng: Math.random,
          });
          if (!g || g.slots.length === 0) continue;
          if (g.orderType === 'timed') continue;
          if (!validateOrderSlotsToolCap(g.slots, lines)) continue;
          gen = { ...g, customerTypeId: typeId };
          break;
        }
        if (gen) break;
      }
      if (!gen || gen.slots.length === 0) {
        return '无法生成订单：请检查解锁产线与工具等级';
      }
    }

    if (!validateOrderSlotsToolCap(gen.slots, lines)) {
      return '生成的订单超出当前工具能力，请先升级工具或解锁产线';
    }

    const type = typeDef;
    const slots: DemandSlot[] = gen.slots.map(s => ({
      itemId: s.itemId,
      lockedCellIndex: -1,
    }));
    const huayuan = this._computeCustomerHuayuan(type.id, slots, gen.bonusMultiplier, gen.orderType);
    const weekendHuayuanBonus = WeekendHuayuanBoostManager.bonusFor(huayuan);
    const contentTier = computeTierFromOrderSlots(slots.map(s => s.itemId), level);

    const customer: CustomerInstance = {
      uid: this._nextUid++,
      typeId: type.id,
      name: type.name,
      emoji: type.emoji,
      slots,
      allSatisfied: false,
      huayuanReward: huayuan,
      weekendHuayuanBonus: weekendHuayuanBonus > 0 ? weekendHuayuanBonus : undefined,
      tier: contentTier,
      orderType: gen.orderType,
      timeLimit: gen.timeLimit,
      diamondReward: gen.diamondReward,
      staminaChestReward: gen.staminaChestReward,
      workshopMaterialRewards: gen.workshopMaterialRewards,
      bonusMultiplier: gen.bonusMultiplier,
      orderKind: gen.generationKind,
    };

    this._lastSpawnTypeId = type.id;
    this._rememberRecentCustomerType(type.id);
    this._lastOrderFingerprint = orderSlotsFingerprint(slots);
    this._customers.push(customer);

    console.log(
      `[Customer][GM] 指定客人: ${customer.name}(${customer.orderKind})${customer.diamondReward ? ` +${customer.diamondReward}钻` : ''}${customer.staminaChestReward ? ` +${customer.staminaChestReward}` : ''}, 需求: ${customer.slots.map(s => s.itemId).join(', ')}`,
    );
    EventBus.emit('customer:arrived', customer);
    this._rescanAll();

    if (customer.orderKind === 'timedWorkshop') {
      const mat = customer.workshopMaterialRewards?.[0];
      const matName = mat ? '工坊材料' : '';
      const slotDesc = customer.slots.map(s => s.itemId).join('、');
      return `已清空并刷出 ${customer.name}：组合单 ${slotDesc}，花愿×0.5，材料 ${matName}×${mat?.count ?? 1}`;
    }
    if (customer.orderKind === 'timedFlorist') {
      const hours = Math.round((gen.timeLimit ?? 0) / 3600);
      const itemId = customer.slots[0]?.itemId ?? '';
      return `已清空并刷出 ${customer.name}：同款×3 ${itemId}，体力箱 ${customer.staminaChestReward ?? ''}，${hours}h 倒计时`;
    }
    if (customer.orderType === 'timed') {
      const hours = Math.round((gen.timeLimit ?? 0) / 3600);
      return `已清空并刷出 ${customer.name}：限时钻石单 +${customer.diamondReward ?? 0}钻，${hours}h 倒计时`;
    }
    const slotDesc = customer.slots.map(s => s.itemId).join('、');
    return `已清空并刷出 ${customer.name} [${contentTier}]：${slotDesc}`;
  }

  spawnScriptedCustomer(itemIds: string[], typeId = 'child'): void {
    this.clearAllCustomers();
    const type = CUSTOMER_TYPES.find(t => t.id === typeId) ?? CUSTOMER_TYPES[0];
    const slots: DemandSlot[] = itemIds.map(id => ({ itemId: id, lockedCellIndex: -1 }));
    const huayuan = this._computeCustomerHuayuan(type.id, slots, 1, 'normal');
    const weekendHuayuanBonus = WeekendHuayuanBoostManager.bonusFor(huayuan);

    const customer: CustomerInstance = {
      uid: this._nextUid++,
      typeId: type.id,
      name: type.name,
      emoji: type.emoji,
      slots,
      allSatisfied: false,
      huayuanReward: huayuan,
      weekendHuayuanBonus: weekendHuayuanBonus > 0 ? weekendHuayuanBonus : undefined,
      tier: computeTierFromOrderSlots(itemIds, LevelManager.level) as OrderTier,
      orderType: 'normal' as OrderType,
      timeLimit: null,
      bonusMultiplier: 1,
      orderKind: 'eventStub',
    };

    this._customers.push(customer);
    this._lastSpawnTypeId = type.id;
    this._rememberRecentCustomerType(type.id);
    this._lastOrderFingerprint = orderSlotsFingerprint(slots);
    console.log(`[Customer] 教程客人: ${customer.name} 需求: ${itemIds.join(', ')}`);
    EventBus.emit('customer:arrived', customer);
    this._rescanAll();
  }

  private _rescanAll(): void {
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

  /** 为每位需求槽解析 1:1 棋盘格；失败返回 null */
  private _resolveDeliverCellIndices(customer: CustomerInstance): number[] | null {
    const usedCells = new Set<number>();
    const indices: number[] = [];

    for (const slot of customer.slots) {
      let cellIndex = -1;

      if (slot.lockedCellIndex >= 0) {
        const locked = BoardManager.getCellByIndex(slot.lockedCellIndex);
        if (
          locked?.state === 'open' &&
          locked.itemId === slot.itemId &&
          !usedCells.has(slot.lockedCellIndex)
        ) {
          cellIndex = slot.lockedCellIndex;
        }
      }

      if (cellIndex < 0) {
        for (const cell of BoardManager.cells) {
          if (cell.state !== 'open' || !cell.itemId) continue;
          if (usedCells.has(cell.index)) continue;
          if (cell.itemId !== slot.itemId) continue;
          cellIndex = cell.index;
          break;
        }
      }

      if (cellIndex < 0) return null;

      const cell = BoardManager.getCellByIndex(cellIndex);
      if (!cell || cell.state !== 'open' || cell.itemId !== slot.itemId) return null;

      usedCells.add(cellIndex);
      indices.push(cellIndex);
    }

    return indices;
  }
}

export const CustomerManager = new CustomerManagerClass();
