/**
 * 「开店糖果」管理器
 *
 * 与离线回归弹窗（OfflineRewardPanel）联动：
 *  - 每日首次启动 → DailyCandyManager.consumeTodayCandy() 返回当日礼包；OfflineRewardPanel 在第三段呈现
 *  - 用 PersistService 落地 `huahua_daily_candy`（已加入 CloudSync allowlist）
 *  - 与 CheckInManager.consecutiveDays 同步：到 3/7/14/30 天送里程碑彩蛋
 *
 * 不直接发奖：交给 OfflineRewardPanel 在玩家点「领取」时统一入账（避免后台静默到账）。
 */
import { EventBus } from '@/core/EventBus';
import { PersistService } from '@/core/PersistService';
import { CheckInManager } from './CheckInManager';
import {
  DAILY_CANDY_BASE,
  DAILY_CANDY_RANDOM_BONUSES,
  DAILY_CANDY_STREAK_TIERS,
  getStreakTierExact,
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

  init(): void {
    if (this._initialized) return;
    this._initialized = true;
    this._loadState();
  }

  /** 当日是否已发糖（已弹过且玩家关闭）；OfflineRewardPanel 拼装时用于避免重复 */
  hasConsumedToday(): boolean {
    return this._state.lastDateKey === this._todayKey();
  }

  /**
   * 取今天该弹的糖果；若今天已经领过返回 null。
   * 调用方（OfflineRewardPanel）负责显示并在领取时入账。
   */
  consumeTodayCandy(rng: () => number = Math.random): DailyCandyPayload | null {
    const today = this._todayKey();
    if (this._state.lastDateKey === today) return null;

    const bonus = this._pickRandomBonus(rng);
    const streakDays = CheckInManager.consecutiveDays;
    let streakTier: DailyCandyStreakTier | null = null;
    if (streakDays > 0 && streakDays !== this._state.lastStreakDays) {
      streakTier = getStreakTierExact(streakDays);
    }

    this._state.lastDateKey = today;
    if (streakTier) this._state.lastStreakDays = streakDays;
    this._saveState();

    return {
      dateKey: today,
      base: DAILY_CANDY_BASE,
      bonus,
      streakTier,
      consecutiveDays: streakDays,
    };
  }

  /** 不消耗状态地探测下次会发什么；用于 GM「Force Daily Candy」预览 */
  peekTodayCandy(rng: () => number = Math.random): DailyCandyPayload {
    const bonus = this._pickRandomBonus(rng);
    const streakDays = CheckInManager.consecutiveDays;
    const streakTier = streakDays > 0 ? getStreakTierExact(streakDays) : null;
    return {
      dateKey: this._todayKey(),
      base: DAILY_CANDY_BASE,
      bonus,
      streakTier,
      consecutiveDays: streakDays,
    };
  }

  /** GM：清除「今天已发糖」状态 */
  gmReset(): void {
    this._state = { lastDateKey: '', lastStreakDays: 0 };
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
