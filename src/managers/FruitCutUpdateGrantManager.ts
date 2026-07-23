import { PersistService } from '@/core/PersistService';
import {
  FRUIT_CUT_UPDATE_GRANT_ID,
  FRUIT_CUT_UPDATE_GRANT_ITEMS,
  // FRUIT_CUT_UPDATE_GRANT_LEVEL, // 补偿关闭后暂不用
  FRUIT_CUT_UPDATE_GRANT_STORAGE_KEY,
} from '@/config/FruitCutUpdateGrantConfig';
// import { CurrencyManager } from '@/managers/CurrencyManager'; // 补偿关闭后 shouldPrompt 暂不读等级

interface FeatureGrantState {
  claimedIds?: string[];
}

class FruitCutUpdateGrantManagerClass {
  get items(): readonly { itemId: string; count: number }[] {
    return FRUIT_CUT_UPDATE_GRANT_ITEMS;
  }

  shouldPrompt(): boolean {
    // 已关闭：老玩家「鲜果上新」果切线补偿弹窗（曾用于补发农田/果切工具）
    return false;
    // return CurrencyManager.state.level >= FRUIT_CUT_UPDATE_GRANT_LEVEL && !this.isClaimed();
  }

  /**
   * 自然升星跨过 11 级时调用：升星弹窗已发同款工具，须标记已领，避免下次进主场景再弹「鲜果上新」。
   * （此前仅在 MainScene 监听 level:up，花店买家具升 11 级时会漏标。）
   */
  onStarLevelUp(_oldLevel: number, _newLevel: number): void {
    // 已关闭：与 shouldPrompt 同步停用老玩家补偿标记逻辑
    // if (_oldLevel < FRUIT_CUT_UPDATE_GRANT_LEVEL && _newLevel >= FRUIT_CUT_UPDATE_GRANT_LEVEL) {
    //   this.markClaimed();
    // }
  }

  isClaimed(): boolean {
    const state = this._loadState();
    return (state.claimedIds ?? []).includes(FRUIT_CUT_UPDATE_GRANT_ID);
  }

  markClaimed(): void {
    if (this.isClaimed()) return;
    const state = this._loadState();
    const claimedIds = new Set(state.claimedIds ?? []);
    claimedIds.add(FRUIT_CUT_UPDATE_GRANT_ID);
    PersistService.writeJSON(FRUIT_CUT_UPDATE_GRANT_STORAGE_KEY, {
      claimedIds: [...claimedIds],
    });
  }

  private _loadState(): FeatureGrantState {
    const raw = PersistService.readJSON<FeatureGrantState>(FRUIT_CUT_UPDATE_GRANT_STORAGE_KEY);
    if (!raw || !Array.isArray(raw.claimedIds)) return {};
    return {
      claimedIds: raw.claimedIds.filter(id => typeof id === 'string' && id.length > 0),
    };
  }
}

export const FruitCutUpdateGrantManager = new FruitCutUpdateGrantManagerClass();
