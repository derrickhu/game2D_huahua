import { ItemCategory, FlowerFamily, DrinkLine } from '../config/Constants';

export interface OutputEntry {
  levelRange: [number, number];  // [min, max]
  weight: number;                // 权重
}

export interface BuildingConfig {
  id: string;
  name: string;
  category: ItemCategory;            // 花束建筑 or 饮品建筑
  unlockPrice: number;               // 金币解锁价格
  unlockOrder: number;               // 解锁顺序（1~15）
  selectableLines: string[];         // 可选产出线（FlowerFamily[] 或 DrinkLine[]）
  outputTable: OutputEntry[];        // 产出概率表
}

// =============================================
// 花束建筑（4种）
// =============================================
const FlowerBuildings: BuildingConfig[] = [
  {
    id: 'workbench',
    name: '花艺操作台',
    category: ItemCategory.FLOWER,
    unlockPrice: 50,
    unlockOrder: 2,
    selectableLines: [FlowerFamily.DAILY],
    outputTable: [
      { levelRange: [1, 1], weight: 70 },
      { levelRange: [2, 2], weight: 25 },
      { levelRange: [3, 3], weight: 5 },
    ],
  },
  {
    id: 'wrapper',
    name: '包装台',
    category: ItemCategory.FLOWER,
    unlockPrice: 300,
    unlockOrder: 6,
    selectableLines: [FlowerFamily.DAILY, FlowerFamily.ROMANTIC],
    outputTable: [
      { levelRange: [1, 2], weight: 60 },
      { levelRange: [3, 4], weight: 30 },
      { levelRange: [5, 5], weight: 10 },
    ],
  },
  {
    id: 'greenhouse',
    name: '小型温室',
    category: ItemCategory.FLOWER,
    unlockPrice: 800,
    unlockOrder: 10,
    selectableLines: [FlowerFamily.ROMANTIC, FlowerFamily.LUXURY],
    outputTable: [
      { levelRange: [1, 2], weight: 55 },
      { levelRange: [3, 4], weight: 35 },
      { levelRange: [5, 5], weight: 10 },
    ],
  },
  {
    id: 'starhouse',
    name: '星光花房',
    category: ItemCategory.FLOWER,
    unlockPrice: 2000,
    unlockOrder: 14,
    selectableLines: [FlowerFamily.DAILY, FlowerFamily.ROMANTIC, FlowerFamily.LUXURY],
    outputTable: [
      { levelRange: [3, 4], weight: 40 },
      { levelRange: [5, 5], weight: 40 },
      { levelRange: [6, 6], weight: 20 },
    ],
  },
];

// =============================================
// 饮品建筑（3种）
// =============================================
const DrinkBuildings: BuildingConfig[] = [
  {
    id: 'tea_stand',
    name: '简易茶台',
    category: ItemCategory.DRINK,
    unlockPrice: 150,
    unlockOrder: 5,
    selectableLines: [DrinkLine.TEA],
    outputTable: [
      { levelRange: [1, 1], weight: 70 },
      { levelRange: [2, 2], weight: 25 },
      { levelRange: [3, 3], weight: 5 },
    ],
  },
  {
    id: 'drink_bar',
    name: '调饮吧台',
    category: ItemCategory.DRINK,
    unlockPrice: 500,
    unlockOrder: 9,
    selectableLines: [DrinkLine.TEA, DrinkLine.COLD],
    outputTable: [
      { levelRange: [1, 1], weight: 55 },
      { levelRange: [2, 2], weight: 35 },
      { levelRange: [3, 3], weight: 10 },
    ],
  },
  {
    id: 'drink_workshop',
    name: '花饮工坊',
    category: ItemCategory.DRINK,
    unlockPrice: 1500,
    unlockOrder: 12,
    selectableLines: [DrinkLine.TEA, DrinkLine.COLD, DrinkLine.DESSERT],
    outputTable: [
      { levelRange: [1, 1], weight: 40 },
      { levelRange: [2, 2], weight: 35 },
      { levelRange: [3, 3], weight: 25 },
    ],
  },
];

export const BuildingConfigs: BuildingConfig[] = [...FlowerBuildings, ...DrinkBuildings];

export function getBuildingConfig(buildingId: string): BuildingConfig | undefined {
  return BuildingConfigs.find(b => b.id === buildingId);
}

export function getNextUnlockableBuilding(unlockedIds: string[]): BuildingConfig | undefined {
  return BuildingConfigs
    .filter(b => !unlockedIds.includes(b.id))
    .sort((a, b) => a.unlockOrder - b.unlockOrder)[0];
}

/** 根据概率表随机产出等级 */
export function rollOutputLevel(table: OutputEntry[]): number {
  const totalWeight = table.reduce((sum, e) => sum + e.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const entry of table) {
    roll -= entry.weight;
    if (roll <= 0) {
      const [min, max] = entry.levelRange;
      return min === max ? min : min + Math.floor(Math.random() * (max - min + 1));
    }
  }
  return table[0].levelRange[0];
}
