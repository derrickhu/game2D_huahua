/**
 * 货币管理器
 *
 * 货币体系（v2 星星重构）：
 * - 花愿 (huayuan)：主货币；**收入仅** 客人订单交付 + 离线收益领取；其余玩法奖励多为钻石/体力
 * - 钻石 (diamond)：硬通货
 * - 体力 (stamina)：节奏调控
 * - 星星 (star)：购买家具/换装后累积的评分（只增不减）
 * - 星级 (starLevel)：由星星阈值决定，= 游戏等级
 *
 * 已移除：花露(hualu)、经验(exp)
 */
import { EventBus } from '@/core/EventBus';
import { STAMINA_MAX, STAMINA_RECOVER_INTERVAL } from '@/config/Constants';
import {
  DEFAULT_SCENE_ID,
  getStarLevel,
  getGlobalLevel,
  type SceneStarProgress,
} from '@/config/StarLevelConfig';

export interface CurrencyState {
  gold: number;
  huayuan: number;
  diamond: number;
  stamina: number;
  /** 当前场景的星星累积值（只增不减） */
  star: number;
  /** 当前星级（由 star 阈值计算，= 游戏等级） */
  level: number;
  /** 当前活跃场景 ID */
  sceneId: string;
  /** 所有场景的星星进度（含已完成场景） */
  sceneProgresses: SceneStarProgress[];
  /** 距上次体力恢复已过的秒数（用于恢复倒计时的持久化） */
  staminaRecoverElapsed?: number;
}

const STAMINA_BUY_PRICES = [5, 10, 15, 25, 40];
const STAMINA_BUY_AMOUNT = 20;
const STAMINA_BUY_MAX_DAILY = 5;
const STAMINA_AD_AMOUNT = 10;
const STAMINA_AD_MAX_DAILY = 5;

class CurrencyManagerClass {
  private _state: CurrencyState = {
    gold: 0,
    huayuan: 0,
    diamond: 0,
    stamina: STAMINA_MAX,
    star: 0,
    level: 1,
    sceneId: DEFAULT_SCENE_ID,
    sceneProgresses: [{
      sceneId: DEFAULT_SCENE_ID,
      star: 0,
      starLevel: 1,
      completed: false,
    }],
  };

  private _lastStaminaRecover = 0;
  private _dailyStaminaBuyCount = 0;
  private _dailyStaminaAdCount = 0;
  private _lastDailyResetDate = '';

  get state(): Readonly<CurrencyState> {
    return this._state;
  }

  get staminaCap(): number {
    return STAMINA_MAX + Math.floor(this._state.level / 3) * 5;
  }

  get staminaRecoverRemain(): number {
    if (this._state.stamina >= this.staminaCap) return 0;
    return Math.max(0, STAMINA_RECOVER_INTERVAL - this._lastStaminaRecover);
  }

  get staminaBuyRemaining(): number {
    this._checkDailyReset();
    return STAMINA_BUY_MAX_DAILY - this._dailyStaminaBuyCount;
  }

  get staminaBuyPrice(): number {
    this._checkDailyReset();
    const idx = Math.min(this._dailyStaminaBuyCount, STAMINA_BUY_PRICES.length - 1);
    return STAMINA_BUY_PRICES[idx];
  }

  get staminaBuyAmount(): number {
    return STAMINA_BUY_AMOUNT;
  }

  get staminaAdRemaining(): number {
    this._checkDailyReset();
    return STAMINA_AD_MAX_DAILY - this._dailyStaminaAdCount;
  }

  get staminaAdAmount(): number {
    return STAMINA_AD_AMOUNT;
  }

  /** @deprecated 统一使用 addHuayuan */
  addGold(amount: number): void {
    this.addHuayuan(amount);
  }

  addHuayuan(amount: number): void {
    this._state.huayuan = Math.max(0, this._state.huayuan + amount);
    EventBus.emit('currency:changed', 'huayuan', this._state.huayuan);
    if (amount > 0) {
      EventBus.emit('quest:huayuanEarned', amount);
    }
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
    if (amount === 0) return;
    this._state.stamina = Math.max(0, this._state.stamina + amount);
    EventBus.emit('currency:changed', 'stamina', this._state.stamina);
  }

  /**
   * 增加星星（只增不减）。
   * 购买家具/换装时调用，星星计入当前活跃场景。
   * 自动检查星级变化并触发 star:levelUp 事件。
   */
  addStar(amount: number): void {
    if (amount <= 0) return;
    this._state.star += amount;

    const sp = this._getActiveSceneProgress();
    if (sp) {
      sp.star = this._state.star;
    }

    EventBus.emit('currency:changed', 'star', this._state.star);
    this._checkStarLevel();
  }

  /** 内部：检查星级是否提升 */
  private _checkStarLevel(): void {
    const newLevel = getStarLevel(this._state.sceneId, this._state.star);
    if (newLevel > this._state.level) {
      const oldLevel = this._state.level;
      this._state.level = newLevel;

      const sp = this._getActiveSceneProgress();
      if (sp) {
        sp.starLevel = newLevel;
      }

      EventBus.emit('currency:changed', 'level', this._state.level);
      EventBus.emit('star:levelUp', newLevel, oldLevel);
      console.log(`[Currency] 星级提升！${oldLevel} → ${newLevel}`);
    }
  }

