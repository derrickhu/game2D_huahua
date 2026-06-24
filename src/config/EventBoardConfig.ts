import { EVENT_JEWELRY_STARTER_BOX_ID } from './ItemConfig';

export const JEWELRY_EVENT_ID = 'jewelry_box_event';
export const JEWELRY_EVENT_NAME = '花间珠匣';
/** 花间珠匣活动开放所需玩家综合等级 */
export const JEWELRY_EVENT_UNLOCK_LEVEL = 3;

export function isJewelryEventUnlocked(playerLevel: number): boolean {
  return playerLevel >= JEWELRY_EVENT_UNLOCK_LEVEL;
}

export const EVENT_BOARD_COLS = 6;
/** 基础行数（阶段未单独指定 rows 时使用） */
export const EVENT_BOARD_ROWS = 5;
export const EVENT_BOARD_TOTAL = EVENT_BOARD_COLS * EVENT_BOARD_ROWS;
/** 棋盘格视图最多构建的行数（后期阶段更大棋盘的上限，用于一次性建好格视图） */
export const EVENT_BOARD_MAX_ROWS = 7;
export const EVENT_BOARD_MAX_TOTAL = EVENT_BOARD_COLS * EVENT_BOARD_MAX_ROWS;

export const JEWELRY_STARTER_BOX_ITEM_ID = EVENT_JEWELRY_STARTER_BOX_ID;
export const JEWELRY_ITEM_PREFIX = 'event_jewelry_';
export const DIAN_CUI_ITEM_PREFIX = 'event_jewelry_dian_cui_';
export const EVENT_CODEX_ITEM_IDS: readonly string[] = [
  ...Array.from({ length: 13 }, (_, i) => `${JEWELRY_ITEM_PREFIX}${i + 1}`),
  ...Array.from({ length: 8 }, (_, i) => `${DIAN_CUI_ITEM_PREFIX}${i + 1}`),
];

/** 活动满级产出工具：每件最多点击产出 10 次，用完消失；不消耗体力。 */
export const EVENT_PRODUCER_TOTAL_DROPS = 10;
export const EVENT_PRODUCER_DROP_TABLE: readonly { itemId: string; weight: number }[] = [
  { itemId: 'stamina_chest_1', weight: 1 },
  { itemId: 'stamina_chest_2', weight: 1 },
  { itemId: 'stamina_chest_3', weight: 1 },
  { itemId: 'lucky_coin_1', weight: 1 },
  { itemId: 'currency_diamond_1', weight: 1 },
];

/** 进度条上标注「合出可获得钥匙」的首饰等级（参考同类活动 9/10/12 级角标） */
export const EVENT_KEY_BADGE_LEVELS: readonly number[] = [9, 10, 12];

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
    // 棋盘 6×6：在 6×5 基础上底部加一行，顶/底行对称全锁角 + 半锁边
    rows: 6,
    peekCells: [2, 3, 7, 10, 12, 17, 19, 22, 26, 27, 32, 33],
    fogCells: [0, 1, 4, 5, 6, 11, 18, 23, 24, 25, 28, 29, 30, 31, 34, 35],
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
 * 合成奖励物品掉落：首饰线合成有概率爆 1 个奖励棋子，落活动棋盘空格，满格进奖励篮。
 * 基础 20%，随合成结果等级 +1.5%/级，12 级及以上封顶 45%。
 * 权重从高到低：1 级花愿 > 1 级体力 > 1 级红包 > 1 级钻石 > 1 级体力箱；幸运金币极低；钻石/体力箱权重已压低。
 */
export const EVENT_MERGE_DROP_BASE_CHANCE = 0.2;
export const EVENT_MERGE_DROP_PER_LEVEL = 0.015;
export const EVENT_MERGE_DROP_MAX_CHANCE = 0.45;
export const EVENT_MERGE_DROP_TABLE: EventDropEntry[] = [
  { reward: { kind: 'boxItem', itemId: 'currency_huayuan_pickup_1', count: 1 }, weight: 420 },
  { reward: { kind: 'boxItem', itemId: 'currency_stamina_1', count: 1 }, weight: 180 },
  { reward: { kind: 'boxItem', itemId: 'hongbao_1', count: 1 }, weight: 120 },
  { reward: { kind: 'boxItem', itemId: 'currency_diamond_1', count: 1 }, weight: 30 },
  { reward: { kind: 'boxItem', itemId: 'stamina_chest_1', count: 1 }, weight: 15 },
  { reward: { kind: 'boxItem', itemId: 'lucky_coin_1', count: 1 }, weight: 4 },
];

/**
 * 主首饰线合成时的小概率副产物：点翠凤冠线 L1/L2。
 * 与上方普通奖励互斥；概率低于普通奖励，避免副线挤占主玩法收益。
 */
export const EVENT_MERGE_BYPRODUCT_BASE_CHANCE = 0.08;
export const EVENT_MERGE_BYPRODUCT_PER_LEVEL = 0.006;
export const EVENT_MERGE_BYPRODUCT_MAX_CHANCE = 0.18;
export const EVENT_MERGE_BYPRODUCT_TABLE: EventDropEntry[] = [
  { reward: { kind: 'boxItem', itemId: `${DIAN_CUI_ITEM_PREFIX}1`, count: 1 }, weight: 75 },
  { reward: { kind: 'boxItem', itemId: `${DIAN_CUI_ITEM_PREFIX}2`, count: 1 }, weight: 25 },
];

export const EVENT_ORDER_BOX_DAILY_LIMIT = 18;
export const EVENT_ORDER_BOX_DAILY_GUARANTEE = 6;
export const EVENT_ORDER_BOX_CHANCE = 0.35;

/**
 * 主玩法普通订单携带原石奖励的概率，按订单档位区分：
 * 越高级的订单出原石概率越高。命中后该订单在花愿奖励基础上额外显示原石，
 * 交单时发放到活动库存。
 */
export const EVENT_ORDER_STONE_CHANCE_BY_TIER: Record<string, number> = {
  C: 0.4,
  B: 0.5,
  A: 0.55,
  S: 0.6,
};
/** 取某档位订单的原石概率（未知档位回退到 C） */
export function getEventOrderStoneChance(tier: string): number {
  return EVENT_ORDER_STONE_CHANCE_BY_TIER[tier] ?? EVENT_ORDER_STONE_CHANCE_BY_TIER.C;
}

/** 命中原石奖励后，各档订单给的原石数量区间（C/B/A/S = 1-8 递增） */
export const EVENT_ORDER_STONE_AMOUNT_RANGE_BY_TIER: Record<string, { min: number; max: number }> = {
  C: { min: 1, max: 2 },
  B: { min: 2, max: 4 },
  A: { min: 4, max: 6 },
  S: { min: 6, max: 8 },
};

/** 取某档位订单的原石数量：生成订单时掷一次，所见即所得 */
export function rollEventOrderStoneAmount(tier: string): number {
  const range = EVENT_ORDER_STONE_AMOUNT_RANGE_BY_TIER[tier] ?? EVENT_ORDER_STONE_AMOUNT_RANGE_BY_TIER.C;
  const min = Math.max(1, Math.floor(range.min));
  const max = Math.max(min, Math.floor(range.max));
  return min + Math.floor(Math.random() * (max - min + 1));
}
