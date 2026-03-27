/**
 * 建筑管理器 - 处理工具点击产出、CD 冷却、宝箱系统
 *
 * 工具/宝箱/花束包装纸：种植线随机鲜花或绿植；包装线工具产出包装中间品；花束包装纸消耗次数产出花束后消失。
 * 合成两个同级工具升级为下一级（在 BoardManager 中处理）。
 */
import { EventBus } from '@/core/EventBus';
import { BoardManager } from './BoardManager';
import { CurrencyManager } from './CurrencyManager';
import { ITEM_DEFS, Category, findItemId, FlowerLine, DrinkLine, ToolLine } from '@/config/ItemConfig';
import { findBoardProducerDef, type ToolProduceOutcome } from '@/config/BuildingConfig';
import { BOARD_COLS, BOARD_ROWS } from '@/config/Constants';

/** 宝箱配置 */
interface ChestDef {
  itemId: string;
  /** 产出内容列表（随机选取一项） */
  produceItems: ChestProduceOption[];
  staminaCost: number;
  maxUses: number;
}

interface ChestProduceOption {
  type: 'tool' | 'product' | 'gold';
  /** tool: 随机Lv1工具；product: 指定品类+线+等级范围 */
  category?: Category;
  lines?: string[];
  levelRange?: [number, number];
  /** gold: 金币数量范围 */
  goldRange?: [number, number];
  /** 该选项的权重 */
  weight: number;
}

/** 运行时建筑状态（CD / 剩余次数 / 本周期剩余产出次数） */
interface BuildingState {
  /** 与当前格子物品绑定，合成升级等换物时丢弃旧状态 */
  boundItemId: string;
  cdRemaining: number;
  usesLeft: number;
  /**
   * 进入 CD 前还可产出的次数（仅 cooldown>0 的工具）。
   * CD 结束后重置为 producesBeforeCooldown。
   */
  freeProducesLeft: number;
}

// ═══════════════ 宝箱定义 ═══════════════

const CHEST_DEFS: ChestDef[] = [
  {
    itemId: 'chest_1',
    produceItems: [
      { type: 'tool', weight: 40 },
      { type: 'product', category: Category.FLOWER, lines: [FlowerLine.FRESH], levelRange: [1, 1], weight: 40 },
      { type: 'gold', goldRange: [20, 50], weight: 20 },
    ],
    staminaCost: 2,
    maxUses: 3,
  },
  {
    itemId: 'chest_2',
    produceItems: [
      { type: 'tool', weight: 35 },
      { type: 'product', category: Category.FLOWER, lines: [FlowerLine.FRESH, FlowerLine.BOUQUET], levelRange: [1, 2], weight: 40 },
      { type: 'gold', goldRange: [40, 100], weight: 25 },
    ],
    staminaCost: 3,
    maxUses: 4,
  },
  {
    itemId: 'chest_3',
    produceItems: [
      { type: 'tool', weight: 30 },
      { type: 'product', category: Category.FLOWER, lines: [FlowerLine.FRESH, FlowerLine.BOUQUET, FlowerLine.GREEN], levelRange: [1, 3], weight: 40 },
      { type: 'gold', goldRange: [80, 200], weight: 30 },
    ],
    staminaCost: 5,
    maxUses: 3,
  },
  {
    itemId: 'chest_4',
    produceItems: [
      { type: 'tool', weight: 30 },
      { type: 'product', category: Category.DRINK, lines: [DrinkLine.TEA, DrinkLine.COLD, DrinkLine.DESSERT], levelRange: [1, 3], weight: 35 },
      { type: 'gold', goldRange: [150, 400], weight: 35 },
    ],
    staminaCost: 8,
    maxUses: 3,
  },
  {
    itemId: 'chest_5',
    produceItems: [
      { type: 'tool', weight: 25 },
      { type: 'product', category: Category.FLOWER, lines: [FlowerLine.FRESH, FlowerLine.BOUQUET, FlowerLine.GREEN], levelRange: [2, 5], weight: 35 },
      { type: 'gold', goldRange: [300, 800], weight: 40 },
    ],
    staminaCost: 12,
    maxUses: 3,
  },
];

