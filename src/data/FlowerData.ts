import { FlowerFamily, FAMILY_NAMES } from '../config/Constants';

export interface FlowerConfig {
  id: string;
  family: FlowerFamily;
  level: number;
  name: string;
  sellPrice: number;
  color: number;  // 占位图颜色
}

// 日常花系花朵名称
const DAILY_NAMES = ['小雏菊', '向日葵', '康乃馨', '百合花束', '花环', '阳光花篮'];
const ROMANTIC_NAMES = ['小蔷薇', '红玫瑰', '薰衣草束', '玫瑰花束', '永生花盒', '梦幻花车'];
const LUXURY_NAMES = ['铃兰', '蓝色妖姬', '绣球花', '鸢尾花束', '水晶花盒', '星辰花冠'];

// 花系占位颜色
const DAILY_COLORS = [0xFFEB3B, 0xFFC107, 0xFF9800, 0xFF8F00, 0xF57F17, 0xE65100];
const ROMANTIC_COLORS = [0xF8BBD0, 0xF06292, 0xE91E63, 0xC2185B, 0xAD1457, 0x880E4F];
const LUXURY_COLORS = [0xBBDEFB, 0x64B5F6, 0x1E88E5, 0x1565C0, 0x0D47A1, 0x1A237E];

function createFlowerConfigs(): Map<string, FlowerConfig> {
  const map = new Map<string, FlowerConfig>();

  const families = [
    { family: FlowerFamily.DAILY, names: DAILY_NAMES, colors: DAILY_COLORS, basePrice: 5 },
    { family: FlowerFamily.ROMANTIC, names: ROMANTIC_NAMES, colors: ROMANTIC_COLORS, basePrice: 8 },
    { family: FlowerFamily.LUXURY, names: LUXURY_NAMES, colors: LUXURY_COLORS, basePrice: 12 },
  ];

  for (const { family, names, colors, basePrice } of families) {
    for (let level = 1; level <= 6; level++) {
      const id = `${family}_${level}`;
      map.set(id, {
        id,
        family,
        level,
        name: names[level - 1],
        sellPrice: basePrice * Math.pow(2, level - 1),
        color: colors[level - 1],
      });
    }
  }

  return map;
}

export const FlowerDataMap = createFlowerConfigs();

export function getFlowerConfig(flowerId: string): FlowerConfig | undefined {
  return FlowerDataMap.get(flowerId);
}

export function getNextLevelId(flowerId: string): string | null {
  const config = FlowerDataMap.get(flowerId);
  if (!config || config.level >= 6) return null;
  return `${config.family}_${config.level + 1}`;
}

export function getFlowerDisplayName(flowerId: string): string {
  const config = FlowerDataMap.get(flowerId);
  if (!config) return flowerId;
  return `${FAMILY_NAMES[config.family]}·${config.name}`;
}

export function getAllFlowerIds(): string[] {
  return Array.from(FlowerDataMap.keys());
}
