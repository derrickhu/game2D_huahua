/**
 * 店主换装系统管理器（整套形象版）
 *
 * 纯运行时逻辑：解锁、装备、存档
 * 形象配置在 config/DressUpConfig.ts
 */
import { EventBus } from '@/core/EventBus';
import { PersistService } from '@/core/PersistService';
import { CurrencyManager } from './CurrencyManager';
import { checkRequirement } from '@/utils/UnlockChecker';
import {
  AD_UNLOCK_OUTFIT_IDS,
  DRESSUP_PANEL_OUTFITS,
  OUTFIT_ACTIVITY_QUEST_BY_ID,
  OUTFIT_MAP,
} from '@/config/DressUpConfig';
import {
  DRESSUP_DEFAULT_EQUIPPED,
  DRESSUP_FREE_ITEM_IDS,
  DRESSUP_ITEM_MAP,
  DRESSUP_SLOT_ORDER,
} from '@/config/DressUpItemConfig';
import type { DressUpItem, DressUpSlot } from '@/config/DressUpItemConfig';
import { grantQuest } from '@/utils/UnlockChecker';
import type { Outfit } from '@/config/DressUpConfig';
export type { Outfit } from '@/config/DressUpConfig';

const STORAGE_KEY = 'huahua_dressup';

/** 换装模式：outfit = 整套形象（旧）；custom = 分部件叠层 */
export type DressUpMode = 'outfit' | 'custom';

interface DressUpSave {
  /** 已解锁的形象 id 列表 */
  unlocked: string[];
  /** 当前穿戴的形象 id */
  equipped: string;
  /** 已看广告、可花愿购买的形象 id（见 AD_UNLOCK_OUTFIT_IDS） */
  adPurchaseGates?: string[];
  /** 换装模式（缺省 = outfit，兼容旧档） */
  mode?: DressUpMode;
  /** 已解锁的部件 id */
  unlockedItems?: string[];
  /** 各槽位穿戴的部件 id */
  equippedItems?: Partial<Record<DressUpSlot, string>>;
}

class DressUpManagerClass {
  private _unlocked: Set<string> = new Set();
  private _adPurchaseGates: Set<string> = new Set();
  private _equippedId = 'outfit_default';
  private _mode: DressUpMode = 'outfit';
  private _unlockedItems: Set<string> = new Set();
  private _equippedItems: Partial<Record<DressUpSlot, string>> = {};

  init(): void {
    this._unlocked.add('outfit_default');
    for (const id of DRESSUP_FREE_ITEM_IDS) this._unlockedItems.add(id);
    this._loadState();
    console.log(`[DressUp] 初始化完成，解锁 ${this._unlocked.size}/${DRESSUP_PANEL_OUTFITS.length} 套形象，当前穿戴: ${this._equippedId}，模式: ${this._mode}`);
  }

  /** 获取全部形象（附带解锁/穿戴状态） */
  getAllOutfits(): (Outfit & { unlocked: boolean; equipped: boolean })[] {
    return DRESSUP_PANEL_OUTFITS.map(o => ({
      ...o,
      unlocked: this._unlocked.has(o.id),
      equipped: this._equippedId === o.id,
    }));
  }

  /**
   * 花愿购买解锁，成功后自动装备
   * @param options.deferStarGrant 为 true 时不立即加星（先播飞星，再由换装面板在动画结束后加星）
   */
  unlock(outfitId: string, options?: { deferStarGrant?: boolean }): boolean {
    if (this._unlocked.has(outfitId)) return false;

    const outfit = OUTFIT_MAP.get(outfitId);
    if (!outfit) return false;

    const req = checkRequirement(outfit.unlockRequirement);
    if (!req.met) return false;
    if (!this.canPurchaseOutfit(outfitId)) return false;

    if (outfit.huayuanCost > 0) {
      if (CurrencyManager.state.huayuan < outfit.huayuanCost) return false;
      CurrencyManager.addHuayuan(-outfit.huayuanCost);
    }
    if (outfit.starValue > 0 && !options?.deferStarGrant) {
      CurrencyManager.addStar(outfit.starValue);
    }

    this._unlocked.add(outfitId);
    this._equippedId = outfitId;
    this._saveState();
    EventBus.emit('dressup:unlocked', outfitId, outfit);
    EventBus.emit('dressup:equipped', outfitId);
    return true;
  }

