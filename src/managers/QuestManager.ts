/**
 * 每日挑战 + 周积分里程碑（无成就系统）
 *
 * 每日：本地每天 05:00 刷新；条数与难度由 `globalLevel` 锁定档决定（当周与周里程碑同档）。
 * 周：每周一本地 05:00 重置周积分与里程碑领取，并按当时 `globalLevel` 重算档。
 */
import { EventBus } from '@/core/EventBus';
import { CurrencyManager } from './CurrencyManager';
import { RewardBoxManager } from './RewardBoxManager';
import { FlowerSignTicketManager } from './FlowerSignTicketManager';
import { SaveManager } from './SaveManager';
import {
  DAILY_CHALLENGE_TIERS,
  DAILY_CHALLENGE_FULL_TIER_ID,
  getDailyChallengeTierById,
  pickDailyTemplatesForPeriod,
  resolveDailyChallengeTier,
} from '@/config/DailyChallengeTierConfig';
import {
  describeDailyQuest,
  getDailyQuestTemplate,
  type DailyChallengeReward,
  type DailyQuestKind,
  type DailyQuestTemplate,
  type WeeklyMilestoneDef,
} from '@/config/DailyChallengeConfig';
import { getDailyQuestPeriodIdLocal, getWeekIdLocal } from '@/utils/WeeklyCycle';
import { ITEM_DEFS } from '@/config/ItemConfig';
import { PersistService } from '@/core/PersistService';

const QUEST_STORAGE_KEY = 'huahua_quests';
const SAVE_VERSION = 4;

export interface DailyQuestRuntime {
  templateId: string;
  current: number;
  claimed: boolean;
}

class QuestManagerClass {
  private _dailyLocalDate = '';
  private _dailyTasks: DailyQuestRuntime[] = [];
  private _weekId = '';
  /** 本周锁定档（与周里程碑、每日池一致）；每周一 05:00 随周重置刷新 */
  private _challengeTierId = DAILY_CHALLENGE_FULL_TIER_ID;
  private _weeklyPoints = 0;
  private _weeklyMilestonesClaimed = new Set<string>();
  /** 当日「全部每日任务达成目标」额外奖是否已领（日切随 `_generateDailyQuests` 重置） */
  private _dailyAllCompleteBonusClaimed = false;
  private _initialized = false;

  get dailyTasks(): readonly DailyQuestRuntime[] {
    return this._dailyTasks;
  }

  get weeklyPoints(): number {
    return this._weeklyPoints;
  }

  get weekId(): string {
    return this._weekId;
  }

  get weeklyMilestonesClaimed(): ReadonlySet<string> {
    return this._weeklyMilestonesClaimed;
  }

  /** 当前周挑战档 id（`novice` / `mid` / `advanced` / `full`） */
  get challengeTierId(): string {
    return this._challengeTierId;
  }

  get dailyAllCompleteBonusClaimed(): boolean {
    return this._dailyAllCompleteBonusClaimed;
  }

  getTemplate(id: string): DailyQuestTemplate | undefined {
    return getDailyQuestTemplate(id);
  }

  describeTemplate(t: DailyQuestTemplate): string {
    return describeDailyQuest(t);
  }

  get weeklyMilestoneDefs(): WeeklyMilestoneDef[] {
    return [...getDailyChallengeTierById(this._challengeTierId).weeklyMilestones];
  }

  init(): void {
    if (this._initialized) return;
    this._initialized = true;
    this._loadState();
    this._bindEvents();
  }

  private _bindEvents(): void {
    EventBus.on('board:merged', () => {
      this._incrementKind('merge', 1);
    });
    EventBus.on('customer:delivered', () => {
      this._incrementKind('deliver', 1);
    });
    EventBus.on('quest:huayuanEarned', (amount: number) => {
      this._incrementKind('huayuan', Math.max(0, Math.floor(amount)));
    });
    EventBus.on('quest:diamondSpent', (amount: number) => {
      this._incrementKind('diamond', Math.max(0, Math.floor(amount)));
    });
  }

  private _checkWeekRollover(): void {
    const wid = getWeekIdLocal();
    if (this._weekId && this._weekId !== wid) {
      this._weekId = wid;
      this._weeklyPoints = 0;
      this._weeklyMilestonesClaimed.clear();
      this._challengeTierId = resolveDailyChallengeTier(CurrencyManager.globalLevel).id;
      this._save();
      EventBus.emit('quest:weekReset');
    } else if (!this._weekId) {
      this._weekId = wid;
      this._challengeTierId = resolveDailyChallengeTier(CurrencyManager.globalLevel).id;
      this._save();
    }
  }

  private _checkDailyRefresh(): void {
    const periodId = getDailyQuestPeriodIdLocal();
    if (this._dailyLocalDate !== periodId) {
      this._dailyLocalDate = periodId;
      this._generateDailyQuests();
    }
  }

