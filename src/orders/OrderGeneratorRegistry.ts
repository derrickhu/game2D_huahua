/**
 * 订单需求生成：按已解锁产品扁平抽样、组合单、活动钩子占位。
 */
import { DEFAULT_SPECIAL_CUSTOMER_BY_ORDER_KIND } from '@/config/CustomerConfig';
import {
  ORDER_TIERS,
  type OrderTier,
  type UnlockedLines,
} from '@/config/OrderTierConfig';
import {
  type OrderProductId,
  type ProductOrderSpec,
  getOrderProduct,
  productOrderSpecsForTier,
  productToolCap,
  resolveOrderProduct,
  unlockedOrderProducts,
} from '@/config/OrderProductConfig';
import {
  Category,
  ITEM_DEFS,
  findItemId,
} from '@/config/ItemConfig';
import {
  ORDER_ASPIRATIONAL_LEVEL_BONUS_CHANCE,
  ORDER_COMBO_MIN_UNLOCKED_LINES_FOR_THIRD_SLOT,
  ORDER_COMBO_THIRD_SLOT_CHANCE,
  ORDER_ITEM_LEVEL_PICK_EXPONENT,
  TIMED_DIAMOND_ORDER_BASE_CHANCE,
  TIMED_DIAMOND_ORDER_FIRST_DAILY_CHANCE_MULT,
  TIMED_DIAMOND_ORDER_MIN_ITEM_LEVEL,
  TIMED_DIAMOND_ORDER_MIN_PLAYER_LEVEL,
  TIMED_DIAMOND_ORDER_SLOT_COUNT,
  TIMED_DIAMOND_ORDER_TIME_LIMIT_SECONDS,
  computeTimedDiamondReward,
  orderComboEffectiveChance,
} from '@/config/OrderSpawnConfig';
import {
  type OrderGenContext,
  type OrderGenResult,
  type OrderGenSlot,
  getActivityOrderHook,
} from './types';

export type { ProductOrderSpec } from '@/config/OrderProductConfig';

/** @deprecated 使用 ProductOrderSpec */
export type LineOrderSpec = {
  category: Category;
  line: string;
  minLv: number;
  maxLv: number;
};

/** 由物品 category + itemLine 推算订单工具 cap（包装中间品等返回 0） */
export function toolCapForLine(category: Category, line: string, ulk: UnlockedLines): number {
  const product = resolveOrderProduct(category, line);
  if (!product) return 0;
  return productToolCap(product.id, ulk);
}

/** @deprecated 使用 productOrderSpecsForTier */
export function lineOrderSpecsForTier(tier: OrderTier, ulk: UnlockedLines): LineOrderSpec[] {
  return productOrderSpecsForTier(tier, ulk).map(spec => ({
    category: spec.category,
    line: spec.itemLine,
    minLv: spec.minLv,
    maxLv: spec.maxLv,
  }));
}

function productSpecKey(spec: ProductOrderSpec): string {
  return spec.productId;
}

function resolveLevelBounds(
  minLv: number,
  tierMaxLv: number,
  toolCap: number,
  maxItemLevel: number,
  tier: OrderTier,
  rng: () => number,
  playerLevel?: number,
): { lo: number; hi: number } {
  const tierAspirationalBonus: Record<OrderTier, number> = {
    C: 0,
    B: 0.02,
    A: 0.08,
    S: 0.18,
  };
  const aspirationalChance =
    ORDER_ASPIRATIONAL_LEVEL_BONUS_CHANCE + tierAspirationalBonus[tier];
  const aspirational = toolCap > 0 && rng() < (
    playerLevel === 1 ? 0
      : playerLevel === 2 ? aspirationalChance * 0.65
        : aspirationalChance
  );
  let hi = Math.min(tierMaxLv, toolCap + (aspirational ? 1 : 0), maxItemLevel);
  if (playerLevel === 1) {
    const cap = toolCap > 0 ? toolCap : 3;
    hi = Math.min(hi, cap);
    if (tier === 'B') hi = Math.min(hi, minLv + 2);
  } else if (playerLevel === 2) {
    const cap = toolCap > 0 ? toolCap + 1 : 4;
    hi = Math.min(hi, cap);
    if (tier === 'B') hi = Math.min(hi, minLv + 4);
    if (tier === 'A') hi = Math.min(hi, minLv + 2, cap + 1);
  }
  const lo = Math.min(minLv, hi);
  return { lo, hi };
}