  /**
   * 活动完成后自动解锁套装（预留入口）。
   * 会同步 `grantQuest`，使 `checkRequirement` 与已获得状态一致；并 `grantOutfit` 写入存档、发事件。
   */
  grantOutfitFromActivity(outfitId: string): boolean {
    const q = OUTFIT_ACTIVITY_QUEST_BY_ID[outfitId];
    if (q) grantQuest(q);
    return this.grantOutfit(outfitId);
  }

  /** 免费赠送（成就/活动/合成奖励），成功后自动装备 */
  grantOutfit(outfitId: string): boolean {
    const outfit = OUTFIT_MAP.get(outfitId);
    if (!outfit) return false;

    const isNew = !this._unlocked.has(outfitId);
    this._unlocked.add(outfitId);
    this._equippedId = outfitId;
    this._saveState();

    if (isNew) EventBus.emit('dressup:unlocked', outfitId, outfit);
    EventBus.emit('dressup:equipped', outfitId);
    return true;
  }

  /** 切换已解锁的形象（同时退出自定义分部件模式） */
  equip(outfitId: string): boolean {
    if (!this._unlocked.has(outfitId)) return false;
    this._equippedId = outfitId;
    this._mode = 'outfit';
    this._saveState();
    EventBus.emit('dressup:equipped', outfitId);
    return true;
  }

  // ═══════════════ 分部件（自定义）模式 ═══════════════

  /** 当前换装模式 */
  get mode(): DressUpMode { return this._mode; }

  /** 各槽位穿戴（只读快照） */
  getEquippedItems(): Partial<Record<DressUpSlot, string>> {
    return { ...this._equippedItems };
  }

  /** 当前穿戴中的部件定义（按槽位层序） */
  getEquippedItemDefs(): DressUpItem[] {
    const defs: DressUpItem[] = [];
    for (const slot of DRESSUP_SLOT_ORDER) {
      const id = this._equippedItems[slot];
      if (!id) continue;
      const def = DRESSUP_ITEM_MAP.get(id);
      if (def) defs.push(def);
    }
    return defs;
  }

  isItemUnlocked(itemId: string): boolean { return this._unlockedItems.has(itemId); }

  isItemEquipped(itemId: string): boolean {
    const def = DRESSUP_ITEM_MAP.get(itemId);
    if (!def) return false;
    return this._mode === 'custom' && this._equippedItems[def.slot] === itemId;
  }

  /** 花愿购买解锁部件，成功后自动穿上 */
  unlockItem(itemId: string, options?: { deferStarGrant?: boolean }): boolean {
    if (this._unlockedItems.has(itemId)) return false;
    const item = DRESSUP_ITEM_MAP.get(itemId);
    if (!item) return false;

    const req = checkRequirement(item.unlockRequirement);
    if (!req.met) return false;

    if (item.huayuanCost > 0) {
      if (CurrencyManager.state.huayuan < item.huayuanCost) return false;
      CurrencyManager.addHuayuan(-item.huayuanCost);
    }
    if ((item.starValue ?? 0) > 0 && !options?.deferStarGrant) {
      CurrencyManager.addStar(item.starValue!);
    }

    this._unlockedItems.add(itemId);
    EventBus.emit('dressup:itemUnlocked', itemId, item);
    this.equipItem(itemId);
    return true;
  }

  /**
   * 穿上部件（进入/保持 custom 模式；同槽位替换）。
   * 首次进入 custom 时用免费基本套补齐空槽位，避免光板尴尬。
   */
  equipItem(itemId: string): boolean {
    const item = DRESSUP_ITEM_MAP.get(itemId);
    if (!item || !this._unlockedItems.has(itemId)) return false;
    if (this._mode !== 'custom') this._enterCustomMode();
    this._equippedItems[item.slot] = itemId;
    this._saveState();
    EventBus.emit('dressup:itemsChanged');
    return true;
  }

  /** 脱下某槽位部件（发型/上衣/下装/鞋子脱下后回退基本款，妆容/饰品可空） */
  unequipSlot(slot: DressUpSlot): boolean {
    if (this._mode !== 'custom' || !this._equippedItems[slot]) return false;
    const fallback = DRESSUP_DEFAULT_EQUIPPED[slot];
    if (fallback && this._equippedItems[slot] !== fallback) {
      this._equippedItems[slot] = fallback;
    } else if (!fallback) {
      delete this._equippedItems[slot];
    } else {
      return false;
    }
    this._saveState();
    EventBus.emit('dressup:itemsChanged');
    return true;
  }

  /** GM/活动直接赠送部件（不扣花愿、不加星、不自动穿上） */
  gmGrantItem(itemId: string): boolean {
    if (!DRESSUP_ITEM_MAP.has(itemId) || this._unlockedItems.has(itemId)) return false;
    this._unlockedItems.add(itemId);
    this._saveState();
    EventBus.emit('dressup:itemUnlocked', itemId, DRESSUP_ITEM_MAP.get(itemId));
    return true;
  }

