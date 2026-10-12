/**
 * 限时转盘活动主题包。
 *
 * 一期 = 一个主题文件（themes/*.ts）+ 一套素材。Manager / 面板 / 入口只读当期主题。
 * 开新一期：复制上一期主题，换 seasonId、日期、奖品、文案、配色、素材，再改 ACTIVE_WHEEL_SEASON_ID。
 */

import type { ExchangeSeasonalItem } from '../SeasonalItemConfig';

export type WheelGrant =
  | { kind: 'stamina'; amount: number }
  | { kind: 'huayuan'; amount: number }
  | { kind: 'diamond'; amount: number }
  | { kind: 'workshopMaterial'; materialId: string; amount: number }
  | { kind: 'rewardBoxItem'; itemId: string; amount: number }
  | { kind: 'deco'; decoId: string }
  | { kind: 'blueprint'; blueprintId: string };

export interface WheelPrize {
  id: string;
  name: string;
  weight: number;
  color: number;
  labelColor: number;
  iconKey: string;
  grant: WheelGrant;
}

export interface WheelEventArt {
  entryIconKey: string;
  currencyIconKey: string;
  panelShellKey: string;
  wheelDiscKey: string;
  wheelPointerKey: string;
  wheelHubKey: string;
  wheelStandKey: string;
  spinButtonKey: string;
  mainImages: Record<string, string>;
  eventImages: Record<string, string>;
  topBarIconSize: number;
  panoramaIconSize: number;
}

export interface WheelEventCopy {
  shopBtnLabel: string;
  notOpen: string;
  ended: string;
  currencyHelp: string;
  currencySettleNote: string;
  notEnoughCurrency: string;
  allCleared: string;
  roundCleared: string;
  /** `{round}` 会换成当前可玩轮次 */
  unlockRound: string;
  claimOutfitLater: string;
  /** `{name}` 会换成套装名 */
  alreadyOwnedOutfit: string;
}

export interface WheelEventColors {
  shopBtnBg: number;
  shopBtnLabel: number;
  titleFill: number;
  currencyText: number;
  countdownFill: number;
  prizeLabel: number;
  badgeFill: number;
  helpBody: number;
  helpNote: number;
}

export interface WheelEventLayout {
  closeNX: number;
  closeNY: number;
  closeR: number;
  wheelR: number;
}

/** 订单里该产线的最高等级落到某一档，就给这么多活动货币。 */
export interface WheelEarnBand {
  minLevel: number;
  amount: number;
}

export interface WheelOrderEarn {
  category: string;
  line: string;
  bands: readonly WheelEarnBand[];
}

/** 活动进行中，给某类工具额外加一条产出线。权重会再归一化。 */
export interface WheelProduceBonus {
  toolLine: string;
  baseLine: string;
  baseWeight: number;
  extraLine: string;
  extraWeight: number;
}

export type WheelFeaturedTier = 'A' | 'S';

/** 活动专属客人。订单必含 orderEarn 那条产线。 */
export interface WheelFeaturedCustomer {
  typeId: string;
  dailyCap: number;
  maxInQueue: number;
  baseChance: number;
  firstDailyChanceMult: number;
  huayuanMult: number;
  levelBands: Record<WheelFeaturedTier, readonly [number, number]>;
}

export interface WheelEventTheme {
  seasonId: string;
  name: string;
  currencyName: string;
  startAt: number;
  endAt: number;
  settleToHuayuanRate: number;
  /** 与 rounds 等长，下标 0 是第 1 轮每次花费 */
  spinCosts: readonly number[];
  rounds: readonly (readonly WheelPrize[])[];
  clearanceOutfitId?: string;
  orderEarn: WheelOrderEarn;
  produceBonus?: WheelProduceBonus;
  featuredCustomer?: WheelFeaturedCustomer;
  seasonalItems?: readonly ExchangeSeasonalItem[];
  art: WheelEventArt;
  copy: WheelEventCopy;
  colors: WheelEventColors;
  layout: WheelEventLayout;
}

export interface PastWheelTheme {
  seasonId: string;
  name: string;
  currencyName: string;
  settleToHuayuanRate: number;
}

export function toPastWheelTheme(theme: WheelEventTheme): PastWheelTheme {
  return {
    seasonId: theme.seasonId,
    name: theme.name,
    currencyName: theme.currencyName,
    settleToHuayuanRate: theme.settleToHuayuanRate,
  };
}

export function wheelRoundCount(theme: WheelEventTheme): number {
  return theme.rounds.length;
}

export function clampWheelRound(theme: WheelEventTheme, round: number): number {
  const count = Math.max(1, wheelRoundCount(theme));
  if (!Number.isFinite(round)) return 1;
  return Math.min(count, Math.max(1, Math.floor(round)));
}

export function wheelPrizesForRound(theme: WheelEventTheme, round: number): readonly WheelPrize[] {
  return theme.rounds[clampWheelRound(theme, round) - 1] ?? theme.rounds[0] ?? [];
}

export function wheelSpinCost(theme: WheelEventTheme, round: number): number {
  const idx = clampWheelRound(theme, round) - 1;
  return theme.spinCosts[idx] ?? theme.spinCosts[0] ?? 1;
}

export function wheelPrizeIndex(prizeId: string, prizes: readonly WheelPrize[]): number {
  return Math.max(0, prizes.findIndex(prize => prize.id === prizeId));
}

export function isUniqueWheelGrant(grant: WheelGrant): boolean {
  return grant.kind === 'deco' || grant.kind === 'blueprint';
}

export function wheelPrizeQuantityLabel(prize: WheelPrize): string | null {
  return prize.grant.kind === 'deco' || prize.grant.kind === 'blueprint'
    ? null
    : `×${prize.grant.amount}`;
}

export function rollWheelPrize(
  prizes: readonly WheelPrize[],
  wonIds: ReadonlySet<string> = new Set(),
  rng: () => number = Math.random,
): WheelPrize | null {
  const pool = prizes.filter(prize => !wonIds.has(prize.id));
  if (pool.length === 0) return null;
  const total = pool.reduce((sum, prize) => sum + prize.weight, 0);
  if (total <= 0) return pool[pool.length - 1] ?? null;
  let roll = rng() * total;
  for (const prize of pool) {
    roll -= prize.weight;
    if (roll <= 0) return prize;
  }
  return pool[pool.length - 1] ?? null;
}

export function findWheelPrize(theme: WheelEventTheme, prizeId: string): WheelPrize | null {
  for (const round of theme.rounds) {
    const prize = round.find(item => item.id === prizeId);
    if (prize) return prize;
  }
  return null;
}

export function wheelEarnAmount(theme: WheelEventTheme, level: number): number {
  if (!Number.isFinite(level) || level < 1) return 0;
  const lv = Math.floor(level);
  let amount = 0;
  for (const band of theme.orderEarn.bands) {
    if (lv >= band.minLevel) amount = band.amount;
  }
  return amount;
}

export function wheelFeaturedTierFromLevel(
  theme: WheelEventTheme,
  level: number,
): WheelFeaturedTier {
  const featured = theme.featuredCustomer;
  const sMin = featured?.levelBands.S[0] ?? 5;
  return level >= sMin ? 'S' : 'A';
}

export function isWheelFeaturedOrderKind(kind: string | undefined): boolean {
  return kind === 'wheelFeatured' || kind === 'midAutumnChangE';
}
