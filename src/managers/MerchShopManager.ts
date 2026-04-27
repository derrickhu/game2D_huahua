/**
 * 主场景顶栏「内购商店」：随机货架、定时整行刷新、多支付与发奖。
 * 配置见 MerchShopConfig；存档见 SaveManager `merchShop`。
 * 倒计时基于 `Date.now()` 与持久化的 `nextRefreshAt`，**进程不在前台时真实时间仍流逝**，读档与 `ensureUpToDate` 会处理过期货架。
 */
import { Game } from '@/core/Game';
import { AudioManager } from '@/core/AudioManager';
import { EventBus } from '@/core/EventBus';
import {
  Category,
  CRYSTAL_BALL_ITEM_ID,
  GOLDEN_SCISSORS_ITEM_ID,
  ITEM_DEFS,
  LUCKY_COIN_ITEM_ID,
  type ItemDef,
} from '@/config/ItemConfig';
import {
  MERCH_FREE_SHOP_BASE_WEIGHT,
  MERCH_FREE_SHOP_RARE_WEIGHT,
  MERCH_MYSTERY_DIAMOND_BASE,
  MERCH_MYSTERY_DIAMOND_CURVE_DIV,
  MERCH_MYSTERY_DIAMOND_EXTRA_PER_CHEST_LEVEL,
  MERCH_MYSTERY_DIAMOND_PER_LEVEL,
  MERCH_MYSTERY_HUAYUAN_CHANCE_LOCKED,
  MERCH_MYSTERY_HUAYUAN_CHANCE_UNLOCKED,
  MERCH_MYSTERY_HUAYUAN_FALLBACK_BASE,
  MERCH_MYSTERY_HUAYUAN_FALLBACK_PER_LEVEL,
  MERCH_MYSTERY_HUAYUAN_LOCKED_MULT,
  MERCH_MYSTERY_HUAYUAN_MAX_LEVEL,
  MERCH_MYSTERY_HUAYUAN_MIN,
  MERCH_MYSTERY_LOCKED_DIAMOND_ADD,
  MERCH_MYSTERY_LOCKED_DIAMOND_MULT,
  MERCH_MYSTERY_LOCKED_LINE_WEIGHT_FACTOR,
  MERCH_MYSTERY_LOCKED_STOCK_FACTOR,
  MERCH_MYSTERY_PRICE_MULT_MAX,
  MERCH_MYSTERY_PRICE_MULT_MIN,
  MERCH_MYSTERY_STOCK_CAP,
  MERCH_MYSTERY_STOCK_DIVISOR,
  MERCH_MYSTERY_TOOL_L1_DIAMOND_BASE,
  MERCH_MYSTERY_TOOL_L1_DIAMOND_SPREAD,
  MERCH_MYSTERY_TOOL_L1_WEIGHT,
  MERCH_MYSTERY_UNLOCKED_LEVEL_NUM,
  MERCH_SHELVES,
  type MerchPoolEntry,
  type MerchPriceType,
  type MerchShelfDef,
} from '@/config/MerchShopConfig';
import { CollectionCategory, CollectionManager } from '@/managers/CollectionManager';
import { CurrencyManager } from '@/managers/CurrencyManager';
import { BoardManager } from '@/managers/BoardManager';
import { RewardBoxManager } from '@/managers/RewardBoxManager';
import { AdManager, AdScene } from '@/managers/AdManager';
import { AdEntitlementManager, DailyAdEntitlement } from '@/managers/AdEntitlementManager';
import { ToastMessage } from '@/gameobjects/ui/ToastMessage';

export interface MerchSlotState {
  itemId: string;
  remaining: number;
  priceType: MerchPriceType;
  priceAmount: number;
}

export interface MerchShelfRuntime {
  nextRefreshAt: number;
  slots: MerchSlotState[];
}

export interface MerchSlotSnapshot extends MerchSlotState {
  name: string;
  icon: string;
}

