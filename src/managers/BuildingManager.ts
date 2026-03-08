/**
 * 建筑管理器 - 处理建筑点击产出、CD 冷却、消耗型建筑次数、宝箱系统
 */
import { EventBus } from '@/core/EventBus';
import { BoardManager } from './BoardManager';
import { CurrencyManager } from './CurrencyManager';
import { ITEM_DEFS, Category, findItemId, FlowerLine, DrinkLine, BuildingMatLine } from '@/config/ItemConfig';
import { BOARD_COLS, BOARD_ROWS } from '@/config/Constants';

/** 永久型建筑配置 */
interface PermBuildingDef {
  itemId: string;
  produceCategory: Category;
  produceLines: string[];
  needSelect: boolean;
  produceTable: [number, number][];
  produceCount: number;
  staminaCost: number;
  cooldown: number;
}

/** 消耗型建筑配置 */
interface ConsBuildingDef {
  itemId: string;
  produceCategory: Category;
  produceLines: string[];
  needSelect: boolean;
  produceTable: [number, number][];
  produceCount: number;
  staminaCost: number;
  maxUses: number;
}

/** 宝箱配置 */
interface ChestDef {
  itemId: string;
  produceItems: { category: Category; lines: string[]; levelRange: [number, number] }[];
  staminaCost: number;
  maxUses: number;
}

/** 运行时建筑状态（CD / 剩余次数） */
interface BuildingState {
  cdRemaining: number;
  /** 剩余使用次数，-1 表示永久型 */
  usesLeft: number;
}

// ---- 永久型建筑定义 ----
const PERM_BUILDINGS: PermBuildingDef[] = [
  {
    itemId: 'building_perm_1',
    produceCategory: Category.FLOWER,
    produceLines: [FlowerLine.DAILY],
    needSelect: false,
    produceTable: [[1, 70], [2, 25], [3, 5]],
    produceCount: 1,
    staminaCost: 3,
    cooldown: 30,
  },
  {
    itemId: 'building_perm_2',
    produceCategory: Category.FLOWER,
    produceLines: [FlowerLine.DAILY, FlowerLine.ROMANTIC],
    needSelect: true,
    produceTable: [[1, 30], [2, 30], [3, 20], [4, 10], [5, 10]],
    produceCount: 1,
    staminaCost: 5,
    cooldown: 120,
  },
  {
    itemId: 'building_perm_3',
    produceCategory: Category.FLOWER,
    produceLines: [FlowerLine.ROMANTIC, FlowerLine.LUXURY],
    needSelect: true,
    produceTable: [[1, 25], [2, 30], [3, 25], [4, 10], [5, 10]],
    produceCount: 1,
    staminaCost: 8,
    cooldown: 300,
  },
  {
    itemId: 'building_perm_4',
    produceCategory: Category.FLOWER,
    produceLines: [FlowerLine.DAILY, FlowerLine.ROMANTIC, FlowerLine.LUXURY],
    needSelect: true,
    produceTable: [[3, 20], [4, 20], [5, 40], [6, 20]],
    produceCount: 1,
    staminaCost: 12,
    cooldown: 600,
  },
  {
    itemId: 'building_perm_5',
    produceCategory: Category.DRINK,
    produceLines: [DrinkLine.TEA],
    needSelect: false,
    produceTable: [[1, 70], [2, 25], [3, 5]],
    produceCount: 1,
    staminaCost: 3,
    cooldown: 30,
  },
  {
    itemId: 'building_perm_6',
    produceCategory: Category.DRINK,
    produceLines: [DrinkLine.TEA, DrinkLine.COLD],
    needSelect: true,
    produceTable: [[1, 55], [2, 35], [3, 10]],
    produceCount: 1,
    staminaCost: 5,
    cooldown: 120,
  },
  {
    itemId: 'building_perm_7',
    produceCategory: Category.DRINK,
    produceLines: [DrinkLine.TEA, DrinkLine.COLD, DrinkLine.DESSERT],
    needSelect: true,
    produceTable: [[1, 40], [2, 35], [3, 25]],
    produceCount: 1,
    staminaCost: 8,
    cooldown: 300,
  },
];

