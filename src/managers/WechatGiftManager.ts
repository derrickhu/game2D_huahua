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

const GRANTED_IDS_KEY = `${GAME_KEY}_wechat_gift_granted_ids`;
const MAX_LOCAL_GRANTED_IDS = 300;

interface GrantSummary {
  directCount: number;
  boxCount: number;
}

export interface WechatGiftSyncResult {
  granted: boolean;
  count: number;
}

class WechatGiftManagerClass {
  private _syncing = false;

  async syncAndGrant(reason = 'manual'): Promise<WechatGiftSyncResult> {
    const empty = { granted: false, count: 0 };
    if (this._syncing || !BackendService.available) return empty;
    this._syncing = true;
    try {
      const res = await BackendService.queryPendingWechatGifts();
      const gifts = Array.isArray(res.gifts) ? res.gifts : [];
      if (gifts.length === 0) return empty;

      const grantedIds = this._loadGrantedIds();
      const idsToMark: string[] = [];
      const summary: GrantSummary = { directCount: 0, boxCount: 0 };
      let changed = false;

      for (const gift of gifts) {
        if (!gift.id) continue;
        if (grantedIds.has(gift.id)) {
          idsToMark.push(gift.id);
          continue;
        }
        const didGrant = this._grantGift(gift, summary);
        if (!didGrant) continue;
        grantedIds.add(gift.id);
        idsToMark.push(gift.id);
        changed = true;
      }

      if (changed) {
        this._saveGrantedIds(grantedIds);
        SaveManager.save();
        CloudSyncManager.scheduleSync(`wechat-gift:${reason}`);
        const count = summary.directCount + summary.boxCount;
        ToastMessage.show(count > 0 ? `微信礼包已到账 ×${count}` : '微信礼包已到账', 1.6);
      }

      if (idsToMark.length > 0) {
        await BackendService.markWechatGiftsGranted(Array.from(new Set(idsToMark)));
      }
      return { granted: changed, count: summary.directCount + summary.boxCount };
    } catch (error) {
      console.warn('[WechatGift] sync failed:', error);
      return empty;
    } finally {
      this._syncing = false;
    }
  }

  private _grantGift(gift: WechatGiftRow, summary: GrantSummary): boolean {
    const rewards = gift.rewards || {};
    let didGrant = false;
    for (const [key, rawAmount] of Object.entries(rewards)) {
      const amount = Math.max(0, Math.floor(Number(rawAmount) || 0));
      if (amount <= 0) continue;

      switch (key) {
        case 'stamina':
          CurrencyManager.addStamina(amount);
          summary.directCount += amount;
          didGrant = true;
          break;
        case 'diamond':
          CurrencyManager.addDiamond(amount);
          summary.directCount += amount;
          didGrant = true;
          break;
        case 'huayuan':
          CurrencyManager.addHuayuan(amount);
          summary.directCount += amount;
          didGrant = true;
          break;
        case 'flowerSign':
          FlowerSignTicketManager.add(amount);
          summary.directCount += amount;
          didGrant = true;
          break;
        default:
          if (ITEM_DEFS.has(key)) {
            RewardBoxManager.addItem(key, amount);
            summary.boxCount += amount;
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
