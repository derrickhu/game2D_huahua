import { ItemCategory, FlowerFamily, DrinkLine } from '../config/Constants';

/**
 * 单个需求槽位：可以是花束类或花饮类
 */
export interface DemandSlot {
  category: ItemCategory;
  line: string;         // FlowerFamily 或 DrinkLine
  minLevel: number;
  maxLevel: number;     // 只要 >= minLevel 就行（用于灵活需求）
}

/**
 * 客人的一种可能的订单配置（含多个需求槽位）
 */
export interface OrderTemplate {
  demands: DemandSlot[];
  goldReward: number;
  wishReward: number;
  dewReward: number;
}

export interface CustomerConfig {
  id: string;
  name: string;
  color: number;
  isRegular: boolean;     // 是否为可养成熟客
  possibleOrders: OrderTemplate[];
}

// =============================================
// 16 种客人配置
// =============================================
export const CustomerConfigs: CustomerConfig[] = [
  // --- 新手入门（1个需求）---
  {
    id: 'student_girl',
    name: '学生少女',
    color: 0xFF9999,
    isRegular: true,
    possibleOrders: [
      {
        demands: [{ category: ItemCategory.FLOWER, line: FlowerFamily.DAILY, minLevel: 1, maxLevel: 2 }],
        goldReward: 10, wishReward: 2, dewReward: 0,
      },
      {
        demands: [{ category: ItemCategory.FLOWER, line: FlowerFamily.DAILY, minLevel: 2, maxLevel: 3 }],
        goldReward: 20, wishReward: 3, dewReward: 1,
      },
    ],
  },
  {
    id: 'child',
    name: '小朋友',
    color: 0xFFCC80,
    isRegular: false,
    possibleOrders: [
      {
        demands: [{ category: ItemCategory.DRINK, line: DrinkLine.TEA, minLevel: 1, maxLevel: 1 }],
        goldReward: 8, wishReward: 1, dewReward: 0,
      },
      {
        demands: [{ category: ItemCategory.DRINK, line: DrinkLine.DESSERT, minLevel: 1, maxLevel: 1 }],
        goldReward: 10, wishReward: 2, dewReward: 0,
      },
    ],
  },

  // --- 简单组合（1~2个需求）---
  {
    id: 'office_worker',
    name: '上班族',
    color: 0x90CAF9,
    isRegular: true,
    possibleOrders: [
      {
        demands: [{ category: ItemCategory.FLOWER, line: FlowerFamily.DAILY, minLevel: 2, maxLevel: 3 }],
        goldReward: 15, wishReward: 2, dewReward: 1,
      },
      {
        demands: [
          { category: ItemCategory.FLOWER, line: FlowerFamily.DAILY, minLevel: 2, maxLevel: 3 },
          { category: ItemCategory.DRINK, line: DrinkLine.TEA, minLevel: 1, maxLevel: 2 },
        ],
        goldReward: 30, wishReward: 5, dewReward: 2,
      },
    ],
  },
  {
    id: 'gentle_mom',
    name: '温柔妈妈',
    color: 0xCE93D8,
    isRegular: true,
    possibleOrders: [
      {
        demands: [{ category: ItemCategory.FLOWER, line: FlowerFamily.ROMANTIC, minLevel: 1, maxLevel: 2 }],
        goldReward: 12, wishReward: 2, dewReward: 1,
      },
      {
        demands: [
          { category: ItemCategory.FLOWER, line: FlowerFamily.ROMANTIC, minLevel: 1, maxLevel: 2 },
          { category: ItemCategory.DRINK, line: DrinkLine.TEA, minLevel: 1, maxLevel: 1 },
        ],
        goldReward: 25, wishReward: 4, dewReward: 2,
      },
    ],
  },

  // --- 花+饮组合（2个需求）---
  {
    id: 'literary_youth',
    name: '文艺青年',
    color: 0xCC99FF,
    isRegular: true,
    possibleOrders: [
      {
        demands: [
          { category: ItemCategory.DRINK, line: DrinkLine.TEA, minLevel: 1, maxLevel: 2 },
          { category: ItemCategory.FLOWER, line: FlowerFamily.ROMANTIC, minLevel: 1, maxLevel: 2 },
        ],
        goldReward: 25, wishReward: 4, dewReward: 2,
      },
    ],
  },

  // --- 中等难度（2个需求）---
  {
    id: 'couple',
    name: '情侣',
    color: 0xEF9A9A,
    isRegular: true,
    possibleOrders: [
      {
        demands: [
          { category: ItemCategory.FLOWER, line: FlowerFamily.ROMANTIC, minLevel: 3, maxLevel: 5 },
          { category: ItemCategory.DRINK, line: DrinkLine.COLD, minLevel: 2, maxLevel: 3 },
        ],
        goldReward: 50, wishReward: 8, dewReward: 4,
      },
    ],
  },
  {
    id: 'birthday_guest',
    name: '生日顾客',
    color: 0xFFAB91,
    isRegular: false,
    possibleOrders: [
      {
        demands: [
          { category: ItemCategory.FLOWER, line: FlowerFamily.LUXURY, minLevel: 2, maxLevel: 3 },
          { category: ItemCategory.DRINK, line: DrinkLine.DESSERT, minLevel: 2, maxLevel: 2 },
        ],
        goldReward: 45, wishReward: 7, dewReward: 3,
      },
    ],
  },
  {
    id: 'confession_boy',
    name: '告白男生',
    color: 0x66CCCC,
    isRegular: false,
    possibleOrders: [
      {
        demands: [
          { category: ItemCategory.FLOWER, line: FlowerFamily.ROMANTIC, minLevel: 3, maxLevel: 5 },
          { category: ItemCategory.DRINK, line: DrinkLine.COLD, minLevel: 1, maxLevel: 2 },
        ],
        goldReward: 40, wishReward: 6, dewReward: 3,
      },
    ],
  },

  // --- 中高难度（2~3个需求）---
  {
    id: 'festival_guest',
    name: '节日顾客',
    color: 0xFFD54F,
    isRegular: false,
    possibleOrders: [
      {
        demands: [
          { category: ItemCategory.FLOWER, line: FlowerFamily.DAILY, minLevel: 3, maxLevel: 5 },
          { category: ItemCategory.DRINK, line: DrinkLine.TEA, minLevel: 2, maxLevel: 2 },
          { category: ItemCategory.DRINK, line: DrinkLine.DESSERT, minLevel: 1, maxLevel: 1 },
        ],
        goldReward: 55, wishReward: 9, dewReward: 4,
      },
      {
        demands: [
          { category: ItemCategory.FLOWER, line: FlowerFamily.DAILY, minLevel: 3, maxLevel: 5 },
          { category: ItemCategory.DRINK, line: DrinkLine.TEA, minLevel: 2, maxLevel: 2 },
        ],
        goldReward: 40, wishReward: 6, dewReward: 3,
      },
    ],
  },

  // --- 灵活需求（2个需求）---
  {
    id: 'influencer',
    name: '网红博主',
    color: 0xF48FB1,
    isRegular: true,
    possibleOrders: [
      {
        demands: [
          { category: ItemCategory.FLOWER, line: FlowerFamily.ROMANTIC, minLevel: 3, maxLevel: 6 },
          { category: ItemCategory.DRINK, line: DrinkLine.COLD, minLevel: 1, maxLevel: 3 },
        ],
        goldReward: 45, wishReward: 7, dewReward: 3,
      },
      {
        demands: [
          { category: ItemCategory.FLOWER, line: FlowerFamily.DAILY, minLevel: 3, maxLevel: 6 },
          { category: ItemCategory.DRINK, line: DrinkLine.DESSERT, minLevel: 1, maxLevel: 3 },
        ],
        goldReward: 45, wishReward: 7, dewReward: 3,
      },
    ],
  },

  // --- 高级大单（2~3个需求）---
  {
    id: 'rich_lady',
    name: '贵妇',
    color: 0xB39DDB,
    isRegular: true,
    possibleOrders: [
      {
        demands: [
          { category: ItemCategory.FLOWER, line: FlowerFamily.LUXURY, minLevel: 4, maxLevel: 5 },
          { category: ItemCategory.DRINK, line: DrinkLine.DESSERT, minLevel: 3, maxLevel: 3 },
        ],
        goldReward: 80, wishReward: 12, dewReward: 6,
      },
      {
        demands: [
          { category: ItemCategory.FLOWER, line: FlowerFamily.LUXURY, minLevel: 3, maxLevel: 5 },
          { category: ItemCategory.DRINK, line: DrinkLine.DESSERT, minLevel: 2, maxLevel: 3 },
          { category: ItemCategory.DRINK, line: DrinkLine.COLD, minLevel: 2, maxLevel: 3 },
        ],
        goldReward: 100, wishReward: 15, dewReward: 8,
      },
    ],
  },
  {
    id: 'collector',
    name: '收藏家',
    color: 0x80CBC4,
    isRegular: true,
    possibleOrders: [
      {
        demands: [
          { category: ItemCategory.FLOWER, line: FlowerFamily.LUXURY, minLevel: 4, maxLevel: 5 },
          { category: ItemCategory.DRINK, line: DrinkLine.TEA, minLevel: 3, maxLevel: 3 },
          { category: ItemCategory.DRINK, line: DrinkLine.COLD, minLevel: 2, maxLevel: 3 },
        ],
        goldReward: 90, wishReward: 14, dewReward: 7,
      },
    ],
  },

  // --- 最高难度（3个需求）---
  {
    id: 'bride',
    name: '婚礼新娘',
    color: 0xF8BBD0,
    isRegular: false,
    possibleOrders: [
      {
        demands: [
          { category: ItemCategory.FLOWER, line: FlowerFamily.ROMANTIC, minLevel: 5, maxLevel: 6 },
          { category: ItemCategory.DRINK, line: DrinkLine.DESSERT, minLevel: 3, maxLevel: 3 },
          { category: ItemCategory.DRINK, line: DrinkLine.COLD, minLevel: 2, maxLevel: 2 },
        ],
        goldReward: 120, wishReward: 18, dewReward: 10,
      },
    ],
  },

  // --- 高级订单（2~3个需求）---
  {
    id: 'mayor',
    name: '镇长',
    color: 0xA5D6A7,
    isRegular: false,
    possibleOrders: [
      {
        demands: [
          { category: ItemCategory.FLOWER, line: FlowerFamily.LUXURY, minLevel: 3, maxLevel: 5 },
          { category: ItemCategory.DRINK, line: DrinkLine.TEA, minLevel: 2, maxLevel: 3 },
        ],
        goldReward: 60, wishReward: 10, dewReward: 5,
      },
    ],
  },
  {
    id: 'vip_guest',
    name: '特邀嘉宾',
    color: 0xFFE082,
    isRegular: false,
    possibleOrders: [
      {
        demands: [
          { category: ItemCategory.FLOWER, line: FlowerFamily.LUXURY, minLevel: 4, maxLevel: 6 },
          { category: ItemCategory.DRINK, line: DrinkLine.DESSERT, minLevel: 2, maxLevel: 3 },
          { category: ItemCategory.DRINK, line: DrinkLine.COLD, minLevel: 2, maxLevel: 3 },
        ],
        goldReward: 100, wishReward: 15, dewReward: 8,
      },
    ],
  },
  {
    id: 'mystery_guest',
    name: '神秘顾客',
    color: 0xB0BEC5,
    isRegular: false,
    possibleOrders: [
      {
        demands: [{ category: ItemCategory.FLOWER, line: FlowerFamily.DAILY, minLevel: 1, maxLevel: 3 }],
        goldReward: 15, wishReward: 3, dewReward: 1,
      },
      {
        demands: [
          { category: ItemCategory.FLOWER, line: FlowerFamily.ROMANTIC, minLevel: 2, maxLevel: 4 },
          { category: ItemCategory.DRINK, line: DrinkLine.COLD, minLevel: 1, maxLevel: 2 },
        ],
        goldReward: 40, wishReward: 6, dewReward: 3,
      },
      {
        demands: [
          { category: ItemCategory.FLOWER, line: FlowerFamily.LUXURY, minLevel: 3, maxLevel: 5 },
          { category: ItemCategory.DRINK, line: DrinkLine.DESSERT, minLevel: 2, maxLevel: 3 },
          { category: ItemCategory.DRINK, line: DrinkLine.TEA, minLevel: 2, maxLevel: 3 },
        ],
        goldReward: 80, wishReward: 12, dewReward: 6,
      },
    ],
  },
];

/**
 * 根据游戏进度获取可选客人池
 * unlockedCategories: 已解锁的品类集合（FLOWER 默认解锁）
 */
export function getAvailableCustomers(unlockedCategories: Set<ItemCategory>): CustomerConfig[] {
  return CustomerConfigs.filter(c =>
    c.possibleOrders.some(order =>
      order.demands.every(d => unlockedCategories.has(d.category))
    )
  );
}

export function getRandomCustomerConfig(unlockedCategories: Set<ItemCategory>): CustomerConfig {
  const pool = getAvailableCustomers(unlockedCategories);
  return pool[Math.floor(Math.random() * pool.length)];
}

export function generateOrder(config: CustomerConfig, unlockedCategories: Set<ItemCategory>): OrderTemplate {
  let orders = config.possibleOrders;
  // 筛选出所有需求品类都已解锁的订单
  const validOrders = orders.filter(o => o.demands.every(d => unlockedCategories.has(d.category)));
  if (validOrders.length > 0) orders = validOrders;
  return orders[Math.floor(Math.random() * orders.length)];
}
