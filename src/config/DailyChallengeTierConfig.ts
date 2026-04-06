/**
 * 每日挑战分档：`CurrencyManager.globalLevel`（全场景星级综合）决定档；
 * 每周一 05:00 与存档中的 `challengeTierId` 同步锁定，详见 QuestManager。
 */
import {
  ALL_DAILY_TEMPLATE_IDS,
  DAILY_QUEST_TEMPLATES,
  getDailyQuestTemplate,
  seededShuffle,
  WEEKLY_MILESTONES,
  type DailyQuestTemplate,
  type WeeklyMilestoneDef,
} from '@/config/DailyChallengeConfig';
import {
  CRYSTAL_BALL_ITEM_ID,
  GOLDEN_SCISSORS_ITEM_ID,
  LUCKY_COIN_ITEM_ID,
} from '@/config/ItemConfig';

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
}

/** 新手：globalLevel 1–5 */
const TIER_NOVICE: DailyChallengeTierDef = {
  id: 'novice',
  minGlobalLevel: 1,
  maxGlobalLevel: 5,
  dailyTemplateIds: NOVICE_DAILY_IDS,
  weeklyMilestones: [
    { id: 'wm_n_100', threshold: 100, reward: { stamina: 20 } },
    { id: 'wm_n_280', threshold: 280, reward: { stamina: 40 } },
    { id: 'wm_n_450', threshold: 450, reward: { diamond: 10 } },
    { id: 'wm_n_600', threshold: 600, reward: { itemId: 'diamond_bag_1', itemCount: 1 } },
  ],
};

/** 成长：6–10 */
const TIER_MID: DailyChallengeTierDef = {
  id: 'mid',
  minGlobalLevel: 6,
  maxGlobalLevel: 10,
  dailyTemplateIds: MID_DAILY_IDS,
  weeklyMilestones: [
    { id: 'wm_m_150', threshold: 150, reward: { stamina: 30 } },
    { id: 'wm_m_450', threshold: 450, reward: { itemId: 'stamina_chest_2', itemCount: 1 } },
    { id: 'wm_m_750', threshold: 750, reward: { itemId: 'diamond_bag_1', itemCount: 1 } },
    { id: 'wm_m_1050', threshold: 1050, reward: { itemId: LUCKY_COIN_ITEM_ID, itemCount: 1 } },
    { id: 'wm_m_1250', threshold: 1250, reward: { itemId: CRYSTAL_BALL_ITEM_ID, itemCount: 1 } },
  ],
};

/** 进阶：11–19，满额日任务 + 周轨（体力 / 银宝箱 / 钻 / 幸运金币 / 万能水晶 / 金剪刀） */
const TIER_ADVANCED: DailyChallengeTierDef = {
  id: 'advanced',
  minGlobalLevel: 11,
  maxGlobalLevel: 19,
  dailyTemplateIds: FULL_DAILY_IDS,
  weeklyMilestones: [
    { id: 'wm_a_100', threshold: 100, reward: { stamina: 50 } },
    { id: 'wm_a_350', threshold: 350, reward: { itemId: 'chest_2', itemCount: 1 } },
    { id: 'wm_a_650', threshold: 650, reward: { diamond: 15 } },
    { id: 'wm_a_950', threshold: 950, reward: { itemId: LUCKY_COIN_ITEM_ID, itemCount: 1 } },
    { id: 'wm_a_1250', threshold: 1250, reward: { itemId: CRYSTAL_BALL_ITEM_ID, itemCount: 1 } },
    { id: 'wm_a_1450', threshold: 1450, reward: { itemId: GOLDEN_SCISSORS_ITEM_ID, itemCount: 1 } },
  ],
};

/** 完全版：globalLevel ≥ 20 */
const TIER_FULL: DailyChallengeTierDef = {
  id: 'full',
  minGlobalLevel: 20,
  maxGlobalLevel: 99999,
  dailyTemplateIds: FULL_DAILY_IDS,
  weeklyMilestones: WEEKLY_MILESTONES.map(m => ({ ...m })),
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
 */
export function pickDailyTemplatesForPeriod(periodId: string, tier: DailyChallengeTierDef): DailyQuestTemplate[] {
  const pool: DailyQuestTemplate[] = [];
  for (const id of tier.dailyTemplateIds) {
    const def = getDailyQuestTemplate(id);
    if (def) pool.push(def);
  }
  return seededShuffle(pool, `${periodId}|${tier.id}`);
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
