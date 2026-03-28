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
  hualuChance: number;
  expReward: number;
  /** 预留：限时秒数，null = 不限时 */
  timeLimit: number | null;
  /** 预留：订单子类型 */
  orderType: OrderType;
}

export const ORDER_TIERS: Record<OrderTier, OrderTierDef> = {
  C: {
    tier: 'C',
    label: '初级',
    slotRange: [1, 1],
    demandPool: [
      { category: Category.FLOWER, lines: [FlowerLine.FRESH], levelRange: [1, 3] },
    ],
    huayuanRange: [10, 30],
    hualuChance: 0,
    expReward: 8,
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
    hualuChance: 0.15,
    expReward: 15,
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
    hualuChance: 0.3,
    expReward: 25,
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
    hualuChance: 0.5,
    expReward: 40,
    timeLimit: null,
    orderType: 'normal',
  },
};

export interface UnlockedLines {
  hasBouquet: boolean;
  hasGreen: boolean;
  hasDrink: boolean;
}

/**
 * 按玩家等级 + 已解锁产线计算各档出现权重。
 * 返回 Record<OrderTier, number>，值为 0 的档不会出现。
 */
export function getOrderTierWeights(
  playerLevel: number,
  lines: UnlockedLines,
): Record<OrderTier, number> {
  if (playerLevel <= 2 && !lines.hasBouquet && !lines.hasDrink) {
    return { C: 100, B: 0, A: 0, S: 0 };
  }
  if (playerLevel <= 4) {
    const b = (lines.hasBouquet || lines.hasDrink) ? 50 : 10;
    return { C: 50, B: b, A: 0, S: 0 };
  }
  if (playerLevel <= 7) {
    return { C: 20, B: 50, A: lines.hasGreen ? 30 : 10, S: 0 };
  }
  if (playerLevel <= 9) {
    return { C: 10, B: 40, A: 40, S: 10 };
  }
  return { C: 5, B: 30, A: 40, S: 25 };
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
