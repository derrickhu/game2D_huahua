/**
 * 货币管理器
 *
 * 货币体系（v2 星星重构）：
 * - 花愿 (huayuan)：主货币；**收入仅** 客人订单交付 + 离线收益领取；其余玩法奖励多为钻石/体力
 * - 钻石 (diamond)：硬通货
 * - 体力 (stamina)：节奏调控
 * - 星星 (star)：购买家具/换装后累积的**全局**评分（只增不减）
 * - 星级 (level)：由全局星星阈值决定，= 游戏等级（与当前装修场景无关）
 *
 * 已移除：花露(hualu)、经验(exp)
 */
import { AudioManager } from '@/core/AudioManager';
import { EventBus } from '@/core/EventBus';
import { STAMINA_MAX, STAMINA_RECOVER_INTERVAL } from '@/config/Constants';
import {
  DEFAULT_SCENE_ID,
  SCENE_MAP,
  getGlobalStarLevel,
  getGlobalStarRequiredForLevel,
  type SceneStarProgress,
} from '@/config/StarLevelConfig';

export interface CurrencyState {
  gold: number;
  huayuan: number;
  diamond: number;
  stamina: number;
  /** 全局星星累积值（只增不减） */
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

/** 单次购买获得的体力（恒为 100） */
const STAMINA_BUY_AMOUNT = 100;
/** 当日第 1 次：10 钻；之后每次 +10 钻，单价封顶 50（第 5 次及以后若仍允许购买则为 50） */
const STAMINA_BUY_PRICE_BASE = 10;
const STAMINA_BUY_PRICE_STEP = 10;
const STAMINA_BUY_PRICE_CAP = 50;
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
    return Math.min(
      STAMINA_BUY_PRICE_BASE + STAMINA_BUY_PRICE_STEP * this._dailyStaminaBuyCount,
      STAMINA_BUY_PRICE_CAP,
    );
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
    if (amount < 0) {
      EventBus.emit('quest:diamondSpent', -amount);
    }
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
   * 购买家具/换装时调用，星星计入**全局**池。
   * 自动检查星级变化并触发 star:levelUp 事件。
   */
  addStar(amount: number): void {
    if (amount <= 0) return;
    this._state.star += amount;
    this._syncSceneProgressMirrors();
    EventBus.emit('currency:changed', 'star', this._state.star);
    this._checkStarLevel();
  }

  /** 内部：检查星级是否提升 */
  private _checkStarLevel(): void {
    const newLevel = getGlobalStarLevel(this._state.star);
    if (newLevel > this._state.level) {
      const oldLevel = this._state.level;
      this._state.level = newLevel;
      this._syncSceneProgressMirrors();
      EventBus.emit('currency:changed', 'level', this._state.level);
      EventBus.emit('star:levelUp', newLevel, oldLevel);
      console.log(`[Currency] 星级提升！${oldLevel} → ${newLevel}`);
    }
  }

  /** 各场景存档条目中 mirror 全局星/级（兼容旧结构；不按房分桶） */
  private _syncSceneProgressMirrors(): void {
    for (const sp of this._state.sceneProgresses) {
      sp.star = this._state.star;
      sp.starLevel = this._state.level;
      sp.completed = false;
    }
  }

  /**
   * 全局游戏等级 = 全局星级（与顶栏一致）
   * 用于订单档位、大地图解锁、合成气泡等门控
   */
  get globalLevel(): number {
    return Math.max(1, this._state.level);
  }

  buyStaminaWithDiamond(): boolean {
    this._checkDailyReset();
    if (this._dailyStaminaBuyCount >= STAMINA_BUY_MAX_DAILY) return false;

    const price = this.staminaBuyPrice;
    if (this._state.diamond < price) return false;

    this.addDiamond(-price);
    this.addStamina(STAMINA_BUY_AMOUNT);
    this._dailyStaminaBuyCount++;

    AudioManager.play('purchase_tap');

    console.log(`[Currency] 钻石购买体力: -${price} +${STAMINA_BUY_AMOUNT} (今日第${this._dailyStaminaBuyCount}次)`);
    EventBus.emit('stamina:bought', STAMINA_BUY_AMOUNT, price, this._dailyStaminaBuyCount);
    return true;
  }

  recoverStaminaByAd(): boolean {
    this._checkDailyReset();
    if (this._dailyStaminaAdCount >= STAMINA_AD_MAX_DAILY) return false;

    this.addStamina(STAMINA_AD_AMOUNT);
    this._dailyStaminaAdCount++;

    console.log(`[Currency] 广告恢复体力: +${STAMINA_AD_AMOUNT} (今日第${this._dailyStaminaAdCount}次)`);
    EventBus.emit('stamina:adRecovered', STAMINA_AD_AMOUNT, this._dailyStaminaAdCount);
    return true;
  }

  /**
   * 切换当前活跃装修场景。
   * 不改变全局 star / level；仅切换 sceneId 并补齐 sceneProgresses 条目。
   */
  setActiveRenovationScene(sceneId: string): void {
    if (sceneId === this._state.sceneId) return;
    if (!SCENE_MAP.has(sceneId)) {
      console.warn(`[Currency] unknown sceneId: ${sceneId}`);
      return;
    }

    let sp = this._state.sceneProgresses.find(p => p.sceneId === sceneId);
    if (!sp) {
      sp = {
        sceneId,
        star: this._state.star,
        starLevel: this._state.level,
        completed: false,
      };
      this._state.sceneProgresses.push(sp);
    }

    this._state.sceneId = sceneId;
    this._syncSceneProgressMirrors();

    console.log(`[Currency] 切换装修场景 → ${sceneId}, 全局 star=${this._state.star}, level=${this._state.level}`);
    EventBus.emit('renovation:sceneChanged', sceneId);
  }

  /** @deprecated 经验系统已移除，星级由星星阈值驱动 */
  addExp(_amount: number): void {
    // no-op: 保留签名防止调用方报错，后续清理
  }

  /** @deprecated */
  setExp(_val: number): void {}

  /**
   * GM/调试：将**全局**星级设为指定值，并把累计星星调到该星级阈值。
   * 门控使用 `globalLevel`（与顶栏星级一致）。
   * 正式玩法请用 `addStar`，勿对玩家开放此接口。
   */
  setLevel(val: number): void {
    const clamped = Math.max(1, Math.min(Math.floor(val), 999));
    const star = getGlobalStarRequiredForLevel(clamped);

    this._state.star = star;
    this._state.level = clamped;
    this._ensureActiveSceneProgress();
    this._syncSceneProgressMirrors();

    EventBus.emit('currency:changed', 'star', this._state.star);
    EventBus.emit('currency:changed', 'level', this._state.level);
    console.log(`[Currency] GM setLevel → 全局星级=${clamped} 累计星=${star}，globalLevel=${this.globalLevel}`);
  }

  private _ensureActiveSceneProgress(): void {
    const sid = this._state.sceneId;
    if (!this._state.sceneProgresses.some(p => p.sceneId === sid)) {
      this._state.sceneProgresses.push({
        sceneId: sid,
        star: this._state.star,
        starLevel: this._state.level,
        completed: false,
      });
    }
  }

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

    // 旧档按房分桶的星星：合并为全局池（取最大，避免丢进度）
    const mergedStar = Math.max(
      this._state.star,
      ...this._state.sceneProgresses.map(sp => sp.star ?? 0),
    );
    this._state.star = mergedStar;
    this._state.level = getGlobalStarLevel(mergedStar);
    this._syncSceneProgressMirrors();

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
