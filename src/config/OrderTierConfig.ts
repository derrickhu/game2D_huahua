/**
 * 订单分级配置 — C(初) / B(中) / A(高) / S(特) 四档
 *
 * 每档定义需求槽数、物品等级范围、可用产线。花愿由物品单价 + 多槽加成计算。
 * CustomerManager 按玩家等级 + 已解锁产线动态选档后生成具体需求。
 */
import { Category, FlowerLine, DrinkLine } from './ItemConfig';
import type { CustomerDemandDef } from './CustomerConfig';

export type OrderTier = 'C' | 'B' | 'A' | 'S';

export type OrderType = 'normal' | 'timed' | 'chain' | 'challenge';

export interface OrderTierDef {
  tier: OrderTier;
  label: string;
  slotRange: [number, number];
  /** 该档可选的需求池（每个槽位从中随机取一条） */
  demandPool: CustomerDemandDef[];
  /** 预留：限时秒数，null = 不限时 */
  timeLimit: number | null;
  /** 预留：订单子类型 */
  orderType: OrderType;
}

export const ORDER_TIERS: Record<OrderTier, OrderTierDef> = {
  C: {
    tier: 'C',
    label: '初级',
    slotRange: [1, 2],
    demandPool: [
      { category: Category.FLOWER, lines: [FlowerLine.FRESH], levelRange: [1, 3] },
    ],
    timeLimit: null,
    orderType: 'normal',
  },
  B: {
    tier: 'B',
    label: '中级',
    slotRange: [2, 2],
    demandPool: [
      { category: Category.FLOWER, lines: [FlowerLine.FRESH, FlowerLine.BOUQUET], levelRange: [2, 5] },
      { category: Category.DRINK, lines: [DrinkLine.TEA, DrinkLine.COLD], levelRange: [2, 4] },
    ],
    timeLimit: null,
    orderType: 'normal',
  },
  A: {
    tier: 'A',
    label: '高级',
    slotRange: [2, 2],
    demandPool: [
      { category: Category.FLOWER, lines: [FlowerLine.FRESH, FlowerLine.BOUQUET, FlowerLine.GREEN], levelRange: [4, 7] },
      { category: Category.DRINK, lines: [DrinkLine.TEA, DrinkLine.COLD, DrinkLine.DESSERT], levelRange: [3, 6] },
    ],
    timeLimit: null,
    orderType: 'normal',
  },
  S: {
    tier: 'S',
    label: '特级',
    slotRange: [2, 3],
    demandPool: [
      { category: Category.FLOWER, lines: [FlowerLine.BOUQUET, FlowerLine.GREEN], levelRange: [6, 10] },
      { category: Category.DRINK, lines: [DrinkLine.COLD, DrinkLine.DESSERT], levelRange: [5, 8] },
    ],
    timeLimit: null,
    orderType: 'normal',
  },
};

export interface UnlockedLines {
  hasBouquet: boolean;
  hasGreen: boolean;
  hasDrink: boolean;
  /** 棋盘上最高的园艺工具等级（0=无） */
  maxPlantToolLevel: number;
  /** 棋盘上最高的包装工具等级（0=无） */
  maxArrangeToolLevel: number;
  /** 棋盘上最高的饮品工具等级（取三线最大值，0=无） */
  maxDrinkToolLevel: number;
  /** 已解锁可产出的独立产线数（花束/绿植/各饮品线），用于动态客人上限 */
  unlockedLineCount: number;
}

/** 棋盘上最高工具等级（取所有线的最大值） */
function _maxToolLevel(lines: UnlockedLines): number {
  return Math.max(lines.maxPlantToolLevel, lines.maxArrangeToolLevel, lines.maxDrinkToolLevel);
}

/** 订单档位权重的会话修正（如解锁新产线后短期偏置） */
export interface OrderTierWeightModifiers {
  /** 解锁绿植后剩余「加成刷次」：提高 A/S 权重，便于尽快见到绿植单 */
  greenLineUnlockBoostSpawns?: number;
}

