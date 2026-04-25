/**
 * 订单需求生成：基础档池、饮品槽回退（蝴蝶/冷饮/甜品）、组合单、成长加成、活动钩子占位。
 */
import type { CustomerDemandDef } from '@/config/CustomerConfig';
import {
  ORDER_TIERS,
  getEffectiveMaxLevel,
  type OrderTier,
  type UnlockedLines,
} from '@/config/OrderTierConfig';
import {
  Category,
  DrinkLine,
  FlowerLine,
  ITEM_DEFS,
  findItemId,
  getMaxLevelForLine,
} from '@/config/ItemConfig';
import {
  ORDER_ASPIRATIONAL_LEVEL_BONUS_CHANCE,
  ORDER_COMBO_MIN_UNLOCKED_LINES_FOR_THIRD_SLOT,
  ORDER_COMBO_THIRD_SLOT_CHANCE,
  ORDER_GROWTH_BONUS_MULTIPLIER,
  ORDER_GROWTH_MIN_MAX_NORM,
  maxSlotNormForSlots,
  orderComboEffectiveChance,
  orderGrowthRollChance,
} from '@/config/OrderSpawnConfig';
import {
  type OrderGenContext,
  type OrderGenResult,
  type OrderGenerationKind,
  type OrderGenSlot,
  getActivityOrderHook,
} from './types';

export function toolCapForLine(category: Category, line: string, ulk: UnlockedLines): number {
  let toolLevel = 0;
  if (category === Category.FLOWER) {
    if (line === FlowerLine.FRESH || line === FlowerLine.GREEN) {
      toolLevel = ulk.maxPlantToolLevel;
    } else if (line === FlowerLine.BOUQUET) {
      toolLevel = Math.max(ulk.maxArrangeToolLevel, ulk.maxPlantToolLevel);
    }
  } else if (category === Category.DRINK) {
    toolLevel = ulk.drinkToolMaxByLine[line as DrinkLine] ?? 0;
  }
  const lineMax = Math.max(1, getMaxLevelForLine(category, line));
  return getEffectiveMaxLevel(toolLevel, lineMax);
}

function eligibleFlowerLines(demandLines: readonly string[], ulk: UnlockedLines): string[] {
  return demandLines.filter(line => {
    if (line === FlowerLine.BOUQUET) return ulk.hasBouquet;
    if (line === FlowerLine.GREEN) return ulk.hasGreen;
    return true;
  });
}

function eligibleDemandLines(demandDef: CustomerDemandDef, ulk: UnlockedLines): string[] {
  if (demandDef.category === Category.DRINK) {
    if (!ulk.hasDrink) return [];
    return demandDef.lines.filter(
      ln => (ulk.drinkToolMaxByLine[ln as DrinkLine] ?? 0) > 0,
    );
  }
  if (demandDef.category === Category.FLOWER) {
    return eligibleFlowerLines(demandDef.lines, ulk);
  }
  return [...demandDef.lines];
}

/** B 档在可产绿植后把 GREEN 纳入花需求池（与 ORDER_TIERS 解耦） */
function resolveDemandPool(tier: OrderTier, ulk: UnlockedLines): CustomerDemandDef[] {
  const base = ORDER_TIERS[tier].demandPool;
  if (tier === 'B' && ulk.hasGreen) {
    return base.map(d => {
      if (d.category !== Category.FLOWER) return d;
      const lines = d.lines.includes(FlowerLine.GREEN)
        ? d.lines
        : [...d.lines, FlowerLine.GREEN];
      return { ...d, lines };
    });
  }
  return base;
}

function fallbackFlowerDemand(tier: OrderTier, ulk: UnlockedLines): CustomerDemandDef {
  switch (tier) {
    case 'C':
      return { category: Category.FLOWER, lines: [FlowerLine.FRESH], levelRange: [1, 3] };
    case 'B':
      return {
        category: Category.FLOWER,
        lines: [
          FlowerLine.FRESH,
          FlowerLine.BOUQUET,
          ...(ulk.hasGreen ? [FlowerLine.GREEN] : []),
        ],
        levelRange: [2, 5],
      };
    case 'A':
      return {
        category: Category.FLOWER,
        lines: [
          FlowerLine.FRESH,
          FlowerLine.BOUQUET,
          ...(ulk.hasGreen ? [FlowerLine.GREEN] : []),
        ],
        levelRange: [4, 7],
      };
    case 'S':
      return {
        category: Category.FLOWER,
        lines: [FlowerLine.BOUQUET, ...(ulk.hasGreen ? [FlowerLine.GREEN] : [])],
        levelRange: [6, 13],
      };
    default:
      return { category: Category.FLOWER, lines: [FlowerLine.FRESH], levelRange: [1, 3] };
  }
}