export interface MerchShelfSnapshot {
  shelfId: string;
  nextRefreshAt: number;
  refreshIntervalSec: number;
  slots: MerchSlotSnapshot[];
}

export interface MerchShopPersistState {
  shelves: {
    nextRefreshAt: number;
    slots: MerchSlotState[];
  }[];
}

function clampPurchaseStock(raw: number | undefined): number {
  const n = raw === undefined ? 1 : Math.floor(Number(raw));
  return Math.max(1, Math.min(99, n));
}

/** 免费商店每格可购买次数上限（含读档钳制） */
const FREE_SHOP_MAX_PURCHASE_PER_SLOT = 1;

function weightedPickIndex(weights: number[]): number {
  let total = 0;
  for (const w of weights) total += Math.max(0, w);
  if (total <= 0) return 0;
  let r = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= Math.max(0, weights[i]);
    if (r <= 0) return i;
  }
  return weights.length - 1;
}

function mysteryPriceFluctuationMult(): number {
  return (
    MERCH_MYSTERY_PRICE_MULT_MIN +
    Math.random() * (MERCH_MYSTERY_PRICE_MULT_MAX - MERCH_MYSTERY_PRICE_MULT_MIN)
  );
}

/** 图鉴分类（与 CollectionManager 登记一致）；未进图鉴的品类不参与免费商店动态池 */
function collectionCategoryForItemDef(def: ItemDef): CollectionCategory | null {
  switch (def.category) {
    case Category.FLOWER:
      return CollectionCategory.FLOWER;
    case Category.DRINK:
      return CollectionCategory.DRINK;
    case Category.BUILDING:
      return CollectionCategory.BUILDING;
    case Category.CHEST:
      return CollectionCategory.CHEST;
    default:
      return null;
  }
}

function isDiscoveredForFreeShop(itemId: string): boolean {
  const def = ITEM_DEFS.get(itemId);
  if (!def) return false;
  const cat = collectionCategoryForItemDef(def);
  if (!cat) return false;
  return CollectionManager.isDiscovered(cat, itemId);
}

/** 该物品所在合成线（同 category + line）是否已有任意一级被图鉴收录 */
function isMergeLineUnlocked(def: ItemDef): boolean {
  const cat = collectionCategoryForItemDef(def);
  if (!cat) return false;
  for (const [, d] of ITEM_DEFS) {
    if (d.category !== def.category || d.line !== def.line) continue;
    if (CollectionManager.isDiscovered(cat, d.id)) return true;
  }
  return false;
}

interface MysteryCandidate {
  itemId: string;
  weight: number;
  isToolL1: boolean;
  lockedLine: boolean;
  def: ItemDef;
}

const MYSTERY_BLOCKED_IDS = new Set<string>([
  LUCKY_COIN_ITEM_ID,
  CRYSTAL_BALL_ITEM_ID,
  GOLDEN_SCISSORS_ITEM_ID,
]);

/** 神秘商店不出现：钻石袋线（棋盘散落钻石块） */
const MYSTERY_EXCLUDED_CHEST_LINES = new Set<string>(['diamond_bag']);

