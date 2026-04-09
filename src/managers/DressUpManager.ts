/**
 * 店主换装系统管理器（整套形象版）
 *
 * 纯运行时逻辑：解锁、装备、存档
 * 形象配置在 config/DressUpConfig.ts
 */
import { EventBus } from '@/core/EventBus';
import { Platform } from '@/core/PlatformService';
import { CurrencyManager } from './CurrencyManager';
import { checkRequirement } from '@/utils/UnlockChecker';
import { ALL_OUTFITS, OUTFIT_ACTIVITY_QUEST_BY_ID, OUTFIT_MAP } from '@/config/DressUpConfig';
import { grantQuest } from '@/utils/UnlockChecker';
import type { Outfit } from '@/config/DressUpConfig';
export type { Outfit } from '@/config/DressUpConfig';

const STORAGE_KEY = 'huahua_dressup';

interface DressUpSave {
  /** 已解锁的形象 id 列表 */
  unlocked: string[];
  /** 当前穿戴的形象 id */
  equipped: string;
}

class DressUpManagerClass {
  private _unlocked: Set<string> = new Set();
  private _equippedId = 'outfit_default';

  init(): void {
    this._unlocked.add('outfit_default');
    this._loadState();
    console.log(`[DressUp] 初始化完成，解锁 ${this._unlocked.size}/${ALL_OUTFITS.length} 套形象，当前穿戴: ${this._equippedId}`);
  }

  /** 获取全部形象（附带解锁/穿戴状态） */
  getAllOutfits(): (Outfit & { unlocked: boolean; equipped: boolean })[] {
    return ALL_OUTFITS.map(o => ({
      ...o,
      unlocked: this._unlocked.has(o.id),
      equipped: this._equippedId === o.id,
    }));
  }

  /** 花愿购买解锁，成功后自动装备 */
  unlock(outfitId: string): boolean {
    if (this._unlocked.has(outfitId)) return false;

    const outfit = OUTFIT_MAP.get(outfitId);
    if (!outfit) return false;

    const req = checkRequirement(outfit.unlockRequirement);
    if (!req.met) return false;

    if (outfit.huayuanCost > 0) {
      if (CurrencyManager.state.huayuan < outfit.huayuanCost) return false;
      CurrencyManager.addHuayuan(-outfit.huayuanCost);
    }
    if (outfit.starValue > 0) {
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

  /** 切换已解锁的形象 */
  equip(outfitId: string): boolean {
    if (!this._unlocked.has(outfitId)) return false;
    this._equippedId = outfitId;
    this._saveState();
    EventBus.emit('dressup:equipped', outfitId);
    return true;
  }

  /** 获取当前穿戴的形象 */
  getEquipped(): Outfit | null {
    return OUTFIT_MAP.get(this._equippedId) || null;
  }

  /** 是否已解锁 */
  isUnlocked(outfitId: string): boolean { return this._unlocked.has(outfitId); }

  get unlockedCount(): number { return this._unlocked.size; }
  get totalCount(): number { return ALL_OUTFITS.length; }

  // ═══════════════ 存档 ═══════════════

  private _saveState(): void {
    const data: DressUpSave = {
      unlocked: Array.from(this._unlocked),
      equipped: this._equippedId,
    };
    Platform.setStorageSync(STORAGE_KEY, JSON.stringify(data));
  }

  private _loadState(): void {
    try {
      const raw = Platform.getStorageSync(STORAGE_KEY);
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
    } catch (_) {}
  }
}

export const DressUpManager = new DressUpManagerClass();
