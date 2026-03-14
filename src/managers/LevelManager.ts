/**
 * 等级经验管理器
 *
 * 管理玩家等级、经验值、升级奖励。
 * 等级提升会增加体力上限、解锁新功能等。
 */
import { EventBus } from '@/core/EventBus';
import { CurrencyManager } from './CurrencyManager';
import { ITEM_DEFS } from '@/config/ItemConfig';
import { STAMINA_MAX } from '@/config/Constants';

/** 每个等级需要的经验值 */
function expForLevel(level: number): number {
  // 递增曲线：前期容易，后期逐渐变难
  if (level <= 0) return 0;
  if (level <= 5) return level * 20;        // 20, 40, 60, 80, 100
  if (level <= 10) return level * 30 + 50;  // 230, 260, 290, 320, 350
  if (level <= 20) return level * 50 + 100; // 650, 700, ...
  return level * 80 + 200;                  // 后期
}

/** 每级升级奖励 */
interface LevelUpReward {
  gold: number;
  stamina: number;
  diamond: number;
}

function getLevelUpReward(level: number): LevelUpReward {
  return {
    gold: 50 + level * 20,
    stamina: Math.min(STAMINA_MAX, 20 + level * 2),
    diamond: level % 5 === 0 ? 10 : (level % 10 === 0 ? 30 : 0), // 每5级给钻石
  };
}

class LevelManagerClass {
  private _initialized = false;

  init(): void {
    if (this._initialized) return;
    this._initialized = true;
    this._bindEvents();
  }

  /** 获取当前等级 */
  get level(): number {
    return CurrencyManager.state.level;
  }

  /** 获取当前经验 */
  get exp(): number {
    return CurrencyManager.state.exp;
  }

  /** 获取当前等级所需总经验 */
  get expToNextLevel(): number {
    return expForLevel(this.level);
  }

  /** 获取经验进度百分比 (0-1) */
  get expProgress(): number {
    const needed = this.expToNextLevel;
    if (needed <= 0) return 1;
    return Math.min(this.exp / needed, 1);
  }

  /** 获取体力上限（随等级提升） */
  get staminaCap(): number {
    return STAMINA_MAX + Math.floor(this.level / 3) * 5;
  }

  /** 增加经验值并检查升级 */
  addExp(amount: number): void {
    CurrencyManager.addExp(amount);
    this._checkLevelUp();
  }

  /** 绑定事件 */
  private _bindEvents(): void {
    // 合成给经验
    EventBus.on('board:merged', (_srcIdx: number, _dstIdx: number, resultId: string) => {
      const def = ITEM_DEFS.get(resultId);
      if (def) {
        // 经验 = 合成产物等级 × 5
        this.addExp(def.level * 5);
      }
    });

    // 交付客人给经验
    EventBus.on('customer:delivered', (_uid: number, customer: any) => {
      const baseExp = 10 + (customer.slots?.length || 1) * 5;
      this.addExp(baseExp);
    });
  }

  /** 检查是否可以升级 */
  private _checkLevelUp(): void {
    while (this.exp >= this.expToNextLevel && this.expToNextLevel > 0) {
      const needed = this.expToNextLevel;
      CurrencyManager.setExp(CurrencyManager.state.exp - needed);
      CurrencyManager.setLevel(CurrencyManager.state.level + 1);

      const reward = getLevelUpReward(this.level);
      CurrencyManager.addGold(reward.gold);
      CurrencyManager.addStamina(reward.stamina);
      if (reward.diamond > 0) CurrencyManager.addDiamond(reward.diamond);

      console.log(`[Level] 升级！等级 ${this.level}, 奖励: 金币+${reward.gold} 体力+${reward.stamina} 钻石+${reward.diamond}`);
      EventBus.emit('level:up', this.level, reward);
    }
  }
}

export const LevelManager = new LevelManagerClass();
