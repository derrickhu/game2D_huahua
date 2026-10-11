import { Category, DrinkLine } from '@/config/ItemConfig';
import {
  WORKSHOP_DYE_BLUE_ID,
  WORKSHOP_DYE_GREEN_ID,
  WORKSHOP_DYE_PINK_ID,
  WORKSHOP_DYE_YELLOW_ID,
  WORKSHOP_MATERIAL_ID,
} from '@/config/FurnitureWorkshopConfig';
import type { ExchangeEventTheme } from '../ExchangeEventTheme';
import { GOLDEN_AUTUMN_2026_ART } from './goldenAutumn2026.art';

export const GOLDEN_AUTUMN_MAPLE_LAMP_DECO_ID = 'event_golden_autumn_maple_floor_lamp';
export const GOLDEN_AUTUMN_PUMPKIN_CART_DECO_ID = 'event_golden_autumn_pumpkin_cart';
export const GOLDEN_AUTUMN_PLAID_TABLE_DECO_ID = 'event_golden_autumn_plaid_dining_table';
export const GOLDEN_AUTUMN_CHESTNUT_STOVE_DECO_ID = 'event_golden_autumn_chestnut_stove';
export const GOLDEN_AUTUMN_MAPLE_WINDOW_DECO_ID = 'workshop_maple_arch_window';
export const GOLDEN_AUTUMN_MAPLE_WINDOW_BLUEPRINT_ID = 'blueprint_workshop_maple_arch_window';

