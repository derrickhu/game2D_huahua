/**
 * 每日挑战：全量任务模板表（`DAILY_QUEST_TEMPLATES`）+ 满档周里程碑（`WEEKLY_MILESTONES`）。
 * 分档区间、抽样与低档里程碑见 `DailyChallengeTierConfig.ts`。
 *
 * 满档平衡：单日全完成周积分之和 = DAILY_MAX_WEEKLY_POINTS；
 * 7 * DAILY_MAX_WEEKLY_POINTS 应大于满档最后一条里程碑 threshold（留容错）。
 */
import { CRYSTAL_BALL_ITEM_ID, LUCKY_COIN_ITEM_ID } from '@/config/ItemConfig';

export type DailyQuestKind = 'huayuan' | 'merge' | 'deliver' | 'diamond';

export interface DailyChallengeReward {
  huayuan?: number;
  stamina?: number;
  diamond?: number;
  /** 许愿喷泉硬币（`FlowerSignTicketManager`，非收纳盒物品） */
  flowerSignTickets?: number;
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
  // 花愿 ×4（目标 500 / 1500 / 3000 / 6000）
  { id: 'hy_1', kind: 'huayuan', target: 500, weeklyPoints: 10, reward: { stamina: 10 } },
  { id: 'hy_2', kind: 'huayuan', target: 1500, weeklyPoints: 15, reward: { diamond: 2 } },
  { id: 'hy_3', kind: 'huayuan', target: 3000, weeklyPoints: 22, reward: { stamina: 30 } },
  { id: 'hy_4', kind: 'huayuan', target: 6000, weeklyPoints: 28, reward: { diamond: 5 } },
  // 合成 ×4（目标 50 / 100 / 300 / 500）
  { id: 'mg_1', kind: 'merge', target: 50, weeklyPoints: 10, reward: { itemId: 'flower_fresh_4', itemCount: 1 } },
  { id: 'mg_2', kind: 'merge', target: 100, weeklyPoints: 15, reward: { itemId: 'flower_green_4', itemCount: 1 } },
  { id: 'mg_3', kind: 'merge', target: 300, weeklyPoints: 22, reward: { itemId: 'chest_1', itemCount: 1 } },
  { id: 'mg_4', kind: 'merge', target: 500, weeklyPoints: 28, reward: { itemId: 'diamond_bag_1', itemCount: 1 } },
  // 订单 ×4（目标 10 / 35 / 50 / 60）：体力、1级体力宝箱、钻石
  { id: 'dv_1', kind: 'deliver', target: 10, weeklyPoints: 10, reward: { stamina: 10 } },
  { id: 'dv_2', kind: 'deliver', target: 35, weeklyPoints: 15, reward: { itemId: 'stamina_chest_1', itemCount: 1 } },
  { id: 'dv_3', kind: 'deliver', target: 50, weeklyPoints: 22, reward: { diamond: 10 } },
  { id: 'dv_4', kind: 'deliver', target: 60, weeklyPoints: 28, reward: { diamond: 20 } },
  // 钻石 ×4（目标 5 / 10 / 20 / 50）：体力、1级体力宝箱、幸运金币
  { id: 'dm_1', kind: 'diamond', target: 5, weeklyPoints: 10, reward: { stamina: 10 } },
  { id: 'dm_2', kind: 'diamond', target: 10, weeklyPoints: 15, reward: { stamina: 20 } },
  { id: 'dm_3', kind: 'diamond', target: 20, weeklyPoints: 22, reward: { itemId: 'stamina_chest_1', itemCount: 1 } },
  { id: 'dm_4', kind: 'diamond', target: 50, weeklyPoints: 28, reward: { itemId: LUCKY_COIN_ITEM_ID, itemCount: 1 } },
];

/** 单日全领满可得周积分（16 条之和，满档「完全版」） */
export const DAILY_MAX_WEEKLY_POINTS = DAILY_QUEST_TEMPLATES.reduce((s, t) => s + t.weeklyPoints, 0);

/** 所有每日模板 id（分档池引用） */
export const ALL_DAILY_TEMPLATE_IDS: string[] = DAILY_QUEST_TEMPLATES.map(t => t.id);

export const WEEKLY_MILESTONES: WeeklyMilestoneDef[] = [
  { id: 'wm_100', threshold: 100, reward: { diamond: 10 } },
  { id: 'wm_350', threshold: 350, reward: { itemId: 'stamina_chest_2', itemCount: 1 } },
  { id: 'wm_650', threshold: 650, reward: { itemId: 'chest_3', itemCount: 1 } },
  { id: 'wm_950', threshold: 950, reward: { itemId: LUCKY_COIN_ITEM_ID, itemCount: 1 } },
  { id: 'wm_1250', threshold: 1250, reward: { itemId: CRYSTAL_BALL_ITEM_ID, itemCount: 1 } },
  { id: 'wm_1550', threshold: 1550, reward: { flowerSignTickets: 10 } },
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
