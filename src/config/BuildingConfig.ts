/**
 * 工具/建筑配置
 *
 * 5条工具链 x 3级 = 15种工具
 * 多数工具只产出一条产品线；种植线（plant）在同等级下随机产出鲜花或绿植
 * 工具放在棋盘上可点击产出，合成两个同级工具升级为下一级
 */

import { Category, FlowerLine, DrinkLine, ToolLine } from './ItemConfig';

export interface ToolDef {
  /** 物品ID（对应 ItemConfig 中的 tool_xxx_N） */
  itemId: string;
  /** 工具线 */
  toolLine: ToolLine;
  /** 工具等级 1-3 */
  level: number;
  /** 产出的品类 */
  produceCategory: Category;
  /** 产出的产品线（单线工具使用） */
  produceLine: string;
  /**
   * 若存在：先按 produceTable 掷等级，再从中 **均匀随机** 选一条产品线产出同等级物品
   * （与 produceLine 同时存在时，产出逻辑以本字段为准）
   */
  produceLinesRandom?: string[];
  /** 产出等级概率表 [[level, weight], ...] */
  produceTable: [number, number][];
  /** CD时间（秒），0 表示无CD */
  cooldown: number;
  /** 消耗体力 */
  staminaCost: number;
}

// ═══════════════ 花系工具（产品10级） ═══════════════

const flowerToolTemplate = (toolLine: ToolLine, produceLine: FlowerLine): Omit<ToolDef, 'itemId' | 'level'>[] => [
  {
    toolLine, produceCategory: Category.FLOWER, produceLine,
    produceTable: [[1, 70], [2, 25], [3, 5]],
    cooldown: 0, staminaCost: 3,
  },
  {
    toolLine, produceCategory: Category.FLOWER, produceLine,
    produceTable: [[2, 20], [3, 30], [4, 25], [5, 15], [6, 10]],
    cooldown: 120, staminaCost: 5,
  },
  {
    toolLine, produceCategory: Category.FLOWER, produceLine,
    produceTable: [[4, 10], [5, 20], [6, 25], [7, 20], [8, 15], [9, 7], [10, 3]],
    cooldown: 300, staminaCost: 8,
  },
];

/** 种植线：同等级随机产出 鲜花(fresh) 或 绿植(green) */
const plantDualFlowerTemplate = (): Omit<ToolDef, 'itemId' | 'level'>[] => {
  const dual = [FlowerLine.FRESH, FlowerLine.GREEN];
  return flowerToolTemplate(ToolLine.PLANT, FlowerLine.FRESH).map(t => ({
    ...t,
    produceLinesRandom: dual,
  }));
};

// ═══════════════ 饮品工具（产品8级） ═══════════════

const drinkToolTemplate = (toolLine: ToolLine, produceLine: DrinkLine): Omit<ToolDef, 'itemId' | 'level'>[] => [
  {
    toolLine, produceCategory: Category.DRINK, produceLine,
    produceTable: [[1, 70], [2, 25], [3, 5]],
    cooldown: 0, staminaCost: 3,
  },
  {
    toolLine, produceCategory: Category.DRINK, produceLine,
    produceTable: [[2, 25], [3, 30], [4, 25], [5, 20]],
    cooldown: 120, staminaCost: 5,
  },
  {
    toolLine, produceCategory: Category.DRINK, produceLine,
    produceTable: [[4, 15], [5, 25], [6, 25], [7, 20], [8, 15]],
    cooldown: 300, staminaCost: 8,
  },
];

// ═══════════════ 构建完整工具定义表 ═══════════════

function buildToolDefs(): Map<string, ToolDef> {
  const map = new Map<string, ToolDef>();

  const allTemplates: Omit<ToolDef, 'itemId' | 'level'>[][] = [
    plantDualFlowerTemplate(),
    flowerToolTemplate(ToolLine.ARRANGE, FlowerLine.BOUQUET),
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

/** 根据物品ID查找工具定义 */
export function findToolDef(itemId: string): ToolDef | undefined {
  return TOOL_DEFS.get(itemId);
}
