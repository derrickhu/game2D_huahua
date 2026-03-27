/**
 * 工具/建筑配置
 *
 * 工具链：园艺 6 级；包装线 5 级；茶饮/冷饮/烘焙 5 级；1–2级不可产出，3级起可产出（包装线产出包装中间品）。
 * 花束由「花束包装纸」消耗次数产出；种植线用 produceOutcomes。
 * 工具放在棋盘上可点击产出（仅 canProduce），合成两个同级工具升级为下一级
 */

import { Category, FlowerLine, DrinkLine, ToolLine } from './ItemConfig';

/** 单次产出的明确目标：品类 + 产品线 + 产品等级 + 权重（相对权重即可） */
export interface ToolProduceOutcome {
  category: Category;
  line: string;
  level: number;
  weight: number;
}

export interface ToolDef {
  /** 物品ID（对应 ItemConfig 中的 tool_xxx_N） */
  itemId: string;
  /** 工具线 */
  toolLine: ToolLine;
  /** 工具等级（园艺/花艺 1–6；茶饮/冷饮/烘焙 1–5） */
  level: number;
  /** 是否可点击产出（1–2 级为 false，仅合成） */
  canProduce: boolean;
  /** 产出的品类 */
  produceCategory: Category;
  /** 产出的产品线（单线工具、或 produceOutcomes 的展示回退） */
  produceLine: string;
  /**
   * 若存在：先按 produceTable 掷等级，再从中 **均匀随机** 选一条产品线产出同等级物品
   * （与 produceLine 同时存在时，产出逻辑以本字段为准）
   */
  produceLinesRandom?: string[];
  /**
   * 若存在且非空：**按权重**随机一条，产出指定品类+线+等级；优先于 produceTable / produceLinesRandom。
   */
  produceOutcomes?: ToolProduceOutcome[];
  /** 产出等级概率表 [[level, weight], ...]；无 produceOutcomes 时使用 */
  produceTable: [number, number][];
  /** CD时间（秒），0 表示无 CD 周期 */
  cooldown: number;
  /**
   * 进入 CD 前可连续产出的次数；仅当 cooldown > 0 时有效。
   * 每产出一次减 1，减至 0 时进入 cooldown（秒），CD 结束后恢复为满次数。
   */
  producesBeforeCooldown: number;
  /** 消耗体力 */
  staminaCost: number;
  /**
   * 若 >0：累计产出该次数后移除该格物品（花束包装纸等）。
   * 与棋盘 `usesLeft` 绑定，不计入 CD 周期。
   */
  exhaustAfterProduces?: number;
}

// ═══════════════ 单线工具共用：按「产出档」掷产品等级（种植线除外，见 produceOutcomes） ═══════════════
/** 产出档 A（原 Lv1 工具表） */
const SHARED_PRODUCE_TABLE_LV1: [number, number][] = [[1, 70], [2, 25], [3, 5]];
/** 产出档 B（原 Lv2 工具表） */
const SHARED_PRODUCE_TABLE_LV2: [number, number][] = [[2, 60], [3, 25], [4, 10], [5, 5]];
/** 产出档 C（原 Lv3 工具表） */
const SHARED_PRODUCE_TABLE_LV3: [number, number][] = [[4, 70], [5, 20], [6, 9], [7, 1]];
// ═══════════════ 包装线工具 → 产出包装中间品（FlowerLine.WRAP） ═══════════════

/** 简易包装台：丝带卷/条/纸 */
const ARRANGE_WRAP_OUTCOME_T3: ToolProduceOutcome[] = [
  { category: Category.FLOWER, line: FlowerLine.WRAP, level: 1, weight: 52 },
  { category: Category.FLOWER, line: FlowerLine.WRAP, level: 2, weight: 33 },
  { category: Category.FLOWER, line: FlowerLine.WRAP, level: 3, weight: 15 },
];
/** 包装台 */
const ARRANGE_WRAP_OUTCOME_T4: ToolProduceOutcome[] = [
  { category: Category.FLOWER, line: FlowerLine.WRAP, level: 1, weight: 18 },
  { category: Category.FLOWER, line: FlowerLine.WRAP, level: 2, weight: 32 },
  { category: Category.FLOWER, line: FlowerLine.WRAP, level: 3, weight: 35 },
  { category: Category.FLOWER, line: FlowerLine.WRAP, level: 4, weight: 15 },
];
/** 高级包装台 */
const ARRANGE_WRAP_OUTCOME_T5: ToolProduceOutcome[] = [
  { category: Category.FLOWER, line: FlowerLine.WRAP, level: 1, weight: 5 },
  { category: Category.FLOWER, line: FlowerLine.WRAP, level: 2, weight: 15 },
  { category: Category.FLOWER, line: FlowerLine.WRAP, level: 3, weight: 35 },
  { category: Category.FLOWER, line: FlowerLine.WRAP, level: 4, weight: 45 },
];