function _applyGreenBoost(
  w: Record<OrderTier, number>,
  lines: UnlockedLines,
  boostSpawns: number | undefined,
): Record<OrderTier, number> {
  if (!boostSpawns || boostSpawns <= 0 || !lines.hasGreen) return w;
  const out = { ...w };
  // 从 B/C 挪到 A/S，让含绿植池的档位更容易出现
  const takeB = Math.min(out.B, 12);
  const takeC = Math.min(out.C, 8);
  out.B = out.B - takeB;
  out.C = out.C - takeC;
  const add = takeB + takeC;
  out.A = out.A + Math.floor(add * 0.65);
  out.S = out.S + (add - Math.floor(add * 0.65));
  return out;
}

/**
 * 按玩家等级 + 已解锁产线 + 工具等级综合计算各档出现权重。
 * 核心原则：只要棋盘上有产出工具就不应该全出 C 档；工具越高级、高档订单越多。
 */
export function getOrderTierWeights(
  playerLevel: number,
  lines: UnlockedLines,
  modifiers?: OrderTierWeightModifiers,
): Record<OrderTier, number> {
  const maxTool = _maxToolLevel(lines);
  const hasAnyProducer = maxTool >= 3;

  let base: Record<OrderTier, number>;
  if (playerLevel <= 2) {
    if (!hasAnyProducer) base = { C: 100, B: 0, A: 0, S: 0 };
    else if (maxTool >= 4 || lines.hasBouquet || lines.hasDrink) base = { C: 30, B: 60, A: 10, S: 0 };
    else base = { C: 60, B: 40, A: 0, S: 0 };
  } else if (playerLevel <= 4) {
    if (lines.hasBouquet || lines.hasDrink) base = { C: 20, B: 50, A: 30, S: 0 };
    else if (maxTool >= 4) base = { C: 30, B: 50, A: 20, S: 0 };
    else base = { C: 40, B: 50, A: 10, S: 0 };
  } else if (playerLevel <= 7) {
    base = { C: 10, B: 30, A: 40, S: lines.hasGreen ? 20 : 10 };
  } else if (playerLevel <= 9) {
    base = { C: 5, B: 25, A: 40, S: 30 };
  } else {
    base = { C: 5, B: 20, A: 40, S: 35 };
  }

  return _applyGreenBoost(base, lines, modifiers?.greenLineUnlockBoostSpawns);
}

/** 按权重随机选一个档位 */
export function pickTierByWeight(weights: Record<OrderTier, number>): OrderTier {
  const entries = (Object.entries(weights) as [OrderTier, number][]).filter(([, w]) => w > 0);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  if (total <= 0) return 'C';
  let r = Math.random() * total;
  for (const [tier, w] of entries) {
    r -= w;
    if (r <= 0) return tier;
  }
  return entries[entries.length - 1][0];
}

/** 订单档位在 UI 上的颜色（角标/边框） */
export const TIER_COLORS: Record<OrderTier, number> = {
  C: 0x78b87a,
  B: 0x5c9edf,
  A: 0xd4a040,
  S: 0xc55a8a,
};

/**
 * 根据工具等级推算订单可要求的物品等级上限。
 * 游戏核心是合成——工具产出低级品，玩家多次合成即可达到高级品，因此不以工具直产等级为上限。
 * 公式: min(toolLevel * 2 − 1, maxItemLevel)
 */
export function getEffectiveMaxLevel(toolLevel: number, maxItemLevel: number): number {
  if (toolLevel <= 0) return 0;
  return Math.min(toolLevel * 2 - 1, maxItemLevel);
}

const DYNAMIC_MAX_CUSTOMERS_BASE = 3;
const DYNAMIC_MAX_CUSTOMERS_CAP = 8;

/** 根据已解锁产线数计算客人上限：基础 3 + 每条产线 +1，上限 8 */
export function getDynamicMaxCustomers(lines: UnlockedLines): number {
  return Math.min(DYNAMIC_MAX_CUSTOMERS_BASE + lines.unlockedLineCount, DYNAMIC_MAX_CUSTOMERS_CAP);
}
