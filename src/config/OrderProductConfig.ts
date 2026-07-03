/**
 * 订单可需求产品定义：把玩法产品与 ItemConfig 的 line 解耦，便于独立配置解锁、工具 cap 与档位区间。
 */
import { Category, DrinkLine, FlowerLine, FoodLine, fruitCutLevelForToolLevel } from './ItemConfig';
import { getEffectiveMaxLevel, type OrderTier, type UnlockedLines } from './OrderTierConfig';

export type OrderProductId =
  | 'fresh'
  | 'green'
  | 'bouquet'
  | 'butterfly'
  | 'cold'
  | 'dessert'
  | 'cut_avocado'
  | 'cut_watermelon'
  | 'cut_pineapple'
  | 'cut_dragonfruit';

export const ORDER_PRODUCT_IDS: readonly OrderProductId[] = [
  'fresh',
  'green',
  'bouquet',
  'butterfly',
  'cold',
  'dessert',
  'cut_avocado',
  'cut_watermelon',
  'cut_pineapple',
  'cut_dragonfruit',
] as const;

export interface OrderProductDef {
  id: OrderProductId;
  category: Category;
  /** ItemConfig.findItemId 的 line 键。 */
  itemLine: string;
  maxLevel: number;
  tierLevelRanges: Record<OrderTier, [number, number] | null>;
  isUnlocked: (ulk: UnlockedLines) => boolean;
  toolLevel: (ulk: UnlockedLines) => number;
  /**
   * 保留当前正式版的花/饮品池体感：
   * B 档饮品单品权重大于花系单品；A/S 全产品等权。
   */
  weightByTier: Record<OrderTier, number>;
}

const FLOWER_WEIGHT: Record<OrderTier, number> = { C: 1, B: 1, A: 1, S: 1 };
const DRINK_B_PLUS_WEIGHT: Record<OrderTier, number> = { C: 0, B: 1.5, A: 1, S: 1 };
const DESSERT_WEIGHT: Record<OrderTier, number> = { C: 0, B: 0, A: 1, S: 1 };
const FOOD_C_B_WEIGHT: Record<OrderTier, number> = { C: 1, B: 1, A: 0, S: 0 };
const FOOD_B_ONLY_WEIGHT: Record<OrderTier, number> = { C: 0, B: 1, A: 0, S: 0 };
const FOOD_B_A_WEIGHT: Record<OrderTier, number> = { C: 0, B: 1, A: 1, S: 0 };
const FOOD_B_A_S_WEIGHT: Record<OrderTier, number> = { C: 0, B: 1, A: 1, S: 1 };
const FRUIT_CUT_ORDER_POOL_WEIGHT = 0.75;

/** 棋盘同时有可产出农田（L3+）与果切工具时，才允许刷果切订单。 */
export function hasFruitCutOrderCapability(ulk: UnlockedLines): boolean {
  return ulk.maxFarmToolLevel >= 3 && ulk.maxFruitCutToolLevel >= 1;
}