/** 金秋丰收（2026-10-12 ～ 11-30）：甜品 / 果切订单产「枫叶」，兑换秋日家具与补给。 */
export const GOLDEN_AUTUMN_2026: ExchangeEventTheme = {
  seasonId: 'golden_autumn_2026',
  name: '金秋丰收',
  currencyName: '枫叶',
  startAt: new Date(2026, 9, 12, 0, 0, 0, 0).getTime(),
  endAt: new Date(2026, 10, 30, 23, 59, 59, 0).getTime(),
  settleToHuayuanRate: 1,

  earnRules: [
    {
      id: 'dessert',
      category: Category.DRINK,
      line: DrinkLine.DESSERT,
      tier: 'byLevel',
      rewards: [1, 2, 2, 3, 4, 5, 6, 7, 8, 10],
    },
    {
      id: 'fruit_cut',
      category: Category.FOOD,
      fruitCutLines: true,
      tier: 'fruitCutGlobal',
      rewards: [1, 2, 2, 3, 3, 3, 4, 4, 5, 6, 7, 8, 9, 11, 12],
    },
  ],
  mixedRuleIds: ['dessert', 'fruit_cut'],
  mixedMultiplier: 1.35,

  categories: [
    {
      id: 'autumn_supply',
      name: '秋日补给',
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
      id: 'autumn_collection',
      name: '金秋珍藏',
      completionRewards: [
        { kind: 'diamond', amount: 30 },
        { kind: 'huayuan', amount: 30000 },
      ],
    },
  ],

  products: [
    { id: 'autumn_supply_stamina_400', categoryId: 'autumn_supply', name: '秋日体力', cost: 120, stock: 1, grant: { kind: 'stamina', amount: 400 } },
    { id: 'autumn_supply_stamina_600', categoryId: 'autumn_supply', name: '暖秋体力', cost: 168, stock: 1, grant: { kind: 'stamina', amount: 600 } },
    { id: 'autumn_supply_huayuan_20000', categoryId: 'autumn_supply', name: '花愿小礼包', cost: 96, stock: 1, grant: { kind: 'huayuan', amount: 20000 } },
    { id: 'autumn_supply_huayuan_30000', categoryId: 'autumn_supply', name: '花愿大礼包', cost: 132, stock: 1, grant: { kind: 'huayuan', amount: 30000 } },
    { id: 'autumn_supply_diamond_15', categoryId: 'autumn_supply', name: '秋日钻石', cost: 48, stock: 1, grant: { kind: 'diamond', amount: 15 } },
    { id: 'autumn_supply_diamond_50', categoryId: 'autumn_supply', name: '琥珀钻石', cost: 144, stock: 1, grant: { kind: 'diamond', amount: 50 } },
    { id: 'workshop_material_bundle', categoryId: 'workshop_materials', name: '工坊材料箱', cost: 132, stock: 1, grant: { kind: 'workshopMaterial', materialId: WORKSHOP_MATERIAL_ID, amount: 15 } },
    { id: 'workshop_material_large_bundle', categoryId: 'workshop_materials', name: '工坊材料大箱', cost: 240, stock: 1, grant: { kind: 'workshopMaterial', materialId: WORKSHOP_MATERIAL_ID, amount: 30 } },
    { id: 'workshop_dye_pink', categoryId: 'workshop_materials', name: '粉色染料', cost: 369, stock: 1, grant: { kind: 'workshopMaterial', materialId: WORKSHOP_DYE_PINK_ID, amount: 3 } },
    { id: 'workshop_dye_yellow', categoryId: 'workshop_materials', name: '黄色染料', cost: 369, stock: 1, grant: { kind: 'workshopMaterial', materialId: WORKSHOP_DYE_YELLOW_ID, amount: 3 } },
    { id: 'workshop_dye_blue', categoryId: 'workshop_materials', name: '蓝色染料', cost: 369, stock: 1, grant: { kind: 'workshopMaterial', materialId: WORKSHOP_DYE_BLUE_ID, amount: 3 } },
    { id: 'workshop_dye_green', categoryId: 'workshop_materials', name: '绿色染料', cost: 369, stock: 1, grant: { kind: 'workshopMaterial', materialId: WORKSHOP_DYE_GREEN_ID, amount: 3 } },
    { id: 'autumn_blueprint_maple_arch_window', categoryId: 'autumn_collection', name: '枫红拱窗图纸', cost: 348, stock: 1, grant: { kind: 'blueprint', blueprintId: GOLDEN_AUTUMN_MAPLE_WINDOW_BLUEPRINT_ID } },
    { id: 'autumn_deco_maple_floor_lamp', categoryId: 'autumn_collection', name: '枫叶落地灯', cost: 210, stock: 1, grant: { kind: 'deco', decoId: GOLDEN_AUTUMN_MAPLE_LAMP_DECO_ID } },
    { id: 'autumn_deco_pumpkin_cart', categoryId: 'autumn_collection', name: '南瓜丰收推车', cost: 260, stock: 1, grant: { kind: 'deco', decoId: GOLDEN_AUTUMN_PUMPKIN_CART_DECO_ID } },
    { id: 'autumn_deco_plaid_dining_table', categoryId: 'autumn_collection', name: '秋日格纹餐桌', cost: 280, stock: 1, grant: { kind: 'deco', decoId: GOLDEN_AUTUMN_PLAID_TABLE_DECO_ID } },
    { id: 'autumn_deco_chestnut_stove', categoryId: 'autumn_collection', name: '栗子小烤炉', cost: 180, stock: 1, grant: { kind: 'deco', decoId: GOLDEN_AUTUMN_CHESTNUT_STOVE_DECO_ID } },
  ],

  art: GOLDEN_AUTUMN_2026_ART,

  copy: {
    shopBtnLabel: '金秋',
    currencySource: '获取来源：完成包含甜品或果切的订单',
    currencyUsage: '用途：在金秋丰收活动中兑换奖励',
    currencySettleNote: '活动截止后未兑换完的枫叶，自动换算为等量花愿值。',
  },

  colors: {
    badgeFill: 0xA4471A,
    shopBtnBg: 0xE8954A,
    shopBtnLabel: 0x8A3B12,
    titleFill: 0x8A4A1F,
    titleStroke: 0xFFF3D6,
    accent: 0xE08A3C,
    currencyText: 0x7A3410,
    headerFill: 0xFFE2B8,
    headerStroke: 0xE0954C,
    headerText: 0x7A3E12,
    iconFallback: 0xF2A65A,
  },

  /** 按壳体实测：奶油区（0.085/0.272/0.821/0.441）内缩，内缩量与清凉一夏 v2 一致；关闭钮按白 X 中心 */
  layout: {
    closeNX: 0.915,
    closeNY: 0.047,
    contentNX: 0.102,
    contentNY: 0.30,
    contentNW: 0.804,
    contentNH: 0.409,
  },
};
