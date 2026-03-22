/**
 * 图鉴收集管理器
 *
 * 6大收集分类：
 * - 🌸 花束图鉴（18种）
 * - 🍵 花饮图鉴（9种）
 * - 🏠 建筑图鉴（13种）
 * - 👤 客人图鉴（基于熟客系统）
 * - 🪑 装饰图鉴（基于装修系统）
 * - 🌸 花语卡片（18张，首次合成解锁）
 *
 * 收集里程碑奖励：25% / 50% / 75% / 100%
 */
import { EventBus } from '@/core/EventBus';
import { Platform } from '@/core/PlatformService';
import { ITEM_DEFS, Category } from '@/config/ItemConfig';
import { CurrencyManager } from './CurrencyManager';

const STORAGE_KEY = 'huahua_collection';

/** 收集分类 */
export enum CollectionCategory {
  FLOWER = 'flower',
  DRINK = 'drink',
  BUILDING = 'building',
  CUSTOMER = 'customer',
  DECORATION = 'decoration',
  FLOWER_CARD = 'flower_card',
}

/** 里程碑奖励 */
interface MilestoneReward {
  percent: number;
  gold: number;
  diamond: number;
  huayuan: number;
  desc: string;
}

const MILESTONES: MilestoneReward[] = [
  { percent: 25,  gold: 200,  diamond: 5,  huayuan: 0,  desc: '🌱 初识花语' },
  { percent: 50,  gold: 500,  diamond: 15, huayuan: 3,  desc: '🌿 花艺学徒' },
  { percent: 75,  gold: 1000, diamond: 30, huayuan: 8,  desc: '🌺 花艺大师' },
  { percent: 100, gold: 2000, diamond: 50, huayuan: 20, desc: '🌸 花语传说' },
];

interface CollectionSave {
  discovered: Record<string, string[]>;  // category → itemId[]
  claimedMilestones: number[];           // 已领取的里程碑百分比
}

class CollectionManagerClass {
  /** 已发现的物品（分类→ID集合） */
  private _discovered: Map<CollectionCategory, Set<string>> = new Map();
  /** 已领取的里程碑 */
  private _claimedMilestones: Set<number> = new Set();

  init(): void {
    // 初始化各分类
    for (const cat of Object.values(CollectionCategory)) {
      this._discovered.set(cat, new Set());
    }
    this._loadState();
    this._bindEvents();
    console.log(`[Collection] 初始化完成, 总收集: ${this.totalDiscovered}/${this.totalCount}`);
  }

  private _bindEvents(): void {
    // 合成成功→记录花束/花饮
    EventBus.on('board:merged', (_s: number, _d: number, resultId: string) => {
      const def = ITEM_DEFS.get(resultId);
      if (!def) return;

      if (def.category === Category.FLOWER) {
        this._discover(CollectionCategory.FLOWER, resultId);
      } else if (def.category === Category.DRINK) {
        this._discover(CollectionCategory.DRINK, resultId);
      } else if (def.category === Category.BUILDING) {
        this._discover(CollectionCategory.BUILDING, resultId);
      }
    });

    // 建筑放置
    EventBus.on('board:buildingConverted', (_idx: number, _matId: string, buildingId: string) => {
      this._discover(CollectionCategory.BUILDING, buildingId);
    });

    // 花语彩蛋触发→记录花语卡片
    EventBus.on('board:merged', (_s: number, _d: number, resultId: string) => {
      const def = ITEM_DEFS.get(resultId);
      if (def && def.category === Category.FLOWER) {
        this._discover(CollectionCategory.FLOWER_CARD, resultId);
      }
    });

    // 客人来访→记录客人
    EventBus.on('customer:arrived', (customer: any) => {
      if (customer?.typeId) {
        this._discover(CollectionCategory.CUSTOMER, customer.typeId);
      }
    });

    // 装饰解锁→记录
    EventBus.on('decoration:unlocked', (decoId: string) => {
      this._discover(CollectionCategory.DECORATION, decoId);
    });

    // 熟客关系升级
    EventBus.on('regular:favorLevelUp', (typeId: string) => {
      this._discover(CollectionCategory.CUSTOMER, typeId);
    });
  }

  /** 发现新物品 */
  private _discover(category: CollectionCategory, itemId: string): void {
    const set = this._discovered.get(category);
    if (!set) return;
    if (set.has(itemId)) return;

    set.add(itemId);
    this._saveState();

    EventBus.emit('collection:discovered', category, itemId);
    console.log(`[Collection] 新发现: ${category} → ${itemId}, 总进度: ${this.totalDiscovered}/${this.totalCount}`);

    // 检查里程碑
    this._checkMilestones();
  }