  private _generateDailyQuests(): void {
    const tier = getDailyChallengeTierById(this._challengeTierId);
    const picked = pickDailyTemplatesForPeriod(this._dailyLocalDate, tier);
    this._dailyTasks = picked.map(t => ({
      templateId: t.id,
      current: 0,
      claimed: false,
    }));
    this._dailyAllCompleteBonusClaimed = false;
    this._save();
    EventBus.emit('quest:refreshed');
  }

  /** 当日每条每日任务进度均已达标（不要求已领取单条奖励） */
  private _allDailyObjectivesComplete(): boolean {
    if (this._dailyTasks.length === 0) return false;
    for (const q of this._dailyTasks) {
      const def = getDailyQuestTemplate(q.templateId);
      if (!def || q.current < def.target) return false;
    }
    return true;
  }

  private _tryGrantDailyAllCompleteBonus(granted: DailyChallengeReward[]): boolean {
    const tier = getDailyChallengeTierById(this._challengeTierId);
    const bonus = tier.dailyAllCompleteBonus;
    if (!bonus || this._dailyAllCompleteBonusClaimed) return false;
    if (!this._allDailyObjectivesComplete()) return false;
    this._dailyAllCompleteBonusClaimed = true;
    this._applyInstantReward(bonus);
    granted.push({ ...bonus });
    EventBus.emit('quest:dailyAllCompleteBonusClaimed');
    return true;
  }

  /** 领取「当日全部每日任务达成」额外奖（不入周积分） */
  claimDailyAllCompleteBonus(): boolean {
    this._checkWeekRollover();
    this._checkDailyRefresh();
    const granted: DailyChallengeReward[] = [];
    if (!this._tryGrantDailyAllCompleteBonus(granted)) return false;
    this._save();
    SaveManager.save();
    EventBus.emit('quest:updated');
    return true;
  }

  private _incrementKind(kind: DailyQuestKind, delta: number): void {
    if (delta <= 0) return;
    this._checkWeekRollover();
    this._checkDailyRefresh();

    let updated = false;
    for (const q of this._dailyTasks) {
      const def = getDailyQuestTemplate(q.templateId);
      if (!def || def.kind !== kind || q.claimed) continue;
      const next = Math.min(q.current + delta, def.target);
      if (next !== q.current) {
        q.current = next;
        updated = true;
        if (q.current >= def.target) {
          EventBus.emit('quest:taskCompleted', q.templateId);
        }
      }
    }

    if (updated) {
      this._save();
      EventBus.emit('quest:updated');
    }
  }

  private _applyInstantReward(r: DailyChallengeReward): void {
    if (r.huayuan) CurrencyManager.addHuayuan(r.huayuan);
    if (r.stamina) CurrencyManager.addStamina(r.stamina);
    if (r.diamond) CurrencyManager.addDiamond(r.diamond);
    if (r.flowerSignTickets && r.flowerSignTickets > 0) {
      FlowerSignTicketManager.add(r.flowerSignTickets);
    }
    if (r.itemId && r.itemCount && ITEM_DEFS.has(r.itemId)) {
      RewardBoxManager.addItem(r.itemId, r.itemCount);
    }
  }

  /** 领取单条每日挑战奖励（含注入周积分） */
  claimDailyTask(templateId: string): boolean {
    this._checkWeekRollover();
    this._checkDailyRefresh();

    const q = this._dailyTasks.find(t => t.templateId === templateId);
    const def = getDailyQuestTemplate(templateId);
    if (!q || !def || q.claimed || q.current < def.target) return false;

    q.claimed = true;
    this._applyInstantReward(def.reward);
    this._weeklyPoints += def.weeklyPoints;

    this._save();
    SaveManager.save();
    EventBus.emit('quest:claimed', templateId);
    EventBus.emit('quest:updated');
    return true;
  }

  claimWeeklyMilestone(milestoneId: string): boolean {
    this._checkWeekRollover();

    const milestones = getDailyChallengeTierById(this._challengeTierId).weeklyMilestones;
    const m = milestones.find(x => x.id === milestoneId);
    if (!m || this._weeklyMilestonesClaimed.has(milestoneId)) return false;
    if (this._weeklyPoints < m.threshold) return false;

    this._weeklyMilestonesClaimed.add(milestoneId);
    this._applyInstantReward(m.reward);
    this._save();
    SaveManager.save();
    EventBus.emit('quest:weeklyMilestoneClaimed', milestoneId);
    EventBus.emit('quest:updated');
    return true;
  }

