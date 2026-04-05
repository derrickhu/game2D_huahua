/**
 * 订单刷新与类型权重（组合单 / 成长单 / aspirational）。
 * 策划调参入口；生成逻辑见 OrderGeneratorRegistry + CustomerManager。
 */
import { ITEM_DEFS, getMaxLevelForLine } from '@/config/ItemConfig';
import type { OrderTier, UnlockedLines } from '@/config/OrderTierConfig';
import type { OrderGenSlot } from '@/orders/types';

/** 略高于 toolCap 的概率（与 pickItemLevel 一致） */
export const ORDER_ASPIRATIONAL_LEVEL_BONUS_CHANCE = 0.09;

/** 组合单基础概率；随解锁产线数上浮，封顶 ORDER_COMBO_MAX_CHANCE */
export const ORDER_COMBO_BASE_CHANCE = 0.12;
/** 解锁线数 > 2 时，每条额外线增加的概率 */
export const ORDER_COMBO_CHANCE_PER_EXTRA_LINE = 0.03;
export const ORDER_COMBO_MAX_CHANCE = 0.35;

/** 至少解锁几条独立产线才允许组合单第三槽 */
export const ORDER_COMBO_MIN_UNLOCKED_LINES_FOR_THIRD_SLOT = 3;
/** 满足条线数后，追加第三槽的概率（不再绑定 S 模板档） */
export const ORDER_COMBO_THIRD_SLOT_CHANCE = 0.35;

/** 成长单：在基础池生成路径上尝试加成的基准概率 */
export const ORDER_GROWTH_BASE_CHANCE = 0.1;
/** 模板档乘子：C 通常不出成长加成 */
export const ORDER_GROWTH_TIER_MULT: Record<OrderTier, number> = {
  C: 0,
  B: 0.85,
  A: 1.15,
  S: 1.25,
};

/** 成长花愿倍率（与 challenge 倍率独立叠乘） */
export const ORDER_GROWTH_BONUS_MULTIPLIER = 1.18;

/**
 * 成长单语义：槽位 max(norm) 须达到此值才保留成长标记与倍率，否则降级为基础单。
 * norm = item.level / 该线 maxLevel
 */
export const ORDER_GROWTH_MIN_MAX_NORM = 0.42;

/** 生成订单时若超出工具能力校验失败，最大重试次数（CustomerManager._spawnCustomer） */
export const ORDER_SPAWN_VALIDATE_MAX_ATTEMPTS = 4;

/**
 * 组合单有效概率：min(max, base + (unlockedLineCount-2)*perLine)，至少 2 线才可能组合。
 */
export function orderComboEffectiveChance(ulk: UnlockedLines): number {
  if (ulk.unlockedLineCount < 2) return 0;
  const extra = Math.max(0, ulk.unlockedLineCount - 2);
  const p = ORDER_COMBO_BASE_CHANCE + extra * ORDER_COMBO_CHANCE_PER_EXTRA_LINE;
  return Math.min(ORDER_COMBO_MAX_CHANCE, p);
}

/** 成长加成尝试概率（仅用于基础池路径，与模板档挂钩） */
export function orderGrowthRollChance(tier: OrderTier): number {
  const m = ORDER_GROWTH_TIER_MULT[tier] ?? 0;
  return Math.min(1, ORDER_GROWTH_BASE_CHANCE * m);
}

/** 单槽 norm；未知物品返回 0 */
export function slotNormForItemId(itemId: string): number {
  const def = ITEM_DEFS.get(itemId);
  if (!def) return 0;
  const lineMax = Math.max(1, getMaxLevelForLine(def.category, def.line));
  return Math.min(1, def.level / lineMax);
}

/** 多槽 max(norm)，用于成长单校验 */
export function maxSlotNormForSlots(slots: readonly OrderGenSlot[]): number {
  let m = 0;
  for (const s of slots) {
    m = Math.max(m, slotNormForItemId(s.itemId));
  }
  return m;
}
