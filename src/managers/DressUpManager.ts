/**
 * 店主换装系统管理器
 *
 * 换装部件：发型、上装、下装、配饰、特效
 * 用"花露"（稀缺货币）解锁新服装
 * 部分服装通过收集/成就/活动获得
 */
import { EventBus } from '@/core/EventBus';
import { Platform } from '@/core/PlatformService';
import { CurrencyManager } from './CurrencyManager';

const STORAGE_KEY = 'huahua_dressup';

/** 换装槽位 */
export type DressUpSlot = 'hair' | 'top' | 'bottom' | 'accessory' | 'effect';

/** 服装项定义 */
export interface CostumeItem {
  id: string;
  slot: DressUpSlot;
  name: string;
  icon: string;
  desc: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  /** 花露解锁价格（0=免费/任务获得） */
  hualuCost: number;
  /** 解锁条件说明（如"集齐日常花系"） */
  unlockCondition?: string;
}

/** 全部服装配置 */
const ALL_COSTUMES: CostumeItem[] = [
  // ── 发型 ──
  { id: 'hair_default',  slot: 'hair', name: '自然长发',   icon: '💇‍♀️', desc: '清新自然的长发', rarity: 'common', hualuCost: 0 },
  { id: 'hair_short',    slot: 'hair', name: '俏丽短发',   icon: '💇',   desc: '干练时尚的短发', rarity: 'common', hualuCost: 5 },
  { id: 'hair_twin',     slot: 'hair', name: '双马尾',     icon: '🎀',   desc: '可爱活力的双马尾', rarity: 'rare', hualuCost: 12 },
  { id: 'hair_bun',      slot: 'hair', name: '优雅盘发',   icon: '👩',   desc: '典雅知性的盘发', rarity: 'rare', hualuCost: 15 },
  { id: 'hair_sakura',   slot: 'hair', name: '樱花发饰',   icon: '🌸',   desc: '春日限定樱花装饰', rarity: 'epic', hualuCost: 25 },
  { id: 'hair_crown',    slot: 'hair', name: '花冠',       icon: '👑',   desc: '花之女王的王冠', rarity: 'legendary', hualuCost: 50, unlockCondition: '集齐全部花语卡片' },

  // ── 上装 ──
  { id: 'top_default',   slot: 'top', name: '花店围裙',    icon: '👕',  desc: '温馨的花店标配', rarity: 'common', hualuCost: 0 },
  { id: 'top_sailor',    slot: 'top', name: '水手领衬衫',  icon: '⛵',  desc: '清爽的海军风', rarity: 'common', hualuCost: 8 },
  { id: 'top_lace',      slot: 'top', name: '蕾丝上衣',    icon: '🎀',  desc: '精致甜美的蕾丝', rarity: 'rare', hualuCost: 15 },
  { id: 'top_kimono',    slot: 'top', name: '和风上衣',    icon: '🎐',  desc: '东洋风情', rarity: 'rare', hualuCost: 18 },
  { id: 'top_evening',   slot: 'top', name: '晚宴礼服',    icon: '✨',  desc: '华丽的晚宴装束', rarity: 'epic', hualuCost: 30 },

  // ── 下装 ──
  { id: 'btm_default',   slot: 'bottom', name: '田园长裙',  icon: '👗',  desc: '自然恬淡的田园风', rarity: 'common', hualuCost: 0 },
  { id: 'btm_plaid',     slot: 'bottom', name: '格子短裙',  icon: '🏴',  desc: '英伦格子风', rarity: 'common', hualuCost: 8 },
  { id: 'btm_jeans',     slot: 'bottom', name: '牛仔短裤',  icon: '👖',  desc: '休闲自在', rarity: 'rare', hualuCost: 12 },
  { id: 'btm_tutu',      slot: 'bottom', name: '蓬蓬纱裙',  icon: '💃',  desc: '少女心爆棚', rarity: 'epic', hualuCost: 22 },

  // ── 配饰 ──
  { id: 'acc_none',       slot: 'accessory', name: '无配饰',    icon: '🔲',  desc: '清爽无配饰', rarity: 'common', hualuCost: 0 },
  { id: 'acc_ribbon',     slot: 'accessory', name: '缎带蝴蝶结', icon: '🎀',  desc: '可爱的蝴蝶结', rarity: 'common', hualuCost: 5 },
  { id: 'acc_glasses',    slot: 'accessory', name: '文艺圆眼镜', icon: '👓',  desc: '知性文艺范', rarity: 'rare', hualuCost: 10 },
  { id: 'acc_necklace',   slot: 'accessory', name: '花朵项链',   icon: '📿',  desc: '精致的花朵吊坠', rarity: 'rare', hualuCost: 15 },
  { id: 'acc_wings',      slot: 'accessory', name: '蝴蝶翅膀',   icon: '🦋',  desc: '梦幻的蝶翼背饰', rarity: 'legendary', hualuCost: 40 },

  // ── 特效 ──
  { id: 'fx_none',        slot: 'effect', name: '无特效',      icon: '⬜',  desc: '无特效', rarity: 'common', hualuCost: 0 },
  { id: 'fx_sparkle',     slot: 'effect', name: '闪闪发光',    icon: '✨',  desc: '身边闪烁星星', rarity: 'rare', hualuCost: 20 },
  { id: 'fx_petals',      slot: 'effect', name: '花瓣飘落',    icon: '🌸',  desc: '身边飘落花瓣', rarity: 'epic', hualuCost: 30 },
  { id: 'fx_aura',        slot: 'effect', name: '金色光环',    icon: '🌟',  desc: '传说中的光环', rarity: 'legendary', hualuCost: 60 },
];

