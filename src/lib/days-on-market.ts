export interface FirstLookFields {
  first_look: boolean;
}

function daysBetween(start: Date, end: Date): number {
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
}

/**
 * Days on market, counted from list_date. Returns null while the listing is
 * in First Look — DOM doesn't start until it goes fully active, at which point
 * list_date is set to the go-active date. listDate/pendingDate are plain
 * "YYYY-MM-DD" date strings (as stored in the listings table).
 */
export function effectiveDaysOnMarket(
  listing: FirstLookFields & { list_date: string | null; pending_date?: string | null }
): number | null {
  if (listing.first_look || !listing.list_date) return null;
  const start = new Date(listing.list_date + "T00:00:00");
  const end = listing.pending_date ? new Date(listing.pending_date + "T00:00:00") : new Date();
  return daysBetween(start, end);
}

/** Today's date as a local "YYYY-MM-DD" string. */
export function todayDateString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
