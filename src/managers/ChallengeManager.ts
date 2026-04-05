/**
 * 挑战关卡系统管理器
 *
 * 挑战模式类型：
 * - ⏱️ 限时挑战：30/60/90秒内合成指定目标
 * - 📏 限步挑战：限定操作步数内完成合成
 * - 🎯 目标挑战：合成指定数量/等级的物品
 *
 * 奖励：
 * - 每个关卡首次通关奖励（金币/钻石/花愿/限定装饰）
 * - 三星评价系统（速度/步数/额外目标）
 * - 每周刷新新关卡
 */
import { EventBus } from '@/core/EventBus';
import { Platform } from '@/core/PlatformService';
import { CurrencyManager } from './CurrencyManager';
import { AdManager, AdScene } from './AdManager';

const STORAGE_KEY = 'huahua_challenge';

/** 挑战类型 */
export enum ChallengeType {
  TIMED = 'timed',         // 限时
  LIMITED_MOVES = 'moves', // 限步
  TARGET = 'target',       // 目标
}

/** 星级评价 */
export enum StarRating {
  NONE = 0,
  ONE = 1,
  TWO = 2,
  THREE = 3,
}

/** 挑战关卡定义 */
export interface ChallengeLevel {
  id: string;
  chapter: number;       // 章节（1~N）
  level: number;         // 关卡号（1~5）
  name: string;
  desc: string;
  icon: string;
  type: ChallengeType;

  /** 时间限制（秒，限时模式） */
  timeLimit?: number;
  /** 步数限制（限步模式） */
  moveLimit?: number;
  /** 合成目标 */
  targets: ChallengeTarget[];

  /** 三星条件 */
  star1: string;  // 1星条件描述
  star2: string;  // 2星条件描述
  star3: string;  // 3星条件描述

  /** 首次通关奖励 */
  reward: {
    gold: number;
    diamond: number;
    huayuan: number;
  };

  /** 解锁条件：需要前置关卡的星星数 */
  unlockStars: number;
}

/** 合成目标 */
export interface ChallengeTarget {
  /** 描述（如"合成3个3级花束"） */
  desc: string;
  /** 目标数量 */
  count: number;
  /** 当前进度 */
  current: number;
}

/** 挑战状态 */
export interface ChallengeState {
  isActive: boolean;
  currentLevelId: string | null;
  timeRemaining: number;
  movesUsed: number;
  targets: ChallengeTarget[];
}

// ═══════════════ 关卡配置 ═══════════════

