import type { Category } from '@/config/ItemConfig';
import type { OrderType, OrderTier, UnlockedLines } from '@/config/OrderTierConfig';

/** 本帧生成语义：基础 / 成长加成 / 跨链组合 / 活动预留 / 熟客专属 */
export type OrderGenerationKind = 'basic' | 'growth' | 'combo' | 'eventStub' | 'affinityExclusive';

export interface OrderGenSlot {
  itemId: string;
}

/** 熟客专属订单的「软偏好」line（命中则提高同 line 物品的抽取权重，不命中则回退基础逻辑） */
export interface OrderPreferLine {
  category: Category;
  line: string;
  weight?: number;
}

export interface OrderGenContext {
  tier: OrderTier;
  lines: UnlockedLines;
  playerLevel: number;
  /** 连续多单无绿植需求时的保底：下一单花类槽尽量出绿植 */
  forceGreenFlowerSlot: boolean;
  rng: () => number;
  /**
   * 熟客专属订单：软偏好 line。提供时本次生成会尝试在已解锁线中优先抽取这些 line 的物品，
   * 任何 line 都没货则按基础池兜底（即使没命中也仍标记 isExclusive = true）。
   */
  preferLines?: OrderPreferLine[];
  /** 本次刷出的客人是否为「熟客专属订单」；用于结果标记 + UI 角标 */
  isExclusive?: boolean;
}

export interface OrderGenResult {
  slots: OrderGenSlot[];
  orderType: OrderType;
  timeLimit: number | null;
  bonusMultiplier?: number;
  generationKind: OrderGenerationKind;
  /** 熟客专属订单标记（用于 deliver 阶段加成 + UI 角标） */
  isExclusive?: boolean;
}

/** 活动/季节订单：向生成器注入权重或模板（当前仅占位，供 EventManager 后续接入） */
export type ActivityOrderPartial = Partial<{
  slots: OrderGenSlot[];
  orderType: OrderType;
  timeLimit: number | null;
  bonusMultiplier: number;
}>;

export type ActivityOrderHook = (ctx: OrderGenContext) => ActivityOrderPartial | null;

let _activityOrderHook: ActivityOrderHook | null = null;

export function registerActivityOrderHook(hook: ActivityOrderHook | null): void {
  _activityOrderHook = hook;
}

export function getActivityOrderHook(): ActivityOrderHook | null {
  return _activityOrderHook;
}
