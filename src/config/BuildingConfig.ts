/**
 * 工具/建筑配置
 *
 * 工具链：园艺 6 级；包装线 5 级；捕虫网/冷饮/烘焙各 5 级；1–2级不可产出，3级起可产出（包装线产出包装中间品）。
 * 花束由「花束包装纸」消耗次数产出；种植线用 produceOutcomes。
 * 工具放在棋盘上可点击产出（仅 canProduce），合成两个同级工具升级为下一级
 */

import { Category, FlowerLine, DrinkLine, ToolLine, findItemId } from './ItemConfig';

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
  /** 工具等级（园艺/花艺 1–6；捕虫网/冷饮/烘焙 1–5） */
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

/** 带 CD 的工具：每周期内产出次数（全游戏统一） */
const TOOL_CD_CHARGES_PER_CYCLE = 20;

/**
 * 线内 CD 档位（从 0 起）：最低 3 分钟，每升一档 +1 分钟。
 * 园艺 L5/L6/L7 → 0,1,2；包装 L3/L5（有 CD 的两档）→ 0,1；饮品三线 L5 → 仅 0。
 */
function cdTierSeconds(tierIndex: number): number {
  return 3 * 60 + tierIndex * 60;
}

// ═══════════════ 单线工具共用：按「产出档」掷产品等级（种植线除外，见 produceOutcomes） ═══════════════
/** 产出档 A（原 Lv1 工具表） */
const SHARED_PRODUCE_TABLE_LV1: [number, number][] = [[1, 70], [2, 25], [3, 5]];
/** 产出档 B（原 Lv2 工具表） */
const SHARED_PRODUCE_TABLE_LV2: [number, number][] = [[2, 60], [3, 25], [4, 10], [5, 5]];
/** 产出档 C（原 Lv3 工具表） */
const SHARED_PRODUCE_TABLE_LV3: [number, number][] = [[4, 70], [5, 20], [6, 9], [7, 1]];

// ═══════════════ 冷饮线工具（tool_mixer）专属产出等级表；蝴蝶网/烘焙用专用表或 SHARED ═══════════════
/** tool_mixer_3：仅 1 级冷饮 */
const MIXER_PRODUCE_TABLE_L3: [number, number][] = [[1, 100]];
/** tool_mixer_4：1～2 级 */
const MIXER_PRODUCE_TABLE_L4: [number, number][] = [[1, 58], [2, 42]];
/** tool_mixer_5：1～3 级 */
const MIXER_PRODUCE_TABLE_L5: [number, number][] = [[1, 45], [2, 35], [3, 20]];

// ═══════════════ 蝴蝶线工具（tool_butterfly_net）专属产出等级表；产品共 10 级 ═══════════════
/** tool_butterfly_net_3：入门 1～3 级 */
const BUTTERFLY_NET_PRODUCE_TABLE_L3: [number, number][] = [[1, 62], [2, 28], [3, 10]];
/** tool_butterfly_net_4：2～6 级 */
const BUTTERFLY_NET_PRODUCE_TABLE_L4: [number, number][] = [
  [2, 18], [3, 28], [4, 28], [5, 16], [6, 10],
];
/** tool_butterfly_net_5：中高等级，含 CD */
const BUTTERFLY_NET_PRODUCE_TABLE_L5: [number, number][] = [
  [4, 22], [5, 22], [6, 20], [7, 16], [8, 12], [9, 5], [10, 3],
];

// ═══════════════ 包装线工具 → 产出包装中间品（FlowerLine.WRAP） ═══════════════

