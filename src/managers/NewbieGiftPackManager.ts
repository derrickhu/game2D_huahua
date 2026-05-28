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
}

class NewbieGiftPackManagerClass {
  private _adsWatched = 0;
  private _claimed = false;
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

  get shouldShowEntry(): boolean {
    return this.isAvailable;
  }

  onAdSuccess(): boolean {
    this._ensureLoaded();
    if (!this.canWatchAd) return false;
    this._adsWatched += 1;
    this._save();
    EventBus.emit('newbieGiftPack:progress', this._adsWatched);
    if (this._adsWatched >= NEWBIE_GIFT_PACK_ADS_REQUIRED) {
      this.claim();
      return true;
    }
    return false;
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
    this._loaded = true;
    PersistService.remove(STORAGE_KEY);
    EventBus.emit('newbieGiftPack:progress', 0);
  }

  private _save(): void {
    const data: NewbieGiftPackSave = {
      adsWatched: this._adsWatched,
      claimed: this._claimed,
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
    } catch (_) {
      /* ignore */
    }
  }
}

export const NewbieGiftPackManager = new NewbieGiftPackManagerClass();
