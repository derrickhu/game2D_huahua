/**
 * 每日挑战分档：`CurrencyManager.globalLevel`（全场景星级综合）决定档；
 * 每周一 05:00 与存档中的 `challengeTierId` 同步锁定，详见 QuestManager。
 */
import {
  ALL_DAILY_TEMPLATE_IDS,
  DAILY_QUEST_TEMPLATES,
  getDailyQuestTemplate,
  seededShuffle,
  type DailyChallengeReward,
  type DailyQuestTemplate,
  type WeeklyMilestoneDef,
} from '@/config/DailyChallengeConfig';
import {
  CRYSTAL_BALL_ITEM_ID,
  GOLDEN_SCISSORS_ITEM_ID,
  LUCKY_COIN_ITEM_ID,
} from '@/config/ItemConfig';

/**
 * 4 节点周积分轨道：体力宝箱 / 幸运金币 / 万能水晶 / 金剪刀。
 * 各档调用本工厂时只需声明体力宝箱等级、4 个 threshold、以及统一的 coin/ball/scissors 数量。
 */
function buildWeeklyMilestones(
  tierKey: string,
  thresholds: [number, number, number, number],
  staminaChestId: 'stamina_chest_1' | 'stamina_chest_2' | 'stamina_chest_3',
  itemCount: number,
): WeeklyMilestoneDef[] {
  return [
    { id: `wm_${tierKey}_chest`,    threshold: thresholds[0], reward: { itemId: staminaChestId,        itemCount: 1 } },
    { id: `wm_${tierKey}_coin`,     threshold: thresholds[1], reward: { itemId: LUCKY_COIN_ITEM_ID,    itemCount } },
    { id: `wm_${tierKey}_ball`,     threshold: thresholds[2], reward: { itemId: CRYSTAL_BALL_ITEM_ID,  itemCount } },
    { id: `wm_${tierKey}_scissors`, threshold: thresholds[3], reward: { itemId: GOLDEN_SCISSORS_ITEM_ID, itemCount } },
  ];
}

const KIND_ORDER = ['huayuan', 'merge', 'deliver', 'diamond'] as const;

function idsForKinds(rowsPerKind: 1 | 2 | 3 | 4): string[] {
  const out: string[] = [];
  for (const kind of KIND_ORDER) {
    const row = DAILY_QUEST_TEMPLATES.filter(t => t.kind === kind).sort((a, b) =>
      a.id.localeCompare(b.id),
    );
    for (let i = 0; i < rowsPerKind && i < row.length; i++) {
      out.push(row[i].id);
    }
  }
  return out;
}

/** 每类 2 条，共 8 */
const NOVICE_DAILY_IDS = idsForKinds(2);
/** 每类 3 条，共 12 */
const MID_DAILY_IDS = idsForKinds(3);
/** 完全版任务池（16） */
const FULL_DAILY_IDS = [...ALL_DAILY_TEMPLATE_IDS];

export interface DailyChallengeTierDef {
  id: string;
  /** 与 `getGlobalLevel` 一致，闭区间 */
  minGlobalLevel: number;
  maxGlobalLevel: number;
  /** 当日从此池 shuffle 下发（条数 = 池长度） */
  dailyTemplateIds: readonly string[];
  weeklyMilestones: WeeklyMilestoneDef[];
  /**
   * 当日所有每日任务均达成目标后可额外领取一次（日切重置；与单条是否已领无关）。
   * 未配置则面板不显示该槽位。
   */
  dailyAllCompleteBonus?: DailyChallengeReward;
}

/**
 * 周积分轨道改版：四档统一 4 节点结构（体力宝箱 / 幸运金币 / 万能水晶 / 金剪刀），
 * 体力宝箱等级与三道具数量随档位升档。
 *
 * 数量曲线（道具）：5 → 7 → 8 → 10
 * 体力宝箱：       1 → 1 → 2 → 3
 * 阈值取各档原有「前 4 节点」附近，保证 7 日满档可达且最后一节仍有冲刺感。
 */

/** 新手：globalLevel 1–5 */
const TIER_NOVICE: DailyChallengeTierDef = {
  id: 'novice',
  minGlobalLevel: 1,
  maxGlobalLevel: 5,
  dailyTemplateIds: NOVICE_DAILY_IDS,
  dailyAllCompleteBonus: { stamina: 50 },
  weeklyMilestones: buildWeeklyMilestones('n', [100, 280, 450, 600], 'stamina_chest_1', 5),
};

