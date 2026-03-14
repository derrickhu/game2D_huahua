/**
 * 货币管理器
 *
 * 体力上限 = 基础上限 + 等级加成（每3级+5）
 * 支持钻石购买体力（每次10体力，价格递增，每日限5次）
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

/** 钻石购买体力的价格表（第N次购买的钻石花费） */
const STAMINA_BUY_PRICES = [5, 10, 15, 25, 40];
/** 每次购买获得的体力 */
const STAMINA_BUY_AMOUNT = 20;
/** 每日最大购买次数 */
const STAMINA_BUY_MAX_DAILY = 5;
/** 看广告恢复的体力 */
const STAMINA_AD_AMOUNT = 10;
/** 每日最大广告次数 */
const STAMINA_AD_MAX_DAILY = 5;

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

  /** 今日已购买体力次数 */
  private _dailyStaminaBuyCount = 0;
  /** 今日已看广告恢复体力次数 */
  private _dailyStaminaAdCount = 0;
  /** 上次重置每日计数的日期（YYYY-MM-DD） */
  private _lastDailyResetDate = '';

  get state(): Readonly<CurrencyState> {
    return this._state;
  }

  /** 获取体力上限（基础值 + 等级加成） */
  get staminaCap(): number {
    return STAMINA_MAX + Math.floor(this._state.level / 3) * 5;
  }

  /** 体力恢复剩余秒数（满体力时返回 0） */
  get staminaRecoverRemain(): number {
    if (this._state.stamina >= this.staminaCap) return 0;
    return Math.max(0, STAMINA_RECOVER_INTERVAL - this._lastStaminaRecover);
  }

  /** 今日剩余购买次数 */
  get staminaBuyRemaining(): number {
    this._checkDailyReset();
    return STAMINA_BUY_MAX_DAILY - this._dailyStaminaBuyCount;
  }

  /** 下次购买体力的钻石价格 */
  get staminaBuyPrice(): number {
    this._checkDailyReset();
    const idx = Math.min(this._dailyStaminaBuyCount, STAMINA_BUY_PRICES.length - 1);
    return STAMINA_BUY_PRICES[idx];
  }

  /** 每次购买获得的体力量 */
  get staminaBuyAmount(): number {
    return STAMINA_BUY_AMOUNT;
  }

  /** 今日剩余广告恢复次数 */
  get staminaAdRemaining(): number {
    this._checkDailyReset();
    return STAMINA_AD_MAX_DAILY - this._dailyStaminaAdCount;
  }

  /** 看广告获得的体力量 */
  get staminaAdAmount(): number {
    return STAMINA_AD_AMOUNT;
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
    this._state.stamina = Math.min(this.staminaCap, this._state.stamina + amount);
    EventBus.emit('currency:changed', 'stamina', this._state.stamina);
  }

  /**
   * 钻石购买体力
   * @returns true 购买成功
   */
  buyStaminaWithDiamond(): boolean {
    this._checkDailyReset();
    if (this._dailyStaminaBuyCount >= STAMINA_BUY_MAX_DAILY) return false;

    const price = this.staminaBuyPrice;
    if (this._state.diamond < price) return false;

    this.addDiamond(-price);
    this.addStamina(STAMINA_BUY_AMOUNT);
    this._dailyStaminaBuyCount++;

    console.log(`[Currency] 钻石购买体力: -${price}💎 +${STAMINA_BUY_AMOUNT}⚡ (今日第${this._dailyStaminaBuyCount}次)`);
    EventBus.emit('stamina:bought', STAMINA_BUY_AMOUNT, price, this._dailyStaminaBuyCount);
    return true;
  }

  /**
   * 看广告恢复体力（调用方负责播放广告，播放成功后调用此方法）
   * @returns true 恢复成功
   */
  recoverStaminaByAd(): boolean {
    this._checkDailyReset();
    if (this._dailyStaminaAdCount >= STAMINA_AD_MAX_DAILY) return false;

    this.addStamina(STAMINA_AD_AMOUNT);
    this._dailyStaminaAdCount++;

    console.log(`[Currency] 广告恢复体力: +${STAMINA_AD_AMOUNT}⚡ (今日第${this._dailyStaminaAdCount}次)`);
    EventBus.emit('stamina:adRecovered', STAMINA_AD_AMOUNT, this._dailyStaminaAdCount);
    return true;
  }

  /** 增加经验值（连击加成等） */
  addExp(amount: number): void {
    this._state.exp += amount;
    EventBus.emit('currency:changed', 'exp', this._state.exp);
  }

  /** 设置经验值（升级时扣除） */
  setExp(val: number): void {
    this._state.exp = Math.max(0, val);
    EventBus.emit('currency:changed', 'exp', this._state.exp);
  }

  /** 设置等级 */
  setLevel(val: number): void {
    this._state.level = val;
    EventBus.emit('currency:changed', 'level', this._state.level);
  }

  /** 每帧更新，处理体力自然恢复 */
  update(dt: number): void {
    const cap = this.staminaCap;
    if (this._state.stamina < cap) {
      this._lastStaminaRecover += dt;
      if (this._lastStaminaRecover >= STAMINA_RECOVER_INTERVAL) {
        this._lastStaminaRecover -= STAMINA_RECOVER_INTERVAL;
        this._state.stamina = Math.min(cap, this._state.stamina + 1);
        EventBus.emit('currency:changed', 'stamina', this._state.stamina);
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

  /** 检查并重置每日计数 */
  private _checkDailyReset(): void {
    const today = new Date().toISOString().slice(0, 10);
    if (today !== this._lastDailyResetDate) {
      this._lastDailyResetDate = today;
      this._dailyStaminaBuyCount = 0;
      this._dailyStaminaAdCount = 0;
    }
  }
}

export const CurrencyManager = new CurrencyManagerClass();
