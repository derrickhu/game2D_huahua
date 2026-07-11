/**
 * 周二「体力无限」限时活动：当天 0:00～次日 0:00，看广告攒进度后领取体力包。
 * 与周末花愿活动互斥时段，共用顶栏活动槽位。
 *
 * 进度存 `huahua_tuesday_stamina_unlimited`（已在 CLOUD_SYNC_ALLOWLIST），
 * 领取/看广告后会立即 flush 云同步，避免清缓存后进度丢失。
 */
import { EventBus } from '@/core/EventBus';
import { PersistService } from '@/core/PersistService';
import { CheckInManager } from './CheckInManager';
import { CloudSyncManager } from './CloudSyncManager';
import { CurrencyManager } from './CurrencyManager';
import { SaveManager } from './SaveManager';

const STORAGE_KEY = 'huahua_tuesday_stamina_unlimited';
const CHECK_INTERVAL_SEC = 60;

export type TuesdayStaminaPackId = 'pack_400' | 'pack_240' | 'pack_100';

export interface TuesdayStaminaPackDef {
  id: TuesdayStaminaPackId;
  stamina: number;
  adsRequired: number;
  label: string;
}

/** 比日常广告回体（+50）更划算的三档体力包，每档当日限领 1 次 */
export const TUESDAY_STAMINA_PACKS: readonly TuesdayStaminaPackDef[] = [
  { id: 'pack_400', stamina: 400, adsRequired: 3, label: '400体力' },
  { id: 'pack_240', stamina: 240, adsRequired: 2, label: '240体力' },
  { id: 'pack_100', stamina: 100, adsRequired: 1, label: '100体力' },
] as const;

interface PackProgress {
  adsWatched: number;
  claimed: boolean;
}

interface TuesdayStaminaState {
  dateKey: string;
  packs: Record<TuesdayStaminaPackId, PackProgress>;
  /** 活动日已展示过宣传页（含自动弹 / 手动点开），当日不再自动弹 */
  promoShownDate: string;
}

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

/** 活动期：仅周二（本地日历日） */
function isInEventPeriod(now = effectiveNow()): boolean {
  return now.getDay() === 2;
}

/** 本轮结束：周三 0:00（本地） */
function getEventPeriodEnd(now = effectiveNow()): Date | null {
  if (!isInEventPeriod(now)) return null;
  const end = new Date(now);
  end.setHours(0, 0, 0, 0);
  end.setDate(end.getDate() + 1);
  return end;
}

function emptyPack(): PackProgress {
  return { adsWatched: 0, claimed: false };
}

function emptyState(): TuesdayStaminaState {
  return {
    dateKey: localDateKey(),
    packs: {
      pack_400: emptyPack(),
      pack_240: emptyPack(),
      pack_100: emptyPack(),
    },
    promoShownDate: '',
  };
}

function normalizeState(raw: Partial<TuesdayStaminaState> | null): TuesdayStaminaState {
  const base = emptyState();
  if (!raw || typeof raw.dateKey !== 'string') return base;
  base.dateKey = raw.dateKey;
  base.promoShownDate = typeof raw.promoShownDate === 'string' ? raw.promoShownDate : '';
  for (const def of TUESDAY_STAMINA_PACKS) {
    const p = raw.packs?.[def.id];
    if (!p) continue;
    base.packs[def.id] = {
      adsWatched: Math.max(0, Math.min(def.adsRequired, Math.floor(Number(p.adsWatched) || 0))),
      claimed: !!p.claimed,
    };
  }
  return base;
}

class TuesdayStaminaUnlimitedManagerClass {
  private _state: TuesdayStaminaState = emptyState();
  private _loaded = false;
  private _ticker = 0;

  init(): void {
    if (!this._loaded) {
      const saved = PersistService.readJSON<Partial<TuesdayStaminaState>>(STORAGE_KEY);
      this._state = normalizeState(saved);
      this._loaded = true;
    }
    this._checkDailyReset();
  }

  /** 云端覆盖本地后重读进度（避免内存仍是旧空状态） */
  reloadFromStorage(): void {
    this._loaded = false;
    this.init();
    EventBus.emit('tuesdayStaminaUnlimited:changed');
  }

