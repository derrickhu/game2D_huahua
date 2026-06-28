import {
  CRYSTAL_BALL_ITEM_ID,
  EVENT_JEWELRY_STARTER_BOX_ID,
  GOLDEN_SCISSORS_ITEM_ID,
  LUCKY_COIN_ITEM_ID,
} from '../ItemConfig';

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
/** 原石发射器落到棋盘时，直接变成 2/3 级首饰的概率 */
export const EVENT_STARTER_STONE_LEVEL2_CHANCE = 0.22;
export const EVENT_STARTER_STONE_LEVEL3_CHANCE = 0.03;
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
  /** 少量锁格惊喜：覆盖指定半锁/全锁格内压着的物品。全锁格揭开后才显示。 */
  lockedCellItems?: Record<number, string>;
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
  | { kind: 'flowerSignTickets'; amount: number }
  /** 货币拾取块等：优先落到活动棋盘空格，满了进收纳盒 */
  | { kind: 'boxItem'; itemId: string; count: number }
  /** 宝箱/钻石袋/红包等：直接进收纳盒（活动棋盘开不了） */
  | { kind: 'boxReward'; itemId: string; count: number }
  /** 活动限定装修奖励 */
  | { kind: 'deco'; decoId: string }
  /** 活动限定店主形象奖励 */
  | { kind: 'outfit'; outfitId: string };

export type EventProgressEchoObjective =
  | { kind: 'codex_discovered'; target: number }
  | { kind: 'merge_count'; target: number }
  | { kind: 'item_discovered'; itemId: string };

export interface EventProgressEchoMilestoneDef {
  id: string;
  title: string;
  objective: EventProgressEchoObjective;
  primaryReward: EventRewardDef;
  adReward: EventRewardDef;
}

