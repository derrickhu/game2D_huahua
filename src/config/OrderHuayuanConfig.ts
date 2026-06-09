/**
 * 订单交付花愿曲线（写入 ItemDef.orderHuayuan）与多槽位加成系数。
 * 具体订单总额在 CustomerManager 内按槽位 itemId 求和后再乘系数。
 *
 * 棋盘出售：`ItemDef.sellHuayuan` 由 `computeSellHuayuan(orderHuayuan)` 生成，固定且远低于订单单价。
 *
 * 数值原则：合成消耗约 2 个 (L−1) 得到一个 L，单价倍率应明显高于旧版 1.33，避免「拆单交低阶」长期优于合成高阶。
 */

/** 每多 1 个需求槽，对「单价之和」的加成比例（1/2/3 槽 = 1.0 / 1.1 / 1.2） */
export const MULTI_SLOT_BONUS_RATE = 0.10;

/** 组合单 / challenge 额外花愿倍率；1 = 无隐藏加成 */
export const CHALLENGE_ORDER_HUAYUAN_MULT = 1;

/**
 * 内容档位奖金：订单角标越高，额外补偿越明显。
 * S 单通常要求高阶/多线调度，单靠物品单价求和体感偏低，因此给大倍率拉开收益。
 */
export const ORDER_TIER_HUAYUAN_MULT = {
  C: 1,
  B: 1.2,
  A: 1.75,
  S: 2.7,
} as const;

/**
 * 单槽订单软保底：花愿不低于 factor×2×H(L−1)，缓和「H(L)/H(L−1) 仍低于 2」时的反合成体感。
 * 仅 FLOWER/DRINK 且 L>1；多槽不走此条，由 MULTI_SLOT_BONUS_RATE 体现。
 */
export const SINGLE_SLOT_MERGE_PARITY_FACTOR = 0.9;

/** 棋盘出售 = floor(order × 比例)，再封顶到 order、保底 1（仅当 order≥1）；不鼓励卖，仅腾格备选 */
export const ITEM_SELL_RATIO = 0.15;

export function computeSellHuayuan(orderHuayuan: number): number {
  if (!Number.isFinite(orderHuayuan) || orderHuayuan < 1) return 0;
  const raw = Math.floor(orderHuayuan * ITEM_SELL_RATIO);
  return Math.min(orderHuayuan, Math.max(1, raw));
}

export type OrderDeliveryCategory = 'flower' | 'drink' | 'food';
export type OrderDeliveryLine =
  | 'fresh'
  | 'bouquet'
  | 'green'
  | 'butterfly'
  | 'cold'
  | 'dessert'
  | 'cut_avocado'
  | 'cut_watermelon'
  | 'cut_pineapple'
  | 'cut_dragonfruit';

export interface OrderDeliveryCurve {
  /** L1 单价基准 */
  base: number;
  /** 线内逐级增长率 */
  growth: number;
}

/**
 * 订单单品定价曲线。
 * 同等级不再全线同价：每条产品线按自身产出成本、直出稀有度和中间品链路独立调参。
 */
export const ORDER_DELIVERY_CURVES: Record<OrderDeliveryCategory, Record<string, OrderDeliveryCurve>> = {
  flower: {
    /** 鲜花：园艺主线，作为花系经济基准 */
    fresh: { base: 12, growth: 1.5 },
    /** 花束：需要包装中间品与花艺材料篮二段产出，补偿额外体力与链路成本 */
    bouquet: { base: 14, growth: 1.51 },
    /** 绿植：与鲜花共用园艺工具，但高阶直出权重更低，中后期略高于鲜花 */
    green: { base: 12, growth: 1.52 },
  },
  drink: {
    /** 蝴蝶：捕虫网高阶可直出到 L10，单价略收敛 */
    butterfly: { base: 12, growth: 1.45 },
    /** 冷饮：最高工具只直出到 L3，后段合成压力最大 */
    cold: { base: 14, growth: 1.5 },
    /** 甜品：最高工具可直出到 L7，介于蝴蝶与冷饮之间 */
    dessert: { base: 13, growth: 1.49 },
  },
  /** 果切单价见 deliverHuayuanForFruitCut（顺链对标花束，不走独立曲线） */
  food: {},
};

/**
 * 果切全链顺位（与整果 L1→L4 一致）：牛油果 L1–3 → 菠萝 L1–3 → 火龙果 L1–3 → 西瓜 L1–3，
 * 共 12 步；全链几何平滑：起点 = 花束 L1 × 90%，终点 = 300 花愿（西瓜 L3 顶格）。
 */
const FRUIT_CUT_LINE_CHAIN: readonly OrderDeliveryLine[] = [
  'cut_avocado',
  'cut_pineapple',
  'cut_dragonfruit',
  'cut_watermelon',
];

const FRUIT_CUT_CHAIN_STEPS = 12;

/** 链首锚点：相对花束 L1 的折扣 */
const FRUIT_CUT_VS_BOUQUET_RATIO = 0.9;

/** 果切全链最高价（西瓜 L3 顶格） */
const FRUIT_CUT_MAX_HY = 300;

function deliverHuayuanForCurve(level: number, curve: OrderDeliveryCurve): number {
  if (!Number.isFinite(level) || level < 1) return 0;
  return Math.max(1, Math.round(curve.base * curve.growth ** (Math.floor(level) - 1)));
}

function fruitCutGlobalTier(line: string, level: number): number {
  const idx = FRUIT_CUT_LINE_CHAIN.indexOf(line as OrderDeliveryLine);
  if (idx < 0 || !Number.isFinite(level) || level < 1) return 0;
  return idx * 3 + Math.floor(level);
}

function deliverHuayuanForFruitCut(line: string, level: number): number {
  const globalTier = fruitCutGlobalTier(line, level);
  if (globalTier < 1) return 0;
  const bouquetCurve = ORDER_DELIVERY_CURVES.flower.bouquet;
  const startHy = Math.max(
    1,
    Math.round(deliverHuayuanForCurve(1, bouquetCurve) * FRUIT_CUT_VS_BOUQUET_RATIO),
  );
  const t = (globalTier - 1) / (FRUIT_CUT_CHAIN_STEPS - 1);
  return Math.max(1, Math.round(startHy * (FRUIT_CUT_MAX_HY / startHy) ** t));
}

/** 指定产品线的单笔交付单价；未知线返回 0，避免误把包装/工具线纳入订单价值。 */
export function deliverHuayuanForItem(
  category: OrderDeliveryCategory,
  line: string,
  level: number,
): number {
  if (category === 'food' && line.startsWith('cut_')) {
    return deliverHuayuanForFruitCut(line, level);
  }
  const curve = ORDER_DELIVERY_CURVES[category]?.[line];
  return curve ? deliverHuayuanForCurve(level, curve) : 0;
}