  /** 内部：获取当前活跃场景的进度对象 */
  private _getActiveSceneProgress(): SceneStarProgress | undefined {
    return this._state.sceneProgresses.find(
      sp => sp.sceneId === this._state.sceneId
    );
  }

  /**
   * 全局游戏等级（综合所有场景进度）
   * 用于订单档位等全局门控
   */
  get globalLevel(): number {
    return getGlobalLevel(this._state.sceneProgresses);
  }

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

  recoverStaminaByAd(): boolean {
    this._checkDailyReset();
    if (this._dailyStaminaAdCount >= STAMINA_AD_MAX_DAILY) return false;

    this.addStamina(STAMINA_AD_AMOUNT);
    this._dailyStaminaAdCount++;

    console.log(`[Currency] 广告恢复体力: +${STAMINA_AD_AMOUNT}⚡ (今日第${this._dailyStaminaAdCount}次)`);
    EventBus.emit('stamina:adRecovered', STAMINA_AD_AMOUNT, this._dailyStaminaAdCount);
    return true;
  }

  /** @deprecated 经验系统已移除，星级由星星阈值驱动 */
  addExp(_amount: number): void {
    // no-op: 保留签名防止调用方报错，后续清理
  }

  /** @deprecated */
  setExp(_val: number): void {}

  /** @deprecated */
  setLevel(_val: number): void {}

  /** @deprecated 花露已移除，统一使用花愿 */
  addHualu(_amount: number): void {}

  update(dt: number): void {
    const cap = this.staminaCap;
    if (this._state.stamina < cap) {
      this._lastStaminaRecover += dt;
      let gained = 0;
      while (this._lastStaminaRecover >= STAMINA_RECOVER_INTERVAL && this._state.stamina < cap) {
        this._lastStaminaRecover -= STAMINA_RECOVER_INTERVAL;
        this._state.stamina = Math.min(cap, this._state.stamina + 1);
        gained++;
      }
      if (gained > 0) {
        EventBus.emit('currency:changed', 'stamina', this._state.stamina);
      }
    } else {
      this._lastStaminaRecover = 0;
    }
  }

  /**
   * 根据真实经过的秒数结算体力自然恢复（用于离线读档：与在线同一套 INTERVAL，直到上限）。
   * @param elapsedSeconds 距上次存档的秒数，负值或过大时间会钳制
   */
  applyElapsedStaminaRecovery(elapsedSeconds: number): void {
    if (!Number.isFinite(elapsedSeconds) || elapsedSeconds <= 0) return;

    // 防止异常时钟：最多按 30 天折算，避免 remainder 溢出日常 float
    const elapsed = Math.min(elapsedSeconds, 30 * 24 * 3600);

    const cap = this.staminaCap;
    if (this._state.stamina >= cap) {
      this._lastStaminaRecover = 0;
      return;
    }

    let total = this._lastStaminaRecover + elapsed;
    let gained = 0;
    while (this._state.stamina < cap && total >= STAMINA_RECOVER_INTERVAL) {
      total -= STAMINA_RECOVER_INTERVAL;
      this._state.stamina += 1;
      gained++;
    }

    this._lastStaminaRecover = this._state.stamina >= cap ? 0 : total;

    if (gained > 0) {
      console.log(`[Currency] 离线/间隔结算体力 +${gained}，当前 ${this._state.stamina}/${cap}`);
      EventBus.emit('currency:changed', 'stamina', this._state.stamina);
    }
  }

  loadState(state: Partial<CurrencyState>): void {
    if (state.staminaRecoverElapsed !== undefined) {
      this._lastStaminaRecover = state.staminaRecoverElapsed;
    }
    const { staminaRecoverElapsed: _, ...rest } = state;

    // 兼容旧存档：如果没有 star/sceneId 字段，使用默认值
    if (rest.star === undefined) rest.star = 0;
    if (!rest.sceneId) rest.sceneId = DEFAULT_SCENE_ID;
    if (!rest.sceneProgresses || rest.sceneProgresses.length === 0) {
      rest.sceneProgresses = [{
        sceneId: rest.sceneId || DEFAULT_SCENE_ID,
        star: rest.star || 0,
        starLevel: rest.level || 1,
        completed: false,
      }];
    }

    Object.assign(this._state, rest);

    // 旧存档可能有 hualu/exp 字段，直接忽略
    delete (this._state as any).hualu;
    delete (this._state as any).exp;

    // 星级必须与累计星数一致，否则会出现「星级虚高」导致再也无法触发升星与 level:up
    const derived = getStarLevel(this._state.sceneId, this._state.star);
    this._state.level = derived;
    for (const sp of this._state.sceneProgresses) {
      if (sp.sceneId === this._state.sceneId) {
        sp.star = this._state.star;
      }
      sp.starLevel = getStarLevel(sp.sceneId, sp.star);
    }

    EventBus.emit('currency:loaded');
  }

  exportState(): CurrencyState {
    return { ...this._state, staminaRecoverElapsed: this._lastStaminaRecover };
  }

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
