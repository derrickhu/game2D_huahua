import { GAME_KEY } from '@/config/CloudConfig';
import { ITEM_DEFS } from '@/config/ItemConfig';
import { BackendService, type WechatGiftRow } from '@/core/BackendService';
import { Platform } from '@/core/PlatformService';
import { ToastMessage } from '@/gameobjects/ui/ToastMessage';
import { CloudSyncManager } from './CloudSyncManager';
import { CurrencyManager } from './CurrencyManager';
import { FlowerSignTicketManager } from './FlowerSignTicketManager';
import { RewardBoxManager } from './RewardBoxManager';
import { SaveManager } from './SaveManager';
import { TutorialManager } from './TutorialManager';

const GRANTED_IDS_KEY = `${GAME_KEY}_wechat_gift_granted_ids`;
const MAX_LOCAL_GRANTED_IDS = 300;

interface GrantSummary {
  /** 本次新发放成功的礼包单数（不是奖励道具数量之和） */
  giftCount: number;
}

export interface WechatGiftSyncResult {
  granted: boolean;
  count: number;
}

class WechatGiftManagerClass {
  private _syncing = false;

  async syncAndGrant(reason = 'manual'): Promise<WechatGiftSyncResult> {
    const empty = { granted: false, count: 0 };
    if (!TutorialManager.isCompleted) return empty;
    if (this._syncing || !BackendService.available) return empty;
    this._syncing = true;
    try {
      const res = await BackendService.queryPendingWechatGifts();
      const gifts = Array.isArray(res.gifts) ? res.gifts : [];
      if (gifts.length === 0) return empty;

      const grantedIds = this._loadGrantedIds();
      const idsToMark: string[] = [];
      const summary: GrantSummary = { giftCount: 0 };
      let changed = false;

      for (const gift of gifts) {
        if (!gift.id) continue;
        if (grantedIds.has(gift.id)) {
          idsToMark.push(gift.id);
          continue;
        }
        const didGrant = this._grantGift(gift);
        if (!didGrant) continue;
        summary.giftCount += 1;
        grantedIds.add(gift.id);
        idsToMark.push(gift.id);
        changed = true;
      }

      if (changed) {
        this._saveGrantedIds(grantedIds);
        SaveManager.save();
        CloudSyncManager.scheduleSync(`wechat-gift:${reason}`);
        const n = summary.giftCount;
        ToastMessage.show(n > 1 ? `微信礼包已到账（${n} 个）` : '微信礼包已到账', 1.6);
      }

      if (idsToMark.length > 0) {
        await BackendService.markWechatGiftsGranted(Array.from(new Set(idsToMark)));
      }
      return { granted: changed, count: summary.giftCount };
    } catch (error) {
      console.warn('[WechatGift] sync failed:', error);
      return empty;
    } finally {
      this._syncing = false;
    }
  }

  private _grantGift(gift: WechatGiftRow): boolean {
    const rewards = gift.rewards || {};
    let didGrant = false;
    for (const [key, rawAmount] of Object.entries(rewards)) {
      const amount = Math.max(0, Math.floor(Number(rawAmount) || 0));
      if (amount <= 0) continue;

      switch (key) {
        case 'stamina':
          CurrencyManager.addStamina(amount);
          didGrant = true;
          break;
        case 'diamond':
          CurrencyManager.addDiamond(amount);
          didGrant = true;
          break;
        case 'huayuan':
          CurrencyManager.addHuayuan(amount);
          didGrant = true;
          break;
        case 'flowerSign':
          FlowerSignTicketManager.add(amount);
          didGrant = true;
          break;
        default:
          if (ITEM_DEFS.has(key)) {
            RewardBoxManager.addItem(key, amount);
            didGrant = true;
          } else {
            console.warn('[WechatGift] unknown reward key:', key, amount, gift.orderId);
          }
          break;
      }
    }
    return didGrant;
  }

  private _loadGrantedIds(): Set<string> {
    try {
      const raw = Platform.getStorageSync(GRANTED_IDS_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(arr) ? arr.map(v => String(v || '')).filter(Boolean) : []);
    } catch (_) {
      return new Set();
    }
  }

  private _saveGrantedIds(ids: Set<string>): void {
    try {
      const arr = Array.from(ids).slice(-MAX_LOCAL_GRANTED_IDS);
      Platform.setStorageSync(GRANTED_IDS_KEY, JSON.stringify(arr));
    } catch (_) {}
  }
}

export const WechatGiftManager = new WechatGiftManagerClass();