function pickItemLevel(
  minLv: number,
  tierMaxLv: number,
  toolCap: number,
  maxItemLevel: number,
  tier: OrderTier,
  rng: () => number,
  playerLevel?: number,
): number {
  const tierExponent: Record<OrderTier, number> = {
    C: ORDER_ITEM_LEVEL_PICK_EXPONENT,
    B: 1.02,
    A: 0.82,
    S: 0.58,
  };
  const { lo, hi } = resolveLevelBounds(
    minLv, tierMaxLv, toolCap, maxItemLevel, tier, rng, playerLevel,
  );
  const span = hi - lo + 1;
  return lo + Math.floor(Math.pow(rng(), tierExponent[tier]) * span);
}

function pickItemFromProductSpec(
  spec: ProductOrderSpec,
  ulk: UnlockedLines,
  usedIds: Set<string>,
  tier: OrderTier,
  rng: () => number,
  playerLevel: number,
): string | null {
  const toolCap = productToolCap(spec.productId, ulk);

  for (let attempt = 0; attempt < 12; attempt++) {
    const level = pickItemLevel(
      spec.minLv, spec.maxLv, toolCap, spec.maxLv, tier, rng, playerLevel,
    );
    const id = findItemId(spec.category, spec.itemLine, level);
    if (id && !usedIds.has(id)) return id;
  }

  const { lo, hi } = resolveLevelBounds(
    spec.minLv, spec.maxLv, toolCap, spec.maxLv, tier, rng, playerLevel,
  );
  if (hi < lo) return null;
  for (let lv = hi; lv >= lo; lv--) {
    const id = findItemId(spec.category, spec.itemLine, lv);
    if (id && !usedIds.has(id)) return id;
  }
  return null;
}

interface GenerateProductSpecsOptions {
  rng: () => number;
  tier: OrderTier;
  playerLevel: number;
}

function generateDemandsFromProductSpecs(
  slotRange: [number, number],
  ulk: UnlockedLines,
  opts: GenerateProductSpecsOptions,
): OrderGenSlot[] {
  const specs = productOrderSpecsForTier(opts.tier, ulk);
  if (specs.length === 0) return [];

  const [minSlots, maxSlots] = slotRange;
  const slotCount = minSlots + Math.floor(opts.rng() * (maxSlots - minSlots + 1));
  const slots: OrderGenSlot[] = [];
  const usedIds = new Set<string>();

  for (let i = 0; i < slotCount; i++) {
    for (let attempt = 0; attempt < 20; attempt++) {
      const spec = specs[Math.floor(opts.rng() * specs.length)]!;
      const itemId = pickItemFromProductSpec(
        spec, ulk, usedIds, opts.tier, opts.rng, opts.playerLevel,
      );
      if (itemId) {
        usedIds.add(itemId);
        slots.push({ itemId });
        break;
      }
    }
  }

  return slots;
}

