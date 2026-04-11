/**
 * 图鉴收集管理器
 *
 * 7 大收集分类：
 * -  花系图鉴（鲜花/花束/绿植/包装，总数随 ItemConfig）
 * -  饮品图鉴（蝴蝶标本 / 冷饮 / 甜品，级数见 ItemConfig）
 * -  建筑图鉴（13种）
 * -  宝箱图鉴（宝箱5级 + 红包4级，合成或散落至棋盘时解锁）
 * -  客人图鉴（来访即解锁）
 * -  装饰图鉴（基于装修系统）
 * -  花语卡片（与 FlowerCardManager.FLOWER_QUOTES 条目一致，首次合成解锁）
 *
 * 收集里程碑奖励：25% / 50% / 75% / 100%
 */
import { EventBus } from '@/core/EventBus';
import { Platform } from '@/core/PlatformService';
import { CellState } from '@/config/BoardLayout';
import { ITEM_DEFS, Category } from '@/config/ItemConfig';
import { CUSTOMER_TYPES } from '@/config/CustomerConfig';
import { CurrencyManager } from './CurrencyManager';
import { BoardManager } from './BoardManager';
import { FLOWER_CARD_TRACKED_TOTAL } from './FlowerCardManager';

const STORAGE_KEY = 'huahua_collection';

/** 收集分类 */
export enum CollectionCategory {
  FLOWER = 'flower',
  DRINK = 'drink',
  BUILDING = 'building',
  CHEST = 'chest',
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
  { percent: 25,  gold: 0,  diamond: 18,  huayuan: 0,  desc: ' 初识花语' },
  { percent: 50,  gold: 0,  diamond: 35, huayuan: 0,  desc: ' 花艺学徒' },
  { percent: 75,  gold: 0, diamond: 55, huayuan: 0,  desc: ' 花艺大师' },
  { percent: 100, gold: 0, diamond: 85, huayuan: 0, desc: ' 花语传说' },
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
    // 开局/读档格上的物品不经 placeItem，须补记图鉴（如初始铲子合成后链上仍问号）
    this._syncOpenBoardDiscoveries();
    console.log(`[Collection] 初始化完成, 总收集: ${this.totalDiscovered}/${this.totalCount}`);
  }

  /**
   * 将当前棋盘上「已开放格」内的物品记入图鉴（与 `board:itemPlaced` 规则一致）。
   * 仅 OPEN：半解锁/迷雾内预置物不视为已获得。
   */
  private _syncOpenBoardDiscoveries(): void {
    for (const cell of BoardManager.cells) {
      if (cell.state === CellState.OPEN && cell.itemId) {
        this._registerItemDiscoveryFromBoard(cell.itemId);
      }
    }
  }

  private _bindEvents(): void {
    // 合成结果（merge 直接改格子，不走 placeItem）
    EventBus.on('board:merged', (_s: number, _d: number, resultId: string) => {
      this._registerItemDiscoveryFromBoard(resultId);
    });

    // 工具产出 / 宝箱散落 / 仓库取出等 → BoardManager.placeItem
    EventBus.on('board:itemPlaced', (_index: number, itemId: string) => {
      this._registerItemDiscoveryFromBoard(itemId);
    });

    // 建筑放置
    EventBus.on('board:buildingConverted', (_idx: number, _matId: string, buildingId: string) => {
      this._discover(CollectionCategory.BUILDING, buildingId);
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

  }

  /**
   * 棋盘上首次出现该物品时记入图鉴：合成结果 + 任意 placeItem（含 1 级工具产出）。
   * 与 board:merged 规则一致；花束额外记花语卡片分类。
   */
  private _registerItemDiscoveryFromBoard(itemId: string): void {
    const def = ITEM_DEFS.get(itemId);
    if (!def) return;

    if (def.category === Category.FLOWER) {
      this._discover(CollectionCategory.FLOWER, itemId);
      this._discover(CollectionCategory.FLOWER_CARD, itemId);
    } else if (def.category === Category.DRINK) {
      this._discover(CollectionCategory.DRINK, itemId);
    } else if (def.category === Category.BUILDING) {
      this._discover(CollectionCategory.BUILDING, itemId);
    } else if (def.category === Category.CHEST) {
      this._discover(CollectionCategory.CHEST, itemId);
    }
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
    CurrencyManager.addDiamond(ms.diamond);

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
      case CollectionCategory.FLOWER: {
        let n = 0;
        for (const def of ITEM_DEFS.values()) {
          if (def.category === Category.FLOWER) n++;
        }
        return n;
      }
      case CollectionCategory.DRINK: return 9;
      case CollectionCategory.BUILDING: return 13;
      case CollectionCategory.CHEST: return 9;
      case CollectionCategory.CUSTOMER: return CUSTOMER_TYPES.length;
      case CollectionCategory.DECORATION: return 72; // 装饰总数
      case CollectionCategory.FLOWER_CARD: return FLOWER_CARD_TRACKED_TOTAL;
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
