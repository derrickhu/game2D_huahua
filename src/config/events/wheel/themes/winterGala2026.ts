import {
  Category,
  CRYSTAL_BALL_ITEM_ID,
  DrinkLine,
  GOLDEN_SCISSORS_ITEM_ID,
  LUCKY_COIN_ITEM_ID,
  ToolLine,
} from '@/config/ItemConfig';
import {
  WORKSHOP_DYE_BLUE_ICON,
  WORKSHOP_DYE_BLUE_ID,
  WORKSHOP_DYE_GREEN_ICON,
  WORKSHOP_DYE_GREEN_ID,
  WORKSHOP_DYE_PINK_ICON,
  WORKSHOP_DYE_PINK_ID,
  WORKSHOP_DYE_YELLOW_ICON,
  WORKSHOP_DYE_YELLOW_ID,
  WORKSHOP_MATERIAL_ID,
} from '@/config/FurnitureWorkshopConfig';
import type { WheelEventTheme, WheelGrant, WheelPrize } from '../WheelEventTheme';
import { WINTER_GALA_2026_ART } from './winterGala2026.art';

export const WINTER_STAR_CLOCK_BLUEPRINT_ID = 'blueprint_workshop_winter_star_clock';
export const WINTER_STAR_CLOCK_DECO_ID = 'workshop_winter_star_clock';

export const WINTER_COCOA_TABLE_BLUEPRINT_ID = 'blueprint_workshop_winter_cocoa_table';
export const WINTER_COCOA_TABLE_DECO_ID = 'workshop_winter_cocoa_table';

export const WINTER_HEARTH_CHAIR_BLUEPRINT_ID = 'blueprint_workshop_winter_hearth_chair';
export const WINTER_HEARTH_CHAIR_DECO_ID = 'workshop_winter_hearth_chair';

export const NEWYEAR_FIREWORK_WINDOW_BLUEPRINT_ID = 'blueprint_workshop_newyear_firework_window';
export const NEWYEAR_FIREWORK_WINDOW_DECO_ID = 'workshop_newyear_firework_window';

export const WINTER_PINE_TREE_BLUEPRINT_ID = 'blueprint_workshop_winter_pine_tree';
export const WINTER_PINE_TREE_DECO_ID = 'workshop_winter_pine_tree';

export const WINTER_FIREPLACE_BLUEPRINT_ID = 'blueprint_workshop_winter_fireplace';
export const WINTER_FIREPLACE_DECO_ID = 'workshop_winter_fireplace';

export const WINTER_RED_LANTERN_BLUEPRINT_ID = 'blueprint_workshop_winter_red_lantern';
export const WINTER_RED_LANTERN_DECO_ID = 'workshop_winter_red_lantern';

function wp(
  id: string,
  name: string,
  weight: number,
  iconKey: string,
  grant: WheelGrant,
  color = 0xF7E4BD,
  labelColor = 0x6B2D1A,
): WheelPrize {
  return { id, name, weight, color, labelColor, iconKey, grant };
}

/**
 * 冬日星愿季（圣诞 & 元旦双节转盘，2026-12-01 ～ 2027-01-07）：
 * - 小烤箱附加「圣诞姜饼」线 + 饮品搅拌器附加中式「暖冬热茶」线
 * - 冬铃信使订单产「星愿铃铛」（同时含姜饼与热茶额外 +2 铃铛）
 * - 4 轮共 32 格：含 7 张限定工坊图纸 + 100 工坊锤子 + 34 四色染料，通关送「雪绒星愿」店主装扮
 */