// ---- 消耗型建筑定义 ----
const CONS_BUILDINGS: ConsBuildingDef[] = [
  {
    itemId: 'building_cons_1',
    produceCategory: Category.FLOWER,
    produceLines: [FlowerLine.DAILY, FlowerLine.ROMANTIC, FlowerLine.LUXURY],
    needSelect: false,
    produceTable: [[1, 100]],
    produceCount: 1,
    staminaCost: 2,
    maxUses: 5,
  },
  {
    itemId: 'building_cons_2',
    produceCategory: Category.FLOWER,
    produceLines: [FlowerLine.DAILY, FlowerLine.ROMANTIC, FlowerLine.LUXURY],
    needSelect: true,
    produceTable: [[1, 40], [2, 40], [3, 20]],
    produceCount: 1,
    staminaCost: 4,
    maxUses: 4,
  },
  {
    itemId: 'building_cons_3',
    produceCategory: Category.FLOWER,
    produceLines: [FlowerLine.DAILY, FlowerLine.ROMANTIC, FlowerLine.LUXURY],
    needSelect: true,
    produceTable: [[3, 40], [4, 40], [5, 20]],
    produceCount: 1,
    staminaCost: 6,
    maxUses: 3,
  },
  {
    itemId: 'building_cons_4',
    produceCategory: Category.DRINK,
    produceLines: [DrinkLine.TEA, DrinkLine.COLD, DrinkLine.DESSERT],
    needSelect: false,
    produceTable: [[1, 100]],
    produceCount: 1,
    staminaCost: 2,
    maxUses: 5,
  },
  {
    itemId: 'building_cons_5',
    produceCategory: Category.DRINK,
    produceLines: [DrinkLine.TEA, DrinkLine.COLD, DrinkLine.DESSERT],
    needSelect: true,
    produceTable: [[1, 50], [2, 50]],
    produceCount: 1,
    staminaCost: 4,
    maxUses: 4,
  },
  {
    itemId: 'building_cons_6',
    produceCategory: Category.DRINK,
    produceLines: [DrinkLine.TEA, DrinkLine.COLD, DrinkLine.DESSERT],
    needSelect: true,
    produceTable: [[2, 50], [3, 50]],
    produceCount: 1,
    staminaCost: 6,
    maxUses: 3,
  },
];

// ---- 宝箱定义 ----
const CHEST_DEFS: ChestDef[] = [
  {
    itemId: 'chest_1',
    produceItems: [
      { category: Category.BUILDING_MAT, lines: [BuildingMatLine.FLOWER_BUILD, BuildingMatLine.DRINK_BUILD], levelRange: [1, 1] },
    ],
    staminaCost: 2,
    maxUses: 3,
  },
  {
    itemId: 'chest_2',
    produceItems: [
      { category: Category.BUILDING_MAT, lines: [BuildingMatLine.FLOWER_BUILD, BuildingMatLine.DRINK_BUILD], levelRange: [1, 2] },
      { category: Category.FLOWER, lines: [FlowerLine.DAILY, FlowerLine.ROMANTIC], levelRange: [1, 2] },
    ],
    staminaCost: 3,
    maxUses: 4,
  },
  {
    itemId: 'chest_3',
    produceItems: [
      { category: Category.BUILDING_MAT, lines: [BuildingMatLine.FLOWER_BUILD, BuildingMatLine.DRINK_BUILD], levelRange: [1, 3] },
      { category: Category.FLOWER, lines: [FlowerLine.DAILY, FlowerLine.ROMANTIC, FlowerLine.LUXURY], levelRange: [2, 3] },
    ],
    staminaCost: 5,
    maxUses: 3,
  },
];

