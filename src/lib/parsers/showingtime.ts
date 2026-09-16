// Parses ShowingTime "SHOWING CONFIRMED" emails. Designed against one real
// captured sample (see /Users/willaufhammer/Downloads/showing-verification-prd.md
// and the session that produced this feature) — the email's exact markup
// is unknown beyond that sample, so rather than target specific CSS
// selectors (which would break on any markup change), this flattens the
// HTML to a line-per-block text approximation and runs label-anchored
// regex against that. Expect this to need adjustment once more real
// samples flow through the manual ingest tool.
import * as cheerio from "cheerio";
import { pacificWallTimeToUTC } from "../timezone";
import type { ParseResult } from "./types";

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

function htmlToLines(html: string): string[] {
  const $ = cheerio.load(html);
  $("script, style").remove();
  $("br").replaceWith("\n");
  $("p, div, td, tr, li, h1, h2, h3, h4, h5, table").each((_, el) => {
    $(el).append("\n");
  });
  return $.root()
    .text()
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function findIndex(lines: string[], pattern: RegExp, from = 0): number {
  for (let i = from; i < lines.length; i++) {
    if (pattern.test(lines[i])) return i;
  }
  return -1;
}

export function parseShowingTimeEmail(html: string): ParseResult {
  const lines = htmlToLines(html);

  const confirmedIdx = findIndex(lines, /showing confirmed/i);
  if (confirmedIdx === -1) {
    return {
      ok: false,
      reason: "Could not find a 'Showing Confirmed' header — not a recognized ShowingTime confirmation email.",
    };
  }

  // The two lines right after the header are "<street>" then
  // "<City>, <State> <zip>".
  const street = lines[confirmedIdx + 1];
  const cityLine = lines[confirmedIdx + 2];
  const cityMatch = cityLine?.match(/^([A-Za-z .]+),\s*([A-Za-z]+)\s+(\d{5})/);
  if (!street || !cityMatch) {
    return {
      ok: false,
      reason: `Could not parse the address block after 'Showing Confirmed' (got "${street ?? ""}" / "${cityLine ?? ""}").`,
    };
  }
  const rawAddress = `${street}, ${cityMatch[0]}`;

  // "Appointment Details" section: a weekday/date line ("Saturday, August
  // 15, 2026") followed by a time-range line ("10:45 AM - 11:00 AM").
  const apptIdx = findIndex(lines, /appointment details/i, confirmedIdx);
  const dateIdx = apptIdx === -1 ? -1 : findIndex(lines, /^[a-z]+,\s+[a-z]+\s+\d{1,2},\s*\d{4}$/i, apptIdx);
  if (dateIdx === -1) {
    return { ok: false, reason: "Could not find the appointment date line under 'Appointment Details'." };
  }
  const dateMatch = lines[dateIdx].match(/([a-z]+)\s+(\d{1,2}),\s*(\d{4})/i);
  const timeLine = lines[dateIdx + 1];
  const timeMatch = timeLine?.match(/(\d{1,2}):(\d{2})\s*([ap]m)/i);
  if (!dateMatch || !timeMatch) {
    return {
      ok: false,
      reason: `Could not parse the appointment date/time (got "${lines[dateIdx]}" / "${timeLine ?? ""}").`,
    };
  }
  const monthIdx = MONTHS.indexOf(dateMatch[1].toLowerCase());
  if (monthIdx === -1) {
    return { ok: false, reason: `Unrecognized month name "${dateMatch[1]}".` };
  }
  let hour = Number(timeMatch[1]) % 12;
  if (timeMatch[3].toLowerCase() === "pm") hour += 12;
  const scheduledTime = pacificWallTimeToUTC(Number(dateMatch[3]), monthIdx, Number(dateMatch[2]), hour, Number(timeMatch[2]));

  // Prefer the "Buyer's Agent Details" block (explicitly labeled, includes
  // phone/email) over the terser Appointment Details summary rows.
  let agentName: string | null = null;
  let agentBrokerage: string | null = null;
  let agentPhone: string | null = null;
  let agentEmail: string | null = null;

  const bizIdx = findIndex(lines, /buyer'?s agent details/i, confirmedIdx);
  if (bizIdx !== -1) {
    agentName = lines[bizIdx + 1] ?? null;
    agentBrokerage = lines[bizIdx + 2] ?? null;
    for (let i = bizIdx + 3; i < Math.min(bizIdx + 8, lines.length); i++) {
      const line = lines[i];
      if (/buyer'?s agent details|free downloadable|for questions regarding/i.test(line)) break;
      const emailMatch = line.match(/[\w.+-]+@[\w.-]+\.[a-z]+/i);
      if (emailMatch && !agentEmail) agentEmail = emailMatch[0];
      const phoneMatch = line.match(/\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/);
      if (phoneMatch && !agentPhone && !/office main line/i.test(line)) agentPhone = phoneMatch[0];
    }
  } else {
    agentName = lines[dateIdx + 2] ?? null;
    agentBrokerage = lines[dateIdx + 3] ?? null;
  }

  return {
    ok: true,
    eventType: "showing_confirmed",
    rawAddress,
    agentName,
    agentBrokerage,
    agentPhone,
    agentEmail,
    scheduledTime,
  };
}
