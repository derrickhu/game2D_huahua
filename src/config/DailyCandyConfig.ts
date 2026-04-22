/**
 * 「开店糖果」（每日开店奖励）配置
 *
 * 定位：**离线/熟客留言面板的轻量附赠**，不再独立承担"日活登录奖励"。
 * 钻石与连签里程碑统一由 CheckInManager 负责，避免与签到双重发放。
 *
 * 每自然日（UTC 偏移与 CheckInManager 保持一致）首次有离线产出/熟客留言时弹一份「糖果」：
 *  - 基础包：少量体力 + 少量花愿（不再发钻石；钻石由签到独占）
 *  - 随机彩蛋：4 选 1（花愿 / 体力 / 许愿硬币 / 收纳盒花苗），其中许愿币权重已下调
 *
 * Manager 见 src/managers/DailyCandyManager.ts；UI 由 OfflineRewardPanel 第三段渲染。
 */

export const DAILY_CANDY_BASE = {
  stamina: 10,
  huayuan: 30,
  diamond: 0,
} as const;

export interface DailyCandyRandomBonus {
  id: string;
  /** 抽取权重 */
  weight: number;
  /** 文案：放在「彩蛋」一行 */
  label: string;
  huayuan?: number;
  stamina?: number;
  flowerSignTickets?: number;
  /** 收纳盒物品（直接发） */
  rewardBoxItem?: { itemId: string; count: number };
}

export const DAILY_CANDY_RANDOM_BONUSES: DailyCandyRandomBonus[] = [
  { id: 'huayuan',  weight: 5, label: '花愿小礼 +20',         huayuan: 20 },
  { id: 'stamina',  weight: 4, label: '体力补给 +5',          stamina: 5 },
  { id: 'wishCoin', weight: 1, label: '许愿硬币 ×1',          flowerSignTickets: 1 },
  {
    id: 'flowerSeed',
    weight: 2,
    label: '收纳盒鲜花种子 ×1',
    rewardBoxItem: { itemId: 'flower_fresh_2', count: 1 },
  },
];

/**
 * 连签里程碑：自 v? 起已**移除**，钻石/许愿币/盲盒类大额奖励统一交由 CheckInManager 处理，
 * 避免「签到 + 开店糖果」对同一 `consecutiveDays` 双重发放。
 *
 * 类型与查表函数保留为空实现，便于历史调用方平滑过渡（IdleManager.claimReward 中 `t` 判空已生效）。
 */
export interface DailyCandyStreakTier {
  days: number;
  label: string;
  huayuan?: number;
  diamond?: number;
  stamina?: number;
  flowerSignTickets?: number;
  rewardBoxItem?: { itemId: string; count: number };
  blindBoxAffinityFurniture?: boolean;
}

export const DAILY_CANDY_STREAK_TIERS: DailyCandyStreakTier[] = [];

export function getStreakTierExact(_days: number): DailyCandyStreakTier | null {
  return null;
}