/** 所有 Lv1 工具ID列表，用于宝箱随机产出 */
const ALL_LV1_TOOLS: string[] = Object.values(ToolLine).map(tl => `tool_${tl}_1`);

class BuildingManagerClass {
  private _states = new Map<number, BuildingState>();

  constructor() {
    EventBus.on('board:itemRemoved', (index: number) => {
      this._states.delete(index);
    });
    /** 合成后源格清空、目标格替换为新物品，旧 CD/次数状态不能沿用 */
    EventBus.on('board:merged', (srcIndex: number, dstIndex: number) => {
      this._states.delete(srcIndex);
      this._states.delete(dstIndex);
    });
  }

  /** 判断某个物品是否是可产出建筑（tool_* 或花束包装纸等） */
  isToolItem(itemId: string): boolean {
    return !!findBoardProducerDef(itemId);
  }

  /** 判断某个物品是否是宝箱 */
  isChestItem(itemId: string): boolean {
    return !!this._findChestDef(itemId);
  }

  /** 判断某个物品是否可点击交互（工具 / 宝箱） */
  isInteractable(itemId: string): boolean {
    return this.isToolItem(itemId) || this.isChestItem(itemId);
  }

  /** @deprecated 兼容旧接口 */
  isBuildingItem(itemId: string): boolean {
    return this.isToolItem(itemId);
  }

  /** 判断某个格子上的工具/宝箱是否可以点击产出 */
  canProduce(cellIndex: number): boolean {
    const cell = BoardManager.getCellByIndex(cellIndex);
    if (!cell?.itemId || cell.state !== 'open') return false;
    if (!this.isInteractable(cell.itemId)) return false;

    const toolPre = findBoardProducerDef(cell.itemId);
    if (toolPre && !toolPre.canProduce) return false;

    const state = this._getOrCreateState(cellIndex, cell.itemId);
    if (state.cdRemaining > 0) return false;
    if (state.usesLeft === 0) return false;

    return true;
  }

  /**
   * 点击工具/宝箱产出物品
   * @returns 产出结果，null 表示失败
   */
  produce(cellIndex: number): { itemId: string; targetIndex: number } | null {
    const cell = BoardManager.getCellByIndex(cellIndex);
    if (!cell?.itemId || cell.state !== 'open') return null;

    const toolDef = findBoardProducerDef(cell.itemId);
    const chestDef = this._findChestDef(cell.itemId);
    if (!toolDef && !chestDef) return null;
    if (toolDef && !toolDef.canProduce) return null;

    const staminaCost = toolDef?.staminaCost ?? chestDef!.staminaCost;

    const state = this._getOrCreateState(cellIndex, cell.itemId);
    if (state.cdRemaining > 0) {
      console.log(`[Building] CD 冷却中，剩余 ${state.cdRemaining.toFixed(0)}s`);
      EventBus.emit('building:onCooldown', cellIndex, state.cdRemaining);
      return null;
    }
    if (state.usesLeft === 0) return null;

    if (!CurrencyManager.consumeStamina(staminaCost)) {
      console.log('[Building] 体力不足');
      EventBus.emit('building:noStamina', cellIndex, staminaCost);
      return null;
    }

    const targetIndex = this._findAdjacentEmpty(cellIndex);
    if (targetIndex < 0) {
      CurrencyManager.addStamina(staminaCost);
      console.log('[Building] 周围没有空格');
      EventBus.emit('building:noSpace', cellIndex);
      return null;
    }

    let producedId: string | null = null;

    if (chestDef) {
      producedId = this._rollChestProduce(chestDef, cellIndex);
    } else if (toolDef) {
      if (toolDef.produceOutcomes && toolDef.produceOutcomes.length > 0) {
        producedId = this._rollToolProduceOutcome(toolDef.produceOutcomes);
      } else {
        const level = this._rollLevel(toolDef.produceTable);
        const lines = toolDef.produceLinesRandom;
        const line =
          lines && lines.length > 0
            ? lines[Math.floor(Math.random() * lines.length)]
            : toolDef.produceLine;
        producedId = findItemId(toolDef.produceCategory, line, level);
      }
    }

    if (!producedId) {
      CurrencyManager.addStamina(staminaCost);
      console.warn('[Building] 找不到产出物品');
      return null;
    }

    // 金币奖励特殊处理：不放到棋盘上
    if (producedId === '__gold__') {
      // 金币已在 _rollChestProduce 中发放
      this._consumeUse(cellIndex, cell.itemId, state, !!chestDef, toolDef);
      return { itemId: producedId, targetIndex: -1 };
    }

    BoardManager.placeItem(targetIndex, producedId);

    // 更新状态：Lv2/Lv3 先消耗「周期内次数」，用尽后再进入 CD
    if (toolDef && toolDef.cooldown > 0) {
      state.freeProducesLeft--;
      if (state.freeProducesLeft <= 0) {
        state.cdRemaining = toolDef.cooldown;
      }
    }
    this._consumeUse(cellIndex, cell.itemId, state, !!chestDef, toolDef);

    const resultDef = ITEM_DEFS.get(producedId);
    console.log(`[Building] 产出: ${resultDef?.name}(Lv.${resultDef?.level}) → 格子${targetIndex}`);
    EventBus.emit('building:produced', cellIndex, targetIndex, producedId);

    return { itemId: producedId, targetIndex };
  }

