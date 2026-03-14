/**
 * 花店装修管理器
 *
 * 管理装饰解锁状态、当前装备、花愿购买等
 * 数据持久化到 localStorage 'huahua_decoration'
 */
import { EventBus } from '@/core/EventBus';
import { CurrencyManager } from './CurrencyManager';
import {
  DECO_DEFS, DECO_MAP, DecoSlot, DecoDef, DecoRarity,
  getSlotDecos, DECO_SLOT_INFO,
} from '@/config/DecorationConfig';

export interface DecoSaveData {
  /** 已解锁的装饰ID集合 */
  unlocked: string[];
  /** 当前装备：slot → decoId */
  equipped: Record<string, string>;
}

class DecorationManagerClass {
  /** 已解锁的装饰 ID */
  private _unlocked = new Set<string>();
  /** 当前装备：slot → decoId */
  private _equipped = new Map<string, string>();

  /** 初始化：免费装饰默认解锁 */
  init(): void {
    // 所有 cost=0 的免费装饰自动解锁
    for (const deco of DECO_DEFS) {
      if (deco.cost === 0) {
        this._unlocked.add(deco.id);
      }
    }

    // 每个槽位默认装备第一个免费装饰
    for (const slotKey of Object.values(DecoSlot)) {
      if (!this._equipped.has(slotKey)) {
        const freeDecos = getSlotDecos(slotKey).filter(d => d.cost === 0);
        if (freeDecos.length > 0) {
          this._equipped.set(slotKey, freeDecos[0].id);
        }
      }
    }

    this._load();
    console.log(`[Decoration] 初始化: ${this._unlocked.size} 个装饰已解锁`);
  }

  /** 是否已解锁 */
  isUnlocked(decoId: string): boolean {
    return this._unlocked.has(decoId);
  }

  /** 获取当前装备的装饰ID */
  getEquipped(slot: DecoSlot): string | null {
    return this._equipped.get(slot) || null;
  }

  /** 获取当前装备的装饰定义 */
  getEquippedDef(slot: DecoSlot): DecoDef | null {
    const id = this._equipped.get(slot);
    return id ? (DECO_MAP.get(id) || null) : null;
  }

  /** 获取已解锁数量 */
  get unlockedCount(): number {
    return this._unlocked.size;
  }

  /** 获取总装饰数量 */
  get totalCount(): number {
    return DECO_DEFS.length;
  }

  /** 获取指定槽位的解锁进度 */
  getSlotProgress(slot: DecoSlot): { unlocked: number; total: number } {
    const all = getSlotDecos(slot);
    const unlocked = all.filter(d => this._unlocked.has(d.id)).length;
    return { unlocked, total: all.length };
  }

  /**
   * 花愿购买解锁装饰
   * @returns true 购买成功
   */
  unlock(decoId: string): boolean {
    if (this._unlocked.has(decoId)) return false;

    const deco = DECO_MAP.get(decoId);
    if (!deco) return false;

    if (CurrencyManager.state.huayuan < deco.cost) return false;

    CurrencyManager.addHuayuan(-deco.cost);
    this._unlocked.add(decoId);
    this._save();

    console.log(`[Decoration] 解锁装饰: ${deco.name} (-${deco.cost}花愿)`);
    EventBus.emit('decoration:unlocked', decoId, deco);
    return true;
  }

  /**
   * 装备装饰到对应槽位
   */
  equip(decoId: string): boolean {
    if (!this._unlocked.has(decoId)) return false;

    const deco = DECO_MAP.get(decoId);
    if (!deco) return false;

    const prev = this._equipped.get(deco.slot);
    this._equipped.set(deco.slot, decoId);
    this._save();

    console.log(`[Decoration] 装备: ${deco.name} → ${DECO_SLOT_INFO[deco.slot].name}`);
    EventBus.emit('decoration:equipped', deco.slot, decoId, prev || null);
    return true;
  }

  /**
   * 获取所有已装备的装饰列表
   */
  getAllEquipped(): { slot: DecoSlot; deco: DecoDef }[] {
    const result: { slot: DecoSlot; deco: DecoDef }[] = [];
    for (const [slot, id] of this._equipped) {
      const deco = DECO_MAP.get(id);
      if (deco) result.push({ slot: slot as DecoSlot, deco });
    }
    return result;
  }

  /**
   * 检查是否有可以购买但未解锁的新装饰
   */
  hasAffordableNew(): boolean {
    const huayuan = CurrencyManager.state.huayuan;
    return DECO_DEFS.some(d => !this._unlocked.has(d.id) && d.cost > 0 && d.cost <= huayuan);
  }

  // ---- 存档 ----

  private _save(): void {
    try {
      const data: DecoSaveData = {
        unlocked: [...this._unlocked],
        equipped: Object.fromEntries(this._equipped),
      };
      const platform = typeof wx !== 'undefined' ? wx : typeof tt !== 'undefined' ? tt : null;
      if (platform) {
        platform.setStorageSync('huahua_decoration', JSON.stringify(data));
      } else {
        localStorage.setItem('huahua_decoration', JSON.stringify(data));
      }
    } catch (e) {
      console.warn('[Decoration] 保存失败:', e);
    }
  }

  private _load(): void {
    try {
      const platform = typeof wx !== 'undefined' ? wx : typeof tt !== 'undefined' ? tt : null;
      let raw: string | null = null;

      if (platform) {
        raw = platform.getStorageSync('huahua_decoration') || null;
      } else {
        raw = localStorage.getItem('huahua_decoration');
      }

      if (!raw) return;

      const data: DecoSaveData = JSON.parse(raw);
      if (data.unlocked) {
        for (const id of data.unlocked) {
          this._unlocked.add(id);
        }
      }
      if (data.equipped) {
        for (const [slot, id] of Object.entries(data.equipped)) {
          // 验证装饰存在且已解锁
          if (this._unlocked.has(id) && DECO_MAP.has(id)) {
            this._equipped.set(slot, id);
          }
        }
      }
    } catch (e) {
      console.warn('[Decoration] 加载失败:', e);
    }
  }

  /** 导出存档数据 */
  exportState(): DecoSaveData {
    return {
      unlocked: [...this._unlocked],
      equipped: Object.fromEntries(this._equipped),
    };
  }

  /** 重置（GM 调试用） */
  reset(): void {
    this._unlocked.clear();
    this._equipped.clear();
    this.init();
    EventBus.emit('decoration:reset');
  }
}

export const DecorationManager = new DecorationManagerClass();
