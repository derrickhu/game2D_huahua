import type { OrderType, OrderTier, UnlockedLines } from '@/config/OrderTierConfig';

/** 本帧生成语义：基础 / 成长加成 / 跨链组合 / 活动预留 */
export type OrderGenerationKind = 'basic' | 'growth' | 'combo' | 'eventStub';

export interface OrderGenSlot {
  itemId: string;
}

export interface OrderGenContext {
  tier: OrderTier;
  lines: UnlockedLines;
  playerLevel: number;
  /** 连续多单无绿植需求时的保底：下一单花类槽尽量出绿植 */
  forceGreenFlowerSlot: boolean;
  rng: () => number;
}

export interface OrderGenResult {
  slots: OrderGenSlot[];
  orderType: OrderType;
  timeLimit: number | null;
  bonusMultiplier?: number;
  generationKind: OrderGenerationKind;
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
