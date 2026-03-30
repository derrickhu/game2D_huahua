/**
 * 订单分级配置 — C(初) / B(中) / A(高) / S(特) 四档
 *
 * 每档定义需求槽数、物品等级范围、可用产线、奖励区间。
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
  huayuanRange: [number, number];
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
    huayuanRange: [10, 30],
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
    huayuanRange: [30, 80],
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
    huayuanRange: [60, 150],
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
    huayuanRange: [120, 300],
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

/**
 * 按玩家等级 + 已解锁产线 + 工具等级综合计算各档出现权重。
 * 核心原则：只要棋盘上有产出工具就不应该全出 C 档；工具越高级、高档订单越多。
 */
export function getOrderTierWeights(
  playerLevel: number,
  lines: UnlockedLines,
): Record<OrderTier, number> {
  const maxTool = _maxToolLevel(lines);
  const hasAnyProducer = maxTool >= 3;

  if (playerLevel <= 2) {
    if (!hasAnyProducer) return { C: 100, B: 0, A: 0, S: 0 };
    if (maxTool >= 4 || lines.hasBouquet || lines.hasDrink) return { C: 30, B: 60, A: 10, S: 0 };
    return { C: 60, B: 40, A: 0, S: 0 };
  }
  if (playerLevel <= 4) {
    if (lines.hasBouquet || lines.hasDrink) return { C: 20, B: 50, A: 30, S: 0 };
    if (maxTool >= 4) return { C: 30, B: 50, A: 20, S: 0 };
    return { C: 40, B: 50, A: 10, S: 0 };
  }
  if (playerLevel <= 7) {
    return { C: 10, B: 30, A: 40, S: lines.hasGreen ? 20 : 10 };
  }
  if (playerLevel <= 9) {
    return { C: 5, B: 25, A: 40, S: 30 };
  }
  return { C: 5, B: 20, A: 40, S: 35 };
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
