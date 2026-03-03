import { EventManager, GameEvents } from './EventManager';

export interface CurrencyState {
  gold: number;
  wish: number;
  dew: number;
  diamond: number;
}

class CurrencyManagerClass {
  private state: CurrencyState = {
    gold: 100,  // 新手初始金币
    wish: 0,
    dew: 0,
    diamond: 0,
  };

  getState(): Readonly<CurrencyState> {
    return this.state;
  }

  get gold(): number { return this.state.gold; }
  get wish(): number { return this.state.wish; }
  get dew(): number { return this.state.dew; }
  get diamond(): number { return this.state.diamond; }

  addGold(amount: number): void {
    this.state.gold += amount;
    this.emitChange();
  }

  spendGold(amount: number): boolean {
    if (this.state.gold < amount) return false;
    this.state.gold -= amount;
    this.emitChange();
    return true;
  }

  addWish(amount: number): void {
    this.state.wish += amount;
    this.emitChange();
  }

  spendWish(amount: number): boolean {
    if (this.state.wish < amount) return false;
    this.state.wish -= amount;
    this.emitChange();
    return true;
  }

  addDew(amount: number): void {
    this.state.dew += amount;
    this.emitChange();
  }

  spendDew(amount: number): boolean {
    if (this.state.dew < amount) return false;
    this.state.dew -= amount;
    this.emitChange();
    return true;
  }

  addDiamond(amount: number): void {
    this.state.diamond += amount;
    this.emitChange();
  }

  loadState(state: CurrencyState): void {
    this.state = { ...state };
    this.emitChange();
  }

  serialize(): CurrencyState {
    return { ...this.state };
  }

  private emitChange(): void {
    EventManager.emit(GameEvents.CURRENCY_CHANGED, this.state);
  }
}

export const CurrencyManager = new CurrencyManagerClass();
