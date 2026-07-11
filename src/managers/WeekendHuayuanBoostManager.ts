import { EventBus } from '@/core/EventBus';
import { PersistService } from '@/core/PersistService';
import { CheckInManager } from './CheckInManager';

const STORAGE_KEY = 'huahua_weekend_huayuan_boost';
const BONUS_RATE = 0.5;
const CHECK_INTERVAL_SEC = 60;

interface WeekendHuayuanBoostState {
  dateKey: string;
  activated: boolean;
  /** 活动日已展示过宣传页（含自动弹 / 手动点开），当日不再自动弹 */
  promoShownDate: string;
}

/** 与签到 GM 虚拟日偏移共用，便于「下一天」测试 */
function effectiveNow(): Date {
  const d = new Date();
  const offset = CheckInManager?.gmDateOffsetDays ?? 0;
  if (offset !== 0) {
    d.setUTCDate(d.getUTCDate() + offset);
  }
  return d;
}

function localDateKey(): string {
  return CheckInManager?.effectiveDateKey ?? effectiveNow().toISOString().slice(0, 10);
}

/** 活动期：周六 0:00 起至周一 0:00 止（不含周一当日） */
function isInEventPeriod(now = effectiveNow()): boolean {
  const day = now.getDay();
  return day === 0 || day === 6;
}

/** 本轮活动结束时刻：所属周末的周一 0:00（本地） */
function getEventPeriodEnd(now = effectiveNow()): Date | null {
  if (!isInEventPeriod(now)) return null;
  const end = new Date(now);
  end.setHours(0, 0, 0, 0);
  const day = now.getDay();
  end.setDate(end.getDate() + (day === 6 ? 2 : 1));
  return end;
}

function emptyState(): WeekendHuayuanBoostState {
  return { dateKey: localDateKey(), activated: false, promoShownDate: '' };
}

class WeekendHuayuanBoostManagerClass {
  private _state: WeekendHuayuanBoostState = emptyState();
  private _loaded = false;
  private _ticker = 0;

  init(): void {
    if (!this._loaded) {
      const saved = PersistService.readJSON<Partial<WeekendHuayuanBoostState>>(STORAGE_KEY);
      if (saved && typeof saved.dateKey === 'string') {
        this._state = {
          dateKey: saved.dateKey,
          activated: !!saved.activated,
          promoShownDate: typeof saved.promoShownDate === 'string' ? saved.promoShownDate : '',
        };
      }
      this._loaded = true;
    }
    this._checkDailyReset();
  }

  /** 云端覆盖本地后重读（须在 CheckInManager 已加载 GM 偏移后调用） */
  reloadFromStorage(): void {
    this._loaded = false;
    this.init();
    EventBus.emit('weekendHuayuanBoost:changed');
  }

  update(dt: number): void {
    this._ticker += dt;
    if (this._ticker < CHECK_INTERVAL_SEC) return;
    this._ticker = 0;
    this._checkDailyReset();
  }

  get bonusRate(): number {
    return BONUS_RATE;
  }

  isAvailableToday(): boolean {
    this.init();
    return isInEventPeriod(effectiveNow());
  }

  /** 活动生效当日首次进主界面：尚未展示过宣传页则自动弹出 */
  shouldAutoOpenOnMainEnter(): boolean {
    this.init();
    if (!isInEventPeriod()) return false;
    return this._state.promoShownDate !== localDateKey();
  }

  markPromoShown(): void {
    this.init();
    const today = localDateKey();
    if (this._state.promoShownDate === today) return;
    this._state.promoShownDate = today;
    this._save();
  }

  isActive(): boolean {
    this.init();
    return this._state.activated && this._state.dateKey === localDateKey() && isInEventPeriod();
  }

  /** 距周一 0:00 结束还剩多少小时（向上取整，至少 1） */
  hoursUntilEventEnd(now = effectiveNow()): number {
    const end = getEventPeriodEnd(now);
    if (!end) return 0;
    const ms = end.getTime() - now.getTime();
    if (ms <= 0) return 0;
    return Math.max(1, Math.ceil(ms / 3_600_000));
  }

  /** 顶栏倒计时文案，非活动期返回 null */
  countdownLabel(now = effectiveNow()): string | null {
    if (!isInEventPeriod(now)) return null;
    const h = this.hoursUntilEventEnd(now);
    if (h <= 0) return null;
    return `${h}小时后结束`;
  }

  bonusFor(baseHuayuan: number): number {
    if (!this.isActive() || baseHuayuan <= 0) return 0;
    return Math.max(1, Math.floor(baseHuayuan * BONUS_RATE));
  }

  activateToday(): boolean {
    this.init();
    if (!isInEventPeriod()) return false;
    const today = localDateKey();
    if (this._state.dateKey !== today || !this._state.activated) {
      this._state = {
        dateKey: today,
        activated: true,
        promoShownDate: this._state.promoShownDate,
      };
      this._save();
      EventBus.emit('weekendHuayuanBoost:changed');
    }
    return true;
  }

  private _checkDailyReset(): void {
    const today = localDateKey();
    const shouldReset =
      this._state.dateKey !== today ||
      (this._state.activated && !isInEventPeriod());
    if (!shouldReset) return;
    const promoShownDate =
      this._state.dateKey === today ? this._state.promoShownDate : '';
    this._state = { dateKey: today, activated: false, promoShownDate };
    this._save();
    EventBus.emit('weekendHuayuanBoost:changed');
  }

  /** GM 虚拟下一天后：清除当日激活，按新日历日重算活动期 */
  resetAfterVirtualDayAdvance(): void {
    this.init();
    this._state = emptyState();
    this._save();
    EventBus.emit('weekendHuayuanBoost:changed');
  }

  private _save(): void {
    PersistService.writeJSON(STORAGE_KEY, this._state);
  }
}

export const WeekendHuayuanBoostManager = new WeekendHuayuanBoostManagerClass();
