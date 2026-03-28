/**
 * 每日任务 + 成就系统
 *
 * 每日任务：每天刷新3个简单目标，完成获得奖励
 * 成就系统：永久进度里程碑，解锁时发放大额奖励
 */
import { EventBus } from '@/core/EventBus';
import { CurrencyManager } from './CurrencyManager';

declare const wx: any;
declare const tt: any;
const _api = typeof wx !== 'undefined' ? wx : typeof tt !== 'undefined' ? tt : null;

const QUEST_STORAGE_KEY = 'huahua_quests';

// ====== 每日任务定义 ======

export interface QuestDef {
  id: string;
  name: string;
  desc: string;
  target: number;
  /** 监听的事件名 */
  event: string;
  reward: { huayuan?: number; stamina?: number; diamond?: number };
}

/** 每日任务池（随机选取3个） */
const QUEST_POOL: QuestDef[] = [
  { id: 'merge_3', name: '合成新手', desc: '完成3次合成', target: 3, event: 'board:merged', reward: { huayuan: 50 } },
  { id: 'merge_5', name: '合成达人', desc: '完成5次合成', target: 5, event: 'board:merged', reward: { huayuan: 100 } },
  { id: 'merge_10', name: '合成大师', desc: '完成10次合成', target: 10, event: 'board:merged', reward: { huayuan: 200, diamond: 5 } },
  { id: 'deliver_1', name: '客似云来', desc: '交付1位客人', target: 1, event: 'customer:delivered', reward: { huayuan: 80 } },
  { id: 'deliver_2', name: '人气花店', desc: '交付2位客人', target: 2, event: 'customer:delivered', reward: { huayuan: 150 } },
  { id: 'building_2', name: '勤劳花匠', desc: '使用建筑产出2次', target: 2, event: 'building:produced', reward: { stamina: 20 } },
  { id: 'building_5', name: '产出大师', desc: '使用建筑产出5次', target: 5, event: 'building:produced', reward: { huayuan: 100, stamina: 10 } },
  { id: 'combo_3', name: '连击初学', desc: '达成3连击', target: 3, event: 'quest:comboReached', reward: { huayuan: 80 } },
  { id: 'unlock_1', name: '探索之路', desc: '解锁1个新格子', target: 1, event: 'board:cellUnlocked', reward: { huayuan: 60 } },
  { id: 'sell_1', name: '精明店主', desc: '出售1个物品', target: 1, event: 'board:itemSold', reward: { huayuan: 50 } },
];

// ====== 成就定义 ======

export interface AchievementDef {
  id: string;
  name: string;
  desc: string;
  icon: string;
  tiers: { target: number; reward: { huayuan?: number; diamond?: number } }[];
  /** 累计统计的事件名 */
  event: string;
}

const ACHIEVEMENT_DEFS: AchievementDef[] = [
  {
    id: 'total_merge',
    name: '合成大师',
    desc: '累计合成次数',
    icon: '🔨',
    tiers: [
      { target: 10, reward: { huayuan: 100 } },
      { target: 50, reward: { huayuan: 300, diamond: 5 } },
      { target: 200, reward: { huayuan: 500, diamond: 10 } },
      { target: 500, reward: { huayuan: 1000, diamond: 20 } },
      { target: 2000, reward: { huayuan: 2000, diamond: 50 } },
    ],
    event: 'board:merged',
  },
  {
    id: 'total_deliver',
    name: '人气店主',
    desc: '累计交付客人',
    icon: '👥',
    tiers: [
      { target: 5, reward: { huayuan: 100 } },
      { target: 20, reward: { huayuan: 300, diamond: 5 } },
      { target: 50, reward: { huayuan: 500, diamond: 10 } },
      { target: 200, reward: { huayuan: 1000, diamond: 20 } },
      { target: 1000, reward: { huayuan: 3000, diamond: 50 } },
    ],
    event: 'customer:delivered',
  },
  {
    id: 'best_combo',
    name: '连击达人',
    desc: '达成最高连击',
    icon: '🔥',
    tiers: [
      { target: 3, reward: { huayuan: 50 } },
      { target: 5, reward: { huayuan: 100, diamond: 3 } },
      { target: 10, reward: { huayuan: 300, diamond: 10 } },
      { target: 20, reward: { diamond: 30 } },
    ],
    event: 'quest:comboReached',
  },
  {
    id: 'total_unlock',
    name: '探索先锋',
    desc: '累计解锁格子数',
    icon: '🗺️',
    tiers: [
      { target: 5, reward: { huayuan: 100 } },
      { target: 15, reward: { huayuan: 300, diamond: 5 } },
      { target: 30, reward: { huayuan: 500, diamond: 15 } },
    ],
    event: 'board:cellUnlocked',
  },
  {
    id: 'total_huayuan',
    name: '商业奇才',
    desc: '累计获得花愿',
    icon: '💰',
    tiers: [
      { target: 500, reward: { diamond: 5 } },
      { target: 2000, reward: { diamond: 10 } },
      { target: 10000, reward: { diamond: 30 } },
    ],
    event: 'quest:huayuanEarned',
  },
];