  private _enterCustomMode(): void {
    this._mode = 'custom';
    for (const slot of DRESSUP_SLOT_ORDER) {
      if (this._equippedItems[slot]) continue;
      const fallback = DRESSUP_DEFAULT_EQUIPPED[slot];
      if (fallback && this._unlockedItems.has(fallback)) {
        this._equippedItems[slot] = fallback;
      }
    }
  }

  /** 获取当前穿戴的形象 */
  getEquipped(): Outfit | null {
    return OUTFIT_MAP.get(this._equippedId) || null;
  }

  /** 是否已解锁 */
  isUnlocked(outfitId: string): boolean { return this._unlocked.has(outfitId); }

  isAdUnlockOutfit(outfitId: string): boolean {
    return AD_UNLOCK_OUTFIT_IDS.has(outfitId);
  }

  isAdPurchaseGateSatisfied(outfitId: string): boolean {
    return this._adPurchaseGates.has(outfitId);
  }

  /** 是否满足花愿购买前置（等级/任务 + 广告 gate） */
  canPurchaseOutfit(outfitId: string): boolean {
    const outfit = OUTFIT_MAP.get(outfitId);
    if (!outfit) return false;
    const req = checkRequirement(outfit.unlockRequirement);
    if (!req.met) return false;
    if (this.isAdUnlockOutfit(outfitId)) {
      return this.isAdPurchaseGateSatisfied(outfitId);
    }
    return true;
  }

  /** 激励视频看完后解锁购买资格（不扣花愿、不加星） */
  unlockAdPurchaseGate(outfitId: string): boolean {
    const outfit = OUTFIT_MAP.get(outfitId);
    if (!outfit || !this.isAdUnlockOutfit(outfitId)) return false;
    if (this._unlocked.has(outfitId)) return false;
    this._adPurchaseGates.add(outfitId);
    this._saveState();
    console.log(`[DressUp] 广告解锁购买资格: ${outfit.name}`);
    EventBus.emit('dressup:adUnlockGate', outfitId, outfit);
    return true;
  }

  get unlockedCount(): number { return this._unlocked.size; }
  get totalCount(): number { return DRESSUP_PANEL_OUTFITS.length; }

  // ═══════════════ 存档 ═══════════════

  private _saveState(): void {
    const data: DressUpSave = {
      unlocked: Array.from(this._unlocked),
      equipped: this._equippedId,
      adPurchaseGates: [...this._adPurchaseGates],
      mode: this._mode,
      unlockedItems: Array.from(this._unlockedItems),
      equippedItems: { ...this._equippedItems },
    };
    PersistService.writeRaw(STORAGE_KEY, JSON.stringify(data));
  }

  private _loadState(): void {
    try {
      const raw = PersistService.readRaw(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw) as Partial<DressUpSave> & {
        // 兼容旧版 equipped: Record<slot, id> 结构
        equipped?: string | Record<string, string>;
      };

      // 恢复已解锁列表，过滤掉旧版单品 id（不在新列表中的直接忽略）
      if (Array.isArray(data.unlocked)) {
        data.unlocked.forEach(id => {
          if (OUTFIT_MAP.has(id)) this._unlocked.add(id);
        });
      }

      if (typeof data.equipped === 'string' && OUTFIT_MAP.has(data.equipped)) {
        this._equippedId = data.equipped as string;
      }
      if (Array.isArray(data.adPurchaseGates)) {
        for (const id of data.adPurchaseGates) {
          if (AD_UNLOCK_OUTFIT_IDS.has(id)) this._adPurchaseGates.add(id);
        }
      }

      // 分部件模式字段（缺省 = outfit 旧档）
      if (Array.isArray(data.unlockedItems)) {
        for (const id of data.unlockedItems) {
          if (DRESSUP_ITEM_MAP.has(id)) this._unlockedItems.add(id);
        }
      }
      if (data.equippedItems && typeof data.equippedItems === 'object') {
        for (const slot of DRESSUP_SLOT_ORDER) {
          const id = data.equippedItems[slot];
          if (id && DRESSUP_ITEM_MAP.has(id) && this._unlockedItems.has(id)) {
            this._equippedItems[slot] = id;
          }
        }
      }
      if (data.mode === 'custom') this._mode = 'custom';
    } catch (_) {}
  }
}

export const DressUpManager = new DressUpManagerClass();
