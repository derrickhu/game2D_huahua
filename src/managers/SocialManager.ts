/**
 * 社交系统管理器
 *
 * 功能：
 * - 好友花店互访（分享卡片链接）
 * - 花语卡片分享
 *
 * 注意：微信和抖音的社交 API 差异较大，
 * 本模块提供统一接口，平台特有逻辑内部适配。
 */
import { EventBus } from '@/core/EventBus';
import { PersistService } from '@/core/PersistService';
import {
  createDefaultShare,
  createFlowerCardShare,
  createShopInviteShare,
} from '@/config/ShareConfig';
import { setupWechatShare, shareAppMessageWithAnalytics } from '@/utils/wechatShare';
import { CurrencyManager } from './CurrencyManager';
import { CollectionManager } from './CollectionManager';
import type { FlowerCard } from './FlowerCardManager';

const STORAGE_KEY = 'huahua_social';

interface SocialSave {
  lastShareTime: number;
  totalShares: number;
}

class SocialManagerClass {
  private _lastShareTime = 0;
  private _totalShares = 0;

  init(): void {
    this._loadState();
    this._setupShareMenu();
  }

  /**
   * 注册分享菜单（兼带经分埋点）。
   * 走 wechatShare 工具统一上报，被动分享回调里区分 wx_button/wx_menu/wx_other/wx_timeline，
   * 朋友圈分享走独立事件 share_timeline。
   */
  private _setupShareMenu(): void {
    setupWechatShare(() => createDefaultShare(
      CurrencyManager.state.level,
      CollectionManager.totalDiscovered,
    ));
  }

  // ═══════════════ 分享 ═══════════════

  /** 分享花店 */
  shareShop(): void {
    shareAppMessageWithAnalytics(
      createShopInviteShare(CurrencyManager.state.level),
      'shop_invite',
    );
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
  shareFlowerCard(card: FlowerCard): void {
    shareAppMessageWithAnalytics(
      createFlowerCardShare(card),
      'flower_card',
      { card_id: String(card.id ?? '') },
    );
    this._totalShares++;
    this._saveState();
    EventBus.emit('social:shared', 'flowerCard');
  }

  get totalShares(): number { return this._totalShares; }

  // ═══════════════ 存档 ═══════════════

  private _saveState(): void {
    const data: SocialSave = {
      lastShareTime: this._lastShareTime,
      totalShares: this._totalShares,
    };
    PersistService.writeRaw(STORAGE_KEY, JSON.stringify(data));
  }

  private _loadState(): void {
    try {
      const raw = PersistService.readRaw(STORAGE_KEY);
      if (!raw) return;
      const data: SocialSave = JSON.parse(raw);
      this._lastShareTime = data.lastShareTime || 0;
      this._totalShares = data.totalShares || 0;
    } catch (_) {}
  }
}

export const SocialManager = new SocialManagerClass();
