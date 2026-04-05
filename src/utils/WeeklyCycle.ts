/**
 * 时间边界（均为本地时区）：
 * - 每日挑战日切：每天 05:00
 * - 自然周：每周一 05:00
 */

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** 本地日历 YYYY-MM-DD */
export function formatLocalDateString(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/**
 * 当前「周」的起点：不晚于 now 的最近一次「周一 05:00」。
 * 周区间为 [weekStart, weekStart + 7 天)。
 */
export function getCurrentWeekStartLocal(now: Date = new Date()): Date {
  const d = new Date(now.getTime());
  const jsDay = d.getDay();
  const daysSinceMonday = jsDay === 0 ? 6 : jsDay - 1;
  const mondayMidnight = new Date(d);
  mondayMidnight.setDate(d.getDate() - daysSinceMonday);
  mondayMidnight.setHours(0, 0, 0, 0);
  const anchor = new Date(mondayMidnight);
  anchor.setHours(5, 0, 0, 0);
  if (now.getTime() < anchor.getTime()) {
    anchor.setDate(anchor.getDate() - 7);
  }
  return anchor;
}

/** 与周起点对应的稳定 ID（该周一的本地日期） */
export function getWeekIdLocal(now: Date = new Date()): string {
  const s = getCurrentWeekStartLocal(now);
  return formatLocalDateString(s);
}

/** 下一次周一 05:00（本地）的毫秒时间戳 */
export function getNextWeekResetTimeMs(now: Date = new Date()): number {
  const start = getCurrentWeekStartLocal(now);
  const next = new Date(start);
  next.setDate(next.getDate() + 7);
  return next.getTime();
}

/**
 * 当前「每日挑战」周期起点：不晚于 now 的最近一次当日 05:00。
 * 周期为 [dayStart, 次日 05:00)。
 */
export function getCurrentDailyPeriodStartLocal(now: Date = new Date()): Date {
  const anchor = new Date(now);
  anchor.setHours(5, 0, 0, 0);
  if (now.getTime() < anchor.getTime()) {
    anchor.setDate(anchor.getDate() - 1);
  }
  return anchor;
}

/** 与每日周期起点对应的稳定 ID（该起点所在日历日的 YYYY-MM-DD） */
export function getDailyQuestPeriodIdLocal(now: Date = new Date()): string {
  return formatLocalDateString(getCurrentDailyPeriodStartLocal(now));
}

/** 下一次本地 05:00（每日挑战刷新）的时间戳 */
export function getNextDailyResetTimeMs(now: Date = new Date()): number {
  const next = new Date(now);
  next.setHours(5, 0, 0, 0);
  if (now.getTime() >= next.getTime()) {
    next.setDate(next.getDate() + 1);
  }
  return next.getTime();
}

/** 距下次每日 05:00 刷新的毫秒数 */
export function msUntilNextDailyResetAt5am(now: Date = new Date()): number {
  return Math.max(0, getNextDailyResetTimeMs(now) - now.getTime());
}