  /** 每帧更新 CD */
  update(dt: number): void {
    for (const [cellIndex, state] of this._states) {
      if (state.cdRemaining > 0) {
        const prev = state.cdRemaining;
        state.cdRemaining = Math.max(0, state.cdRemaining - dt);
        if (prev > 0 && state.cdRemaining <= 0) {
          const cell = BoardManager.getCellByIndex(cellIndex);
          const td = cell?.itemId ? findBoardProducerDef(cell.itemId) : undefined;
          if (td && td.cooldown > 0) {
            state.freeProducesLeft = Math.max(1, td.producesBeforeCooldown);
          }
          EventBus.emit('building:cdReady', cellIndex);
        }
      }
    }
  }

  /** 获取工具的 CD / 周期内剩余产出次数（用于 UI） */
  getCdInfo(cellIndex: number): {
    remaining: number;
    total: number;
    chargesLeft?: number;
    chargesMax?: number;
  } | null {
    const cell = BoardManager.getCellByIndex(cellIndex);
    if (!cell?.itemId) return null;
    const toolDef = findBoardProducerDef(cell.itemId);
    if (!toolDef) return null;
    if (!toolDef.canProduce) return null;
    const cap = Math.max(1, toolDef.producesBeforeCooldown);
    const state = this._states.get(cellIndex);
    if (toolDef.cooldown <= 0) {
      return { remaining: 0, total: 0 };
    }
    if (!state || state.boundItemId !== cell.itemId) {
      return {
        remaining: 0,
        total: toolDef.cooldown,
        chargesLeft: cap,
        chargesMax: toolDef.producesBeforeCooldown > 0 ? toolDef.producesBeforeCooldown : cap,
      };
    }
    if (state.cdRemaining > 0) {
      return {
        remaining: state.cdRemaining,
        total: toolDef.cooldown,
        chargesLeft: 0,
        chargesMax: toolDef.producesBeforeCooldown > 0 ? toolDef.producesBeforeCooldown : cap,
      };
    }
    return {
      remaining: 0,
      total: toolDef.cooldown,
      chargesLeft: state.freeProducesLeft,
      chargesMax: toolDef.producesBeforeCooldown > 0 ? toolDef.producesBeforeCooldown : cap,
    };
  }

  /** 获取宝箱剩余次数（-1 表示永久型工具） */
  getUsesLeft(cellIndex: number): number {
    const cell = BoardManager.getCellByIndex(cellIndex);
    if (!cell?.itemId) return -1;

    const chestDef = this._findChestDef(cell.itemId);
    const wrapDef = findBoardProducerDef(cell.itemId);
    const wrapMax = wrapDef?.exhaustAfterProduces;

    if (chestDef) {
      const state = this._states.get(cellIndex);
      if (!state) return chestDef.maxUses;
      return state.usesLeft;
    }

    if (wrapMax && wrapMax > 0) {
      const state = this._states.get(cellIndex);
      if (!state) return wrapMax;
      return state.usesLeft;
    }

    return -1;
  }

