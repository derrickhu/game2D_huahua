import { Category, DrinkLine, ITEM_DEFS } from '@/config/ItemConfig';
import {
  MID_AUTUMN_DEFAULT_END_AT,
  MID_AUTUMN_DEFAULT_START_AT,
  MID_AUTUMN_LANTERN_TO_HUAYUAN_RATE,
  midAutumnLanternsForMooncakeLevel,
  MID_AUTUMN_SEASON_ID,
  MID_AUTUMN_SPIN_COST,
  rollMidAutumnWheelPrize,
  midAutumnWheelPrizeIndex,
  setMidAutumnActiveChecker,
  type MidAutumnGrant,
  type MidAutumnWheelPrize,
} from '@/config/events/MidAutumnEventConfig';
import { EventBus } from '@/core/EventBus';
import { ToastMessage } from '@/gameobjects/ui/ToastMessage';
import { CurrencyManager } from '@/managers/CurrencyManager';
import { FurnitureWorkshopManager } from '@/managers/FurnitureWorkshopManager';
import { RewardBoxManager } from '@/managers/RewardBoxManager';

export type MidAutumnActivityStatus = 'upcoming' | 'active' | 'ended';

export interface MidAutumnEventState {
  seasonId: string;
  currency: number;
  spinCount: number;
  currencySettled?: boolean;
}
export type MidAutumnEventPersistState = MidAutumnEventState;

export interface MidAutumnActivitySnapshot {
  status: MidAutumnActivityStatus;
  startAt: number;
  endAt: number;
  remainingMs: number;
}

export type MidAutumnSpinFailure =
  | 'not_active'
  | 'not_enough_currency'
  | 'grant_failed';

export type MidAutumnSpinResult =
  | {
      ok: true;
      prize: MidAutumnWheelPrize;
      prizeIndex: number;
      remainingCurrency: number;
    }
  | { ok: false; reason: MidAutumnSpinFailure };

function emptyState(): MidAutumnEventState {
  return {
    seasonId: MID_AUTUMN_SEASON_ID,
    currency: 0,
    spinCount: 0,
    currencySettled: false,
  };
}

class MidAutumnEventManagerClass {
  private _currency = 0;
  private _spinCount = 0;
  private _currencySettled = false;
  private _lastRedDot = false;
  private _initialized = false;
  private _ticker = 0;
  private _lastStatus: MidAutumnActivityStatus | null = null;
  private _gmActiveOverride = false;

  init(): void {
    if (this._initialized) return;
    this._initialized = true;
    setMidAutumnActiveChecker(() => this.isActive());
    this._lastStatus = this.status;
    EventBus.on('customer:delivered', (_uid: number, customer: {
      midAutumnLanternReward?: number;
    }) => {
      if (!this.isActive()) return;
      const reward = Math.max(0, Math.floor(customer?.midAutumnLanternReward ?? 0));
      if (reward > 0) this.addCurrency(reward);
    });
  }

  update(dt: number): void {
    this._ticker += dt;
    if (this._ticker < 30) return;
    this._ticker = 0;
    const status = this.status;
    if (status === this._lastStatus) {
      if (status === 'ended') this._trySettleExpiredCurrency({ notify: true });
      return;
    }
    this._lastStatus = status;
    if (status === 'ended') {
      this._trySettleExpiredCurrency({ notify: true });
    }
    EventBus.emit('midAutumnEvent:periodChanged', status);
    this._emitChanged();
  }

  isActive(): boolean {
    return this._gmActiveOverride || this.status === 'active';
  }

  countdownLabel(): string | null {
    if (!this.isActive()) return null;
    if (this._gmActiveOverride && this.status !== 'active') return 'GM体验中';
    const sec = Math.max(0, Math.ceil(this.remainingMs / 1000));
    const days = Math.floor(sec / 86400);
    const hours = Math.floor((sec % 86400) / 3600);
    if (days > 0) return `${days}天${hours}小时`;
    const minutes = Math.max(1, Math.ceil(sec / 60));
    if (hours > 0) return `${hours}小时${Math.floor((sec % 3600) / 60)}分`;
    return `${minutes}分钟`;
  }

  get currency(): number {
    return this._currency;
  }

  get spinCount(): number {
    return this._spinCount;
  }

  get status(): MidAutumnActivityStatus {
    return this.getActivitySnapshot().status;
  }

  get remainingMs(): number {
    return this.getActivitySnapshot().remainingMs;
  }

  get hasRedDot(): boolean {
    return this.isActive() && this._currency >= MID_AUTUMN_SPIN_COST;
  }

  getActivitySnapshot(now = Date.now()): MidAutumnActivitySnapshot {
    if (now < MID_AUTUMN_DEFAULT_START_AT) {
      return {
        status: 'upcoming',
        startAt: MID_AUTUMN_DEFAULT_START_AT,
        endAt: MID_AUTUMN_DEFAULT_END_AT,
        remainingMs: MID_AUTUMN_DEFAULT_START_AT - now,
      };
    }
    if (now <= MID_AUTUMN_DEFAULT_END_AT) {
      return {
        status: 'active',
        startAt: MID_AUTUMN_DEFAULT_START_AT,
        endAt: MID_AUTUMN_DEFAULT_END_AT,
        remainingMs: Math.max(0, MID_AUTUMN_DEFAULT_END_AT - now),
      };
    }
    return {
      status: 'ended',
      startAt: MID_AUTUMN_DEFAULT_START_AT,
      endAt: MID_AUTUMN_DEFAULT_END_AT,
      remainingMs: 0,
    };
  }

