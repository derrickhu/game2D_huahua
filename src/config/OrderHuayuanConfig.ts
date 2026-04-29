/**
 * 订单交付花愿曲线（写入 ItemDef.orderHuayuan）与多槽位加成系数。
 * 具体订单总额在 CustomerManager 内按槽位 itemId 求和后再乘系数。
 *
 * 棋盘出售：`ItemDef.sellHuayuan` 由 `computeSellHuayuan(orderHuayuan)` 生成，固定且远低于订单单价。
 *
 * 数值原则：合成消耗约 2 个 (L−1) 得到一个 L，单价倍率应明显高于旧版 1.33，避免「拆单交低阶」长期优于合成高阶。
 */

/** 每多 1 个需求槽，对「单价之和」的加成比例（2 槽 = 1+k，3 槽 = 1+2k） */
export const MULTI_SLOT_BONUS_RATE = 0.16;

/** 组合单 / challenge：在最终花愿上再乘一小步，补偿跨链调度成本（与成长单 bonusMultiplier 独立） */
export const CHALLENGE_ORDER_HUAYUAN_MULT = 1.06;

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

export type OrderDeliveryCategory = 'flower' | 'drink';
export type OrderDeliveryLine =
  | 'fresh'
  | 'bouquet'
  | 'green'
  | 'butterfly'
  | 'cold'
  | 'dessert';

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
};

function deliverHuayuanForCurve(level: number, curve: OrderDeliveryCurve): number {
  if (!Number.isFinite(level) || level < 1) return 0;
  return Math.max(1, Math.round(curve.base * curve.growth ** (Math.floor(level) - 1)));
}

/** 指定产品线的单笔交付单价；未知线返回 0，避免误把包装/工具线纳入订单价值。 */
export function deliverHuayuanForItem(
  category: OrderDeliveryCategory,
  line: string,
  level: number,
): number {
  const curve = ORDER_DELIVERY_CURVES[category]?.[line];
  return curve ? deliverHuayuanForCurve(level, curve) : 0;
}
