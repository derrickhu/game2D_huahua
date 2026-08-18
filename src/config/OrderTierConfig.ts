/**
 * 订单分级配置 — C(初) / B(中) / A(高) / S(特) 四档
 *
 * 每档定义需求槽数；具体产品等级范围见 OrderProductConfig。
 * CustomerManager 按玩家等级 + 已解锁产线随机选「模板档」生成需求；UI 角标与存档中的 tier
 * 由 computeTierFromOrderSlots 按物品难度统一计算。
 */
import { Category, DrinkLine, FoodLine, ITEM_DEFS, isFruitCutLine } from './ItemConfig';

export type OrderTier = 'C' | 'B' | 'A' | 'S';

/** 果切订单角标难度：按整果链顺位 + 果切等级定档，短链偏低、西瓜偏高。 */
const FRUIT_CUT_ORDER_DIFFICULTY: Readonly<Record<string, Readonly<Record<number, number>>>> = {
  [FoodLine.CUT_AVOCADO]: { 1: 0.22, 2: 0.42, 3: 0.45 },
  [FoodLine.CUT_WATERMELON]: { 1: 0.40, 2: 0.72, 3: 0.78 },
  [FoodLine.CUT_PINEAPPLE]: { 1: 0.38, 2: 0.44, 3: 0.46 },
  [FoodLine.CUT_DRAGONFRUIT]: { 1: 0.35, 2: 0.55, 3: 0.62 },
  [FoodLine.CUT_ORANGE]: { 1: 0.80, 2: 0.88, 3: 0.92 },
};

export type OrderType = 'normal' | 'timed' | 'chain' | 'challenge';

export interface OrderTierDef {
  tier: OrderTier;
  label: string;
  slotRange: [number, number];
  /** 预留：限时秒数，null = 不限时 */
  timeLimit: number | null;
  /** 预留：订单子类型 */
  orderType: OrderType;
}

export const ORDER_TIERS: Record<OrderTier, OrderTierDef> = {
  C: {
    tier: 'C',
    label: '初级',
    slotRange: [1, 2],
    timeLimit: null,
    orderType: 'normal',
  },
  B: {
    tier: 'B',
    label: '中级',
    slotRange: [2, 2],
    timeLimit: null,
    orderType: 'normal',
  },
  A: {
    tier: 'A',
    label: '高级',
    slotRange: [2, 3],
    timeLimit: null,
    orderType: 'normal',
  },
  S: {
    tier: 'S',
    label: '特级',
    slotRange: [2, 3],
    timeLimit: null,
    orderType: 'normal',
  },
};

export interface UnlockedLines {
  hasBouquet: boolean;
  hasGreen: boolean;
  hasDrink: boolean;
  hasFood: boolean;
  /** 棋盘上最高的园艺工具等级（0=无） */
  maxPlantToolLevel: number;
  /** 棋盘上最高的包装工具等级（0=无） */
  maxArrangeToolLevel: number;
  /** 棋盘上最高的饮品工具等级（捕虫网/冷饮器/烘焙，取三线最大值，0=无） */
  maxDrinkToolLevel: number;
  /** 棋盘上最高的农田工具等级（0=无） */
  maxFarmToolLevel: number;
  /** 棋盘上最高的果切工具等级（0=无） */
  maxFruitCutToolLevel: number;
  /**
   * 各饮品线独立最高工具等级（仅该线棋盘上有生产工具时 >0）。
   * 避免仅有蝴蝶网时仍刷冷饮/甜品需求导致无法完成。
   */
  drinkToolMaxByLine: Partial<Record<DrinkLine, number>>;
  /** 各果切线最高加工工具等级（仅农田+果切工具均在棋盘上时 >0）。 */
  foodToolMaxByLine: Partial<Record<FoodLine, number>>;
  /** 已解锁可产出的独立产线数（花束/绿植/各饮品线/果切整线等；果切品种再多也只计 1），用于组合单与线数评分 */
  unlockedLineCount: number;
}

/** 棋盘上最高工具等级（取所有线的最大值） */
function _maxToolLevel(lines: UnlockedLines): number {
  return Math.max(
    lines.maxPlantToolLevel,
    lines.maxArrangeToolLevel,
    lines.maxDrinkToolLevel,
    lines.maxFarmToolLevel,
    lines.maxFruitCutToolLevel,
  );
}

function _clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** 订单难度统一按最长主链 13 级归一，避免短链产品线天然更容易成为 S。 */
export const ORDER_DIFFICULTY_REFERENCE_LEVEL = 13;

export function computeOrderLevelDifficulty(level: number): number {
  if (!Number.isFinite(level) || level <= 0) return 0;
  return _clamp(Math.floor(level) / ORDER_DIFFICULTY_REFERENCE_LEVEL, 0, 1);
}

