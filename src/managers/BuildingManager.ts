/**
 * 建筑管理器 - 处理建筑点击产出、CD 冷却、消耗型建筑次数
 */
import { EventBus } from '@/core/EventBus';
import { BoardManager } from './BoardManager';
import { CurrencyManager } from './CurrencyManager';
import { ITEM_DEFS, Category, findItemId, FlowerLine, DrinkLine } from '@/config/ItemConfig';
import { BOARD_COLS, BOARD_ROWS } from '@/config/Constants';

/** 永久型建筑配置 */
interface PermBuildingDef {
  /** 对应 ITEM_DEFS 中的 id */
  itemId: string;
  /** 产出品类 */
  produceCategory: Category;
  /** 可产出的花系/饮品线 */
  produceLines: string[];
  /** 是否需要选择花系（初级建筑固定产出，不需选择） */
  needSelect: boolean;
  /** 产出概率表 [level, weight][] */
  produceTable: [number, number][];
  /** 每次产出数量 */
  produceCount: number;
  /** 体力消耗 */
  staminaCost: number;
  /** CD 冷却（秒） */
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
  /** 总使用次数 */
  maxUses: number;
}

/** 运行时建筑状态（CD / 剩余次数） */
interface BuildingState {
  /** 剩余 CD（秒），0 表示可用 */
  cdRemaining: number;
  /** 消耗型：剩余使用次数，-1 表示永久型 */
  usesLeft: number;
}

// ---- 永久型建筑定义 ----
const PERM_BUILDINGS: PermBuildingDef[] = [
  {
    itemId: 'building_perm_1', // 花艺操作台
    produceCategory: Category.FLOWER,
    produceLines: [FlowerLine.DAILY],
    needSelect: false,
    produceTable: [[1, 70], [2, 25], [3, 5]],
    produceCount: 1,
    staminaCost: 3,
    cooldown: 30,
  },
  {
    itemId: 'building_perm_2', // 包装台
    produceCategory: Category.FLOWER,
    produceLines: [FlowerLine.DAILY, FlowerLine.ROMANTIC],
    needSelect: true,
    produceTable: [[1, 30], [2, 30], [3, 20], [4, 10], [5, 10]],
    produceCount: 1,
    staminaCost: 5,
    cooldown: 120,
  },
  {
    itemId: 'building_perm_3', // 小型温室
    produceCategory: Category.FLOWER,
    produceLines: [FlowerLine.ROMANTIC, FlowerLine.LUXURY],
    needSelect: true,
    produceTable: [[1, 25], [2, 30], [3, 25], [4, 10], [5, 10]],
    produceCount: 1,
    staminaCost: 8,
    cooldown: 300,
  },
  {
    itemId: 'building_perm_4', // 星光花房
    produceCategory: Category.FLOWER,
    produceLines: [FlowerLine.DAILY, FlowerLine.ROMANTIC, FlowerLine.LUXURY],
    needSelect: true,
    produceTable: [[3, 20], [4, 20], [5, 40], [6, 20]],
    produceCount: 1,
    staminaCost: 12,
    cooldown: 600,
  },
  {
    itemId: 'building_perm_5', // 简易茶台
    produceCategory: Category.DRINK,
    produceLines: [DrinkLine.TEA],
    needSelect: false,
    produceTable: [[1, 70], [2, 25], [3, 5]],
    produceCount: 1,
    staminaCost: 3,
    cooldown: 30,
  },
  {
    itemId: 'building_perm_6', // 调饮吧台
    produceCategory: Category.DRINK,
    produceLines: [DrinkLine.TEA, DrinkLine.COLD],
    needSelect: true,
    produceTable: [[1, 55], [2, 35], [3, 10]],
    produceCount: 1,
    staminaCost: 5,
    cooldown: 120,
  },
  {
    itemId: 'building_perm_7', // 花饮工坊
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
    itemId: 'building_cons_1', // 花材礼盒
    produceCategory: Category.FLOWER,
    produceLines: [FlowerLine.DAILY, FlowerLine.ROMANTIC, FlowerLine.LUXURY],
    needSelect: false,
    produceTable: [[1, 100]],
    produceCount: 1,
    staminaCost: 2,
    maxUses: 5,
  },
  {
    itemId: 'building_cons_2', // 精选花篮
    produceCategory: Category.FLOWER,
    produceLines: [FlowerLine.DAILY, FlowerLine.ROMANTIC, FlowerLine.LUXURY],
    needSelect: true,
    produceTable: [[1, 40], [2, 40], [3, 20]],
    produceCount: 1,
    staminaCost: 4,
    maxUses: 4,
  },
  {
    itemId: 'building_cons_3', // 花艺大师箱
    produceCategory: Category.FLOWER,
    produceLines: [FlowerLine.DAILY, FlowerLine.ROMANTIC, FlowerLine.LUXURY],
    needSelect: true,
    produceTable: [[3, 40], [4, 40], [5, 20]],
    produceCount: 1,
    staminaCost: 6,
    maxUses: 3,
  },
  {
    itemId: 'building_cons_4', // 茶包盒
    produceCategory: Category.DRINK,
    produceLines: [DrinkLine.TEA, DrinkLine.COLD, DrinkLine.DESSERT],
    needSelect: false,
    produceTable: [[1, 100]],
    produceCount: 1,
    staminaCost: 2,
    maxUses: 5,
  },
  {
    itemId: 'building_cons_5', // 调饮套装
    produceCategory: Category.DRINK,
    produceLines: [DrinkLine.TEA, DrinkLine.COLD, DrinkLine.DESSERT],
    needSelect: true,
    produceTable: [[1, 50], [2, 50]],
    produceCount: 1,
    staminaCost: 4,
    maxUses: 4,
  },
  {
    itemId: 'building_cons_6', // 花饮臻选箱
    produceCategory: Category.DRINK,
    produceLines: [DrinkLine.TEA, DrinkLine.COLD, DrinkLine.DESSERT],
    needSelect: true,
    produceTable: [[2, 50], [3, 50]],
    produceCount: 1,
    staminaCost: 6,
    maxUses: 3,
  },
];

