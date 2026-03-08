/**
 * 存档管理器
 *
 * 使用基于棋盘配置的自动指纹校验：配置变更后存档自动失效，无需手动改版本号。
 */

import { BoardManager } from './BoardManager';
import { CurrencyManager } from './CurrencyManager';
import { BOARD_TOTAL } from '@/config/Constants';
import { BOARD_PRESETS } from '@/config/BoardLayout';
import { ITEM_DEFS } from '@/config/ItemConfig';

declare const wx: any;
declare const tt: any;
const _api = typeof wx !== 'undefined' ? wx : typeof tt !== 'undefined' ? tt : null;

const SAVE_SLOT = 'huahua_save';
const AUTO_SAVE_INTERVAL = 30;

/**
 * 根据棋盘预设和物品配置生成指纹字符串。
 * 任何格子/物品配置变更都会导致指纹不同，从而自动使旧存档失效。
 */
function _computeConfigFingerprint(): string {
  const parts: string[] = [];
  for (const p of BOARD_PRESETS) {
    parts.push(`${p.row},${p.col},${p.state},${p.itemId ?? '-'},${p.keyPrice}`);
  }
  parts.push(`|items:${ITEM_DEFS.size}`);
  parts.push(`|total:${BOARD_TOTAL}`);
  const raw = parts.join(';');

  // 简单 djb2 哈希，生成短字符串
  let hash = 5381;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) + hash + raw.charCodeAt(i)) | 0;
  }
  return 'fp_' + (hash >>> 0).toString(36);
}

const CONFIG_FINGERPRINT = _computeConfigFingerprint();

interface SaveData {
  fingerprint: string;
  timestamp: number;
  currency: ReturnType<typeof CurrencyManager.exportState>;
  board: ReturnType<typeof BoardManager.exportState>;
}

class SaveManagerClass {
  private _lastSave = 0;

  save(): void {
    const data: SaveData = {
      fingerprint: CONFIG_FINGERPRINT,
      timestamp: Date.now(),
      currency: CurrencyManager.exportState(),
      board: BoardManager.exportState(),
    };

    try {
      _api?.setStorageSync(SAVE_SLOT, JSON.stringify(data));
      console.log('[Save] 存档成功, fingerprint:', CONFIG_FINGERPRINT);
    } catch (e) {
      console.error('[Save] 存档失败:', e);
    }
  }

  load(): boolean {
    try {
      const raw = _api?.getStorageSync(SAVE_SLOT);
      if (!raw) return false;

      const data: SaveData = JSON.parse(raw);

      // 指纹校验：配置变更后旧存档自动失效
      if (data.fingerprint !== CONFIG_FINGERPRINT) {
        console.warn('[Save] 配置指纹不匹配，旧存档已失效',
          '(存档:', data.fingerprint, '当前:', CONFIG_FINGERPRINT, ')');
        this._clearStorage();
        return false;
      }

      if (!Array.isArray(data.board) || data.board.length !== BOARD_TOTAL) {
        console.warn('[Save] 棋盘规格不匹配，跳过读档');
        this._clearStorage();
        return false;
      }

      // 清理存档中引用了已不存在物品ID的格子（防止脏数据）
      for (const cell of data.board) {
        if (cell.itemId && !ITEM_DEFS.has(cell.itemId)) {
          console.warn('[Save] 无效物品ID已清理:', cell.itemId);
          cell.itemId = null;
        }
      }

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

  /** 清除旧存档 */
  private _clearStorage(): void {
    try {
      _api?.removeStorageSync(SAVE_SLOT);
      // 同时清理历史遗留的带版本号的 key
      for (let v = 1; v <= 10; v++) {
        try { _api?.removeStorageSync(`huahua_save_v${v}`); } catch (_) {}
      }
    } catch (_) {}
  }
}

export const SaveManager = new SaveManagerClass();