class BuildingManagerClass {
  private _states = new Map<number, BuildingState>();

  /** 判断某个物品是否是建筑 */
  isBuildingItem(itemId: string): boolean {
    return !!this._findPermDef(itemId) || !!this._findConsDef(itemId);
  }

  /** 判断某个物品是否是宝箱 */
  isChestItem(itemId: string): boolean {
    return !!this._findChestDef(itemId);
  }

  /** 判断某个物品是否可点击交互（建筑 / 宝箱） */
  isInteractable(itemId: string): boolean {
    return this.isBuildingItem(itemId) || this.isChestItem(itemId);
  }

  /** 判断某个格子上的建筑/宝箱是否可以点击产出 */
  canProduce(cellIndex: number): boolean {
    const cell = BoardManager.getCellByIndex(cellIndex);
    if (!cell?.itemId || cell.state !== 'open') return false;
    if (!this.isInteractable(cell.itemId)) return false;

    const state = this._getOrCreateState(cellIndex, cell.itemId);
    if (state.cdRemaining > 0) return false;
    if (state.usesLeft === 0) return false;

    return true;
  }

  /**
   * 点击建筑/宝箱产出物品
   * @returns 产出结果，null 表示失败
   */
  produce(cellIndex: number, selectedLine?: string): { itemId: string; targetIndex: number } | null {
    const cell = BoardManager.getCellByIndex(cellIndex);
    if (!cell?.itemId || cell.state !== 'open') return null;

    const permDef = this._findPermDef(cell.itemId);
    const consDef = this._findConsDef(cell.itemId);
    const chestDef = this._findChestDef(cell.itemId);
    if (!permDef && !consDef && !chestDef) return null;

    const staminaCost = permDef?.staminaCost ?? consDef?.staminaCost ?? chestDef!.staminaCost;

    const state = this._getOrCreateState(cellIndex, cell.itemId);
    if (state.cdRemaining > 0) {
      console.log(`[Building] CD 冷却中，剩余 ${state.cdRemaining.toFixed(0)}s`);
      EventBus.emit('building:onCooldown', cellIndex, state.cdRemaining);
      return null;
    }
    if (state.usesLeft === 0) return null;

    // 检查体力
    if (!CurrencyManager.consumeStamina(staminaCost)) {
      console.log('[Building] 体力不足');
      EventBus.emit('building:noStamina', cellIndex, staminaCost);
      return null;
    }

    // 找相邻空格
    const targetIndex = this._findAdjacentEmpty(cellIndex);
    if (targetIndex < 0) {
      CurrencyManager.addStamina(staminaCost);
      console.log('[Building] 周围没有空格');
      EventBus.emit('building:noSpace', cellIndex);
      return null;
    }

    let producedId: string | null = null;

    if (chestDef) {
      // 宝箱：从产出表中随机选取品类/线/等级
      const option = chestDef.produceItems[Math.floor(Math.random() * chestDef.produceItems.length)];
      const line = option.lines[Math.floor(Math.random() * option.lines.length)];
      const [minLv, maxLv] = option.levelRange;
      const level = minLv + Math.floor(Math.random() * (maxLv - minLv + 1));
      producedId = findItemId(option.category, line, level);
    } else {
      // 建筑：按概率表产出
      const def = (permDef || consDef)!;
      const line = def.needSelect && selectedLine
        ? selectedLine
        : def.produceLines[Math.floor(Math.random() * def.produceLines.length)];
      const level = this._rollLevel(def.produceTable);
      producedId = findItemId(def.produceCategory, line, level);
    }

    if (!producedId) {
      CurrencyManager.addStamina(staminaCost);
      console.warn('[Building] 找不到产出物品');
      return null;
    }

    BoardManager.placeItem(targetIndex, producedId);

    // 更新状态
    if (permDef) {
      state.cdRemaining = permDef.cooldown;
    }
    if (consDef || chestDef) {
      state.usesLeft--;
      if (state.usesLeft <= 0) {
        BoardManager.removeItem(cellIndex);
        this._states.delete(cellIndex);
        EventBus.emit('building:exhausted', cellIndex);
      }
    }

    const resultDef = ITEM_DEFS.get(producedId);
    console.log(`[Building] 产出: ${resultDef?.name}(Lv.${resultDef?.level}) → 格子${targetIndex}`);
    EventBus.emit('building:produced', cellIndex, targetIndex, producedId);

    return { itemId: producedId, targetIndex };
  }