const arrangeToolTemplate = (): Omit<ToolDef, 'itemId' | 'level'>[] => [
  {
    toolLine: ToolLine.ARRANGE,
    produceCategory: Category.FLOWER,
    produceLine: FlowerLine.WRAP,
    canProduce: false,
    produceTable: [],
    cooldown: 0,
    producesBeforeCooldown: 0,
    staminaCost: 0,
  },
  {
    toolLine: ToolLine.ARRANGE,
    produceCategory: Category.FLOWER,
    produceLine: FlowerLine.WRAP,
    canProduce: false,
    produceTable: [],
    cooldown: 0,
    producesBeforeCooldown: 0,
    staminaCost: 0,
  },
  {
    toolLine: ToolLine.ARRANGE,
    produceCategory: Category.FLOWER,
    produceLine: FlowerLine.WRAP,
    canProduce: true,
    produceTable: [],
    produceOutcomes: ARRANGE_WRAP_OUTCOME_T3,
    cooldown: 0,
    producesBeforeCooldown: 0,
    staminaCost: 3,
  },
  {
    toolLine: ToolLine.ARRANGE,
    produceCategory: Category.FLOWER,
    produceLine: FlowerLine.WRAP,
    canProduce: true,
    produceTable: [],
    produceOutcomes: ARRANGE_WRAP_OUTCOME_T4,
    cooldown: 120,
    producesBeforeCooldown: 20,
    staminaCost: 5,
  },
  {
    toolLine: ToolLine.ARRANGE,
    produceCategory: Category.FLOWER,
    produceLine: FlowerLine.WRAP,
    canProduce: true,
    produceTable: [],
    produceOutcomes: ARRANGE_WRAP_OUTCOME_T5,
    cooldown: 300,
    producesBeforeCooldown: 10,
    staminaCost: 8,
  },
];

/** 种植线产出档 A（原 1 级种植工具） */
const PLANT_OUTCOMES_LV1: ToolProduceOutcome[] = [
  { category: Category.FLOWER, line: FlowerLine.FRESH, level: 1, weight: 50 },
  { category: Category.FLOWER, line: FlowerLine.GREEN, level: 1, weight: 40 },
  { category: Category.FLOWER, line: FlowerLine.FRESH, level: 2, weight: 10 },
];

/** 种植线产出档 B（原 2 级种植工具） */
const PLANT_OUTCOMES_LV2: ToolProduceOutcome[] = [
  { category: Category.FLOWER, line: FlowerLine.FRESH, level: 3, weight: 50 },
  { category: Category.FLOWER, line: FlowerLine.GREEN, level: 2, weight: 40 },
  { category: Category.FLOWER, line: FlowerLine.GREEN, level: 3, weight: 10 },
];

/** 种植线产出档 C（原 3 级种植工具） */
const PLANT_OUTCOMES_LV3: ToolProduceOutcome[] = [
  { category: Category.FLOWER, line: FlowerLine.FRESH, level: 4, weight: 30 },
  { category: Category.FLOWER, line: FlowerLine.GREEN, level: 3, weight: 30 },
  { category: Category.FLOWER, line: FlowerLine.FRESH, level: 5, weight: 20 },
  { category: Category.FLOWER, line: FlowerLine.GREEN, level: 4, weight: 10 },
  { category: Category.FLOWER, line: FlowerLine.FRESH, level: 6, weight: 5 },
  { category: Category.FLOWER, line: FlowerLine.GREEN, level: 5, weight: 5 },
];