function buildMysteryCandidates(): MysteryCandidate[] {
  const out: MysteryCandidate[] = [];
  for (const [id, def] of ITEM_DEFS) {
    if (MYSTERY_BLOCKED_IDS.has(id)) continue;
    if (def.category === Category.CURRENCY) continue;

    if (def.category === Category.BUILDING) {
      if (id.startsWith('tool_') && def.level === 1) {
        const lockedLine = !isMergeLineUnlocked(def);
        let w = MERCH_MYSTERY_TOOL_L1_WEIGHT;
        if (lockedLine) w *= 0.72;
        out.push({
          itemId: id,
          weight: Math.max(1, Math.round(w)),
          isToolL1: true,
          lockedLine,
          def,
        });
      }
      continue;
    }

    if (
      def.category === Category.FLOWER ||
      def.category === Category.DRINK ||
      def.category === Category.CHEST
    ) {
      if (
        def.category === Category.CHEST &&
        MYSTERY_EXCLUDED_CHEST_LINES.has(def.line)
      ) {
        continue;
      }
      const lockedLine = !isMergeLineUnlocked(def);
      let w = Math.max(
        1,
        Math.round(MERCH_MYSTERY_UNLOCKED_LEVEL_NUM / (def.level * def.level)),
      );
      if (lockedLine) {
        w = Math.max(
          1,
          Math.round(w * MERCH_MYSTERY_LOCKED_LINE_WEIGHT_FACTOR),
        );
      }
      out.push({ itemId: id, weight: w, isToolL1: false, lockedLine, def });
    }
  }
  return out;
}

function finalizeMysterySlot(c: MysteryCandidate): MerchSlotState {
  const { def, lockedLine, isToolL1 } = c;
  const fluct = mysteryPriceFluctuationMult();

  let stock: number;
  if (isToolL1) {
    stock = 1;
  } else {
    let s = Math.ceil(MERCH_MYSTERY_STOCK_DIVISOR / def.level);
    s = Math.min(MERCH_MYSTERY_STOCK_CAP, Math.max(1, s));
    if (lockedLine) {
      s = Math.max(1, Math.ceil(s * MERCH_MYSTERY_LOCKED_STOCK_FACTOR));
    }
    stock = clampPurchaseStock(s);
  }

  const hyChance = lockedLine
    ? MERCH_MYSTERY_HUAYUAN_CHANCE_LOCKED
    : MERCH_MYSTERY_HUAYUAN_CHANCE_UNLOCKED;
  const tryHuayuan =
    !isToolL1 &&
    def.level <= MERCH_MYSTERY_HUAYUAN_MAX_LEVEL &&
    Math.random() < hyChance;

  if (tryHuayuan) {
    const ref =
      def.orderHuayuan ??
      MERCH_MYSTERY_HUAYUAN_FALLBACK_BASE +
        def.level * MERCH_MYSTERY_HUAYUAN_FALLBACK_PER_LEVEL;
    let hy = ref * (0.9 + Math.random() * 0.2);
    if (lockedLine) hy *= MERCH_MYSTERY_HUAYUAN_LOCKED_MULT;
    const priceAmount = Math.max(
      MERCH_MYSTERY_HUAYUAN_MIN,
      Math.round(hy * fluct),
    );
    return {
      itemId: c.itemId,
      remaining: stock,
      priceType: 'huayuan',
      priceAmount,
    };
  }

  let baseDia =
    MERCH_MYSTERY_DIAMOND_BASE +
    def.level * MERCH_MYSTERY_DIAMOND_PER_LEVEL +
    Math.floor((def.level * def.level) / MERCH_MYSTERY_DIAMOND_CURVE_DIV);
  if (def.category === Category.CHEST) {
    baseDia += def.level * MERCH_MYSTERY_DIAMOND_EXTRA_PER_CHEST_LEVEL;
  }
  if (lockedLine) {
    baseDia =
      Math.floor(baseDia * MERCH_MYSTERY_LOCKED_DIAMOND_MULT) +
      MERCH_MYSTERY_LOCKED_DIAMOND_ADD;
  }
  if (isToolL1) {
    baseDia =
      MERCH_MYSTERY_TOOL_L1_DIAMOND_BASE +
      Math.floor(Math.random() * MERCH_MYSTERY_TOOL_L1_DIAMOND_SPREAD);
    if (lockedLine) {
      baseDia = Math.floor(baseDia * 1.12) + 4;
    }
  }
  const priceAmount = Math.max(1, Math.round(baseDia * fluct));
  return {
    itemId: c.itemId,
    remaining: stock,
    priceType: 'diamond',
    priceAmount,
  };
}

