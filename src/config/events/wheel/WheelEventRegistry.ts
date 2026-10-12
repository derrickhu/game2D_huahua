import { ACTIVE_WHEEL_SEASON_ID } from './WheelEventArtRegistry';
import { toPastWheelTheme, type PastWheelTheme, type WheelEventTheme } from './WheelEventTheme';
import { MID_AUTUMN_2026 } from './themes/midAutumn2026';

/** 所有登记过的转盘主题。新一期加进这里，再改 ACTIVE_WHEEL_SEASON_ID。 */
export const ALL_WHEEL_THEMES: readonly WheelEventTheme[] = [
  MID_AUTUMN_2026,
];

function pickActiveTheme(): WheelEventTheme {
  const theme = ALL_WHEEL_THEMES.find(item => item.seasonId === ACTIVE_WHEEL_SEASON_ID);
  if (!theme) throw new Error(`[WheelEvent] 未登记的主题 ${ACTIVE_WHEEL_SEASON_ID}`);
  return theme;
}

export const ACTIVE_WHEEL_THEME: WheelEventTheme = pickActiveTheme();

export const PAST_WHEEL_THEMES: readonly PastWheelTheme[] = ALL_WHEEL_THEMES
  .filter(theme => theme.seasonId !== ACTIVE_WHEEL_SEASON_ID)
  .map(toPastWheelTheme);

export function findWheelTheme(seasonId: string | undefined): WheelEventTheme | null {
  if (!seasonId) return null;
  return ALL_WHEEL_THEMES.find(theme => theme.seasonId === seasonId) ?? null;
}

export function findPastWheelTheme(seasonId: string | undefined): PastWheelTheme | null {
  if (!seasonId) return null;
  return PAST_WHEEL_THEMES.find(theme => theme.seasonId === seasonId) ?? null;
}
