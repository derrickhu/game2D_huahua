/**
 * 「开店糖果」（每日开店奖励）配置
 *
 * 每自然日（UTC 偏移与 CheckInManager 保持一致）首次启动时弹一份「糖果」：
 *  - 基础包：体力 / 花愿（拍板 +1 钻石）
 *  - 随机彩蛋：4 选 1（轻量花愿 / 体力 / 许愿硬币 / 收纳盒花苗）
 *  - 连签里程碑：与 CheckInManager.consecutiveDays 同步推进，到点送惊喜
 *
 * Manager 见 src/managers/DailyCandyManager.ts；UI 由 OfflineRewardPanel 第三段渲染。
 */

export const DAILY_CANDY_BASE = {
  stamina: 20,
  huayuan: 50,
  diamond: 1,
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
  { id: 'huayuan',  weight: 4, label: '花愿小礼 +30',         huayuan: 30 },
  { id: 'stamina',  weight: 3, label: '体力补给 +10',         stamina: 10 },
  { id: 'wishCoin', weight: 2, label: '许愿硬币 ×1',          flowerSignTickets: 1 },
  {
    id: 'flowerSeed',
    weight: 2,
    label: '收纳盒鲜花种子 ×1',
    rewardBoxItem: { itemId: 'flower_fresh_2', count: 1 },
  },
];

/** 连续签到里程碑（与 CheckInManager.consecutiveDays 对齐；满档继续走 30 天循环） */
export interface DailyCandyStreakTier {
  /** 触发的连续签到天数（>=） */
  days: number;
  label: string;
  huayuan?: number;
  diamond?: number;
  stamina?: number;
  flowerSignTickets?: number;
  /** 拍板：30 天里程碑改为送「随机熟客主题家具盲盒」（暂时占位文案，正式钩到家具池后替换） */
  rewardBoxItem?: { itemId: string; count: number };
  blindBoxAffinityFurniture?: boolean;
}

export const DAILY_CANDY_STREAK_TIERS: DailyCandyStreakTier[] = [
  { days: 3,  label: '连签 3 天 · 鲜花礼包', huayuan: 80, stamina: 10 },
  { days: 7,  label: '连签 7 天 · 周礼包',   huayuan: 200, diamond: 5, stamina: 20 },
  { days: 14, label: '连签 14 天 · 半月礼',  huayuan: 400, diamond: 10, flowerSignTickets: 2 },
  { days: 30, label: '连签 30 天 · 熟客盲盒', diamond: 20, flowerSignTickets: 5, blindBoxAffinityFurniture: true },
];

/** 取连签恰好触发的当档（达成阈值且与昨日不同的那一档；只对当天弹一次） */
export function getStreakTierExact(days: number): DailyCandyStreakTier | null {
  const sorted = [...DAILY_CANDY_STREAK_TIERS].sort((a, b) => b.days - a.days);
  for (const t of sorted) {
    if (t.days === days) return t;
  }
  return null;
}