function rollMysteryShopSlots(def: MerchShelfDef): MerchSlotState[] {
  const fullBag = (): MysteryCandidate[] =>
    buildMysteryCandidates().filter((c) => ITEM_DEFS.has(c.itemId));

  let bag = fullBag();
  if (bag.length === 0) {
    console.warn('[MerchShop] mystery shelf has no candidates');
    const f = mysteryPriceFluctuationMult();
    return [
      {
        itemId: 'flower_fresh_1',
        remaining: 2,
        priceType: 'diamond',
        priceAmount: Math.max(1, Math.round(5 * f)),
      },
      {
        itemId: 'drink_butterfly_1',
        remaining: 2,
        priceType: 'huayuan',
        priceAmount: Math.max(MERCH_MYSTERY_HUAYUAN_MIN, Math.round(14 * f)),
      },
      {
        itemId: 'flower_green_1',
        remaining: 2,
        priceType: 'diamond',
        priceAmount: Math.max(1, Math.round(4 * f)),
      },
    ];
  }

  const n = def.slotCount;
  const picked: MysteryCandidate[] = [];
  for (let k = 0; k < n; k++) {
    if (bag.length === 0) bag = fullBag();
    const weights = bag.map((c) => c.weight);
    const idx = weightedPickIndex(weights);
    const choice = bag[idx]!;
    picked.push(choice);
    if (def.pickWithoutReplacement && bag.length > 1) {
      bag = bag.filter((_, j) => j !== idx);
    }
  }
  return picked.map((c) => finalizeMysterySlot(c));
}

const FREE_SHOP_RARE_IDS = ['hongbao_1', 'stamina_chest_1', 'diamond_bag_1'] as const;

/**
 * 免费商店：已解锁（图鉴）、等级 1～5、排除 `tool_*`；另混入低权重 1 级红包/体力宝箱/宝石袋。
 * 图鉴尚无收录时用固定低级饮品（如蝴蝶 L1）占位，避免空池。
 */
function buildFreeShopDynamicPool(): MerchPoolEntry[] {
  const rareSet = new Set<string>(FREE_SHOP_RARE_IDS);
  const main: MerchPoolEntry[] = [];
  for (const [id, def] of ITEM_DEFS) {
    if (def.level >= 6) continue;
    if (id.startsWith('tool_')) continue;
    if (rareSet.has(id)) continue;
    if (!isDiscoveredForFreeShop(id)) continue;
    main.push({
      itemId: id,
      weight: MERCH_FREE_SHOP_BASE_WEIGHT,
      priceType: 'free',
      purchaseStock: 1,
    });
  }
  const rare: MerchPoolEntry[] = [];
  for (const rid of FREE_SHOP_RARE_IDS) {
    if (ITEM_DEFS.has(rid)) {
      rare.push({
        itemId: rid,
        weight: MERCH_FREE_SHOP_RARE_WEIGHT,
        priceType: 'free',
        purchaseStock: 1,
      });
    }
  }
  if (main.length === 0) {
    return [
      {
        itemId: 'flower_fresh_1',
        weight: MERCH_FREE_SHOP_BASE_WEIGHT,
        priceType: 'free',
        purchaseStock: 1,
      },
      {
        itemId: 'flower_green_1',
        weight: MERCH_FREE_SHOP_BASE_WEIGHT,
        priceType: 'free',
        purchaseStock: 1,
      },
      {
        itemId: 'drink_butterfly_1',
        weight: MERCH_FREE_SHOP_BASE_WEIGHT,
        priceType: 'free',
        purchaseStock: 1,
      },
      ...rare,
    ];
  }
  return [...main, ...rare];
}

