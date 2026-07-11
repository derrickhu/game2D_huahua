/**
 * 周四「魔法时间」活动：选择棋盘上消耗体力的生产工具类型，看广告给同类工具附魔。
 * 附魔当日有效：同类工具消耗 2 体力，产出等级整体 +1 档。
 */
import { EventBus } from '@/core/EventBus';
import { PersistService } from '@/core/PersistService';
import {
  findBoardProducerDef,
  getBoardProducerOutcomePercents,
  type ToolProduceDisplayEntry,
} from '@/config/BuildingConfig';
import { ITEM_DEFS } from '@/config/ItemConfig';
import { BoardManager } from './BoardManager';
import { BuildingManager } from './BuildingManager';
import { CheckInManager } from './CheckInManager';
import { CloudSyncManager } from './CloudSyncManager';
import { SaveManager } from './SaveManager';

const STORAGE_KEY = 'huahua_thursday_magic_time';
const CHECK_INTERVAL_SEC = 60;

interface ThursdayMagicTimeState {
  dateKey: string;
  promoShownDate: string;
}

export interface MagicToolOption {
  cellIndex: number;
  itemId: string;
  name: string;
  level: number;
  count: number;
  baseOutcomes: ToolProduceDisplayEntry[];
  magicOutcomes: ToolProduceDisplayEntry[];
}

function effectiveNow(): Date {
  const d = new Date();
  const offset = CheckInManager?.gmDateOffsetDays ?? 0;
  if (offset !== 0) d.setUTCDate(d.getUTCDate() + offset);
  return d;
}

function localDateKey(): string {
  return CheckInManager?.effectiveDateKey ?? effectiveNow().toISOString().slice(0, 10);
}

function isInEventPeriod(now = effectiveNow()): boolean {
  return now.getDay() === 4;
}

function getEventPeriodEnd(now = effectiveNow()): Date | null {
  if (!isInEventPeriod(now)) return null;
  const end = new Date(now);
  end.setHours(0, 0, 0, 0);
  end.setDate(end.getDate() + 1);
  return end;
}

function emptyState(): ThursdayMagicTimeState {
  return { dateKey: localDateKey(), promoShownDate: '' };
}

function normalizeState(raw: Partial<ThursdayMagicTimeState> | null): ThursdayMagicTimeState {
  const base = emptyState();
  if (!raw || typeof raw.dateKey !== 'string') return base;
  base.dateKey = raw.dateKey;
  base.promoShownDate = typeof raw.promoShownDate === 'string' ? raw.promoShownDate : '';
  return base;
}

class ThursdayMagicTimeManagerClass {
  private _state: ThursdayMagicTimeState = emptyState();
  private _loaded = false;
  private _ticker = 0;

  init(): void {
    if (!this._loaded) {
      this._state = normalizeState(PersistService.readJSON<Partial<ThursdayMagicTimeState>>(STORAGE_KEY));
      this._loaded = true;
    }
    this._checkDailyReset();
  }

  reloadFromStorage(): void {
    this._loaded = false;
    this.init();
    EventBus.emit('thursdayMagicTime:changed');
  }

  update(dt: number): void {
    this._ticker += dt;
    if (this._ticker < CHECK_INTERVAL_SEC) return;
    this._ticker = 0;
    this._checkDailyReset();
  }

  isAvailableToday(): boolean {
    this.init();
    return isInEventPeriod();
  }

  shouldAutoOpenOnMainEnter(): boolean {
    this.init();
    if (!isInEventPeriod()) return false;
    return this._state.promoShownDate !== localDateKey();
  }

  markPromoShown(): void {
    this.init();
    const today = localDateKey();
    if (this._state.promoShownDate === today) return;
    this._state.promoShownDate = today;
    this._save();
  }

  countdownLabel(now = effectiveNow()): string | null {
    if (!isInEventPeriod(now)) return null;
    const end = getEventPeriodEnd(now);
    if (!end) return null;
    const ms = end.getTime() - now.getTime();
    if (ms <= 0) return null;
    return `${Math.max(1, Math.ceil(ms / 3_600_000))}小时后结束`;
  }

  listEnchantableTools(): MagicToolOption[] {
    this.init();
    if (!isInEventPeriod()) return [];
    const byItem = new Map<string, MagicToolOption>();
    for (const cell of BoardManager.cells) {
      if (!cell.itemId) continue;
      if (!BuildingManager.isMagicEnchantableAt(cell.index)) continue;
      const existing = byItem.get(cell.itemId);
      if (existing) {
        existing.count += 1;
        continue;
      }
      const def = ITEM_DEFS.get(cell.itemId);
      const producer = findBoardProducerDef(cell.itemId);
      if (!def || !producer) continue;
      byItem.set(cell.itemId, {
        cellIndex: cell.index,
        itemId: cell.itemId,
        name: def.name,
        level: def.level,
        count: 1,
        baseOutcomes: getBoardProducerOutcomePercents(producer, 0),
        magicOutcomes: getBoardProducerOutcomePercents(producer, 1),
      });
    }
    const out = Array.from(byItem.values());
    return out.sort((a, b) => b.level - a.level || a.cellIndex - b.cellIndex);
  }

  getToolOption(cellIndex: number): MagicToolOption | null {
    return this.listEnchantableTools().find(o => o.cellIndex === cellIndex) ?? null;
  }

  getToolOptionByItemId(itemId: string): MagicToolOption | null {
    return this.listEnchantableTools().find(o => o.itemId === itemId) ?? null;
  }

  enchantTool(cellIndex: number): boolean {
    this.init();
    if (!isInEventPeriod()) return false;
    const ok = BuildingManager.enchantMagicAt(cellIndex);
    if (!ok) return false;
    SaveManager.save();
    void CloudSyncManager.flushNow('thursday-magic-enchant');
    EventBus.emit('thursdayMagicTime:changed');
    return true;
  }

  enchantToolGroup(itemId: string): boolean {
    this.init();
    if (!isInEventPeriod()) return false;
    const ok = BuildingManager.enchantMagicItemGroup(itemId);
    if (!ok) return false;
    SaveManager.save();
    void CloudSyncManager.flushNow('thursday-magic-enchant');
    EventBus.emit('thursdayMagicTime:changed');
    return true;
  }

  resetAfterVirtualDayAdvance(): void {
    this.init();
    this._state = emptyState();
    BuildingManager.clearMagicEnchantments();
    SaveManager.save();
    this._save();
    EventBus.emit('thursdayMagicTime:changed');
  }

  private _checkDailyReset(): void {
    const today = localDateKey();
    if (this._state.dateKey === today) return;
    this._state = emptyState();
    BuildingManager.clearMagicEnchantments();
    SaveManager.save();
    this._save();
    EventBus.emit('thursdayMagicTime:changed');
  }

  private _save(): void {
    PersistService.writeJSON(STORAGE_KEY, this._state);
  }
}

export const ThursdayMagicTimeManager = new ThursdayMagicTimeManagerClass();
