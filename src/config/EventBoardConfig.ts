import { EVENT_JEWELRY_STARTER_BOX_ID } from './ItemConfig';

export const JEWELRY_EVENT_ID = 'jewelry_box_event';
export const JEWELRY_EVENT_NAME = '花间珠匣';
export const EVENT_BOARD_COLS = 6;
/** 基础行数（阶段未单独指定 rows 时使用） */
export const EVENT_BOARD_ROWS = 5;
export const EVENT_BOARD_TOTAL = EVENT_BOARD_COLS * EVENT_BOARD_ROWS;
/** 棋盘格视图最多构建的行数（后期阶段更大棋盘的上限，用于一次性建好格视图） */
export const EVENT_BOARD_MAX_ROWS = 7;
export const EVENT_BOARD_MAX_TOTAL = EVENT_BOARD_COLS * EVENT_BOARD_MAX_ROWS;

export const JEWELRY_STARTER_BOX_ITEM_ID = EVENT_JEWELRY_STARTER_BOX_ID;
export const JEWELRY_ITEM_PREFIX = 'event_jewelry_';

export interface EventBoardStageDef {
  id: string;
  name: string;
  goalItemId: string;
  goalText: string;
  /** 本层棋盘行数（不填则用 EVENT_BOARD_ROWS=5）；后期层数更大以容纳更多合成 */
  rows?: number;
  /** 半锁格（PEEK）：周围一圈，格内压着一件 peekItemId，拖相同物品过去合成才解锁；解锁后揭开相邻全锁格 */
  peekCells: number[];
  /** 全锁格（FOG）：外圈，需相邻半锁格解锁后才会变为半锁 */
  fogCells: number[];
  /** 半锁格内压着的物品（初始 + 级联揭开都用它）；拖相同物品过去合成即解锁 */
  peekItemId: string;
  starterItems: string[];
  /**
   * 「时空门」所在棋盘格（独占一格、不参与合成/放石/掉落）；集齐钥匙后点击进入下一层。
   * 最终层无下一层，故不配置（undefined）。该格须为本层的 OPEN 格。
   */
  portalCell?: number;
}

/** 该层实际行数（默认 5） */
export function getStageRows(stage: EventBoardStageDef): number {
  return Math.max(1, Math.floor(stage.rows ?? EVENT_BOARD_ROWS));
}
/** 该层棋盘格总数（cols × rows） */
export function getStageTotal(stage: EventBoardStageDef): number {
  return EVENT_BOARD_COLS * getStageRows(stage);
}

export interface EventDiscoveryRewardDef {
  itemId: string;
  rewards: EventRewardDef[];
}

export type EventRewardDef =
  | { kind: 'stamina'; amount: number }
  | { kind: 'diamond'; amount: number }
  | { kind: 'huayuan'; amount: number }
  /** 货币拾取块等：优先落到活动棋盘空格，满了进收纳盒 */
  | { kind: 'boxItem'; itemId: string; count: number }
  /** 宝箱/钻石袋/红包等：直接进收纳盒（活动棋盘开不了） */
  | { kind: 'boxReward'; itemId: string; count: number };

/** 合成掉落加权项 */
export interface EventDropEntry {
  reward: EventRewardDef;
  weight: number;
}

export const EVENT_BOARD_STAGES: EventBoardStageDef[] = [
  {
    id: 'stage_1',
    name: '第一层',
    goalItemId: 'event_jewelry_9',
    goalText: '合出绿宝项链',
    // 棋盘 6×5；四角全锁，紧邻角的边缘半锁，其余开放
    peekCells: [1, 4, 6, 11, 18, 23, 25, 28],
    fogCells: [0, 5, 24, 29],
    peekItemId: 'event_jewelry_1',
    starterItems: ['event_jewelry_1', 'event_jewelry_1', 'event_jewelry_2'],
    portalCell: 14,
  },
  {
    id: 'stage_2',
    name: '第二层',
    goalItemId: 'event_jewelry_11',
    goalText: '合出彩宝项圈',
    peekCells: [2, 3, 7, 10, 12, 17, 19, 22, 26, 27],
    fogCells: [0, 1, 4, 5, 6, 11, 18, 23, 24, 25, 28, 29],
    peekItemId: 'event_jewelry_1',
    starterItems: ['event_jewelry_2', 'event_jewelry_2', 'event_jewelry_3'],
    portalCell: 14,
  },
  {
    id: 'stage_3',
    name: '第三层',
    goalItemId: 'event_jewelry_12',
    goalText: '合出钻石皇冠',
    // 棋盘 6×7（多 2 行）：中部 4×3 开放核心 + 时空门(21)，外圈半锁、最外圈全锁
    rows: 7,
    peekCells: [7, 8, 9, 10, 12, 17, 18, 23, 24, 29, 31, 32, 33, 34],
    fogCells: [0, 1, 2, 3, 4, 5, 6, 11, 30, 35, 36, 37, 38, 39, 40, 41],
    peekItemId: 'event_jewelry_2',
    starterItems: ['event_jewelry_3', 'event_jewelry_3', 'event_jewelry_4'],
    portalCell: 21,
  },
  {
    id: 'stage_4',
    name: '最终层',
    goalItemId: 'event_jewelry_13',
    goalText: '合出星辉王冠',
    // 棋盘 6×7（多 2 行）：菱形开放区，外圈层层半锁 / 全锁；最终层无时空门
    rows: 7,
    peekCells: [8, 9, 13, 16, 18, 23, 25, 28, 32, 33],
    fogCells: [
      0, 1, 2, 3, 4, 5, 6, 7, 10, 11, 12, 17, 24, 29, 30, 31, 34, 35, 36, 37, 38, 39, 40, 41,
    ],
    peekItemId: 'event_jewelry_2',
    starterItems: ['event_jewelry_4', 'event_jewelry_4', 'event_jewelry_5'],
  },
];

