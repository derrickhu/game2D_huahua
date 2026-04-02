/**
 * 等级管理器（v2 星级重构）
 *
 * 等级 = 星级，由购买家具/换装累积星星驱动。
 * 已移除：合成/订单直接给经验的旧逻辑。
 * 升级奖励：体力 + 钻石 + 宝箱（不发花愿，防止短路循环）。
 */
import { EventBus } from '@/core/EventBus';
import { getLevelExtraRewards } from '@/config/LevelRewardsConfig';
import {
  getStarLevel,
  getStarLevelLabel,
  getNextLevelStarRequired,
  isSceneCompleted,
  buildStarLevelUpReward,
} from '@/config/StarLevelConfig';
import { CurrencyManager } from './CurrencyManager';

export interface LevelUpReward {
  stamina: number;
  diamond: number;
  rewardBoxItems: Array<{ itemId: string; count: number }>;
}

function buildReward(newLevel: number): LevelUpReward {
  const base = buildStarLevelUpReward(newLevel);
  const extra = getLevelExtraRewards(newLevel);
  const rewardBoxItems = [
    ...base.rewardBoxItems,
    ...(extra.rewardBoxItems ?? []),
  ];
  return {
    stamina: base.stamina,
    diamond: base.diamond,
    rewardBoxItems,
  };
}

/** 一次升多级时合并各星级档奖励（避免只领到最高一档） */
function aggregateStarLevelUpRewards(oldLevel: number, newLevel: number): LevelUpReward {
  let stamina = 0;
  let diamond = 0;
  const boxCounts = new Map<string, number>();
  for (let L = oldLevel + 1; L <= newLevel; L++) {
    const r = buildReward(L);
    stamina += r.stamina;
    diamond += r.diamond;
    for (const b of r.rewardBoxItems) {
      boxCounts.set(b.itemId, (boxCounts.get(b.itemId) ?? 0) + b.count);
    }
  }
  const rewardBoxItems = Array.from(boxCounts.entries()).map(([itemId, count]) => ({
    itemId,
    count,
  }));
  return { stamina, diamond, rewardBoxItems };
}

class LevelManagerClass {
  private _initialized = false;

  init(): void {
    if (this._initialized) return;
    this._initialized = true;
    this._bindEvents();
  }

  get level(): number {
    return CurrencyManager.state.level;
  }

  /** 当前累积星星 */
  get star(): number {
    return CurrencyManager.state.star;
  }

  /** 当前星级标签（一星、二星...） */
  get starLevelLabel(): string {
    return getStarLevelLabel(CurrencyManager.state.sceneId, this.level);
  }

  /** 下一星级所需星星数，满星返回 -1 */
  get nextLevelStarRequired(): number {
    return getNextLevelStarRequired(CurrencyManager.state.sceneId, this.level);
  }

  /** 星星进度百分比 (0-1)，满星返回 1 */
  get starProgress(): number {
    const next = this.nextLevelStarRequired;
    if (next < 0) return 1;
    const currentThreshold = this._getCurrentThreshold();
    const range = next - currentThreshold;
    if (range <= 0) return 1;
    return Math.min((this.star - currentThreshold) / range, 1);
  }

  /** 是否已满星（当前场景） */
  get isCompleted(): boolean {
    return isSceneCompleted(CurrencyManager.state.sceneId, this.level);
  }

  /**
   * 下一星级（当前星级+1）的礼包内容预览；已满星返回 null。
   * 与实际升星时 LevelManager 发放+弹窗展示一致。
   */
  getNextStarLevelRewardPreview(): LevelUpReward | null {
    const nextReq = getNextLevelStarRequired(CurrencyManager.state.sceneId, this.level);
    if (nextReq < 0) return null;
    return buildReward(this.level + 1);
  }

  /** @deprecated 经验系统已移除 */
  get exp(): number { return 0; }
  /** @deprecated */
  get expToNextLevel(): number { return 0; }
  /** @deprecated */
  get expProgress(): number { return 0; }
  /** @deprecated */
  addExp(_amount: number): void {}

  private _getCurrentThreshold(): number {
    const sceneId = CurrencyManager.state.sceneId;
    const prevRequired = getNextLevelStarRequired(sceneId, this.level - 1);
    return prevRequired >= 0 ? prevRequired : 0;
  }

  private _bindEvents(): void {
    EventBus.on('star:levelUp', (newLevel: number, oldLevel: number) => {
      const reward = aggregateStarLevelUpRewards(oldLevel, newLevel);
      CurrencyManager.addStamina(reward.stamina);
      if (reward.diamond > 0) CurrencyManager.addDiamond(reward.diamond);

      const boxLog = reward.rewardBoxItems.length
        ? ` 收纳盒:${reward.rewardBoxItems.map(b => `${b.itemId}×${b.count}`).join(',')}`
        : '';
      console.log(
        `[Level] 星级提升！${oldLevel}→${newLevel}星, 奖励: 体力+${reward.stamina} 钻石+${reward.diamond}${boxLog}`,
      );
      EventBus.emit('level:up', newLevel, reward);
    });
  }
}

export const LevelManager = new LevelManagerClass();
