/**
 * 客人类型配置 - 13 种客人（前期只启用花系需求，解锁饮品工具后启用组合需求）
 */
import { Category, FlowerLine, DrinkLine } from './ItemConfig';

export interface CustomerDemandDef {
  category: Category;
  lines: string[];
  levelRange: [number, number];
}

export interface CustomerTypeDef {
  id: string;
  name: string;
  emoji: string;
  /** 需求槽位数 [min, max] */
  slotRange: [number, number];
  /** 可产生的需求池（按顺序为各槽位选取，循环使用） */
  demands: CustomerDemandDef[];
  /** 花愿奖励范围（主货币，必给） */
  huayuanReward: [number, number];
  expReward: number;
  /** 花露掉落概率（稀有货币） */
  hualuChance: number;
  /** 是否为可养成熟客 */
  isRegular: boolean;
}

export const CUSTOMER_TYPES: CustomerTypeDef[] = [
  // ---- 花系入门（Phase 0 即可出现） ----
  {
    id: 'child', name: '小朋友', emoji: '🧒',
    slotRange: [2, 2],
    demands: [
      { category: Category.FLOWER, lines: [FlowerLine.FRESH], levelRange: [2, 3] },
      { category: Category.FLOWER, lines: [FlowerLine.FRESH], levelRange: [2, 3] },
    ],
    huayuanReward: [10, 20], expReward: 3,
    hualuChance: 0,
    isRegular: false,
  },
  {
    id: 'student', name: '学生少女', emoji: '👧',
    slotRange: [2, 2],
    demands: [
      { category: Category.FLOWER, lines: [FlowerLine.FRESH], levelRange: [2, 4] },
      { category: Category.FLOWER, lines: [FlowerLine.FRESH], levelRange: [2, 4] },
    ],
    huayuanReward: [15, 30], expReward: 5,
    hualuChance: 0.1,
    isRegular: true,
  },
  {
    id: 'worker', name: '上班族', emoji: '👔',
    slotRange: [2, 2],
    demands: [{ category: Category.FLOWER, lines: [FlowerLine.FRESH, FlowerLine.BOUQUET], levelRange: [3, 5] }],
    huayuanReward: [30, 60], expReward: 8,
    hualuChance: 0.15,
    isRegular: true,
  },
  {
    id: 'mom', name: '温柔妈妈', emoji: '👩',
    slotRange: [2, 2],
    demands: [{ category: Category.FLOWER, lines: [FlowerLine.FRESH, FlowerLine.BOUQUET], levelRange: [3, 5] }],
    huayuanReward: [35, 70], expReward: 10,
    hualuChance: 0.2,
    isRegular: true,
  },

  // ---- 组合订单（需解锁饮品工具后才出现） ----
  {
    id: 'youth', name: '文艺青年', emoji: '🎨',
    slotRange: [2, 2],
    demands: [
      { category: Category.FLOWER, lines: [FlowerLine.FRESH, FlowerLine.BOUQUET], levelRange: [3, 5] },
      { category: Category.DRINK, lines: [DrinkLine.TEA], levelRange: [2, 4] },
    ],
    huayuanReward: [40, 80], expReward: 12,
    hualuChance: 0.2,
    isRegular: true,
  },
  {
    id: 'athlete', name: '运动少年', emoji: '🏃',
    slotRange: [2, 2],
    demands: [
      { category: Category.FLOWER, lines: [FlowerLine.FRESH], levelRange: [2, 4] },
      { category: Category.DRINK, lines: [DrinkLine.COLD], levelRange: [2, 3] },
    ],
    huayuanReward: [24, 48], expReward: 7,
    hualuChance: 0.12,
    isRegular: true,
  },
  {
    id: 'mystery', name: '神秘男子', emoji: '🕶️',
    slotRange: [2, 2],
    demands: [
      { category: Category.FLOWER, lines: [FlowerLine.FRESH, FlowerLine.BOUQUET], levelRange: [4, 5] },
      { category: Category.DRINK, lines: [DrinkLine.TEA], levelRange: [3, 5] },
    ],
    huayuanReward: [50, 90], expReward: 14,
    hualuChance: 0.25,
    isRegular: true,
  },
  {
    id: 'celebrity', name: '大明星', emoji: '⭐',
    slotRange: [2, 2],
    demands: [
      { category: Category.FLOWER, lines: [FlowerLine.FRESH, FlowerLine.BOUQUET, FlowerLine.GREEN], levelRange: [5, 7] },
      { category: Category.DRINK, lines: [DrinkLine.COLD, DrinkLine.DESSERT], levelRange: [3, 6] },
    ],
    huayuanReward: [70, 130], expReward: 20,
    hualuChance: 0.35,
    isRegular: true,
  },
  {
    id: 'couple', name: '情侣', emoji: '💑',
    slotRange: [2, 2],
    demands: [
      { category: Category.FLOWER, lines: [FlowerLine.BOUQUET, FlowerLine.GREEN], levelRange: [4, 6] },
      { category: Category.DRINK, lines: [DrinkLine.COLD], levelRange: [2, 4] },
    ],
    huayuanReward: [50, 100], expReward: 15,
    hualuChance: 0.3,
    isRegular: true,
  },
  {
    id: 'birthday', name: '生日顾客', emoji: '🎂',
    slotRange: [2, 2],
    demands: [
      { category: Category.FLOWER, lines: [FlowerLine.FRESH, FlowerLine.BOUQUET, FlowerLine.GREEN], levelRange: [4, 6] },
      { category: Category.DRINK, lines: [DrinkLine.DESSERT], levelRange: [2, 5] },
    ],
    huayuanReward: [40, 90], expReward: 15,
    hualuChance: 0.3,
    isRegular: false,
  },
  {
    id: 'blogger', name: '网红博主', emoji: '📸',
    slotRange: [2, 2],
    demands: [
      { category: Category.FLOWER, lines: [FlowerLine.FRESH, FlowerLine.BOUQUET, FlowerLine.GREEN], levelRange: [4, 7] },
      { category: Category.DRINK, lines: [DrinkLine.TEA, DrinkLine.COLD, DrinkLine.DESSERT], levelRange: [3, 5] },
    ],
    huayuanReward: [60, 120], expReward: 18,
    hualuChance: 0.3,
    isRegular: true,
  },

  // ---- 高级客人 ----
  {
    id: 'noble', name: '贵妇', emoji: '👸',
    slotRange: [2, 2],
    demands: [
      { category: Category.FLOWER, lines: [FlowerLine.GREEN], levelRange: [5, 8] },
      { category: Category.DRINK, lines: [DrinkLine.DESSERT], levelRange: [3, 6] },
    ],
    huayuanReward: [80, 200], expReward: 25,
    hualuChance: 0.4,
    isRegular: true,
  },
  {
    id: 'collector', name: '收藏家', emoji: '🧐',
    slotRange: [2, 2],
    demands: [
      { category: Category.FLOWER, lines: [FlowerLine.GREEN], levelRange: [7, 10] },
      { category: Category.DRINK, lines: [DrinkLine.COLD, DrinkLine.DESSERT], levelRange: [5, 8] },
    ],
    huayuanReward: [100, 250], expReward: 30,
    hualuChance: 0.5,
    isRegular: true,
  },
];