function rollSlotsForShelf(def: MerchShelfDef): MerchSlotState[] {
  if (def.dynamicMysteryShopPool) {
    return rollMysteryShopSlots(def);
  }
  const poolSource = def.dynamicFreeShopPool ? buildFreeShopDynamicPool() : def.pool;
  const valid = poolSource.filter((p) => ITEM_DEFS.has(p.itemId));
  if (valid.length === 0) {
    console.warn(`[MerchShop] shelf ${def.id} has no valid pool entries`);
    return [];
  }
  const n = def.slotCount;
  const out: MerchPoolEntry[] = [];
  let bag = [...valid];
  for (let k = 0; k < n; k++) {
    if (bag.length === 0) bag = [...valid];
    const weights = bag.map((p) => p.weight);
    const idx = weightedPickIndex(weights);
    const picked = bag[idx]!;
    out.push(picked);
    if (def.pickWithoutReplacement && bag.length > 1) {
      bag = bag.filter((_, j) => j !== idx);
    }
  }
  return out.map((e) => ({
    itemId: e.itemId,
    remaining: def.dynamicFreeShopPool
      ? FREE_SHOP_MAX_PURCHASE_PER_SLOT
      : clampPurchaseStock(e.purchaseStock),
    priceType: e.priceType,
    priceAmount: Math.max(0, e.priceAmount ?? 0),
  }));
}

class MerchShopManagerClass {
  private _shelves: MerchShelfRuntime[] = [];
  private _tickerBound: (() => void) | null = null;
  private _accumMs = 0;

  init(): void {
    if (this._tickerBound) return;
    this._tickerBound = () => {
      this._accumMs += Game.ticker.deltaMS;
      if (this._accumMs < 900) return;
      this._accumMs = 0;
      this.checkRefreshes();
    };
    Game.ticker.add(this._tickerBound);
  }

  bootstrapFresh(): void {
    const now = Date.now();
    this._shelves = MERCH_SHELVES.map((def) => {
      const slots = rollSlotsForShelf(def);
      return {
        nextRefreshAt: now + def.refreshIntervalSec * 1000,
        slots,
      };
    });
    EventBus.emit('merchShop:changed');
  }

  private _validatePersist(state: MerchShopPersistState | undefined): boolean {
    if (!state?.shelves || state.shelves.length !== MERCH_SHELVES.length) return false;
    for (let i = 0; i < state.shelves.length; i++) {
      const s = state.shelves[i];
      const def = MERCH_SHELVES[i];
      if (!Number.isFinite(s.nextRefreshAt)) return false;
      if (!Array.isArray(s.slots) || s.slots.length !== def.slotCount) return false;
      for (const sl of s.slots) {
        if (!sl.itemId || !ITEM_DEFS.has(sl.itemId)) return false;
        if (sl.remaining < 0 || sl.remaining > 99) return false;
        if (!['free', 'diamond', 'huayuan', 'ad'].includes(sl.priceType)) return false;
      }
    }
    return true;
  }

  loadState(state: MerchShopPersistState | undefined): void {
    if (!this._validatePersist(state)) {
      this.bootstrapFresh();
      return;
    }
    this._shelves = state!.shelves.map((s, shelfIdx) => {
      const def = MERCH_SHELVES[shelfIdx]!;
      return {
        nextRefreshAt: s.nextRefreshAt,
        slots: s.slots.map((sl) => ({
          itemId: sl.itemId,
          remaining: def.dynamicFreeShopPool
            ? Math.min(FREE_SHOP_MAX_PURCHASE_PER_SLOT, Math.max(0, sl.remaining))
            : sl.remaining,
          priceType: sl.priceType,
          priceAmount: Math.max(0, sl.priceAmount ?? 0),
        })),
      };
    });
    this.ensureUpToDate();
  }

  exportState(): MerchShopPersistState {
    return {
      shelves: this._shelves.map((s) => ({
        nextRefreshAt: s.nextRefreshAt,
        slots: s.slots.map((sl) => ({ ...sl })),
      })),
    };
  }

