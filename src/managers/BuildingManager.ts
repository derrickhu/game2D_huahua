/**
 * 建筑管理器 - 处理工具点击产出、CD 冷却、宝箱系统
 *
 * 宝箱：首次点击扣体力并掷出固定件数；每次点击向全棋盘空格散落，未散完保留宝箱并显示进度条。
 * 工具/花束包装纸逻辑不变。
 */
import { EventBus } from '@/core/EventBus';
import { BoardManager } from './BoardManager';
import { CurrencyManager } from './CurrencyManager';
import {
  ITEM_DEFS,
  Category,
  InteractType,
  CurrencyLine,
  findItemId,
  getMaxLevelForLine,
  FlowerLine,
  DrinkLine,
  ToolLine,
} from '@/config/ItemConfig';
import {
  findBoardProducerDef,
  mergeOutcomePercents,
  type ToolProduceOutcome,
  type ToolProduceDisplayEntry,
} from '@/config/BuildingConfig';
import { BOARD_COLS, BOARD_ROWS } from '@/config/Constants';
import { ToolProducePolicy } from '@/managers/ToolProducePolicy';

/** 单次点击产出结果（工具 1 件；宝箱可能多件） */
export type ProducePlacement = { itemId: string; targetIndex: number };

/** 宝箱配置 */
interface ChestDef {
  itemId: string;
  /** 每次点击开箱时，按权重独立随机出的「棋盘物品」件数（固定；不含直接入账的金币） */
  boardDropCount: number;
  /** 每一件棋盘掉落按权重随机类型（tool/product/gold 等） */
  produceItems: ChestProduceOption[];
  staminaCost: number;
}

interface ChestProduceOption {
  type: 'tool' | 'product';
  /** product: 指定品类+线+等级范围 */
  category?: Category;
  lines?: string[];
  levelRange?: [number, number];
  weight: number;
}

/** 运行时建筑状态（CD / 剩余次数 / 本周期剩余产出次数 / 宝箱待散落队列） */
interface BuildingState {
  boundItemId: string;
  cdRemaining: number;
  usesLeft: number;
  freeProducesLeft: number;
  /** 宝箱：`undefined` 未开箱；有数组则为待落到棋盘的物品 id */
  chestQueue?: string[];
  chestTotalBoardDrops?: number;
}

/** 存档用 */
export interface BuildingPersistEntry {
  cellIndex: number;
  boundItemId: string;
  cdRemaining: number;
  usesLeft: number;
  freeProducesLeft: number;
  chestQueue?: string[];
  chestTotalBoardDrops?: number;
}

/** 入仓时随物品保存（无格索引），取出后写回 BuildingManager */
export type ToolStateSnapshot = Omit<BuildingPersistEntry, 'cellIndex'>;

// ═══════════════ 宝箱定义 ═══════════════