function tryGenerateCombo(
  tier: OrderTier,
  ulk: UnlockedLines,
  rng: () => number,
  playerLevel: number,
): OrderGenSlot[] | null {
  const specs = productOrderSpecsForTier(tier, ulk);
  if (specs.length < 2) return null;

  const shuffled = [...specs].sort(() => rng() - 0.5);
  const first = shuffled[0]!;

  const second = shuffled.find(s => productSpecKey(s) !== productSpecKey(first));
  if (!second) return null;

  const used = new Set<string>();
  const slots: OrderGenSlot[] = [];

  const a = pickItemFromProductSpec(first, ulk, used, tier, rng, playerLevel);
  if (!a) return null;
  used.add(a);
  slots.push({ itemId: a });

  const b = pickItemFromProductSpec(second, ulk, used, tier, rng, playerLevel);
  if (!b) return null;
  slots.push({ itemId: b });

  if (
    rng() < ORDER_COMBO_THIRD_SLOT_CHANCE &&
    ulk.unlockedLineCount >= ORDER_COMBO_MIN_UNLOCKED_LINES_FOR_THIRD_SLOT
  ) {
    const third = shuffled.find(
      s => productSpecKey(s) !== productSpecKey(first) && productSpecKey(s) !== productSpecKey(second),
    );
    if (third) {
      const c = pickItemFromProductSpec(third, ulk, used, tier, rng, playerLevel);
      if (c) slots.push({ itemId: c });
    }
  }

  return slots;
}

type TimedCandidate = {
  itemId: string;
  productId: string;
  level: number;
};

function timedCandidatesForProduct(
  productId: OrderProductId,
  ulk: UnlockedLines,
): TimedCandidate[] {
  const product = getOrderProduct(productId);
  const cap = Math.min(product.maxLevel, productToolCap(productId, ulk) + 1);
  const out: TimedCandidate[] = [];
  for (let lv = TIMED_DIAMOND_ORDER_MIN_ITEM_LEVEL; lv <= cap; lv++) {
    const itemId = findItemId(product.category, product.itemLine, lv);
    if (itemId) out.push({ itemId, productId, level: lv });
  }
  return out;
}

function pickRandom<T>(arr: readonly T[], rng: () => number): T | null {
  if (arr.length === 0) return null;
  return arr[Math.floor(rng() * arr.length)] ?? null;
}

function shuffled<T>(arr: readonly T[], rng: () => number): T[] {
  return [...arr].sort(() => rng() - 0.5);
}

function buildTimedDiamondOrderSlots(ctx: OrderGenContext): OrderGenSlot[] | null {
  const grouped = unlockedOrderProducts(ctx.lines)
    .map(product => ({
      productId: product.id,
      candidates: timedCandidatesForProduct(product.id, ctx.lines),
    }))
    .filter(g => g.candidates.length > 0);
  if (grouped.length === 0) return null;

  const picked: TimedCandidate[] = [];
  const usedIds = new Set<string>();

  for (const g of shuffled(grouped, ctx.rng)) {
    if (picked.length >= TIMED_DIAMOND_ORDER_SLOT_COUNT) break;
    if (picked.some(p => p.productId === g.productId)) continue;
    const cand = pickRandom(g.candidates.filter(c => !usedIds.has(c.itemId)), ctx.rng);
    if (!cand) continue;
    picked.push(cand);
    usedIds.add(cand.itemId);
  }

  const allCandidates = shuffled(grouped.flatMap(g => g.candidates), ctx.rng);
  for (const cand of allCandidates) {
    if (picked.length >= TIMED_DIAMOND_ORDER_SLOT_COUNT) break;
    if (usedIds.has(cand.itemId)) continue;
    picked.push(cand);
    usedIds.add(cand.itemId);
  }

  if (picked.length !== TIMED_DIAMOND_ORDER_SLOT_COUNT) return null;
  return picked.map(c => ({ itemId: c.itemId }));
}

function timedDiamondOrderFromSlots(slots: OrderGenSlot[]): OrderGenResult {
  return {
    slots,
    orderType: 'timed',
    timeLimit: TIMED_DIAMOND_ORDER_TIME_LIMIT_SECONDS,
    diamondReward: computeTimedDiamondReward(slots),
    customerTypeId: DEFAULT_SPECIAL_CUSTOMER_BY_ORDER_KIND.timedDiamond,
    generationKind: 'timedDiamond',
  };
}

