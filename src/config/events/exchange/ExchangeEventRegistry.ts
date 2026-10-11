import { toPastTheme, type ExchangeEventTheme, type PastExchangeTheme } from './ExchangeEventTheme';
import { ACTIVE_EXCHANGE_SEASON_ID } from './ExchangeEventArtRegistry';
import { COOL_SUMMER_2026 } from './themes/coolSummer2026';
import { GOLDEN_AUTUMN_2026 } from './themes/goldenAutumn2026';

/** 所有登记过的兑换主题（含已下线）。新一期把主题文件加进来，再改 ACTIVE_EXCHANGE_SEASON_ID。 */
const ALL_EXCHANGE_THEMES: readonly ExchangeEventTheme[] = [
  COOL_SUMMER_2026,
  GOLDEN_AUTUMN_2026,
];

function pickActiveTheme(): ExchangeEventTheme {
  const theme = ALL_EXCHANGE_THEMES.find(t => t.seasonId === ACTIVE_EXCHANGE_SEASON_ID);
  if (!theme) throw new Error(`[ExchangeEvent] 未登记的主题 ${ACTIVE_EXCHANGE_SEASON_ID}`);
  return theme;
}

/** 当前兑换活动主题；同一时间只有一期。素材必须在包内（未归档）。 */
export const ACTIVE_EXCHANGE_THEME: ExchangeEventTheme = pickActiveTheme();

/** 已下线主题：只用于把旧存档里没花完的货币结算成花愿。 */
export const PAST_EXCHANGE_THEMES: readonly PastExchangeTheme[] = ALL_EXCHANGE_THEMES
  .filter(theme => theme.seasonId !== ACTIVE_EXCHANGE_SEASON_ID)
  .map(toPastTheme);

export function findPastExchangeTheme(seasonId: string | undefined): PastExchangeTheme | null {
  if (!seasonId) return null;
  return PAST_EXCHANGE_THEMES.find(theme => theme.seasonId === seasonId) ?? null;
}

export const EXCHANGE_PRODUCT_MAP = new Map(
  ACTIVE_EXCHANGE_THEME.products.map(product => [product.id, product]),
);
export const EXCHANGE_CATEGORY_MAP = new Map(
  ACTIVE_EXCHANGE_THEME.categories.map(category => [category.id, category]),
);
