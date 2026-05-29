/**
 * 熟客系统管理器（V2 · 已去 Bond）
 *
 * 职责：
 *  - 维护熟客基础配置与近期留言去重队列
 *  - 提供 onCustomerDelivered(typeId)：调 AffinityCardManager 抽卡
 *  - 提供 pickRandomAffinityNote() 给 IdleManager / DailyCandyManager
 *  - 存档 Key: huahua_affinity；CloudSync allowlist 同步注册
 */
import { PersistService } from '@/core/PersistService';
import {
  AFFINITY_DEFS,
  AFFINITY_MAP,
  AFFINITY_NOTE_AVOID_RECENT_N,
  type AffinityCustomerDef,
} from '@/config/AffinityConfig';
import { CARD_SYSTEM_UNLOCK_LEVEL } from '@/config/AffinityCardConfig';
import { AffinityCardManager } from './AffinityCardManager';
import { LevelManager } from './LevelManager';

const AFFINITY_STORAGE_KEY = 'huahua_affinity';

export interface AffinityEntryState {
  typeId: string;
  /** @deprecated 熟客等级锁已软下线；保留字段仅兼容旧存档。 */
  unlocked: boolean;
}

interface AffinityPersistState {
  v: 2;
  entries: AffinityEntryState[];
  /** 最近 N 次留言抽签的 typeId，按时间倒序 */
  recentNoteTypeIds: string[];
}

class AffinityManagerClass {
  private _entries = new Map<string, AffinityEntryState>();
  private _recentNoteTypeIds: string[] = [];
  private _initialized = false;

  init(): void {
    if (this._initialized) return;
    this._initialized = true;
    this._loadState();
    this._ensureEntries();
  }

  /**
   * 友谊卡 + 图鉴系统对当前玩家是否「真正可用」。
   * 玩家等级达到 CARD_SYSTEM_UNLOCK_LEVEL（默认 2）即可。
   * UI 入口（TopBar 图鉴按钮、CustomerProfilePanel 卡册行）用本方法判定显隐。
   */
  isCardSystemUnlocked(): boolean {
    return LevelManager.level >= CARD_SYSTEM_UNLOCK_LEVEL;
  }

  /** 列出全部熟客（当前不再按等级锁定；保持配置顺序） */
  listAll(): { def: AffinityCustomerDef; state: AffinityEntryState }[] {
    return AFFINITY_DEFS.map(def => {
      const state = this._entries.get(def.typeId) ?? this._defaultEntry(def.typeId);
      return { def, state };
    });
  }

  getState(typeId: string): AffinityEntryState {
    return this._entries.get(typeId) ?? this._defaultEntry(typeId);
  }

  isUnlocked(typeId: string): boolean {
    return this.isAffinityType(typeId);
  }

  isAffinityType(typeId: string): boolean {
    return AFFINITY_MAP.has(typeId);
  }

  /** 全局 buff：集齐该客人 100% 图鉴时订单花愿 +10%（来自 AffinityCardManager） */
  huayuanMultFor(typeId: string): number {
    if (!this.isAffinityType(typeId)) return 1;
    return AffinityCardManager.huayuanMultFor(typeId);
  }

  // ============================================================
  // 交付：仅触发抽卡（V2 已去 Bond）
  // ============================================================

  onCustomerDelivered(typeId: string): void {
    if (!this.isAffinityType(typeId)) return;

    // 卡片系统达等级即触发抽卡：新卡入图鉴；重复卡直接派发花愿/钻石/体力；
    // 里程碑（50%/100%）与赛季全集均在 AffinityCardManager 内部自动结算。
    if (this.isCardSystemUnlocked()) {
      AffinityCardManager.rollCardDrop(typeId);
    }
  }

  // ============================================================
  // 离线 / 关店糖果：随机留言
  // ============================================================

  pickRandomAffinityNote(rng: () => number = Math.random): {
    typeId: string;
    bondName: string;
    text: string;
  } | null {
    const all = this.listAll();
    if (all.length === 0) return null;

    const fresh = all.filter(x => !this._recentNoteTypeIds.includes(x.def.typeId));
    const pool = fresh.length > 0 ? fresh : all;

    const chosen = pool[Math.floor(rng() * pool.length)]!;
    const note = chosen.def.notes[Math.floor(rng() * chosen.def.notes.length)] ?? '';
    const text = note.replace('{name}', chosen.def.bondName);

    this._recentNoteTypeIds.unshift(chosen.def.typeId);
    if (this._recentNoteTypeIds.length > AFFINITY_NOTE_AVOID_RECENT_N) {
      this._recentNoteTypeIds.length = AFFINITY_NOTE_AVOID_RECENT_N;
    }
    this._saveState();

    return {
      typeId: chosen.def.typeId,
      bondName: chosen.def.bondName,
      text,
    };
  }

  /** GM：清空熟客辅助状态（不影响图鉴） */
  gmReset(): void {
    this._recentNoteTypeIds = [];
    this._saveState();
  }

  // ============================================================
  // 私有：默认条目 / 兼容补齐 / 持久化
  // ============================================================

  private _defaultEntry(typeId: string): AffinityEntryState {
    return {
      typeId,
      unlocked: true,
    };
  }

  private _ensureEntries(): void {
    for (const def of AFFINITY_DEFS) {
      const cur = this._entries.get(def.typeId);
      if (!cur) {
        this._entries.set(def.typeId, this._defaultEntry(def.typeId));
      } else if (!cur.unlocked) {
        cur.unlocked = true;
      }
    }
  }

  // ====== 存档 ======

  private _saveState(): void {
    try {
      const data: AffinityPersistState = {
        v: 2,
        entries: Array.from(this._entries.values()).map(e => ({
          typeId: e.typeId,
          unlocked: e.unlocked,
        })),
        recentNoteTypeIds: [...this._recentNoteTypeIds],
      };
      PersistService.writeRaw(AFFINITY_STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('[Affinity] 存档失败:', e);
    }
  }

  private _loadState(): void {
    try {
      const raw = PersistService.readRaw(AFFINITY_STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw) as Partial<AffinityPersistState>;
      if (Array.isArray(data?.entries)) {
        for (const e of data.entries) {
          if (!e || typeof e.typeId !== 'string') continue;
          const def = AFFINITY_MAP.get(e.typeId);
          if (!def) continue;
          this._entries.set(e.typeId, {
            typeId: e.typeId,
            unlocked: true,
          });
        }
      }
      if (Array.isArray(data?.recentNoteTypeIds)) {
        this._recentNoteTypeIds = data.recentNoteTypeIds.filter(
          (s): s is string => typeof s === 'string',
        );
      }
    } catch (e) {
      console.warn('[Affinity] 读档失败:', e);
    }
  }
}

export const AffinityManager = new AffinityManagerClass();
