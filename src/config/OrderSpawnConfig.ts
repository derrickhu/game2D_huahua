/**
 * 订单刷新与类型权重（组合单 / aspirational）。
 * 策划调参入口；生成逻辑见 OrderGeneratorRegistry + CustomerManager。
 */
import { ITEM_DEFS } from '@/config/ItemConfig';
import { computeOrderItemDifficulty, type OrderTier, type UnlockedLines } from '@/config/OrderTierConfig';
import type { OrderGenSlot } from '@/orders/types';

/** 略高于 toolCap 的概率（与 pickItemLevel 一致） */
export const ORDER_ASPIRATIONAL_LEVEL_BONUS_CHANCE = 0.14;

/** 物品等级抽样曲线；越接近 1 越平均，>1 会偏低级。早期需要更多中高阶体感，避免长期重复低级花。 */
export const ORDER_ITEM_LEVEL_PICK_EXPONENT = 1.12;

/** 组合单基础概率；随解锁产线数上浮，封顶 ORDER_COMBO_MAX_CHANCE */
export const ORDER_COMBO_BASE_CHANCE = 0.16;
/** 解锁线数 > 2 时，每条额外线增加的概率 */
export const ORDER_COMBO_CHANCE_PER_EXTRA_LINE = 0.04;
export const ORDER_COMBO_MAX_CHANCE = 0.42;

/**
 * 升星仪式 L5 起组合单概率 × LEVEL_MULT（4 级仍走新手过渡，不加速）。
 */
export const ORDER_COMBO_LEVEL_BOOST_MIN_LEVEL = 5;
export const ORDER_COMBO_LEVEL_BOOST_MULT = 1.35;

/** 至少解锁几条独立产线才允许组合单第三槽 */
export const ORDER_COMBO_MIN_UNLOCKED_LINES_FOR_THIRD_SLOT = 2;
/** 满足条线数后，追加第三槽的概率（不再绑定 S 模板档） */
export const ORDER_COMBO_THIRD_SLOT_CHANCE = 0.45;

/** 成长单：在基础池生成路径上尝试加成的基准概率 */
export const ORDER_GROWTH_BASE_CHANCE = 0.1;
/** 模板档乘子：C 通常不出成长加成 */
export const ORDER_GROWTH_TIER_MULT: Record<OrderTier, number> = {
  C: 0,
  B: 0.85,
  A: 1.15,
  S: 1.35,
};

/** 成长花愿倍率（与 challenge 倍率独立叠乘） */
export const ORDER_GROWTH_BONUS_MULTIPLIER = 1.18;

/**
 * 成长单语义：槽位 max(norm) 须达到此值才保留成长标记与倍率，否则降级为基础单。
 * norm = 13 级绝对标尺 + 产线后段补偿后的订单物品难度
 */
export const ORDER_GROWTH_MIN_MAX_NORM = 0.42;

/**
 * 客人刷新间隔（秒）：低等级缩短等待，避免 1 级长时间「一个一个等」。
 * `maxLevel` 为含上限的星级档位。
 */
export const CUSTOMER_REFRESH_TIER_BY_LEVEL: ReadonlyArray<{
  maxLevel: number;
  minSec: number;
  maxSec: number;
  /** 新档 / 读档缺省时的首刷倒计时 */
  initialDelaySec: number;
  /** 非教程、队列空时开局预刷人数（0 = 不预刷） */
  bootstrapCount: number;
}> = [
  { maxLevel: 1, minSec: 4, maxSec: 9, initialDelaySec: 5, bootstrapCount: 2 },
  { maxLevel: 2, minSec: 5, maxSec: 12, initialDelaySec: 6, bootstrapCount: 1 },
  { maxLevel: 5, minSec: 7, maxSec: 18, initialDelaySec: 8, bootstrapCount: 0 },
  { maxLevel: Number.POSITIVE_INFINITY, minSec: 10, maxSec: 30, initialDelaySec: 27, bootstrapCount: 0 },
];

export function getCustomerRefreshTier(playerLevel: number): (typeof CUSTOMER_REFRESH_TIER_BY_LEVEL)[number] {
  const lv = Math.max(1, Math.floor(playerLevel));
  for (const tier of CUSTOMER_REFRESH_TIER_BY_LEVEL) {
    if (lv <= tier.maxLevel) return tier;
  }
  return CUSTOMER_REFRESH_TIER_BY_LEVEL[CUSTOMER_REFRESH_TIER_BY_LEVEL.length - 1]!;
}

/** 随机下一次刷客阈值（秒） */
export function rollCustomerRefreshInterval(playerLevel: number): number {
  const t = getCustomerRefreshTier(playerLevel);
  return t.minSec + Math.random() * (t.maxSec - t.minSec);
}