  calculateOrderReward(itemIds: readonly string[]): number {
    let maxLevel = 0;
    for (const itemId of itemIds) {
      const item = ITEM_DEFS.get(itemId);
      if (!item) continue;
      if (item.category !== Category.DRINK || item.line !== DrinkLine.MOONCAKE) continue;
      maxLevel = Math.max(maxLevel, item.level);
    }
    return midAutumnLanternsForMooncakeLevel(maxLevel);
  }

  addCurrency(amount: number): number {
    if (!this.isActive()) return this._currency;
    const add = Number.isFinite(amount) ? Math.max(0, Math.floor(amount)) : 0;
    if (add <= 0) return this._currency;
    this._currency += add;
    EventBus.emit('midAutumnEvent:currencyAdded', add, this._currency);
    this._emitChanged();
    return this._currency;
  }

  spin(): MidAutumnSpinResult {
    if (!this.isActive()) return { ok: false, reason: 'not_active' };
    if (this._currency < MID_AUTUMN_SPIN_COST) {
      return { ok: false, reason: 'not_enough_currency' };
    }
    const prize = rollMidAutumnWheelPrize();
    if (!this._grant(prize.grant)) {
      return { ok: false, reason: 'grant_failed' };
    }
    this._currency -= MID_AUTUMN_SPIN_COST;
    this._spinCount += 1;
    EventBus.emit('midAutumnEvent:spun', prize, this._currency);
    this._emitChanged();
    return {
      ok: true,
      prize,
      prizeIndex: midAutumnWheelPrizeIndex(prize.id),
      remainingCurrency: this._currency,
    };
  }

  exportState(): MidAutumnEventState {
    return {
      seasonId: MID_AUTUMN_SEASON_ID,
      currency: this._currency,
      spinCount: this._spinCount,
      currencySettled: this._currencySettled,
    };
  }

  loadState(raw?: Partial<MidAutumnEventState> | null): void {
    const state = raw?.seasonId === MID_AUTUMN_SEASON_ID ? raw : emptyState();
    this._currency = Number.isFinite(state.currency)
      ? Math.max(0, Math.floor(state.currency ?? 0))
      : 0;
    this._spinCount = Number.isFinite(state.spinCount)
      ? Math.max(0, Math.floor(state.spinCount ?? 0))
      : 0;
    this._currencySettled = !!state.currencySettled;
    this._lastStatus = this.status;
    this._trySettleExpiredCurrency({ notify: false });
    this._emitChanged();
  }

  gmSetActiveOverride(active: boolean): void {
    if (this._gmActiveOverride === active) return;
    this._gmActiveOverride = active;
    if (!active && this.status === 'ended') {
      this._trySettleExpiredCurrency({ notify: true });
    }
    EventBus.emit('midAutumnEvent:periodChanged', this.status);
    this._emitChanged();
  }

  gmAddCurrency(amount: number): number {
    const delta = Number.isFinite(amount) ? Math.floor(amount) : 0;
    this._currency = Math.max(0, this._currency + delta);
    if (delta > 0) this._currencySettled = false;
    this._emitChanged();
    return this._currency;
  }

  gmReset(): void {
    const state = emptyState();
    this._currency = state.currency;
    this._spinCount = 0;
    this._currencySettled = false;
    this._emitChanged();
  }

  private _trySettleExpiredCurrency(opts?: { notify?: boolean }): number {
    if (this._currencySettled) return 0;
    if (this.getActivitySnapshot().status !== 'ended') return 0;
    if (this._gmActiveOverride) return 0;

    const lanterns = Math.max(0, Math.floor(this._currency));
    const huayuan = lanterns * MID_AUTUMN_LANTERN_TO_HUAYUAN_RATE;
    this._currency = 0;
    this._currencySettled = true;

    if (huayuan > 0) {
      CurrencyManager.addHuayuan(huayuan);
      EventBus.emit('midAutumnEvent:currencySettled', lanterns, huayuan);
      if (opts?.notify) {
        ToastMessage.show(`月满中秋已结束，剩余${lanterns}盏玉兔灯已兑换为${huayuan}花愿`);
      }
    }

    this._emitChanged();
    return huayuan;
  }

  private _grant(grant: MidAutumnGrant): boolean {
    switch (grant.kind) {
      case 'stamina':
        CurrencyManager.addStamina(grant.amount);
        return true;
      case 'huayuan':
        CurrencyManager.addHuayuan(grant.amount);
        return true;
      case 'diamond':
        CurrencyManager.addDiamond(grant.amount);
        return true;
      case 'workshopMaterial':
        return FurnitureWorkshopManager.addMaterial(grant.materialId, grant.amount);
      case 'rewardBoxItem':
        RewardBoxManager.addItem(grant.itemId, grant.amount);
        return true;
    }
  }

  private _emitChanged(): void {
    const state = this.exportState();
    EventBus.emit('midAutumnEvent:changed', state);
    const redDot = this.hasRedDot;
    if (redDot !== this._lastRedDot) {
      this._lastRedDot = redDot;
      EventBus.emit('midAutumnEvent:redDotChanged', redDot);
    }
  }
}

export const MidAutumnEventManager = new MidAutumnEventManagerClass();
