/**
 * 社交系统管理器
 *
 * 功能：
 * - 好友花店互访（分享卡片链接）
 * - 互赠体力（每日限3次）
 * - 排行榜（花店等级/收集进度/装修进度）
 * - 花语卡片分享
 *
 * 注意：微信和抖音的社交 API 差异较大，
 * 本模块提供统一接口，平台特有逻辑内部适配。
 */
import { EventBus } from '@/core/EventBus';
import { Platform } from '@/core/PlatformService';
import { CurrencyManager } from './CurrencyManager';
import { CollectionManager } from './CollectionManager';

const STORAGE_KEY = 'huahua_social';

/** 排行榜类型 */
export enum LeaderboardType {
  LEVEL = 'level',               // 花店等级
  COLLECTION = 'collection',      // 收集进度
  DECORATION = 'decoration',      // 装修进度
}

/** 排行榜条目 */
export interface LeaderboardEntry {
  rank: number;
  nickname: string;
  avatarUrl: string;
  score: number;
  isSelf: boolean;
}

/** 社交好友 */
export interface SocialFriend {
  openId: string;
  nickname: string;
  avatarUrl: string;
  level: number;
  lastVisit: number;
}

/** 每日互赠限制 */
const DAILY_GIFT_LIMIT = 3;
const GIFT_STAMINA_AMOUNT = 5;

interface SocialSave {
  giftCountToday: number;
  giftReceivedToday: number;
  lastGiftDate: string;
  lastShareTime: number;
  totalShares: number;
}

class SocialManagerClass {
  private _giftCountToday = 0;
  private _giftReceivedToday = 0;
  private _lastGiftDate = '';
  private _lastShareTime = 0;
  private _totalShares = 0;

  init(): void {
    this._loadState();
    this._setupShareMenu();
    console.log(`[Social] 初始化完成`);
  }

  /** 注册分享菜单 */
  private _setupShareMenu(): void {
    Platform.onShareAppMessage(() => ({
      title: '🌸 来看看我的花花妙屋！每朵花都有一段美丽的故事~',
      query: `invite=true&level=${CurrencyManager.state.level}`,
    }));

    Platform.onShareTimeline(() => ({
      title: `花花妙屋 Lv.${CurrencyManager.state.level} | 已收集 ${CollectionManager.totalDiscovered} 种花草 🌸`,
    }));
  }

  // ═══════════════ 分享 ═══════════════

  /** 分享花店 */
  shareShop(): void {
    Platform.shareAppMessage({
      title: `🌸 花花妙屋 Lv.${CurrencyManager.state.level}，快来看看~`,
      query: `visit=true&level=${CurrencyManager.state.level}`,
    });
    this._totalShares++;
    this._lastShareTime = Date.now();
    this._saveState();
    EventBus.emit('social:shared', 'shop');
  }

  /** 分享到朋友圈 */
  shareTimeline(): void {
    // 朋友圈分享在微信中通过 onShareTimeline 被动触发
    this._totalShares++;
    this._saveState();
    EventBus.emit('social:shared', 'timeline');
  }

  /** 分享花语卡片 */
  shareFlowerCard(cardId: string, cardName: string, quote: string): void {
    Platform.shareAppMessage({
      title: `🌸 ${cardName} —— ${quote}`,
      query: `card=${cardId}`,
    });
    this._totalShares++;
    this._saveState();
    EventBus.emit('social:shared', 'flowerCard');
  }

  // ═══════════════ 互赠体力 ═══════════════

  /** 今日剩余赠送次数 */
  get giftRemaining(): number {
    this._checkDailyReset();
    return DAILY_GIFT_LIMIT - this._giftCountToday;
  }

