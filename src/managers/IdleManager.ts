/**
 * 离线挂机收益系统
 *
 * 离线期间按规则产出收纳框物品 + 花愿；体力自然回复在读档时由 CurrencyManager
 * 按存档 timestamp 与 STAMINA_RECOVER_INTERVAL 结算，与在线 ticker 规则一致。
 * 回归时展示「离线收益报告」，领取无广告翻倍。
 *
 * 是否参与启动流程由 `Constants.OFFLINE_REWARD_UI_ENABLED` 控制；关闭时本类仍负责时间戳同步，便于日后活动/推送等复用。
 */
import { EventBus } from '@/core/EventBus';
import { PersistService } from '@/core/PersistService';
import { BoardManager } from './BoardManager';
import { CurrencyManager } from './CurrencyManager';
import { RewardBoxManager } from './RewardBoxManager';
import {
  IDLE_PRODUCE_INTERVAL,
  OFFLINE_MAX_HOURS,
  OFFLINE_HUAYUAN_INTERVAL_SEC,
  OFFLINE_REWARD_UI_ENABLED,
} from '@/config/Constants';
import { ITEM_DEFS, Category, findItemId, FlowerLine } from '@/config/ItemConfig';

declare const wx: any;
declare const tt: any;
const _api = typeof wx !== 'undefined' ? wx : typeof tt !== 'undefined' ? tt : null;

const IDLE_STORAGE_KEY = 'huahua_idle';

export interface OfflineReward {
  /** 离线时长（秒） */
  offlineSeconds: number;
  /** 产出的物品 [{itemId, name}] */
  producedItems: { itemId: string; name: string }[];
  /** 花愿（体力不计入本面板，由 SaveManager 读档时单独结算） */
  huayuanEarned: number;
}

interface IdleSaveData {
  lastOnlineTimestamp: number;
}

class IdleManagerClass {
  private _lastOnlineTimestamp = 0;
  private _pendingReward: OfflineReward | null = null;

  get pendingReward(): OfflineReward | null { return this._pendingReward; }

  init(): void {
    this._loadState();
  }

  /** 计算离线收益（在游戏启动时调用） */
  calculateOfflineReward(): OfflineReward | null {
    if (!OFFLINE_REWARD_UI_ENABLED) {
      this._pendingReward = null;
      this._updateTimestamp();
      return null;
    }

    if (this._lastOnlineTimestamp <= 0) {
      // 首次进入，无离线收益
      this._updateTimestamp();
      return null;
    }

    const now = Date.now();
    const offlineMs = now - this._lastOnlineTimestamp;
    const offlineSeconds = Math.floor(offlineMs / 1000);

    // 最少离线60秒才计算收益
    if (offlineSeconds < 60) {
      this._updateTimestamp();
      return null;
    }

    // 离线上限
    const maxSeconds = OFFLINE_MAX_HOURS * 3600;
    const effectiveSeconds = Math.min(offlineSeconds, maxSeconds);

    // 计算产出物品数量
    const permBuildingCount = this._countPermanentBuildings();
    const produceCount = Math.floor(effectiveSeconds / IDLE_PRODUCE_INTERVAL) * Math.max(1, permBuildingCount);
    const cappedCount = Math.min(produceCount, 8); // 最多产出8个，避免棋盘爆满

    // 产出物品
    const producedItems: { itemId: string; name: string }[] = [];
    for (let i = 0; i < cappedCount; i++) {
      const itemId = this._randomIdleItem();
      if (itemId) {
        const def = ITEM_DEFS.get(itemId);
        producedItems.push({ itemId, name: def?.name || itemId });
      }
    }

    const huayuanEarned = Math.floor(effectiveSeconds / OFFLINE_HUAYUAN_INTERVAL_SEC);

    const reward: OfflineReward = {
      offlineSeconds: effectiveSeconds,
      producedItems,
      huayuanEarned,
    };

    this._pendingReward = reward;
    this._updateTimestamp();
    return reward;
  }

  /** 领取离线收益 */
  claimReward(): void {
    if (!this._pendingReward) return;

    const reward = this._pendingReward;

    for (const item of reward.producedItems) {
      RewardBoxManager.addItem(item.itemId);
    }

    if (reward.huayuanEarned > 0) {
      CurrencyManager.addHuayuan(reward.huayuanEarned);
    }

    this._pendingReward = null;
    EventBus.emit('idle:claimed', reward);
  }

  /** 记录玩家在线状态（在每帧 update 或离开时调用） */
  recordOnline(): void {
    this._updateTimestamp();
  }

  /** 游戏退到后台时保存时间戳 */
  onHide(): void {
    this._updateTimestamp();
  }

  // ====== 私有方法 ======

  /** 统计棋盘上的永久型建筑数量 */
  private _countPermanentBuildings(): number {
    let count = 0;
    for (const cell of BoardManager.cells) {
      if (cell.state === 'open' && cell.itemId?.startsWith('tool_')) {
        count++;
      }
    }
    return count;
  }

  /** 随机产出低等级物品 */
  private _randomIdleItem(): string | null {
    const lines = [FlowerLine.FRESH, FlowerLine.BOUQUET, FlowerLine.GREEN];
    const line = lines[Math.floor(Math.random() * lines.length)];
    // 70% 1级, 25% 2级, 5% 3级
    const roll = Math.random();
    const level = roll < 0.7 ? 1 : roll < 0.95 ? 2 : 3;
    return findItemId(Category.FLOWER, line, level);
  }

  private _updateTimestamp(): void {
    this._lastOnlineTimestamp = Date.now();
    this._saveState();
  }

  // ====== 存档 ======

  private _saveState(): void {
    const data: IdleSaveData = {
      lastOnlineTimestamp: this._lastOnlineTimestamp,
    };
    try {
      PersistService.writeRaw(IDLE_STORAGE_KEY, JSON.stringify(data));
    } catch (_) {}
  }

  private _loadState(): void {
    try {
      const raw = PersistService.readRaw(IDLE_STORAGE_KEY);
      if (raw) {
        const data: IdleSaveData = JSON.parse(raw);
        this._lastOnlineTimestamp = data.lastOnlineTimestamp || 0;
      }
    } catch (_) {}
  }
}

export const IdleManager = new IdleManagerClass();