function pickItemLevel(
  minLv: number,
  tierMaxLv: number,
  toolCap: number,
  maxItemLevel: number,
  rng: () => number,
): number {
  const aspirational = toolCap > 0 && rng() < ORDER_ASPIRATIONAL_LEVEL_BONUS_CHANCE;
  let hi = Math.min(tierMaxLv, toolCap + (aspirational ? 1 : 0), maxItemLevel);
  const lo = Math.min(minLv, hi);
  const span = hi - lo + 1;
  return lo + Math.floor(Math.pow(rng(), 1.4) * span);
}

function tryPickItem(
  demandDef: CustomerDemandDef,
  eligibleLines: string[],
  ulk: UnlockedLines,
  usedIds: Set<string>,
  rng: () => number,
): string | null {
  const [minLv, tierMaxLv] = demandDef.levelRange;

  for (let attempt = 0; attempt < 20; attempt++) {
    const line = eligibleLines[Math.floor(rng() * eligibleLines.length)];
    const lineMax = Math.max(1, getMaxLevelForLine(demandDef.category, line));
    const toolCap = toolCapForLine(demandDef.category, line, ulk);
    const level = pickItemLevel(minLv, tierMaxLv, toolCap, lineMax, rng);
    const cand = findItemId(demandDef.category, line, level);
    if (cand && !usedIds.has(cand)) {
      return cand;
    }
  }
  return null;
}

interface GeneratePoolOptions {
  rng: () => number;
  forceGreenFlowerSlot: boolean;
  tier: OrderTier;
}

function generateDemandsFromPool(
  pool: CustomerDemandDef[],
  slotRange: [number, number],
  ulk: UnlockedLines,
  opts: GeneratePoolOptions,
): OrderGenSlot[] {
  const [minSlots, maxSlots] = slotRange;
  const slotCount = minSlots + Math.floor(opts.rng() * (maxSlots - minSlots + 1));
  const slots: OrderGenSlot[] = [];
  const usedIds = new Set<string>();
  let greenPityUsed = false;

  for (let i = 0; i < slotCount; i++) {
    let demandDef = pool[Math.floor(opts.rng() * pool.length)]!;
    let eligibleLines = eligibleDemandLines(demandDef, ulk);

    if (eligibleLines.length === 0 && demandDef.category === Category.DRINK) {
      demandDef = fallbackFlowerDemand(opts.tier, ulk);
      eligibleLines = eligibleDemandLines(demandDef, ulk);
    }

    if (eligibleLines.length === 0) {
      if (pool.length > 1) continue;
      return [];
    }

    if (
      !greenPityUsed &&
      opts.forceGreenFlowerSlot &&
      demandDef.category === Category.FLOWER &&
      eligibleLines.includes(FlowerLine.GREEN)
    ) {
      eligibleLines = [FlowerLine.GREEN];
      greenPityUsed = true;
    }

    const itemId = tryPickItem(demandDef, eligibleLines, ulk, usedIds, opts.rng);
    if (itemId) {
      usedIds.add(itemId);
      slots.push({ itemId });
    }
  }

  return slots;
}

type ComboSpec = {
  category: Category;
  line: string;
  minLv: number;
  maxLv: number;
};

function comboSpecsForTier(tier: OrderTier, ulk: UnlockedLines): ComboSpec[] {
  const ranges: Record<OrderTier, { flower: [number, number]; drink: [number, number] }> = {
    C: { flower: [1, 3], drink: [1, 3] },
    B: { flower: [2, 4], drink: [2, 3] },
    A: { flower: [4, 6], drink: [3, 5] },
    S: { flower: [6, 13], drink: [5, 7] },
  };
  const r = ranges[tier];
  const out: ComboSpec[] = [];
  out.push({ category: Category.FLOWER, line: FlowerLine.FRESH, minLv: r.flower[0], maxLv: r.flower[1] });
  if (ulk.hasBouquet) {
    out.push({ category: Category.FLOWER, line: FlowerLine.BOUQUET, minLv: r.flower[0], maxLv: r.flower[1] });
  }
  if (ulk.hasGreen) {
    out.push({ category: Category.FLOWER, line: FlowerLine.GREEN, minLv: r.flower[0], maxLv: r.flower[1] });
  }
  if (ulk.hasDrink) {
    const drinkLines = [DrinkLine.BUTTERFLY, DrinkLine.COLD, DrinkLine.DESSERT];
    for (const dl of drinkLines) {
      if ((ulk.drinkToolMaxByLine[dl] ?? 0) <= 0) continue;
      out.push({ category: Category.DRINK, line: dl, minLv: r.drink[0], maxLv: r.drink[1] });
    }
  }
  return out.map(clampComboSpecToLineMax);
}