export const EVENT_PROGRESS_ECHO_MILESTONES: readonly EventProgressEchoMilestoneDef[] = [
  {
    id: 'codex_5',
    title: '解锁 5 件首饰',
    objective: { kind: 'codex_discovered', target: 5 },
    primaryReward: { kind: 'stamina', amount: 30 },
    adReward: { kind: 'flowerSignTickets', amount: 2 },
  },
  {
    id: 'jewelry_7',
    title: '解锁云翠金镯',
    objective: { kind: 'item_discovered', itemId: `${JEWELRY_ITEM_PREFIX}7` },
    primaryReward: { kind: 'diamond', amount: 5 },
    adReward: { kind: 'boxReward', itemId: LUCKY_COIN_ITEM_ID, count: 1 },
  },
  {
    id: 'codex_10',
    title: '解锁 10 件首饰',
    objective: { kind: 'codex_discovered', target: 10 },
    primaryReward: { kind: 'stamina', amount: 60 },
    adReward: { kind: 'flowerSignTickets', amount: 3 },
  },
  {
    id: 'jewelry_10',
    title: '解锁翠纹华臂',
    objective: { kind: 'item_discovered', itemId: `${JEWELRY_ITEM_PREFIX}10` },
    primaryReward: { kind: 'boxReward', itemId: 'stamina_chest_1', count: 1 },
    adReward: { kind: 'boxReward', itemId: CRYSTAL_BALL_ITEM_ID, count: 1 },
  },
  {
    id: 'dian_cui_6',
    title: '解锁点翠高冠',
    objective: { kind: 'item_discovered', itemId: `${DIAN_CUI_ITEM_PREFIX}6` },
    primaryReward: { kind: 'diamond', amount: 10 },
    adReward: { kind: 'boxReward', itemId: CRYSTAL_BALL_ITEM_ID, count: 1 },
  },
  {
    id: 'merge_2000',
    title: '合成首饰 1000 次',
    objective: { kind: 'merge_count', target: 1000 },
    primaryReward: { kind: 'stamina', amount: 50 },
    adReward: { kind: 'boxReward', itemId: LUCKY_COIN_ITEM_ID, count: 1 },
  },
  {
    id: 'jewelry_13',
    title: '解锁绯翠华链',
    objective: { kind: 'item_discovered', itemId: `${JEWELRY_ITEM_PREFIX}13` },
    primaryReward: { kind: 'diamond', amount: 10 },
    adReward: { kind: 'boxReward', itemId: CRYSTAL_BALL_ITEM_ID, count: 1 },
  },
  {
    id: 'codex_15',
    title: '解锁 15 件首饰',
    objective: { kind: 'codex_discovered', target: 15 },
    primaryReward: { kind: 'flowerSignTickets', amount: 10 },
    adReward: { kind: 'boxReward', itemId: LUCKY_COIN_ITEM_ID, count: 1 },
  },
  {
    id: 'codex_20',
    title: '解锁 20 件首饰',
    objective: { kind: 'codex_discovered', target: 20 },
    primaryReward: { kind: 'stamina', amount: 120 },
    adReward: { kind: 'boxReward', itemId: GOLDEN_SCISSORS_ITEM_ID, count: 1 },
  },
  {
    id: 'merge_5000',
    title: '合成首饰 3000 次',
    objective: { kind: 'merge_count', target: 3000 },
    primaryReward: { kind: 'boxReward', itemId: 'diamond_bag_1', count: 1 },
    adReward: { kind: 'boxReward', itemId: GOLDEN_SCISSORS_ITEM_ID, count: 1 },
  },
  {
    id: 'codex_21',
    title: '解锁全部图鉴',
    objective: { kind: 'codex_discovered', target: 21 },
    primaryReward: { kind: 'deco', decoId: 'event_jewelry_empty_tea_table' },
    adReward: { kind: 'deco', decoId: 'event_jewelry_back_sofa' },
  },
];

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
    goalText: '合出碧珠流光',
    // 棋盘 6×5；四角全锁，紧邻角的边缘半锁，其余开放
    peekCells: [1, 4, 6, 11, 18, 23, 25, 28],
    fogCells: [0, 5, 24, 29],
    peekItemId: 'event_jewelry_1',
    starterItems: ['event_jewelry_1', 'event_jewelry_1', 'event_jewelry_1'],
    portalCell: 14,
  },
  {
    id: 'stage_2',
    name: '第二层',
    goalItemId: 'event_jewelry_10',
    goalText: '合出翠纹华臂',
    // 棋盘 6×6：锁格总量控制在 3 行以内，避免继承物被挤掉
    rows: 6,
    peekCells: [2, 3, 7, 10, 12, 17, 19, 22, 26, 27],
    fogCells: [0, 5, 6, 11, 24, 29, 34, 35],
    peekItemId: 'event_jewelry_1',
    lockedCellItems: {
      10: 'event_jewelry_3',
      29: 'event_jewelry_4',
      34: 'event_jewelry_6',
    },
    starterItems: ['event_jewelry_2', 'event_jewelry_2', 'event_jewelry_3'],
    portalCell: 14,
  },
  {
    id: 'stage_3',
    name: '第三层',
    goalItemId: 'event_jewelry_12',
    goalText: '合出绯月璎珞',
    // 棋盘 6×7（多 2 行）：中部开放核心更大，锁格总量控制在 3 行以内
    rows: 7,
    peekCells: [7, 8, 9, 10, 12, 17, 18, 23, 32, 34],
    fogCells: [0, 5, 6, 11, 35, 38, 40, 41],
    peekItemId: 'event_jewelry_2',
    lockedCellItems: {
      17: 'event_jewelry_3',
      35: 'event_jewelry_8',
      38: 'event_jewelry_8',
      40: 'event_jewelry_9',
    },
    starterItems: ['event_jewelry_3', 'event_jewelry_3', 'event_jewelry_4'],
    portalCell: 21,
  },
  {
    id: 'stage_4',
    name: '最终层',
    goalItemId: 'event_jewelry_13',
    goalText: '合出绯翠华链',
    // 棋盘 6×7（多 2 行）：最终层保留惊喜锁格，但锁格总量控制在 3 行以内
    rows: 7,
    peekCells: [1, 4, 8, 9, 13, 16, 23, 28, 31, 33],
    fogCells: [0, 5, 7, 10, 29, 34, 37, 39],
    peekItemId: 'event_jewelry_2',
    lockedCellItems: {
      13: 'event_jewelry_3',
      16: 'event_jewelry_4',
      0: 'event_jewelry_8',
      5: 'event_jewelry_8',
      7: 'event_jewelry_8',
      10: 'event_jewelry_9',
      29: 'event_jewelry_9',
      34: 'event_jewelry_10',
      37: 'event_jewelry_11',
    },
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
 * 权重从高到低：1 级花愿 > 低频体力 > 1 级钻石 > 极低频体力箱 / 幸运金币。
 */
export const EVENT_MERGE_DROP_BASE_CHANCE = 0.2;
export const EVENT_MERGE_DROP_PER_LEVEL = 0.015;
export const EVENT_MERGE_DROP_MAX_CHANCE = 0.45;
export const EVENT_MERGE_DROP_TABLE: EventDropEntry[] = [
  { reward: { kind: 'boxItem', itemId: 'currency_huayuan_pickup_1', count: 1 }, weight: 300 },
  { reward: { kind: 'boxItem', itemId: 'currency_stamina_1', count: 1 }, weight: 70 },
  { reward: { kind: 'boxItem', itemId: 'currency_diamond_1', count: 1 }, weight: 30 },
  { reward: { kind: 'boxReward', itemId: 'stamina_chest_1', count: 1 }, weight: 8 },
  { reward: { kind: 'boxReward', itemId: 'lucky_coin_1', count: 1 }, weight: 4 },
];

/**
 * 主首饰线合成时的小概率副产物：点翠凤冠线 L1/L2。
 * 与上方普通奖励互斥；概率低于普通奖励，避免副线挤占主玩法收益。
 */
export const EVENT_MERGE_BYPRODUCT_BASE_CHANCE = 0.08;
export const EVENT_MERGE_BYPRODUCT_PER_LEVEL = 0.006;
export const EVENT_MERGE_BYPRODUCT_MAX_CHANCE = 0.18;
export const EVENT_MERGE_BYPRODUCT_TABLE: EventDropEntry[] = [
  { reward: { kind: 'boxItem', itemId: `${DIAN_CUI_ITEM_PREFIX}1`, count: 1 }, weight: 1 },
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
  C: 0.5,
  B: 0.55,
  A: 0.6,
  S: 0.65,
};
/** 取某档位订单的原石概率（未知档位回退到 C） */
export function getEventOrderStoneChance(tier: string): number {
  return EVENT_ORDER_STONE_CHANCE_BY_TIER[tier] ?? EVENT_ORDER_STONE_CHANCE_BY_TIER.C;
}

/** 命中原石奖励后，各档订单给的原石数量区间（C/B/A/S = 1-8 递增） */
export const EVENT_ORDER_STONE_AMOUNT_RANGE_BY_TIER: Record<string, { min: number; max: number }> = {
  C: { min: 2, max: 4 },
  B: { min: 4, max: 7 },
  A: { min: 7, max: 11 },
  S: { min: 11, max: 15 },
};

/** 取某档位订单的原石数量：生成订单时掷一次，所见即所得 */
export function rollEventOrderStoneAmount(tier: string): number {
  const range = EVENT_ORDER_STONE_AMOUNT_RANGE_BY_TIER[tier] ?? EVENT_ORDER_STONE_AMOUNT_RANGE_BY_TIER.C;
  const min = Math.max(1, Math.floor(range.min));
  const max = Math.max(min, Math.floor(range.max));
  return min + Math.floor(Math.random() * (max - min + 1));
}
