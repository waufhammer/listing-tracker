// Status changes that need more than a field write: cancelling a listing and
// relisting it. Shared by the admin editor and the connector so both follow
// the same rules.
//
// Cancel: status = 'cancelled' with a cancelled_date. Days on market stop on
// that date (see effectiveDaysOnMarket).
// Relist: a cancelled listing set back to 'active' with a new list_date. The
// days from the cancelled period are added to prior_days_on_market (unless
// the same update sets prior_days_on_market to something else by hand), and
// cancelled_date is cleared, so DOM restarts and CDOM keeps counting.

import { pacificToday } from "./weekly-email";

export const LISTING_STATUS_VALUES = ["prepping", "active", "pending", "sold", "cancelled"] as const;

type Row = Record<string, unknown>;

function daysBetween(start: string, end: string): number {
  const ms = new Date(end + "T00:00:00").getTime() - new Date(start + "T00:00:00").getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

/**
 * Check a listing update against the cancel/relist rules and fill in the
 * derived fields. `before` is the listing as stored; `updates` is what the
 * caller wants to change. Returns the updates to save, or an error to show.
 */
export function applyStatusRules(before: Row, updates: Row): { updates: Row } | { error: string } {
  const out: Row = { ...updates };
  const was = String(before.status ?? "");
  const next = String(out.status ?? was);
  const today = pacificToday();

  if (next === "cancelled") {
    const cancelled = (out.cancelled_date ?? before.cancelled_date) as string | null | undefined;
    if (!cancelled) return { error: "A cancelled_date is required when status is cancelled." };
    if (cancelled > today) return { error: "cancelled_date can't be in the future." };
    const listDate = (out.list_date ?? before.list_date) as string | null | undefined;
    if (listDate && cancelled < listDate) return { error: "cancelled_date can't be before the list date." };
    return { updates: out };
  }

  // Leaving Cancelled for any other status: the cancel date no longer applies.
  if (before.cancelled_date || out.cancelled_date) out.cancelled_date = null;

  if (was === "cancelled" && next === "active") {
    const oldList = before.list_date as string | null | undefined;
    const newList = out.list_date as string | null | undefined;
    const cancelledOn = before.cancelled_date as string | null | undefined;
    if (!newList || newList === oldList) {
      return { error: "To relist, set list_date to the relist date." };
    }
    if (newList > today) return { error: "list_date can't be in the future." };
    if (cancelledOn && newList < cancelledOn) return { error: "The relist date can't be before the cancel date." };
    const priorBefore = Number(before.prior_days_on_market ?? 0);
    const priorGiven = out.prior_days_on_market;
    const setByHand = priorGiven !== undefined && priorGiven !== null && Number(priorGiven) !== priorBefore;
    if (!setByHand && oldList && cancelledOn && !before.first_look) {
      out.prior_days_on_market = priorBefore + daysBetween(oldList, cancelledOn);
    }
  }

  return { updates: out };
}