const CHEST_DEFS: ChestDef[] = [
  {
    itemId: 'chest_1',
    boardDropCount: 6,
    produceItems: [
      {
        type: 'product',
        category: Category.FLOWER,
        lines: [FlowerLine.FRESH, FlowerLine.GREEN],
        levelRange: [1, 1],
        weight: 52,
      },
      {
        type: 'product',
        category: Category.DRINK,
        lines: [DrinkLine.TEA, DrinkLine.COLD, DrinkLine.DESSERT],
        levelRange: [1, 1],
        weight: 42,
      },
      { type: 'product', category: Category.CURRENCY, lines: [CurrencyLine.STAMINA], levelRange: [1, 1], weight: 6 },
    ],
    staminaCost: 2,
  },
  {
    itemId: 'chest_2',
    boardDropCount: 6,
    produceItems: [
      {
        type: 'product',
        category: Category.FLOWER,
        lines: [FlowerLine.FRESH, FlowerLine.GREEN],
        levelRange: [1, 2],
        weight: 48,
      },
      {
        type: 'product',
        category: Category.DRINK,
        lines: [DrinkLine.TEA, DrinkLine.COLD, DrinkLine.DESSERT],
        levelRange: [1, 2],
        weight: 36,
      },
      { type: 'product', category: Category.CURRENCY, lines: [CurrencyLine.STAMINA], levelRange: [1, 2], weight: 16 },
    ],
    staminaCost: 3,
  },
  {
    itemId: 'chest_3',
    boardDropCount: 7,
    produceItems: [
      { type: 'tool', weight: 8 },
      {
        type: 'product',
        category: Category.FLOWER,
        lines: [FlowerLine.FRESH, FlowerLine.BOUQUET],
        levelRange: [1, 3],
        weight: 28,
      },
      { type: 'product', category: Category.FLOWER, lines: [FlowerLine.GREEN], levelRange: [2, 3], weight: 12 },
      {
        type: 'product',
        category: Category.DRINK,
        lines: [DrinkLine.TEA, DrinkLine.COLD, DrinkLine.DESSERT],
        levelRange: [1, 3],
        weight: 22,
      },
      { type: 'product', category: Category.CURRENCY, lines: [CurrencyLine.STAMINA], levelRange: [1, 2], weight: 9 },
      { type: 'product', category: Category.CURRENCY, lines: [CurrencyLine.DIAMOND], levelRange: [1, 2], weight: 21 },
    ],
    staminaCost: 5,
  },
  {
    itemId: 'chest_4',
    boardDropCount: 7,
    produceItems: [
      { type: 'tool', weight: 8 },
      {
        type: 'product',
        category: Category.FLOWER,
        lines: [FlowerLine.FRESH, FlowerLine.BOUQUET, FlowerLine.GREEN],
        levelRange: [1, 4],
        weight: 24,
      },
      {
        type: 'product',
        category: Category.DRINK,
        lines: [DrinkLine.TEA, DrinkLine.COLD, DrinkLine.DESSERT],
        levelRange: [1, 3],
        weight: 20,
      },
      { type: 'product', category: Category.CURRENCY, lines: [CurrencyLine.STAMINA], levelRange: [1, 4], weight: 16 },
      { type: 'product', category: Category.CURRENCY, lines: [CurrencyLine.DIAMOND], levelRange: [1, 4], weight: 32 },
    ],
    staminaCost: 8,
  },
  {
    itemId: 'chest_5',
    boardDropCount: 8,
    produceItems: [
      { type: 'tool', weight: 8 },
      {
        type: 'product',
        category: Category.FLOWER,
        lines: [FlowerLine.FRESH, FlowerLine.BOUQUET, FlowerLine.GREEN],
        levelRange: [2, 5],
        weight: 25,
      },
      {
        type: 'product',
        category: Category.DRINK,
        lines: [DrinkLine.TEA, DrinkLine.COLD, DrinkLine.DESSERT],
        levelRange: [2, 4],
        weight: 17,
      },
      { type: 'product', category: Category.CURRENCY, lines: [CurrencyLine.STAMINA], levelRange: [1, 4], weight: 16 },
      { type: 'product', category: Category.CURRENCY, lines: [CurrencyLine.DIAMOND], levelRange: [1, 4], weight: 34 },
    ],
    staminaCost: 12,
  },
  // ═══ 红包线（4级）：仅散落「花愿利是」，双击入账花愿 ═══
  {
    itemId: 'hongbao_1',
    boardDropCount: 4,
    produceItems: [
      {
        type: 'product',
        category: Category.CURRENCY,
        lines: [CurrencyLine.HUAYUAN_PICKUP],
        levelRange: [1, 1],
        weight: 100,
      },
    ],
    staminaCost: 1,
  },
  {
    itemId: 'hongbao_2',
    boardDropCount: 5,
    produceItems: [
      {
        type: 'product',
        category: Category.CURRENCY,
        lines: [CurrencyLine.HUAYUAN_PICKUP],
        levelRange: [1, 1],
        weight: 35,
      },
      {
        type: 'product',
        category: Category.CURRENCY,
        lines: [CurrencyLine.HUAYUAN_PICKUP],
        levelRange: [2, 2],
        weight: 65,
      },
    ],
    staminaCost: 2,
  },
  {
    itemId: 'hongbao_3',
    boardDropCount: 6,
    produceItems: [
      {
        type: 'product',
        category: Category.CURRENCY,
        lines: [CurrencyLine.HUAYUAN_PICKUP],
        levelRange: [1, 1],
        weight: 20,
      },
      {
        type: 'product',
        category: Category.CURRENCY,
        lines: [CurrencyLine.HUAYUAN_PICKUP],
        levelRange: [2, 2],
        weight: 35,
      },
      {
        type: 'product',
        category: Category.CURRENCY,
        lines: [CurrencyLine.HUAYUAN_PICKUP],
        levelRange: [3, 3],
        weight: 45,
      },
    ],
    staminaCost: 3,
  },
  {
    itemId: 'hongbao_4',
    boardDropCount: 7,
    produceItems: [
      {
        type: 'product',
        category: Category.CURRENCY,
        lines: [CurrencyLine.HUAYUAN_PICKUP],
        levelRange: [1, 1],
        weight: 8,
      },
      {
        type: 'product',
        category: Category.CURRENCY,
        lines: [CurrencyLine.HUAYUAN_PICKUP],
        levelRange: [2, 2],
        weight: 22,
      },
      {
        type: 'product',
        category: Category.CURRENCY,
        lines: [CurrencyLine.HUAYUAN_PICKUP],
        levelRange: [3, 3],
        weight: 35,
      },
      {
        type: 'product',
        category: Category.CURRENCY,
        lines: [CurrencyLine.HUAYUAN_PICKUP],
        levelRange: [4, 4],
        weight: 35,
      },
    ],
    staminaCost: 5,
  },
];

