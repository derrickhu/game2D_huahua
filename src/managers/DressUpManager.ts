/**
 * 店主换装系统管理器（整套形象版）
 *
 * 玩家一次解锁整套形象，无需逐件搭配
 * 用"花露"（稀缺货币）解锁，部分形象通过成就/活动/合成进度赠送
 */
import { EventBus } from '@/core/EventBus';
import { Platform } from '@/core/PlatformService';
import { CurrencyManager } from './CurrencyManager';

const STORAGE_KEY = 'huahua_dressup';

/** 整套形象定义 */
export interface Outfit {
  id: string;
  name: string;
  desc: string;
  /** 代表整套形象的 emoji，显示在店主头像上 */
  icon: string;
  /** 花露解锁价格（0 = 免费/赠送） */
  hualuCost: number;
  /** 解锁条件说明（用于 UI 展示） */
  unlockCondition?: string;
}

/** 全部形象配置 */
const ALL_OUTFITS: Outfit[] = [
  { id: 'outfit_default',  name: '自然少女',    desc: '清新自然，田园花店的日常装扮',              icon: '👗', hualuCost: 0 },
  { id: 'outfit_florist',  name: '花店小姐姐',  desc: '专业花艺师的精致工装，满满花香',            icon: '💐', hualuCost: 15 },
  { id: 'outfit_spring',   name: '春日樱花',    desc: '樱花盛开的季节，粉嫩少女感满分',           icon: '🌸', hualuCost: 30 },
  { id: 'outfit_summer',   name: '夏日向日葵',  desc: '明媚阳光下，活力四射的夏日装扮',           icon: '🌻', hualuCost: 30 },
  { id: 'outfit_vintage',  name: '复古花坊',    desc: '优雅复古的欧式风情，精致迷人',             icon: '🎀', hualuCost: 50 },
  { id: 'outfit_queen',    name: '花之女王',    desc: '传说中的花神降临，集齐全部花语卡片解锁',    icon: '👑', hualuCost: 0, unlockCondition: '集齐全部花语卡片' },
];

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

  /** 花露购买解锁，成功后自动装备 */
  unlock(outfitId: string): boolean {
    if (this._unlocked.has(outfitId)) return false;

    const outfit = ALL_OUTFITS.find(o => o.id === outfitId);
    if (!outfit) return false;

    if (outfit.hualuCost > 0) {
      if (CurrencyManager.state.hualu < outfit.hualuCost) return false;
      CurrencyManager.addHualu(-outfit.hualuCost);
    }

    this._unlocked.add(outfitId);
    this._equippedId = outfitId;
    this._saveState();
    EventBus.emit('dressup:unlocked', outfitId, outfit);
    EventBus.emit('dressup:equipped', outfitId);
    return true;
  }

  /** 免费赠送（成就/活动/合成奖励），成功后自动装备 */
  grantOutfit(outfitId: string): boolean {
    const outfit = ALL_OUTFITS.find(o => o.id === outfitId);
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
    return ALL_OUTFITS.find(o => o.id === this._equippedId) || null;
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
          if (ALL_OUTFITS.some(o => o.id === id)) this._unlocked.add(id);
        });
      }

      // 兼容旧版 equipped（Record 结构 → 忽略，回退默认）
      if (typeof data.equipped === 'string' && ALL_OUTFITS.some(o => o.id === data.equipped)) {
        this._equippedId = data.equipped as string;
      }
    } catch (_) {}
  }
}

export const DressUpManager = new DressUpManagerClass();
