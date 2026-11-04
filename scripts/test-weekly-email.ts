// Run: npx tsx scripts/test-weekly-email.ts
// Checks the weekly email against the spec's sample week (made-up data).
import assert from "node:assert/strict";
import { buildWeeklyEmail, mondayOnOrBefore, weekFor } from "../src/lib/weekly-email";

const listing = { id: "x", slug: "sample", property_address: "2568 28th Ave W", status: "active",
  list_date: "2026-10-28", first_look: false, prior_days_on_market: 0 };
const sellers = [{ first_name: "Sarah", email: "s@example.com", sort_order: 0 }, { first_name: "Tom", email: "t@example.com", sort_order: 1 }];
const entries = [
  { date: "2026-10-30", type: "buyer_showing" },
  { date: "2026-10-31", type: "agent_preview", display_feedback: "private-ish", feedback_visible: false },
  { date: "2026-11-03", type: "buyer_showing", agent_name: "Jenna Park", feedback_visible: true, display_feedback: "Buyers loved the light — and the yard." , buyer_packet_requested: true},
  { date: "2026-11-05", type: "buyer_showing", agent_name: "Marcus Lee", feedback_visible: true, display_feedback: "Great house, but my clients need a bigger garage." },
  { date: "2026-11-06", type: "agent_preview", agent_name: "Priya Shah", feedback_visible: true, display_feedback: "Beautifully presented." },
  { date: "2026-11-07", type: "buyer_showing", agent_name: "No Reply", feedback_visible: false, display_feedback: "hidden text" },
  { date: "2026-11-08", type: "open_house", open_house_groups: 11, open_house_disclosure_requests: 2 },
  { date: "2026-11-09", type: "buyer_showing" }, // after the week: excluded everywhere
];

assert.equal(mondayOnOrBefore("2026-11-11"), "2026-11-09");
assert.deepEqual(weekFor("2026-11-09"), { weekStart: "2026-11-02", weekEnd: "2026-11-08" });

const e = buildWeeklyEmail({ listing, sellers, entries, sendDate: "2026-11-09", testMode: true });
assert.equal(e.subject, "2568 28th Ave W: weekly update, November 9");
assert.deepEqual(e.to, ["will.aufhammer@compass.com"]);
assert.deepEqual(e.cc, []);
assert.match(e.html, /Hi Sarah and Tom,/);
assert.match(e.html, /covering 11\/2 through 11\/8\./);
assert.match(e.html, /<td>Buyer showings<\/td><td><b>3<\/b><\/td><td>4<\/td>/);
assert.match(e.html, /<td>Disclosure requests<\/td><td><b>3<\/b><\/td><td>3<\/td>/);
assert.match(e.html, /Agent previews<\/td><td style="color:#6b7280">1<\/td><td style="color:#6b7280">2<\/td>/);
assert.match(e.html, /DOM: 12<\/p>/);
assert.doesNotMatch(e.html, /CDOM/);
// newest first, quoted word for word, em dash kept inside the quote
const order = ["Priya Shah", "Marcus Lee", "Jenna Park"].map((n) => e.html.indexOf(n));
assert.ok(order[0] < order[1] && order[1] < order[2], "feedback newest first");
assert.match(e.html, /Buyers loved the light — and the yard\./);
assert.doesNotMatch(e.html, /hidden text|private-ish/);
assert.match(e.html, /waiting on feedback from 1 showing and/);
assert.match(e.html, /Sunday 11\/8: 11 groups, 2 disclosure requests\./);
assert.match(e.html, /TYPE NEXT STEPS HERE/);
assert.match(e.html, /href="https:\/\/listings.aufhammerhomes.com\/sample"/);
assert.doesNotMatch(e.html.replace("— and the yard", ""), /—/, "no em dashes in template text");
assert.doesNotMatch(e.html, /online views?|zillow|redfin|\boffers?\b|\bprices?\b/i, "no views, offers, or price");

// relisted: CDOM shown; quiet week: zeros, no feedback or open house section
const quiet = buildWeeklyEmail({ listing: { ...listing, prior_days_on_market: 40 }, sellers, entries: [], sendDate: "2026-11-09", testMode: false });
assert.match(quiet.html, /DOM: 12 \| CDOM: 52/);
assert.match(quiet.html, /<td>Buyer showings<\/td><td><b>0<\/b><\/td><td>0<\/td>/);
assert.doesNotMatch(quiet.html, /SHOWING FEEDBACK|OPEN HOUSE/);
assert.deepEqual(quiet.to, ["s@example.com", "t@example.com"]);
assert.deepEqual(quiet.cc, ["kelly.aufhammer@compass.com"]);
assert.deepEqual(quiet.warnings, []);

// First Look: no DOM line
const fl = buildWeeklyEmail({ listing: { ...listing, first_look: true }, sellers, entries, sendDate: "2026-11-09" });
assert.doesNotMatch(fl.html, /DOM:/);

console.log("weekly email: all checks passed");