  update(dt: number): void {
    this._ticker += dt;
    if (this._ticker < CHECK_INTERVAL_SEC) return;
    this._ticker = 0;
    this._checkDailyReset();
  }

  get packs(): readonly TuesdayStaminaPackDef[] {
    return TUESDAY_STAMINA_PACKS;
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

  getPackProgress(id: TuesdayStaminaPackId): PackProgress {
    this.init();
    return { ...this._state.packs[id] };
  }

  /** 距周三 0:00 结束还剩多少小时（向上取整，至少 1） */
  hoursUntilEventEnd(now = effectiveNow()): number {
    const end = getEventPeriodEnd(now);
    if (!end) return 0;
    const ms = end.getTime() - now.getTime();
    if (ms <= 0) return 0;
    return Math.max(1, Math.ceil(ms / 3_600_000));
  }

  countdownLabel(now = effectiveNow()): string | null {
    if (!isInEventPeriod(now)) return null;
    const h = this.hoursUntilEventEnd(now);
    if (h <= 0) return null;
    return `${h}小时后结束`;
  }

  /** 看完一条广告：对应档位进度 +1（未领完且未满时） */
  recordAdWatched(id: TuesdayStaminaPackId): boolean {
    this.init();
    if (!isInEventPeriod()) return false;
    const def = TUESDAY_STAMINA_PACKS.find(p => p.id === id);
    if (!def) return false;
    const pack = this._state.packs[id];
    if (pack.claimed) return false;
    if (pack.adsWatched >= def.adsRequired) return false;
    this._state.dateKey = localDateKey();
    pack.adsWatched += 1;
    this._save({ flushCloud: true });
    EventBus.emit('tuesdayStaminaUnlimited:changed');
    return true;
  }

  canClaim(id: TuesdayStaminaPackId): boolean {
    this.init();
    if (!isInEventPeriod()) return false;
    const def = TUESDAY_STAMINA_PACKS.find(p => p.id === id);
    if (!def) return false;
    const pack = this._state.packs[id];
    return !pack.claimed && pack.adsWatched >= def.adsRequired;
  }

  /** 领取体力；成功返回发放数量 */
  claimPack(id: TuesdayStaminaPackId): number {
    this.init();
    if (!this.canClaim(id)) return 0;
    const def = TUESDAY_STAMINA_PACKS.find(p => p.id === id);
    if (!def) return 0;
    this._state.dateKey = localDateKey();
    this._state.packs[id].claimed = true;
    this._save();
    CurrencyManager.addStamina(def.stamina);
    // 体力在 huahua_save；进度在独立 key。两者都落盘后立即上行，防清缓存复领。
    SaveManager.save();
    void CloudSyncManager.flushNow('tuesday-stamina-claim');
    EventBus.emit('tuesdayStaminaUnlimited:changed');
    EventBus.emit('stamina:adRecovered', def.stamina, 0);
    return def.stamina;
  }

  /** 按钮文案：进度 / 领取 / 已获取 */
  buttonLabel(id: TuesdayStaminaPackId): string {
    this.init();
    const def = TUESDAY_STAMINA_PACKS.find(p => p.id === id);
    if (!def) return '';
    const pack = this._state.packs[id];
    if (pack.claimed) return '已获取';
    if (pack.adsWatched >= def.adsRequired) return '领取';
    return `${pack.adsWatched}/${def.adsRequired}`;
  }

  private _checkDailyReset(): void {
    const today = localDateKey();
    const shouldReset =
      this._state.dateKey !== today ||
      (!isInEventPeriod() && Object.values(this._state.packs).some(p => p.adsWatched > 0 || p.claimed));
    if (!shouldReset) return;
    this._state = emptyState();
    this._save();
    EventBus.emit('tuesdayStaminaUnlimited:changed');
  }

  resetAfterVirtualDayAdvance(): void {
    this.init();
    this._state = emptyState();
    this._save();
    EventBus.emit('tuesdayStaminaUnlimited:changed');
  }

  private _save(options?: { flushCloud?: boolean }): void {
    PersistService.writeJSON(STORAGE_KEY, this._state);
    if (options?.flushCloud) {
      void CloudSyncManager.flushNow('tuesday-stamina-ad');
    }
  }
}

export const TuesdayStaminaUnlimitedManager = new TuesdayStaminaUnlimitedManagerClass();
