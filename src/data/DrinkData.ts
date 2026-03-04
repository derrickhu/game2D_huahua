import { DrinkLine, DRINK_NAMES, ItemCategory } from '../config/Constants';
import {
  registerCategory, registerItemShape, registerCategoryIcon, registerBuildingStyle,
  type ItemInfo,
} from './ItemData';

export interface DrinkConfig {
  id: string;
  line: DrinkLine;
  level: number;
  name: string;
  sellPrice: number;
  color: number;  // 占位图颜色
}

/** 花饮最大等级 */
export const MAX_DRINK_LEVEL = 3;

const TEA_NAMES = ['花草茶', '调味花茶', '限定手作茶'];
const COLD_NAMES = ['花果冰饮', '花漾气泡水', '梦幻花饮'];
const DESSERT_NAMES = ['花瓣饼干', '花艺蛋糕', '花宴甜品台'];

const TEA_COLORS = [0xD7CCC8, 0xA1887F, 0x6D4C41];
const COLD_COLORS = [0xB3E5FC, 0x4FC3F7, 0x0288D1];
const DESSERT_COLORS = [0xFFCCBC, 0xFF8A65, 0xE64A19];

function createDrinkConfigs(): Map<string, DrinkConfig> {
  const map = new Map<string, DrinkConfig>();

  const lines = [
    { line: DrinkLine.TEA, names: TEA_NAMES, colors: TEA_COLORS, basePrice: 4 },
    { line: DrinkLine.COLD, names: COLD_NAMES, colors: COLD_COLORS, basePrice: 6 },
    { line: DrinkLine.DESSERT, names: DESSERT_NAMES, colors: DESSERT_COLORS, basePrice: 10 },
  ];

  for (const { line, names, colors, basePrice } of lines) {
    for (let level = 1; level <= MAX_DRINK_LEVEL; level++) {
      const id = `${line}_${level}`;
      map.set(id, {
        id,
        line,
        level,
        name: names[level - 1],
        sellPrice: basePrice * Math.pow(2, level - 1),
        color: colors[level - 1],
      });
    }
  }

  return map;
}

export const DrinkDataMap = createDrinkConfigs();

export function getDrinkConfig(drinkId: string): DrinkConfig | undefined {
  return DrinkDataMap.get(drinkId);
}

export function getDrinkNextLevelId(drinkId: string): string | null {
  const config = DrinkDataMap.get(drinkId);
  if (!config || config.level >= MAX_DRINK_LEVEL) return null;
  return `${config.line}_${config.level + 1}`;
}

export function getDrinkDisplayName(drinkId: string): string {
  const config = DrinkDataMap.get(drinkId);
  if (!config) return drinkId;
  return `${DRINK_NAMES[config.line]}·${config.name}`;
}

export function getAllDrinkIds(): string[] {
  return Array.from(DrinkDataMap.keys());
}

// =============================================
// 注册到 ItemData 注册表
// =============================================
registerCategory({
  category: ItemCategory.DRINK,
  hasItem: (id) => DrinkDataMap.has(id),
  getItemInfo: (id): ItemInfo | null => {
    const c = DrinkDataMap.get(id);
    if (!c) return null;
    return {
      id: c.id, category: ItemCategory.DRINK, line: c.line,
      level: c.level, name: c.name, sellPrice: c.sellPrice,
      color: c.color, maxLevel: MAX_DRINK_LEVEL,
    };
  },
  getNextLevelId: getDrinkNextLevelId,
});

// 注册花饮的视觉配置
registerCategoryIcon(ItemCategory.DRINK, '☕');

registerItemShape(ItemCategory.DRINK, (gfx, color, r) => {
  // 圆角方形（杯子造型区分）
  gfx.fillStyle(color, 0.2);
  gfx.fillRoundedRect(-r - 2, -r - 2, (r + 2) * 2, (r + 2) * 2, 10);
  gfx.fillStyle(color, 0.9);
  gfx.fillRoundedRect(-r, -r, r * 2, r * 2, 8);
  gfx.fillStyle(0xFFFFFF, 0.3);
  gfx.fillRoundedRect(-r + 4, -r + 4, r * 0.8, r * 0.6, 4);
});

registerBuildingStyle(ItemCategory.DRINK, {
  bgColor: 0x5C6BC0,
  bgAlpha: 0.9,
  drawDecoration: (gfx, s) => {
    // 杯子形状装饰
    gfx.fillStyle(0x7986CB, 1);
    gfx.fillRoundedRect(-s / 4, -s / 2 + 6, s / 2, s - 12, 6);
  },
});
