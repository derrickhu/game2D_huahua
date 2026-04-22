/**
 * 离线挂机收益系统
 *
 * 离线期间按规则产出收纳框物品 + 花愿；体力自然回复在读档时由 CurrencyManager
 * 按存档 timestamp 与 STAMINA_RECOVER_INTERVAL 结算，与在线 ticker 规则一致。
 * 回归时展示「离线收益报告」。
 *
 * 「开店糖果」（DailyCandy）已收敛为本面板的**附赠尾巴**：
 *  - 只在「离线产出 ≥60s」或「有熟客留言」时附赠，避免与签到面板争抢"日活登录奖励"心智位
 *  - 取的是 previewTodayCandy（不写状态）；玩家点「领取」才调用 markConsumed 落档，
 *    防止弹窗后崩溃 / 用户秒退导致当日次数被白白占用
 *
 * 是否参与启动流程由 `Constants.OFFLINE_REWARD_UI_ENABLED` 控制；关闭时本类仍负责时间戳同步，便于日后活动/推送等复用。
 */
import { EventBus } from '@/core/EventBus';
import { PersistService } from '@/core/PersistService';
import { BoardManager } from './BoardManager';
import { CurrencyManager } from './CurrencyManager';
import { RewardBoxManager } from './RewardBoxManager';
import { FlowerSignTicketManager } from './FlowerSignTicketManager';
import { AffinityManager } from './AffinityManager';
import { DailyCandyManager, type DailyCandyPayload } from './DailyCandyManager';
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

export interface OfflineAffinityNote {
  typeId: string;
  bondName: string;
  bondLabel: string;
  bondLevel: number;
  text: string;
}

export interface OfflineReward {
  /** 离线时长（秒） */
  offlineSeconds: number;
  /** 产出的物品 [{itemId, name}] */
  producedItems: { itemId: string; name: string }[];
  /** 花愿（体力不计入本面板，由 SaveManager 读档时单独结算） */
  huayuanEarned: number;
  /** 熟客离线留言（已解锁的熟客中按混合规则抽签；未解锁则 null） */
  affinityNote: OfflineAffinityNote | null;
  /**
   * 「开店糖果」（每日首次进店礼包）；当日已领过为 null。
   * 入账与否在 OfflineRewardPanel.claim 时统一通过 IdleManager.claimReward 走流程。
   */
  dailyCandy: DailyCandyPayload | null;
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

    const isFirstLaunch = this._lastOnlineTimestamp <= 0;

    const now = Date.now();
    const offlineMs = isFirstLaunch ? 0 : now - this._lastOnlineTimestamp;
    const offlineSeconds = Math.max(0, Math.floor(offlineMs / 1000));

    // 离线上限（首次进入按 0 计）
    const maxSeconds = OFFLINE_MAX_HOURS * 3600;
    const effectiveSeconds = Math.min(offlineSeconds, maxSeconds);
    const offlineQualifies = effectiveSeconds >= 60;

    // 离线产出（仅离线 >= 60s 才计算）
    const producedItems: { itemId: string; name: string }[] = [];
    let huayuanEarned = 0;
    if (offlineQualifies) {
      const permBuildingCount = this._countPermanentBuildings();
      const produceCount = Math.floor(effectiveSeconds / IDLE_PRODUCE_INTERVAL) * Math.max(1, permBuildingCount);
      const cappedCount = Math.min(produceCount, 8);
      for (let i = 0; i < cappedCount; i++) {
        const itemId = this._randomIdleItem();
        if (itemId) {
          const def = ITEM_DEFS.get(itemId);
          producedItems.push({ itemId, name: def?.name || itemId });
        }
      }
      huayuanEarned = Math.floor(effectiveSeconds / OFFLINE_HUAYUAN_INTERVAL_SEC);
    }

    // 熟客留言（无解锁则 null）
    const affinityNote = AffinityManager.pickRandomAffinityNote();

    // 当日开店糖果：仅在已有「离线产出」或「熟客留言」需要弹面板时**附赠**；
    // 不再独立撑起弹窗，避免与签到面板形成两连弹与日活奖励重叠。
    // previewTodayCandy 不写状态，玩家点领取后由 claimReward 调 markConsumed 落档。
    const dailyCandy = (offlineQualifies || affinityNote)
      ? DailyCandyManager.previewTodayCandy()
      : null;

    // 三块全空 → 不弹面板
    if (!offlineQualifies && !affinityNote && !dailyCandy) {
      this._updateTimestamp();
      return null;
    }

    const reward: OfflineReward = {
      offlineSeconds: effectiveSeconds,
      producedItems,
      huayuanEarned,
      affinityNote,
      dailyCandy,
    };

    this._pendingReward = reward;
    this._updateTimestamp();
    return reward;
  }

  /** 领取离线收益（含当日开店糖果） */
  claimReward(): void {
    if (!this._pendingReward) return;

    const reward = this._pendingReward;

    for (const item of reward.producedItems) {
      RewardBoxManager.addItem(item.itemId);
    }

    if (reward.huayuanEarned > 0) {
      CurrencyManager.addHuayuan(reward.huayuanEarned);
    }

    // 当日开店糖果：基础包 + 随机彩蛋（连签里程碑已下线，统一交给签到）
    if (reward.dailyCandy) {
      const dc = reward.dailyCandy;
      if (dc.base.huayuan > 0) CurrencyManager.addHuayuan(dc.base.huayuan);
      if (dc.base.stamina > 0) CurrencyManager.addStamina(dc.base.stamina);
      if (dc.base.diamond > 0) CurrencyManager.addDiamond(dc.base.diamond);

      const b = dc.bonus;
      if (b.huayuan) CurrencyManager.addHuayuan(b.huayuan);
      if (b.stamina) CurrencyManager.addStamina(b.stamina);
      if (b.flowerSignTickets) FlowerSignTicketManager.add(b.flowerSignTickets);
      if (b.rewardBoxItem) {
        RewardBoxManager.addItem(b.rewardBoxItem.itemId, b.rewardBoxItem.count);
      }

      // 真正发完才落档「今日已领」（防 previewTodayCandy 后未领取就被占次）
      DailyCandyManager.markConsumed(dc);
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
