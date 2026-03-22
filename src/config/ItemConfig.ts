/**
 * 物品配置
 *
 * 产品线：花系 3线x10级 + 饮品 3线x8级 = 54 种商品
 * 工具线：5条x3级 = 15 种工具（放在棋盘上可产出对应产品线物品）
 * 宝箱：5级
 */

export enum Category {
  FLOWER = 'flower',
  DRINK = 'drink',
  BUILDING = 'building',
  CHEST = 'chest',
}

export enum FlowerLine {
  FRESH = 'fresh',       // 鲜花线
  BOUQUET = 'bouquet',   // 花束线
  GREEN = 'green',       // 绿植线
}

export enum DrinkLine {
  TEA = 'tea',         // 茶饮线
  COLD = 'cold',       // 冷饮线
  DESSERT = 'dessert', // 甜品线
}

export enum ToolLine {
  /** 园艺种植工具 → 同等级随机产出 鲜花线 或 绿植线 */
  PLANT = 'plant',
  ARRANGE = 'arrange',   // 花艺工具 → 花束线
  TEA_SET = 'tea_set',   // 茶具     → 茶饮线
  MIXER = 'mixer',       // 饮品器具 → 冷饮线
  BAKE = 'bake',         // 烘焙工具 → 甜品线
}

/** 工具线 → 对应产品线的映射 */
export const TOOL_TO_PRODUCT_LINE: Record<ToolLine, { category: Category; line: string }> = {
  /** 展示用主标签；实际产出见 BuildingConfig produceLinesRandom */
  [ToolLine.PLANT]:   { category: Category.FLOWER, line: FlowerLine.FRESH },
  [ToolLine.ARRANGE]: { category: Category.FLOWER, line: FlowerLine.BOUQUET },
  [ToolLine.TEA_SET]: { category: Category.DRINK,  line: DrinkLine.TEA },
  [ToolLine.MIXER]:   { category: Category.DRINK,  line: DrinkLine.COLD },
  [ToolLine.BAKE]:    { category: Category.DRINK,  line: DrinkLine.DESSERT },
};

export interface ItemDef {
  id: string;
  name: string;
  category: Category;
  line: string;      // FlowerLine | DrinkLine | ToolLine
  level: number;
  maxLevel: number;
  icon: string;
}

// ═══════════════ 产品数据 ═══════════════

const FLOWER_DATA: [FlowerLine, string[]][] = [
  [FlowerLine.FRESH, [
    '花种子', '花苞', '小雏菊', '向日葵', '康乃馨',
    '玫瑰', '百合', '绣球花', '蝴蝶兰', '金色牡丹',
  ]],
  [FlowerLine.BOUQUET, [
    '一小捧散花', '迷你花束', '郁金香花束', '玫瑰满天星', '田园混搭花束',
    '精美花盒', '红玫瑰大束', '花艺礼篮', '鎏金花束', '传说花束',
  ]],
  [FlowerLine.GREEN, [
    '小芽苗', '多肉盆栽', '绿萝', '波士顿蕨', '虎皮兰',
    '龟背竹', '琴叶榕', '柠檬树', '三角梅', '松树盆景',
  ]],
];

const DRINK_DATA: [DrinkLine, string[]][] = [
  [DrinkLine.TEA, [
    '花草茶包', '茉莉花茶', '玫瑰红茶', '调味花茶',
    '手冲花茶', '四季花茶壶', '大师手作茶', '御品花茶典藏',
  ]],
  [DrinkLine.COLD, [
    '柠檬花水', '花果冰饮', '花漾气泡水', '玫瑰冰沙',
    '花园特调', '花漾奶昔', '星空花饮', '极光花漾特饮',
  ]],
  [DrinkLine.DESSERT, [
    '花瓣饼干', '花形马卡龙', '花朵杯子蛋糕', '花茶慕斯',
    '花瓣蛋糕块', '花饰蛋糕拼盘', '鲜花圆蛋糕', '双层花艺蛋糕',
  ]],
];

// ═══════════════ 工具数据 ═══════════════

const TOOL_DATA: [ToolLine, string[]][] = [
  [ToolLine.PLANT,   ['小花铲', '浇水壶', '小温室']],
  [ToolLine.ARRANGE, ['花剪', '包装纸', '扎花台']],
  [ToolLine.TEA_SET, ['茶杯', '茶壶', '茶道台']],
  [ToolLine.MIXER,   ['量杯', '搅拌杯', '冷饮吧台']],
  [ToolLine.BAKE,    ['擀面杖', '烤箱', '装裱台']],
];

