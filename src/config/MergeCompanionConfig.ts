/**
 * 合成伴生物（含漂浮气泡）— 规则与类型定义
 *
 * MVP 默认：spatialMode=float（四季物语式，不占格），气泡载荷 clone_result。
 * grid（MM/L&P 占格）仅占位枚举，后续实现。
 */
import { Category, InteractType } from './ItemConfig';

/** 全局开关（策划可关） */
export const MERGE_COMPANION_ENABLED = true;

/** 每次合成最多生成伴生物条数（MVP 为 1） */
export const MERGE_COMPANION_MAX_SPAWN_PER_MERGE = 1;

/** 棋盘上最多同时存在的漂浮气泡数（满则不再生成，减少后再按概率出） */
export const MERGE_COMPANION_MAX_ACTIVE_FLOAT = 4;

/** 全局等级（globalLevel）≥ 此值才可能出现合成气泡；1～2 级不出现 */
export const MERGE_COMPANION_MIN_GLOBAL_LEVEL = 3;

/** 倒计时结束且未钻石解锁时补偿体力（飞入顶栏后入账） */
export const MERGE_BUBBLE_EXPIRE_STAMINA = 2;

/** 玩家可见名称（底栏标题、Toast 等，与系统内「merge 伴生气泡」代码概念区分） */
export const MERGE_BUBBLE_DISPLAY_NAME = '花语泡泡';

/**
 * 气泡内物品 `ItemDef.level` ≤ 此值时，钻石解锁免费（**仅非工具**；工具见下述工具价）
 * 规则表 `bubble.diamondPrice` 为鲜花/饮品等的基础价（等级超过此阈值时收取）
 */
export const MERGE_BUBBLE_FREE_DIAMOND_MAX_ITEM_LEVEL = 7;

/** 气泡载荷为「工具」时的钻石价：底分 + level×系数，且不低于下限（大幅高于鲜花） */
export const MERGE_BUBBLE_TOOL_DIAMOND_BASE = 52;
export const MERGE_BUBBLE_TOOL_DIAMOND_PER_LEVEL = 18;
export const MERGE_BUBBLE_TOOL_DIAMOND_MIN = 64;

/** 概率乘数（调试或活动 Buff） */
export const MERGE_COMPANION_DEFAULT_CHANCE_MULT = 1;

export type MergeCompanionSpatialMode = 'float' | 'grid';

export type MergeCompanionCarrier =
  | 'bubble'
  | 'direct_board'
  | 'direct_reward_box'
  | 'currency_only';

export type MergeCompanionPayload =
  | { kind: 'clone_result' }
  | { kind: 'fixed_item'; itemId: string; count?: number }
  | { kind: 'pool'; poolId: string };

export interface MergeCompanionBubbleOptions {
  durationSec: number;
  diamondPrice: number;
  /**
   * 保留字段（策划表兼容）；花语泡泡倒计时**仅在局内**递减，离线暂停，不再按墙钟。
   * @deprecated 逻辑已忽略，可填 `run`
   */
  offlineTimerBehavior: 'run' | 'pause';
  /** 已下线：花愿移除泡泡（底栏不再展示；读档时强制关闭） */
  dismissEnabled?: boolean;
  dismissHuayuanAmount?: number;
}

/** 规则匹配条件（基于本次合成结果 resultId） */
export interface MergeCompanionMatch {
  categories?: Category[];
  /** FlowerLine / DrinkLine 等 */
  lines?: string[];
  /** 若填写，合成结果的 `ItemDef.interactType` 须命中其一（如仅工具） */
  interactTypes?: InteractType[];
  resultLevelMin?: number;
  resultLevelMax?: number;
  /** 是否允许半锁格跨格合成触发；默认 true */
  allowPeekMerge?: boolean;
}