  /** 赠送体力（调用后需平台确认是否成功送达） */
  sendGift(): boolean {
    this._checkDailyReset();
    if (this._giftCountToday >= DAILY_GIFT_LIMIT) return false;

    this._giftCountToday++;
    this._saveState();

    // 发送给好友（通过分享/社交关系链）
    Platform.shareAppMessage({
      title: `🎁 花花妙屋好友送你 ${GIFT_STAMINA_AMOUNT} 点体力！`,
      query: `gift=stamina&amount=${GIFT_STAMINA_AMOUNT}`,
    });

    EventBus.emit('social:giftSent', GIFT_STAMINA_AMOUNT);
    return true;
  }

  /** 领取好友赠送的体力 */
  receiveGift(amount: number): void {
    this._checkDailyReset();
    CurrencyManager.addStamina(amount);
    this._giftReceivedToday++;
    this._saveState();
    EventBus.emit('social:giftReceived', amount);
  }

  // ═══════════════ 排行榜 ═══════════════

  /** 获取玩家当前各排行榜分数 */
  getMyScores(): Record<LeaderboardType, number> {
    return {
      [LeaderboardType.LEVEL]: CurrencyManager.state.level,
      [LeaderboardType.COLLECTION]: CollectionManager.totalDiscovered,
      [LeaderboardType.DECORATION]: 0, // 由 DecorationManager 提供
    };
  }

  /** 上报分数到开放数据域（微信特有） */
  submitScore(type: LeaderboardType, score: number): void {
    if (Platform.name !== 'wechat') return;

    try {
      const api = Platform.api;
      if (!api?.setUserCloudStorage) return;

      const key = `huahua_${type}`;
      api.setUserCloudStorage({
        KVDataList: [{ key, value: String(score) }],
        success: () => console.log(`[Social] 上报排行榜 ${type}=${score}`),
        fail: (err: any) => console.warn(`[Social] 上报失败:`, err),
      });
    } catch (_) {}
  }

  /**
   * 获取排行榜数据
   * 注意：微信排行榜数据在开放数据域中，需要通过子域 canvas 显示。
   * 本方法返回模拟数据，真实排行榜需要配合 wx.getOpenDataContext() 实现。
   */
  getLeaderboard(_type: LeaderboardType): LeaderboardEntry[] {
    const myScore = this.getMyScores();
    // 模拟数据（真实环境从开放数据域获取）
    return [
      { rank: 1, nickname: '花花妙屋玩家', avatarUrl: '', score: myScore[_type] || 0, isSelf: true },
    ];
  }

  /** 获取排行榜名称 */
  getLeaderboardName(type: LeaderboardType): string {
    switch (type) {
      case LeaderboardType.LEVEL: return '🏆 花店等级榜';
      case LeaderboardType.COLLECTION: return '📖 收集进度榜';
      case LeaderboardType.DECORATION: return '🏠 装修进度榜';
    }
  }

  // ═══════════════ 工具 ═══════════════

  get totalShares(): number { return this._totalShares; }

  private _checkDailyReset(): void {
    const today = new Date().toISOString().slice(0, 10);
    if (today !== this._lastGiftDate) {
      this._lastGiftDate = today;
      this._giftCountToday = 0;
      this._giftReceivedToday = 0;
    }
  }

  // ═══════════════ 存档 ═══════════════

  private _saveState(): void {
    const data: SocialSave = {
      giftCountToday: this._giftCountToday,
      giftReceivedToday: this._giftReceivedToday,
      lastGiftDate: this._lastGiftDate,
      lastShareTime: this._lastShareTime,
      totalShares: this._totalShares,
    };
    Platform.setStorageSync(STORAGE_KEY, JSON.stringify(data));
  }

  private _loadState(): void {
    try {
      const raw = Platform.getStorageSync(STORAGE_KEY);
      if (!raw) return;
      const data: SocialSave = JSON.parse(raw);
      Object.assign(this, {
        _giftCountToday: data.giftCountToday || 0,
        _giftReceivedToday: data.giftReceivedToday || 0,
        _lastGiftDate: data.lastGiftDate || '',
        _lastShareTime: data.lastShareTime || 0,
        _totalShares: data.totalShares || 0,
      });
    } catch (_) {}
  }
}

export const SocialManager = new SocialManagerClass();
