/**
 * 图鉴收集管理器
 *
 * 4 大收集分类（棋盘物品）：
 * - FLOWER：鲜花 / 花束 / 绿植 / 包装（总数随 ItemConfig）
 * - DRINK：蝴蝶标本 / 冷饮 / 甜品
 * - BUILDING：种植工具 / 包装工具 / 捕虫网 / 饮品器具 / 烘焙工具 + 特殊消耗品
 * - CHEST：宝箱 / 红包 / 钻石袋 / 体力箱
 *
 * 图鉴面板按产品线（line）分页展示，每页 4 列物品网格。
 */
import { EventBus } from '@/core/EventBus';
import { PersistService } from '@/core/PersistService';
import { CellState } from '@/config/BoardLayout';
import { ITEM_DEFS, Category, type ItemDef } from '@/config/ItemConfig';
import { BoardManager } from './BoardManager';

const STORAGE_KEY = 'huahua_collection';

/** 收集分类（仅棋盘物品） */
export enum CollectionCategory {
  FLOWER = 'flower',
  DRINK = 'drink',
  BUILDING = 'building',
  CHEST = 'chest',
}

interface CollectionSave {
  discovered: Record<string, string[]>;
  claimedMilestones?: number[];  // 旧版存档兼容，读入后忽略
  claimedPageRewards?: number[];
}

class CollectionManagerClass {
  private _discovered: Map<CollectionCategory, Set<string>> = new Map();
  private _claimedPageRewards: Set<number> = new Set();

  init(): void {
    for (const cat of Object.values(CollectionCategory)) {
      this._discovered.set(cat, new Set());
    }
    this._loadState();
    this._bindEvents();
    this._syncOpenBoardDiscoveries();
    console.log(`[Collection] 初始化完成, 总收集: ${this.totalDiscovered}/${this.totalCount}`);
  }

  private _syncOpenBoardDiscoveries(): void {
    for (const cell of BoardManager.cells) {
      if (cell.state === CellState.OPEN && cell.itemId) {
        this._registerItemDiscoveryFromBoard(cell.itemId);
      }
    }
  }

  private _bindEvents(): void {
    EventBus.on('board:merged', (_s: number, _d: number, resultId: string) => {
      this._registerItemDiscoveryFromBoard(resultId);
    });

    EventBus.on('board:itemPlaced', (_index: number, itemId: string) => {
      this._registerItemDiscoveryFromBoard(itemId);
    });

    EventBus.on('board:buildingConverted', (_idx: number, _matId: string, buildingId: string) => {
      this._discover(CollectionCategory.BUILDING, buildingId);
    });
  }

  private _registerItemDiscoveryFromBoard(itemId: string): void {
    const def = ITEM_DEFS.get(itemId);
    if (!def) return;

    if (def.category === Category.FLOWER) {
      this._discover(CollectionCategory.FLOWER, itemId);
    } else if (def.category === Category.DRINK) {
      this._discover(CollectionCategory.DRINK, itemId);
    } else if (def.category === Category.BUILDING) {
      this._discover(CollectionCategory.BUILDING, itemId);
    } else if (def.category === Category.CHEST) {
      this._discover(CollectionCategory.CHEST, itemId);
    }
  }

  private _discover(category: CollectionCategory, itemId: string): void {
    const set = this._discovered.get(category);
    if (!set) return;
    if (set.has(itemId)) return;

    set.add(itemId);
    this._saveState();

    EventBus.emit('collection:discovered', category, itemId);
    console.log(`[Collection] 新发现: ${category} → ${itemId}, 总进度: ${this.totalDiscovered}/${this.totalCount}`);
  }

  // ═══════════════ 查询 ═══════════════

  getCategoryCount(cat: CollectionCategory): number {
    return this._discovered.get(cat)?.size || 0;
  }

  getCategoryTotal(cat: CollectionCategory): number {
    let n = 0;
    for (const def of ITEM_DEFS.values()) {
      if (def.category === (cat as string)) n++;
    }
    return n;
  }

  isDiscovered(cat: CollectionCategory, itemId: string): boolean {
    return this._discovered.get(cat)?.has(itemId) || false;
  }

  getDiscoveredIds(cat: CollectionCategory): string[] {
    return Array.from(this._discovered.get(cat) || []);
  }

  /** 获取某分类某产品线的全部物品（按 level 排序） */
  getItemsForLine(category: Category, line: string): ItemDef[] {
    const result: ItemDef[] = [];
    for (const def of ITEM_DEFS.values()) {
      if (def.category === category && def.line === line) {
        result.push(def);
      }
    }
    result.sort((a, b) => a.level - b.level);
    return result;
  }

  /** 某产品线的已发现数量 */
  getLineDiscoveredCount(collectionCat: CollectionCategory, category: Category, line: string): number {
    const items = this.getItemsForLine(category, line);
    let count = 0;
    for (const def of items) {
      if (this.isDiscovered(collectionCat, def.id)) count++;
    }
    return count;
  }

  /** 某产品线的总数 */
  getLineTotalCount(category: Category, line: string): number {
    return this.getItemsForLine(category, line).length;
  }

  get totalDiscovered(): number {
    let total = 0;
    for (const set of this._discovered.values()) total += set.size;
    return total;
  }

  get totalCount(): number {
    let total = 0;
    for (const cat of Object.values(CollectionCategory)) {
      total += this.getCategoryTotal(cat);
    }
    return total;
  }

  get progressPercent(): number {
    const total = this.totalCount;
    return total > 0 ? (this.totalDiscovered / total) * 100 : 0;
  }

  isPageRewardClaimed(pageIndex: number): boolean {
    return this._claimedPageRewards.has(pageIndex);
  }

  claimPageReward(pageIndex: number): boolean {
    if (this._claimedPageRewards.has(pageIndex)) return false;
    this._claimedPageRewards.add(pageIndex);
    this._saveState();
    EventBus.emit('collection:pageRewardClaimed', pageIndex);
    return true;
  }

  // ═══════════════ 存档 ═══════════════

  private _saveState(): void {
    const discovered: Record<string, string[]> = {};
    for (const [cat, set] of this._discovered) {
      discovered[cat] = Array.from(set);
    }
    const data: CollectionSave = {
      discovered,
      claimedPageRewards: Array.from(this._claimedPageRewards),
    };
    PersistService.writeRaw(STORAGE_KEY, JSON.stringify(data));
  }

  private _loadState(): void {
    try {
      const raw = PersistService.readRaw(STORAGE_KEY);
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
      if (data.claimedPageRewards && Array.isArray(data.claimedPageRewards)) {
        data.claimedPageRewards.forEach(idx => this._claimedPageRewards.add(idx));
      }
    } catch (_) {}
  }
}

export const CollectionManager = new CollectionManagerClass();