/** 简易包装台：仅产出包装中间品 Lv1（丝带卷） */
const ARRANGE_WRAP_OUTCOME_T3: ToolProduceOutcome[] = [
  { category: Category.FLOWER, line: FlowerLine.WRAP, level: 1, weight: 100 },
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
    cooldown: cdTierSeconds(0),
    producesBeforeCooldown: TOOL_CD_CHARGES_PER_CYCLE,
    staminaCost: 1,
  },
  {
    toolLine: ToolLine.ARRANGE,
    produceCategory: Category.FLOWER,
    produceLine: FlowerLine.WRAP,
    canProduce: true,
    produceTable: [],
    produceOutcomes: ARRANGE_WRAP_OUTCOME_T4,
    cooldown: 0,
    producesBeforeCooldown: 0,
    staminaCost: 1,
  },
  {
    toolLine: ToolLine.ARRANGE,
    produceCategory: Category.FLOWER,
    produceLine: FlowerLine.WRAP,
    canProduce: true,
    produceTable: [],
    produceOutcomes: ARRANGE_WRAP_OUTCOME_T5,
    cooldown: cdTierSeconds(1),
    producesBeforeCooldown: TOOL_CD_CHARGES_PER_CYCLE,
    staminaCost: 1,
  },
];

/** 园艺 L3 工具：仅鲜花线 1 级 */
const PLANT_OUTCOMES_TOOL_L3: ToolProduceOutcome[] = [
  { category: Category.FLOWER, line: FlowerLine.FRESH, level: 1, weight: 100 },
];

/** 园艺 L4 工具：育苗仓 — 绿植 L1 55%、鲜花 L1 40%、鲜花 L2 5%（权重合计 100） */
const PLANT_OUTCOMES_TOOL_L4: ToolProduceOutcome[] = [
  { category: Category.FLOWER, line: FlowerLine.GREEN, level: 1, weight: 55 },
  { category: Category.FLOWER, line: FlowerLine.FRESH, level: 1, weight: 40 },
  { category: Category.FLOWER, line: FlowerLine.FRESH, level: 2, weight: 5 },
];

/** 园艺 L5 工具：简易温室 — 鲜/绿 1～3 级：1 级各 5%，2 级各 40%，3 级各 5% */
const PLANT_OUTCOMES_TOOL_L5: ToolProduceOutcome[] = [
  { category: Category.FLOWER, line: FlowerLine.FRESH, level: 1, weight: 5 },
  { category: Category.FLOWER, line: FlowerLine.GREEN, level: 1, weight: 5 },
  { category: Category.FLOWER, line: FlowerLine.FRESH, level: 2, weight: 40 },
  { category: Category.FLOWER, line: FlowerLine.GREEN, level: 2, weight: 40 },
  { category: Category.FLOWER, line: FlowerLine.FRESH, level: 3, weight: 5 },
  { category: Category.FLOWER, line: FlowerLine.GREEN, level: 3, weight: 5 },
];

/** 园艺 L6 工具：温室 — 鲜/绿 L4 各 30%，L5 各 10%，L6 各 10% */
const PLANT_OUTCOMES_TOOL_L6: ToolProduceOutcome[] = [
  { category: Category.FLOWER, line: FlowerLine.FRESH, level: 4, weight: 30 },
  { category: Category.FLOWER, line: FlowerLine.GREEN, level: 4, weight: 30 },
  { category: Category.FLOWER, line: FlowerLine.FRESH, level: 5, weight: 10 },
  { category: Category.FLOWER, line: FlowerLine.GREEN, level: 5, weight: 10 },
  { category: Category.FLOWER, line: FlowerLine.FRESH, level: 6, weight: 10 },
  { category: Category.FLOWER, line: FlowerLine.GREEN, level: 6, weight: 10 },
];