class BuildingManagerClass {
  /** 格子索引 → 运行时状态 */
  private _states = new Map<number, BuildingState>();

  /** 判断某个物品是否是建筑 */
  isBuildingItem(itemId: string): boolean {
    return !!this._findPermDef(itemId) || !!this._findConsDef(itemId);
  }

  /** 判断某个格子上的建筑是否可以点击产出 */
  canProduce(cellIndex: number): boolean {
    const cell = BoardManager.getCellByIndex(cellIndex);
    if (!cell?.itemId || cell.state !== 'open') return false;
    if (!this.isBuildingItem(cell.itemId)) return false;

    const state = this._getOrCreateState(cellIndex, cell.itemId);
    if (state.cdRemaining > 0) return false;
    if (state.usesLeft === 0) return false;

    return true;
  }

  /**
   * 点击建筑产出物品
   * @param cellIndex 建筑所在格子
   * @param selectedLine 选择的花系/饮品线（需选择的建筑使用）
   * @returns 产出结果，null 表示失败
   */
  produce(cellIndex: number, selectedLine?: string): { itemId: string; targetIndex: number } | null {
    const cell = BoardManager.getCellByIndex(cellIndex);
    if (!cell?.itemId || cell.state !== 'open') return null;

    const permDef = this._findPermDef(cell.itemId);
    const consDef = this._findConsDef(cell.itemId);
    const def = permDef || consDef;
    if (!def) return null;

    const state = this._getOrCreateState(cellIndex, cell.itemId);
    if (state.cdRemaining > 0) {
      console.log(`[Building] CD 冷却中，剩余 ${state.cdRemaining.toFixed(0)}s`);
      EventBus.emit('building:onCooldown', cellIndex, state.cdRemaining);
      return null;
    }
    if (state.usesLeft === 0) return null;

    // 检查体力
    if (!CurrencyManager.consumeStamina(def.staminaCost)) {
      console.log('[Building] 体力不足');
      EventBus.emit('building:noStamina', cellIndex, def.staminaCost);
      return null;
    }

    // 找相邻空格
    const targetIndex = this._findAdjacentEmpty(cellIndex);
    if (targetIndex < 0) {
      // 体力回退
      CurrencyManager.addStamina(def.staminaCost);
      console.log('[Building] 周围没有空格');
      EventBus.emit('building:noSpace', cellIndex);
      return null;
    }

    // 确定产出线
    const line = def.needSelect && selectedLine
      ? selectedLine
      : def.produceLines[Math.floor(Math.random() * def.produceLines.length)];

    // 按概率表随机等级
    const level = this._rollLevel(def.produceTable);
    const producedId = findItemId(def.produceCategory, line, level);
    if (!producedId) {
      CurrencyManager.addStamina(def.staminaCost);
      console.warn(`[Building] 找不到产出物品: ${def.produceCategory}/${line}/lv${level}`);
      return null;
    }

    // 放置到目标格
    BoardManager.placeItem(targetIndex, producedId);

    // 更新建筑状态
    if (permDef) {
      state.cdRemaining = permDef.cooldown;
    }
    if (consDef) {
      state.usesLeft--;
      if (state.usesLeft <= 0) {
        // 消耗型建筑用尽，移除
        BoardManager.removeItem(cellIndex);
        this._states.delete(cellIndex);
        EventBus.emit('building:exhausted', cellIndex);
      }
    }

    const resultDef = ITEM_DEFS.get(producedId);
    console.log(`[Building] 产出: ${resultDef?.name}(Lv.${level}) → 格子${targetIndex}`);
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

  /** 获取消耗型建筑剩余次数 */
  getUsesLeft(cellIndex: number): number {
    const state = this._states.get(cellIndex);
    return state?.usesLeft ?? -1;
  }

  // ---- 私有方法 ----

  private _findPermDef(itemId: string): PermBuildingDef | undefined {
    return PERM_BUILDINGS.find(b => b.itemId === itemId);
  }

  private _findConsDef(itemId: string): ConsBuildingDef | undefined {
    return CONS_BUILDINGS.find(b => b.itemId === itemId);
  }

  private _getOrCreateState(cellIndex: number, itemId: string): BuildingState {
    let state = this._states.get(cellIndex);
    if (!state) {
      const consDef = this._findConsDef(itemId);
      state = {
        cdRemaining: 0,
        usesLeft: consDef ? consDef.maxUses : -1,
      };
      this._states.set(cellIndex, state);
    }
    return state;
  }

  /** 按权重概率表随机选等级 */
  private _rollLevel(table: [number, number][]): number {
    const totalWeight = table.reduce((sum, [, w]) => sum + w, 0);
    let roll = Math.random() * totalWeight;
    for (const [level, weight] of table) {
      roll -= weight;
      if (roll <= 0) return level;
    }
    return table[table.length - 1][0];
  }

  /** 查找指定格子周围的空格（上下左右优先） */
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

    // 相邻没有空格，找全局第一个空格
    return BoardManager.findEmptyOpenCell();
  }
}

export const BuildingManager = new BuildingManagerClass();