export const WINTER_GALA_2026: WheelEventTheme = {
  seasonId: 'winter_gala_2026',
  name: '冬日星愿季',
  currencyName: '星愿铃铛',
  startAt: new Date(2026, 11, 1, 0, 0, 0, 0).getTime(),
  endAt: new Date(2027, 0, 7, 23, 59, 59, 0).getTime(),
  settleToHuayuanRate: 1,
  spinCosts: [3, 3, 4, 4],
  clearanceOutfitId: 'outfit_winter_star',
  orderEarn: [
    {
      category: Category.DRINK,
      line: DrinkLine.GINGERBREAD,
      bands: [
        { minLevel: 1, amount: 3 },
        { minLevel: 5, amount: 5 },
      ],
      featuredLevelBands: {
        A: [1, 4],
        S: [5, 8],
      },
    },
    {
      category: Category.DRINK,
      line: DrinkLine.WINTER_TEA,
      bands: [
        { minLevel: 1, amount: 3 },
        { minLevel: 4, amount: 5 },
      ],
      featuredLevelBands: {
        A: [1, 3],
        S: [4, 7],
      },
    },
  ],
  dualEarnBonus: 2,
  produceBonus: [
    {
      toolLine: ToolLine.BAKE,
      baseLine: DrinkLine.DESSERT,
      baseWeight: 60,
      extraLine: DrinkLine.GINGERBREAD,
      extraWeight: 40,
    },
    {
      toolLine: ToolLine.MIXER,
      baseLine: DrinkLine.COLD,
      baseWeight: 60,
      extraLine: DrinkLine.WINTER_TEA,
      extraWeight: 40,
    },
  ],
  featuredCustomer: {
    typeId: 'winter_herald',
    dailyCap: 6,
    maxInQueue: 1,
    baseChance: 0.15,
    firstDailyChanceMult: 1.8,
    huayuanMult: 1.2,
    levelBands: {
      A: [1, 4],
      S: [5, 8],
    },
  },
  seasonalItems: [
    {
      category: Category.DRINK,
      line: DrinkLine.GINGERBREAD,
      surfaces: ['produce', 'orders'],
    },
    {
      category: Category.DRINK,
      line: DrinkLine.WINTER_TEA,
      surfaces: ['produce', 'orders'],
    },
  ],
  art: WINTER_GALA_2026_ART,
  copy: {
    shopBtnLabel: '双旦',
    notOpen: '冬日星愿季暂未开放',
    ended: '冬日星愿季活动已结束',
    currencyHelp: '获取来源：饮品搅拌器泡出暖冬热茶、小烤箱烤出圣诞姜饼，完成冬铃信使的双旦订单（同单集齐热茶与姜饼再多送2枚）\n用途：在冬日星愿季转盘中抽取工坊图纸与材料',
    currencySettleNote: '活动截止后未抽完的星愿铃铛，自动换算为等量花愿值。',
    notEnoughCurrency: '星愿铃铛不足，交付暖冬热茶或圣诞姜饼订单可获得',
    allCleared: '四轮双旦奖品已全部抽完',
    roundCleared: '本轮奖品已抽完',
    unlockRound: '完成第{round}轮转盘后解锁',
    claimOutfitLater: '抽完四轮全部奖品后自动领取',
    alreadyOwnedOutfit: '已获得「{name}」',
  },
  colors: {
    shopBtnBg: 0xD9534F,
    shopBtnLabel: 0x7A1E1C,
    titleFill: 0x7A2418,
    currencyText: 0xC8372D,
    countdownFill: 0x7A3A1E,
    prizeLabel: 0x6B2D1A,
    badgeFill: 0xB83227,
    helpBody: 0x6E473B,
    helpNote: 0xC67D28,
  },
  layout: {
    closeNX: 0.923,
    closeNY: 0.048,
    closeR: 56,
    wheelR: 220,
  },
  rounds: [
    // 第 1 轮 · 初雪迎新（每次 3 铃铛）：挂毯钟图纸 + 18 锤子 + 绿染料×3 + 粉染料×5
    [
      wp('wg_r1_stamina_120', '体力×120', 22, 'icon_energy', { kind: 'stamina', amount: 120 }),
      wp('wg_r1_huayuan_8000', '花愿×8000', 18, 'icon_huayuan', { kind: 'huayuan', amount: 8000 }, 0xF9E6AC),
      wp('wg_r1_mat_8', '工坊材料×8', 16, 'icon_workshop_material', {
        kind: 'workshopMaterial',
        materialId: WORKSHOP_MATERIAL_ID,
        amount: 8,
      }, 0xECD0AB, 0x5A3A1A),
      wp('wg_r1_mat_10', '工坊材料×10', 12, 'icon_workshop_material', {
        kind: 'workshopMaterial',
        materialId: WORKSHOP_MATERIAL_ID,
        amount: 10,
      }, 0xE5C193, 0x5A3A1A),
      wp('wg_r1_dye_green_3', '绿色染料×3', 12, WORKSHOP_DYE_GREEN_ICON, {
        kind: 'workshopMaterial',
        materialId: WORKSHOP_DYE_GREEN_ID,
        amount: 3,
      }, 0xBFE6CE, 0x1E4A32),
      wp('wg_r1_dye_pink_5', '粉色染料×5', 10, WORKSHOP_DYE_PINK_ICON, {
        kind: 'workshopMaterial',
        materialId: WORKSHOP_DYE_PINK_ID,
        amount: 5,
      }, 0xF7BDCE, 0x7A2A48),
      wp('wg_r1_lucky_coin_3', '幸运金币×3', 8, 'icon_coin', {
        kind: 'rewardBoxItem',
        itemId: LUCKY_COIN_ITEM_ID,
        amount: 3,
      }, 0xF6D15A, 0x5A3A08),
      wp('wg_r1_bp_star_clock', '双旦星芒挂毯钟图纸', 7, 'workshop_blueprint_generic', {
        kind: 'blueprint',
        blueprintId: WINTER_STAR_CLOCK_BLUEPRINT_ID,
      }, 0xF2B5AE, 0x6B1D1A),
    ],
    // 第 2 轮 · 围炉暖夜（每次 3 铃铛）：围炉圆几图纸 + 26 锤子 + 黄/蓝染料各 4
    [
      wp('wg_r2_stamina_200', '体力×200', 20, 'icon_energy', { kind: 'stamina', amount: 200 }),
      wp('wg_r2_huayuan_15000', '花愿×15000', 16, 'icon_huayuan', { kind: 'huayuan', amount: 15000 }, 0xF9E6AC),
      wp('wg_r2_mat_12', '工坊材料×12', 15, 'icon_workshop_material', {
        kind: 'workshopMaterial',
        materialId: WORKSHOP_MATERIAL_ID,
        amount: 12,
      }, 0xECD0AB, 0x5A3A1A),
      wp('wg_r2_mat_14', '工坊材料×14', 12, 'icon_workshop_material', {
        kind: 'workshopMaterial',
        materialId: WORKSHOP_MATERIAL_ID,
        amount: 14,
      }, 0xE5C193, 0x5A3A1A),
      wp('wg_r2_dye_yellow_4', '黄色染料×4', 12, WORKSHOP_DYE_YELLOW_ICON, {
        kind: 'workshopMaterial',
        materialId: WORKSHOP_DYE_YELLOW_ID,
        amount: 4,
      }, 0xF7E3A1, 0x6B3A12),
      wp('wg_r2_dye_blue_4', '蓝色染料×4', 12, WORKSHOP_DYE_BLUE_ICON, {
        kind: 'workshopMaterial',
        materialId: WORKSHOP_DYE_BLUE_ID,
        amount: 4,
      }, 0xC9E4F5, 0x1E4A6B),
      wp('wg_r2_diamond_25', '钻石×25', 7, 'icon_gem', { kind: 'diamond', amount: 25 }, 0x9AD0F0, 0x123A5A),
      wp('wg_r2_bp_cocoa_table', '热可可围炉圆几图纸', 7, 'workshop_blueprint_generic', {
        kind: 'blueprint',
        blueprintId: WINTER_COCOA_TABLE_BLUEPRINT_ID,
      }, 0xEFC69B, 0x5A2E12),
    ],
    // 第 3 轮 · 星铃颂歌（每次 4 铃铛）：围炉单椅图纸 + 跨年烟花拱窗图纸 + 34 锤子 + 绿染料×5 + 粉染料×7
    [
      wp('wg_r3_huayuan_22000', '花愿×22000', 18, 'icon_huayuan', { kind: 'huayuan', amount: 22000 }, 0xF9E6AC),
      wp('wg_r3_mat_16', '工坊材料×16', 15, 'icon_workshop_material', {
        kind: 'workshopMaterial',
        materialId: WORKSHOP_MATERIAL_ID,
        amount: 16,
      }, 0xECD0AB, 0x5A3A1A),
      wp('wg_r3_mat_18', '工坊材料×18', 12, 'icon_workshop_material', {
        kind: 'workshopMaterial',
        materialId: WORKSHOP_MATERIAL_ID,
        amount: 18,
      }, 0xE5C193, 0x5A3A1A),
      wp('wg_r3_dye_green_5', '绿色染料×5', 12, WORKSHOP_DYE_GREEN_ICON, {
        kind: 'workshopMaterial',
        materialId: WORKSHOP_DYE_GREEN_ID,
        amount: 5,
      }, 0xBFE6CE, 0x1E4A32),
      wp('wg_r3_dye_pink_7', '粉色染料×7', 12, WORKSHOP_DYE_PINK_ICON, {
        kind: 'workshopMaterial',
        materialId: WORKSHOP_DYE_PINK_ID,
        amount: 7,
      }, 0xF7BDCE, 0x7A2A48),
      wp('wg_r3_crystal_ball', '万能水晶', 8, 'icon_crystal_ball', {
        kind: 'rewardBoxItem',
        itemId: CRYSTAL_BALL_ITEM_ID,
        amount: 1,
      }, 0xC9E4F5, 0x1E4A6B),
      wp('wg_r3_bp_hearth_chair', '雪绒围炉单椅图纸', 8, 'workshop_blueprint_generic', {
        kind: 'blueprint',
        blueprintId: WINTER_HEARTH_CHAIR_BLUEPRINT_ID,
      }, 0xF2B5AE, 0x6B1D1A),
      wp('wg_r3_bp_firework_window', '跨年烟花拱窗图纸', 6, 'workshop_blueprint_generic', {
        kind: 'blueprint',
        blueprintId: NEWYEAR_FIREWORK_WINDOW_BLUEPRINT_ID,
      }, 0xD2C4F2, 0x3A2860),
    ],
    // 第 4 轮 · 璀璨跨年（每次 4 铃铛）：星铃松枝树图纸 + 暖焰壁炉架图纸 + 大红灯笼图纸 + 22 锤子 + 蓝染料×6
    [
      wp('wg_r4_stamina_360', '体力×360', 18, 'icon_energy', { kind: 'stamina', amount: 360 }),
      wp('wg_r4_huayuan_30000', '花愿×30000', 15, 'icon_huayuan', { kind: 'huayuan', amount: 30000 }, 0xF9E6AC),
      wp('wg_r4_mat_22', '工坊材料×22', 14, 'icon_workshop_material', {
        kind: 'workshopMaterial',
        materialId: WORKSHOP_MATERIAL_ID,
        amount: 22,
      }, 0xE5C193, 0x5A3A1A),
      wp('wg_r4_bp_lantern', '大红灯笼图纸', 7, 'workshop_blueprint_generic', {
        kind: 'blueprint',
        blueprintId: WINTER_RED_LANTERN_BLUEPRINT_ID,
      }, 0xE24B4B, 0x6B1D16),
      wp('wg_r4_dye_blue_6', '蓝色染料×6', 12, WORKSHOP_DYE_BLUE_ICON, {
        kind: 'workshopMaterial',
        materialId: WORKSHOP_DYE_BLUE_ID,
        amount: 6,
      }, 0xC9E4F5, 0x1E4A6B),
      wp('wg_r4_golden_scissors', '金剪刀', 8, 'icon_golden_scissors', {
        kind: 'rewardBoxItem',
        itemId: GOLDEN_SCISSORS_ITEM_ID,
        amount: 1,
      }, 0xE8C9A0, 0x5A3A1A),
      wp('wg_r4_bp_pine_tree', '星铃松枝树图纸', 7, 'workshop_blueprint_generic', {
        kind: 'blueprint',
        blueprintId: WINTER_PINE_TREE_BLUEPRINT_ID,
      }, 0xBDE3CC, 0x1B4B32),
      wp('wg_r4_bp_fireplace', '暖焰壁炉架图纸', 6, 'workshop_blueprint_generic', {
        kind: 'blueprint',
        blueprintId: WINTER_FIREPLACE_BLUEPRINT_ID,
      }, 0xF4B2A2, 0x6B1D16),
    ],
  ],
};