/** 所有 Lv1 工具ID列表，用于宝箱随机产出 */
const ALL_LV1_TOOLS: string[] = Object.values(ToolLine).map(tl => `tool_${tl}_1`);

/**
 * 是否有宝箱在随机掉落中可能产出「该品类 + 产品线 + 等级」的物品。
 * 须同时命中 lines 与 levelRange（旧逻辑只看线，会把小芽苗等 Lv1 绿植误标成可自宝箱出）。
 */
export function chestMayDropItem(
  category: Category,
  productLine: string,
  level: number,
): boolean {
  return findRepresentativeChestForDrop(category, productLine, level) !== null;
}

/**
 * 合成线「获取来源」里点宝箱/红包时：取第一个能按规则掉出该等级该线的容器 id（chest_1…5、hongbao_1…4）。
 */
export function findRepresentativeChestForDrop(
  category: Category,
  productLine: string,
  level: number,
): string | null {
  for (const chest of CHEST_DEFS) {
    for (const p of chest.produceItems) {
      if (p.type !== 'product' || !p.lines || !p.levelRange) continue;
      if (p.category !== category || !p.lines.some(l => l === productLine)) continue;
      const [minL, maxL] = p.levelRange;
      if (level >= minL && level <= maxL) return chest.itemId;
    }
  }
  return null;
}

/**
 * 与单次 `_rollChestProduce` 一致：先按 weight 选条目，再 tool 均匀抽 Lv1 工具 / product 均匀抽线+等级。
 * 用于合成线面板产出概率悬浮窗。
 */
