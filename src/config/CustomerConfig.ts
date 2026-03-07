/**
 * 客人配置 - 16种客人
 */

export interface DemandSlot {
  /** 物品ID（精确匹配）或 null 表示灵活需求 */
  itemId: string | null;
  /** 如果 itemId 为 null，使用品类+最低等级进行匹配 */
  category?: 'flower' | 'drink';
  minLevel?: number;
}

export interface CustomerDef {
  id: string;
  name: string;
  /** 需求槽位数（固定或范围） */
  slotCount: [number, number];
  /** 需求模板（实际刷新时根据模板随机生成） */
  demandTemplates: DemandSlot[][];
  /** 难度定位 */
  difficulty: 'easy' | 'normal' | 'hard' | 'extreme';
  /** 基础金币奖励 */
  goldReward: number;
  /** 花愿奖励 */
  huayuanReward: number;
  /** 花露奖励 */
  hualuReward: number;
}

export const CUSTOMER_DEFS: CustomerDef[] = [
  {
    id: 'student_girl', name: '学生少女', slotCount: [1, 1], difficulty: 'easy',
    goldReward: 10, huayuanReward: 1, hualuReward: 0,
    demandTemplates: [
      [{ itemId: 'flower_daily_1' }],
      [{ itemId: 'flower_romantic_1' }],
    ],
  },
  {
    id: 'kid', name: '小朋友', slotCount: [1, 1], difficulty: 'easy',
    goldReward: 10, huayuanReward: 1, hualuReward: 0,
    demandTemplates: [
      [{ itemId: 'drink_tea_1' }],
      [{ itemId: 'drink_cold_1' }],
    ],
  },
  {
    id: 'office_worker', name: '上班族', slotCount: [1, 2], difficulty: 'easy',
    goldReward: 20, huayuanReward: 2, hualuReward: 1,
    demandTemplates: [
      [{ itemId: 'flower_daily_3' }],
      [{ itemId: 'flower_daily_3' }, { itemId: 'drink_tea_2' }],
    ],
  },
  {
    id: 'gentle_mom', name: '温柔妈妈', slotCount: [1, 2], difficulty: 'easy',
    goldReward: 20, huayuanReward: 2, hualuReward: 1,
    demandTemplates: [
      [{ itemId: 'flower_romantic_2' }],
      [{ itemId: 'flower_romantic_2' }, { itemId: 'drink_tea_1' }],
    ],
  },
  {
    id: 'art_youth', name: '文艺青年', slotCount: [2, 2], difficulty: 'normal',
    goldReward: 30, huayuanReward: 3, hualuReward: 2,
    demandTemplates: [
      [{ itemId: 'drink_tea_1' }, { itemId: 'flower_romantic_1' }],
      [{ itemId: 'drink_cold_1' }, { itemId: 'flower_daily_2' }],
    ],
  },
  {
    id: 'couple', name: '情侣', slotCount: [2, 2], difficulty: 'normal',
    goldReward: 50, huayuanReward: 5, hualuReward: 3,
    demandTemplates: [
      [{ itemId: 'flower_romantic_5' }, { itemId: 'drink_cold_3' }],
    ],
  },
  {
    id: 'birthday', name: '生日顾客', slotCount: [2, 2], difficulty: 'normal',
    goldReward: 50, huayuanReward: 5, hualuReward: 3,
    demandTemplates: [
      [{ itemId: 'flower_luxury_2' }, { itemId: 'drink_dessert_2' }],
    ],
  },
  {
    id: 'confession_boy', name: '告白男生', slotCount: [2, 2], difficulty: 'normal',
    goldReward: 50, huayuanReward: 5, hualuReward: 3,
    demandTemplates: [
      [{ itemId: 'flower_romantic_5' }, { itemId: 'drink_cold_2' }],
    ],
  },
  {
    id: 'festival', name: '节日顾客', slotCount: [2, 3], difficulty: 'hard',
    goldReward: 80, huayuanReward: 8, hualuReward: 5,
    demandTemplates: [
      [{ itemId: 'flower_daily_5' }, { itemId: 'drink_tea_2' }, { itemId: 'drink_dessert_1' }],
      [{ itemId: 'flower_romantic_4' }, { itemId: 'drink_cold_2' }],
    ],
  },
  {
    id: 'blogger', name: '网红博主', slotCount: [2, 2], difficulty: 'normal',
    goldReward: 60, huayuanReward: 6, hualuReward: 4,
    demandTemplates: [
      [{ itemId: null, category: 'flower', minLevel: 3 }, { itemId: null, category: 'drink', minLevel: 1 }],
    ],
  },
  {
    id: 'rich_lady', name: '贵妇', slotCount: [2, 3], difficulty: 'hard',
    goldReward: 120, huayuanReward: 12, hualuReward: 8,
    demandTemplates: [
      [{ itemId: 'flower_luxury_4' }, { itemId: 'drink_dessert_3' }],
      [{ itemId: 'flower_luxury_4' }, { itemId: 'drink_dessert_3' }, { itemId: 'drink_tea_2' }],
    ],
  },
  {
    id: 'collector', name: '收藏家', slotCount: [2, 3], difficulty: 'hard',
    goldReward: 150, huayuanReward: 15, hualuReward: 10,
    demandTemplates: [
      [{ itemId: 'flower_luxury_5' }, { itemId: 'drink_tea_3' }, { itemId: 'drink_cold_3' }],
    ],
  },
  {
    id: 'bride', name: '婚礼新娘', slotCount: [3, 3], difficulty: 'extreme',
    goldReward: 200, huayuanReward: 20, hualuReward: 15,
    demandTemplates: [
      [{ itemId: 'flower_romantic_6' }, { itemId: 'drink_dessert_3' }, { itemId: 'drink_cold_2' }],
    ],
  },
  {
    id: 'mayor', name: '镇长', slotCount: [2, 3], difficulty: 'hard',
    goldReward: 100, huayuanReward: 10, hualuReward: 8,
    demandTemplates: [
      [{ itemId: null, category: 'flower', minLevel: 4 }, { itemId: null, category: 'drink', minLevel: 2 }],
    ],
  },
  {
    id: 'vip_guest', name: '特邀嘉宾', slotCount: [2, 3], difficulty: 'extreme',
    goldReward: 180, huayuanReward: 18, hualuReward: 12,
    demandTemplates: [
      [{ itemId: 'flower_luxury_5' }, { itemId: 'drink_dessert_3' }],
      [{ itemId: 'flower_romantic_5' }, { itemId: 'drink_cold_3' }, { itemId: 'flower_daily_4' }],
    ],
  },
  {
    id: 'mystery', name: '神秘顾客', slotCount: [1, 3], difficulty: 'normal',
    goldReward: 100, huayuanReward: 10, hualuReward: 10,
    demandTemplates: [
      [{ itemId: null, category: 'flower', minLevel: 1 }],
      [{ itemId: null, category: 'drink', minLevel: 1 }, { itemId: null, category: 'flower', minLevel: 2 }],
    ],
  },
];