export const ORDER_PRODUCT_DEFS: Record<OrderProductId, OrderProductDef> = {
  fresh: {
    id: 'fresh',
    category: Category.FLOWER,
    itemLine: FlowerLine.FRESH,
    maxLevel: 13,
    tierLevelRanges: {
      C: [1, 3],
      B: [2, 5],
      A: [4, 7],
      S: [6, 13],
    },
    isUnlocked: ulk => ulk.maxPlantToolLevel > 0,
    toolLevel: ulk => ulk.maxPlantToolLevel,
    weightByTier: FLOWER_WEIGHT,
  },
  green: {
    id: 'green',
    category: Category.FLOWER,
    itemLine: FlowerLine.GREEN,
    maxLevel: 13,
    tierLevelRanges: {
      C: [1, 3],
      B: [2, 5],
      A: [4, 7],
      S: [6, 13],
    },
    isUnlocked: ulk => ulk.hasGreen && ulk.maxPlantToolLevel > 0,
    toolLevel: ulk => ulk.maxPlantToolLevel,
    weightByTier: FLOWER_WEIGHT,
  },
  bouquet: {
    id: 'bouquet',
    category: Category.FLOWER,
    itemLine: FlowerLine.BOUQUET,
    maxLevel: 10,
    tierLevelRanges: {
      C: null,
      B: [2, 5],
      A: [4, 7],
      S: [6, 10],
    },
    isUnlocked: ulk => ulk.hasBouquet && ulk.maxArrangeToolLevel > 0,
    toolLevel: ulk => ulk.maxArrangeToolLevel,
    weightByTier: FLOWER_WEIGHT,
  },
  butterfly: {
    id: 'butterfly',
    category: Category.DRINK,
    itemLine: DrinkLine.BUTTERFLY,
    maxLevel: 10,
    tierLevelRanges: {
      C: null,
      B: [2, 4],
      A: [3, 6],
      S: [5, 10],
    },
    isUnlocked: ulk => (ulk.drinkToolMaxByLine[DrinkLine.BUTTERFLY] ?? 0) > 0,
    toolLevel: ulk => ulk.drinkToolMaxByLine[DrinkLine.BUTTERFLY] ?? 0,
    weightByTier: DRINK_B_PLUS_WEIGHT,
  },
  cold: {
    id: 'cold',
    category: Category.DRINK,
    itemLine: DrinkLine.COLD,
    maxLevel: 8,
    tierLevelRanges: {
      C: null,
      B: [2, 4],
      A: [3, 6],
      S: [5, 8],
    },
    isUnlocked: ulk => (ulk.drinkToolMaxByLine[DrinkLine.COLD] ?? 0) > 0,
    toolLevel: ulk => ulk.drinkToolMaxByLine[DrinkLine.COLD] ?? 0,
    weightByTier: DRINK_B_PLUS_WEIGHT,
  },
  dessert: {
    id: 'dessert',
    category: Category.DRINK,
    itemLine: DrinkLine.DESSERT,
    maxLevel: 10,
    tierLevelRanges: {
      C: null,
      B: null,
      A: [3, 6],
      S: [5, 10],
    },
    isUnlocked: ulk => (ulk.drinkToolMaxByLine[DrinkLine.DESSERT] ?? 0) > 0,
    toolLevel: ulk => ulk.drinkToolMaxByLine[DrinkLine.DESSERT] ?? 0,
    weightByTier: DESSERT_WEIGHT,
  },
  cut_avocado: {
    id: 'cut_avocado',
    category: Category.FOOD,
    itemLine: FoodLine.CUT_AVOCADO,
    maxLevel: 3,
    tierLevelRanges: {
      C: [1, 1],
      B: [1, 3],
      A: null,
      S: null,
    },
    isUnlocked: ulk =>
      hasFruitCutOrderCapability(ulk) && (ulk.foodToolMaxByLine[FoodLine.CUT_AVOCADO] ?? 0) > 0,
    toolLevel: ulk => ulk.foodToolMaxByLine[FoodLine.CUT_AVOCADO] ?? 0,
    weightByTier: FOOD_C_B_WEIGHT,
  },
  cut_watermelon: {
    id: 'cut_watermelon',
    category: Category.FOOD,
    itemLine: FoodLine.CUT_WATERMELON,
    maxLevel: 3,
    tierLevelRanges: {
      C: null,
      B: [1, 1],
      A: [2, 2],
      S: [2, 3],
    },
    isUnlocked: ulk =>
      hasFruitCutOrderCapability(ulk) && (ulk.foodToolMaxByLine[FoodLine.CUT_WATERMELON] ?? 0) > 0,
    toolLevel: ulk => ulk.foodToolMaxByLine[FoodLine.CUT_WATERMELON] ?? 0,
    weightByTier: FOOD_B_A_S_WEIGHT,
  },
  cut_pineapple: {
    id: 'cut_pineapple',
    category: Category.FOOD,
    itemLine: FoodLine.CUT_PINEAPPLE,
    maxLevel: 3,
    tierLevelRanges: {
      C: null,
      B: [1, 2],
      A: null,
      S: null,
    },
    isUnlocked: ulk =>
      hasFruitCutOrderCapability(ulk) && (ulk.foodToolMaxByLine[FoodLine.CUT_PINEAPPLE] ?? 0) > 0,
    toolLevel: ulk => ulk.foodToolMaxByLine[FoodLine.CUT_PINEAPPLE] ?? 0,
    weightByTier: FOOD_B_ONLY_WEIGHT,
  },
  cut_dragonfruit: {
    id: 'cut_dragonfruit',
    category: Category.FOOD,
    itemLine: FoodLine.CUT_DRAGONFRUIT,
    maxLevel: 3,
    tierLevelRanges: {
      C: null,
      B: [1, 2],
      A: [2, 3],
      S: null,
    },
    isUnlocked: ulk =>
      hasFruitCutOrderCapability(ulk) && (ulk.foodToolMaxByLine[FoodLine.CUT_DRAGONFRUIT] ?? 0) > 0,
    toolLevel: ulk => ulk.foodToolMaxByLine[FoodLine.CUT_DRAGONFRUIT] ?? 0,
    weightByTier: FOOD_B_A_WEIGHT,
  },
};

