import {
  WORKSHOP_DYE_BLUE_ID,
  WORKSHOP_DYE_GREEN_ID,
  WORKSHOP_DYE_PINK_ID,
  WORKSHOP_DYE_YELLOW_ID,
  WORKSHOP_MATERIAL_ID,
} from '@/config/FurnitureWorkshopConfig';

export const COOL_SUMMER_SEASON_ID = 'cool_summer_2026';
export const COOL_SUMMER_EVENT_NAME = '清凉一夏';
export const COOL_SUMMER_CURRENCY_NAME = '清凉小扇';

/** 活动时间使用玩家设备本地时区。 */
export const COOL_SUMMER_DEFAULT_START_AT = new Date(2026, 6, 11, 0, 0, 0, 0).getTime();
export const COOL_SUMMER_DEFAULT_END_AT = new Date(2026, 7, 31, 23, 59, 59, 0).getTime();

/** 冷饮 L1-L8 对应的清凉小扇奖励（整体偏低，拉长兑换节奏）。 */
export const COOL_SUMMER_COLD_DRINK_REWARDS: readonly number[] = [1, 1, 2, 2, 3, 3, 4, 5];

/**
 * 果切全局等级 1-15 对应的清凉小扇奖励。
 * 不再按全局等级 1:1 发放，避免高阶果切单件过多。
 */
export const COOL_SUMMER_FRUIT_CUT_REWARDS: readonly number[] = [
  1, 1, 1, 1, 2,
  2, 2, 3, 3, 3,
  4, 4, 5, 5, 6,
];

/** 同单同时含冷饮+果切时的加成倍率。 */
export const COOL_SUMMER_MIXED_ORDER_MULTIPLIER = 1.15;

/** 活动结束后，未兑换完的清凉小扇 → 花愿换算比例（1 扇 = N 花愿）。 */
export const COOL_SUMMER_FAN_TO_HUAYUAN_RATE = 1;

export type CoolSummerCategoryId = 'cool_supply' | 'workshop_materials' | 'summer_collection';

/** Manager 可直接执行的活动发奖描述；供 UI 与 SaveManager 共享。 */
export type CoolSummerGrant =
  | { kind: 'stamina'; amount: number }
  | { kind: 'huayuan'; amount: number }
  | { kind: 'diamond'; amount: number }
  | { kind: 'workshopMaterial'; materialId: string; amount: number }
  | { kind: 'blueprint'; blueprintId: string }
  | { kind: 'deco'; decoId: string };

export interface CoolSummerShopProduct {
  id: string;
  categoryId: CoolSummerCategoryId;
  name: string;
  cost: number;
  stock: number;
  grant: CoolSummerGrant;
}

export interface CoolSummerShopCategory {
  id: CoolSummerCategoryId;
  name: string;
  completionRewards: readonly CoolSummerGrant[];
}

export const COOL_SUMMER_SHOP_CATEGORIES: readonly CoolSummerShopCategory[] = [
  {
    id: 'cool_supply',
    name: '清凉补给',
    completionRewards: [
      { kind: 'stamina', amount: 300 },
      { kind: 'diamond', amount: 30 },
    ],
  },
  {
    id: 'workshop_materials',
    name: '工坊妙材',
    completionRewards: [
      { kind: 'workshopMaterial', materialId: WORKSHOP_MATERIAL_ID, amount: 12 },
    ],
  },
  {
    id: 'summer_collection',
    name: '夏日珍藏',
    completionRewards: [
      { kind: 'diamond', amount: 30 },
      { kind: 'huayuan', amount: 30000 },
    ],
  },
];

export const COOL_SUMMER_SHOP_PRODUCTS: readonly CoolSummerShopProduct[] = [
  {
    id: 'cool_supply_stamina_50',
    categoryId: 'cool_supply',
    name: '沁凉体力',
    cost: 35,
    stock: 1,
    grant: { kind: 'stamina', amount: 600 },
  },
  {
    id: 'cool_supply_huayuan_1500',
    categoryId: 'cool_supply',
    name: '花愿小礼包',
    cost: 20,
    stock: 1,
    grant: { kind: 'huayuan', amount: 20000 },
  },
  {
    id: 'cool_supply_diamond_10',
    categoryId: 'cool_supply',
    name: '冰晶钻石',
    cost: 30,
    stock: 1,
    grant: { kind: 'diamond', amount: 50 },
  },
  {
    id: 'workshop_material_bundle',
    categoryId: 'workshop_materials',
    name: '工坊材料箱',
    cost: 55,
    stock: 1,
    grant: { kind: 'workshopMaterial', materialId: WORKSHOP_MATERIAL_ID, amount: 15 },
  },
  {
    id: 'workshop_dye_pink',
    categoryId: 'workshop_materials',
    name: '粉色染料',
    cost: 40,
    stock: 1,
    grant: { kind: 'workshopMaterial', materialId: WORKSHOP_DYE_PINK_ID, amount: 3 },
  },
  {
    id: 'workshop_dye_yellow',
    categoryId: 'workshop_materials',
    name: '黄色染料',
    cost: 40,
    stock: 1,
    grant: { kind: 'workshopMaterial', materialId: WORKSHOP_DYE_YELLOW_ID, amount: 3 },
  },
  {
    id: 'workshop_dye_blue',
    categoryId: 'workshop_materials',
    name: '蓝色染料',
    cost: 40,
    stock: 1,
    grant: { kind: 'workshopMaterial', materialId: WORKSHOP_DYE_BLUE_ID, amount: 3 },
  },
  {
    id: 'workshop_dye_green',
    categoryId: 'workshop_materials',
    name: '绿色染料',
    cost: 40,
    stock: 1,
    grant: { kind: 'workshopMaterial', materialId: WORKSHOP_DYE_GREEN_ID, amount: 3 },
  },
  {
    id: 'summer_blueprint_lotus_arch_window',
    categoryId: 'summer_collection',
    name: '夏日荷塘拱窗图纸',
    cost: 200,
    stock: 1,
    grant: { kind: 'blueprint', blueprintId: 'blueprint_workshop_summer_lotus_arch_window' },
  },
  {
    id: 'summer_blueprint_mint_bay_window',
    categoryId: 'summer_collection',
    name: '柳影木色飘窗图纸',
    cost: 220,
    stock: 1,
    grant: { kind: 'blueprint', blueprintId: 'blueprint_workshop_mint_bougainvillea_bay_window' },
  },
  {
    id: 'summer_deco_floor_fan',
    categoryId: 'summer_collection',
    name: '清凉立式电扇',
    cost: 110,
    stock: 1,
    grant: { kind: 'deco', decoId: 'season_summer_floor_fan' },
  },
  {
    id: 'summer_deco_dining_table',
    categoryId: 'summer_collection',
    name: '夏日西瓜餐桌',
    cost: 210,
    stock: 1,
    grant: { kind: 'deco', decoId: 'season_summer_dining_table' },
  },
];

export const COOL_SUMMER_PRODUCT_MAP = new Map(COOL_SUMMER_SHOP_PRODUCTS.map(product => [product.id, product]));
export const COOL_SUMMER_CATEGORY_MAP = new Map(
  COOL_SUMMER_SHOP_CATEGORIES.map(category => [category.id, category]),
);