  /** 每帧更新 CD */
  update(dt: number): void {
    for (const [cellIndex, state] of this._states) {
      if (state.cdRemaining > 0) {
        state.cdRemaining = Math.max(0, state.cdRemaining - dt);
        if (state.cdRemaining <= 0) {
          EventBus.emit('building:cdReady', cellIndex);
        }
      }
    }
  }

  /** 获取建筑的 CD 状态 */
  getCdInfo(cellIndex: number): { remaining: number; total: number } | null {
    const cell = BoardManager.getCellByIndex(cellIndex);
    if (!cell?.itemId) return null;
    const permDef = this._findPermDef(cell.itemId);
    if (!permDef) return null;
    const state = this._states.get(cellIndex);
    if (!state) return null;
    return { remaining: state.cdRemaining, total: permDef.cooldown };
  }

  /** 获取消耗型建筑/宝箱剩余次数（-1 表示永久型） */
  getUsesLeft(cellIndex: number): number {
    const cell = BoardManager.getCellByIndex(cellIndex);
    if (!cell?.itemId) return -1;

    const consDef = this._findConsDef(cell.itemId);
    const chestDef = this._findChestDef(cell.itemId);
    if (!consDef && !chestDef) return -1;

    const state = this._states.get(cellIndex);
    if (!state) return consDef ? consDef.maxUses : chestDef!.maxUses;
    return state.usesLeft;
  }

  // ---- 私有方法 ----

  private _findPermDef(itemId: string): PermBuildingDef | undefined {
    return PERM_BUILDINGS.find(b => b.itemId === itemId);
  }

  private _findConsDef(itemId: string): ConsBuildingDef | undefined {
    return CONS_BUILDINGS.find(b => b.itemId === itemId);
  }

  private _findChestDef(itemId: string): ChestDef | undefined {
    return CHEST_DEFS.find(b => b.itemId === itemId);
  }

  private _getOrCreateState(cellIndex: number, itemId: string): BuildingState {
    let state = this._states.get(cellIndex);
    if (!state) {
      const consDef = this._findConsDef(itemId);
      const chestDef = this._findChestDef(itemId);
      state = {
        cdRemaining: 0,
        usesLeft: consDef ? consDef.maxUses : chestDef ? chestDef.maxUses : -1,
      };
      this._states.set(cellIndex, state);
    }
    return state;
  }

  private _rollLevel(table: [number, number][]): number {
    const totalWeight = table.reduce((sum, [, w]) => sum + w, 0);
    let roll = Math.random() * totalWeight;
    for (const [level, weight] of table) {
      roll -= weight;
      if (roll <= 0) return level;
    }
    return table[table.length - 1][0];
  }

  private _findAdjacentEmpty(cellIndex: number): number {
    const row = Math.floor(cellIndex / BOARD_COLS);
    const col = cellIndex % BOARD_COLS;
    const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];

    for (const [dr, dc] of dirs) {
      const nr = row + dr;
      const nc = col + dc;
      if (nr < 0 || nr >= BOARD_ROWS || nc < 0 || nc >= BOARD_COLS) continue;
      const idx = nr * BOARD_COLS + nc;
      const c = BoardManager.getCellByIndex(idx);
      if (c && c.state === 'open' && !c.itemId) return idx;
    }

    return BoardManager.findEmptyOpenCell();
  }
}

export const BuildingManager = new BuildingManagerClass();
