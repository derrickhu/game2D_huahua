import { CurrencyState } from './CurrencyManager';
import { storage } from '../utils/platform';

export interface SaveData {
  version: number;
  timestamp: number;
  currency: CurrencyState;
  board: any;  // Board.serialize() 的输出
  idle: {
    lastActiveTime: number;
  };
}

const SAVE_KEY = 'huahua_save';

export class SaveManager {
  static save(data: SaveData): void {
    data.timestamp = Date.now();
    data.version = 1;
    try {
      const json = JSON.stringify(data);
      storage.setItem(SAVE_KEY, json);
    } catch (e) {
      console.error('Save failed:', e);
    }
  }

  static load(): SaveData | null {
    try {
      const json = storage.getItem(SAVE_KEY);
      if (!json) return null;
      const data = JSON.parse(json) as SaveData;
      return data;
    } catch (e) {
      console.error('Load failed:', e);
      return null;
    }
  }

  static clear(): void {
    storage.removeItem(SAVE_KEY);
  }
}