function tryGenerateTimedDiamondOrder(ctx: OrderGenContext): OrderGenResult | null {
  if (!ctx.allowTimedDiamondOrder) return null;
  if (ctx.playerLevel < TIMED_DIAMOND_ORDER_MIN_PLAYER_LEVEL) return null;

  const todayCount = Math.max(0, ctx.timedDiamondOrdersToday ?? 0);
  const chance = TIMED_DIAMOND_ORDER_BASE_CHANCE
    * (todayCount === 0 ? TIMED_DIAMOND_ORDER_FIRST_DAILY_CHANCE_MULT : 1);
  if (ctx.rng() >= chance) return null;

  const slots = buildTimedDiamondOrderSlots(ctx);
  if (!slots) return null;
  return timedDiamondOrderFromSlots(slots);
}

/** GM / 调试：跳过概率与每日上限，强制生成限时钻石单 */
export function forceGenerateTimedDiamondOrder(ctx: OrderGenContext): OrderGenResult | null {
  const slots = buildTimedDiamondOrderSlots(ctx);
  if (!slots) return null;
  return timedDiamondOrderFromSlots(slots);
}

/** 当前解锁工具能力下，订单槽位是否不超过 cap+1（与 aspirational 上限一致） */
export function validateOrderSlotsToolCap(
  slots: readonly { itemId: string }[],
  ulk: UnlockedLines,
): boolean {
  for (const s of slots) {
    const def = ITEM_DEFS.get(s.itemId);
    if (!def) return false;
    if (def.category !== Category.FLOWER && def.category !== Category.DRINK) continue;
    const cap = toolCapForLine(def.category, def.line, ulk);
    if (def.level > cap + 1) return false;
  }
  return true;
}

/**
 * 四季物语式「三连」链式订单占位：返回 null 表示当前未启用，后续可由活动配置接入。
 */
export function tryGenerateChainOrderTriple(_ctx: OrderGenContext): OrderGenResult | null {
  return null;
}

export function generateOrderDemands(ctx: OrderGenContext): OrderGenResult | null {
  const hook = getActivityOrderHook()?.(ctx);
  if (hook?.slots && hook.slots.length > 0) {
    const tierDef = ORDER_TIERS[ctx.tier];
    return {
      slots: hook.slots,
      orderType: hook.orderType ?? tierDef.orderType,
      timeLimit: hook.timeLimit ?? tierDef.timeLimit,
      diamondReward: hook.diamondReward,
      bonusMultiplier: hook.bonusMultiplier,
      customerTypeId: hook.customerTypeId,
      generationKind: 'eventStub',
    };
  }

  const { tier, lines, rng } = ctx;
  const tierDef = ORDER_TIERS[tier];

  const timed = tryGenerateTimedDiamondOrder(ctx);
  if (timed) return timed;

  const comboChance = orderComboEffectiveChance(lines, ctx.playerLevel);
  if (lines.unlockedLineCount >= 2 && rng() < comboChance) {
    const comboSlots = tryGenerateCombo(tier, lines, rng, ctx.playerLevel);
    if (comboSlots && comboSlots.length >= 2) {
      return {
        slots: comboSlots,
        orderType: 'challenge',
        timeLimit: null,
        generationKind: 'combo',
      };
    }
    console.debug('[OrderGen] combo roll missed (pool empty or pick failed), fallback to pool');
  }

  const triple = tryGenerateChainOrderTriple(ctx);
  if (triple) return triple;

  const slots = generateDemandsFromProductSpecs(tierDef.slotRange, lines, {
    rng,
    tier,
    playerLevel: ctx.playerLevel,
  });
  if (slots.length === 0) return null;

  return {
    slots,
    orderType: tierDef.orderType,
    timeLimit: tierDef.timeLimit,
    generationKind: 'basic',
  };
}