export type ProductOrderSpec = {
  productId: OrderProductId;
  category: Category;
  itemLine: string;
  minLv: number;
  maxLv: number;
  weight: number;
};

export function getOrderProduct(id: OrderProductId): OrderProductDef {
  return ORDER_PRODUCT_DEFS[id];
}

export function resolveOrderProduct(category: Category, itemLine: string): OrderProductDef | null {
  return ORDER_PRODUCT_IDS
    .map(id => ORDER_PRODUCT_DEFS[id])
    .find(product => product.category === category && product.itemLine === itemLine) ?? null;
}

export function productToolCap(productId: OrderProductId, ulk: UnlockedLines): number {
  const product = ORDER_PRODUCT_DEFS[productId];
  if (product.category === Category.FOOD) {
    return Math.min(fruitCutLevelForToolLevel(product.toolLevel(ulk)), product.maxLevel);
  }
  return getEffectiveMaxLevel(product.toolLevel(ulk), product.maxLevel);
}

export function unlockedOrderProducts(ulk: UnlockedLines): OrderProductDef[] {
  return ORDER_PRODUCT_IDS
    .map(id => ORDER_PRODUCT_DEFS[id])
    .filter(product => product.isUnlocked(ulk));
}

function productSpecsForRange(
  ids: readonly OrderProductId[],
  range: [number, number],
  ulk: UnlockedLines,
  poolWeight: number,
): ProductOrderSpec[] {
  const products = ids
    .map(id => ORDER_PRODUCT_DEFS[id])
    .filter(product => product.isUnlocked(ulk));
  if (products.length === 0) return [];

  return products.map(product => {
    const { minLv, maxLv } = clampLevelRange(range[0], range[1], product.maxLevel);
    return {
      productId: product.id,
      category: product.category,
      itemLine: product.itemLine,
      minLv,
      maxLv,
      weight: poolWeight / products.length,
    };
  });
}

function productSpecsForTierRanges(
  ids: readonly OrderProductId[],
  tier: OrderTier,
  ulk: UnlockedLines,
  poolWeight: number,
): ProductOrderSpec[] {
  const products = ids
    .map(id => ORDER_PRODUCT_DEFS[id])
    .filter(product => product.isUnlocked(ulk) && product.tierLevelRanges[tier] !== null);
  if (products.length === 0) return [];

  return products.map(product => {
    const range = product.tierLevelRanges[tier]!;
    const { minLv, maxLv } = clampLevelRange(range[0], range[1], product.maxLevel);
    return {
      productId: product.id,
      category: product.category,
      itemLine: product.itemLine,
      minLv,
      maxLv,
      weight: poolWeight / products.length,
    };
  });
}