const CHALLENGE_LEVELS: ChallengeLevel[] = [
  // 第1章：入门
  {
    id: 'c1_1', chapter: 1, level: 1, name: '初出茅庐', desc: '30秒内合成3个2级鲜花',
    icon: '🌱', type: ChallengeType.TIMED, timeLimit: 30,
    targets: [{ desc: '合成2级鲜花×3', count: 3, current: 0 }],
    star1: '完成目标', star2: '20秒内完成', star3: '15秒内完成',
    reward: { gold: 100, diamond: 2, huayuan: 0 },
    unlockStars: 0,
  },
  {
    id: 'c1_2', chapter: 1, level: 2, name: '花艺入门', desc: '合成1个3级鲜花',
    icon: '🌿', type: ChallengeType.TARGET,
    targets: [{ desc: '合成3级鲜花×1', count: 1, current: 0 }],
    star1: '完成目标', star2: '10步以内', star3: '5步以内',
    reward: { gold: 150, diamond: 3, huayuan: 0 },
    unlockStars: 1,
  },
  {
    id: 'c1_3', chapter: 1, level: 3, name: '节奏合成', desc: '45秒内完成8次合成',
    icon: '⚡', type: ChallengeType.TIMED, timeLimit: 45,
    targets: [{ desc: '完成8次合成', count: 8, current: 0 }],
    star1: '完成目标', star2: '剩余20秒以上', star3: '剩余30秒以上',
    reward: { gold: 200, diamond: 5, huayuan: 1 },
    unlockStars: 2,
  },
  {
    id: 'c1_4', chapter: 1, level: 4, name: '限步大师', desc: '8步内合成2个4级鲜花',
    icon: '📏', type: ChallengeType.LIMITED_MOVES, moveLimit: 8,
    targets: [{ desc: '合成4级鲜花×2', count: 2, current: 0 }],
    star1: '完成目标', star2: '6步内完成', star3: '4步内完成',
    reward: { gold: 250, diamond: 5, huayuan: 1 },
    unlockStars: 4,
  },
  {
    id: 'c1_5', chapter: 1, level: 5, name: '鲜花风暴', desc: '60秒内合成5个4级鲜花',
    icon: '🌪️', type: ChallengeType.TIMED, timeLimit: 60,
    targets: [{ desc: '合成4级鲜花×5', count: 5, current: 0 }],
    star1: '完成目标', star2: '40秒内', star3: '25秒内',
    reward: { gold: 400, diamond: 8, huayuan: 2 },
    unlockStars: 6,
  },

  // 第2章：进阶
  {
    id: 'c2_1', chapter: 2, level: 1, name: '标本进阶', desc: '合成2个4级蝴蝶标本',
    icon: '🦋', type: ChallengeType.TARGET,
    targets: [{ desc: '合成4级蝴蝶标本×2', count: 2, current: 0 }],
    star1: '完成目标', star2: '12步内', star3: '8步内',
    reward: { gold: 300, diamond: 5, huayuan: 1 },
    unlockStars: 8,
  },
  {
    id: 'c2_2', chapter: 2, level: 2, name: '高速合成', desc: '90秒内完成15次合成',
    icon: '💥', type: ChallengeType.TIMED, timeLimit: 90,
    targets: [{ desc: '完成15次合成', count: 15, current: 0 }],
    star1: '完成目标', star2: '剩余45秒以上', star3: '剩余60秒以上',
    reward: { gold: 500, diamond: 10, huayuan: 3 },
    unlockStars: 10,
  },
  {
    id: 'c2_3', chapter: 2, level: 3, name: '混合达人', desc: '同时合成鲜花和蝴蝶标本',
    icon: '🎨', type: ChallengeType.TIMED, timeLimit: 60,
    targets: [
      { desc: '合成4级鲜花×2', count: 2, current: 0 },
      { desc: '合成3级蝴蝶标本×2', count: 2, current: 0 },
    ],
    star1: '完成所有目标', star2: '40秒内', star3: '25秒内',
    reward: { gold: 600, diamond: 12, huayuan: 3 },
    unlockStars: 12,
  },
  {
    id: 'c2_4', chapter: 2, level: 4, name: '精准操控', desc: '6步内完成3个合成',
    icon: '🎯', type: ChallengeType.LIMITED_MOVES, moveLimit: 6,
    targets: [{ desc: '完成3次合成', count: 3, current: 0 }],
    star1: '完成目标', star2: '5步内', star3: '3步内',
    reward: { gold: 400, diamond: 8, huayuan: 2 },
    unlockStars: 14,
  },
  {
    id: 'c2_5', chapter: 2, level: 5, name: '终极花束', desc: '合成1个8级花束',
    icon: '🏆', type: ChallengeType.TIMED, timeLimit: 120,
    targets: [{ desc: '合成8级花束×1', count: 1, current: 0 }],
    star1: '完成目标', star2: '80秒内', star3: '50秒内',
    reward: { gold: 1000, diamond: 20, huayuan: 5 },
    unlockStars: 16,
  },

  // 第3章：大师
  {
    id: 'c3_1', chapter: 3, level: 1, name: '花束大师', desc: '合成1个7级花束',
    icon: '💐', type: ChallengeType.TARGET,
    targets: [{ desc: '合成7级花束×1', count: 1, current: 0 }],
    star1: '完成目标', star2: '15步内', star3: '10步内',
    reward: { gold: 600, diamond: 10, huayuan: 3 },
    unlockStars: 18,
  },
  {
    id: 'c3_2', chapter: 3, level: 2, name: '甜品盛宴', desc: '合成3个5级甜品',
    icon: '🎂', type: ChallengeType.TIMED, timeLimit: 90,
    targets: [{ desc: '合成5级甜品×3', count: 3, current: 0 }],
    star1: '完成目标', star2: '60秒内', star3: '40秒内',
    reward: { gold: 800, diamond: 15, huayuan: 4 },
    unlockStars: 20,
  },
  {
    id: 'c3_3', chapter: 3, level: 3, name: '全能花艺师', desc: '同时合成鲜花、花束和绿植',
    icon: '🌟', type: ChallengeType.TIMED, timeLimit: 120,
    targets: [
      { desc: '合成5级鲜花×1', count: 1, current: 0 },
      { desc: '合成5级花束×1', count: 1, current: 0 },
      { desc: '合成5级绿植×1', count: 1, current: 0 },
    ],
    star1: '完成所有目标', star2: '80秒内', star3: '50秒内',
    reward: { gold: 1200, diamond: 25, huayuan: 6 },
    unlockStars: 24,
  },
  {
    id: 'c3_4', chapter: 3, level: 4, name: '传说之路', desc: '合成1个10级鲜花',
    icon: '✨', type: ChallengeType.TARGET,
    targets: [{ desc: '合成金色牡丹×1', count: 1, current: 0 }],
    star1: '完成目标', star2: '25步内', star3: '18步内',
    reward: { gold: 2000, diamond: 40, huayuan: 10 },
    unlockStars: 28,
  },
  {
    id: 'c3_5', chapter: 3, level: 5, name: '绿植大师', desc: '合成1个10级绿植',
    icon: '👑', type: ChallengeType.TIMED, timeLimit: 180,
    targets: [{ desc: '合成松树盆景×1', count: 1, current: 0 }],
    star1: '完成目标', star2: '120秒内', star3: '80秒内',
    reward: { gold: 3000, diamond: 60, huayuan: 15 },
    unlockStars: 32,
  },
];