  /**
   * 打开面板、读档或回前台：若当前时间已过 `nextRefreshAt` 则整行重 roll。
   * @returns 是否有货架被刷新（便于调用方决定是否立即存档）
   */
  ensureUpToDate(): boolean {
    const now = Date.now();
    let changed = false;
    for (let i = 0; i < this._shelves.length; i++) {
      if (now >= this._shelves[i].nextRefreshAt) {
        this.rollShelfNow(i, now);
        changed = true;
      }
    }
    if (changed) EventBus.emit('merchShop:changed');
    return changed;
  }

  /** 到点刷新：新一批商品，nextRefreshAt = now + interval */
  private rollShelfNow(shelfIndex: number, now: number): void {
    const def = MERCH_SHELVES[shelfIndex];
    if (!def) return;
    this._shelves[shelfIndex] = {
      nextRefreshAt: now + def.refreshIntervalSec * 1000,
      slots: rollSlotsForShelf(def),
    };
  }

  private rerollShelfDifferent(shelfIndex: number, now: number): void {
    const before = JSON.stringify(this._shelves[shelfIndex]?.slots ?? []);
    for (let i = 0; i < 6; i++) {
      this.rollShelfNow(shelfIndex, now + i);
      const after = JSON.stringify(this._shelves[shelfIndex]?.slots ?? []);
      if (after !== before) return;
    }
  }

  checkRefreshes(): void {
    const now = Date.now();
    let changed = false;
    for (let i = 0; i < this._shelves.length; i++) {
      if (now >= this._shelves[i].nextRefreshAt) {
        this.rollShelfNow(i, now);
        changed = true;
      }
    }
    if (changed) EventBus.emit('merchShop:changed');
  }

  /**
   * 花费钻石立即重 roll 指定路货架，`nextRefreshAt = now + refreshIntervalSec`。
   */
  tryDiamondRefreshShelf(shelfIndex: number, diamondCost: number): boolean {
    this.ensureUpToDate();
    if (shelfIndex < 0 || shelfIndex >= MERCH_SHELVES.length) return false;
    if (CurrencyManager.state.diamond < diamondCost) {
      ToastMessage.show('钻石不足');
      return false;
    }
    CurrencyManager.addDiamond(-diamondCost);
    AudioManager.play('purchase_tap');
    this.rollShelfNow(shelfIndex, Date.now());
    EventBus.emit('merchShop:changed');
    ToastMessage.show('本栏已刷新');
    return true;
  }

  refreshShelfWithDailyAd(shelfIndex: number): void {
    this.ensureUpToDate();
    if (shelfIndex < 0 || shelfIndex >= MERCH_SHELVES.length) return;
    if (!AdEntitlementManager.canUseDaily(DailyAdEntitlement.MERCH_DAILY_REFRESH)) {
      ToastMessage.show('今日广告刷新已使用');
      return;
    }
    AdManager.showRewardedAd(AdScene.MERCH_DAILY_REFRESH, (success) => {
      if (!success) {
        ToastMessage.show('广告未看完，未刷新');
        return;
      }
      if (!AdEntitlementManager.markDailyUsed(DailyAdEntitlement.MERCH_DAILY_REFRESH)) {
        ToastMessage.show('今日广告刷新已使用');
        return;
      }
      AudioManager.play('purchase_tap');
      this.rerollShelfDifferent(shelfIndex, Date.now());
      console.log('[MerchShop] 每日广告刷新完成:', shelfIndex, this._shelves[shelfIndex]?.slots);
      EventBus.emit('merchShop:changed');
      EventBus.emit('merchShop:dailyAdRefreshCompleted', shelfIndex);
      ToastMessage.show('本栏已刷新');
    });
  }

