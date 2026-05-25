/**
 * 订单分级配置 — C(初) / B(中) / A(高) / S(特) 四档
 *
 * 每档定义需求槽数、物品等级范围、可用产线。花愿由物品单价 + 多槽加成计算。
 * CustomerManager 按玩家等级 + 已解锁产线随机选「模板档」生成需求；UI 角标与存档中的 tier
 * 由 computeTierFromOrderSlots 按物品在全游产品线中的相对等级统一计算。
 */
import { Category, DrinkLine, FlowerLine, ITEM_DEFS, getMaxLevelForLine } from './ItemConfig';
import type { CustomerDemandDef } from './CustomerConfig';

export type OrderTier = 'C' | 'B' | 'A' | 'S';

export type OrderType = 'normal' | 'timed' | 'chain' | 'challenge';

export interface OrderTierDef {
  tier: OrderTier;
  label: string;
  slotRange: [number, number];
  /** 该档可选的需求池（每个槽位从中随机取一条） */
  demandPool: CustomerDemandDef[];
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
    demandPool: [
      { category: Category.FLOWER, lines: [FlowerLine.FRESH], levelRange: [1, 2] },
      { category: Category.FLOWER, lines: [FlowerLine.FRESH], levelRange: [2, 3] },
    ],
    timeLimit: null,
    orderType: 'normal',
  },
  B: {
    tier: 'B',
    label: '中级',
    slotRange: [2, 2],
    demandPool: [
      { category: Category.FLOWER, lines: [FlowerLine.FRESH, FlowerLine.BOUQUET], levelRange: [2, 5] },
      { category: Category.DRINK, lines: [DrinkLine.BUTTERFLY, DrinkLine.COLD], levelRange: [2, 4] },
    ],
    timeLimit: null,
    orderType: 'normal',
  },
  A: {
    tier: 'A',
    label: '高级',
    slotRange: [2, 3],
    demandPool: [
      { category: Category.FLOWER, lines: [FlowerLine.FRESH, FlowerLine.BOUQUET, FlowerLine.GREEN], levelRange: [4, 7] },
      { category: Category.DRINK, lines: [DrinkLine.BUTTERFLY, DrinkLine.COLD, DrinkLine.DESSERT], levelRange: [3, 6] },
    ],
    timeLimit: null,
    orderType: 'normal',
  },
  S: {
    tier: 'S',
    label: '特级',
    slotRange: [2, 3],
    demandPool: [
      { category: Category.FLOWER, lines: [FlowerLine.BOUQUET, FlowerLine.GREEN], levelRange: [6, 13] },
      { category: Category.DRINK, lines: [DrinkLine.BUTTERFLY, DrinkLine.COLD, DrinkLine.DESSERT], levelRange: [5, 10] },
    ],
    timeLimit: null,
    orderType: 'normal',
  },
};

export interface UnlockedLines {
  hasBouquet: boolean;
  hasGreen: boolean;
  hasDrink: boolean;
  /** 棋盘上最高的园艺工具等级（0=无） */
  maxPlantToolLevel: number;
  /** 棋盘上最高的包装工具等级（0=无） */
  maxArrangeToolLevel: number;
  /** 棋盘上最高的饮品工具等级（捕虫网/冷饮器/烘焙，取三线最大值，0=无） */
  maxDrinkToolLevel: number;
  /**
   * 各饮品线独立最高工具等级（仅该线棋盘上有生产工具时 >0）。
   * 避免仅有蝴蝶网时仍刷冷饮/甜品需求导致无法完成。
   */
  drinkToolMaxByLine: Partial<Record<DrinkLine, number>>;
  /** 已解锁可产出的独立产线数（花束/绿植/蝴蝶标本/冷饮/甜品等），用于动态客人上限 */
  unlockedLineCount: number;
}

/** 棋盘上最高工具等级（取所有线的最大值） */
function _maxToolLevel(lines: UnlockedLines): number {
  return Math.max(lines.maxPlantToolLevel, lines.maxArrangeToolLevel, lines.maxDrinkToolLevel);
}

function _clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function _linePower(toolLevel: number, category: Category, line: string): number {
  const maxItemLevel = Math.max(1, getMaxLevelForLine(category, line));
  return _clamp(getEffectiveMaxLevel(toolLevel, maxItemLevel) / maxItemLevel, 0, 1);
}

/**
 * 当前棋盘工具能力评分（0-1）。
 * 订单只看棋盘 open 格里的可生产工具；仓库工具不计入，避免刷出玩家当前棋盘无法完成的单。
 */
function _toolPower(lines: UnlockedLines): number {
  const powers: number[] = [];
  if (lines.maxPlantToolLevel > 0) {
    powers.push(_linePower(lines.maxPlantToolLevel, Category.FLOWER, FlowerLine.FRESH));
    if (lines.hasGreen) {
      powers.push(_linePower(lines.maxPlantToolLevel, Category.FLOWER, FlowerLine.GREEN));
    }
  }
  if (lines.hasBouquet) {
    powers.push(_linePower(
      Math.max(lines.maxArrangeToolLevel, lines.maxPlantToolLevel),
      Category.FLOWER,
      FlowerLine.BOUQUET,
    ));
  }
  for (const line of [DrinkLine.BUTTERFLY, DrinkLine.COLD, DrinkLine.DESSERT]) {
    const toolLevel = lines.drinkToolMaxByLine[line] ?? 0;
    if (toolLevel > 0) {
      powers.push(_linePower(toolLevel, Category.DRINK, line));
    }
  }
  if (powers.length === 0) return 0;
  return powers.reduce((a, b) => a + b, 0) / powers.length;
}