function clampLevelRange(
  minLv: number,
  maxLv: number,
  productMax: number,
): { minLv: number; maxLv: number } {
  const minClamped = Math.min(minLv, productMax);
  const maxClamped = Math.min(maxLv, productMax);
  return {
    minLv: minClamped,
    maxLv: Math.max(minClamped, maxClamped),
  };
}

export function productOrderSpecsForTier(tier: OrderTier, ulk: UnlockedLines): ProductOrderSpec[] {
  const flowerIds: readonly OrderProductId[] = ['fresh', 'bouquet', 'green'];
  const simpleFlowerIds: readonly OrderProductId[] = ['fresh', 'green'];
  const drinkBIds: readonly OrderProductId[] = ['butterfly', 'cold'];
  const drinkAllIds: readonly OrderProductId[] = ['butterfly', 'cold', 'dessert'];
  const foodCIds: readonly OrderProductId[] = ['cut_avocado'];
  const foodBIds: readonly OrderProductId[] = [
    'cut_avocado',
    'cut_watermelon',
    'cut_pineapple',
    'cut_dragonfruit',
  ];
  const foodAIds: readonly OrderProductId[] = ['cut_watermelon', 'cut_dragonfruit'];
  const foodSIds: readonly OrderProductId[] = ['cut_watermelon'];

  switch (tier) {
    case 'C':
      // 复刻旧正式版：两个花类池各 50%，再在鲜花/绿植内均分。
      return [
        ...productSpecsForRange(simpleFlowerIds, [1, 2], ulk, 1),
        ...productSpecsForRange(simpleFlowerIds, [2, 3], ulk, 1),
        ...productSpecsForTierRanges(foodCIds, tier, ulk, FRUIT_CUT_ORDER_POOL_WEIGHT),
      ];
    case 'B':
      return [
        ...productSpecsForRange(flowerIds, [2, 5], ulk, 1),
        ...productSpecsForRange(drinkBIds, [2, 4], ulk, 1),
        ...productSpecsForTierRanges(foodBIds, tier, ulk, FRUIT_CUT_ORDER_POOL_WEIGHT),
      ];
    case 'A':
      return [
        ...productSpecsForRange(flowerIds, [4, 7], ulk, 1),
        ...productSpecsForRange(drinkAllIds, [3, 6], ulk, 1),
        ...productSpecsForTierRanges(foodAIds, tier, ulk, FRUIT_CUT_ORDER_POOL_WEIGHT),
      ];
    case 'S':
      return [
        ...productSpecsForRange(flowerIds, [6, 13], ulk, 1),
        ...productSpecsForRange(drinkAllIds, [5, 10], ulk, 1),
        ...productSpecsForTierRanges(foodSIds, tier, ulk, FRUIT_CUT_ORDER_POOL_WEIGHT),
      ];
    default:
      return [];
  }
}

export function comboOrderSpecsForTier(tier: OrderTier, ulk: UnlockedLines): ProductOrderSpec[] {
  const ranges: Record<OrderTier, { flower: [number, number]; drink: [number, number] }> = {
    C: { flower: [1, 3], drink: [1, 3] },
    B: { flower: [2, 4], drink: [2, 3] },
    A: { flower: [4, 7], drink: [4, 6] },
    S: { flower: [7, 13], drink: [6, 10] },
  };
  const r = ranges[tier];
  return [
    ...productSpecsForRange(['fresh', 'bouquet', 'green'], r.flower, ulk, 1),
    ...productSpecsForRange(['butterfly', 'cold', 'dessert'], r.drink, ulk, 1),
    ...productSpecsForTierRanges(
      ['cut_avocado', 'cut_watermelon', 'cut_pineapple', 'cut_dragonfruit'],
      tier,
      ulk,
      FRUIT_CUT_ORDER_POOL_WEIGHT,
    ),
  ];
}
