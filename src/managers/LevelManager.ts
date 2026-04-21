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
  getGlobalStarLevelLabel,
  getGlobalNextLevelStarRequired,
  getGlobalStarRequiredForLevel,
  buildStarLevelUpReward,
} from '@/config/StarLevelConfig';
import { CurrencyManager } from './CurrencyManager';
import { FlowerSignTicketManager } from './FlowerSignTicketManager';
import { SaveManager } from './SaveManager';

export interface LevelUpReward {
  stamina: number;
  diamond: number;
  rewardBoxItems: Array<{ itemId: string; count: number }>;
  /** 许愿喷泉硬币（直加，非收纳盒） */
  flowerSignTickets: number;
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
    flowerSignTickets: extra.flowerSignTickets ?? 0,
  };
}

/** 一次升多级时合并各星级档奖励（避免只领到最高一档） */
function aggregateStarLevelUpRewards(oldLevel: number, newLevel: number): LevelUpReward {
  let stamina = 0;
  let diamond = 0;
  let flowerSignTickets = 0;
  const boxCounts = new Map<string, number>();
  for (let L = oldLevel + 1; L <= newLevel; L++) {
    const r = buildReward(L);
    stamina += r.stamina;
    diamond += r.diamond;
    flowerSignTickets += r.flowerSignTickets;
    for (const b of r.rewardBoxItems) {
      boxCounts.set(b.itemId, (boxCounts.get(b.itemId) ?? 0) + b.count);
    }
  }
  const rewardBoxItems = Array.from(boxCounts.entries()).map(([itemId, count]) => ({
    itemId,
    count,
  }));
  return { stamina, diamond, rewardBoxItems, flowerSignTickets };
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

  /** 当前全局星级标签（一星、二星...） */
  get starLevelLabel(): string {
    return getGlobalStarLevelLabel(this.level);
  }

  /** 下一星级所需累计星星数（全局无满级，始终有下一档） */
  get nextLevelStarRequired(): number {
    return getGlobalNextLevelStarRequired(this.level);
  }

  /** 星星进度百分比 (0-1)，指向下一全局星级 */
  get starProgress(): number {
    const next = this.nextLevelStarRequired;
    const currentThreshold = this._getCurrentThreshold();
    const range = next - currentThreshold;
    if (range <= 0) return 1;
    return Math.min((this.star - currentThreshold) / range, 1);
  }

  /** 全局星级无硬顶 */
  get isCompleted(): boolean {
    return false;
  }

  /**
   * 下一星级（当前星级+1）的礼包内容预览。
   * 与实际升星时 LevelManager 发放+弹窗展示一致。
   */
  getNextStarLevelRewardPreview(): LevelUpReward | null {
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
    return getGlobalStarRequiredForLevel(this.level);
  }

  private _bindEvents(): void {
    EventBus.on('star:levelUp', (newLevel: number, oldLevel: number) => {
      const reward = aggregateStarLevelUpRewards(oldLevel, newLevel);
      if (reward.stamina > 0) CurrencyManager.addStamina(reward.stamina);
      if (reward.diamond > 0) CurrencyManager.addDiamond(reward.diamond);
      if (reward.flowerSignTickets > 0) {
        FlowerSignTicketManager.add(reward.flowerSignTickets);
        SaveManager.save();
      }

      const boxLog = reward.rewardBoxItems.length
        ? ` 收纳盒:${reward.rewardBoxItems.map(b => `${b.itemId}×${b.count}`).join(',')}`
        : '';
      const stLog = reward.stamina > 0 ? `体力+${reward.stamina} ` : '';
      const wishLog = reward.flowerSignTickets > 0 ? ` 许愿硬币+${reward.flowerSignTickets}` : '';
      console.log(
        `[Level] 星级提升！${oldLevel}→${newLevel}星, 奖励: ${stLog}钻石+${reward.diamond}${wishLog}${boxLog}`,
      );
      EventBus.emit('level:up', newLevel, reward, oldLevel);
    });
  }
}

export const LevelManager = new LevelManagerClass();
