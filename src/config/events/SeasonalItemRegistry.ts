/**
 * 限时活动棋盘物品线。
 * 进行中：只开放登记的入口（产出、订单、商店、抽奖等）。
 * 到期或 GM 关掉活动：入口全部关闭，持有的物品在读档或活动状态切到结束时换成花愿。
 */
import { ITEM_DEFS } from '../ItemConfig';
import { ALL_EXCHANGE_THEMES } from './exchange/ExchangeEventRegistry';
import { ALL_WHEEL_THEMES } from './wheel/WheelEventRegistry';
import type { SeasonalItemLineDef, SeasonalItemSurface } from './SeasonalItemConfig';

const liveCheckers = new Map<string, () => boolean>();

/**
 * 活动进行中的判断。兑换活动和转盘会在 init 里接上自己的 isActive
 * （含 GM 强制开启）。没接上时按开始/结束时间。
 */
export function setSeasonalSeasonLiveChecker(seasonId: string, isLive: () => boolean): void {
  liveCheckers.set(seasonId, isLive);
}

function collectLines(): SeasonalItemLineDef[] {
  const lines: SeasonalItemLineDef[] = [];
  for (const theme of ALL_WHEEL_THEMES) {
    for (const item of theme.seasonalItems ?? []) {
      lines.push({
        seasonId: theme.seasonId,
        eventName: theme.name,
        category: item.category,
        line: item.line,
        startAt: theme.startAt,
        endAt: theme.endAt,
        surfaces: item.surfaces,
      });
    }
  }
  for (const theme of ALL_EXCHANGE_THEMES) {
    for (const item of theme.seasonalItems ?? []) {
      lines.push({
        seasonId: theme.seasonId,
        eventName: theme.name,
        category: item.category,
        line: item.line,
        startAt: theme.startAt,
        endAt: theme.endAt,
        surfaces: item.surfaces,
      });
    }
  }
  return lines;
}

export const SEASONAL_ITEM_LINES: readonly SeasonalItemLineDef[] = collectLines();

function lineKey(category: string, line: string): string {
  return `${category}:${line}`;
}

const LINES_BY_KEY = new Map(SEASONAL_ITEM_LINES.map(spec => [lineKey(spec.category, spec.line), spec]));

export function findSeasonalItemLine(category: string, line: string): SeasonalItemLineDef | null {
  return LINES_BY_KEY.get(lineKey(category, line)) ?? null;
}

export function isSeasonLive(spec: SeasonalItemLineDef, now = Date.now()): boolean {
  const checker = liveCheckers.get(spec.seasonId);
  if (checker) return checker();
  return now >= spec.startAt && now <= spec.endAt;
}

/** 非活动物品始终开放。活动物品只在进行中、且登记了该入口时开放。 */
export function seasonalSurfaceOpen(
  category: string,
  line: string,
  surface: SeasonalItemSurface,
  now = Date.now(),
): boolean {
  const spec = findSeasonalItemLine(category, line);
  if (!spec) return true;
  return isSeasonLive(spec, now) && spec.surfaces.includes(surface);
}

export function seasonalLineForItem(itemId: string): SeasonalItemLineDef | null {
  const def = ITEM_DEFS.get(itemId);
  if (!def) return null;
  return findSeasonalItemLine(def.category, def.line);
}

/** 已到期（或尚未开始、GM 未强制开启）的活动物品。 */
export function isSeasonalItemRetired(itemId: string, now = Date.now()): boolean {
  const spec = seasonalLineForItem(itemId);
  if (!spec) return false;
  return !isSeasonLive(spec, now);
}

export function isSeasonalItemBlockedOn(itemId: string, surface: SeasonalItemSurface, now = Date.now()): boolean {
  const spec = seasonalLineForItem(itemId);
  if (!spec) return false;
  return !(isSeasonLive(spec, now) && spec.surfaces.includes(surface));
}

/** 下线结算：按订单花愿，不是棋盘出售价。 */
export function seasonalItemRetireHuayuan(itemId: string, count = 1): number {
  if (!isSeasonalItemRetired(itemId)) return 0;
  const def = ITEM_DEFS.get(itemId);
  const each = Math.max(1, Math.floor(def?.orderHuayuan ?? def?.sellHuayuan ?? 1));
  const n = Math.max(1, Math.floor(count));
  return each * n;
}
