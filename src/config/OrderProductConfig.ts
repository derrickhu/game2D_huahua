/**
 * 订单可需求产品定义 — 各产品独立配置等级区间、解锁与工具 cap。
 * 「产线」(line) 仅为 ItemConfig 物品查找键，不作为订单玩法分层；新增产品在此注册即可。
 */
import { Category, DrinkLine, FlowerLine } from './ItemConfig';
import { getEffectiveMaxLevel, type OrderTier, type UnlockedLines } from './OrderTierConfig';

export type OrderProductId =
  | 'fresh'
  | 'green'
  | 'bouquet'
  | 'butterfly'
  | 'cold'
  | 'dessert';

/** 注册顺序即扁平抽样池顺序（新增产品追加在末尾） */
export const ORDER_PRODUCT_IDS: readonly OrderProductId[] = [
  'fresh',
  'green',
  'bouquet',
  'butterfly',
  'cold',
  'dessert',
] as const;

export interface OrderProductDef {
  id: OrderProductId;
  category: Category;
  /** ItemConfig.findItemId 查找键（历史字段名 line） */
  itemLine: string;
  maxLevel: number;
  tierLevelRanges: Record<OrderTier, [number, number]>;
  isAvailableInTier: (tier: OrderTier) => boolean;
  isUnlocked: (ulk: UnlockedLines) => boolean;
  toolLevel: (ulk: UnlockedLines) => number;
}

const TIER_LEVELS: Record<OrderProductId, Record<OrderTier, [number, number]>> = {
  fresh: {
    C: [1, 3],
    B: [2, 5],
    A: [4, 8],
    S: [8, 13],
  },
  green: {
    C: [1, 3],
    B: [2, 5],
    A: [4, 8],
    S: [8, 13],
  },
  bouquet: {
    C: [1, 2],
    B: [2, 4],
    A: [3, 6],
    S: [6, 10],
  },
  butterfly: {
    C: [1, 3],
    B: [2, 4],
    A: [3, 6],
    S: [6, 10],
  },
  cold: {
    C: [1, 3],
    B: [2, 4],
    A: [3, 6],
    S: [5, 10],
  },
  dessert: {
    C: [1, 3],
    B: [2, 4],
    A: [3, 6],
    S: [6, 10],
  },
};

const DRINK_TIER_B_PLUS: (tier: OrderTier) => boolean = tier => tier === 'B' || tier === 'A' || tier === 'S';
const DRINK_TIER_A_S: (tier: OrderTier) => boolean = tier => tier === 'A' || tier === 'S';

