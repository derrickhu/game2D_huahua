/**
 * 熟客养成数值配置（好感阈值、交付好感、订单花愿加成）
 * 好感仅通过交付订单增加，到店不增加好感。
 */

/** 与 RegularCustomerManager 持久化格式对齐；变更阈值/经济时递增并写迁移 */
export const REGULAR_CUSTOMER_SAVE_VERSION = 2;

/** v1 经济下达到挚友所需的累计好感（用于迁移时按比例缩放 favorPoints） */
export const LEGACY_FAVOR_BESTIE_THRESHOLD = 250;

/**
 * 达到各好感等级所需的累计好感值（与 FavorLevel 0..3 对齐）
 * 陌生 ≥0、熟悉 ≥[1]、亲密 ≥[2]、挚友 ≥[3]
 */
export const REGULAR_CUSTOMER_FAVOR_THRESHOLDS: readonly number[] = [0, 100, 320, 850];

export const REGULAR_CUSTOMER_DELIVER_FAVOR = {
  base: 6,
  perSlot: 2,
} as const;

/**
 * 订单花愿加成比例，下标 = FavorLevel（0 陌生 … 3 挚友）
 * 与 CustomerManager.deliver 中 `base * (1 + bonus)` 一致
 */
export const REGULAR_CUSTOMER_REWARD_BONUS: readonly number[] = [0, 0.06, 0.12, 0.2];
