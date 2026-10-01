export interface FirstLookFields {
  first_look: boolean;
  first_look_started_at: string | null;
  first_look_days_banked: number | null;
}

function daysBetween(start: Date, end: Date): number {
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
}

/** Days excluded from DOM because of First Look: banked days from past
 * toggles plus the still-running current interval, if any. */
export function firstLookExcludedDays(listing: FirstLookFields, now = new Date()): number {
  const banked = listing.first_look_days_banked ?? 0;
  if (listing.first_look && listing.first_look_started_at) {
    return banked + daysBetween(new Date(listing.first_look_started_at), now);
  }
  return banked;
}

/**
 * Days on market, excluding any time spent in First Look. listDate/pendingDate
 * are plain "YYYY-MM-DD" date strings (as stored in the listings table).
 */
export function effectiveDaysOnMarket(
  listing: FirstLookFields & { list_date: string | null; pending_date?: string | null }
): number | null {
  if (!listing.list_date) return null;
  const start = new Date(listing.list_date + "T00:00:00");
  const end = listing.pending_date ? new Date(listing.pending_date + "T00:00:00") : new Date();
  const raw = daysBetween(start, end);
  return Math.max(0, raw - firstLookExcludedDays(listing));
}
