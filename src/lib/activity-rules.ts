// Rules shared by every writer of activity_entries (MCP and admin).
import { pacificToday } from "./weekly-email";

type Row = Record<string, unknown>;

/** Activity and online views can't be logged for a day that hasn't happened. */
export function futureDateError(date: unknown): string | null {
  if (typeof date !== "string") return null;
  const today = pacificToday();
  return date > today ? `Not saved. ${date} is in the future (today is ${today}, Pacific).` : null;
}

const filled = (v: unknown) => typeof v === "string" && v.trim() !== "";

/**
 * follow_up_sent: true also records follow_up_sent_at, and saving feedback
 * records feedback_received_at, unless already set or given explicitly.
 * Mutates and returns `row`.
 */
export function stampActivityTimes(row: Row, before?: Row | null): Row {
  const now = new Date().toISOString();
  if (row.follow_up_sent === true && row.follow_up_sent_at === undefined && !before?.follow_up_sent_at) {
    row.follow_up_sent_at = now;
  }
  if ((filled(row.raw_feedback) || filled(row.display_feedback)) && row.feedback_received_at === undefined && !before?.feedback_received_at) {
    row.feedback_received_at = now;
  }
  return row;
}