// ═══════════════ 生成物品定义 ═══════════════

function buildItemDefs(): Map<string, ItemDef> {
  const map = new Map<string, ItemDef>();

  // 花系
  for (const [line, names] of FLOWER_DATA) {
    for (let i = 0; i < names.length; i++) {
      const id = `flower_${line}_${i + 1}`;
      map.set(id, {
        id,
        name: names[i],
        category: Category.FLOWER,
        line,
        level: i + 1,
        maxLevel: 10,
        icon: `flower_${line}_${i + 1}`,
      });
    }
  }

  // 饮品
  for (const [line, names] of DRINK_DATA) {
    for (let i = 0; i < names.length; i++) {
      const id = `drink_${line}_${i + 1}`;
      map.set(id, {
        id,
        name: names[i],
        category: Category.DRINK,
        line,
        level: i + 1,
        maxLevel: 8,
        icon: `drink_${line}_${i + 1}`,
      });
    }
  }

  // 工具（BUILDING 品类，可合成升级）
  for (const [line, names] of TOOL_DATA) {
    for (let i = 0; i < names.length; i++) {
      const id = `tool_${line}_${i + 1}`;
      map.set(id, {
        id,
        name: names[i],
        category: Category.BUILDING,
        line,
        level: i + 1,
        maxLevel: 3,
        icon: `tool_${line}_${i + 1}`,
      });
    }
  }

  // 宝箱（5级）
  const chestNames = ['铜宝箱', '银宝箱', '金宝箱', '钻石宝箱', '传说宝箱'];
  for (let i = 0; i < chestNames.length; i++) {
    const id = `chest_${i + 1}`;
    map.set(id, {
      id,
      name: chestNames[i],
      category: Category.CHEST,
      line: 'chest',
      level: i + 1,
      maxLevel: 5,
      icon: `chest_${i + 1}`,
    });
  }

  return map;
}

export const ITEM_DEFS = buildItemDefs();

/** 根据品类+线+等级查找物品ID */
export function findItemId(category: Category, line: string, level: number): string | null {
  for (const [id, def] of ITEM_DEFS) {
    if (def.category === category && def.line === line && def.level === level) return id;
  }
  return null;
}

/** 获取合成后的物品ID（同品类同线，等级+1） */
export function getMergeResultId(itemId: string): string | null {
  const def = ITEM_DEFS.get(itemId);
  if (!def) return null;
  if (def.level >= def.maxLevel) return null;
  return findItemId(def.category, def.line, def.level + 1);
}

/** 获取物品所在的完整合成链（从1级到满级的所有物品ID） */
export function getMergeChain(itemId: string): string[] {
  const def = ITEM_DEFS.get(itemId);
  if (!def) return [];
  const chain: string[] = [];
  for (let lv = 1; lv <= def.maxLevel; lv++) {
    const id = findItemId(def.category, def.line, lv);
    if (id) chain.push(id);
  }
  return chain;
}

/** 获取合成链的显示名称 */
export function getMergeChainName(itemId: string): string {
  const def = ITEM_DEFS.get(itemId);
  if (!def) return '';
  const lineNames: Record<string, string> = {
    [FlowerLine.FRESH]: '鲜花',
    [FlowerLine.BOUQUET]: '花束',
    [FlowerLine.GREEN]: '绿植',
    [DrinkLine.TEA]: '茶饮',
    [DrinkLine.COLD]: '冷饮',
    [DrinkLine.DESSERT]: '甜品',
    [ToolLine.PLANT]: '园艺工具',
    [ToolLine.ARRANGE]: '花艺工具',
    [ToolLine.TEA_SET]: '茶具',
    [ToolLine.MIXER]: '饮品器具',
    [ToolLine.BAKE]: '烘焙工具',
    chest: '宝箱',
  };
  return (lineNames[def.line] || def.line) + '合成线';
}

/** 判断物品是否是工具（BUILDING品类且可合成） */
export function isToolItem(itemId: string): boolean {
  const def = ITEM_DEFS.get(itemId);
  if (!def) return false;
  return def.category === Category.BUILDING;
}

/** 获取工具对应的产品线信息 */
export function getToolProductLine(itemId: string): { category: Category; line: string } | null {
  const def = ITEM_DEFS.get(itemId);
  if (!def || def.category !== Category.BUILDING) return null;
  return TOOL_TO_PRODUCT_LINE[def.line as ToolLine] ?? null;
}
