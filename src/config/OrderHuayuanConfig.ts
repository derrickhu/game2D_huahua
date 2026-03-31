/**
 * 订单交付花愿曲线（写入 ItemDef.orderHuayuan）与多槽位加成系数。
 * 具体订单总额在 CustomerManager 内按槽位 itemId 求和后再乘系数。
 *
 * 棋盘出售：`ItemDef.sellHuayuan` 由 `computeSellHuayuan(orderHuayuan)` 生成，固定且远低于订单单价。
 */

/** 每多 1 个需求槽，对「单价之和」的加成比例（2 槽 = 1+k，3 槽 = 1+2k） */
export const MULTI_SLOT_BONUS_RATE = 0.08;

/** 棋盘出售 = floor(order × 比例)，再封顶到 order、保底 1（仅当 order≥1）；不鼓励卖，仅腾格备选 */
export const ITEM_SELL_RATIO = 0.15;

export function computeSellHuayuan(orderHuayuan: number): number {
  if (!Number.isFinite(orderHuayuan) || orderHuayuan < 1) return 0;
  const raw = Math.floor(orderHuayuan * ITEM_SELL_RATIO);
  return Math.min(orderHuayuan, Math.max(1, raw));
}

/** 与旧档位随机区间中位数大致对齐后微调（C/B/A/S 典型双槽中高等级） */
const FLOWER_BASE = 12;
const FLOWER_GROWTH = 1.33;
const DRINK_BASE = 13;
const DRINK_GROWTH = 1.31;

/** 鲜花/花束/绿植（按等级）单笔交付单价 */
export function flowerDeliverHuayuanForLevel(level: number): number {
  return Math.max(1, Math.round(FLOWER_BASE * FLOWER_GROWTH ** (level - 1)));
}

/** 饮品（按等级）单笔交付单价 */
export function drinkDeliverHuayuanForLevel(level: number): number {
  return Math.max(1, Math.round(DRINK_BASE * DRINK_GROWTH ** (level - 1)));
}