export const EVENT_DISCOVERY_REWARDS: EventDiscoveryRewardDef[] = [
  { itemId: 'event_jewelry_1', rewards: [{ kind: 'stamina', amount: 3 }] },
  { itemId: 'event_jewelry_2', rewards: [{ kind: 'stamina', amount: 5 }] },
  { itemId: 'event_jewelry_3', rewards: [{ kind: 'diamond', amount: 1 }] },
  { itemId: 'event_jewelry_4', rewards: [{ kind: 'stamina', amount: 8 }] },
  { itemId: 'event_jewelry_5', rewards: [{ kind: 'diamond', amount: 2 }] },
  { itemId: 'event_jewelry_6', rewards: [{ kind: 'boxItem', itemId: 'currency_stamina_1', count: 1 }] },
  { itemId: 'event_jewelry_7', rewards: [{ kind: 'diamond', amount: 3 }] },
  { itemId: 'event_jewelry_8', rewards: [{ kind: 'boxReward', itemId: 'diamond_bag_1', count: 1 }] },
  { itemId: 'event_jewelry_9', rewards: [{ kind: 'diamond', amount: 5 }] },
  { itemId: 'event_jewelry_10', rewards: [{ kind: 'boxReward', itemId: 'stamina_chest_1', count: 1 }] },
  { itemId: 'event_jewelry_11', rewards: [{ kind: 'diamond', amount: 8 }] },
  { itemId: 'event_jewelry_12', rewards: [{ kind: 'boxReward', itemId: 'diamond_bag_2', count: 1 }] },
  { itemId: 'event_jewelry_13', rewards: [{ kind: 'diamond', amount: 10 }] },
];

/**
 * 合成「常驻」掉落：每次合成都有机会爆出 钻石 / 体力 / 花愿。
 * 命中概率随结果等级提高（越高级越容易掉），花愿数量也按等级放大。
 */
export const EVENT_MERGE_COMMON_BASE_CHANCE = 0.16;
export const EVENT_MERGE_COMMON_PER_LEVEL = 0.012;
export const EVENT_MERGE_COMMON_MAX_CHANCE = 0.34;
export const EVENT_MERGE_COMMON_TABLE: EventDropEntry[] = [
  { reward: { kind: 'huayuan', amount: 20 }, weight: 5 },
  { reward: { kind: 'stamina', amount: 2 }, weight: 4 },
  { reward: { kind: 'diamond', amount: 1 }, weight: 2 },
];

/**
 * 合成「稀有」掉落：仅较高级合成才可能，小概率，每日有限。
 * 体力宝箱 / 钻石袋 / 红包，直接进收纳盒。
 */
export const EVENT_MERGE_RARE_MIN_LEVEL = 4;
export const EVENT_MERGE_RARE_BASE_CHANCE = 0.02;
export const EVENT_MERGE_RARE_PER_LEVEL = 0.004;
export const EVENT_MERGE_RARE_MAX_CHANCE = 0.06;
export const EVENT_MERGE_RARE_DAILY_LIMIT = 6;
export const EVENT_MERGE_RARE_TABLE: EventDropEntry[] = [
  { reward: { kind: 'boxReward', itemId: 'stamina_chest_1', count: 1 }, weight: 4 },
  { reward: { kind: 'boxReward', itemId: 'diamond_bag_1', count: 1 }, weight: 3 },
  { reward: { kind: 'boxReward', itemId: 'hongbao_1', count: 1 }, weight: 3 },
];

export const EVENT_ORDER_BOX_DAILY_LIMIT = 18;
export const EVENT_ORDER_BOX_DAILY_GUARANTEE = 6;
export const EVENT_ORDER_BOX_CHANCE = 0.35;

/**
 * 主玩法普通订单携带原石奖励的概率（不宜过高），按订单档位区分：
 * 越高级的订单出原石概率越高。命中后该订单在花愿奖励基础上额外显示 1 原石，
 * 交单时发放到活动库存。
 */
export const EVENT_ORDER_STONE_CHANCE_BY_TIER: Record<string, number> = {
  C: 0.08,
  B: 0.14,
  A: 0.22,
  S: 0.32,
};
/** 取某档位订单的原石概率（未知档位回退到 C） */
export function getEventOrderStoneChance(tier: string): number {
  return EVENT_ORDER_STONE_CHANCE_BY_TIER[tier] ?? EVENT_ORDER_STONE_CHANCE_BY_TIER.C;
}
/** 单个订单携带的原石数量（固定 1） */
export const EVENT_ORDER_STONE_AMOUNT = 1;
