/**
 * 存档管理器
 */

import { BoardManager } from './BoardManager';
import { CurrencyManager } from './CurrencyManager';

declare const wx: any;
declare const tt: any;
const _api = typeof wx !== 'undefined' ? wx : typeof tt !== 'undefined' ? tt : null;

const SAVE_KEY = 'huahua_save_v1';
const AUTO_SAVE_INTERVAL = 30; // 30秒自动存档

interface SaveData {
  version: number;
  timestamp: number;
  currency: ReturnType<typeof CurrencyManager.exportState>;
  board: ReturnType<typeof BoardManager.exportState>;
}

class SaveManagerClass {
  private _lastSave = 0;

  save(): void {
    const data: SaveData = {
      version: 1,
      timestamp: Date.now(),
      currency: CurrencyManager.exportState(),
      board: BoardManager.exportState(),
    };

    try {
      _api?.setStorageSync(SAVE_KEY, JSON.stringify(data));
      console.log('[Save] 存档成功');
    } catch (e) {
      console.error('[Save] 存档失败:', e);
    }
  }

  load(): boolean {
    try {
      const raw = _api?.getStorageSync(SAVE_KEY);
      if (!raw) return false;

      const data: SaveData = JSON.parse(raw);
      if (data.version !== 1) return false;

      CurrencyManager.loadState(data.currency);
      BoardManager.loadState(data.board);

      console.log('[Save] 读档成功, 距上次存档:', Math.round((Date.now() - data.timestamp) / 1000), '秒');
      return true;
    } catch (e) {
      console.error('[Save] 读档失败:', e);
      return false;
    }
  }

  /** 每帧调用，处理自动存档 */
  update(dt: number): void {
    this._lastSave += dt;
    if (this._lastSave >= AUTO_SAVE_INTERVAL) {
      this._lastSave = 0;
      this.save();
    }
  }
}

export const SaveManager = new SaveManagerClass();
