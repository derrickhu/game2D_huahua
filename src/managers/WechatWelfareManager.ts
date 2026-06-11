import {
  WECHAT_WELFARE_DISMISS_COOLDOWN_MS,
  WECHAT_WELFARE_DISMISSED_UNTIL_KEY,
  WECHAT_GIFT_OPENLINK,
  WECHAT_WELFARE_NO_GIFT_DATE_KEY,
  WECHAT_WELFARE_SYNC_RETRY_DELAYS_MS,
} from '@/config/WechatWelfareConfig';
import { Platform } from '@/core/PlatformService';
import { ToastMessage } from '@/gameobjects/ui/ToastMessage';
import { WechatGiftManager } from './WechatGiftManager';

class WechatWelfareManagerClass {
  private _sessionShown = false;
  private _pageManager: any = null;
  private _retryTimers: ReturnType<typeof setTimeout>[] = [];
  private _skipNextCloseSync = false;
  private _leftAppWhileOpen = false;
  private _latestGiftStatus: { hasGift: boolean; hasFriendGift: boolean } | null = null;

  canUseNativeWelfare(): boolean {
    return Platform.isWechat
      && Platform.canOpenPageByOpenlink()
      && !!WECHAT_GIFT_OPENLINK;
  }

  didAutoShowThisSession(): boolean {
    return this._sessionShown;
  }

  tryAutoShowOnLaunch(): boolean {
    if (this._sessionShown || this._pageManager) return false;
    if (this._isNoGiftCoolingDownToday()) return false;
    if (this._isDismissCoolingDown()) return false;
    if (!this.canUseNativeWelfare()) {
      if (Platform.isDevtools) {
        console.log('[WechatWelfare] 开发者工具不支持 PageManager，请用真机预览验证福利半屏');
      }
      return false;
    }

    this._sessionShown = true;
    void this.showNativeWelfarePage('startup').catch((error) => {
      console.warn('[WechatWelfare] auto show failed:', error);
      ToastMessage.show('福利页暂时打不开，可稍后再试');
    });
    return true;
  }

  async showNativeWelfarePage(reason = 'manual'): Promise<void> {
    if (!this.canUseNativeWelfare()) {
      throw new Error('native welfare unavailable');
    }

    this._destroyPageManager();
    const pageManager = Platform.createPageManager();
    if (!pageManager) throw new Error('createPageManager unavailable');
    this._pageManager = pageManager;
    this._leftAppWhileOpen = false;
    this._latestGiftStatus = null;

    try {
      let giftStatus: { hasGift: boolean; hasFriendGift: boolean } | null = null;
      pageManager.on?.('getGiftStatus', (res: any) => {
        giftStatus = {
          hasGift: !!res?.hasGift,
          hasFriendGift: !!res?.hasFriendGift,
        };
        this._latestGiftStatus = giftStatus;
        console.log('[WechatWelfare] getGiftStatus:', giftStatus);
        if (!giftStatus.hasGift && !giftStatus.hasFriendGift) {
          this._markNoGiftToday();
          this._skipNextCloseSync = true;
          this._destroyPageManager();
        }
      });
      pageManager.on?.('destroy', () => {
        this._pageManager = null;
        if (this._skipNextCloseSync) {
          this._skipNextCloseSync = false;
          return;
        }
        this._syncAfterClose(reason, this._latestGiftStatus, this._leftAppWhileOpen);
      });

      const ret = pageManager.load?.({ openlink: WECHAT_GIFT_OPENLINK });
      if (!ret || typeof ret.then !== 'function') {
        throw new Error('PageManager.load did not return Promise');
      }
      await ret;
      if (giftStatus && !giftStatus.hasGift && !giftStatus.hasFriendGift) {
        return;
      }
      pageManager.show?.();
    } catch (error) {
      this._destroyPageManager();
      throw error;
    }
  }

  syncAfterAppShow(reason = 'app-show'): void {
    void WechatGiftManager.syncAndGrant(reason);
  }

  /** 半屏打开期间离开小游戏，通常是玩家点“完成”跳到游戏圈/任务页。 */
  notifyAppHide(): void {
    if (this._pageManager) {
      this._leftAppWhileOpen = true;
    }
  }

  private _syncAfterClose(
    reason: string,
    giftStatus: { hasGift: boolean; hasFriendGift: boolean } | null,
    leftAppWhileOpen: boolean,
  ): void {
    this._clearRetryTimers();
    void WechatGiftManager.syncAndGrant(`welfare-close:${reason}`).then((result) => {
      const hasGift = !!(giftStatus?.hasGift || giftStatus?.hasFriendGift);
      if (hasGift && !leftAppWhileOpen && !result.granted) {
        this._markDismissCooldown();
      }
    });
    for (const delay of WECHAT_WELFARE_SYNC_RETRY_DELAYS_MS) {
      const timer = setTimeout(() => {
        void WechatGiftManager.syncAndGrant(`welfare-retry:${reason}`);
      }, delay);
      this._retryTimers.push(timer);
    }
  }

  private _clearRetryTimers(): void {
    for (const timer of this._retryTimers) clearTimeout(timer);
    this._retryTimers = [];
  }

  private _destroyPageManager(): void {
    if (!this._pageManager) return;
    try {
      this._pageManager.destroy?.();
    } catch (_) {}
    this._pageManager = null;
  }

  private _todayKey(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private _isNoGiftCoolingDownToday(): boolean {
    try {
      return Platform.getStorageSync(WECHAT_WELFARE_NO_GIFT_DATE_KEY) === this._todayKey();
    } catch (_) {
      return false;
    }
  }

  private _markNoGiftToday(): void {
    try {
      Platform.setStorageSync(WECHAT_WELFARE_NO_GIFT_DATE_KEY, this._todayKey());
    } catch (_) {}
  }

  private _isDismissCoolingDown(): boolean {
    try {
      const until = Number(Platform.getStorageSync(WECHAT_WELFARE_DISMISSED_UNTIL_KEY) || 0);
      return Number.isFinite(until) && until > Date.now();
    } catch (_) {
      return false;
    }
  }

  private _markDismissCooldown(): void {
    try {
      Platform.setStorageSync(
        WECHAT_WELFARE_DISMISSED_UNTIL_KEY,
        String(Date.now() + WECHAT_WELFARE_DISMISS_COOLDOWN_MS),
      );
    } catch (_) {}
  }
}

export const WechatWelfareManager = new WechatWelfareManagerClass();
