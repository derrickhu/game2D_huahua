/**
 * 「开店糖果」管理器
 *
 * 与离线回归弹窗（OfflineRewardPanel）联动：
 *  - 每日首次启动且**有离线产出 / 熟客留言**时 → IdleManager 调 previewTodayCandy() 取当日礼包
 *  - 用 PersistService 落地 `huahua_daily_candy`（已加入 CloudSync allowlist）
 *
 * 设计要点：
 *  - previewTodayCandy() **不写入**「今日已领」状态，仅生成并缓存当日 payload
 *  - 玩家真正点「领取」后，由 IdleManager.claimReward 调 markConsumed(payload) 才落档
 *    → 弹窗展示后崩溃 / 玩家关掉不领，下次启动仍能再次拿到（同一份 random bonus，避免反复重抽）
 *
 * 连签里程碑已下线（统一交给 CheckInManager），DailyCandyPayload.streakTier 永远为 null，
 * 历史 lastStreakDays 字段保留以兼容旧存档但不再使用。
 */
import { EventBus } from '@/core/EventBus';
import { PersistService } from '@/core/PersistService';
import { CheckInManager } from './CheckInManager';
import {
  DAILY_CANDY_BASE,
  DAILY_CANDY_RANDOM_BONUSES,
  type DailyCandyRandomBonus,
  type DailyCandyStreakTier,
} from '@/config/DailyCandyConfig';

const STORAGE_KEY = 'huahua_daily_candy';

export interface DailyCandyPayload {
  /** 当日 UTC 日期 yyyy-mm-dd（含 GM 偏移） */
  dateKey: string;
  base: typeof DAILY_CANDY_BASE;
  bonus: DailyCandyRandomBonus;
  /** 当天恰好达到的里程碑（无则 null） */
  streakTier: DailyCandyStreakTier | null;
  /** 当前连签天数（从 CheckInManager 读，用于 UI 副标题） */
  consecutiveDays: number;
}

interface DailyCandyState {
  /** 上次发糖的日期 key */
  lastDateKey: string;
  /** 上次推送过的里程碑天数（避免一天内多次进游戏被重复触发） */
  lastStreakDays: number;
}

class DailyCandyManagerClass {
  private _state: DailyCandyState = { lastDateKey: '', lastStreakDays: 0 };
  private _initialized = false;
  /** 当日已生成但尚未领取的 payload（仅内存；进程重启会重抽 bonus） */
  private _pending: DailyCandyPayload | null = null;

  init(): void {
    if (this._initialized) return;
    this._initialized = true;
    this._loadState();
  }

  /** 当日是否已领过糖 */
  hasConsumedToday(): boolean {
    return this._state.lastDateKey === this._todayKey();
  }

  /**
   * 预览今天可领的糖果；若今天已领过返回 null。
   * **不写入**「已领」状态：玩家真正点领取后，调用方需调 markConsumed(payload) 落档。
   * 同一进程内重复调用返回相同 payload（避免反复重抽 random bonus）。
   */
  previewTodayCandy(rng: () => number = Math.random): DailyCandyPayload | null {
    const today = this._todayKey();
    if (this._state.lastDateKey === today) return null;
    if (this._pending && this._pending.dateKey === today) return this._pending;

    const bonus = this._pickRandomBonus(rng);
    const streakDays = CheckInManager.consecutiveDays;

    this._pending = {
      dateKey: today,
      base: DAILY_CANDY_BASE,
      bonus,
      streakTier: null,
      consecutiveDays: streakDays,
    };
    return this._pending;
  }

  /** 玩家在领取面板真正按下「领取」后调用；落档「今日已领」并清掉内存 pending */
  markConsumed(payload: DailyCandyPayload): void {
    if (!payload) return;
    this._state.lastDateKey = payload.dateKey;
    this._pending = null;
    this._saveState();
  }

  /** 不消耗状态地探测当日 payload；用于 GM「Force Daily Candy」预览 */
  peekTodayCandy(rng: () => number = Math.random): DailyCandyPayload {
    const bonus = this._pickRandomBonus(rng);
    const streakDays = CheckInManager.consecutiveDays;
    return {
      dateKey: this._todayKey(),
      base: DAILY_CANDY_BASE,
      bonus,
      streakTier: null,
      consecutiveDays: streakDays,
    };
  }

  /** GM：清除「今天已领糖」状态以及内存 pending */
  gmReset(): void {
    this._state = { lastDateKey: '', lastStreakDays: 0 };
    this._pending = null;
    this._saveState();
    EventBus.emit('dailyCandy:reset');
  }

  private _pickRandomBonus(rng: () => number): DailyCandyRandomBonus {
    const totalW = DAILY_CANDY_RANDOM_BONUSES.reduce((s, b) => s + Math.max(1, b.weight), 0);
    let r = rng() * totalW;
    for (const b of DAILY_CANDY_RANDOM_BONUSES) {
      r -= Math.max(1, b.weight);
      if (r <= 0) return b;
    }
    return DAILY_CANDY_RANDOM_BONUSES[0]!;
  }

  private _todayKey(): string {
    // 与 CheckInManager._getTodayStr 一致（含 GM 偏移）
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + (CheckInManager.gmDateOffsetDays ?? 0));
    return d.toISOString().slice(0, 10);
  }

  private _saveState(): void {
    try {
      PersistService.writeRaw(STORAGE_KEY, JSON.stringify(this._state));
    } catch (_) {}
  }

  private _loadState(): void {
    try {
      const raw = PersistService.readRaw(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw) as Partial<DailyCandyState>;
      if (data && typeof data === 'object') {
        if (typeof data.lastDateKey === 'string') this._state.lastDateKey = data.lastDateKey;
        if (typeof data.lastStreakDays === 'number') this._state.lastStreakDays = Math.max(0, Math.floor(data.lastStreakDays));
      }
    } catch (_) {}
  }
}

export const DailyCandyManager = new DailyCandyManagerClass();
