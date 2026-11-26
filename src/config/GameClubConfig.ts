/**
 * 微信游戏圈专属福利配置
 *
 * 包含：
 *   1) 顶部「每日逛圈签到礼包」（每天点击前往游戏圈后即可领取）
 *   2) 一次性「加入微信游戏圈」大奖
 *   3) 每日互动任务（今日点赞 / 今日评论 / 今日发帖，每日 0:00 重置）
 *   4) 阶梯累计互动任务（累计点赞 1/3/5 次、累计评论 1/3/5 次，前置任务完成后逐级解锁）
 */

import { GAME_KEY } from './CloudConfig';

export const GAME_CLUB_STORAGE_KEY = `${GAME_KEY}_game_club`;

/** wx.getGameClubData 查询指标枚举：1=加圈时间, 4=今日点赞, 5=今日评论, 6=今日发帖 */
export const GAME_CLUB_DATA_TYPES = [1, 4, 5, 6] as const;

export interface GameClubRewardSpec {
  stamina?: number;
  diamond?: number;
  huayuan?: number;
  flowerSign?: number;
  items?: ReadonlyArray<{ itemId: string; count: number }>;
}

export type GameClubTaskMetric =
  | 'join_club'
  | 'daily_like'
  | 'daily_comment'
  | 'daily_post'
  | 'cum_like'
  | 'cum_comment';

export type GameClubTaskCycle = 'daily' | 'once';

export interface GameClubTaskDef {
  id: string;
  title: string;
  subtitle: string;
  cycle: GameClubTaskCycle;
  metric: GameClubTaskMetric;
  target: number;
  /** 前置任务 ID：前置任务未达成/领取前，当前任务显示「完成前置任务解锁」 */
  prerequisiteTaskId?: string;
  reward: GameClubRewardSpec;
}

/** 顶部暖橘福利条：每日逛圈签到礼包 */
export const GAME_CLUB_DAILY_SIGN_REWARD: GameClubRewardSpec = {
  stamina: 25,
  huayuan: 150,
  items: [{ itemId: 'stamina_chest_1', count: 1 }],
};

/**
 * 游戏圈福利任务池
 * 顺序用于默认基础排序（界面展示时会再按「可领取 → 进行中 → 待解锁 → 已完成」智能分组）。
 */
export const GAME_CLUB_TASKS: readonly GameClubTaskDef[] = [
  // ── 每日活跃任务（每日 0:00 重置） ──
  {
    id: 'daily_like_1',
    title: '今日点赞帖子1次',
    subtitle: '每日任务 · 在游戏圈为喜欢的帖子点个赞',
    cycle: 'daily',
    metric: 'daily_like',
    target: 1,
    reward: {
      stamina: 20,
      diamond: 8,
      huayuan: 120,
    },
  },
  {
    id: 'daily_comment_1',
    title: '今日评论帖子1次',
    subtitle: '每日任务 · 与花友交流装修或合成心得',
    cycle: 'daily',
    metric: 'daily_comment',
    target: 1,
    reward: {
      stamina: 30,
      diamond: 12,
      items: [{ itemId: 'stamina_chest_1', count: 1 }],
    },
  },
  {
    id: 'daily_post_1',
    title: '今日发表帖子1次',
    subtitle: '每日任务 · 晒出你的花坊美照或攻略提问',
    cycle: 'daily',
    metric: 'daily_post',
    target: 1,
    reward: {
      diamond: 20,
      flowerSign: 1,
      items: [{ itemId: 'diamond_bag_1', count: 1 }],
    },
  },

  // ── 阶梯累计互动任务（完成前置任务解锁下一档） ──
  {
    id: 'cum_like_1',
    title: '累计点赞帖子1次',
    subtitle: '花友初识 · 累计在游戏圈点赞达标',
    cycle: 'once',
    metric: 'cum_like',
    target: 1,
    reward: {
      stamina: 20,
      huayuan: 150,
      items: [{ itemId: 'stamina_chest_1', count: 1 }],
    },
  },
  {
    id: 'cum_comment_1',
    title: '累计评论帖子1次',
    subtitle: '花友热聊 · 累计在游戏圈评论达标',
    cycle: 'once',
    metric: 'cum_comment',
    target: 1,
    reward: {
      stamina: 25,
      huayuan: 200,
      items: [{ itemId: 'diamond_bag_1', count: 1 }],
    },
  },
  {
    id: 'cum_like_3',
    title: '累计点赞帖子3次',
    subtitle: '进阶福利 · 完成上一档点赞任务后解锁',
    cycle: 'once',
    metric: 'cum_like',
    target: 3,
    prerequisiteTaskId: 'cum_like_1',
    reward: {
      diamond: 15,
      stamina: 30,
      items: [{ itemId: 'chest_1', count: 1 }],
    },
  },
  {
    id: 'cum_like_5',
    title: '累计点赞帖子5次',
    subtitle: '人气花友 · 完成上一档点赞任务后解锁',
    cycle: 'once',
    metric: 'cum_like',
    target: 5,
    prerequisiteTaskId: 'cum_like_3',
    reward: {
      diamond: 25,
      flowerSign: 2,
      items: [{ itemId: 'chest_2', count: 1 }],
    },
  },
  {
    id: 'cum_comment_3',
    title: '累计评论帖子3次',
    subtitle: '进阶福利 · 完成上一档评论任务后解锁',
    cycle: 'once',
    metric: 'cum_comment',
    target: 3,
    prerequisiteTaskId: 'cum_comment_1',
    reward: {
      diamond: 20,
      flowerSign: 1,
      items: [{ itemId: 'chest_1', count: 1 }],
    },
  },
  {
    id: 'cum_comment_5',
    title: '累计评论帖子5次',
    subtitle: '社区达人 · 完成上一档评论任务后解锁',
    cycle: 'once',
    metric: 'cum_comment',
    target: 5,
    prerequisiteTaskId: 'cum_comment_3',
    reward: {
      diamond: 35,
      items: [
        { itemId: 'chest_2', count: 1 },
        { itemId: 'stamina_chest_2', count: 1 },
      ],
    },
  },

  // ── 一次性加圈大奖 ──
  {
    id: 'join_club',
    title: '加入微信游戏圈',
    subtitle: '专属新人礼 · 加入花花妙屋官方游戏圈立领',
    cycle: 'once',
    metric: 'join_club',
    target: 1,
    reward: {
      diamond: 50,
      flowerSign: 2,
      items: [{ itemId: 'chest_1', count: 1 }],
    },
  },
];
