import {
  CRYSTAL_BALL_ITEM_ID,
  DrinkLine,
  GOLDEN_SCISSORS_ITEM_ID,
  LUCKY_COIN_ITEM_ID,
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

export const MID_AUTUMN_SEASON_ID = 'mid_autumn_2026';
export const MID_AUTUMN_EVENT_NAME = '月满中秋';
export const MID_AUTUMN_CURRENCY_NAME = '玉兔灯';

/** 活动时间使用玩家设备本地时区。覆盖中秋（2026-09-25）并便于当期验收。 */
export const MID_AUTUMN_DEFAULT_START_AT = new Date(2026, 7, 14, 0, 0, 0, 0).getTime();
export const MID_AUTUMN_DEFAULT_END_AT = new Date(2026, 9, 8, 23, 59, 59, 0).getTime();

/** 烤箱在活动中附加月饼的相对权重（与甜品对抽）。 */
export const MID_AUTUMN_MOONCAKE_PRODUCE_WEIGHT = 45;
export const MID_AUTUMN_DESSERT_PRODUCE_WEIGHT = 55;

/** 嫦娥专属客人 */
export const MID_AUTUMN_CHANGE_CUSTOMER_ID = 'chang_e';
export const MID_AUTUMN_CHANGE_DAILY_CAP = 4;
export const MID_AUTUMN_CHANGE_MAX_IN_QUEUE = 1;
export const MID_AUTUMN_CHANGE_BASE_CHANCE = 0.10;
export const MID_AUTUMN_CHANGE_FIRST_DAILY_CHANCE_MULT = 1.6;
/** 嫦娥订单花愿相对同内容其他订单 +20% */
export const MID_AUTUMN_CHANGE_HUAYUAN_MULT = 1.2;

export type MidAutumnChangETier = 'A' | 'S';

/** 嫦娥 A 单月饼 L1–L4，S 单月饼 L5–L8。 */
export const MID_AUTUMN_CHANGE_MOONCAKE_LEVELS: Record<
  MidAutumnChangETier,
  readonly [number, number]
> = {
  A: [1, 4],
  S: [5, 8],
};

export function midAutumnChangETierFromMooncakeLevel(level: number): MidAutumnChangETier {
  return level >= MID_AUTUMN_CHANGE_MOONCAKE_LEVELS.S[0] ? 'S' : 'A';
}

/**
 * 含月饼订单按最高月饼等级给玉兔灯。
 * L1–L4（A 单）→ 2，L5–L8（S 单）→ 4。
 */
export function midAutumnLanternsForMooncakeLevel(level: number): number {
  if (!Number.isFinite(level) || level < 1) return 0;
  return Math.floor(level) >= 5 ? 4 : 2;
}

/** 活动结束后，未抽完的玉兔灯 → 花愿换算比例。 */
export const MID_AUTUMN_LANTERN_TO_HUAYUAN_RATE = 1;

/** 三轮抽奖花费：第 1 / 2 / 3 轮分别 4 / 6 / 8 盏。 */
export const MID_AUTUMN_SPIN_COSTS = [4, 6, 8] as const;
export const MID_AUTUMN_SPIN_COST = MID_AUTUMN_SPIN_COSTS[0];

export function midAutumnSpinCostForRound(round: number): number {
  const idx = clampMidAutumnWheelRound(round) - 1;
  return MID_AUTUMN_SPIN_COSTS[idx] ?? MID_AUTUMN_SPIN_COST;
}

export type MidAutumnGrant =
  | { kind: 'stamina'; amount: number }
  | { kind: 'huayuan'; amount: number }
  | { kind: 'diamond'; amount: number }
  | { kind: 'workshopMaterial'; materialId: string; amount: number }
  | { kind: 'rewardBoxItem'; itemId: string; amount: number }
  | { kind: 'deco'; decoId: string }
  | { kind: 'blueprint'; blueprintId: string };

export const MID_AUTUMN_MOON_WINDOW_BLUEPRINT_ID = 'blueprint_workshop_moon_sheer_window';
export const MID_AUTUMN_MOON_WINDOW_DECO_ID = 'workshop_moon_sheer_window';

export const MID_AUTUMN_MOONCAKE_GIFT_BOX_DECO_ID = 'event_mid_autumn_mooncake_gift_box';
export const MID_AUTUMN_REUNION_DINING_TABLE_DECO_ID = 'event_mid_autumn_reunion_dining_table';
export const MID_AUTUMN_JADE_RABBIT_DOLL_DECO_ID = 'event_mid_autumn_jade_rabbit_doll';

export interface MidAutumnWheelPrize {
  id: string;
  name: string;
  weight: number;
  color: number;
  labelColor: number;
  iconKey: string;
  grant: MidAutumnGrant;
}

export const MID_AUTUMN_WHEEL_ROUND_COUNT = 3;
export const MID_AUTUMN_WHEEL_SLICE_COUNT = 8;

function wp(
  id: string,
  name: string,
  weight: number,
  iconKey: string,
  grant: MidAutumnGrant,
  color = 0xF4C27A,
  labelColor = 0x6B3A12,
): MidAutumnWheelPrize {
  return { id, name, weight, color, labelColor, iconKey, grant };
}

/** 第 1 轮月饼礼盒；第 2 轮团圆餐桌 + 万能水晶；第 3 轮月纱长窗图纸 + 金剪刀。 */
export const MID_AUTUMN_WHEEL_ROUNDS: readonly (readonly MidAutumnWheelPrize[])[] = [
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
];

export const MID_AUTUMN_WHEEL_PRIZES = MID_AUTUMN_WHEEL_ROUNDS[0]!;

export const MID_AUTUMN_WHEEL_PRIZE_MAP = new Map(
  MID_AUTUMN_WHEEL_ROUNDS.flat().map(prize => [prize.id, prize]),
);

export function clampMidAutumnWheelRound(round: number): number {
  if (!Number.isFinite(round)) return 1;
  return Math.min(MID_AUTUMN_WHEEL_ROUND_COUNT, Math.max(1, Math.floor(round)));
}

export function midAutumnWheelPrizesForRound(round: number): readonly MidAutumnWheelPrize[] {
  return MID_AUTUMN_WHEEL_ROUNDS[clampMidAutumnWheelRound(round) - 1] ?? MID_AUTUMN_WHEEL_PRIZES;
}

export function isMidAutumnMooncakeItem(category: string, line: string): boolean {
  return category === 'drink' && line === DrinkLine.MOONCAKE;
}

export function isMidAutumnUniqueGrant(grant: MidAutumnGrant): boolean {
  return grant.kind === 'deco' || grant.kind === 'blueprint';
}

export function midAutumnPrizeQuantityLabel(prize: MidAutumnWheelPrize): string | null {
  return prize.grant.kind === 'deco' || prize.grant.kind === 'blueprint'
    ? null
    : `×${prize.grant.amount}`;
}

export function rollMidAutumnWheelPrize(
  prizes: readonly MidAutumnWheelPrize[],
  wonIds: ReadonlySet<string> = new Set(),
  rng: () => number = Math.random,
): MidAutumnWheelPrize | null {
  const pool = prizes.filter(prize => !wonIds.has(prize.id));
  if (pool.length === 0) return null;
  const total = pool.reduce((sum, prize) => sum + prize.weight, 0);
  let roll = rng() * total;
  for (const prize of pool) {
    roll -= prize.weight;
    if (roll <= 0) return prize;
  }
  return pool[pool.length - 1] ?? null;
}

export function midAutumnWheelPrizeIndex(
  prizeId: string,
  prizes: readonly MidAutumnWheelPrize[] = MID_AUTUMN_WHEEL_PRIZES,
): number {
  return Math.max(0, prizes.findIndex(prize => prize.id === prizeId));
}

/** 默认按活动窗口；Manager.init 后改为「活动中且转盘未抽完」（含 GM 覆盖）。避免 BuildingConfig 直接依赖 Manager。 */
let _activeChecker: () => boolean = () => {
  const now = Date.now();
  return now >= MID_AUTUMN_DEFAULT_START_AT && now <= MID_AUTUMN_DEFAULT_END_AT;
};

export function setMidAutumnActiveChecker(fn: () => boolean): void {
  _activeChecker = fn;
}

export function isMidAutumnBakeBonusActive(): boolean {
  return _activeChecker();
}
