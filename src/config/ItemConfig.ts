/**
 * 物品配置 - 花束 18 + 花饮 9 = 27 种商品
 */

export enum Category {
  FLOWER = 'flower',
  DRINK = 'drink',
  BUILDING_MAT = 'building_mat', // 建筑材料
  BUILDING = 'building',         // 建筑（放置在棋盘上的功能建筑）
  CHEST = 'chest',               // 宝箱
}

export enum FlowerLine {
  DAILY = 'daily',       // 日常花系
  ROMANTIC = 'romantic', // 浪漫花系
  LUXURY = 'luxury',     // 奢华花系
}

export enum DrinkLine {
  TEA = 'tea',         // 茶饮线
  COLD = 'cold',       // 冷饮线
  DESSERT = 'dessert', // 甜品线
}

export enum BuildingMatLine {
  FLOWER_BUILD = 'flower_build', // 花束建筑材料
  DRINK_BUILD = 'drink_build',   // 饮品建筑材料
}

export interface ItemDef {
  id: string;
  name: string;
  category: Category;
  line: string;      // FlowerLine | DrinkLine | BuildingMatLine
  level: number;     // 1~6（花束）、1~3（花饮）、1~4（花束建筑材料）、1~3（饮品建筑材料）
  maxLevel: number;
  icon: string;      // 图标资源key
}

// 花束数据：3花系 × 6级
const FLOWER_DATA: [FlowerLine, string[]][] = [
  [FlowerLine.DAILY, ['小雏菊', '向日葵', '康乃馨', '满天星花束', '混搭花束', '精致礼盒花']],
  [FlowerLine.ROMANTIC, ['粉玫瑰', '百合', '郁金香', '薰衣草花束', '告白玫瑰礼盒', '婚礼花艺']],
  [FlowerLine.LUXURY, ['星空兰', '生日花礼', '星空花礼', '鎏金花束', '极光花礼', '永恒花海典藏']],
];

// 花饮数据：3饮品线 × 3级
const DRINK_DATA: [DrinkLine, string[]][] = [
  [DrinkLine.TEA, ['花草茶', '调味花茶', '限定手作茶']],
  [DrinkLine.COLD, ['花果冰饮', '花漾气泡水', '梦幻花饮']],
  [DrinkLine.DESSERT, ['花瓣饼干', '花艺蛋糕', '花宴甜品台']],
];

// 建筑材料：花束建筑线4级、饮品建筑线3级
const BUILDING_MAT_DATA: [BuildingMatLine, string[], number][] = [
  [BuildingMatLine.FLOWER_BUILD, ['花束蓝图碎片', '花艺工具箱', '花架组件', '花房设计图'], 4],
  [BuildingMatLine.DRINK_BUILD, ['饮品蓝图碎片', '调饮器具箱', '吧台设计图'], 3],
];

// 生成所有物品定义
function buildItemDefs(): Map<string, ItemDef> {
  const map = new Map<string, ItemDef>();

  // 花束
  for (const [line, names] of FLOWER_DATA) {
    for (let i = 0; i < names.length; i++) {
      const id = `flower_${line}_${i + 1}`;
      map.set(id, {
        id,
        name: names[i],
        category: Category.FLOWER,
        line,
        level: i + 1,
        maxLevel: 6,
        icon: `flower_${line}_${i + 1}`,
      });
    }
  }

  // 花饮
  for (const [line, names] of DRINK_DATA) {
    for (let i = 0; i < names.length; i++) {
      const id = `drink_${line}_${i + 1}`;
      map.set(id, {
        id,
        name: names[i],
        category: Category.DRINK,
        line,
        level: i + 1,
        maxLevel: 3,
        icon: `drink_${line}_${i + 1}`,
      });
    }
  }

  // 建筑材料
  for (const [line, names, maxLv] of BUILDING_MAT_DATA) {
    for (let i = 0; i < names.length; i++) {
      const id = `bmat_${line}_${i + 1}`;
      map.set(id, {
        id,
        name: names[i],
        category: Category.BUILDING_MAT,
        line,
        level: i + 1,
        maxLevel: maxLv,
        icon: `bmat_${line}_${i + 1}`,
      });
    }
  }

  // 宝箱（3级）
  const chestNames = ['铜宝箱', '银宝箱', '金宝箱'];
  for (let i = 0; i < chestNames.length; i++) {
    const id = `chest_${i + 1}`;
    map.set(id, {
      id,
      name: chestNames[i],
      category: Category.CHEST,
      line: 'chest',
      level: i + 1,
      maxLevel: 3,
      icon: `chest_${i + 1}`,
    });
  }

  // 永久型建筑（棋盘上的功能物品）
  const permBuildings = [
    '花艺操作台', '包装台', '小型温室', '星光花房',
    '简易茶台', '调饮吧台', '花饮工坊',
  ];
  for (let i = 0; i < permBuildings.length; i++) {
    const id = `building_perm_${i + 1}`;
    map.set(id, {
      id,
      name: permBuildings[i],
      category: Category.BUILDING,
      line: i < 4 ? 'flower_build' : 'drink_build',
      level: 1,
      maxLevel: 1,
      icon: `building_perm_${i + 1}`,
    });
  }

  // 消耗型建筑
  const consBuildings = [
    '花材礼盒', '精选花篮', '花艺大师箱',
    '茶包盒', '调饮套装', '花饮臻选箱',
  ];
  for (let i = 0; i < consBuildings.length; i++) {
    const id = `building_cons_${i + 1}`;
    map.set(id, {
      id,
      name: consBuildings[i],
      category: Category.BUILDING,
      line: i < 3 ? 'flower_build' : 'drink_build',
      level: 1,
      maxLevel: 1,
      icon: `building_cons_${i + 1}`,
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
