/**
 * 新手大礼包「清涟荷影」：教程完成后可看激励视频累计领取
 */
import { EventBus } from '@/core/EventBus';
import { PersistService } from '@/core/PersistService';
import { TutorialManager } from '@/managers/TutorialManager';
import { DecorationManager } from '@/managers/DecorationManager';
import { RewardBoxManager } from '@/managers/RewardBoxManager';
import { grantQuest } from '@/utils/UnlockChecker';
import {
  NEWBIE_GIFT_PACK_ADS_REQUIRED,
  NEWBIE_GIFT_PACK_BOARD_GRANTS,
  NEWBIE_GIFT_PACK_QUEST_ID,
  NEWBIE_GIFT_PACK_ROOM_STYLE_ID,
  QINGLIAN_NEWBIE_DECO_IDS,
} from '@/config/NewbieGiftPackConfig';

const STORAGE_KEY = 'huahua_newbie_gift_pack';

interface NewbieGiftPackSave {
  adsWatched: number;
  claimed: boolean;
  /** 是否已在花坊自动弹过一次宣传页（避免与签到等同屏挤在一起） */
  introPromptShown?: boolean;
}

class NewbieGiftPackManagerClass {
  private _adsWatched = 0;
  private _claimed = false;
  private _introPromptShown = false;
  private _loaded = false;

  private _ensureLoaded(): void {
    if (this._loaded) return;
    this._loadState();
    this._loaded = true;
  }

  get adsRequired(): number {
    return NEWBIE_GIFT_PACK_ADS_REQUIRED;
  }

  get adsWatched(): number {
    this._ensureLoaded();
    return this._adsWatched;
  }

  get claimed(): boolean {
    this._ensureLoaded();
    return this._claimed;
  }

  get isAvailable(): boolean {
    this._ensureLoaded();
    return TutorialManager.isCompleted && !this._claimed;
  }

  get canWatchAd(): boolean {
    return this.isAvailable && this._adsWatched < NEWBIE_GIFT_PACK_ADS_REQUIRED;
  }

  /** 广告次数已满、尚未点「领取」 */
  get canClaim(): boolean {
    this._ensureLoaded();
    return this.isAvailable && this._adsWatched >= NEWBIE_GIFT_PACK_ADS_REQUIRED;
  }

  get shouldShowEntry(): boolean {
    return this.isAvailable;
  }

  /** 教程完成后首次进入花坊时自动弹出宣传页 */
  get shouldAutoOpenOnShopEnter(): boolean {
    this._ensureLoaded();
    return this.isAvailable && !this._introPromptShown;
  }

  reloadFromStorage(): void {
    this._adsWatched = 0;
    this._claimed = false;
    this._introPromptShown = false;
    this._loaded = false;
    this._ensureLoaded();
  }

  markIntroPromptShown(): void {
    this._ensureLoaded();
    if (this._introPromptShown) return;
    this._introPromptShown = true;
    this._save();
  }

  /**
   * 老号/云档补偿：礼包领取状态可能早于清涟房壳入库，或云端缺少装修 key。
   * 只要确认礼包已领，就重新确认「条件标记 + 家具 + 房壳」存在。
   */
  reconcileClaimedRewards(reason = 'manual'): boolean {
    this._ensureLoaded();
    this._inferClaimedFromDecoration();
    if (!this._claimed) return false;

    grantQuest(NEWBIE_GIFT_PACK_QUEST_ID);

    let changed = false;
    for (const id of QINGLIAN_NEWBIE_DECO_IDS) {
      changed = DecorationManager.gmUnlockDeco(id) || changed;
    }
    changed = DecorationManager.gmUnlockRoomStyle(NEWBIE_GIFT_PACK_ROOM_STYLE_ID) || changed;

    if (changed) {
      console.log(`[NewbieGiftPack] 已补齐清涟荷影礼包装修奖励 reason=${reason}`);
    }
    return changed;
  }

  /** 激励视频观看成功：仅累计次数，不自动发奖 */
  onAdSuccess(): void {
    this._ensureLoaded();
    if (!this.canWatchAd) return;
    this._adsWatched += 1;
    this._save();
    EventBus.emit('newbieGiftPack:progress', this._adsWatched);
  }

  claim(): boolean {
    this._ensureLoaded();
    if (this._claimed) return false;
    if (this._adsWatched < NEWBIE_GIFT_PACK_ADS_REQUIRED) return false;

    for (const id of QINGLIAN_NEWBIE_DECO_IDS) {
      DecorationManager.gmUnlockDeco(id);
    }
    DecorationManager.gmUnlockRoomStyle(NEWBIE_GIFT_PACK_ROOM_STYLE_ID);
    grantQuest(NEWBIE_GIFT_PACK_QUEST_ID);

    for (const g of NEWBIE_GIFT_PACK_BOARD_GRANTS) {
      RewardBoxManager.addItem(g.itemId, g.count);
    }

    this._claimed = true;
    this._save();
    EventBus.emit('newbieGiftPack:claimed');
    console.log('[NewbieGiftPack] 已领取清涟荷影新手礼包');
    return true;
  }

  /** GM：重置领取进度 */
  gmReset(): void {
    this._adsWatched = 0;
    this._claimed = false;
    this._introPromptShown = false;
    this._loaded = true;
    PersistService.remove(STORAGE_KEY);
    EventBus.emit('newbieGiftPack:progress', 0);
  }

  private _save(): void {
    const data: NewbieGiftPackSave = {
      adsWatched: this._adsWatched,
      claimed: this._claimed,
      introPromptShown: this._introPromptShown,
    };
    PersistService.writeRaw(STORAGE_KEY, JSON.stringify(data));
  }

  private _loadState(): void {
    try {
      const raw = PersistService.readRaw(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw) as NewbieGiftPackSave;
      this._adsWatched = Math.max(0, Number(data.adsWatched) || 0);
      this._claimed = Boolean(data.claimed);
      this._introPromptShown = Boolean(data.introPromptShown);
      if (this._claimed) {
        this._adsWatched = Math.max(this._adsWatched, NEWBIE_GIFT_PACK_ADS_REQUIRED);
      }
    } catch (_) {
      /* ignore */
    }
  }

  private _inferClaimedFromDecoration(): void {
    if (this._claimed) return;
    const hasAllGiftDecos = QINGLIAN_NEWBIE_DECO_IDS.every(id => DecorationManager.isUnlocked(id));
    const hasGiftRoomStyle = DecorationManager.isRoomStyleUnlocked(NEWBIE_GIFT_PACK_ROOM_STYLE_ID);
    if (!hasAllGiftDecos && !hasGiftRoomStyle) return;

    this._claimed = true;
    this._adsWatched = Math.max(this._adsWatched, NEWBIE_GIFT_PACK_ADS_REQUIRED);
    this._save();
    console.log('[NewbieGiftPack] 已从装修存档反推礼包领取状态');
  }
}

export const NewbieGiftPackManager = new NewbieGiftPackManagerClass();