export interface MergeCompanionRuleDef {
  id: string;
  priority: number;
  /** 同组多条仅保留最高 priority 一条参与当次合成 */
  groupId?: string;
  /** 0~1，单次合成对该条独立掷骰 */
  baseChance: number;
  match: MergeCompanionMatch;
  carrier: MergeCompanionCarrier;
  spatialMode?: MergeCompanionSpatialMode;
  payload: MergeCompanionPayload;
  bubble?: MergeCompanionBubbleOptions;
  /** carrier=currency_only */
  currency?: { huayuan?: number; diamond?: number; stamina?: number };
  /**
   * 若填写，则 context.activityTags 须包含其中每一条才参与匹配
   *（活动通过 MergeCompanionManager.registerActivityRules + setActivityTags 注入）
   */
  requiredActivityTags?: string[];
}

/** 常驻规则表 */
export const MERGE_COMPANION_RULES: MergeCompanionRuleDef[] = [
  {
    id: 'flower_float_bubble_clone',
    priority: 10,
    groupId: 'merge_bonus',
    baseChance: 0.07,
    match: {
      categories: [Category.FLOWER],
      resultLevelMin: 1,
      resultLevelMax: 12,
      allowPeekMerge: true,
    },
    carrier: 'bubble',
    spatialMode: 'float',
    payload: { kind: 'clone_result' },
    bubble: {
      durationSec: 180,
      diamondPrice: 12,
      offlineTimerBehavior: 'run',
    },
  },
  {
    id: 'tool_float_bubble_clone',
    priority: 10,
    groupId: 'merge_bonus',
    baseChance: 0.06,
    match: {
      categories: [Category.BUILDING],
      interactTypes: [InteractType.TOOL],
      resultLevelMin: 1,
      resultLevelMax: 24,
      allowPeekMerge: true,
    },
    carrier: 'bubble',
    spatialMode: 'float',
    payload: { kind: 'clone_result' },
    bubble: {
      durationSec: 180,
      diamondPrice: 12,
      offlineTimerBehavior: 'run',
    },
  },
  /**
   * 兜底：饮品、宝箱、货币块、非工具建筑等。同组 `merge_bonus` 内仅保留一条规则参与当次合成，
   * 故须排在鲜花/工具之后，避免覆盖专类概率。
   */
  {
    id: 'misc_float_bubble_clone',
    priority: 10,
    groupId: 'merge_bonus',
    baseChance: 0.07,
    match: {
      resultLevelMin: 1,
      allowPeekMerge: true,
    },
    carrier: 'bubble',
    spatialMode: 'float',
    payload: { kind: 'clone_result' },
    bubble: {
      durationSec: 180,
      diamondPrice: 12,
      offlineTimerBehavior: 'run',
    },
  },
];

/**
 * 示例：活动「仅标签匹配时」额外花愿（注册见 MergeCompanionManager.registerActivityRules）
 * 勿直接并入 MERGE_COMPANION_RULES，避免误开活动逻辑。
 */
export const MERGE_COMPANION_SAMPLE_ACTIVITY_RULES: MergeCompanionRuleDef[] = [
  {
    id: 'sample_event_merge_huayuan',
    priority: 80,
    groupId: 'event_sample',
    baseChance: 0.15,
    requiredActivityTags: ['sample_merge_event'],
    match: {
      categories: [Category.FLOWER],
      resultLevelMin: 2,
      allowPeekMerge: true,
    },
    carrier: 'currency_only',
    payload: { kind: 'clone_result' },
    currency: { huayuan: 3 },
  },
  {
    id: 'sample_event_direct_box_item',
    priority: 70,
    groupId: 'event_sample',
    baseChance: 0.05,
    requiredActivityTags: ['sample_merge_event'],
    match: {
      categories: [Category.DRINK],
      resultLevelMin: 1,
      allowPeekMerge: true,
    },
    carrier: 'direct_reward_box',
    payload: { kind: 'fixed_item', itemId: 'drink_tea_1', count: 1 },
  },
];
