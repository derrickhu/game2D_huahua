/**
 * 合成页「该去买家具了」软提醒：1 级、花愿 > 300、仅 1 件已购家具时提示一次。
 */
import { PersistService } from '@/core/PersistService';
import { TutorialManager } from '@/managers/TutorialManager';
import { LevelManager } from '@/managers/LevelManager';
import { CurrencyManager } from '@/managers/CurrencyManager';
import { DecorationManager } from '@/managers/DecorationManager';
import {
  BUY_FURNITURE_HINT_HUAYUAN_MIN,
  BUY_FURNITURE_HINT_OWNED_MAX,
  BUY_FURNITURE_HINT_PLAYER_LEVEL,
} from '@/config/BuyFurnitureHintConfig';

const STORAGE_KEY = 'huahua_buy_furniture_hint';

interface BuyFurnitureHintSave {
  dismissed?: boolean;
}

class BuyFurnitureHintManagerClass {
  private _dismissed = false;
  private _loaded = false;

  private _ensureLoaded(): void {
    if (this._loaded) return;
    try {
      const raw = PersistService.readRaw(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw) as BuyFurnitureHintSave;
        this._dismissed = !!data.dismissed;
      }
    } catch {
      this._dismissed = false;
    }
    this._loaded = true;
  }

  private _save(): void {
    PersistService.writeRaw(
      STORAGE_KEY,
      JSON.stringify({ dismissed: this._dismissed } satisfies BuyFurnitureHintSave),
    );
  }

  /** 是否满足弹出条件（不含 UI 互斥判断） */
  shouldPrompt(): boolean {
    this._ensureLoaded();
    if (this._dismissed) return false;
    if (!TutorialManager.isCompleted) return false;
    if (LevelManager.level !== BUY_FURNITURE_HINT_PLAYER_LEVEL) return false;
    if (CurrencyManager.state.huayuan <= BUY_FURNITURE_HINT_HUAYUAN_MIN) return false;
    if (DecorationManager.unlockedCount !== BUY_FURNITURE_HINT_OWNED_MAX) return false;
    return true;
  }

  markDismissed(): void {
    this._ensureLoaded();
    if (this._dismissed) return;
    this._dismissed = true;
    this._save();
  }

  /** GM / 调试：清除已提醒标记 */
  resetDismissed(): void {
    this._dismissed = false;
    this._loaded = true;
    this._save();
  }
}

export const BuyFurnitureHintManager = new BuyFurnitureHintManagerClass();