export function getChestProduceOutcomePercents(chestItemId: string): ToolProduceDisplayEntry[] {
  const chest = CHEST_DEFS.find(c => c.itemId === chestItemId);
  if (!chest) return [];
  const total = chest.produceItems.reduce((s, p) => s + p.weight, 0);
  if (total <= 0) return [];
  const raw: ToolProduceDisplayEntry[] = [];
  for (const p of chest.produceItems) {
    const share = (p.weight / total) * 100;
    if (p.type === 'tool') {
      const n = ALL_LV1_TOOLS.length;
      if (n <= 0) continue;
      for (const tid of ALL_LV1_TOOLS) {
        raw.push({ itemId: tid, percent: share / n });
      }
    } else if (p.type === 'product' && p.category && p.lines && p.levelRange) {
      const [minL, maxL] = p.levelRange;
      const nLevels = maxL - minL + 1;
      const nLines = p.lines.length;
      if (nLines <= 0 || nLevels <= 0) continue;
      const each = share / (nLines * nLevels);
      for (const line of p.lines) {
        for (let lv = minL; lv <= maxL; lv++) {
          const id = findItemId(p.category, line, lv);
          if (id) raw.push({ itemId: id, percent: each });
        }
      }
    }
  }
  return mergeOutcomePercents(raw);
}

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
    /** 幸运金币改级：源格清空、目标格 itemId 替换，须丢弃两侧工具/宝箱状态 */
    EventBus.on('board:luckyCoinApplied', (srcIndex: number, dstIndex: number) => {
      this._states.delete(srcIndex);
      this._states.delete(dstIndex);
    });
  }

  /** 判断某个物品是否是工具类交互（tool_* 或花束包装纸等） */
  isToolItem(itemId: string): boolean {
    const def = ITEM_DEFS.get(itemId);
    return !!def && def.interactType === InteractType.TOOL;
  }

  /** 判断某个物品是否是宝箱 */
  isChestItem(itemId: string): boolean {
    const def = ITEM_DEFS.get(itemId);
    return !!def && def.interactType === InteractType.CHEST;
  }

  /** 判断某个物品是否可点击交互（工具 / 宝箱） */
  isInteractable(itemId: string): boolean {
    const def = ITEM_DEFS.get(itemId);
    return !!def && def.interactType !== InteractType.NONE;
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
   * 点击工具/宝箱产出物品（宝箱可能一次落多格）
   * @returns placements 可能为空（如仅金币）；null 表示失败
   */
  produce(cellIndex: number): { placements: ProducePlacement[] } | null {
    const cell = BoardManager.getCellByIndex(cellIndex);
    if (!cell?.itemId || cell.state !== 'open') return null;

    const toolDef = findBoardProducerDef(cell.itemId);
    const chestDef = this._findChestDef(cell.itemId);
    if (!toolDef && !chestDef) return null;
    if (toolDef && !toolDef.canProduce) return null;

    /** 仅 `chest_*` 走批量散落；花艺材料篮等 `BOARD_PRODUCER` 仍单次产出 + exhaustAfterProduces 用尽消失 */
    if (chestDef) {
      return this._produceChest(cellIndex, chestDef);
    }

    const staminaCost = ToolProducePolicy.getEffectiveStaminaCost(toolDef!.staminaCost);
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
    if (toolDef!.produceOutcomes && toolDef!.produceOutcomes.length > 0) {
      producedId = this._rollToolProduceOutcome(toolDef!.produceOutcomes);
    } else {
      let level = this._rollLevel(toolDef!.produceTable);
      const lines = toolDef!.produceLinesRandom;
      const line =
        lines && lines.length > 0
          ? lines[Math.floor(Math.random() * lines.length)]
          : toolDef!.produceLine;
      level = this._clampProduceLevel(
        toolDef!.produceCategory,
        line,
        level + ToolProducePolicy.getProduceLevelBonus(),
      );
      producedId = findItemId(toolDef!.produceCategory, line, level);
    }

    if (!producedId) {
      CurrencyManager.addStamina(staminaCost);
      console.warn('[Building] 找不到产出物品');
      return null;
    }

    BoardManager.placeItem(targetIndex, producedId);
    if (toolDef!.cooldown > 0) {
      state.freeProducesLeft--;
      if (state.freeProducesLeft <= 0) {
        state.cdRemaining = toolDef!.cooldown;
      }
    }
    this._consumeExhaustibleTool(cellIndex, cell.itemId, state, toolDef!);

    const resultDef = ITEM_DEFS.get(producedId);
    console.log(`[Building] 产出: ${resultDef?.name}(Lv.${resultDef?.level}) → 格子${targetIndex}`);
    EventBus.emit('building:produced', cellIndex, targetIndex, producedId);

    return { placements: [{ itemId: producedId, targetIndex }] };
  }

  /** 宝箱：首次点击扣体力并掷出固定件数；每次点击往全棋盘空格散落，未散完保留宝箱并显示进度 */
  private _produceChest(cellIndex: number, chestDef: ChestDef): { placements: ProducePlacement[] } | null {
    const cell = BoardManager.getCellByIndex(cellIndex);
    if (!cell?.itemId) return null;

    const state = this._getOrCreateState(cellIndex, cell.itemId);
    const staminaCost = chestDef.staminaCost;

    if (state.chestQueue === undefined) {
      if (!CurrencyManager.consumeStamina(staminaCost)) {
        EventBus.emit('building:noStamina', cellIndex, staminaCost);
        return null;
      }
      const queue: string[] = [];
      for (let i = 0; i < chestDef.boardDropCount; i++) {
        const id = this._rollChestProduce(chestDef, cellIndex);
        if (!id) continue;
        queue.push(id);
      }
      state.chestQueue = queue;
      state.chestTotalBoardDrops = queue.length;
      if (queue.length === 0) {
        BoardManager.removeItem(cellIndex);
        this._states.delete(cellIndex);
        EventBus.emit('building:exhausted', cellIndex);
        return { placements: [] };
      }
    }

    const queue = state.chestQueue!;
    if (queue.length === 0) {
      BoardManager.removeItem(cellIndex);
      this._states.delete(cellIndex);
      EventBus.emit('building:exhausted', cellIndex);
      return { placements: [] };
    }

    const empties = BoardManager.getEmptyOpenCellIndices();
    const targets = empties.filter(i => i !== cellIndex);
    const placements: ProducePlacement[] = [];

    while (queue.length > 0 && targets.length > 0) {
      const itemId = queue[0];
      let placed = false;
      while (!placed && targets.length > 0) {
        const ti = targets.shift()!;
        if (BoardManager.placeItem(ti, itemId)) {
          queue.shift();
          placements.push({ itemId, targetIndex: ti });
          const resultDef = ITEM_DEFS.get(itemId);
          console.log(`[Building] 宝箱散落: ${resultDef?.name} → 格子${ti}`);
          EventBus.emit('building:produced', cellIndex, ti, itemId);
          placed = true;
        }
      }
      if (!placed) break;
    }

    if (queue.length > 0 && placements.length === 0) {
      EventBus.emit('building:chestNeedsSpace', cellIndex, queue.length);
    } else if (queue.length > 0) {
      EventBus.emit('building:chestPartial', cellIndex, queue.length);
    }

    if (queue.length === 0) {
      BoardManager.removeItem(cellIndex);
      this._states.delete(cellIndex);
      EventBus.emit('building:exhausted', cellIndex);
    }

    return { placements };
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

  /** 获取消耗型次数（-1 表示不显示；宝箱/红包待散落件数走 getChestDispatchProgress 角标） */
  getUsesLeft(cellIndex: number): number {
    const cell = BoardManager.getCellByIndex(cellIndex);
    if (!cell?.itemId) return -1;

    if (this._findChestDef(cell.itemId)) return -1;

    const wrapDef = findBoardProducerDef(cell.itemId);
    const wrapMax = wrapDef?.exhaustAfterProduces;

    if (wrapMax && wrapMax > 0) {
      const state = this._states.get(cellIndex);
      if (!state) return wrapMax;
      return state.usesLeft;
    }

    return -1;
  }

  /** 宝箱/红包内仍待落到棋盘的件数与总件数（用于右下角角标）；非容器或未开箱返回 null */
  getChestDispatchProgress(cellIndex: number): { remaining: number; total: number } | null {
    const cell = BoardManager.getCellByIndex(cellIndex);
    if (!cell?.itemId || !this._findChestDef(cell.itemId)) return null;
    const state = this._states.get(cellIndex);
    if (!state || state.chestQueue === undefined) return null;
    const total = state.chestTotalBoardDrops ?? state.chestQueue.length;
    return { remaining: state.chestQueue.length, total: Math.max(1, total) };
  }

  exportState(): BuildingPersistEntry[] {
    const out: BuildingPersistEntry[] = [];
    for (const [cellIndex, s] of this._states) {
      out.push({
        cellIndex,
        boundItemId: s.boundItemId,
        cdRemaining: s.cdRemaining,
        usesLeft: s.usesLeft,
        freeProducesLeft: s.freeProducesLeft,
        chestQueue: s.chestQueue ? [...s.chestQueue] : undefined,
        chestTotalBoardDrops: s.chestTotalBoardDrops,
      });
    }
    return out;
  }

  loadState(entries: BuildingPersistEntry[] | undefined): void {
    this._states.clear();
    if (!entries?.length) return;
    for (const e of entries) {
      const cell = BoardManager.getCellByIndex(e.cellIndex);
      if (!cell || cell.itemId !== e.boundItemId) continue;
      const q = e.chestQueue
        ? e.chestQueue.filter(id => ITEM_DEFS.has(id))
        : undefined;
      if (this._findChestDef(e.boundItemId) && q !== undefined && q.length === 0) {
        BoardManager.removeItem(e.cellIndex);
        continue;
      }
      this._states.set(e.cellIndex, {
        boundItemId: e.boundItemId,
        cdRemaining: e.cdRemaining,
        usesLeft: e.usesLeft,
        freeProducesLeft: e.freeProducesLeft,
        chestQueue: q,
        chestTotalBoardDrops: e.chestTotalBoardDrops,
      });
    }
  }

  /**
   * 移入仓库前拷贝本格工具/交互物状态（不删 Map）。
   * 随后 BoardManager.removeItem → board:itemRemoved 会清掉棋盘上的 runtime。
   */
  snapshotToolStateAt(cellIndex: number): ToolStateSnapshot | null {
    const cell = BoardManager.getCellByIndex(cellIndex);
    if (!cell?.itemId) return null;
    const s = this._states.get(cellIndex);
    if (!s || s.boundItemId !== cell.itemId) return null;
    return {
      boundItemId: s.boundItemId,
      cdRemaining: s.cdRemaining,
      usesLeft: s.usesLeft,
      freeProducesLeft: s.freeProducesLeft,
      chestQueue: s.chestQueue ? [...s.chestQueue] : undefined,
      chestTotalBoardDrops: s.chestTotalBoardDrops,
    };
  }

  /** 从仓库取回并 placeItem 之后恢复 CD、周期内免费次数、消耗剩余次数、宝箱队列 */
  restoreStateFromWarehouse(
    cellIndex: number,
    itemId: string,
    snap: ToolStateSnapshot | null | undefined,
  ): void {
    if (!snap) return;
    if (snap.boundItemId !== itemId) return;
    const q = snap.chestQueue
      ? snap.chestQueue.filter(id => ITEM_DEFS.has(id))
      : undefined;
    if (this._findChestDef(itemId) && q !== undefined && q.length === 0) return;
    this._states.set(cellIndex, {
      boundItemId: snap.boundItemId,
      cdRemaining: snap.cdRemaining,
      usesLeft: snap.usesLeft,
      freeProducesLeft: snap.freeProducesLeft,
      chestQueue: q,
      chestTotalBoardDrops: snap.chestTotalBoardDrops,
    });
  }

  reset(): void {
    this._states.clear();
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
        usesLeftInit = -1;
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

  private _consumeExhaustibleTool(
    cellIndex: number,
    _itemId: string,
    state: BuildingState,
    toolDef: NonNullable<ReturnType<typeof findBoardProducerDef>>,
  ): void {
    const n = toolDef.exhaustAfterProduces;
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
        const lv = this._clampProduceLevel(
          o.category,
          o.line,
          o.level + ToolProducePolicy.getProduceLevelBonus(),
        );
        return findItemId(o.category, o.line, lv);
      }
    }
    const last = outcomes[outcomes.length - 1];
    const lv = this._clampProduceLevel(
      last.category,
      last.line,
      last.level + ToolProducePolicy.getProduceLevelBonus(),
    );
    return findItemId(last.category, last.line, lv);
  }

  private _clampProduceLevel(category: Category, line: string, level: number): number {
    const maxLv = getMaxLevelForLine(category, line);
    if (maxLv <= 0) return Math.max(1, level);
    return Math.min(maxLv, Math.max(1, level));
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
