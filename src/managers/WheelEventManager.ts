import { ITEM_DEFS } from '@/config/ItemConfig';
import { DECO_MAP } from '@/config/DecorationConfig';
import { ACTIVE_WHEEL_THEME, findWheelTheme } from '@/config/events/wheel/WheelEventRegistry';
import {
  clampWheelRound,
  findWheelPrize,
  rollWheelPrize,
  wheelEarnAmount,
  wheelPrizeIndex,
  wheelPrizesForRound,
  wheelRoundCount,
  wheelSpinCost,
  type WheelGrant,
  type WheelPrize,
} from '@/config/events/wheel/WheelEventTheme';
import { setWheelEarnChecker } from '@/config/events/wheel/WheelEventLive';
import { setSeasonalSeasonLiveChecker } from '@/config/events/SeasonalItemRegistry';
import { EventBus } from '@/core/EventBus';
import { ToastMessage } from '@/gameobjects/ui/ToastMessage';
import { CurrencyManager } from '@/managers/CurrencyManager';
import { DecorationManager } from '@/managers/DecorationManager';
import { DressUpManager } from '@/managers/DressUpManager';
import { FurnitureWorkshopManager } from '@/managers/FurnitureWorkshopManager';
import { RewardBoxManager } from '@/managers/RewardBoxManager';
import { grantQuest } from '@/utils/UnlockChecker';
import { SaveManager } from '@/managers/SaveManager';
import { retireLiveSeasonalItems } from '@/managers/SeasonalItemRetirement';

const THEME = ACTIVE_WHEEL_THEME;

export type WheelActivityStatus = 'upcoming' | 'active' | 'ended';

export interface WheelEventState {
  seasonId: string;
  currency: number;
  spinCount: number;
  currencySettled?: boolean;
  wheelRound?: number;
  wonPrizeIds?: string[];
  wheelCleared?: boolean;
  pendingSpinPrizeId?: string;
  pendingSpinRound?: number;
  outfitGranted?: boolean;
}
export type WheelEventPersistState = WheelEventState;

export interface WheelActivitySnapshot {
  status: WheelActivityStatus;
  startAt: number;
  endAt: number;
  remainingMs: number;
}

export type WheelSpinFailure =
  | 'not_active'
  | 'not_enough_currency'
  | 'grant_failed'
  | 'all_cleared';

export type WheelSpinResult =
  | {
      ok: true;
      prize: WheelPrize;
      prizeIndex: number;
      remainingCurrency: number;
      fromRound: number;
    }
  | { ok: false; reason: WheelSpinFailure };

export interface WheelSpinSettleResult {
  prize: WheelPrize;
  fromRound: number;
  advancedToRound?: number;
  allCleared: boolean;
}

function emptyState(): WheelEventState {
  return {
    seasonId: THEME.seasonId,
    currency: 0,
    spinCount: 0,
    currencySettled: false,
    wheelRound: 1,
    wonPrizeIds: [],
    wheelCleared: false,
    pendingSpinPrizeId: undefined,
    pendingSpinRound: undefined,
    outfitGranted: false,
  };
}

class WheelEventManagerClass {
  private _currency = 0;
  private _spinCount = 0;
  private _currencySettled = false;
  private _wheelRound = 1;
  private _wonPrizeIds = new Set<string>();
  private _wheelCleared = false;
  private _outfitGranted = false;
  private _pendingPrizeId: string | null = null;
  private _pendingRound = 1;
  private _lastRedDot = false;
  private _initialized = false;
  private _ticker = 0;
  private _lastStatus: WheelActivityStatus | null = null;
  private _gmActiveOverride = false;

  get theme() {
    return THEME;
  }

