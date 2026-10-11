import type { ExchangeEventArt } from './ExchangeEventTheme';
import { COOL_SUMMER_2026_ART } from './themes/coolSummer2026.art';
import { GOLDEN_AUTUMN_2026_ART } from './themes/goldenAutumn2026.art';

/**
 * 开新一期只改这里的 ACTIVE_EXCHANGE_SEASON_ID。
 * 本文件不能依赖物品/家具配置：TextureCache 会 import 它，而那些配置又反向依赖 TextureCache。
 */
export const ACTIVE_EXCHANGE_SEASON_ID = 'golden_autumn_2026';

export const EXCHANGE_ART_BY_SEASON: Readonly<Record<string, ExchangeEventArt>> = {
  cool_summer_2026: COOL_SUMMER_2026_ART,
  golden_autumn_2026: GOLDEN_AUTUMN_2026_ART,
};

export const ACTIVE_EXCHANGE_ART: ExchangeEventArt = EXCHANGE_ART_BY_SEASON[ACTIVE_EXCHANGE_SEASON_ID]!;