/** 成长：6–10 */
const TIER_MID: DailyChallengeTierDef = {
  id: 'mid',
  minGlobalLevel: 6,
  maxGlobalLevel: 10,
  dailyTemplateIds: MID_DAILY_IDS,
  dailyAllCompleteBonus: { stamina: 80 },
  weeklyMilestones: buildWeeklyMilestones('m', [150, 450, 750, 1050], 'stamina_chest_1', 7),
};

/** 进阶：11–19，满额日任务 + 周轨 */
const TIER_ADVANCED: DailyChallengeTierDef = {
  id: 'advanced',
  minGlobalLevel: 11,
  maxGlobalLevel: 19,
  dailyTemplateIds: FULL_DAILY_IDS,
  dailyAllCompleteBonus: { stamina: 90 },
  weeklyMilestones: buildWeeklyMilestones('a', [100, 350, 650, 950], 'stamina_chest_2', 8),
};

/** 完全版：globalLevel ≥ 20 */
const TIER_FULL: DailyChallengeTierDef = {
  id: 'full',
  minGlobalLevel: 20,
  maxGlobalLevel: 99999,
  dailyTemplateIds: FULL_DAILY_IDS,
  dailyAllCompleteBonus: { stamina: 100 },
  weeklyMilestones: buildWeeklyMilestones('f', [100, 350, 700, 1100], 'stamina_chest_3', 10),
};

/** 按 minGlobalLevel 升序；匹配时取首个落入区间的档 */
export const DAILY_CHALLENGE_TIERS: readonly DailyChallengeTierDef[] = [
  TIER_NOVICE,
  TIER_MID,
  TIER_ADVANCED,
  TIER_FULL,
] as const;

export const DAILY_CHALLENGE_FULL_TIER_ID = TIER_FULL.id;

export function resolveDailyChallengeTier(globalLevel: number): DailyChallengeTierDef {
  const lv = Math.max(1, Math.floor(globalLevel));
  for (const t of DAILY_CHALLENGE_TIERS) {
    if (lv >= t.minGlobalLevel && lv <= t.maxGlobalLevel) return t;
  }
  return TIER_FULL;
}

export function getDailyChallengeTierById(tierId: string): DailyChallengeTierDef {
  return DAILY_CHALLENGE_TIERS.find(t => t.id === tierId) ?? TIER_FULL;
}

export function getWeeklyMilestonesForTier(tierId: string): WeeklyMilestoneDef[] {
  const t = DAILY_CHALLENGE_TIERS.find(x => x.id === tierId);
  return t ? [...t.weeklyMilestones] : [...TIER_FULL.weeklyMilestones];
}

/** 该档单日全完成可得周积分之和（用于平衡校验） */
export function dailyMaxWeeklyPointsForTier(tier: DailyChallengeTierDef): number {
  let s = 0;
  for (const id of tier.dailyTemplateIds) {
    const def = getDailyQuestTemplate(id);
    if (def) s += def.weeklyPoints;
  }
  return s;
}

/**
 * 按档生成当日任务顺序（与 periodId、tier 绑定，可复现）。
 * 先对池子做种子 shuffle，再按 `KIND_ORDER` 分组排序，避免同类任务（如两条花愿）被拆到列表两端。
 * 同类内部的先后仍由当次 shuffle 决定。
 */
export function pickDailyTemplatesForPeriod(periodId: string, tier: DailyChallengeTierDef): DailyQuestTemplate[] {
  const pool: DailyQuestTemplate[] = [];
  for (const id of tier.dailyTemplateIds) {
    const def = getDailyQuestTemplate(id);
    if (def) pool.push(def);
  }
  const seed = `${periodId}|${tier.id}`;
  const shuffled = seededShuffle(pool, seed);
  const kindRank = (k: DailyQuestTemplate['kind']): number => {
    const i = KIND_ORDER.indexOf(k);
    return i >= 0 ? i : 99;
  };
  return shuffled
    .map((t, idx) => ({ t, idx }))
    .sort((a, b) => {
      const dk = kindRank(a.t.kind) - kindRank(b.t.kind);
      if (dk !== 0) return dk;
      return a.idx - b.idx;
    })
    .map(x => x.t);
}

function assertTierWeeklyBalance(tier: DailyChallengeTierDef): void {
  const dailyMax = dailyMaxWeeklyPointsForTier(tier);
  const last = tier.weeklyMilestones[tier.weeklyMilestones.length - 1];
  if (!last) return;
  const ok = 7 * dailyMax > last.threshold;
  if (!ok) {
    console.error(
      `[DailyChallengeTier] 平衡失败 tier=${tier.id}: 7*${dailyMax}=${7 * dailyMax} <= milestone ${last.threshold}`,
    );
  }
}

for (const t of DAILY_CHALLENGE_TIERS) {
  assertTierWeeklyBalance(t);
}
