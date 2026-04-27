import { PersistService } from '@/core/PersistService';
import { EventBus } from '@/core/EventBus';

const STORAGE_KEY = 'huahua_ad_entitlements';

export enum DailyAdEntitlement {
  MERCH_DAILY_REFRESH = 'merch_daily_refresh',
  FLOWER_SIGN_DAILY_DRAW = 'flower_sign_daily_draw',
}

interface AdEntitlementState {
  date: string;
  used: Record<string, number>;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function emptyState(): AdEntitlementState {
  return { date: todayKey(), used: {} };
}

class AdEntitlementManagerClass {
  private _state: AdEntitlementState = emptyState();
  private _loaded = false;

  init(): void {
    if (this._loaded) {
      this._checkDailyReset();
      return;
    }
    const saved = PersistService.readJSON<Partial<AdEntitlementState>>(STORAGE_KEY);
    if (saved && typeof saved.date === 'string' && saved.used && typeof saved.used === 'object') {
      this._state = {
        date: saved.date,
        used: { ...saved.used },
      };
    }
    this._loaded = true;
    this._checkDailyReset();
  }

  canUseDaily(key: DailyAdEntitlement, limit = 1): boolean {
    this.init();
    return (this._state.used[key] ?? 0) < limit;
  }

  remainingDaily(key: DailyAdEntitlement, limit = 1): number {
    this.init();
    return Math.max(0, limit - (this._state.used[key] ?? 0));
  }

  markDailyUsed(key: DailyAdEntitlement, limit = 1): boolean {
    this.init();
    const used = this._state.used[key] ?? 0;
    if (used >= limit) return false;
    this._state.used[key] = used + 1;
    this._save();
    EventBus.emit('adEntitlement:changed', key);
    return true;
  }

  private _checkDailyReset(): void {
    const today = todayKey();
    if (this._state.date === today) return;
    this._state = { date: today, used: {} };
    this._save();
    EventBus.emit('adEntitlement:changed');
  }

  private _save(): void {
    PersistService.writeJSON(STORAGE_KEY, this._state);
  }
}

export const AdEntitlementManager = new AdEntitlementManagerClass();