// ====== 运行时状态 ======

export interface QuestProgress {
  defId: string;
  current: number;
  claimed: boolean;
}

export interface AchievementProgress {
  defId: string;
  current: number;
  /** 已领取的最高阶 tier index (-1 = 未领取) */
  claimedTier: number;
}

interface QuestSaveData {
  date: string;
  quests: QuestProgress[];
  achievements: AchievementProgress[];
}

class QuestManagerClass {
  private _dailyQuests: QuestProgress[] = [];
  private _achievements: AchievementProgress[] = [];
  private _todayDate = '';
  private _initialized = false;

  get dailyQuests(): readonly QuestProgress[] { return this._dailyQuests; }
  get achievements(): readonly AchievementProgress[] { return this._achievements; }

  /** 获取任务定义 */
  getQuestDef(defId: string): QuestDef | undefined {
    return QUEST_POOL.find(q => q.id === defId);
  }

  /** 获取成就定义 */
  getAchievementDef(defId: string): AchievementDef | undefined {
    return ACHIEVEMENT_DEFS.find(a => a.id === defId);
  }

  /** 所有成就定义 */
  get allAchievementDefs(): readonly AchievementDef[] { return ACHIEVEMENT_DEFS; }

  init(): void {
    if (this._initialized) return;
    this._initialized = true;

    this._loadState();
    this._bindEvents();
  }

  /** 检查每日任务是否需要刷新 */
  private _checkDailyRefresh(): void {
    const today = new Date().toISOString().slice(0, 10);
    if (this._todayDate !== today) {
      this._todayDate = today;
      this._generateDailyQuests();
    }
  }

  /** 随机生成3个每日任务 */
  private _generateDailyQuests(): void {
    const shuffled = [...QUEST_POOL].sort(() => Math.random() - 0.5);
    this._dailyQuests = shuffled.slice(0, 3).map(def => ({
      defId: def.id,
      current: 0,
      claimed: false,
    }));
    this._save();
    EventBus.emit('quest:refreshed');
  }

  /** 绑定游戏事件监听 */
  private _bindEvents(): void {
    // 合成事件
    EventBus.on('board:merged', () => {
      this._incrementQuest('board:merged');
      this._incrementAchievement('board:merged');
    });

    // 客人交付
    EventBus.on('customer:delivered', () => {
      this._incrementQuest('customer:delivered');
      this._incrementAchievement('customer:delivered');
    });

    // 建筑产出
    EventBus.on('building:produced', () => {
      this._incrementQuest('building:produced');
    });

    // 格子解锁
    EventBus.on('board:cellUnlocked', () => {
      this._incrementQuest('board:cellUnlocked');
      this._incrementAchievement('board:cellUnlocked');
    });

    // 物品出售
    EventBus.on('board:itemSold', () => {
      this._incrementQuest('board:itemSold');
    });

    // 连击通知
    EventBus.on('combo:end', (count: number) => {
      this._onComboReached(count);
    });

    // 累计花愿获得（用于成就「商业奇才」）
    EventBus.on('quest:huayuanEarned', (amount: number) => {
      this._incrementAchievementBy('quest:huayuanEarned', amount);
    });
  }

  private _onComboReached(count: number): void {
    // 每日任务：检查连击任务
    for (const quest of this._dailyQuests) {
      const def = this.getQuestDef(quest.defId);
      if (def && def.event === 'quest:comboReached') {
        if (count > quest.current) {
          quest.current = Math.min(count, def.target);
          if (quest.current >= def.target && !quest.claimed) {
            EventBus.emit('quest:taskCompleted', quest.defId);
          }
        }
      }
    }

    // 成就：最高连击
    for (const ach of this._achievements) {
      if (ach.defId === 'best_combo') {
        if (count > ach.current) {
          ach.current = count;
          this._checkAchievementTiers(ach);
        }
      }
    }

    this._save();
    EventBus.emit('quest:updated');
  }