function _linePower(toolLevel: number): number {
  return computeOrderLevelDifficulty(getEffectiveMaxLevel(toolLevel, ORDER_DIFFICULTY_REFERENCE_LEVEL));
}

/**
 * 当前棋盘工具能力评分（0-1）。
 * 订单只看棋盘 open 格里的可生产工具；仓库工具不计入，避免刷出玩家当前棋盘无法完成的单。
 */
function _toolPower(lines: UnlockedLines): number {
  const powers: number[] = [];
  if (lines.maxPlantToolLevel > 0) {
    powers.push(_linePower(lines.maxPlantToolLevel));
    if (lines.hasGreen) {
      powers.push(_linePower(lines.maxPlantToolLevel));
    }
  }
  if (lines.hasBouquet && lines.maxArrangeToolLevel > 0) {
    powers.push(_linePower(lines.maxArrangeToolLevel));
  }
  for (const line of [DrinkLine.BUTTERFLY, DrinkLine.COLD, DrinkLine.DESSERT]) {
    const toolLevel = lines.drinkToolMaxByLine[line] ?? 0;
    if (toolLevel > 0) {
      powers.push(_linePower(toolLevel));
    }
  }
  // 果切整条产线只计一次（与 unlockedLineCount 一致），不按 5 个果切品种重复加权
  if (lines.hasFood && lines.maxFruitCutToolLevel > 0) {
    powers.push(_linePower(lines.maxFruitCutToolLevel));
  }
  if (powers.length === 0) return 0;
  return powers.reduce((a, b) => a + b, 0) / powers.length;
}

/**
 * 按玩家等级 + 已解锁产线 + 工具等级综合计算各档出现权重。
 * - 1 级：偏 C/B，角标最高 B；2 级：约 10% A 模板；3 级：A 略降、仍无 S。
 * - 4 级：首次引入 S，A/S 略降（幅度小于 3 级）；5 级起正常成长曲线。
 * - 不再使用「10 级以后固定权重」，后续升星仍会自然提高高档订单体感。
 */
export function getOrderTierWeights(
  playerLevel: number,
  lines: UnlockedLines,
): Record<OrderTier, number> {
  const maxTool = _maxToolLevel(lines);
  const hasAnyProducer = maxTool >= 1;

  let base: Record<OrderTier, number>;
  if (playerLevel <= 3) {
    if (playerLevel === 1) {
      if (!hasAnyProducer) base = { C: 100, B: 0, A: 0, S: 0 };
      else if (maxTool >= 3 || lines.hasBouquet || lines.hasDrink) {
        base = { C: 62, B: 38, A: 0, S: 0 };
      } else if (maxTool >= 2) {
        base = { C: 58, B: 42, A: 0, S: 0 };
      } else {
        base = { C: 65, B: 35, A: 0, S: 0 };
      }
    } else if (playerLevel === 2) {
      if (!hasAnyProducer) base = { C: 100, B: 0, A: 0, S: 0 };
      else if (maxTool >= 3 || lines.hasBouquet || lines.hasDrink) {
        base = { C: 52, B: 38, A: 10, S: 0 };
      } else if (maxTool >= 2) {
        base = { C: 55, B: 35, A: 10, S: 0 };
      } else {
        base = { C: 60, B: 30, A: 10, S: 0 };
      }
    } else {
      // 等级 3：仍无 S；A 模板略低于 4 级前过渡档
      if (lines.hasBouquet || lines.hasDrink) base = { C: 22, B: 48, A: 30, S: 0 };
      else if (maxTool >= 4) base = { C: 30, B: 48, A: 22, S: 0 };
      else base = { C: 42, B: 48, A: 10, S: 0 };
    }
  } else if (playerLevel === 4) {
    // 首次引入 S；A/S 略降，幅度小于 3 级
    if (lines.hasBouquet || lines.hasDrink) base = { C: 18, B: 42, A: 34, S: 4 };
    else if (maxTool >= 4) base = { C: 25, B: 45, A: 24, S: 4 };
    else base = { C: 37, B: 45, A: 12, S: 5 };
  } else {
    const levelScore = _clamp((playerLevel - 4) / 12, 0, 1);
    const toolScore = _toolPower(lines);
    const lineScore = _clamp(lines.unlockedLineCount / 5, 0, 1);
    const highOrderScore = _clamp(0.55 * toolScore + 0.25 * levelScore + 0.2 * lineScore, 0, 1);
    const levelTail = Math.max(0, playerLevel - 6);

    const sWeight = _clamp(
      3 + 20 * highOrderScore + 0.9 * levelTail,
      5,
      30,
    );
    const aWeight = _clamp(30 + 30 * highOrderScore + 0.8 * levelTail, 34, 64);
    const bWeight = _clamp(44 - 28 * highOrderScore - 0.6 * levelTail, 10, 36);
    const cWeight = _clamp(18 - 16 * highOrderScore - 0.6 * levelTail, 1, 14);

    base = {
      C: Math.round(cWeight),
      B: Math.round(bWeight),
      A: Math.round(aWeight),
      S: Math.round(sWeight),
    };
  }

  return base;
}

