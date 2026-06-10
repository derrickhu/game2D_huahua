import { PersistService } from '@/core/PersistService';
import {
  FRUIT_CUT_UPDATE_GRANT_ID,
  FRUIT_CUT_UPDATE_GRANT_ITEMS,
  FRUIT_CUT_UPDATE_GRANT_LEVEL,
  FRUIT_CUT_UPDATE_GRANT_STORAGE_KEY,
} from '@/config/FruitCutUpdateGrantConfig';
import { CurrencyManager } from '@/managers/CurrencyManager';

interface FeatureGrantState {
  claimedIds?: string[];
}

class FruitCutUpdateGrantManagerClass {
  get items(): readonly { itemId: string; count: number }[] {
    return FRUIT_CUT_UPDATE_GRANT_ITEMS;
  }

  shouldPrompt(): boolean {
    return CurrencyManager.state.level >= FRUIT_CUT_UPDATE_GRANT_LEVEL && !this.isClaimed();
  }

  isClaimed(): boolean {
    const state = this._loadState();
    return (state.claimedIds ?? []).includes(FRUIT_CUT_UPDATE_GRANT_ID);
  }

  markClaimed(): void {
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
