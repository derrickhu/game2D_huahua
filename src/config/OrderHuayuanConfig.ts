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

/** 花系订单单价曲线（与档位中位数对齐后按合成收益上调增长） */
const FLOWER_BASE = 12;
const FLOWER_GROWTH = 1.5;

/** 饮品订单单价曲线（蝴蝶/冷饮/甜品共用曲线，略低于花系） */
const DRINK_BASE = 13;
const DRINK_GROWTH = 1.47;

/** 鲜花/花束/绿植（按等级）单笔交付单价 */
export function flowerDeliverHuayuanForLevel(level: number): number {
  return Math.max(1, Math.round(FLOWER_BASE * FLOWER_GROWTH ** (level - 1)));
}

/** 饮品含蝴蝶标本线（按等级）单笔交付单价 */
export function drinkDeliverHuayuanForLevel(level: number): number {
  return Math.max(1, Math.round(DRINK_BASE * DRINK_GROWTH ** (level - 1)));
}
