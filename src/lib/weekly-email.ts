// Weekly seller update email. Spec: Claude Doc "Weekly Seller Update:
// Template and Rules". The wording lives here, in code, so every week reads
// the same; nothing in this file is written by an LLM at run time.
//
// Rules this file enforces (numbers match the spec's Rules list):
//  1. Same sections, same order, zeros shown. Open house section only in
//     weeks with an open house; open houses are not in the summary table.
//  2. Buyer showings lead; agent previews get their own row.
//  3. Feedback quoted word for word (display_feedback), only where
//     feedback_visible is on, i.e. what the client can see on the tracker.
//  4. No online views. 5. No offers, no price. 7. No private notes
//     (listing_notes and raw_feedback are never read here).
// 10. No em dashes in template text (agent quotes are left as written).
//     Dates in the body use the 11/2 format.

import { cumulativeDaysOnMarket, effectiveDaysOnMarket, isRelisted } from "./days-on-market";

export const NEXT_STEPS_PLACEHOLDER = "TYPE NEXT STEPS HERE";
export const KELLY_EMAIL = "kelly.aufhammer@compass.com";
export const WILL_EMAIL = "will.aufhammer@compass.com";
export const CLIENT_BASE_URL = "https://listings.aufhammerhomes.com";

// Colors from the tracker (Tailwind v4 gray-900 text, plus the gray and
// line colors the tracker code uses directly).
const TEXT = "#101828";
const GRAY = "#6b7280";
const LINE = "#e5e7eb";
const LINE_DARK = "#d1d5db";

export interface EmailListing {
  id: string;
  slug: string;
  property_address: string;
  status: string;
  list_date: string | null;
  pending_date?: string | null;
  sold_date?: string | null;
  first_look: boolean;
  prior_days_on_market?: number | null;
}

export interface EmailSeller {
  first_name: string;
  last_name?: string | null;
  email?: string | null;
  sort_order?: number | null;
}

export interface EmailEntry {
  date: string; // YYYY-MM-DD
  type: string; // buyer_showing | agent_preview | open_house
  agent_name?: string | null;
  buyer_packet_requested?: boolean | null;
  display_feedback?: string | null;
  feedback_visible?: boolean | null;
  open_house_groups?: number | null;
  open_house_disclosure_requests?: number | null;
}

export interface WeeklyEmail {
  subject: string;
  to: string[];
  cc: string[];
  html: string;
  text: string;
  /** Problems Will should know about before sending (missing emails etc). */
  warnings: string[];
  weekStart: string;
  weekEnd: string;
}

// ── Dates ────────────────────────────────────────────────────────────────

/** Today's date in Seattle as YYYY-MM-DD. */
export function pacificToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function parse(d: string): Date {
  return new Date(d + "T12:00:00Z");
}

export function addDays(d: string, n: number): string {
  const t = parse(d);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}

/** The Monday on or before the given date. */
export function mondayOnOrBefore(d: string): string {
  const dow = parse(d).getUTCDay(); // 0 Sun .. 6 Sat
  return addDays(d, -((dow + 6) % 7));
}

/** Email for Monday `sendDate` covers the previous Monday through Sunday. */
export function weekFor(sendDate: string): { weekStart: string; weekEnd: string } {
  return { weekStart: addDays(sendDate, -7), weekEnd: addDays(sendDate, -1) };
}

/** 11/2 */
function shortDate(d: string): string {
  const t = parse(d);
  return `${t.getUTCMonth() + 1}/${t.getUTCDate()}`;
}

/** Sunday 11/8 */
function dayAndDate(d: string): string {
  const day = parse(d).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
  return `${day} ${shortDate(d)}`;
}

/** November 9 (subject line only, per the spec's example). */
function monthDay(d: string): string {
  return parse(d).toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" });
}

// ── Text helpers ─────────────────────────────────────────────────────────

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

const isShowing = (e: EmailEntry) => e.type === "buyer_showing" || e.type === "agent_preview";
const hasVisibleFeedback = (e: EmailEntry) =>
  !!e.feedback_visible && !!e.display_feedback && e.display_feedback.trim() !== "";

function disclosureCount(entries: EmailEntry[]): number {
  return entries.reduce((sum, e) => {
    if (e.type === "open_house") return sum + (e.open_house_disclosure_requests ?? 0);
    return sum + (isShowing(e) && e.buyer_packet_requested ? 1 : 0);
  }, 0);
}

// ── Builder ──────────────────────────────────────────────────────────────