interface ChallengeSave {
  /** 各关卡最高星级 */
  stars: Record<string, StarRating>;
  /** 已领取首通奖励的关卡 */
  claimed: string[];
  /** 今日已用广告复活次数 */
  todayRevives: number;
  lastReviveDate: string;
}

class ChallengeManagerClass {
  /** 各关卡最高星级 */
  private _stars: Map<string, StarRating> = new Map();
  /** 已领取首通奖励 */
  private _claimed: Set<string> = new Set();
  /** 当前挑战状态 */
  private _state: ChallengeState = {
    isActive: false,
    currentLevelId: null,
    timeRemaining: 0,
    movesUsed: 0,
    targets: [],
  };

  private _todayRevives = 0;
  private _lastReviveDate = '';

  init(): void {
    this._loadState();
    console.log(`[Challenge] 初始化完成, 总星数: ${this.totalStars}`);
  }

  // ═══════════════ 关卡查询 ═══════════════

  /** 获取所有章节 */
  get chapters(): number[] {
    const set = new Set(CHALLENGE_LEVELS.map(l => l.chapter));
    return Array.from(set).sort();
  }

  /** 获取某章节的关卡 */
  getLevels(chapter: number): (ChallengeLevel & { bestStars: StarRating; unlocked: boolean; firstCleared: boolean })[] {
    return CHALLENGE_LEVELS
      .filter(l => l.chapter === chapter)
      .map(l => ({
        ...l,
        bestStars: this._stars.get(l.id) || StarRating.NONE,
        unlocked: this.totalStars >= l.unlockStars,
        firstCleared: this._claimed.has(l.id),
      }));
  }

  /** 总星数 */
  get totalStars(): number {
    let total = 0;
    for (const s of this._stars.values()) total += s;
    return total;
  }

  /** 总关卡数 */
  get totalLevels(): number { return CHALLENGE_LEVELS.length; }

  /** 已通关数 */
  get clearedLevels(): number {
    let count = 0;
    for (const s of this._stars.values()) if (s > 0) count++;
    return count;
  }

  /** 当前挑战状态 */
  get state(): Readonly<ChallengeState> { return this._state; }

  // ═══════════════ 挑战流程 ═══════════════

  /** 开始挑战 */
  startChallenge(levelId: string): boolean {
    const level = CHALLENGE_LEVELS.find(l => l.id === levelId);
    if (!level) return false;
    if (this.totalStars < level.unlockStars) return false;
    if (this._state.isActive) return false;

    this._state = {
      isActive: true,
      currentLevelId: levelId,
      timeRemaining: level.timeLimit || 999,
      movesUsed: 0,
      targets: level.targets.map(t => ({ ...t, current: 0 })),
    };

    EventBus.emit('challenge:started', levelId, level);
    console.log(`[Challenge] 开始挑战: ${level.name}`);

    // 绑定事件监听
    this._bindChallengeEvents();
    return true;
  }

  /** 每帧更新（限时模式） */
  update(dt: number): void {
    if (!this._state.isActive) return;

    const level = CHALLENGE_LEVELS.find(l => l.id === this._state.currentLevelId);
    if (!level) return;

    // 限时倒计时
    if (level.timeLimit) {
      this._state.timeRemaining -= dt;
      if (this._state.timeRemaining <= 0) {
        this._state.timeRemaining = 0;
        // 检查是否完成
        if (this._checkComplete()) {
          this._endChallenge(true);
        } else {
          this._endChallenge(false);
        }
      }
    }
  }

  /** 使用广告复活（额外30秒/5步） */
  reviveWithAd(callback: (success: boolean) => void): void {
    this._checkReviveReset();
    if (this._todayRevives >= 3) {
      callback(false);
      return;
    }

    AdManager.showRewardedAd(AdScene.REVIVE, (success) => {
      if (success && this._state.currentLevelId) {
        this._state.isActive = true;
        this._state.timeRemaining += 30;
        this._todayRevives++;
        this._saveState();
        EventBus.emit('challenge:revived');
      }
      callback(success);
    });
  }

