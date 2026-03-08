/**
 * 货币管理器
 */
import { EventBus } from '@/core/EventBus';
import { STAMINA_MAX, STAMINA_RECOVER_INTERVAL } from '@/config/Constants';

export interface CurrencyState {
  gold: number;
  huayuan: number;  // 花愿
  hualu: number;    // 花露
  diamond: number;
  stamina: number;
  level: number;
  exp: number;
}

class CurrencyManagerClass {
  private _state: CurrencyState = {
    gold: 100,
    huayuan: 0,
    hualu: 0,
    diamond: 10,
    stamina: STAMINA_MAX,
    level: 1,
    exp: 0,
  };

  private _lastStaminaRecover = 0;

  get state(): Readonly<CurrencyState> {
    return this._state;
  }

  /** 体力恢复剩余秒数（满体力时返回 0） */
  get staminaRecoverRemain(): number {
    if (this._state.stamina >= STAMINA_MAX) return 0;
    return Math.max(0, STAMINA_RECOVER_INTERVAL - this._lastStaminaRecover);
  }

  addGold(amount: number): void {
    this._state.gold = Math.max(0, this._state.gold + amount);
    EventBus.emit('currency:changed', 'gold', this._state.gold);
  }

  addHuayuan(amount: number): void {
    this._state.huayuan = Math.max(0, this._state.huayuan + amount);
    EventBus.emit('currency:changed', 'huayuan', this._state.huayuan);
  }

  addHualu(amount: number): void {
    this._state.hualu = Math.max(0, this._state.hualu + amount);
    EventBus.emit('currency:changed', 'hualu', this._state.hualu);
  }

  addDiamond(amount: number): void {
    this._state.diamond = Math.max(0, this._state.diamond + amount);
    EventBus.emit('currency:changed', 'diamond', this._state.diamond);
  }

  consumeStamina(amount: number): boolean {
    if (this._state.stamina < amount) return false;
    this._state.stamina -= amount;
    EventBus.emit('currency:changed', 'stamina', this._state.stamina);
    return true;
  }

  addStamina(amount: number): void {
    this._state.stamina = Math.min(STAMINA_MAX, this._state.stamina + amount);
    EventBus.emit('currency:changed', 'stamina', this._state.stamina);
  }

  /** 每帧更新，处理体力自然恢复 */
  update(dt: number): void {
    if (this._state.stamina < STAMINA_MAX) {
      this._lastStaminaRecover += dt;
      if (this._lastStaminaRecover >= STAMINA_RECOVER_INTERVAL) {
        this._lastStaminaRecover -= STAMINA_RECOVER_INTERVAL;
        this.addStamina(1);
      }
    } else {
      this._lastStaminaRecover = 0;
    }
  }

  /** 加载存档 */
  loadState(state: Partial<CurrencyState>): void {
    Object.assign(this._state, state);
    EventBus.emit('currency:loaded');
  }

  /** 导出存档 */
  exportState(): CurrencyState {
    return { ...this._state };
  }
}

export const CurrencyManager = new CurrencyManagerClass();
