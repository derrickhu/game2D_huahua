import {
  Category,
  CRYSTAL_BALL_ITEM_ID,
  DrinkLine,
  GOLDEN_SCISSORS_ITEM_ID,
  LUCKY_COIN_ITEM_ID,
  ToolLine,
} from '@/config/ItemConfig';
import {
  WORKSHOP_DYE_BLUE_ID,
  WORKSHOP_DYE_BLUE_ICON,
  WORKSHOP_DYE_GREEN_ID,
  WORKSHOP_DYE_GREEN_ICON,
  WORKSHOP_DYE_PINK_ID,
  WORKSHOP_DYE_PINK_ICON,
  WORKSHOP_DYE_YELLOW_ID,
  WORKSHOP_DYE_YELLOW_ICON,
  WORKSHOP_MATERIAL_ID,
} from '@/config/FurnitureWorkshopConfig';
import type { WheelEventTheme, WheelGrant, WheelPrize } from '../WheelEventTheme';
import { MID_AUTUMN_2026_ART } from './midAutumn2026.art';

export const MID_AUTUMN_MOON_WINDOW_BLUEPRINT_ID = 'blueprint_workshop_moon_sheer_window';
export const MID_AUTUMN_MOON_WINDOW_DECO_ID = 'workshop_moon_sheer_window';
export const MID_AUTUMN_MOONCAKE_GIFT_BOX_DECO_ID = 'event_mid_autumn_mooncake_gift_box';
export const MID_AUTUMN_REUNION_DINING_TABLE_DECO_ID = 'event_mid_autumn_reunion_dining_table';
export const MID_AUTUMN_JADE_RABBIT_DOLL_DECO_ID = 'event_mid_autumn_jade_rabbit_doll';

function wp(
  id: string,
  name: string,
  weight: number,
  iconKey: string,
  grant: WheelGrant,
  color = 0xF4C27A,
  labelColor = 0x6B3A12,
): WheelPrize {
  return { id, name, weight, color, labelColor, iconKey, grant };
}

