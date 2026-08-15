import { DrinkLine, LUCKY_COIN_ITEM_ID } from '@/config/ItemConfig';
import { WORKSHOP_MATERIAL_ID } from '@/config/FurnitureWorkshopConfig';

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
export const MID_AUTUMN_CHANGE_DAILY_CAP = 2;
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
 * 含月饼订单按最高月饼等级给 1–2 盏玉兔灯。
 * L1–L4 → 1，L5–L8 → 2。
 */
export function midAutumnLanternsForMooncakeLevel(level: number): number {
  if (!Number.isFinite(level) || level < 1) return 0;
  return Math.floor(level) >= 5 ? 2 : 1;
}

/** 活动结束后，未抽完的玉兔灯 → 花愿换算比例。 */
export const MID_AUTUMN_LANTERN_TO_HUAYUAN_RATE = 1;

export const MID_AUTUMN_SPIN_COST = 8;

export type MidAutumnGrant =
  | { kind: 'stamina'; amount: number }
  | { kind: 'huayuan'; amount: number }
  | { kind: 'diamond'; amount: number }
  | { kind: 'workshopMaterial'; materialId: string; amount: number }
  | { kind: 'rewardBoxItem'; itemId: string; amount: number };

export interface MidAutumnWheelPrize {
  id: string;
  name: string;
  weight: number;
  color: number;
  labelColor: number;
  iconKey: string;
  grant: MidAutumnGrant;
}

export const MID_AUTUMN_WHEEL_PRIZES: readonly MidAutumnWheelPrize[] = [
  {
    id: 'stamina_30',
    name: '体力×30',
    weight: 24,
    color: 0xF4C27A,
    labelColor: 0x6B3A12,
    iconKey: 'icon_energy',
    grant: { kind: 'stamina', amount: 30 },
  },
  {
    id: 'huayuan_2000',
    name: '花愿×2000',
    weight: 20,
    color: 0xF7E3A1,
    labelColor: 0x6B3A12,
    iconKey: 'icon_huayuan',
    grant: { kind: 'huayuan', amount: 2000 },
  },
  {
    id: 'diamond_5',
    name: '钻石×5',
    weight: 14,
    color: 0xC9E4F5,
    labelColor: 0x1E4A6B,
    iconKey: 'icon_gem',
    grant: { kind: 'diamond', amount: 5 },
  },
  {
    id: 'workshop_3',
    name: '工坊材料×3',
    weight: 12,
    color: 0xE8C9A0,
    labelColor: 0x5A3A1A,
    iconKey: 'icon_workshop_material',
    grant: { kind: 'workshopMaterial', materialId: WORKSHOP_MATERIAL_ID, amount: 3 },
  },
  {
    id: 'stamina_80',
    name: '体力×80',
    weight: 10,
    color: 0xF08A6A,
    labelColor: 0x5A2210,
    iconKey: 'icon_energy',
    grant: { kind: 'stamina', amount: 80 },
  },
  {
    id: 'huayuan_8000',
    name: '花愿×8000',
    weight: 8,
    color: 0xE8B86D,
    labelColor: 0x5A3A10,
    iconKey: 'icon_huayuan',
    grant: { kind: 'huayuan', amount: 8000 },
  },
  {
    id: 'lucky_coin',
    name: '幸运金币',
    weight: 8,
    color: 0xF6D15A,
    labelColor: 0x5A3A08,
    iconKey: 'icon_coin',
    grant: { kind: 'rewardBoxItem', itemId: LUCKY_COIN_ITEM_ID, amount: 1 },
  },
  {
    id: 'diamond_20',
    name: '钻石×20',
    weight: 4,
    color: 0x8EC5E8,
    labelColor: 0x123A5A,
    iconKey: 'icon_gem',
    grant: { kind: 'diamond', amount: 20 },
  },
];

export const MID_AUTUMN_WHEEL_PRIZE_MAP = new Map(
  MID_AUTUMN_WHEEL_PRIZES.map(prize => [prize.id, prize]),
);

export function isMidAutumnMooncakeItem(category: string, line: string): boolean {
  return category === 'drink' && line === DrinkLine.MOONCAKE;
}

export function rollMidAutumnWheelPrize(rng: () => number = Math.random): MidAutumnWheelPrize {
  const total = MID_AUTUMN_WHEEL_PRIZES.reduce((sum, prize) => sum + prize.weight, 0);
  let roll = rng() * total;
  for (const prize of MID_AUTUMN_WHEEL_PRIZES) {
    roll -= prize.weight;
    if (roll <= 0) return prize;
  }
  return MID_AUTUMN_WHEEL_PRIZES[MID_AUTUMN_WHEEL_PRIZES.length - 1]!;
}

export function midAutumnWheelPrizeIndex(prizeId: string): number {
  return Math.max(0, MID_AUTUMN_WHEEL_PRIZES.findIndex(prize => prize.id === prizeId));
}

/** 默认按活动窗口；Manager.init 后改为含 GM 覆盖。避免 BuildingConfig 直接依赖 Manager。 */
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