/** 园艺 L7 工具：高级温室 — 向高等级鲜花/绿植倾斜（对齐 13 级链末端） */
const PLANT_OUTCOMES_TOOL_L7: ToolProduceOutcome[] = [
  { category: Category.FLOWER, line: FlowerLine.FRESH, level: 7, weight: 24 },
  { category: Category.FLOWER, line: FlowerLine.GREEN, level: 6, weight: 22 },
  { category: Category.FLOWER, line: FlowerLine.FRESH, level: 8, weight: 18 },
  { category: Category.FLOWER, line: FlowerLine.GREEN, level: 7, weight: 14 },
  { category: Category.FLOWER, line: FlowerLine.FRESH, level: 9, weight: 12 },
  { category: Category.FLOWER, line: FlowerLine.GREEN, level: 8, weight: 7 },
  { category: Category.FLOWER, line: FlowerLine.FRESH, level: 10, weight: 3 },
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
    produceOutcomes: PLANT_OUTCOMES_TOOL_L3,
    cooldown: 0,
    producesBeforeCooldown: 0,
    staminaCost: 1,
  },
  {
    toolLine: ToolLine.PLANT,
    produceCategory: Category.FLOWER,
    produceLine: FlowerLine.FRESH,
    canProduce: true,
    produceTable: [],
    produceOutcomes: PLANT_OUTCOMES_TOOL_L4,
    cooldown: 0,
    producesBeforeCooldown: 0,
    staminaCost: 1,
  },
  {
    toolLine: ToolLine.PLANT,
    produceCategory: Category.FLOWER,
    produceLine: FlowerLine.FRESH,
    canProduce: true,
    produceTable: [],
    produceOutcomes: PLANT_OUTCOMES_TOOL_L5,
    cooldown: cdTierSeconds(0),
    producesBeforeCooldown: TOOL_CD_CHARGES_PER_CYCLE,
    staminaCost: 1,
  },
  {
    toolLine: ToolLine.PLANT,
    produceCategory: Category.FLOWER,
    produceLine: FlowerLine.FRESH,
    canProduce: true,
    produceTable: [],
    produceOutcomes: PLANT_OUTCOMES_TOOL_L6,
    cooldown: cdTierSeconds(1),
    producesBeforeCooldown: TOOL_CD_CHARGES_PER_CYCLE,
    staminaCost: 1,
  },
  {
    toolLine: ToolLine.PLANT,
    produceCategory: Category.FLOWER,
    produceLine: FlowerLine.FRESH,
    canProduce: true,
    produceTable: [],
    produceOutcomes: PLANT_OUTCOMES_TOOL_L7,
    cooldown: cdTierSeconds(2),
    producesBeforeCooldown: TOOL_CD_CHARGES_PER_CYCLE,
    staminaCost: 1,
  },
];

// ═══════════════ 饮品工具 — 蝴蝶 10 级 + 捕虫网 5 档；冷饮/甜品 8 级 + 各 5 档 ═══════════════

const drinkToolTemplate = (toolLine: ToolLine, produceLine: DrinkLine): Omit<ToolDef, 'itemId' | 'level'>[] => {
  const isMixer = toolLine === ToolLine.MIXER;
  const isButterflyNet = produceLine === DrinkLine.BUTTERFLY;
  const tableL3 = isMixer
    ? MIXER_PRODUCE_TABLE_L3
    : isButterflyNet
      ? BUTTERFLY_NET_PRODUCE_TABLE_L3
      : SHARED_PRODUCE_TABLE_LV1;
  const tableL4 = isMixer
    ? MIXER_PRODUCE_TABLE_L4
    : isButterflyNet
      ? BUTTERFLY_NET_PRODUCE_TABLE_L4
      : SHARED_PRODUCE_TABLE_LV2;
  const tableL5 = isMixer
    ? MIXER_PRODUCE_TABLE_L5
    : isButterflyNet
      ? BUTTERFLY_NET_PRODUCE_TABLE_L5
      : SHARED_PRODUCE_TABLE_LV3;
  return [
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
      produceTable: tableL3,
      cooldown: 0, producesBeforeCooldown: 0, staminaCost: 1,
    },
    {
      toolLine, produceCategory: Category.DRINK, produceLine,
      canProduce: true,
      produceTable: tableL4,
      cooldown: 0, producesBeforeCooldown: 0, staminaCost: 1,
    },
    {
      toolLine, produceCategory: Category.DRINK, produceLine,
      canProduce: true,
      produceTable: tableL5,
      cooldown: cdTierSeconds(0),
      producesBeforeCooldown: TOOL_CD_CHARGES_PER_CYCLE,
      staminaCost: 1,
    },
  ];
};