interface DressUpSave {
  unlocked: string[];
  equipped: Record<DressUpSlot, string>;
}

class DressUpManagerClass {
  /** 已解锁的服装ID */
  private _unlocked: Set<string> = new Set();
  /** 当前装备（每个槽位的服装ID） */
  private _equipped: Record<DressUpSlot, string> = {
    hair: 'hair_default',
    top: 'top_default',
    bottom: 'btm_default',
    accessory: 'acc_none',
    effect: 'fx_none',
  };

  init(): void {
    // 默认解锁
    ['hair_default', 'top_default', 'btm_default', 'acc_none', 'fx_none'].forEach(id => {
      this._unlocked.add(id);
    });
    this._loadState();
    console.log(`[DressUp] 初始化完成, 解锁 ${this._unlocked.size}/${ALL_COSTUMES.length} 件服装`);
  }

  /** 获取所有服装 */
  getAllCostumes(): CostumeItem[] { return ALL_COSTUMES; }

  /** 获取某槽位的所有服装 */
  getCostumesForSlot(slot: DressUpSlot): (CostumeItem & { unlocked: boolean; equipped: boolean })[] {
    return ALL_COSTUMES
      .filter(c => c.slot === slot)
      .map(c => ({
        ...c,
        unlocked: this._unlocked.has(c.id),
        equipped: this._equipped[c.slot] === c.id,
      }));
  }

  /** 解锁服装 */
  unlock(costumeId: string): boolean {
    if (this._unlocked.has(costumeId)) return false;

    const costume = ALL_COSTUMES.find(c => c.id === costumeId);
    if (!costume) return false;

    if (costume.hualuCost > 0) {
      if (CurrencyManager.state.hualu < costume.hualuCost) return false;
      CurrencyManager.addHualu(-costume.hualuCost);
    }

    this._unlocked.add(costumeId);
    this._saveState();
    EventBus.emit('dressup:unlocked', costumeId, costume);
    return true;
  }

  /** 免费解锁（成就/活动奖励） */
  grantCostume(costumeId: string): boolean {
    if (this._unlocked.has(costumeId)) return false;
    this._unlocked.add(costumeId);
    this._saveState();
    EventBus.emit('dressup:unlocked', costumeId);
    return true;
  }

  /** 装备服装 */
  equip(costumeId: string): boolean {
    if (!this._unlocked.has(costumeId)) return false;
    const costume = ALL_COSTUMES.find(c => c.id === costumeId);
    if (!costume) return false;

    this._equipped[costume.slot] = costumeId;
    this._saveState();
    EventBus.emit('dressup:equipped', costume.slot, costumeId);
    return true;
  }

  /** 获取当前装备 */
  getEquipped(slot: DressUpSlot): CostumeItem | null {
    const id = this._equipped[slot];
    return ALL_COSTUMES.find(c => c.id === id) || null;
  }

  /** 获取所有当前装备 */
  getAllEquipped(): Record<DressUpSlot, CostumeItem | null> {
    const result: any = {};
    for (const slot of ['hair', 'top', 'bottom', 'accessory', 'effect'] as DressUpSlot[]) {
      result[slot] = this.getEquipped(slot);
    }
    return result;
  }

  /** 已解锁数量 */
  get unlockedCount(): number { return this._unlocked.size; }
  get totalCount(): number { return ALL_COSTUMES.length; }
  get isAllUnlocked(): boolean { return this._unlocked.size >= ALL_COSTUMES.length; }

  /** 是否已解锁 */
  isUnlocked(costumeId: string): boolean { return this._unlocked.has(costumeId); }

  // ═══════════════ 存档 ═══════════════

  private _saveState(): void {
    const data: DressUpSave = {
      unlocked: Array.from(this._unlocked),
      equipped: { ...this._equipped },
    };
    Platform.setStorageSync(STORAGE_KEY, JSON.stringify(data));
  }

  private _loadState(): void {
    try {
      const raw = Platform.getStorageSync(STORAGE_KEY);
      if (!raw) return;
      const data: DressUpSave = JSON.parse(raw);
      if (data.unlocked) data.unlocked.forEach(id => this._unlocked.add(id));
      if (data.equipped) Object.assign(this._equipped, data.equipped);
    } catch (_) {}
  }
}

export const DressUpManager = new DressUpManagerClass();
