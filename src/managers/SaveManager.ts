/**
 * 存档管理器
 *
 * 指纹策略：基于棋盘布局结构（格子数/位置/状态/钥匙价格）生成指纹。
 * - 布局变化 → 指纹变化 → 旧存档自动清除
 * - 物品配置变化（新增/删除物品）→ 指纹不变 → 存档保留，无效物品ID自动清理
 */

import { BoardManager } from './BoardManager';
import { CurrencyManager } from './CurrencyManager';
import { WarehouseManager, WarehouseState } from './WarehouseManager';
import { BOARD_TOTAL } from '@/config/Constants';
import { BOARD_PRESETS } from '@/config/BoardLayout';
import { ITEM_DEFS } from '@/config/ItemConfig';

declare const wx: any;
declare const tt: any;
const _api = typeof wx !== 'undefined' ? wx : typeof tt !== 'undefined' ? tt : null;

const SAVE_SLOT = 'huahua_save';
const AUTO_SAVE_INTERVAL = 30;

/**
 * 计算棋盘布局指纹（仅基于棋盘格数，不含物品定义数量）。
 * 只有棋盘结构本身变化才导致存档不兼容。
 * 物品配置变化（新增/删除物品）通过软迁移处理，不丢弃整个存档。
 */
function _computeConfigFingerprint(): string {
  const parts: string[] = [];
  for (const p of BOARD_PRESETS) {
    parts.push(`${p.row},${p.col},${p.state},${p.keyPrice}`);
  }
  parts.push(`|total:${BOARD_TOTAL}`);
  const raw = parts.join(';');

  let hash = 5381;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) + hash + raw.charCodeAt(i)) | 0;
  }
  return 'fp2_' + (hash >>> 0).toString(36);
}

const CONFIG_FINGERPRINT = _computeConfigFingerprint();

interface SaveData {
  fingerprint: string;
  timestamp: number;
  version: number;
  currency: ReturnType<typeof CurrencyManager.exportState>;
  board: ReturnType<typeof BoardManager.exportState>;
  warehouse?: WarehouseState;
}

class SaveManagerClass {
  private _lastSave = 0;

  save(): void {
    const data: SaveData = {
      fingerprint: CONFIG_FINGERPRINT,
      timestamp: Date.now(),
      version: 2,
      currency: CurrencyManager.exportState(),
      board: BoardManager.exportState(),
      warehouse: WarehouseManager.exportState(),
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

      // 棋盘规格校验（存档格数必须一致）
      if (!Array.isArray(data.board) || data.board.length !== BOARD_TOTAL) {
        console.warn('[Save] 棋盘规格不匹配，跳过读档');
        this._clearStorage();
        return false;
      }

      // 指纹校验
      if (data.fingerprint !== CONFIG_FINGERPRINT) {
        // 旧版指纹(fp_xxx)的存档 → 结构不兼容，必须清除
        // 同版指纹(fp2_xxx)但值不同 → 棋盘布局已变，也必须清除
        console.warn('[Save] 指纹不匹配，清除旧存档',
          '(存档:', data.fingerprint, '当前:', CONFIG_FINGERPRINT, ')');
        this._clearStorage();
        return false;
      }

      // 清理存档中引用了已不存在物品ID的格子（物品配置变化时的软迁移）
      let cleanedCount = 0;
      for (const cell of data.board) {
        if (cell.itemId && !ITEM_DEFS.has(cell.itemId)) {
          console.warn('[Save] 无效物品ID已清理:', cell.itemId);
          cell.itemId = null;
          cleanedCount++;
        }
      }
      if (cleanedCount > 0) {
        console.log(`[Save] 软迁移完成，清理了 ${cleanedCount} 个无效物品`);
      }

      CurrencyManager.loadState(data.currency);
      BoardManager.loadState(data.board);
      if (data.warehouse) {
        WarehouseManager.loadState(data.warehouse);
      }

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

  /** 清除所有游戏数据（用于测试/重置） */
  clearAllData(): void {
    try {
      // 主存档及历史版本
      _api?.removeStorageSync(SAVE_SLOT);
      for (let v = 1; v <= 10; v++) {
        try { _api?.removeStorageSync(`huahua_save_v${v}`); } catch (_) {}
      }
      // 各系统独立存档
      const keys = [
        'huahua_checkin',
        'huahua_quests',
        'huahua_achievements',
        'huahua_idle',
        'huahua_tutorial',
        'huahua_merge_stats',
        'huahua_flower_quotes',
        'huahua_gm',
        'huahua_regulars'
      ];
      for (const key of keys) {
        try { _api?.removeStorageSync(key); } catch (_) {}
      }
      console.log('[Save] 所有游戏数据已清除');
    } catch (_) {}
  }
}

export const SaveManager = new SaveManagerClass();
