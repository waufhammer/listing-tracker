// Parses Supra keybox emails. Supra actually sends TWO email types per
// keybox event — the PRD only anticipated one:
//   1. "New Showing Notification" (access begins) — has the "began"
//      timestamp, which is all v1 matching needs. Parsed into a
//      `keybox_access` event.
//   2. "End of Showing Notification" (access ends) — recognized so it
//      doesn't misfire into needs_review, but intentionally produces no
//      row: it adds no info the matching logic in this version uses.
// Both are plain-text single-paragraph bodies (unlike ShowingTime's HTML),
// so plain regex is sufficient — no HTML parsing needed here.
import { pacificWallTimeToUTC } from "../timezone";
import type { ParseResult } from "./types";

const BEGAN_PATTERN =
  /the showing by\s+(.+?)\s*\(([^)]*)\)(?:\s*\(([^)]*)\))?\s*at\s+(.+?)\s*\(keybox#\s*([\w-]+)\)\s*(?:that\s+)?began\s+(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})\s*([ap]m)/i;

export function parseSupraEmail(text: string): ParseResult {
  const t = text.replace(/\s+/g, " ").trim();

  if (/has ended|end of showing notification/i.test(t)) {
    if (!/began/i.test(t)) {
      return {
        ok: false,
        reason: "Looked like a Supra 'End of Showing Notification' but didn't contain the expected 'began <date time>' text.",
      };
    }
    return {
      ok: true,
      eventType: "ignorable",
      reason: "Supra 'End of Showing Notification' — no new info needed for v1 matching (only the 'began' timestamp from the New Showing Notification is used).",
    };
  }

  const m = t.match(BEGAN_PATTERN);
  if (!m) {
    return {
      ok: false,
      reason: "Could not find the 'The showing by <agent> (...) at <address> (KeyBox# ...) began <date> <time>' pattern in the Supra email.",
    };
  }

  const [, agentName, contact1, contact2, address, keyboxId, moStr, dayStr, yearStr, hourStr, minuteStr, ampm] = m;
  const combinedContact = [contact1, contact2].filter(Boolean).join(" ");
  const emailMatch = combinedContact.match(/[\w.+-]+@[\w.-]+\.[a-z]+/i);
  const phoneMatch = combinedContact.match(/\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/);

  let hour = Number(hourStr) % 12;
  if (ampm.toLowerCase() === "pm") hour += 12;
  const accessTime = pacificWallTimeToUTC(Number(yearStr), Number(moStr) - 1, Number(dayStr), hour, Number(minuteStr));

  return {
    ok: true,
    eventType: "keybox_access",
    rawAddress: address.trim(),
    agentName: agentName.trim(),
    agentPhone: phoneMatch ? phoneMatch[0] : null,
    agentEmail: emailMatch ? emailMatch[0] : null,
    accessTime,
    keyboxId: keyboxId.trim(),
  };
}