  getSnapshot(): MerchShelfSnapshot[] {
    return this._shelves.map((s, i) => {
      const def = MERCH_SHELVES[i]!;
      return {
        shelfId: def.id,
        nextRefreshAt: s.nextRefreshAt,
        refreshIntervalSec: def.refreshIntervalSec,
        slots: s.slots.map((sl) => {
          const d = ITEM_DEFS.get(sl.itemId);
          return {
            ...sl,
            name: d?.name ?? sl.itemId,
            icon: d?.icon ?? 'icon_gem',
          };
        }),
      };
    });
  }

  private grantItem(itemId: string): void {
    const idx = BoardManager.findEmptyOpenCell();
    if (idx >= 0 && BoardManager.placeItem(idx, itemId)) return;
    RewardBoxManager.addItem(itemId, 1);
    ToastMessage.show('棋盘已满，物品已进入收纳盒');
  }

  private canAfford(priceType: MerchPriceType, priceAmount: number): boolean {
    const st = CurrencyManager.state;
    if (priceType === 'free' || priceType === 'ad') return true;
    if (priceType === 'diamond') return st.diamond >= priceAmount;
    if (priceType === 'huayuan') return st.huayuan >= priceAmount;
    return false;
  }

  private pay(priceType: MerchPriceType, priceAmount: number): void {
    if (priceType === 'diamond') CurrencyManager.addDiamond(-priceAmount);
    else if (priceType === 'huayuan') CurrencyManager.addHuayuan(-priceAmount);
  }

  /**
   * 非广告购买；广告位请用 purchaseWithAd。
   */
  tryPurchase(shelfIndex: number, slotIndex: number): boolean {
    this.ensureUpToDate();
    const shelf = this._shelves[shelfIndex];
    if (!shelf || !shelf.slots[slotIndex]) return false;
    const slot = shelf.slots[slotIndex]!;
    if (slot.remaining <= 0) {
      ToastMessage.show('已售罄');
      return false;
    }
    if (slot.priceType === 'ad') {
      ToastMessage.show('请使用广告购买');
      return false;
    }
    if (!this.canAfford(slot.priceType, slot.priceAmount)) {
      if (slot.priceType === 'diamond') ToastMessage.show('钻石不足');
      else if (slot.priceType === 'huayuan') ToastMessage.show('花愿不足');
      return false;
    }
    this.pay(slot.priceType, slot.priceAmount);
    if (slot.priceType === 'diamond' || slot.priceType === 'huayuan') {
      AudioManager.play('purchase_tap');
    }
    this.grantItem(slot.itemId);
    slot.remaining = Math.max(0, slot.remaining - 1);
    EventBus.emit('merchShop:changed');
    ToastMessage.show(`获得 ${ITEM_DEFS.get(slot.itemId)?.name ?? slot.itemId}`);
    return true;
  }

  purchaseWithAd(shelfIndex: number, slotIndex: number): void {
    this.ensureUpToDate();
    const shelf = this._shelves[shelfIndex];
    if (!shelf || !shelf.slots[slotIndex]) return;
    const slot = shelf.slots[slotIndex]!;
    if (slot.remaining <= 0) {
      ToastMessage.show('已售罄');
      return;
    }
    if (slot.priceType !== 'ad') {
      ToastMessage.show('该商品非广告购买');
      return;
    }
    AdManager.showRewardedAd(AdScene.MERCH_SHOP, (success) => {
      if (!success) {
        ToastMessage.show('广告未看完');
        return;
      }
      this.ensureUpToDate();
      const sh = this._shelves[shelfIndex];
      const sl = sh?.slots[slotIndex];
      if (!sl || sl.itemId !== slot.itemId || sl.remaining <= 0 || sl.priceType !== 'ad') {
        ToastMessage.show('商品已刷新，请重试');
        return;
      }
      this.grantItem(sl.itemId);
      sl.remaining = Math.max(0, sl.remaining - 1);
      EventBus.emit('merchShop:changed');
      ToastMessage.show(`获得 ${ITEM_DEFS.get(sl.itemId)?.name ?? sl.itemId}`);
    });
  }
}

export const MerchShopManager = new MerchShopManagerClass();