/** 月满中秋（2026-08-14 ～ 10-08）：烤箱加月饼线，嫦娥订单产玉兔灯，三轮转盘。 */
export const MID_AUTUMN_2026: WheelEventTheme = {
  seasonId: 'mid_autumn_2026',
  name: '月满中秋',
  currencyName: '玉兔灯',
  startAt: new Date(2026, 7, 14, 0, 0, 0, 0).getTime(),
  endAt: new Date(2026, 9, 8, 23, 59, 59, 0).getTime(),
  settleToHuayuanRate: 1,
  spinCosts: [3, 3, 3],
  clearanceOutfitId: 'outfit_change',
  orderEarn: {
    category: Category.DRINK,
    line: DrinkLine.MOONCAKE,
    bands: [
      { minLevel: 1, amount: 3 },
      { minLevel: 5, amount: 5 },
    ],
  },
  produceBonus: {
    toolLine: ToolLine.BAKE,
    baseLine: DrinkLine.DESSERT,
    baseWeight: 55,
    extraLine: DrinkLine.MOONCAKE,
    extraWeight: 45,
  },
  featuredCustomer: {
    typeId: 'chang_e',
    dailyCap: 4,
    maxInQueue: 1,
    baseChance: 0.10,
    firstDailyChanceMult: 1.6,
    huayuanMult: 1.2,
    levelBands: {
      A: [1, 4],
      S: [5, 8],
    },
  },
  seasonalItems: [
    {
      category: Category.DRINK,
      line: DrinkLine.MOONCAKE,
      surfaces: ['produce', 'orders'],
    },
  ],
  art: MID_AUTUMN_2026_ART,
  copy: {
    shopBtnLabel: '中秋',
    notOpen: '月满中秋暂未开放',
    ended: '月满中秋活动已结束',
    currencyHelp: '获取来源：用小烤箱烤出月饼，完成嫦娥的月饼订单\n（花店6级可获得烘焙工具棋子，合成小烤箱）\n用途：在月满中秋活动中抽奖',
    currencySettleNote: '活动截止后未抽完的玉兔灯，自动换算为等量花愿值。',
    notEnoughCurrency: '玉兔灯不足，交付月饼订单可获得',
    allCleared: '三轮奖品已全部抽完',
    roundCleared: '本轮奖品已抽完',
    unlockRound: '完成第{round}轮转盘后解锁',
    claimOutfitLater: '完成所有抽奖后可领取',
    alreadyOwnedOutfit: '已获得「{name}」',
  },
  colors: {
    shopBtnBg: 0xE8B86D,
    shopBtnLabel: 0x8A5A28,
    titleFill: 0x6B3A12,
    currencyText: 0xC2410C,
    countdownFill: 0x8A5A28,
    prizeLabel: 0x6B3A12,
    badgeFill: 0x8A5A28,
    helpBody: 0x765548,
    helpNote: 0xC9893A,
  },
  layout: {
    closeNX: 0.905,
    closeNY: 0.084,
    closeR: 56,
    wheelR: 220,
  },
  rounds: [
    [
      wp('stamina_100', '体力×100', 24, 'icon_energy', { kind: 'stamina', amount: 100 }),
      wp('huayuan_5000', '花愿×5000', 20, 'icon_huayuan', { kind: 'huayuan', amount: 5000 }, 0xF7E3A1),
      wp('diamond_5', '钻石×5', 14, 'icon_gem', { kind: 'diamond', amount: 5 }, 0xC9E4F5, 0x1E4A6B),
      wp('workshop_3', '工坊材料×3', 12, 'icon_workshop_material', {
        kind: 'workshopMaterial',
        materialId: WORKSHOP_MATERIAL_ID,
        amount: 3,
      }, 0xE8C9A0, 0x5A3A1A),
      wp('deco_mooncake_gift_box', '月饼礼盒', 8, MID_AUTUMN_MOONCAKE_GIFT_BOX_DECO_ID, {
        kind: 'deco',
        decoId: MID_AUTUMN_MOONCAKE_GIFT_BOX_DECO_ID,
      }, 0xF08A6A, 0x5A2210),
      wp('r1_dye_pink_2', '粉色染料×2', 10, WORKSHOP_DYE_PINK_ICON, {
        kind: 'workshopMaterial',
        materialId: WORKSHOP_DYE_PINK_ID,
        amount: 2,
      }, 0xF5B4C8, 0x7A2A48),
      wp('lucky_coin', '幸运金币×3', 8, 'icon_coin', {
        kind: 'rewardBoxItem',
        itemId: LUCKY_COIN_ITEM_ID,
        amount: 3,
      }, 0xF6D15A, 0x5A3A08),
      wp('diamond_20', '钻石×20', 4, 'icon_gem', { kind: 'diamond', amount: 20 }, 0x8EC5E8, 0x123A5A),
    ],
    [
      wp('r2_stamina_200', '体力×200', 22, 'icon_energy', { kind: 'stamina', amount: 200 }),
      wp('r2_huayuan_10000', '花愿×10000', 18, 'icon_huayuan', { kind: 'huayuan', amount: 10000 }, 0xF7E3A1),
      wp('r2_dye_yellow_3', '黄色染料×3', 14, WORKSHOP_DYE_YELLOW_ICON, {
        kind: 'workshopMaterial',
        materialId: WORKSHOP_DYE_YELLOW_ID,
        amount: 3,
      }, 0xF7E3A1, 0x6B3A12),
      wp('r2_workshop_6', '工坊材料×6', 12, 'icon_workshop_material', {
        kind: 'workshopMaterial',
        materialId: WORKSHOP_MATERIAL_ID,
        amount: 6,
      }, 0xE8C9A0, 0x5A3A1A),
      wp('r2_jade_rabbit_doll', '玉兔玩偶', 8, MID_AUTUMN_JADE_RABBIT_DOLL_DECO_ID, {
        kind: 'deco',
        decoId: MID_AUTUMN_JADE_RABBIT_DOLL_DECO_ID,
      }, 0xF6D15A, 0x5A3A08),
      wp('r2_crystal_ball', '万能水晶', 8, 'icon_crystal_ball', {
        kind: 'rewardBoxItem',
        itemId: CRYSTAL_BALL_ITEM_ID,
        amount: 1,
      }, 0xC9E4F5, 0x1E4A6B),
      wp('r2_reunion_dining_table', '团圆餐桌', 6, MID_AUTUMN_REUNION_DINING_TABLE_DECO_ID, {
        kind: 'deco',
        decoId: MID_AUTUMN_REUNION_DINING_TABLE_DECO_ID,
      }, 0xE8B86D, 0x5A3A10),
      wp('r2_diamond_40', '钻石×40', 6, 'icon_gem', { kind: 'diamond', amount: 40 }, 0x8EC5E8, 0x123A5A),
    ],
    [
      wp('r3_stamina_300', '体力×300', 20, 'icon_energy', { kind: 'stamina', amount: 300 }),
      wp('r3_huayuan_20000', '花愿×20000', 16, 'icon_huayuan', { kind: 'huayuan', amount: 20000 }, 0xF7E3A1),
      wp('r3_dye_blue_4', '蓝色染料×4', 14, WORKSHOP_DYE_BLUE_ICON, {
        kind: 'workshopMaterial',
        materialId: WORKSHOP_DYE_BLUE_ID,
        amount: 4,
      }, 0xC9E4F5, 0x1E4A6B),
      wp('r3_workshop_10', '工坊材料×10', 12, 'icon_workshop_material', {
        kind: 'workshopMaterial',
        materialId: WORKSHOP_MATERIAL_ID,
        amount: 10,
      }, 0xE8C9A0, 0x5A3A1A),
      wp('r3_dye_green_4', '绿色染料×4', 10, WORKSHOP_DYE_GREEN_ICON, {
        kind: 'workshopMaterial',
        materialId: WORKSHOP_DYE_GREEN_ID,
        amount: 4,
      }, 0xB8E0C8, 0x1E4A32),
      wp('r3_golden_scissors', '金剪刀', 8, 'icon_golden_scissors', {
        kind: 'rewardBoxItem',
        itemId: GOLDEN_SCISSORS_ITEM_ID,
        amount: 1,
      }, 0xE8C9A0, 0x5A3A1A),
      wp('r3_blueprint_moon_window', '月纱长窗图纸', 8, 'workshop_blueprint_generic', {
        kind: 'blueprint',
        blueprintId: MID_AUTUMN_MOON_WINDOW_BLUEPRINT_ID,
      }, 0xC9B8E8, 0x3A2860),
      wp('r3_diamond_80', '钻石×80', 5, 'icon_gem', { kind: 'diamond', amount: 80 }, 0x8EC5E8, 0x123A5A),
    ],
  ],
};
