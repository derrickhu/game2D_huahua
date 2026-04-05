/**
 * 许愿喷泉抽奖：消耗许愿券，结果进奖励收纳盒。
 * 奖池与消耗可策划改表；券来源（活动/礼包）由外部发 FlowerSignTicketManager.add。
 */

export const FLOWER_SIGN_DRAW_COST_SINGLE = 1;
export const FLOWER_SIGN_DRAW_COST_MULTI = 10;

export interface FlowerSignPoolEntry {
  itemId: string;
  weight: number;
  /** 每次抽到该条时的数量，默认 1 */
  count?: number;
}

/** 权重越大越常见；条目须存在于 ITEM_DEFS */
export const FLOWER_SIGN_GACHA_POOL: FlowerSignPoolEntry[] = [
  { itemId: 'flower_fresh_1', weight: 28 },
  { itemId: 'flower_green_1', weight: 24 },
  { itemId: 'drink_butterfly_1', weight: 18 },
  { itemId: 'currency_stamina_1', weight: 14 },
  { itemId: 'currency_huayuan_pickup_1', weight: 10 },
  { itemId: 'tool_plant_1', weight: 6 },
];
