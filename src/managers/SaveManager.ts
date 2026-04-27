/**
 * 存档管理器
 *
 * 指纹策略：基于棋盘布局结构（格子数/位置/状态/钥匙价格）生成指纹。
 * - 布局变化 → 指纹变化 → 旧存档自动清除
 * - 物品配置变化（新增/删除物品）→ 指纹不变 → 存档保留，无效物品ID自动清理
 */

import { BoardManager } from './BoardManager';
import { BuildingManager, type BuildingPersistEntry } from './BuildingManager';
import { CurrencyManager } from './CurrencyManager';
import { CustomerManager, type CustomerPersistState } from './CustomerManager';
import { WarehouseManager, WarehouseState } from './WarehouseManager';
import { RewardBoxManager, RewardBoxState } from './RewardBoxManager';
import { MergeCompanionManager, type MergeCompanionPersistState } from './MergeCompanionManager';
import { MerchShopManager, type MerchShopPersistState } from './MerchShopManager';
import { FlowerSignTicketManager } from './FlowerSignTicketManager';
import { EventBus } from '@/core/EventBus';
import { PersistService } from '@/core/PersistService';
import { BOARD_TOTAL } from '@/config/Constants';
import { BOARD_PRESETS } from '@/config/BoardLayout';
import { ITEM_DEFS } from '@/config/ItemConfig';
import { BACKEND_ANON_ID_KEY, BACKEND_TOKEN_KEY, CLOUD_SYNC_META_KEY } from '@/config/CloudConfig';
import { CloudSyncManager } from '@/managers/CloudSyncManager';

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
  /** 工具 CD、花束纸次数、宝箱待散落队列等 */
  buildings?: BuildingPersistEntry[];
  warehouse?: WarehouseState;
  rewardBox?: RewardBoxState;
  /** 合成伴生物（漂浮气泡等） */
  mergeCompanions?: MergeCompanionPersistState;
  /** 当前订单队列（与棋盘独立保存；读档后由 CustomerManager.init 绑定格子） */
  customers?: CustomerPersistState;
  /** 主场景内购商店货架与刷新时间 */
  merchShop?: MerchShopPersistState;
  /** 许愿硬币数量（存档键 flowerSignTickets 与旧「许愿券」档兼容） */
  flowerSignTickets?: number;
}

class SaveManagerClass {
  private _lastSave = 0;
  private _mergeCompanionSaveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    /** 花语泡泡等伴生物变化后尽快落盘，避免仅依赖 30s 异步档或未触发 onHide 时丢档 */
    EventBus.on('mergeCompanion:changed', () => {
      if (this._mergeCompanionSaveTimer) clearTimeout(this._mergeCompanionSaveTimer);
      this._mergeCompanionSaveTimer = setTimeout(() => {
        this._mergeCompanionSaveTimer = null;
        this._persistToStorage(false);
      }, 200);
    });
  }

  private _buildSaveData(): string {
    const data: SaveData = {
      fingerprint: CONFIG_FINGERPRINT,
      timestamp: Date.now(),
      /** v8：许愿硬币（flowerSignTickets，键名兼容旧档） */
      version: 8,
      currency: CurrencyManager.exportState(),
      board: BoardManager.exportState(),
      buildings: BuildingManager.exportState(),
      warehouse: WarehouseManager.exportState(),
      rewardBox: RewardBoxManager.exportState(),
      mergeCompanions: MergeCompanionManager.exportState(),
      customers: CustomerManager.exportState(),
      merchShop: MerchShopManager.exportState(),
      flowerSignTickets: FlowerSignTicketManager.exportState(),
    };
    return JSON.stringify(data);
  }

  /**
   * 写入本地存储。定时自动档用 `log=false` 减少刷屏。
   * 统一用同步 `setStorageSync`，避免微信 `setStorage` 乱序完成覆盖较新存档（曾导致花语泡泡重进消失）。
   */
  private _persistToStorage(log: boolean): void {
    try {
      PersistService.writeRaw(SAVE_SLOT, this._buildSaveData());
      if (log) {
        console.log('[Save] 存档成功(sync), fingerprint:', CONFIG_FINGERPRINT);
      }
    } catch (e) {
      console.error('[Save] 存档失败:', e);
    }
  }

  /** 同步存档（onHide / 手动触发时使用，确保数据不丢） */
  save(): void {
    this._persistToStorage(true);
  }

  load(): boolean {
    try {
      const raw = PersistService.readRaw(SAVE_SLOT);
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

      BuildingManager.reset();
      CurrencyManager.loadState(data.currency);
      const offlineSec = Math.max(0, Math.floor((Date.now() - data.timestamp) / 1000));
      CurrencyManager.applyElapsedStaminaRecovery(offlineSec);
      BoardManager.loadState(data.board);
      BuildingManager.loadState(data.buildings);
      if (data.warehouse) {
        WarehouseManager.loadState(data.warehouse);
      }
      if (data.rewardBox) {
        RewardBoxManager.loadState(data.rewardBox);
      }
      MergeCompanionManager.loadState(data.mergeCompanions);
      CustomerManager.prepareFromSave(data.customers, offlineSec);
      MerchShopManager.init();
      MerchShopManager.loadState(data.merchShop);
      FlowerSignTicketManager.loadState(data.flowerSignTickets);

      console.log('[Save] 读档成功, 距上次存档:', Math.round((Date.now() - data.timestamp) / 1000), '秒');
      return true;
    } catch (e) {
      console.error('[Save] 读档失败:', e);
      return false;
    }
  }

  /** 每帧调用，定时自动存档（同步写入，避免异步竞态丢花语泡泡等状态） */
  update(dt: number): void {
    this._lastSave += dt;
    if (this._lastSave >= AUTO_SAVE_INTERVAL) {
      this._lastSave = 0;
      this._persistToStorage(false);
    }
  }

  /** 清除旧存档 */
  private _clearStorage(): void {
    try {
      PersistService.remove(SAVE_SLOT);
      const legacyKeys = Array.from({ length: 10 }, (_, i) => `huahua_save_v${i + 1}`);
      PersistService.removeMany(legacyKeys, { markDirty: false });
    } catch (_) {}
  }

  /** 清除所有游戏数据（用于测试/重置） */
  clearAllData(): void {
    try {
      const legacyKeys = Array.from({ length: 10 }, (_, i) => `huahua_save_v${i + 1}`);
      const keys = [
        SAVE_SLOT,
        ...legacyKeys,
        'huahua_checkin',
        'huahua_quests',
        'huahua_achievements',
        'huahua_idle',
        'huahua_tutorial',
        'huahua_merge_stats',
        'huahua_flower_quotes',
        'huahua_gm',
        'huahua_gm_export_scales',
        'huahua_regulars',
        'huahua_decoration',
        'huahua_room_layout',
        'huahua_dressup',
        'huahua_social',
        'huahua_events',
        'huahua_challenge',
        'huahua_collection',
        'huahua_flower_cards',
        'huahua_affinity',
        'huahua_daily_candy',
        'huahua_haptic',
        CLOUD_SYNC_META_KEY,
        BACKEND_TOKEN_KEY,
        BACKEND_ANON_ID_KEY,
      ];
      PersistService.removeMany(keys);
      void CloudSyncManager.flushNow('clear-all-data');
      console.log('[Save] 所有游戏数据已清除');
    } catch (_) {}
  }
}

export const SaveManager = new SaveManagerClass();
