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
}

export const CUSTOMER_TYPES: CustomerTypeDef[] = [
  // ---- 可出 C 档（初级单）：child / student / worker / mom / athlete / youth ----
  { id: 'child',     name: '小朋友',     emoji: '🧒',  tiers: ['C'] },
  { id: 'student',   name: '学生少女',   emoji: '👧',  tiers: ['C', 'B'] },
  { id: 'worker',    name: '上班族',     emoji: '👔',  tiers: ['C', 'B'] },
  { id: 'mom',       name: '温柔妈妈',   emoji: '👩',  tiers: ['C', 'B'] },
  { id: 'athlete',   name: '运动少年',   emoji: '🏃',  tiers: ['C', 'B', 'A'] },
  { id: 'youth',     name: '文艺青年',   emoji: '🎨',  tiers: ['C', 'B', 'A'] },

  // ---- B 档起（不进 C）：mystery ----
  { id: 'mystery',   name: '神秘男子',   emoji: '🕶️', tiers: ['B', 'A'] },

  // ---- A 档：couple / birthday / blogger（不进 C/B）----
  { id: 'couple',    name: '情侣',       emoji: '💑',  tiers: ['A'] },
  { id: 'birthday',  name: '生日顾客',   emoji: '🎂',  tiers: ['A'] },
  { id: 'blogger',   name: '网红博主',   emoji: '📸',  tiers: ['A'] },

  // ---- 高级 / 特级 ----
  { id: 'celebrity', name: '大明星',     emoji: '⭐',  tiers: ['A', 'S'] },
  { id: 'noble',     name: '贵妇',       emoji: '👸',  tiers: ['A', 'S'] },
  { id: 'collector', name: '收藏家',     emoji: '🧐',  tiers: ['S'] },
];

/** 按 ID 快速查找 */
export const CUSTOMER_TYPE_MAP = new Map(CUSTOMER_TYPES.map(t => [t.id, t]));