/** 种植线产出档 D：高级温室 — 偏高等级鲜花/绿植 */
const PLANT_OUTCOMES_LV4: ToolProduceOutcome[] = [
  { category: Category.FLOWER, line: FlowerLine.FRESH, level: 5, weight: 28 },
  { category: Category.FLOWER, line: FlowerLine.GREEN, level: 4, weight: 25 },
  { category: Category.FLOWER, line: FlowerLine.FRESH, level: 6, weight: 22 },
  { category: Category.FLOWER, line: FlowerLine.GREEN, level: 5, weight: 12 },
  { category: Category.FLOWER, line: FlowerLine.FRESH, level: 7, weight: 8 },
  { category: Category.FLOWER, line: FlowerLine.GREEN, level: 6, weight: 5 },
];

const plantToolTemplate = (): Omit<ToolDef, 'itemId' | 'level'>[] => [
  {
    toolLine: ToolLine.PLANT,
    produceCategory: Category.FLOWER,
    produceLine: FlowerLine.FRESH,
    canProduce: false,
    produceTable: [],
    cooldown: 0,
    producesBeforeCooldown: 0,
    staminaCost: 0,
  },
  {
    toolLine: ToolLine.PLANT,
    produceCategory: Category.FLOWER,
    produceLine: FlowerLine.FRESH,
    canProduce: false,
    produceTable: [],
    cooldown: 0,
    producesBeforeCooldown: 0,
    staminaCost: 0,
  },
  {
    toolLine: ToolLine.PLANT,
    produceCategory: Category.FLOWER,
    produceLine: FlowerLine.FRESH,
    canProduce: true,
    produceTable: [],
    produceOutcomes: PLANT_OUTCOMES_LV1,
    cooldown: 0,
    producesBeforeCooldown: 0,
    staminaCost: 3,
  },
  {
    toolLine: ToolLine.PLANT,
    produceCategory: Category.FLOWER,
    produceLine: FlowerLine.FRESH,
    canProduce: true,
    produceTable: [],
    produceOutcomes: PLANT_OUTCOMES_LV2,
    cooldown: 120,
    producesBeforeCooldown: 20,
    staminaCost: 5,
  },
  {
    toolLine: ToolLine.PLANT,
    produceCategory: Category.FLOWER,
    produceLine: FlowerLine.FRESH,
    canProduce: true,
    produceTable: [],
    produceOutcomes: PLANT_OUTCOMES_LV3,
    cooldown: 300,
    producesBeforeCooldown: 10,
    staminaCost: 8,
  },
  {
    toolLine: ToolLine.PLANT,
    produceCategory: Category.FLOWER,
    produceLine: FlowerLine.FRESH,
    canProduce: true,
    produceTable: [],
    produceOutcomes: PLANT_OUTCOMES_LV4,
    cooldown: 360,
    producesBeforeCooldown: 8,
    staminaCost: 10,
  },
];

// ═══════════════ 饮品工具（产品8级）— 茶饮/冷饮/烘焙线为 5 级，无第 6 档 ═══════════════

const drinkToolTemplate = (toolLine: ToolLine, produceLine: DrinkLine): Omit<ToolDef, 'itemId' | 'level'>[] => [
  {
    toolLine, produceCategory: Category.DRINK, produceLine,
    canProduce: false,
    produceTable: [],
    cooldown: 0, producesBeforeCooldown: 0, staminaCost: 0,
  },
  {
    toolLine, produceCategory: Category.DRINK, produceLine,
    canProduce: false,
    produceTable: [],
    cooldown: 0, producesBeforeCooldown: 0, staminaCost: 0,
  },
  {
    toolLine, produceCategory: Category.DRINK, produceLine,
    canProduce: true,
    produceTable: SHARED_PRODUCE_TABLE_LV1,
    cooldown: 0, producesBeforeCooldown: 0, staminaCost: 3,
  },
  {
    toolLine, produceCategory: Category.DRINK, produceLine,
    canProduce: true,
    produceTable: SHARED_PRODUCE_TABLE_LV2,
    cooldown: 120, producesBeforeCooldown: 20, staminaCost: 5,
  },
  {
    toolLine, produceCategory: Category.DRINK, produceLine,
    canProduce: true,
    produceTable: SHARED_PRODUCE_TABLE_LV3,
    cooldown: 300, producesBeforeCooldown: 10, staminaCost: 8,
  },
];

