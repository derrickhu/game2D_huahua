/**
 * 每日挑战 + 周积分里程碑（无成就系统）
 *
 * 每日：本地每天 05:00 刷新，约 16 条梯度任务。
 * 周：每周一本地 05:00 重置周积分与里程碑领取状态。
 */
import { EventBus } from '@/core/EventBus';
import { CurrencyManager } from './CurrencyManager';
import { RewardBoxManager } from './RewardBoxManager';
import { SaveManager } from './SaveManager';
import {
  DAILY_QUEST_TEMPLATES,
  WEEKLY_MILESTONES,
  describeDailyQuest,
  getDailyQuestTemplate,
  seededShuffle,
  type DailyChallengeReward,
  type DailyQuestKind,
  type DailyQuestTemplate,
} from '@/config/DailyChallengeConfig';
import { getDailyQuestPeriodIdLocal, getWeekIdLocal } from '@/utils/WeeklyCycle';
import { ITEM_DEFS } from '@/config/ItemConfig';

declare const wx: any;
declare const tt: any;
const _api = typeof wx !== 'undefined' ? wx : typeof tt !== 'undefined' ? tt : null;

const QUEST_STORAGE_KEY = 'huahua_quests';
const SAVE_VERSION = 2;

export interface DailyQuestRuntime {
  templateId: string;
  current: number;
  claimed: boolean;
}

class QuestManagerClass {
  private _dailyLocalDate = '';
  private _dailyTasks: DailyQuestRuntime[] = [];
  private _weekId = '';
  private _weeklyPoints = 0;
  private _weeklyMilestonesClaimed = new Set<string>();
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

  getTemplate(id: string): DailyQuestTemplate | undefined {
    return getDailyQuestTemplate(id);
  }

  describeTemplate(t: DailyQuestTemplate): string {
    return describeDailyQuest(t);
  }

  get weeklyMilestoneDefs() {
    return WEEKLY_MILESTONES;
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
      this._save();
      EventBus.emit('quest:weekReset');
    } else if (!this._weekId) {
      this._weekId = wid;
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
    const order = seededShuffle(DAILY_QUEST_TEMPLATES, this._dailyLocalDate);
    this._dailyTasks = order.map(t => ({
      templateId: t.id,
      current: 0,
      claimed: false,
    }));
    this._save();
    EventBus.emit('quest:refreshed');
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

    const m = WEEKLY_MILESTONES.find(x => x.id === milestoneId);
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

  get hasClaimableDaily(): boolean {
    this._checkWeekRollover();
    this._checkDailyRefresh();
    return this._dailyTasks.some(q => {
      const def = getDailyQuestTemplate(q.templateId);
      return def && !q.claimed && q.current >= def.target;
    });
  }

  get hasClaimableWeeklyMilestone(): boolean {
    this._checkWeekRollover();
    for (const m of WEEKLY_MILESTONES) {
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
      weeklyPoints: this._weeklyPoints,
      weeklyMilestonesClaimed: [...this._weeklyMilestonesClaimed],
    };
    try {
      _api?.setStorageSync(QUEST_STORAGE_KEY, JSON.stringify(data));
    } catch (_) {}
  }

  private _loadState(): void {
    try {
      const raw = _api?.getStorageSync(QUEST_STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data.version === SAVE_VERSION && data.dailyTasks?.length) {
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
        }
      }
    } catch (_) {}

    this._checkWeekRollover();
    const periodId = getDailyQuestPeriodIdLocal();

    if (this._dailyTasks.length === 0) {
      this._dailyLocalDate = periodId;
      this._generateDailyQuests();
    } else {
      this._checkDailyRefresh();
    }
  }
}

export const QuestManager = new QuestManagerClass();
