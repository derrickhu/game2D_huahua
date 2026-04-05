/**
 * 每日挑战：四类任务梯度 + 周积分里程碑。
 *
 * 平衡：单日若全部完成并领取，周积分之和 = DAILY_MAX_WEEKLY_POINTS；
 * 7 * DAILY_MAX_WEEKLY_POINTS 应大于最后一条里程碑 threshold（留容错）。
 */
import { LUCKY_COIN_ITEM_ID } from '@/config/ItemConfig';

export type DailyQuestKind = 'huayuan' | 'merge' | 'deliver' | 'diamond';

export interface DailyChallengeReward {
  huayuan?: number;
  stamina?: number;
  diamond?: number;
  itemId?: string;
  itemCount?: number;
}

export interface DailyQuestTemplate {
  id: string;
  kind: DailyQuestKind;
  target: number;
  /** 领取该条每日奖励时注入的周进度积分 */
  weeklyPoints: number;
  reward: DailyChallengeReward;
}

export interface WeeklyMilestoneDef {
  id: string;
  threshold: number;
  reward: DailyChallengeReward;
}

export const DAILY_QUEST_TEMPLATES: DailyQuestTemplate[] = [
  // 花愿 ×4
  { id: 'hy_1', kind: 'huayuan', target: 400, weeklyPoints: 10, reward: { stamina: 12 } },
  { id: 'hy_2', kind: 'huayuan', target: 1200, weeklyPoints: 15, reward: { diamond: 3 } },
  { id: 'hy_3', kind: 'huayuan', target: 3000, weeklyPoints: 22, reward: { stamina: 20 } },
  { id: 'hy_4', kind: 'huayuan', target: 5500, weeklyPoints: 28, reward: { diamond: 6 } },
  // 合成 ×4
  { id: 'mg_1', kind: 'merge', target: 8, weeklyPoints: 10, reward: { stamina: 10 } },
  { id: 'mg_2', kind: 'merge', target: 22, weeklyPoints: 15, reward: { diamond: 3 } },
  { id: 'mg_3', kind: 'merge', target: 45, weeklyPoints: 22, reward: { stamina: 18 } },
  { id: 'mg_4', kind: 'merge', target: 80, weeklyPoints: 28, reward: { diamond: 6 } },
  // 订单 ×4
  { id: 'dv_1', kind: 'deliver', target: 1, weeklyPoints: 10, reward: { huayuan: 30 } },
  { id: 'dv_2', kind: 'deliver', target: 3, weeklyPoints: 15, reward: { diamond: 4 } },
  { id: 'dv_3', kind: 'deliver', target: 6, weeklyPoints: 22, reward: { stamina: 25 } },
  { id: 'dv_4', kind: 'deliver', target: 10, weeklyPoints: 28, reward: { diamond: 8 } },
  // 钻石 ×4
  { id: 'dm_1', kind: 'diamond', target: 15, weeklyPoints: 10, reward: { stamina: 8 } },
  { id: 'dm_2', kind: 'diamond', target: 40, weeklyPoints: 15, reward: { huayuan: 50 } },
  { id: 'dm_3', kind: 'diamond', target: 80, weeklyPoints: 22, reward: { diamond: 5 } },
  { id: 'dm_4', kind: 'diamond', target: 150, weeklyPoints: 28, reward: { itemId: LUCKY_COIN_ITEM_ID, itemCount: 1 } },
];

/** 单日全领满可得周积分（16 条之和） */
export const DAILY_MAX_WEEKLY_POINTS = DAILY_QUEST_TEMPLATES.reduce((s, t) => s + t.weeklyPoints, 0);

export const WEEKLY_MILESTONES: WeeklyMilestoneDef[] = [
  { id: 'wm_100', threshold: 100, reward: { stamina: 20 } },
  { id: 'wm_350', threshold: 350, reward: { diamond: 5 } },
  { id: 'wm_650', threshold: 650, reward: { itemId: 'chest_1', itemCount: 1 } },
  { id: 'wm_950', threshold: 950, reward: { stamina: 35 } },
  { id: 'wm_1250', threshold: 1250, reward: { diamond: 12 } },
  { id: 'wm_1550', threshold: 1550, reward: { itemId: 'chest_2', itemCount: 1 } },
];

const LAST_MILESTONE = WEEKLY_MILESTONES[WEEKLY_MILESTONES.length - 1];
/** 7 日满额 vs 最后一档里程碑：须留有余量 */
export const _WEEKLY_BALANCE_CHECK = 7 * DAILY_MAX_WEEKLY_POINTS > LAST_MILESTONE.threshold;

void _WEEKLY_BALANCE_CHECK;

export function getDailyQuestTemplate(id: string): DailyQuestTemplate | undefined {
  return DAILY_QUEST_TEMPLATES.find(t => t.id === id);
}

export function describeDailyQuest(t: DailyQuestTemplate): string {
  switch (t.kind) {
    case 'huayuan':
      return `收集 ${t.target} 花愿`;
    case 'merge':
      return `合成 ${t.target} 次`;
    case 'deliver':
      return `完成 ${t.target} 个订单`;
    case 'diamond':
      return `消耗 ${t.target} 钻石`;
    default:
      return '';
  }
}

export function seededShuffle<T>(items: T[], seed: string): T[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) | 0;
  }
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    h = (h * 1103515245 + 12345) | 0;
    const j = Math.abs(h) % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
