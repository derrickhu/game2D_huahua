/**
 * 装修面板「新解锁」标记：每次升星后，将当次新开放等级门槛的家具记入列表；
 * 在「全部」筛选项中置顶，卡片右上角显示「新」，购买后移除。
 */
import { EventBus } from '@/core/EventBus';
import { PersistService } from '@/core/PersistService';
import { DECO_DEFS } from '@/config/DecorationConfig';
import { LevelManager } from '@/managers/LevelManager';

const STORAGE_KEY = 'huahua_deco_new_unlock';

interface DecoNewUnlockSave {
  /** 产生本批「新」标记时的玩家星级 */
  sourceLevel?: number;
  decoIds?: string[];
}

class DecoNewUnlockManagerClass {
  private _sourceLevel = 0;
  private _decoIds = new Set<string>();
  private _loaded = false;
  private _inited = false;

  init(): void {
    if (this._inited) return;
    this._inited = true;
    this._ensureLoaded();

    EventBus.on('level:up', (level: number, _reward: unknown, oldLevel?: number) => {
      const prev = typeof oldLevel === 'number' ? oldLevel : level - 1;
      if (level > prev) this._refreshMarksForLevelSpan(prev, level);
    });

    EventBus.on('decoration:unlocked', (decoId: string) => {
      this._removeId(decoId);
    });
  }

  private _ensureLoaded(): void {
    if (this._loaded) return;
    try {
      const raw = PersistService.readRaw(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw) as DecoNewUnlockSave;
        this._sourceLevel = Math.max(0, Math.floor(data.sourceLevel ?? 0));
        this._decoIds = new Set((data.decoIds ?? []).filter(Boolean));
      }
    } catch {
      this._sourceLevel = 0;
      this._decoIds.clear();
    }
    this._loaded = true;
  }

  private _save(): void {
    PersistService.writeRaw(
      STORAGE_KEY,
      JSON.stringify({
        sourceLevel: this._sourceLevel,
        decoIds: [...this._decoIds],
      } satisfies DecoNewUnlockSave),
    );
  }

  private _collectIdsForLevelSpan(oldLevel: number, newLevel: number): string[] {
    const ids: string[] = [];
    for (const d of DECO_DEFS) {
      if (d.hideInDecorationPanel) continue;
      const lv = d.unlockRequirement?.level;
      if (lv === undefined || lv <= oldLevel || lv > newLevel) continue;
      ids.push(d.id);
    }
    return ids;
  }

  private _refreshMarksForLevelSpan(oldLevel: number, newLevel: number): void {
    this._ensureLoaded();
    const ids = this._collectIdsForLevelSpan(oldLevel, newLevel);
    if (ids.length === 0) {
      this._sourceLevel = newLevel;
      this._decoIds.clear();
    } else {
      this._sourceLevel = newLevel;
      this._decoIds = new Set(ids);
    }
    this._save();
    EventBus.emit('decoNewUnlock:changed');
  }

  private _removeId(decoId: string): void {
    this._ensureLoaded();
    if (!this._decoIds.delete(decoId)) return;
    this._save();
    EventBus.emit('decoNewUnlock:changed');
  }

  /** 当前星级下仍显示「新」角标（升星当批、且未购买） */
  isNewUnlockHighlight(decoId: string): boolean {
    this._ensureLoaded();
    return this._sourceLevel === LevelManager.level && this._decoIds.has(decoId);
  }

  /** 「全部」排序：新解锁批优先，同批内当前星级门槛的家具更靠前 */
  compareAllFilterNewPriority(aId: string, bId: string, aLevel: number | undefined, bLevel: number | undefined): number {
    const aNew = this.isNewUnlockHighlight(aId);
    const bNew = this.isNewUnlockHighlight(bId);
    if (aNew !== bNew) return aNew ? -1 : 1;
    if (!aNew) return 0;
    const cur = LevelManager.level;
    const aCur = aLevel === cur ? 0 : 1;
    const bCur = bLevel === cur ? 0 : 1;
    return aCur - bCur;
  }

  resetForDebug(): void {
    this._sourceLevel = 0;
    this._decoIds.clear();
    this._loaded = true;
    this._save();
    EventBus.emit('decoNewUnlock:changed');
  }
}

export const DecoNewUnlockManager = new DecoNewUnlockManagerClass();