  /** 递增每日任务进度 */
  private _incrementQuest(eventName: string): void {
    this._checkDailyRefresh();

    let updated = false;
    for (const quest of this._dailyQuests) {
      const def = this.getQuestDef(quest.defId);
      if (!def || def.event !== eventName) continue;
      if (quest.claimed) continue;
      quest.current = Math.min(quest.current + 1, def.target);
      updated = true;
      if (quest.current >= def.target) {
        EventBus.emit('quest:taskCompleted', quest.defId);
      }
    }

    if (updated) {
      this._save();
      EventBus.emit('quest:updated');
    }
  }

  /** 递增成就进度（+1） */
  private _incrementAchievement(eventName: string): void {
    this._incrementAchievementBy(eventName, 1);
  }

  /** 递增成就进度（指定增量） */
  private _incrementAchievementBy(eventName: string, amount: number): void {
    let updated = false;
    for (const ach of this._achievements) {
      const def = this.getAchievementDef(ach.defId);
      if (!def || def.event !== eventName) continue;
      ach.current += amount;
      updated = true;
      this._checkAchievementTiers(ach);
    }

    if (updated) {
      this._save();
      EventBus.emit('achievement:updated');
    }
  }

  /** 检查成就阶梯是否达标 */
  private _checkAchievementTiers(ach: AchievementProgress): void {
    const def = this.getAchievementDef(ach.defId);
    if (!def) return;

    for (let i = ach.claimedTier + 1; i < def.tiers.length; i++) {
      if (ach.current >= def.tiers[i].target) {
        EventBus.emit('achievement:unlocked', ach.defId, i);
      }
    }
  }

  /** 领取每日任务奖励 */
  claimQuest(defId: string): boolean {
    const quest = this._dailyQuests.find(q => q.defId === defId);
    const def = this.getQuestDef(defId);
    if (!quest || !def) return false;
    if (quest.current < def.target || quest.claimed) return false;

    quest.claimed = true;
    if (def.reward.huayuan) CurrencyManager.addHuayuan(def.reward.huayuan);
    if (def.reward.stamina) CurrencyManager.addStamina(def.reward.stamina);
    if (def.reward.diamond) CurrencyManager.addDiamond(def.reward.diamond);

    this._save();
    EventBus.emit('quest:claimed', defId);
    return true;
  }

  /** 领取成就阶梯奖励 */
  claimAchievement(defId: string, tierIndex: number): boolean {
    const ach = this._achievements.find(a => a.defId === defId);
    const def = this.getAchievementDef(defId);
    if (!ach || !def) return false;
    if (tierIndex > ach.claimedTier + 1) return false; // 必须按顺序领
    if (tierIndex !== ach.claimedTier + 1) return false;
    if (ach.current < def.tiers[tierIndex].target) return false;

    const reward = def.tiers[tierIndex].reward;
    if (reward.huayuan) CurrencyManager.addHuayuan(reward.huayuan);
    if (reward.diamond) CurrencyManager.addDiamond(reward.diamond);

    ach.claimedTier = tierIndex;
    this._save();
    EventBus.emit('achievement:claimed', defId, tierIndex);
    return true;
  }

  /** 是否有可领取的每日任务 */
  get hasClaimableQuest(): boolean {
    this._checkDailyRefresh();
    return this._dailyQuests.some(q => {
      const def = this.getQuestDef(q.defId);
      return def && q.current >= def.target && !q.claimed;
    });
  }

  /** 是否有可领取的成就 */
  get hasClaimableAchievement(): boolean {
    return this._achievements.some(ach => {
      const def = this.getAchievementDef(ach.defId);
      if (!def) return false;
      const nextTier = ach.claimedTier + 1;
      return nextTier < def.tiers.length && ach.current >= def.tiers[nextTier].target;
    });
  }

  // ====== 存档 ======

  private _save(): void {
    const data: QuestSaveData = {
      date: this._todayDate,
      quests: [...this._dailyQuests],
      achievements: [...this._achievements],
    };
    try {
      _api?.setStorageSync(QUEST_STORAGE_KEY, JSON.stringify(data));
    } catch (_) {}
  }

  private _loadState(): void {
    try {
      const raw = _api?.getStorageSync(QUEST_STORAGE_KEY);
      if (raw) {
        const data: QuestSaveData = JSON.parse(raw);
        this._todayDate = data.date || '';
        this._dailyQuests = data.quests || [];
        this._achievements = data.achievements || [];
      }
    } catch (_) {}

    // 确保所有成就都有进度记录
    for (const def of ACHIEVEMENT_DEFS) {
      if (!this._achievements.find(a => a.defId === def.id)) {
        this._achievements.push({ defId: def.id, current: 0, claimedTier: -1 });
      }
    }

    // 检查每日刷新
    this._checkDailyRefresh();
  }
}

export const QuestManager = new QuestManagerClass();
