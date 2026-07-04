/**
 * 客人类型配置
 *
 * 客人只负责人设展示；需求槽数 / 物品等级 / 奖励由订单生成系统驱动。
 * 普通订单从普通客人池按多样性权重随机；特殊订单可指定专属客人。
 */
import type { Category } from './ItemConfig';
import type { OrderGenerationKind } from '@/orders/types';

export interface CustomerDemandDef {
  category: Category;
  lines: string[];
  levelRange: [number, number];
}

export interface CustomerTypeDef {
  id: string;
  name: string;
  emoji: string;
  /** 仅供指定特殊订单使用，不进入普通订单随机池 */
  specialOnly?: boolean;
}

export const CUSTOMER_TYPES: CustomerTypeDef[] = [
  { id: 'child',     name: '小朋友',     emoji: '' },
  { id: 'student',   name: '学生少女',   emoji: '' },
  { id: 'worker',    name: '上班族',     emoji: '' },
  { id: 'mom',       name: '温柔妈妈',   emoji: '' },
  { id: 'athlete',   name: '运动少年',   emoji: '' },
  { id: 'youth',     name: '文艺青年',   emoji: '' },
  { id: 'mystery',   name: '神秘男子',   emoji: '' },
  { id: 'couple',    name: '情侣',       emoji: '' },
  { id: 'birthday',  name: '生日顾客',   emoji: '' },
  { id: 'blogger',   name: '网红博主',   emoji: '' },
  { id: 'celebrity', name: '大明星',     emoji: '' },
  { id: 'noble',     name: '贵妇',       emoji: '' },
  { id: 'collector', name: '收藏家',     emoji: '' },

  // 特殊订单专属客人：不进入普通随机池。
  { id: 'tycoon',           name: '大富翁',   emoji: '', specialOnly: true },
  { id: 'florist_merchant', name: '富贵花商', emoji: '', specialOnly: true },
  { id: 'furniture_craftswoman', name: '家具工匠', emoji: '', specialOnly: true },
];

/** 按 ID 快速查找 */
export const CUSTOMER_TYPE_MAP = new Map(CUSTOMER_TYPES.map(t => [t.id, t]));

export const DEFAULT_SPECIAL_CUSTOMER_BY_ORDER_KIND: Partial<Record<OrderGenerationKind, string>> = {
  timedDiamond: 'tycoon',
  timedFlorist: 'florist_merchant',
  timedWorkshop: 'furniture_craftswoman',
};
