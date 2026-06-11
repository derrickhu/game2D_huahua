import type { OrderType, OrderTier, UnlockedLines } from '@/config/OrderTierConfig';

/** 本帧生成语义：基础 / 成长加成 / 跨链组合 / 限时钻石 / 活动预留 */
/** @deprecated 读档遇 `growth` 会迁移为 `basic` */
export type OrderGenerationKind = 'basic' | 'growth' | 'combo' | 'timedDiamond' | 'timedFlorist' | 'eventStub';

export interface OrderGenSlot {
  itemId: string;
}

export interface OrderGenContext {
  tier: OrderTier;
  lines: UnlockedLines;
  playerLevel: number;
  /** 本次刷单是否允许抽限时钻石单（每日上限、当前队列等由 CustomerManager 控制） */
  allowTimedDiamondOrder?: boolean;
  /** 今日已刷出的限时钻石单数量，用于首单概率微保底 */
  timedDiamondOrdersToday?: number;
  /** 本次刷单是否允许富贵花商限时单 */
  allowTimedFloristOrder?: boolean;
  /** 今日已刷出的富贵花商单数量 */
  timedFloristOrdersToday?: number;
  rng: () => number;
}

export interface OrderGenResult {
  slots: OrderGenSlot[];
  orderType: OrderType;
  timeLimit: number | null;
  diamondReward?: number;
  /** 富贵花商限时单：交付后入奖励收纳盒的体力箱 itemId */
  staminaChestReward?: string;
  bonusMultiplier?: number;
  /** 特殊订单可指定专属客人；普通订单留空走多样性随机 */
  customerTypeId?: string;
  generationKind: OrderGenerationKind;
}

/** 活动/季节订单：向生成器注入权重或模板（当前仅占位，供 EventManager 后续接入） */
export type ActivityOrderPartial = Partial<{
  slots: OrderGenSlot[];
  orderType: OrderType;
  timeLimit: number | null;
  diamondReward: number;
  bonusMultiplier: number;
  customerTypeId: string;
}>;

export type ActivityOrderHook = (ctx: OrderGenContext) => ActivityOrderPartial | null;

let _activityOrderHook: ActivityOrderHook | null = null;

export function registerActivityOrderHook(hook: ActivityOrderHook | null): void {
  _activityOrderHook = hook;
}

export function getActivityOrderHook(): ActivityOrderHook | null {
  return _activityOrderHook;
}
