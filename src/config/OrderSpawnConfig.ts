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

/**
 * 升星仪式 L4 解锁「组合订单提速」：玩家 globalLevel ≥ 该值时组合单概率乘以 LEVEL_MULT。
 * 拍板 +20%（a_20）；与封顶 ORDER_COMBO_MAX_CHANCE 一同 clamp。
 */
export const ORDER_COMBO_LEVEL_BOOST_MIN_LEVEL = 4;
export const ORDER_COMBO_LEVEL_BOOST_MULT = 1.2;

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
 * 单次刷客总尝试次数（含工具 cap 校验 + 与上一单需求 fingerprint 去重）。
 * 去重用尽后仍接受合法单，避免无法刷新。
 */
export const ORDER_SPAWN_MAX_ATTEMPTS = 10;

/** 限时钻石订单：6 级后开放，碎片化游玩按小时级倒计时 */
export const TIMED_DIAMOND_ORDER_MIN_PLAYER_LEVEL = 6;
/** 每次正常刷客时的基础概率；再由每日上限与“当前已有一单”约束压住频率 */
export const TIMED_DIAMOND_ORDER_BASE_CHANCE = 0.035;
/** 当天还没出过限时单时，略微提高概率，长时间在线更接近 1-2 单 */
export const TIMED_DIAMOND_ORDER_FIRST_DAILY_CHANCE_MULT = 1.35;
export const TIMED_DIAMOND_ORDER_DAILY_CAP = 2;
export const TIMED_DIAMOND_ORDER_SLOT_COUNT = 3;
export const TIMED_DIAMOND_ORDER_MIN_ITEM_LEVEL = 6;
export const TIMED_DIAMOND_ORDER_TIME_LIMIT_SECONDS = 6 * 60 * 60;
export const TIMED_DIAMOND_ORDER_DIAMOND_CAP = 10;

/**
 * 组合单有效概率：min(max, base + (unlockedLineCount-2)*perLine)，至少 2 线才可能组合。
 * playerLevel ≥ ORDER_COMBO_LEVEL_BOOST_MIN_LEVEL 时再乘 ORDER_COMBO_LEVEL_BOOST_MULT，整体仍 clamp 到 MAX。
 */
export function orderComboEffectiveChance(
  ulk: UnlockedLines,
  playerLevel?: number,
): number {
  if (ulk.unlockedLineCount < 2) return 0;
  const extra = Math.max(0, ulk.unlockedLineCount - 2);
  let p = ORDER_COMBO_BASE_CHANCE + extra * ORDER_COMBO_CHANCE_PER_EXTRA_LINE;
  if (typeof playerLevel === 'number' && playerLevel >= ORDER_COMBO_LEVEL_BOOST_MIN_LEVEL) {
    p *= ORDER_COMBO_LEVEL_BOOST_MULT;
  }
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

/** 限时单钻石奖励：随需求等级上浮，单单封顶 10 钻 */
export function computeTimedDiamondReward(slots: readonly OrderGenSlot[]): number {
  if (slots.length === 0) return 0;
  let levelSum = 0;
  let maxLevel = 0;
  for (const s of slots) {
    const lv = ITEM_DEFS.get(s.itemId)?.level ?? 0;
    levelSum += lv;
    maxLevel = Math.max(maxLevel, lv);
  }
  const avg = levelSum / slots.length;
  const raw = Math.floor(avg / 2) + (maxLevel >= 9 ? 3 : maxLevel >= 7 ? 2 : 1);
  return Math.min(TIMED_DIAMOND_ORDER_DIAMOND_CAP, Math.max(2, raw));
}