/** 产品线扩表后，组合单等级区间不超过该线 maxLevel */
function clampComboSpecToLineMax(spec: ComboSpec): ComboSpec {
  const cap = Math.max(1, getMaxLevelForLine(spec.category, spec.line));
  let minLv = Math.min(spec.minLv, cap);
  let maxLv = Math.min(spec.maxLv, cap);
  if (maxLv < minLv) maxLv = minLv;
  return { ...spec, minLv, maxLv };
}

function specKey(s: ComboSpec): string {
  return `${s.category}:${s.line}`;
}

function tryGenerateCombo(
  tier: OrderTier,
  ulk: UnlockedLines,
  rng: () => number,
  forceGreen: boolean,
): OrderGenSlot[] | null {
  const specs = comboSpecsForTier(tier, ulk);
  if (specs.length < 2) return null;

  const shuffled = [...specs].sort(() => rng() - 0.5);
  let first = shuffled[0]!;
  if (forceGreen) {
    const g = specs.find(s => s.line === FlowerLine.GREEN);
    if (g) first = g;
  }

  const second = shuffled.find(s => specKey(s) !== specKey(first));
  if (!second) return null;

  const used = new Set<string>();
  const slots: OrderGenSlot[] = [];

  const pickFromSpec = (spec: ComboSpec): string | null => {
    const toolCap = toolCapForLine(spec.category, spec.line, ulk);
    const lineMax = Math.max(1, getMaxLevelForLine(spec.category, spec.line));
    const aspirational = toolCap > 0 && rng() < ORDER_ASPIRATIONAL_LEVEL_BONUS_CHANCE;
    const hi = Math.min(spec.maxLv, toolCap + (aspirational ? 1 : 0), lineMax);
    const lo = Math.min(spec.minLv, hi);
    if (hi < lo) return null;
    const level = lo + Math.floor(Math.pow(rng(), 1.4) * (hi - lo + 1));
    const id = findItemId(spec.category, spec.line, level);
    if (id && !used.has(id)) return id;
    for (let lv = hi; lv >= lo; lv--) {
      const id2 = findItemId(spec.category, spec.line, lv);
      if (id2 && !used.has(id2)) return id2;
    }
    return null;
  };

  const a = pickFromSpec(first);
  if (!a) return null;
  used.add(a);
  slots.push({ itemId: a });

  const b = pickFromSpec(second);
  if (!b) return null;
  slots.push({ itemId: b });

  const tierDef = ORDER_TIERS[tier];
  const [, maxS] = tierDef.slotRange;
  if (
    maxS >= 3 &&
    rng() < ORDER_COMBO_THIRD_SLOT_CHANCE &&
    ulk.unlockedLineCount >= ORDER_COMBO_MIN_UNLOCKED_LINES_FOR_THIRD_SLOT
  ) {
    const third = shuffled.find(
      s => specKey(s) !== specKey(first) && specKey(s) !== specKey(second),
    );
    if (third) {
      const c = pickFromSpec(third);
      if (c) slots.push({ itemId: c });
    }
  }

  return slots;
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
      bonusMultiplier: hook.bonusMultiplier,
      generationKind: 'eventStub',
    };
  }

  const { tier, lines, rng } = ctx;
  const tierDef = ORDER_TIERS[tier];

  const comboChance = orderComboEffectiveChance(lines, ctx.playerLevel);
  if (lines.unlockedLineCount >= 2 && rng() < comboChance) {
    const comboSlots = tryGenerateCombo(tier, lines, rng, ctx.forceGreenFlowerSlot);
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

  let bonusMultiplier: number | undefined;
  let generationKind: OrderGenerationKind = 'basic';
  const growthRoll = rng() < orderGrowthRollChance(tier);
  if (growthRoll) {
    bonusMultiplier = ORDER_GROWTH_BONUS_MULTIPLIER;
    generationKind = 'growth';
  }

  const triple = tryGenerateChainOrderTriple(ctx);
  if (triple) return triple;

  const basePool = resolveDemandPool(tier, lines);
  let slots: OrderGenSlot[] = [];
  slots = generateDemandsFromPool(basePool, tierDef.slotRange, lines, {
    rng,
    forceGreenFlowerSlot: ctx.forceGreenFlowerSlot,
    tier,
  });
  if (slots.length === 0) return null;

  if (generationKind === 'growth' && maxSlotNormForSlots(slots) < ORDER_GROWTH_MIN_MAX_NORM) {
    bonusMultiplier = undefined;
    generationKind = 'basic';
  }

  return {
    slots,
    orderType: tierDef.orderType,
    timeLimit: tierDef.timeLimit,
    bonusMultiplier,
    generationKind,
  };
}
