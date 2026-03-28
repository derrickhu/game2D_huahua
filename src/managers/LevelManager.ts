/**
 * 等级经验管理器
 *
 * 管理玩家等级、经验值、升级奖励。
 * 等级提升会增加体力上限、解锁新功能等。
 */
import { EventBus } from '@/core/EventBus';
import { getLevelExtraRewards } from '@/config/LevelRewardsConfig';
import { ITEM_DEFS } from '@/config/ItemConfig';
import { STAMINA_MAX } from '@/config/Constants';
import { CurrencyManager } from './CurrencyManager';

/** 每个等级需要的经验值（大幅拉高，确保前期也有明显积累感） */
function expForLevel(level: number): number {
  if (level <= 0) return 0;
  if (level <= 5) return level * 100;           // 100, 200, 300, 400, 500
  if (level <= 10) return level * 140 + 100;    // 940, 1080, 1220, 1360, 1500
  if (level <= 20) return level * 200 + 300;    // 2500, 2700, …, 4300
  return level * 320 + 500;                     // L21→7220, L30→10100
}

/** 每级升级奖励（弹窗 + 结算） */
export interface LevelUpReward {
  huayuan: number;
  stamina: number;
  diamond: number;
  /** 已写入收纳盒，仅用于 UI 展示 */
  rewardBoxItems: Array<{ itemId: string; count: number }>;
}

function buildLevelUpReward(level: number): LevelUpReward {
  const extra = getLevelExtraRewards(level);
  const rewardBoxItems = (extra.rewardBoxItems ?? []).map(e => ({
    itemId: e.itemId,
    count: e.count,
  }));
  return {
    huayuan: 20 + level * 8,
    stamina: Math.min(30, 10 + level),
    diamond: level % 10 === 0 ? 10 : (level % 5 === 0 ? 5 : 0),
    rewardBoxItems,
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

    // 交付客人给经验（由订单档位决定）
    EventBus.on('customer:delivered', (_uid: number, customer: any) => {
      const baseExp = customer.expReward ?? (10 + (customer.slots?.length || 1) * 5);
      this.addExp(baseExp);
    });
  }

  /** 检查是否可以升级 */
  private _checkLevelUp(): void {
    while (this.exp >= this.expToNextLevel && this.expToNextLevel > 0) {
      const needed = this.expToNextLevel;
      CurrencyManager.setExp(CurrencyManager.state.exp - needed);
      CurrencyManager.setLevel(CurrencyManager.state.level + 1);

      const reward = buildLevelUpReward(this.level);
      CurrencyManager.addHuayuan(reward.huayuan);
      CurrencyManager.addStamina(reward.stamina);
      if (reward.diamond > 0) CurrencyManager.addDiamond(reward.diamond);

      // 收纳盒物品在升级弹窗「飞入礼包」动画结束后再写入（MainScene 回调）

      const boxLog = reward.rewardBoxItems.length
        ? ` 收纳盒:${reward.rewardBoxItems.map(b => `${b.itemId}×${b.count}`).join(',')}`
        : '';
      console.log(`[Level] 升级！等级 ${this.level}, 奖励: 花愿+${reward.huayuan} 体力+${reward.stamina} 钻石+${reward.diamond}${boxLog}`);
      EventBus.emit('level:up', this.level, reward);
    }
  }
}

export const LevelManager = new LevelManagerClass();
