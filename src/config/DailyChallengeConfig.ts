/**
 * 每日挑战：全量任务模板表（`DAILY_QUEST_TEMPLATES`）。
 * 各档周积分轨道（4 节点：体力宝箱 / 幸运金币 / 万能水晶 / 金剪刀，等级与数量随档位升档）见 `DailyChallengeTierConfig.ts`。
 *
 * 满档平衡：单日全完成周积分之和 = DAILY_MAX_WEEKLY_POINTS；
 * 7 * DAILY_MAX_WEEKLY_POINTS 应大于该档最后一条里程碑 threshold（留容错）。
 */
import { LUCKY_COIN_ITEM_ID } from '@/config/ItemConfig';

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
  // 订单 ×4（目标 8 / 15 / 22 / 30）：玩家反馈高档过难，整体下调；最高档 30 单可在工作日内打满
  { id: 'dv_1', kind: 'deliver', target: 8, weeklyPoints: 10, reward: { stamina: 10 } },
  { id: 'dv_2', kind: 'deliver', target: 15, weeklyPoints: 15, reward: { itemId: 'stamina_chest_1', itemCount: 1 } },
  { id: 'dv_3', kind: 'deliver', target: 22, weeklyPoints: 22, reward: { diamond: 10 } },
  { id: 'dv_4', kind: 'deliver', target: 30, weeklyPoints: 28, reward: { diamond: 20 } },
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

/**
 * 周积分里程碑奖励统一沿用「体力宝箱 / 幸运金币 / 万能水晶 / 金剪刀」4 件套，
 * 各档体力宝箱等级与道具数量在 `DailyChallengeTierConfig.ts` 内逐档定义；本文件不再维护单一全局表。
 *
 * 历史：曾导出 `WEEKLY_MILESTONES`（钻石/银宝箱/铜宝箱/幸运金币/万能水晶/许愿硬币 6 节点），
 * 在改为「按档分别配置」后删除以避免双源同步。需要历史平衡参考时见 git 历史。
 */

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
