/**
 * 熟客系统管理器（V2 · 已去 Bond）
 *
 * 职责：
 *  - 维护每位熟客的 unlocked 状态、近期留言/触发去重队列
 *  - 接收 LevelManager 的 level:up 事件 → 解锁该等级新熟客
 *  - 提供 onCustomerDelivered(typeId)：调 AffinityCardManager 抽卡
 *  - 提供 pickRandomAffinityNote() 给 IdleManager / DailyCandyManager
 *  - 存档 Key: huahua_affinity；CloudSync allowlist 同步注册
 *
 * 事件：
 *  - 'affinity:unlocked' (typeId, def)
 */
import { EventBus } from '@/core/EventBus';
import { PersistService } from '@/core/PersistService';
import { CurrencyManager } from './CurrencyManager';
import {
  AFFINITY_DEFS,
  AFFINITY_MAP,
  AFFINITY_NOTE_AVOID_RECENT_N,
  AFFINITY_UNLOCK_LEVELS,
  type AffinityCustomerDef,
} from '@/config/AffinityConfig';
import { CARD_SYSTEM_UNLOCK_LEVEL } from '@/config/AffinityCardConfig';
import { AffinityCardManager } from './AffinityCardManager';
import { LevelManager } from './LevelManager';

const AFFINITY_STORAGE_KEY = 'huahua_affinity';

export interface AffinityEntryState {
  typeId: string;
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
    this._ensureEntriesForCurrentLevel();
    this._bindEvents();
  }

  /**
   * 友谊卡 + 图鉴系统对当前玩家是否「真正可用」。
   * 玩家等级达到 CARD_SYSTEM_UNLOCK_LEVEL（默认 6）即可。
   * UI 入口（TopBar 图鉴按钮、CustomerProfilePanel 卡册行）用本方法判定显隐。
   */
  isCardSystemUnlocked(): boolean {
    return LevelManager.level >= CARD_SYSTEM_UNLOCK_LEVEL;
  }

  /** 列出全部熟客（含未解锁）按解锁等级排序 */
  listAll(): { def: AffinityCustomerDef; state: AffinityEntryState }[] {
    const all = AFFINITY_DEFS.map(def => {
      const state = this._entries.get(def.typeId) ?? this._defaultEntry(def.typeId);
      return { def, state };
    });
    all.sort((a, b) => {
      const la = AFFINITY_UNLOCK_LEVELS[a.def.typeId] ?? 99;
      const lb = AFFINITY_UNLOCK_LEVELS[b.def.typeId] ?? 99;
      return la - lb;
    });
    return all;
  }

  getState(typeId: string): AffinityEntryState {
    return this._entries.get(typeId) ?? this._defaultEntry(typeId);
  }

  isUnlocked(typeId: string): boolean {
    return this.getState(typeId).unlocked;
  }

  isAffinityType(typeId: string): boolean {
    return AFFINITY_MAP.has(typeId);
  }

  /** 全局 buff：集齐该客人 100% 图鉴时订单花愿 +10%（来自 AffinityCardManager） */
  huayuanMultFor(typeId: string): number {
    const s = this.getState(typeId);
    if (!s.unlocked) return 1;
    return AffinityCardManager.huayuanMultFor(typeId);
  }

  // ============================================================
  // 解锁
  // ============================================================

  unlockForLevel(level: number): AffinityCustomerDef[] {
    const newly: AffinityCustomerDef[] = [];
    for (const def of AFFINITY_DEFS) {
      const target = AFFINITY_UNLOCK_LEVELS[def.typeId] ?? 999;
      if (target > level) continue;
      const cur = this._entries.get(def.typeId) ?? this._defaultEntry(def.typeId);
      if (cur.unlocked) continue;
      cur.unlocked = true;
      this._entries.set(def.typeId, cur);
      newly.push(def);
      EventBus.emit('affinity:unlocked', def.typeId, def);
      console.log(`[Affinity] 熟客解锁: ${def.typeId} (${def.bondName})`);
    }
    if (newly.length > 0) this._saveState();
    return newly;
  }

  // ============================================================
  // 交付：仅触发抽卡（V2 已去 Bond）
  // ============================================================

  onCustomerDelivered(typeId: string): void {
    if (!this.isAffinityType(typeId)) return;
    const cur = this._entries.get(typeId) ?? this._defaultEntry(typeId);
    if (!cur.unlocked) return;

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
    const unlocked = this.listAll().filter(x => x.state.unlocked);
    if (unlocked.length === 0) return null;

    const fresh = unlocked.filter(x => !this._recentNoteTypeIds.includes(x.def.typeId));
    const pool = fresh.length > 0 ? fresh : unlocked;

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

  /** GM：清空所有进度（保留解锁信息） */
  gmReset(): void {
    this._recentNoteTypeIds = [];
    this._saveState();
  }

  // ============================================================
  // 私有：默认条目 / 当前等级补齐 / 事件 / 持久化
  // ============================================================

  private _defaultEntry(typeId: string): AffinityEntryState {
    return {
      typeId,
      unlocked: false,
    };
  }

  private _ensureEntriesForCurrentLevel(): void {
    const lv = CurrencyManager.globalLevel;
    for (const def of AFFINITY_DEFS) {
      if (!this._entries.has(def.typeId)) {
        this._entries.set(def.typeId, this._defaultEntry(def.typeId));
      }
      const target = AFFINITY_UNLOCK_LEVELS[def.typeId] ?? 999;
      if (target <= lv) {
        const e = this._entries.get(def.typeId)!;
        if (!e.unlocked) {
          e.unlocked = true;
        }
      }
    }
  }

  private _bindEvents(): void {
    EventBus.on('star:levelUp', (newLevel: number) => {
      this.unlockForLevel(newLevel);
    });
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
            unlocked: !!e.unlocked,
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
