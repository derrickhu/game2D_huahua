import { Category, DrinkLine } from '@/config/ItemConfig';
import {
  WORKSHOP_DYE_BLUE_ID,
  WORKSHOP_DYE_GREEN_ID,
  WORKSHOP_DYE_PINK_ID,
  WORKSHOP_DYE_YELLOW_ID,
  WORKSHOP_MATERIAL_ID,
} from '@/config/FurnitureWorkshopConfig';
import type { ExchangeEventTheme } from '../ExchangeEventTheme';
import { COOL_SUMMER_2026_ART } from './coolSummer2026.art';

/**
 * 清凉一夏（2026-07-11 ～ 08-31）。已下线，素材归档在
 * `game_assets/huahua/archive/events/cool_summer_2026/`；复刻时先 `scripts/event_assets.py restore cool_summer_2026`，
 * 再换 seasonId / 日期并在 Registry 里设为 ACTIVE。
 */
export const COOL_SUMMER_2026: ExchangeEventTheme = {
  seasonId: 'cool_summer_2026',
  name: '清凉一夏',
  currencyName: '清凉小扇',
  startAt: new Date(2026, 6, 11, 0, 0, 0, 0).getTime(),
  endAt: new Date(2026, 7, 31, 23, 59, 59, 0).getTime(),
  settleToHuayuanRate: 1,

  earnRules: [
    {
      id: 'cold_drink',
      category: Category.DRINK,
      line: DrinkLine.COLD,
      tier: 'byLevel',
      rewards: [1, 2, 3, 3, 4, 5, 7, 9],
    },
    {
      id: 'fruit_cut',
      category: Category.FOOD,
      fruitCutLines: true,
      tier: 'fruitCutGlobal',
      rewards: [1, 2, 2, 3, 3, 3, 4, 4, 5, 6, 7, 8, 9, 11, 12],
    },
  ],
  mixedRuleIds: ['cold_drink', 'fruit_cut'],
  mixedMultiplier: 1.35,

  categories: [
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
  ],

  products: [
    { id: 'cool_supply_stamina_400', categoryId: 'cool_supply', name: '清凉体力', cost: 120, stock: 1, grant: { kind: 'stamina', amount: 400 } },
    { id: 'cool_supply_stamina_50', categoryId: 'cool_supply', name: '沁凉体力', cost: 168, stock: 1, grant: { kind: 'stamina', amount: 600 } },
    { id: 'cool_supply_huayuan_1500', categoryId: 'cool_supply', name: '花愿小礼包', cost: 96, stock: 1, grant: { kind: 'huayuan', amount: 20000 } },
    { id: 'cool_supply_huayuan_30000', categoryId: 'cool_supply', name: '花愿大礼包', cost: 132, stock: 1, grant: { kind: 'huayuan', amount: 30000 } },
    { id: 'cool_supply_diamond_15', categoryId: 'cool_supply', name: '清凉钻石', cost: 48, stock: 1, grant: { kind: 'diamond', amount: 15 } },
    { id: 'cool_supply_diamond_10', categoryId: 'cool_supply', name: '冰晶钻石', cost: 144, stock: 1, grant: { kind: 'diamond', amount: 50 } },
    { id: 'workshop_material_bundle', categoryId: 'workshop_materials', name: '工坊材料箱', cost: 132, stock: 1, grant: { kind: 'workshopMaterial', materialId: WORKSHOP_MATERIAL_ID, amount: 15 } },
    { id: 'workshop_material_large_bundle', categoryId: 'workshop_materials', name: '工坊材料大箱', cost: 240, stock: 1, grant: { kind: 'workshopMaterial', materialId: WORKSHOP_MATERIAL_ID, amount: 30 } },
    { id: 'workshop_dye_pink', categoryId: 'workshop_materials', name: '粉色染料', cost: 369, stock: 1, grant: { kind: 'workshopMaterial', materialId: WORKSHOP_DYE_PINK_ID, amount: 3 } },
    { id: 'workshop_dye_yellow', categoryId: 'workshop_materials', name: '黄色染料', cost: 369, stock: 1, grant: { kind: 'workshopMaterial', materialId: WORKSHOP_DYE_YELLOW_ID, amount: 3 } },
    { id: 'workshop_dye_blue', categoryId: 'workshop_materials', name: '蓝色染料', cost: 369, stock: 1, grant: { kind: 'workshopMaterial', materialId: WORKSHOP_DYE_BLUE_ID, amount: 3 } },
    { id: 'workshop_dye_green', categoryId: 'workshop_materials', name: '绿色染料', cost: 369, stock: 1, grant: { kind: 'workshopMaterial', materialId: WORKSHOP_DYE_GREEN_ID, amount: 3 } },
    { id: 'summer_blueprint_lotus_arch_window', categoryId: 'summer_collection', name: '夏日荷塘拱窗图纸', cost: 348, stock: 1, grant: { kind: 'blueprint', blueprintId: 'blueprint_workshop_summer_lotus_arch_window' } },
    { id: 'summer_blueprint_mint_bay_window', categoryId: 'summer_collection', name: '暖阳飘窗图纸', cost: 388, stock: 1, grant: { kind: 'blueprint', blueprintId: 'blueprint_workshop_mint_bougainvillea_bay_window' } },
    { id: 'summer_deco_floor_fan', categoryId: 'summer_collection', name: '清凉立式电扇', cost: 210, stock: 1, grant: { kind: 'deco', decoId: 'season_summer_floor_fan' } },
    { id: 'summer_deco_dining_table', categoryId: 'summer_collection', name: '夏日西瓜餐桌', cost: 280, stock: 1, grant: { kind: 'deco', decoId: 'season_summer_dining_table' } },
    { id: 'summer_blueprint_dining_chair', categoryId: 'summer_collection', name: '夏日餐椅图纸', cost: 292, stock: 1, grant: { kind: 'blueprint', blueprintId: 'blueprint_workshop_summer_dining_chair' } },
  ],

  art: COOL_SUMMER_2026_ART,

  copy: {
    shopBtnLabel: '清凉',
    currencySource: '获取来源：完成包含冷饮或果切的订单',
    currencyUsage: '用途：在清凉一夏活动中兑换奖励',
    currencySettleNote: '活动截止后未兑换完的扇子，自动换算为等量花愿值。',
  },

  colors: {
    badgeFill: 0x1B6B66,
    shopBtnBg: 0x4DB6AC,
    shopBtnLabel: 0x1B6B66,
    titleFill: 0x8A5638,
    titleStroke: 0xFFF6D5,
    accent: 0x55B9B3,
    currencyText: 0x1A4F4C,
    headerFill: 0xBFEFE6,
    headerStroke: 0x51AAA8,
    headerText: 0x285E5D,
    iconFallback: 0x77D2C8,
  },

  layout: {
    closeNX: 0.905,
    closeNY: 0.084,
    contentNX: 0.11,
    contentNY: 0.31,
    contentNW: 0.78,
    contentNH: 0.40,
  },
};