export const ORDER_PRODUCT_DEFS: Record<OrderProductId, OrderProductDef> = {
  fresh: {
    id: 'fresh',
    category: Category.FLOWER,
    itemLine: FlowerLine.FRESH,
    maxLevel: 13,
    tierLevelRanges: TIER_LEVELS.fresh,
    isAvailableInTier: () => true,
    isUnlocked: ulk => ulk.maxPlantToolLevel > 0,
    toolLevel: ulk => ulk.maxPlantToolLevel,
  },
  green: {
    id: 'green',
    category: Category.FLOWER,
    itemLine: FlowerLine.GREEN,
    maxLevel: 13,
    tierLevelRanges: TIER_LEVELS.green,
    isAvailableInTier: () => true,
    isUnlocked: ulk => ulk.hasGreen && ulk.maxPlantToolLevel > 0,
    toolLevel: ulk => ulk.maxPlantToolLevel,
  },
  bouquet: {
    id: 'bouquet',
    category: Category.FLOWER,
    itemLine: FlowerLine.BOUQUET,
    maxLevel: 10,
    tierLevelRanges: TIER_LEVELS.bouquet,
    isAvailableInTier: tier => tier !== 'C',
    isUnlocked: ulk => ulk.hasBouquet,
    toolLevel: ulk => ulk.maxArrangeToolLevel,
  },
  butterfly: {
    id: 'butterfly',
    category: Category.DRINK,
    itemLine: DrinkLine.BUTTERFLY,
    maxLevel: 10,
    tierLevelRanges: TIER_LEVELS.butterfly,
    isAvailableInTier: DRINK_TIER_B_PLUS,
    isUnlocked: ulk => (ulk.drinkToolMaxByLine[DrinkLine.BUTTERFLY] ?? 0) > 0,
    toolLevel: ulk => ulk.drinkToolMaxByLine[DrinkLine.BUTTERFLY] ?? 0,
  },
  cold: {
    id: 'cold',
    category: Category.DRINK,
    itemLine: DrinkLine.COLD,
    maxLevel: 8,
    tierLevelRanges: TIER_LEVELS.cold,
    isAvailableInTier: DRINK_TIER_B_PLUS,
    isUnlocked: ulk => (ulk.drinkToolMaxByLine[DrinkLine.COLD] ?? 0) > 0,
    toolLevel: ulk => ulk.drinkToolMaxByLine[DrinkLine.COLD] ?? 0,
  },
  dessert: {
    id: 'dessert',
    category: Category.DRINK,
    itemLine: DrinkLine.DESSERT,
    maxLevel: 10,
    tierLevelRanges: TIER_LEVELS.dessert,
    isAvailableInTier: DRINK_TIER_A_S,
    isUnlocked: ulk => (ulk.drinkToolMaxByLine[DrinkLine.DESSERT] ?? 0) > 0,
    toolLevel: ulk => ulk.drinkToolMaxByLine[DrinkLine.DESSERT] ?? 0,
  },
};

export type ProductOrderSpec = {
  productId: OrderProductId;
  category: Category;
  itemLine: string;
  minLv: number;
  maxLv: number;
};

export function getOrderProduct(id: OrderProductId): OrderProductDef {
  return ORDER_PRODUCT_DEFS[id];
}

/** 由物品 category + itemLine 反查订单产品（包装中间品等返回 null） */
export function resolveOrderProduct(
  category: Category,
  itemLine: string,
): OrderProductDef | null {
  return ORDER_PRODUCT_IDS
    .map(id => ORDER_PRODUCT_DEFS[id])
    .find(p => p.category === category && p.itemLine === itemLine) ?? null;
}

export function productToolCap(productId: OrderProductId, ulk: UnlockedLines): number {
  const product = ORDER_PRODUCT_DEFS[productId];
  return getEffectiveMaxLevel(product.toolLevel(ulk), product.maxLevel);
}

/** 棋盘已解锁、可进限时单等的产品（不按模板档过滤） */
export function unlockedOrderProducts(ulk: UnlockedLines): OrderProductDef[] {
  return ORDER_PRODUCT_IDS
    .map(id => ORDER_PRODUCT_DEFS[id])
    .filter(p => p.isUnlocked(ulk));
}

/** 指定模板档下可扁平抽样的产品列表 */
export function orderProductsForTier(tier: OrderTier, ulk: UnlockedLines): OrderProductDef[] {
  return ORDER_PRODUCT_IDS
    .map(id => ORDER_PRODUCT_DEFS[id])
    .filter(p => p.isAvailableInTier(tier) && p.isUnlocked(ulk));
}

function clampLevelRange(
  minLv: number,
  maxLv: number,
  productMax: number,
): { minLv: number; maxLv: number } {
  let lo = Math.min(minLv, productMax);
  let hi = Math.min(maxLv, productMax);
  if (hi < lo) hi = lo;
  return { minLv: lo, maxLv: hi };
}

export function productOrderSpecsForTier(tier: OrderTier, ulk: UnlockedLines): ProductOrderSpec[] {
  return orderProductsForTier(tier, ulk).map(product => {
    const [lo, hi] = product.tierLevelRanges[tier];
    const { minLv, maxLv } = clampLevelRange(lo, hi, product.maxLevel);
    return {
      productId: product.id,
      category: product.category,
      itemLine: product.itemLine,
      minLv,
      maxLv,
    };
  });
}
