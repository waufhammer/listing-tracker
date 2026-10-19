/** Days on market after which charts switch from daily to weekly points. */
export const WEEKLY_AFTER_DAYS = 30;

const DAY_MS = 1000 * 60 * 60 * 24;

/**
 * Collapse a date-sorted (ascending) series of cumulative values to one point
 * per week. Weeks are 7-day blocks counted from `anchorDate` (the list date),
 * and each week keeps its latest point, so the final point is always the most
 * recent value. Points before the anchor (e.g. the zero baseline) fall into
 * their own earlier block and are kept.
 */
export function sampleWeekly<T>(
  points: T[],
  anchorDate: string | undefined,
  getDate: (point: T) => string
): T[] {
  if (points.length === 0) return points;
  const anchor = new Date((anchorDate ?? getDate(points[0])) + "T00:00:00").getTime();
  const byWeek = new Map<number, T>();
  for (const point of points) {
    const t = new Date(getDate(point) + "T00:00:00").getTime();
    const week = Math.floor(Math.round((t - anchor) / DAY_MS) / 7);
    byWeek.set(week, point); // later points in the same week replace earlier ones
  }
  return [...byWeek.entries()].sort((a, b) => a[0] - b[0]).map(([, p]) => p);
}