/** 按权重随机选一个档位 */
export function pickTierByWeight(weights: Record<OrderTier, number>): OrderTier {
  const entries = (Object.entries(weights) as [OrderTier, number][]).filter(([, w]) => w > 0);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  if (total <= 0) return 'C';
  let r = Math.random() * total;
  for (const [tier, w] of entries) {
    r -= w;
    if (r <= 0) return tier;
  }
  return entries[entries.length - 1][0];
}

/** 订单档位在 UI 上的颜色（角标/边框） */
export const TIER_COLORS: Record<OrderTier, number> = {
  C: 0x78b87a,
  B: 0x5c9edf,
  A: 0xd4a040,
  S: 0xc55a8a,
};

function _smoothstep(edge0: number, edge1: number, x: number): number {
  const t = _clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * 订单内容物品难度：以 13 级主链作绝对标尺，并对各产线后段做小幅补偿。
 * 这样花束 / 短饮品线的末段不会被低估，但中前段也不会像旧版按 maxLevel 归一那样过早变 S。
 */
export function computeOrderItemDifficulty(def: {
  level: number;
  maxLevel: number;
  category?: Category;
  line?: string;
}): number {
  if (def.category === Category.FOOD && def.line && isFruitCutLine(def.line)) {
    return FRUIT_CUT_ORDER_DIFFICULTY[def.line]?.[def.level] ?? 0.4;
  }
  const absolute = computeOrderLevelDifficulty(def.level);
  if (!Number.isFinite(def.maxLevel) || def.maxLevel <= 1) return absolute;
  const relative = _clamp(Math.floor(def.level) / def.maxLevel, 0, 1);
  const lateLineBonus = 0.14 * _smoothstep(0.65, 1, relative);
  return _clamp(absolute + lateLineBonus, 0, 1);
}

/**
 * 按槽位物品难度算内容档位（UI 角标 / 花愿倍率）。
 * @param playerLevel 传入时：1 级角标最高 B；2 级更易出现金色 A、仍无 S。
 */
export function computeTierFromOrderSlots(
  itemIds: readonly string[],
  playerLevel?: number,
): OrderTier {
  const sorted = [...itemIds].filter(Boolean).sort();
  const norms: number[] = [];
  for (const id of sorted) {
    const def = ITEM_DEFS.get(id);
    if (!def) continue;
    norms.push(computeOrderItemDifficulty(def));
  }
  if (norms.length === 0) return 'C';

  const maxNorm = Math.max(...norms);
  const avgNorm = norms.reduce((a, b) => a + b, 0) / norms.length;
  const slotBonus = norms.length >= 3 ? 0.06 : norms.length >= 2 ? 0.03 : 0;
  const score = Math.min(1, 0.45 * maxNorm + 0.55 * avgNorm + slotBonus);

  const lv1 = playerLevel === 1;
  const lv2 = playerLevel === 2;

  if (score < 0.3) return 'C';
  if (lv1) {
    if (score < 0.58) return 'B';
    return 'B';
  }
  if (lv2) {
    if (score < 0.50) return 'B';
    if (score < 0.72) return 'A';
    return 'A';
  }
  if (score < 0.48) return 'B';
  if (score < 0.68) return 'A';
  return 'S';
}

/**
 * 根据工具等级推算订单可要求的物品等级上限。
 * 游戏核心是合成——工具产出低级品，玩家多次合成即可达到高级品，因此不以工具直产等级为上限。
 * 公式: min(toolLevel * 2 − 1, maxItemLevel)；7 级园艺工具时封顶 13，与鲜花/绿植满级对齐
 */
export function getEffectiveMaxLevel(toolLevel: number, maxItemLevel: number): number {
  if (toolLevel <= 0) return 0;
  return Math.min(toolLevel * 2 - 1, maxItemLevel);
}

/**
 * 订单区同时接待 / 锁格 / 可交付人数上限：依玩家星级（全局等级 `CurrencyManager.state.level`）。
 * 1–5 级：4 人；6–10 级：5 人；11 级及以上：6 人。
 */
export function getDynamicMaxCustomers(playerLevel: number): number {
  const lv = Math.max(1, Math.floor(playerLevel));
  if (lv <= 5) return 4;
  if (lv <= 10) return 5;
  return 6;
}