export function buildWeeklyEmail(opts: {
  listing: EmailListing;
  sellers: EmailSeller[];
  entries: EmailEntry[];
  sendDate: string; // the Monday, YYYY-MM-DD
  /** Test mode: To = Will only, no CC. */
  testMode?: boolean;
}): WeeklyEmail {
  const { listing, entries, sendDate, testMode = true } = opts;
  const sellers = [...opts.sellers].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const { weekStart, weekEnd } = weekFor(sendDate);
  const warnings: string[] = [];

  const sellerEmails = sellers.map((s) => s.email?.trim()).filter((e): e is string => !!e);
  if (sellers.length === 0) warnings.push("No sellers on this listing.");
  else if (sellerEmails.length < sellers.length) warnings.push("A seller is missing an email address.");

  const firstNames = sellers.map((s) => s.first_name.trim()).filter(Boolean);
  const greetingName = firstNames.length ? joinNames(firstNames) : "there";

  const upToEnd = entries.filter((e) => e.date <= weekEnd);
  const thisWeek = upToEnd.filter((e) => e.date >= weekStart);

  const count = (list: EmailEntry[], type: string) => list.filter((e) => e.type === type).length;
  const rows = {
    showings: [count(thisWeek, "buyer_showing"), count(upToEnd, "buyer_showing")],
    disclosures: [disclosureCount(thisWeek), disclosureCount(upToEnd)],
    previews: [count(thisWeek, "agent_preview"), count(upToEnd, "agent_preview")],
  };

  const weekShowings = thisWeek.filter(isShowing);
  const feedback = weekShowings
    .filter(hasVisibleFeedback)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)); // newest first
  const waitingCount = weekShowings.length - feedback.length;
  const showFeedbackSection = rows.showings[0] > 0 || feedback.length > 0;

  const openHouses = thisWeek
    .filter((e) => e.type === "open_house")
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  const dom = effectiveDaysOnMarket(listing, sendDate);
  const cdom = cumulativeDaysOnMarket(listing, sendDate);
  let domLine: string | null = null;
  if (dom !== null) {
    domLine = isRelisted(listing) ? `DOM: ${dom} | CDOM: ${cdom}` : `DOM: ${dom}`;
  }

  const clientUrl = `${CLIENT_BASE_URL}/${listing.slug}`;
  const subject = `${listing.property_address}: weekly update, ${monthDay(sendDate)}`;

  // ── HTML ───────────────────────────────────────────────────────────────
  const P = `margin:0 0 12px`;
  const H = `margin:24px 0 8px;font-size:13px;letter-spacing:1px`;
  const heading = (t: string) => `<p style="${H}"><b>${esc(t.toUpperCase())}</b></p>`;
  const tr = (label: string, [wk, total]: number[], gray = false, last = false) => {
    const c = gray ? ` style="color:${GRAY}"` : "";
    const border = last ? "" : ` style="border-bottom:1px solid ${LINE}"`;
    const wkCell = gray ? `<td${c}>${wk}</td>` : `<td><b>${wk}</b></td>`;
    return `<tr${border}><td${c}>${label}</td>${wkCell}<td${c}>${total}</td></tr>`;
  };

  const h: string[] = [];
  h.push(`<div style="font-family:Arial,Helvetica,sans-serif;color:${TEXT};font-size:15px;line-height:1.5;max-width:600px;margin:0;padding:0">`);
  h.push(`<p style="${P}">Hi ${esc(greetingName)},</p>`);
  h.push(`<p style="${P}">Here&#39;s your weekly update for ${esc(listing.property_address)}, covering ${shortDate(weekStart)} through ${shortDate(weekEnd)}.</p>`);

  h.push(heading("This week at a glance"));
  h.push(`<table cellpadding="8" cellspacing="0" style="border-collapse:collapse;width:100%">`);
  h.push(`<tr style="border-bottom:1px solid ${LINE_DARK}"><td></td><td style="color:${GRAY};font-size:13px">This week</td><td style="color:${GRAY};font-size:13px">Since going live</td></tr>`);
  h.push(tr("Buyer showings", rows.showings));
  h.push(tr("Disclosure requests", rows.disclosures));
  h.push(tr("Agent previews", rows.previews, true, true));
  h.push(`</table>`);
  if (domLine) h.push(`<p style="margin:12px 0">${domLine}</p>`);

  if (showFeedbackSection) {
    h.push(heading("Showing feedback"));
    if (feedback.length) {
      h.push(`<ul style="margin:0 0 12px;padding-left:20px">`);
      for (const e of feedback) {
        const who = e.agent_name?.trim() ? `, ${esc(e.agent_name.trim())}` : "";
        const kind = e.type === "agent_preview" ? "agent preview" : "buyer showing";
        h.push(
          `<li style="margin-bottom:10px"><b>${shortDate(e.date)}${who}</b> <span style="color:${GRAY}">(${kind})</span><br>` +
            `<span style="color:${GRAY}"><i>&quot;${esc(e.display_feedback!.trim())}&quot;</i></span></li>`
        );
      }
      h.push(`</ul>`);
    }
    const tail: string[] = [];
    if (waitingCount > 0) {
      tail.push(`We&#39;re still waiting on feedback from ${plural(waitingCount, "showing", "showings")} and will pass it along as soon as we hear back.`);
    }
    if (tail.length) h.push(`<p style="${P}">${tail.join(" ")}</p>`);
  }

  if (openHouses.length) {
    h.push(heading("Open house"));
    for (const oh of openHouses) {
      const groups = plural(oh.open_house_groups ?? 0, "group", "groups");
      const disc = plural(oh.open_house_disclosure_requests ?? 0, "disclosure request", "disclosure requests");
      h.push(`<p style="${P}">${dayAndDate(oh.date)}: ${groups}, ${disc}.</p>`);
    }
  }

  h.push(heading("What we're doing next"));
  h.push(`<p style="padding:8px;${P}"><b>&gt;&gt;&gt; ${NEXT_STEPS_PLACEHOLDER} &lt;&lt;&lt;</b></p>`);
  h.push(`<p style="${P}">You can see every showing, comment, and more anytime on <a href="${clientUrl}" style="color:${TEXT}">your listing page</a>.</p>`);
  h.push(`<p style="${P}">Never hesitate to reach out with any questions!</p>`);
  h.push(`<p style="margin:0">Cheers,<br>Will + Kelly</p>`);
  h.push(`</div>`);
  // Will's signature is not part of this HTML: the Gmail draft is created
  // with includeSignature, so Gmail appends his live saved signature (the
  // connector strips externally hosted images like the logo from htmlBody).
  const html = h.join("\n");

  // ── Plain text (Gmail shows HTML; this is the fallback part) ───────────
  const t: string[] = [];
  t.push(`Hi ${greetingName},`, "");
  t.push(`Here's your weekly update for ${listing.property_address}, covering ${shortDate(weekStart)} through ${shortDate(weekEnd)}.`, "");
  t.push("THIS WEEK AT A GLANCE (this week / since going live)");
  t.push(`Buyer showings: ${rows.showings[0]} / ${rows.showings[1]}`);
  t.push(`Disclosure requests: ${rows.disclosures[0]} / ${rows.disclosures[1]}`);
  t.push(`Agent previews: ${rows.previews[0]} / ${rows.previews[1]}`);
  if (domLine) t.push(domLine);
  if (showFeedbackSection) {
    t.push("", "SHOWING FEEDBACK");
    for (const e of feedback) {
      const who = e.agent_name?.trim() ? `, ${e.agent_name.trim()}` : "";
      const kind = e.type === "agent_preview" ? "agent preview" : "buyer showing";
      t.push(`- ${shortDate(e.date)}${who} (${kind}): "${e.display_feedback!.trim()}"`);
    }
    if (waitingCount > 0) t.push(`We're still waiting on feedback from ${plural(waitingCount, "showing", "showings")} and will pass it along as soon as we hear back.`);
  }
  if (openHouses.length) {
    t.push("", "OPEN HOUSE");
    for (const oh of openHouses) {
      t.push(`${dayAndDate(oh.date)}: ${plural(oh.open_house_groups ?? 0, "group", "groups")}, ${plural(oh.open_house_disclosure_requests ?? 0, "disclosure request", "disclosure requests")}.`);
    }
  }
  t.push("", "WHAT WE'RE DOING NEXT", `>>> ${NEXT_STEPS_PLACEHOLDER} <<<`, "");
  t.push(`You can see every showing, comment, and more anytime on your listing page: ${clientUrl}`, "");
  t.push("Never hesitate to reach out with any questions!", "", "Cheers,", "Will + Kelly");
  const text = t.join("\n");

  return {
    subject,
    to: testMode ? [WILL_EMAIL] : sellerEmails,
    cc: testMode ? [] : [KELLY_EMAIL],
    html,
    text,
    warnings,
    weekStart,
    weekEnd,
  };
}
