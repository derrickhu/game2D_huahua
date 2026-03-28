/**
 * 客人类型配置
 *
 * 每种客人关联可出现的订单档位 (tiers)；需求槽数/物品等级/奖励
 * 由 OrderTierConfig 的档位模板驱动，不再写死在客人配置里。
 */
import type { Category } from './ItemConfig';
import type { OrderTier } from './OrderTierConfig';

export interface CustomerDemandDef {
  category: Category;
  lines: string[];
  levelRange: [number, number];
}

export interface CustomerTypeDef {
  id: string;
  name: string;
  emoji: string;
  /** 该客人可出现在哪些订单档位 */
  tiers: OrderTier[];
  /** 是否为可养成熟客 */
  isRegular: boolean;
}

export const CUSTOMER_TYPES: CustomerTypeDef[] = [
  // ---- 初级为主 ----
  { id: 'child',     name: '小朋友',     emoji: '🧒',  tiers: ['C'],           isRegular: false },
  { id: 'student',   name: '学生少女',   emoji: '👧',  tiers: ['C', 'B'],      isRegular: true  },

  // ---- 中级为主 ----
  { id: 'worker',    name: '上班族',     emoji: '👔',  tiers: ['B'],           isRegular: true  },
  { id: 'mom',       name: '温柔妈妈',   emoji: '👩',  tiers: ['B'],           isRegular: true  },
  { id: 'athlete',   name: '运动少年',   emoji: '🏃',  tiers: ['B', 'A'],      isRegular: true  },

  // ---- 中高级 ----
  { id: 'youth',     name: '文艺青年',   emoji: '🎨',  tiers: ['B', 'A'],      isRegular: true  },
  { id: 'mystery',   name: '神秘男子',   emoji: '🕶️', tiers: ['B', 'A'],      isRegular: true  },
  { id: 'couple',    name: '情侣',       emoji: '💑',  tiers: ['A'],           isRegular: true  },
  { id: 'birthday',  name: '生日顾客',   emoji: '🎂',  tiers: ['A'],           isRegular: false },
  { id: 'blogger',   name: '网红博主',   emoji: '📸',  tiers: ['A'],           isRegular: true  },

  // ---- 高级 / 特级 ----
  { id: 'celebrity', name: '大明星',     emoji: '⭐',  tiers: ['A', 'S'],      isRegular: true  },
  { id: 'noble',     name: '贵妇',       emoji: '👸',  tiers: ['A', 'S'],      isRegular: true  },
  { id: 'collector', name: '收藏家',     emoji: '🧐',  tiers: ['S'],           isRegular: true  },
];

/** 按 ID 快速查找 */
export const CUSTOMER_TYPE_MAP = new Map(CUSTOMER_TYPES.map(t => [t.id, t]));