export function getCustomerRefreshInitialDelay(playerLevel: number): number {
  return getCustomerRefreshTier(playerLevel).initialDelaySec;
}

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
export const TIMED_DIAMOND_ORDER_BASE_CHANCE = 0.06;
/** 当天还没出过限时单时，明显提高概率，让每日首单更有体感 */
export const TIMED_DIAMOND_ORDER_FIRST_DAILY_CHANCE_MULT = 1.6;
export const TIMED_DIAMOND_ORDER_DAILY_CAP = 2;
export const TIMED_DIAMOND_ORDER_SLOT_COUNT = 3;
export const TIMED_DIAMOND_ORDER_MIN_ITEM_LEVEL = 6;
export const TIMED_DIAMOND_ORDER_TIME_LIMIT_SECONDS = 6 * 60 * 60;
export const TIMED_DIAMOND_ORDER_DIAMOND_CAP = 10;

/** 富贵花商限时单：8 级后才有概率出现，每日最多 1 单，限时 8 小时，三槽同款鲜花/绿植 L6+ */
export const TIMED_FLORIST_ORDER_MIN_PLAYER_LEVEL = 8;
export const TIMED_FLORIST_ORDER_DAILY_CAP = 1;
export const TIMED_FLORIST_ORDER_BASE_CHANCE = 0.05;
export const TIMED_FLORIST_ORDER_FIRST_DAILY_CHANCE_MULT = 1.6;
export const TIMED_FLORIST_ORDER_SLOT_COUNT = 3;
export const TIMED_FLORIST_ORDER_MIN_ITEM_LEVEL = 6;
export const TIMED_FLORIST_ORDER_TIME_LIMIT_SECONDS = 8 * 60 * 60;

/** 按需求物品等级映射体力箱档位 */
export function computeFloristStaminaChestReward(
  slots: readonly OrderGenSlot[],
): 'stamina_chest_1' | 'stamina_chest_2' | 'stamina_chest_3' {
  const lv = ITEM_DEFS.get(slots[0]?.itemId ?? '')?.level ?? TIMED_FLORIST_ORDER_MIN_ITEM_LEVEL;
  if (lv >= 11) return 'stamina_chest_3';
  if (lv >= 8) return 'stamina_chest_2';
  return 'stamina_chest_1';
}

/**
 * 组合单有效概率：min(max, base + (unlockedLineCount-2)*perLine)，至少 2 线才可能组合。
 * playerLevel ≥ ORDER_COMBO_LEVEL_BOOST_MIN_LEVEL 时再乘 ORDER_COMBO_LEVEL_BOOST_MULT，整体仍 clamp 到 MAX。
 */
export function orderComboEffectiveChance(
  ulk: UnlockedLines,
  playerLevel?: number,
): number {
  if (playerLevel === 1) return 0;
  if (playerLevel === 2) {
    if (ulk.unlockedLineCount < 2) return 0;
    return ORDER_COMBO_BASE_CHANCE * 0.85 * 0.5;
  }
  if (ulk.unlockedLineCount < 2) return 0;
  const extra = Math.max(0, ulk.unlockedLineCount - 2);
  let p = ORDER_COMBO_BASE_CHANCE + extra * ORDER_COMBO_CHANCE_PER_EXTRA_LINE;
  if (playerLevel === 3) {
    p *= 0.75;
  } else if (playerLevel === 4) {
    p *= 0.88;
  } else if (typeof playerLevel === 'number' && playerLevel >= ORDER_COMBO_LEVEL_BOOST_MIN_LEVEL) {
    p *= ORDER_COMBO_LEVEL_BOOST_MULT;
  }
  return Math.min(ORDER_COMBO_MAX_CHANCE, p);
}

/** 成长加成尝试概率（仅用于基础池路径，与模板档挂钩） */
export function orderGrowthRollChance(tier: OrderTier, playerLevel?: number): number {
  const m = ORDER_GROWTH_TIER_MULT[tier] ?? 0;
  const base = ORDER_GROWTH_BASE_CHANCE * m;
  if (playerLevel === 1) return 0;
  if (playerLevel === 2) return Math.min(0.09, base * 0.7);
  if (playerLevel === 3) return Math.min(0.12, base * 0.85);
  if (playerLevel === 4) return Math.min(0.14, base * 0.92);
  return Math.min(1, base);
}

/** 单槽 norm；未知物品返回 0 */
export function slotNormForItemId(itemId: string): number {
  const def = ITEM_DEFS.get(itemId);
  if (!def) return 0;
  return computeOrderItemDifficulty(def);
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