/** 订单档位权重的会话修正（如解锁新产线后短期偏置） */
export interface OrderTierWeightModifiers {
  /** 解锁绿植后剩余「加成刷次」：提高 A/S 权重，便于尽快见到绿植单 */
  greenLineUnlockBoostSpawns?: number;
}

function _applyGreenBoost(
  w: Record<OrderTier, number>,
  lines: UnlockedLines,
  boostSpawns: number | undefined,
): Record<OrderTier, number> {
  if (!boostSpawns || boostSpawns <= 0 || !lines.hasGreen) return w;
  const out = { ...w };
  // 从 B/C 挪到 A：抬高含绿植池档位，但不抬 S（S 保持稀有）
  const takeB = Math.min(out.B, 12);
  const takeC = Math.min(out.C, 8);
  out.B = out.B - takeB;
  out.C = out.C - takeC;
  const add = takeB + takeC;
  out.A = out.A + add;
  return out;
}

/**
 * 按玩家等级 + 已解锁产线 + 工具等级综合计算各档出现权重。
 * - 玩家等级 1–3：不出现 S，保护新手主循环。
 * - 4 级起少量 S；6 级后按玩家等级、工具能力、解锁产线连续成长。
 * - 不再使用「10 级以后固定权重」，后续升星仍会自然提高高档订单体感。
 */
export function getOrderTierWeights(
  playerLevel: number,
  lines: UnlockedLines,
  modifiers?: OrderTierWeightModifiers,
): Record<OrderTier, number> {
  const maxTool = _maxToolLevel(lines);
  const hasAnyProducer = maxTool >= 3;

  let base: Record<OrderTier, number>;
  if (playerLevel <= 3) {
    if (playerLevel <= 2) {
      if (!hasAnyProducer) base = { C: 100, B: 0, A: 0, S: 0 };
      else if (maxTool >= 4 || lines.hasBouquet || lines.hasDrink) {
        base = { C: 30, B: 60, A: 10, S: 0 };
      } else {
        base = { C: 60, B: 40, A: 0, S: 0 };
      }
    } else {
      // 等级 3：仍无 S
      if (lines.hasBouquet || lines.hasDrink) base = { C: 15, B: 48, A: 37, S: 0 };
      else if (maxTool >= 4) base = { C: 25, B: 48, A: 27, S: 0 };
      else base = { C: 35, B: 50, A: 15, S: 0 };
    }
  } else if (playerLevel === 4) {
    // 首次引入 S，主力仍为 B/A，但让高级订单开始有体感
    if (lines.hasBouquet || lines.hasDrink) base = { C: 15, B: 42, A: 37, S: 6 };
    else if (maxTool >= 4) base = { C: 22, B: 45, A: 27, S: 6 };
    else base = { C: 35, B: 45, A: 14, S: 6 };
  } else {
    const levelScore = _clamp((playerLevel - 4) / 12, 0, 1);
    const toolScore = _toolPower(lines);
    const lineScore = _clamp(lines.unlockedLineCount / 5, 0, 1);
    const highOrderScore = _clamp(0.55 * toolScore + 0.25 * levelScore + 0.2 * lineScore, 0, 1);
    const levelTail = Math.max(0, playerLevel - 6);

    const sWeight = _clamp(
      3 + 20 * highOrderScore + 0.9 * levelTail + (lines.hasGreen ? 1.5 : 0),
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

  return _applyGreenBoost(base, lines, modifiers?.greenLineUnlockBoostSpawns);
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

/**
 * 内容档位：按各槽物品在其产品线中的相对等级（level / 该线 maxLevel）聚合，
 * 再映射到 C/B/A/S。全玩家统一标尺，与生成时使用的「模板档位」独立。
 *
 * - 顺序无关：对 itemId 排序后再算，相同 multiset 必得同档。
 * - 得分 = 0.45 * maxNorm + 0.55 * avgNorm + 多槽加成（2 槽 +0.03，3 槽 +0.06）。
 */
export function computeTierFromOrderSlots(itemIds: readonly string[]): OrderTier {
  const sorted = [...itemIds].filter(Boolean).sort();
  const norms: number[] = [];
  for (const id of sorted) {
    const def = ITEM_DEFS.get(id);
    if (!def) continue;
    const lineMax = Math.max(1, getMaxLevelForLine(def.category, def.line));
    norms.push(Math.min(1, def.level / lineMax));
  }
  if (norms.length === 0) return 'C';

  const maxNorm = Math.max(...norms);
  const avgNorm = norms.reduce((a, b) => a + b, 0) / norms.length;
  const slotBonus = norms.length >= 3 ? 0.06 : norms.length >= 2 ? 0.03 : 0;
  const score = Math.min(1, 0.45 * maxNorm + 0.55 * avgNorm + slotBonus);

  if (score < 0.3) return 'C';
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