  /** 检查并发放里程碑奖励 */
  private _checkMilestones(): void {
    const percent = Math.floor(this.progressPercent);
    for (const ms of MILESTONES) {
      if (percent >= ms.percent && !this._claimedMilestones.has(ms.percent)) {
        // 不自动领取，等玩家点击
        EventBus.emit('collection:milestoneReady', ms.percent);
      }
    }
  }

  /** 领取里程碑奖励 */
  claimMilestone(percent: number): boolean {
    const ms = MILESTONES.find(m => m.percent === percent);
    if (!ms) return false;
    if (this._claimedMilestones.has(percent)) return false;
    if (this.progressPercent < percent) return false;

    this._claimedMilestones.add(percent);
    CurrencyManager.addGold(ms.gold);
    CurrencyManager.addDiamond(ms.diamond);
    if (ms.huayuan > 0) CurrencyManager.addHuayuan(ms.huayuan);

    this._saveState();
    EventBus.emit('collection:milestoneClaimed', percent, ms);
    return true;
  }

  /** 是否有可领取的里程碑 */
  get hasClaimableMilestone(): boolean {
    const percent = Math.floor(this.progressPercent);
    return MILESTONES.some(ms => percent >= ms.percent && !this._claimedMilestones.has(ms.percent));
  }

  // ═══════════════ 查询 ═══════════════

  /** 获取某分类的已发现数量 */
  getCategoryCount(cat: CollectionCategory): number {
    return this._discovered.get(cat)?.size || 0;
  }

  /** 获取某分类的总数 */
  getCategoryTotal(cat: CollectionCategory): number {
    switch (cat) {
      case CollectionCategory.FLOWER: return 18;
      case CollectionCategory.DRINK: return 9;
      case CollectionCategory.BUILDING: return 13;
      case CollectionCategory.CUSTOMER: return 6; // 6种熟客
      case CollectionCategory.DECORATION: return 72; // 装饰总数
      case CollectionCategory.FLOWER_CARD: return 18;
      default: return 0;
    }
  }

  /** 是否已发现 */
  isDiscovered(cat: CollectionCategory, itemId: string): boolean {
    return this._discovered.get(cat)?.has(itemId) || false;
  }

  /** 获取某分类的所有已发现ID */
  getDiscoveredIds(cat: CollectionCategory): string[] {
    return Array.from(this._discovered.get(cat) || []);
  }

  /** 总发现数 */
  get totalDiscovered(): number {
    let total = 0;
    for (const set of this._discovered.values()) total += set.size;
    return total;
  }

  /** 总物品数 */
  get totalCount(): number {
    let total = 0;
    for (const cat of Object.values(CollectionCategory)) {
      total += this.getCategoryTotal(cat);
    }
    return total;
  }

  /** 收集进度百分比 */
  get progressPercent(): number {
    const total = this.totalCount;
    return total > 0 ? (this.totalDiscovered / total) * 100 : 0;
  }

  /** 获取里程碑列表 */
  get milestones(): (MilestoneReward & { claimed: boolean })[] {
    return MILESTONES.map(ms => ({
      ...ms,
      claimed: this._claimedMilestones.has(ms.percent),
    }));
  }

  // ═══════════════ 存档 ═══════════════

  private _saveState(): void {
    const discovered: Record<string, string[]> = {};
    for (const [cat, set] of this._discovered) {
      discovered[cat] = Array.from(set);
    }
    const data: CollectionSave = {
      discovered,
      claimedMilestones: Array.from(this._claimedMilestones),
    };
    Platform.setStorageSync(STORAGE_KEY, JSON.stringify(data));
  }

  private _loadState(): void {
    try {
      const raw = Platform.getStorageSync(STORAGE_KEY);
      if (!raw) return;
      const data: CollectionSave = JSON.parse(raw);
      if (data.discovered) {
        for (const [cat, ids] of Object.entries(data.discovered)) {
          const set = this._discovered.get(cat as CollectionCategory);
          if (set && Array.isArray(ids)) {
            ids.forEach(id => set.add(id));
          }
        }
      }
      if (data.claimedMilestones) {
        data.claimedMilestones.forEach(p => this._claimedMilestones.add(p));
      }
    } catch (_) {}
  }
}

export const CollectionManager = new CollectionManagerClass();
