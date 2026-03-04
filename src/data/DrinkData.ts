import { DrinkLine, DRINK_NAMES } from '../config/Constants';

export interface DrinkConfig {
  id: string;
  line: DrinkLine;
  level: number;
  name: string;
  sellPrice: number;
  color: number;  // 占位图颜色
}

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
    for (let level = 1; level <= 3; level++) {
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
  if (!config || config.level >= 3) return null;
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