  /**
   * 一次领取当前所有可领的每日任务 + 周里程碑（先每日以累计周积分，再按档领周奖）。
   * 单次存档与 `quest:updated`；返回本次实际发放的奖励列表（用于合并飞入动效）。
   */
  claimAllPendingRewards(): DailyChallengeReward[] {
    this._checkWeekRollover();
    this._checkDailyRefresh();

    const granted: DailyChallengeReward[] = [];

    for (const q of this._dailyTasks) {
      const def = getDailyQuestTemplate(q.templateId);
      if (!def || q.claimed || q.current < def.target) continue;
      q.claimed = true;
      this._applyInstantReward(def.reward);
      this._weeklyPoints += def.weeklyPoints;
      granted.push({ ...def.reward });
      EventBus.emit('quest:claimed', q.templateId);
    }

    this._tryGrantDailyAllCompleteBonus(granted);

    const weekMs = getDailyChallengeTierById(this._challengeTierId).weeklyMilestones;
    for (const m of weekMs) {
      if (this._weeklyMilestonesClaimed.has(m.id)) continue;
      if (this._weeklyPoints < m.threshold) continue;
      this._weeklyMilestonesClaimed.add(m.id);
      this._applyInstantReward(m.reward);
      granted.push({ ...m.reward });
      EventBus.emit('quest:weeklyMilestoneClaimed', m.id);
    }

    if (granted.length === 0) return [];

    this._save();
    SaveManager.save();
    EventBus.emit('quest:updated');
    return granted;
  }

  get hasClaimableDaily(): boolean {
    this._checkWeekRollover();
    this._checkDailyRefresh();
    if (this._hasClaimableDailyAllCompleteBonus()) return true;
    return this._dailyTasks.some(q => {
      const def = getDailyQuestTemplate(q.templateId);
      return def && !q.claimed && q.current >= def.target;
    });
  }

  private _hasClaimableDailyAllCompleteBonus(): boolean {
    const tier = getDailyChallengeTierById(this._challengeTierId);
    if (!tier.dailyAllCompleteBonus || this._dailyAllCompleteBonusClaimed) return false;
    return this._allDailyObjectivesComplete();
  }

  get hasClaimableWeeklyMilestone(): boolean {
    this._checkWeekRollover();
    for (const m of getDailyChallengeTierById(this._challengeTierId).weeklyMilestones) {
      if (this._weeklyMilestonesClaimed.has(m.id)) continue;
      if (this._weeklyPoints >= m.threshold) return true;
    }
    return false;
  }

  /** 红点：每日可领或周里程碑可领 */
  get hasClaimableQuest(): boolean {
    return this.hasClaimableDaily || this.hasClaimableWeeklyMilestone;
  }

  // ====== 存档 ======

  private _save(): void {
    const data = {
      version: SAVE_VERSION,
      dailyLocalDate: this._dailyLocalDate,
      dailyTasks: this._dailyTasks.map(t => ({ ...t })),
      weekId: this._weekId,
      challengeTierId: this._challengeTierId,
      weeklyPoints: this._weeklyPoints,
      weeklyMilestonesClaimed: [...this._weeklyMilestonesClaimed],
      dailyAllCompleteBonusClaimed: this._dailyAllCompleteBonusClaimed,
    };
    try {
      PersistService.writeRaw(QUEST_STORAGE_KEY, JSON.stringify(data));
    } catch (_) {}
  }

  private _loadState(): void {
    let migratedFromV2 = false;
    try {
      const raw = PersistService.readRaw(QUEST_STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        const fileVer = data.version | 0;
        if ((fileVer === 2 || fileVer === 3 || fileVer === SAVE_VERSION) && data.dailyTasks?.length) {
          this._dailyLocalDate = data.dailyLocalDate || '';
          this._dailyTasks = (data.dailyTasks || [])
            .filter((q: DailyQuestRuntime) => getDailyQuestTemplate(q.templateId))
            .map((q: DailyQuestRuntime) => ({
              templateId: q.templateId,
              current: Math.max(0, q.current | 0),
              claimed: !!q.claimed,
            }));
          this._weekId = data.weekId || '';
          this._weeklyPoints = Math.max(0, data.weeklyPoints | 0);
          this._weeklyMilestonesClaimed = new Set(data.weeklyMilestonesClaimed || []);
          this._dailyAllCompleteBonusClaimed = !!data.dailyAllCompleteBonusClaimed;

          if (fileVer === 2) {
            migratedFromV2 = true;
            this._challengeTierId = resolveDailyChallengeTier(CurrencyManager.globalLevel).id;
          } else {
            const tid = data.challengeTierId as string | undefined;
            this._challengeTierId =
              tid && DAILY_CHALLENGE_TIERS.some(t => t.id === tid)
                ? tid
                : resolveDailyChallengeTier(CurrencyManager.globalLevel).id;
          }
        }
      }
    } catch (_) {}

    this._checkWeekRollover();
    const periodId = getDailyQuestPeriodIdLocal();
    const tier = getDailyChallengeTierById(this._challengeTierId);

    if (migratedFromV2) {
      this._dailyLocalDate = periodId;
      this._generateDailyQuests();
    } else if (this._dailyTasks.length === 0) {
      this._dailyLocalDate = periodId;
      this._generateDailyQuests();
    } else {
      this._checkDailyRefresh();
      if (this._dailyTasks.length !== tier.dailyTemplateIds.length) {
        this._dailyLocalDate = periodId;
        this._generateDailyQuests();
      }
    }
  }
}

export const QuestManager = new QuestManagerClass();