  /** 放弃挑战 */
  abandonChallenge(): void {
    this._state.isActive = false;
    this._unbindChallengeEvents();
    EventBus.emit('challenge:abandoned', this._state.currentLevelId);
    this._state.currentLevelId = null;
  }

  // ═══════════════ 内部逻辑 ═══════════════

  private _mergeHandler = () => { this._onMerge(); };

  private _bindChallengeEvents(): void {
    EventBus.on('board:merged', this._mergeHandler);
  }

  private _unbindChallengeEvents(): void {
    EventBus.off('board:merged', this._mergeHandler);
  }

  private _onMerge(): void {
    if (!this._state.isActive) return;
    this._state.movesUsed++;

    // 更新目标进度（简化：每次合成+1）
    for (const t of this._state.targets) {
      if (t.current < t.count) {
        t.current++;
        break;
      }
    }

    // 检查限步模式
    const level = CHALLENGE_LEVELS.find(l => l.id === this._state.currentLevelId);
    if (level?.type === ChallengeType.LIMITED_MOVES && level.moveLimit) {
      if (this._state.movesUsed >= level.moveLimit) {
        if (this._checkComplete()) {
          this._endChallenge(true);
        } else {
          this._endChallenge(false);
        }
      }
    }

    // 检查目标模式
    if (this._checkComplete()) {
      this._endChallenge(true);
    }
  }

  private _checkComplete(): boolean {
    return this._state.targets.every(t => t.current >= t.count);
  }

  /** 结束挑战 */
  private _endChallenge(success: boolean): void {
    this._state.isActive = false;
    this._unbindChallengeEvents();

    const levelId = this._state.currentLevelId;
    if (!levelId) return;
    const level = CHALLENGE_LEVELS.find(l => l.id === levelId);
    if (!level) return;

    let stars = StarRating.NONE;
    if (success) {
      stars = StarRating.ONE; // 至少1星

      // 判定2星/3星（简化：根据剩余时间/步数比例）
      if (level.timeLimit) {
        const ratio = this._state.timeRemaining / level.timeLimit;
        if (ratio > 0.5) stars = StarRating.THREE;
        else if (ratio > 0.25) stars = StarRating.TWO;
      } else if (level.moveLimit) {
        const ratio = 1 - (this._state.movesUsed / level.moveLimit);
        if (ratio > 0.5) stars = StarRating.THREE;
        else if (ratio > 0.25) stars = StarRating.TWO;
      }

      // 更新最高记录
      const prevStars = this._stars.get(levelId) || StarRating.NONE;
      if (stars > prevStars) {
        this._stars.set(levelId, stars);
      }

      // 首次通关奖励（花愿仅订单+离线；挑战关「gold」字段按钻石折算发放）
      if (!this._claimed.has(levelId)) {
        this._claimed.add(levelId);
        const goldAsDiamond = Math.min(45, Math.floor((level.reward.gold || 0) / 80));
        const extraHyTier = (level.reward.huayuan || 0) * 4;
        CurrencyManager.addDiamond(level.reward.diamond + goldAsDiamond + extraHyTier);
      }

      this._saveState();
    }

    EventBus.emit('challenge:ended', levelId, success, stars);
    console.log(`[Challenge] 挑战${success ? '成功' : '失败'}: ${level.name}, ${stars}星`);
    this._state.currentLevelId = null;
  }

  private _checkReviveReset(): void {
    const today = new Date().toISOString().slice(0, 10);
    if (today !== this._lastReviveDate) {
      this._lastReviveDate = today;
      this._todayRevives = 0;
    }
  }

  // ═══════════════ 存档 ═══════════════

  private _saveState(): void {
    const stars: Record<string, StarRating> = {};
    for (const [id, s] of this._stars) stars[id] = s;
    const data: ChallengeSave = {
      stars,
      claimed: Array.from(this._claimed),
      todayRevives: this._todayRevives,
      lastReviveDate: this._lastReviveDate,
    };
    Platform.setStorageSync(STORAGE_KEY, JSON.stringify(data));
  }

  private _loadState(): void {
    try {
      const raw = Platform.getStorageSync(STORAGE_KEY);
      if (!raw) return;
      const data: ChallengeSave = JSON.parse(raw);
      if (data.stars) {
        for (const [id, s] of Object.entries(data.stars)) {
          this._stars.set(id, s as StarRating);
        }
      }
      if (data.claimed) data.claimed.forEach(id => this._claimed.add(id));
      this._todayRevives = data.todayRevives || 0;
      this._lastReviveDate = data.lastReviveDate || '';
    } catch (_) {}
  }
}

export const ChallengeManager = new ChallengeManagerClass();