// ═══════════════ 构建完整工具定义表 ═══════════════

function buildToolDefs(): Map<string, ToolDef> {
  const map = new Map<string, ToolDef>();

  const allTemplates: Omit<ToolDef, 'itemId' | 'level'>[][] = [
    plantToolTemplate(),
    arrangeToolTemplate(),
    drinkToolTemplate(ToolLine.BUTTERFLY_NET, DrinkLine.BUTTERFLY),
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
  /** 花束材料包：与宝箱不同，仍为每点一次产 1 个花束，共 `exhaustAfterProduces` 次后格子清空（BuildingManager 工具分支） */
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
    staminaCost: 1,
    exhaustAfterProduces: 10,
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

/** 合成线「可产出」悬浮窗：单次点击各可能产物的概率（百分比，与运行时掷骰逻辑一致） */
export type ToolProduceDisplayEntry = { itemId: string; percent: number };

function roundOutcomePercent(p: number): number {
  return Math.round(p * 10) / 10;
}

/** 合并相同 itemId 的概率（如多线均分同一等级时）；宝箱产出预览与工具共用 */
export function mergeOutcomePercents(entries: ToolProduceDisplayEntry[]): ToolProduceDisplayEntry[] {
  const map = new Map<string, number>();
  for (const { itemId, percent } of entries) {
    map.set(itemId, (map.get(itemId) ?? 0) + percent);
  }
  return [...map.entries()]
    .map(([itemId, percent]) => ({ itemId, percent: roundOutcomePercent(percent) }))
    .sort((a, b) => b.percent - a.percent || a.itemId.localeCompare(b.itemId));
}

/**
 * 与 BuildingManager.produce 一致：
 * - 有 produceOutcomes：按 weight 加权；
 * - 否则按 produceTable 掷等级，再在 produceLinesRandom 或单条 produceLine 上均匀选线。
 */
export function getBoardProducerOutcomePercents(def: ToolDef): ToolProduceDisplayEntry[] {
  if (def.produceOutcomes && def.produceOutcomes.length > 0) {
    const sum = def.produceOutcomes.reduce((s, o) => s + o.weight, 0);
    if (sum <= 0) return [];
    const raw: ToolProduceDisplayEntry[] = [];
    for (const o of def.produceOutcomes) {
      const id = findItemId(o.category, o.line, o.level);
      if (!id) continue;
      raw.push({ itemId: id, percent: (o.weight / sum) * 100 });
    }
    return mergeOutcomePercents(raw);
  }

  const table = def.produceTable;
  if (!table.length) return [];
  const sumT = table.reduce((s, [, w]) => s + w, 0);
  if (sumT <= 0) return [];
  const lines =
    def.produceLinesRandom && def.produceLinesRandom.length > 0
      ? def.produceLinesRandom
      : [def.produceLine];
  const raw: ToolProduceDisplayEntry[] = [];
  for (const [lvl, w] of table) {
    for (const line of lines) {
      const id = findItemId(def.produceCategory, line, lvl);
      if (!id) continue;
      raw.push({ itemId: id, percent: (w / sumT) * (1 / lines.length) * 100 });
    }
  }
  return mergeOutcomePercents(raw);
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

/** 棋盘产出物是否可出现指定品类+产品线（订单产线解锁与 BuildingManager 一致） */
export function boardProducerOutputsProductLine(
  def: ToolDef,
  category: Category,
  productLine: string,
): boolean {
  if (!def.canProduce) return false;
  return toolMatchesProductLine(def, category, productLine);
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