  // ═══════════════ 私有方法 ═══════════════

  private _findChestDef(itemId: string): ChestDef | undefined {
    return CHEST_DEFS.find(b => b.itemId === itemId);
  }

  private _getOrCreateState(cellIndex: number, itemId: string): BuildingState {
    let state = this._states.get(cellIndex);
    if (state && state.boundItemId !== itemId) {
      this._states.delete(cellIndex);
      state = undefined;
    }
    if (!state) {
      const chestDef = this._findChestDef(itemId);
      const toolDef = findBoardProducerDef(itemId);
      let freeProducesLeft = 0;
      if (toolDef && toolDef.cooldown > 0) {
        freeProducesLeft = Math.max(1, toolDef.producesBeforeCooldown);
      }
      let usesLeftInit = -1;
      if (chestDef) {
        usesLeftInit = chestDef.maxUses;
      } else if (toolDef?.exhaustAfterProduces && toolDef.exhaustAfterProduces > 0) {
        usesLeftInit = toolDef.exhaustAfterProduces;
      }
      state = {
        boundItemId: itemId,
        cdRemaining: 0,
        usesLeft: usesLeftInit,
        freeProducesLeft,
      };
      this._states.set(cellIndex, state);
    }
    return state;
  }

  private _consumeUse(
    cellIndex: number,
    itemId: string,
    state: BuildingState,
    isChest: boolean,
    toolDef: ReturnType<typeof findBoardProducerDef>,
  ): void {
    if (isChest) {
      state.usesLeft--;
      if (state.usesLeft <= 0) {
        BoardManager.removeItem(cellIndex);
        this._states.delete(cellIndex);
        EventBus.emit('building:exhausted', cellIndex);
      }
      return;
    }
    const n = toolDef?.exhaustAfterProduces;
    if (n && n > 0) {
      state.usesLeft--;
      if (state.usesLeft <= 0) {
        BoardManager.removeItem(cellIndex);
        this._states.delete(cellIndex);
        EventBus.emit('building:exhausted', cellIndex);
      }
    }
  }

  private _rollChestProduce(chestDef: ChestDef, _cellIndex: number): string | null {
    const option = this._weightedRandom(chestDef.produceItems);
    if (!option) return null;

    switch (option.type) {
      case 'tool': {
        return ALL_LV1_TOOLS[Math.floor(Math.random() * ALL_LV1_TOOLS.length)];
      }
      case 'product': {
        if (!option.category || !option.lines || !option.levelRange) return null;
        const line = option.lines[Math.floor(Math.random() * option.lines.length)];
        const [minLv, maxLv] = option.levelRange;
        const level = minLv + Math.floor(Math.random() * (maxLv - minLv + 1));
        return findItemId(option.category, line, level);
      }
      case 'gold': {
        if (!option.goldRange) return null;
        const [minG, maxG] = option.goldRange;
        const amount = minG + Math.floor(Math.random() * (maxG - minG + 1));
        CurrencyManager.addGold(amount);
        EventBus.emit('chest:goldReward', amount);
        return '__gold__';
      }
      default:
        return null;
    }
  }

  private _weightedRandom<T extends { weight: number }>(items: T[]): T | null {
    const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
    let roll = Math.random() * totalWeight;
    for (const item of items) {
      roll -= item.weight;
      if (roll <= 0) return item;
    }
    return items[items.length - 1] || null;
  }

  /** 按权重随机一条明确产出（品类+线+等级） */
  private _rollToolProduceOutcome(outcomes: ToolProduceOutcome[]): string | null {
    const total = outcomes.reduce((s, o) => s + o.weight, 0);
    if (total <= 0) return null;
    let roll = Math.random() * total;
    for (const o of outcomes) {
      roll -= o.weight;
      if (roll <= 0) {
        return findItemId(o.category, o.line, o.level);
      }
    }
    const last = outcomes[outcomes.length - 1];
    return findItemId(last.category, last.line, last.level);
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
