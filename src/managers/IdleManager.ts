/**
 * 离线挂机收益系统
 *
 * 玩家离线期间，永久型建筑自动产出物品。
 * 回归时展示"离线收益报告"。
 */
import { EventBus } from '@/core/EventBus';
import { BoardManager } from './BoardManager';
import { CurrencyManager } from './CurrencyManager';
import { IDLE_PRODUCE_INTERVAL, OFFLINE_MAX_HOURS, STAMINA_RECOVER_INTERVAL, STAMINA_MAX } from '@/config/Constants';
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
  /** 恢复的体力 */
  staminaRecovered: number;
  /** 基础金币 */
  goldEarned: number;
  /** 是否可以看广告翻倍 */
  canDoubleByAd: boolean;
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

    // 计算体力恢复
    const currentStamina = CurrencyManager.state.stamina;
    const staminaRecoverable = STAMINA_MAX - currentStamina;
    const staminaFromTime = Math.floor(effectiveSeconds / STAMINA_RECOVER_INTERVAL);
    const staminaRecovered = Math.min(staminaFromTime, staminaRecoverable);

    // 基础金币（离线时长的奖励）
    const goldEarned = Math.floor(effectiveSeconds / 60) * 5; // 每分钟5金币

    const reward: OfflineReward = {
      offlineSeconds: effectiveSeconds,
      producedItems,
      staminaRecovered,
      goldEarned,
      canDoubleByAd: true,
    };

    this._pendingReward = reward;
    this._updateTimestamp();
    return reward;
  }

  /** 领取离线收益 */
  claimReward(doubled = false): void {
    if (!this._pendingReward) return;

    const reward = this._pendingReward;
    const multiplier = doubled ? 2 : 1;

    // 放置产出物品到棋盘
    for (const item of reward.producedItems) {
      const emptyCell = BoardManager.findEmptyOpenCell();
      if (emptyCell >= 0) {
        BoardManager.placeItem(emptyCell, item.itemId);
      }
    }

    // 恢复体力
    if (reward.staminaRecovered > 0) {
      CurrencyManager.addStamina(reward.staminaRecovered);
    }

    // 发放金币
    if (reward.goldEarned > 0) {
      CurrencyManager.addGold(reward.goldEarned * multiplier);
    }

    this._pendingReward = null;
    EventBus.emit('idle:claimed', reward, doubled);
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
      _api?.setStorageSync(IDLE_STORAGE_KEY, JSON.stringify(data));
    } catch (_) {}
  }

  private _loadState(): void {
    try {
      const raw = _api?.getStorageSync(IDLE_STORAGE_KEY);
      if (raw) {
        const data: IdleSaveData = JSON.parse(raw);
        this._lastOnlineTimestamp = data.lastOnlineTimestamp || 0;
      }
    } catch (_) {}
  }
}

export const IdleManager = new IdleManagerClass();
