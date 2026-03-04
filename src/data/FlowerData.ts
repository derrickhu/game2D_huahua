import { FlowerFamily, FAMILY_NAMES, ItemCategory } from '../config/Constants';
import {
  registerCategory, registerItemShape, registerCategoryIcon, registerBuildingStyle,
  type ItemInfo,
} from './ItemData';

export interface FlowerConfig {
  id: string;
  family: FlowerFamily;
  level: number;
  name: string;
  sellPrice: number;
  color: number;  // 占位图颜色
}

/** 花束最大等级 */
export const MAX_FLOWER_LEVEL = 6;

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
    for (let level = 1; level <= MAX_FLOWER_LEVEL; level++) {
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
  if (!config || config.level >= MAX_FLOWER_LEVEL) return null;
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

// =============================================
// 注册到 ItemData 注册表
// =============================================
registerCategory({
  category: ItemCategory.FLOWER,
  hasItem: (id) => FlowerDataMap.has(id),
  getItemInfo: (id): ItemInfo | null => {
    const c = FlowerDataMap.get(id);
    if (!c) return null;
    return {
      id: c.id, category: ItemCategory.FLOWER, line: c.family,
      level: c.level, name: c.name, sellPrice: c.sellPrice,
      color: c.color, maxLevel: MAX_FLOWER_LEVEL,
    };
  },
  getNextLevelId,
});

// 注册花束的视觉配置
registerCategoryIcon(ItemCategory.FLOWER, '🌸');

registerItemShape(ItemCategory.FLOWER, (gfx, color, r) => {
  gfx.fillStyle(color, 0.2);
  gfx.fillCircle(0, 0, r + 4);
  gfx.fillStyle(color, 0.9);
  gfx.fillCircle(0, 0, r);
  gfx.fillStyle(0xFFFFFF, 0.3);
  gfx.fillCircle(-r * 0.25, -r * 0.25, r * 0.4);
});

registerBuildingStyle(ItemCategory.FLOWER, {
  bgColor: 0x8D6E63,
  bgAlpha: 0.9,
  drawDecoration: (gfx, s) => {
    // 三角屋顶
    gfx.fillStyle(0xA1887F, 1);
    gfx.fillTriangle(0, -s / 2 - 10, -s / 2, -s / 2 + 8, s / 2, -s / 2 + 8);
  },
});