  init(): void {
    if (this._initialized) return;
    this._initialized = true;
    setWheelEarnChecker(() => this.canEarnCurrency());
    setSeasonalSeasonLiveChecker(THEME.seasonId, () => this.isActive());
    this._lastStatus = this.status;
    EventBus.on('customer:delivered', (_uid: number, customer: {
      midAutumnLanternReward?: number;
    }) => {
      if (!this.canEarnCurrency()) return;
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
      if (status === 'ended') {
        this._trySettleExpiredCurrency({ notify: true });
        this._retireSeasonalItems();
      }
      return;
    }
    this._lastStatus = status;
    if (status === 'ended') {
      this._trySettleExpiredCurrency({ notify: true });
      this._retireSeasonalItems();
    }
    EventBus.emit('wheelEvent:periodChanged', status);
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

  get wheelRound(): number {
    return this._wheelRound;
  }

  get wheelCleared(): boolean {
    return this._wheelCleared;
  }

  get outfitGranted(): boolean {
    const outfitId = THEME.clearanceOutfitId;
    return this._outfitGranted || (!!outfitId && DressUpManager.isUnlocked(outfitId));
  }

  /** 全部轮次抽完后发放主题里的店主套装。返回 true 表示这次新获得。 */
  tryGrantClearanceOutfit(): boolean {
    const outfitId = THEME.clearanceOutfitId;
    if (!outfitId || !this._wheelCleared) return false;
    if (this._outfitGranted) return false;
    if (DressUpManager.isUnlocked(outfitId)) {
      this._outfitGranted = true;
      this._emitChanged();
      return false;
    }
    const granted = DressUpManager.grantOutfitFromActivity(outfitId);
    this._outfitGranted = true;
    this._emitChanged();
    return granted;
  }

  /** 活动进行中且转盘还没抽完：可以刷专属客人、订单可以拿活动货币。 */
  canEarnCurrency(): boolean {
    return this.isActive() && !this._wheelCleared;
  }

  get currentPrizes(): readonly WheelPrize[] {
    return wheelPrizesForRound(THEME, this._wheelRound);
  }

  isPrizeWon(prizeId: string): boolean {
    return this._wonPrizeIds.has(prizeId);
  }

  get status(): WheelActivityStatus {
    return this.getActivitySnapshot().status;
  }

  get remainingMs(): number {
    return this.getActivitySnapshot().remainingMs;
  }

  get hasRedDot(): boolean {
    return this.isActive()
      && !this._wheelCleared
      && this._currency >= wheelSpinCost(THEME, this._wheelRound);
  }

  getActivitySnapshot(now = Date.now()): WheelActivitySnapshot {
    if (now < THEME.startAt) {
      return {
        status: 'upcoming',
        startAt: THEME.startAt,
        endAt: THEME.endAt,
        remainingMs: THEME.startAt - now,
      };
    }
    if (now <= THEME.endAt) {
      return {
        status: 'active',
        startAt: THEME.startAt,
        endAt: THEME.endAt,
        remainingMs: Math.max(0, THEME.endAt - now),
      };
    }
    return {
      status: 'ended',
      startAt: THEME.startAt,
      endAt: THEME.endAt,
      remainingMs: 0,
    };
  }

  calculateOrderReward(itemIds: readonly string[]): number {
    if (!this.canEarnCurrency()) return 0;
    const earn = THEME.orderEarn;
    let maxLevel = 0;
    for (const itemId of itemIds) {
      const item = ITEM_DEFS.get(itemId);
      if (!item || item.category !== earn.category || item.line !== earn.line) continue;
      maxLevel = Math.max(maxLevel, item.level);
    }
    return wheelEarnAmount(THEME, maxLevel);
  }

  addCurrency(amount: number): number {
    if (!this.canEarnCurrency()) return this._currency;
    const add = Number.isFinite(amount) ? Math.max(0, Math.floor(amount)) : 0;
    if (add <= 0) return this._currency;
    this._currency += add;
    EventBus.emit('wheelEvent:currencyAdded', add, this._currency);
    this._emitChanged();
    return this._currency;
  }

  spin(): WheelSpinResult {
    if (!this.isActive()) return { ok: false, reason: 'not_active' };
    if (this._pendingPrizeId) this.settlePendingSpin();
    this._normalizeWheelProgress();
    if (this._wheelCleared) return { ok: false, reason: 'all_cleared' };
    const spinCost = wheelSpinCost(THEME, this._wheelRound);
    if (this._currency < spinCost) {
      return { ok: false, reason: 'not_enough_currency' };
    }

    const prizes = this.currentPrizes;
    const prize = rollWheelPrize(prizes, this._wonPrizeIds);
    if (!prize) return { ok: false, reason: 'all_cleared' };

    const fromRound = this._wheelRound;
    const prizeIndex = wheelPrizeIndex(prize.id, prizes);
    this._currency -= spinCost;
    this._spinCount += 1;
    this._pendingPrizeId = prize.id;
    this._pendingRound = fromRound;
    EventBus.emit('wheelEvent:spun', prize, this._currency);
    this._emitChanged();
    return {
      ok: true,
      prize,
      prizeIndex,
      remainingCurrency: this._currency,
      fromRound,
    };
  }

  /** 转盘停稳后再入账、置灰、进下一轮。杀进程中断时会在读档时补发。 */
  settlePendingSpin(): WheelSpinSettleResult | null {
    const prizeId = this._pendingPrizeId;
    if (!prizeId) return null;
    const fromRound = clampWheelRound(THEME, this._pendingRound);
    const prizes = wheelPrizesForRound(THEME, fromRound);
    const prize = prizes.find(item => item.id === prizeId) ?? findWheelPrize(THEME, prizeId);
    this._pendingPrizeId = null;
    this._pendingRound = this._wheelRound;
    if (!prize) {
      this._emitChanged();
      return null;
    }
    this._grant(prize.grant);
    this._wonPrizeIds.add(prize.id);
    const advancedToRound = this._advanceRoundIfComplete();
    this._emitChanged();
    return {
      prize,
      fromRound,
      advancedToRound,
      allCleared: this._wheelCleared,
    };
  }

  exportState(): WheelEventState {
    return {
      seasonId: THEME.seasonId,
      currency: this._currency,
      spinCount: this._spinCount,
      currencySettled: this._currencySettled,
      wheelRound: this._wheelRound,
      wonPrizeIds: [...this._wonPrizeIds],
      wheelCleared: this._wheelCleared,
      pendingSpinPrizeId: this._pendingPrizeId ?? undefined,
      pendingSpinRound: this._pendingPrizeId ? this._pendingRound : undefined,
      outfitGranted: this._outfitGranted,
    };
  }

  loadState(raw?: Partial<WheelEventState> | null): void {
    if (raw?.seasonId && raw.seasonId !== THEME.seasonId) {
      this._settleForeignSeason(raw);
      raw = null;
    }
    const state = raw?.seasonId === THEME.seasonId ? raw : emptyState();
    this._currency = Number.isFinite(state.currency)
      ? Math.max(0, Math.floor(state.currency ?? 0))
      : 0;
    this._spinCount = Number.isFinite(state.spinCount)
      ? Math.max(0, Math.floor(state.spinCount ?? 0))
      : 0;
    this._currencySettled = !!state.currencySettled;
    this._wheelRound = clampWheelRound(THEME, state.wheelRound ?? 1);
    this._wheelCleared = !!state.wheelCleared;
    const outfitId = THEME.clearanceOutfitId;
    this._outfitGranted = !!state.outfitGranted || (!!outfitId && DressUpManager.isUnlocked(outfitId));
    this._wonPrizeIds = new Set(
      (state.wonPrizeIds ?? []).filter((id): id is string => typeof id === 'string' && id.length > 0),
    );
    this._pendingPrizeId = typeof state.pendingSpinPrizeId === 'string' && state.pendingSpinPrizeId
      ? state.pendingSpinPrizeId
      : null;
    this._pendingRound = clampWheelRound(THEME, state.pendingSpinRound ?? this._wheelRound);
    this._lastStatus = this.status;
    this._normalizeWheelProgress();
    if (this._pendingPrizeId) this.settlePendingSpin();
    this._trySettleExpiredCurrency({ notify: false });
    this._emitChanged();
  }

  gmSetActiveOverride(active: boolean): void {
    if (this._gmActiveOverride === active) return;
    this._gmActiveOverride = active;
    if (!active && this.status === 'ended') {
      this._trySettleExpiredCurrency({ notify: true });
    }
    EventBus.emit('wheelEvent:periodChanged', this.status);
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
    this._currency = 0;
    this._spinCount = 0;
    this._currencySettled = false;
    this._wheelRound = 1;
    this._wonPrizeIds = new Set();
    this._wheelCleared = false;
    this._outfitGranted = false;
    this._pendingPrizeId = null;
    this._pendingRound = 1;
    this._emitChanged();
  }

  private _settleForeignSeason(raw: Partial<WheelEventState>): void {
    const past = findWheelTheme(raw.seasonId);
    if (raw.pendingSpinPrizeId && past) {
      const prize = findWheelPrize(past, raw.pendingSpinPrizeId);
      if (prize) this._grant(prize.grant);
    }
    if (raw.currencySettled) return;
    const amount = Math.max(0, Math.floor(raw.currency ?? 0));
    const rate = past?.settleToHuayuanRate ?? 1;
    const huayuan = amount * rate;
    if (huayuan > 0) {
      CurrencyManager.addHuayuan(huayuan);
      const name = past?.name ?? '限时转盘';
      const currencyName = past?.currencyName ?? '活动货币';
      ToastMessage.show(`${name}已结束，剩余${amount}${currencyName}已兑换为${huayuan}花愿`);
    }
  }

  private _retireSeasonalItems(): void {
    const retired = retireLiveSeasonalItems({ notify: true });
    if (retired.pieces > 0) SaveManager.save();
  }

  private _trySettleExpiredCurrency(opts?: { notify?: boolean }): number {
    if (this._currencySettled) return 0;
    if (this.getActivitySnapshot().status !== 'ended') return 0;
    if (this._gmActiveOverride) return 0;

    const amount = Math.max(0, Math.floor(this._currency));
    const huayuan = amount * THEME.settleToHuayuanRate;
    this._currency = 0;
    this._currencySettled = true;

    if (huayuan > 0) {
      CurrencyManager.addHuayuan(huayuan);
      EventBus.emit('wheelEvent:currencySettled', amount, huayuan);
      if (opts?.notify) {
        ToastMessage.show(`${THEME.name}已结束，剩余${amount}${THEME.currencyName}已兑换为${huayuan}花愿`);
      }
    }

    this._emitChanged();
    return huayuan;
  }

  private _isUniqueGrantOwned(grant: WheelGrant): boolean {
    if (grant.kind === 'deco') return DecorationManager.isUnlocked(grant.decoId);
    if (grant.kind === 'blueprint') return FurnitureWorkshopManager.hasBlueprint(grant.blueprintId);
    return false;
  }

  private _normalizeWheelProgress(): void {
    if (this._wheelCleared) {
      this._wheelRound = wheelRoundCount(THEME);
      this._wonPrizeIds = new Set(this.currentPrizes.map(prize => prize.id));
      return;
    }
    this._wheelRound = clampWheelRound(THEME, this._wheelRound);
    for (const prize of this.currentPrizes) {
      if (this._isUniqueGrantOwned(prize.grant)) this._wonPrizeIds.add(prize.id);
    }
    const valid = new Set(this.currentPrizes.map(prize => prize.id));
    this._wonPrizeIds = new Set([...this._wonPrizeIds].filter(id => valid.has(id)));
    this._advanceRoundIfComplete();
  }

  private _advanceRoundIfComplete(): number | undefined {
    if (this._wheelCleared) return undefined;
    const prizes = wheelPrizesForRound(THEME, this._wheelRound);
    if (!prizes.every(prize => this._wonPrizeIds.has(prize.id))) return undefined;
    if (this._wheelRound < wheelRoundCount(THEME)) {
      this._wheelRound += 1;
      this._wonPrizeIds = new Set();
      for (const prize of this.currentPrizes) {
        if (this._isUniqueGrantOwned(prize.grant)) this._wonPrizeIds.add(prize.id);
      }
      return this._wheelRound;
    }
    this._wheelCleared = true;
    return undefined;
  }

  private _grant(grant: WheelGrant): boolean {
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
      case 'deco': {
        if (DecorationManager.isUnlocked(grant.decoId)) return false;
        const deco = DECO_MAP.get(grant.decoId);
        const questId = deco?.unlockRequirement?.questId;
        if (questId) grantQuest(questId);
        return DecorationManager.gmUnlockDeco(grant.decoId);
      }
      case 'blueprint':
        return FurnitureWorkshopManager.grantBlueprint(grant.blueprintId);
    }
  }

  private _emitChanged(): void {
    const state = this.exportState();
    EventBus.emit('wheelEvent:changed', state);
    const redDot = this.hasRedDot;
    if (redDot !== this._lastRedDot) {
      this._lastRedDot = redDot;
      EventBus.emit('wheelEvent:redDotChanged', redDot);
    }
  }
}

export const WheelEventManager = new WheelEventManagerClass();