// ═══════════════ 构建完整工具定义表 ═══════════════

function buildToolDefs(): Map<string, ToolDef> {
  const map = new Map<string, ToolDef>();

  const allTemplates: Omit<ToolDef, 'itemId' | 'level'>[][] = [
    plantToolTemplate(),
    arrangeToolTemplate(),
    drinkToolTemplate(ToolLine.TEA_SET, DrinkLine.TEA),
    drinkToolTemplate(ToolLine.MIXER, DrinkLine.COLD),
    drinkToolTemplate(ToolLine.BAKE, DrinkLine.DESSERT),
  ];

  for (const templates of allTemplates) {
    for (let i = 0; i < templates.length; i++) {
      const t = templates[i];
      const level = i + 1;
      const itemId = `tool_${t.toolLine}_${level}`;
      map.set(itemId, { itemId, level, ...t });
    }
  }

  return map;
}

export const TOOL_DEFS = buildToolDefs();

/** 棋盘上的非 tool_* 产出定义（如花束包装纸） */
function buildBoardProducerDefs(): Map<string, ToolDef> {
  const map = new Map<string, ToolDef>();
  map.set('flower_wrap_4', {
    itemId: 'flower_wrap_4',
    toolLine: ToolLine.ARRANGE,
    level: 4,
    canProduce: true,
    produceCategory: Category.FLOWER,
    produceLine: FlowerLine.BOUQUET,
    produceTable: SHARED_PRODUCE_TABLE_LV1,
    cooldown: 0,
    producesBeforeCooldown: 0,
    staminaCost: 3,
    exhaustAfterProduces: 15,
  });
  return map;
}

export const BOARD_PRODUCER_DEFS = buildBoardProducerDefs();

/** 根据物品ID查找工具定义（仅 tool_*） */
export function findToolDef(itemId: string): ToolDef | undefined {
  return TOOL_DEFS.get(itemId);
}

/** 工具或棋盘特殊产出物（tool_* + 花束包装纸等） */
export function findBoardProducerDef(itemId: string): ToolDef | undefined {
  return TOOL_DEFS.get(itemId) ?? BOARD_PRODUCER_DEFS.get(itemId);
}

function toolMatchesProductLine(def: ToolDef, category: Category, productLine: string): boolean {
  if (def.produceOutcomes && def.produceOutcomes.length > 0) {
    return def.produceOutcomes.some(
      o => o.category === category && o.line === productLine,
    );
  }
  if (def.produceCategory !== category) return false;
  const lines = def.produceLinesRandom ?? [def.produceLine];
  return lines.includes(productLine);
}

/**
 * 可产出指定产品线物品的「该线最低等级」工具 ID（按 toolLine 去重）。
 * 用于合成线面板「获取来源」；宝箱等无对应工具时返回空数组。
 */
export function getSourceToolsForProductLine(
  category: Category,
  productLine: string,
): string[] {
  const byToolLine = new Map<ToolLine, { level: number; itemId: string }>();
  const allDefs = [...TOOL_DEFS.values(), ...BOARD_PRODUCER_DEFS.values()];
  for (const def of allDefs) {
    if (!def.canProduce) continue;
    if (!toolMatchesProductLine(def, category, productLine)) continue;
    const prev = byToolLine.get(def.toolLine);
    if (!prev || def.level < prev.level) {
      byToolLine.set(def.toolLine, { level: def.level, itemId: def.itemId });
    }
  }
  return Array.from(byToolLine.values()).map(x => x.itemId);
}

/** 工具在信息栏等处的产出等级范围（来自 produceOutcomes 或 produceTable） */
export function getToolProduceLevelRange(def: ToolDef): { min: number; max: number } | null {
  if (!def.canProduce) return null;
  if (def.produceOutcomes && def.produceOutcomes.length > 0) {
    const levels = def.produceOutcomes.map(o => o.level);
    return { min: Math.min(...levels), max: Math.max(...levels) };
  }
  if (def.produceTable.length > 0) {
    const levels = def.produceTable.map(([lv]) => lv);
    return { min: Math.min(...levels), max: Math.max(...levels) };
  }
  return null;
}
