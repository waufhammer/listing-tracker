// Data layer for the /api/mcp connector: Claude working on the tracker with
// Will. Reads everything Will can see in admin. Writes add or edit rows only;
// nothing here deletes. Every write tool requires `confirmed: true`, which
// Claude may only send after Will has approved a summary of the change.

import { supabaseAdmin } from "@/lib/supabase";
import { cumulativeDaysOnMarket, effectiveDaysOnMarket, isRelisted } from "@/lib/days-on-market";
import { NEXT_STEPS_PLACEHOLDER, mondayOnOrBefore, pacificToday, weekFor, CLIENT_BASE_URL } from "@/lib/weekly-email";
import { loadWeeklyEmail } from "@/lib/weekly-email-data";

export const ACTIVITY_TYPES = ["buyer_showing", "agent_preview", "open_house"] as const;
export const LISTING_STATUSES = ["prepping", "active", "pending", "sold"] as const;
const LOGGED_BY = "claude";

type Row = Record<string, unknown>;
type Err = { error: string; candidates?: unknown[] };

const LISTING_FIELDS =
  "id, slug, client_name, property_address, status, list_date, pending_date, sold_date, first_look, prior_days_on_market, list_price, sale_price, offers_received, property_type";

function listingSummary(l: Row) {
  const listing = l as Parameters<typeof cumulativeDaysOnMarket>[0] & Row;
  const dom = effectiveDaysOnMarket(listing);
  return {
    ...l,
    dom,
    cdom: isRelisted(listing) ? cumulativeDaysOnMarket(listing) : null,
    client_link: `${CLIENT_BASE_URL}/${l.slug}`,
    // Sellers open the page with a private /s/<token> link (in the weekly
    // emails); the token itself is never returned here.
    client_link_active: true,
  };
}

/**
 * Find exactly one listing by id, slug, or part of the street address.
 * Ambiguous or missing matches return an error with candidates, so Claude
 * asks Will instead of guessing.
 */
export async function resolveListing(ref: string): Promise<{ listing: Row } | Err> {
  const q = ref.trim();
  const { data, error } = await supabaseAdmin.from("listings").select(LISTING_FIELDS);
  if (error) return { error: error.message };
  const all = (data ?? []) as Row[];
  const norm = (s: unknown) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const exact = all.filter((l) => l.id === q || l.slug === q.toLowerCase());
  if (exact.length === 1) return { listing: exact[0] };
  const nq = norm(q);
  const matches = all.filter((l) => norm(l.property_address).includes(nq) || norm(l.client_name).includes(nq));
  if (matches.length === 1) return { listing: matches[0] };
  // Several matches (e.g. a sold and an active listing on the same street):
  // never pick one. Return the candidates so Claude asks Will.
  const candidates = (matches.length ? matches : all).map((l) => ({
    id: l.id,
    property_address: l.property_address,
    status: l.status,
  }));
  return {
    error: matches.length
      ? `"${ref}" matches ${matches.length} listings. Ask Will which one, then use its id.`
      : `No listing matches "${ref}". Ask Will which listing he means; do not guess.`,
    candidates,
  };
}

/** Writes take the listing's uuid only, never an address, so a write can
 *  never land on a guessed listing. */
async function listingById(id: string): Promise<{ listing: Row } | Err> {
  const { data, error } = await supabaseAdmin.from("listings").select(LISTING_FIELDS).eq("id", id).maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: `No listing with id ${id}. Get the id from list_listings or get_listing.` };
  return { listing: data as Row };
}

// ── Reads ────────────────────────────────────────────────────────────────

export async function listListings(status?: string) {
  let q = supabaseAdmin.from("listings").select(LISTING_FIELDS).order("property_address");
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) return { error: error.message };
  return { listings: (data ?? []).map((l) => listingSummary(l as Row)) };
}

export async function getListing(ref: string) {
  const r = await resolveListing(ref);
  if ("error" in r) return r;
  const id = r.listing.id as string;
  const [sellers, entries, views, pageViews] = await Promise.all([
    supabaseAdmin.from("listing_sellers").select("id, first_name, last_name, email, sort_order").eq("listing_id", id).order("sort_order"),
    supabaseAdmin.from("activity_entries").select("type, date, feedback_visible, display_feedback, raw_feedback").eq("listing_id", id),
    supabaseAdmin.from("platform_views").select("date, zillow_views, redfin_views, compass_views").eq("listing_id", id).order("date", { ascending: false }).limit(1),
    supabaseAdmin.from("page_views").select("viewed_at").eq("listing_id", id).order("viewed_at", { ascending: false }).limit(1),
  ]);
  const e = (entries.data ?? []) as Row[];
  const showings = e.filter((x) => x.type === "buyer_showing" || x.type === "agent_preview");
  return {
    listing: listingSummary(r.listing),
    sellers: sellers.data ?? [],
    totals: {
      buyer_showings: e.filter((x) => x.type === "buyer_showing").length,
      agent_previews: e.filter((x) => x.type === "agent_preview").length,
      open_houses: e.filter((x) => x.type === "open_house").length,
      showings_without_any_feedback: showings.filter((x) => !x.raw_feedback && !x.display_feedback).length,
      feedback_hidden_from_client: showings.filter((x) => (x.raw_feedback || x.display_feedback) && !x.feedback_visible).length,
    },
    latest_platform_views: views.data?.[0] ?? null,
    client_link_last_viewed_at: pageViews.data?.[0]?.viewed_at ?? null,
  };
}

export async function getActivity(ref: string, from?: string, to?: string) {
  const r = await resolveListing(ref);
  if ("error" in r) return r;
  let q = supabaseAdmin
    .from("activity_entries")
    .select("id, date, type, agent_name, is_repeat_visit, follow_up_sent, buyer_packet_requested, raw_feedback, display_feedback, feedback_visible, open_house_groups, open_house_disclosure_requests, logged_by, created_at")
    .eq("listing_id", r.listing.id as string)
    .order("date", { ascending: false });
  if (from) q = q.gte("date", from);
  if (to) q = q.lte("date", to);
  const { data, error } = await q;
  if (error) return { error: error.message };
  return {
    listing: { id: r.listing.id, property_address: r.listing.property_address },
    note: "raw_feedback is private (never shown to the client). display_feedback is what the client sees, and only when feedback_visible is true.",
    entries: data ?? [],
  };
}

export async function getPlatformViews(ref: string) {
  const r = await resolveListing(ref);
  if ("error" in r) return r;
  const { data, error } = await supabaseAdmin
    .from("platform_views")
    .select("id, date, zillow_views, redfin_views, compass_views, logged_by")
    .eq("listing_id", r.listing.id as string)
    .order("date", { ascending: false });
  if (error) return { error: error.message };
  return { listing: { id: r.listing.id, property_address: r.listing.property_address }, snapshots: data ?? [] };
}

export async function getClientLinkViews(ref: string, limit = 50) {
  const r = await resolveListing(ref);
  if ("error" in r) return r;
  const { data, error } = await supabaseAdmin
    .from("page_views")
    .select("viewed_at, user_agent, via")
    .eq("listing_id", r.listing.id as string)
    .order("viewed_at", { ascending: false })
    .limit(limit);
  if (error) return { error: error.message };
  return {
    listing: { id: r.listing.id, property_address: r.listing.property_address },
    note: "Opens of the client page, newest first. via: 'link' = opened the private link from an email, 'cookie' = returning visit on a device that opened it before, 'legacy_slug' = old /<slug> link during the grace period. Will's own visits while logged into admin are not logged. Link previews and bots are not logged.",
    views: data ?? [],
  };
}

function resolveSendDate(sendDate?: string): string {
  return mondayOnOrBefore(sendDate ?? pacificToday());
}

export async function getWeeklyEmails(opts: { listing?: string; send_date?: string; test_mode: boolean }) {
  const sendDate = resolveSendDate(opts.send_date);
  let ids: string[];
  if (opts.listing) {
    const r = await resolveListing(opts.listing);
    if ("error" in r) return r;
    if (r.listing.status !== "active") return { error: "Weekly emails are only for Active listings." };
    ids = [r.listing.id as string];
  } else {
    const { data, error } = await supabaseAdmin.from("listings").select("id").eq("status", "active");
    if (error) return { error: error.message };
    ids = (data ?? []).map((x) => x.id as string);
  }
  const { data: drafts } = await supabaseAdmin
    .from("weekly_update_drafts")
    .select("listing_id, gmail_draft_id, test_mode, created_at")
    .eq("send_date", sendDate);
  const emails = [];
  for (const id of ids) {
    const { email, error } = await loadWeeklyEmail(id, sendDate, { testMode: opts.test_mode });
    const existing = (drafts ?? []).find((d) => d.listing_id === id && d.test_mode === opts.test_mode) ?? null;
    emails.push({ listing_id: id, error, existing_draft: existing, ...(email ?? {}) });
  }
  return {
    send_date: sendDate,
    ...weekFor(sendDate),
    test_mode: opts.test_mode,
    instructions:
      "Create one Gmail draft per email: subject, to, cc exactly as given, htmlBody = html and body = text exactly as given (do not reword), and includeSignature: true so Gmail adds Will's signature. Skip any listing with existing_draft set. After creating each draft, call record_weekly_draft. Never send.",
    emails,
  };
}

export async function recordWeeklyDraft(input: { listing_id: string; send_date: string; gmail_draft_id: string; test_mode: boolean }) {
  const { data, error } = await supabaseAdmin
    .from("weekly_update_drafts")
    .upsert(
      { listing_id: input.listing_id, send_date: resolveSendDate(input.send_date), gmail_draft_id: input.gmail_draft_id, test_mode: input.test_mode },
      { onConflict: "listing_id,send_date" }
    )
    .select()
    .single();
  if (error) return { error: error.message };
  return {
    recorded: data,
    saved_summary: `Recorded weekly draft: ${await addressOf(input.listing_id)} | week of ${data.send_date}${input.test_mode ? " (test)" : ""}`,
  };
}

/** Monday 8am checklist: what's missing before the noon drafts. */
export async function getWeeklyChecklist(send_date?: string) {
  const sendDate = resolveSendDate(send_date);
  const { weekStart, weekEnd } = weekFor(sendDate);
  const { data: listings, error } = await supabaseAdmin.from("listings").select(LISTING_FIELDS).eq("status", "active");
  if (error) return { error: error.message };
  const out = [];
  for (const l of (listings ?? []) as Row[]) {
    const [entries, sellers] = await Promise.all([
      supabaseAdmin
        .from("activity_entries")
        .select("id, date, type, agent_name, raw_feedback, display_feedback, feedback_visible, open_house_groups")
        .eq("listing_id", l.id as string)
        .gte("date", weekStart)
        .lte("date", weekEnd),
      supabaseAdmin.from("listing_sellers").select("first_name, email").eq("listing_id", l.id as string),
    ]);
    const e = (entries.data ?? []) as Row[];
    const showings = e.filter((x) => x.type === "buyer_showing" || x.type === "agent_preview");
    const s = (sellers.data ?? []) as Row[];
    out.push({
      listing_id: l.id,
      property_address: l.property_address,
      showings_without_feedback: showings
        .filter((x) => !x.raw_feedback && !x.display_feedback)
        .map((x) => ({ id: x.id, date: x.date, type: x.type, agent_name: x.agent_name })),
      feedback_not_client_visible: showings
        .filter((x) => (x.raw_feedback || x.display_feedback) && !(x.feedback_visible && x.display_feedback))
        .map((x) => ({ id: x.id, date: x.date, agent_name: x.agent_name })),
      open_houses_missing_group_count: e
        .filter((x) => x.type === "open_house" && x.open_house_groups == null)
        .map((x) => ({ id: x.id, date: x.date })),
      seller_problems: [
        ...(s.length === 0 ? ["No sellers entered"] : []),
        ...s.filter((x) => !x.email).map((x) => `${x.first_name} has no email`),
      ],
    });
  }
  return { send_date: sendDate, week_start: weekStart, week_end: weekEnd, listings: out };
}

export const PLACEHOLDER = NEXT_STEPS_PLACEHOLDER;

// ── Writes (confirmed: true required; no deletes) ────────────────────────

function needsConfirm(confirmed: boolean): Err | null {
  return confirmed
    ? null
    : { error: "Not saved. Show Will a summary of exactly what will be saved, wait for his OK, then call again with confirmed: true." };
}

function clean(obj: Row): Row {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}

// ── saved_summary: one line the agent echoes back to Will after a write ──

const TYPE_LABEL: Record<string, string> = {
  buyer_showing: "Buyer showing",
  agent_preview: "Agent preview",
  open_house: "Open house",
};

async function addressOf(listingId: unknown): Promise<string> {
  const { data } = await supabaseAdmin.from("listings").select("property_address").eq("id", String(listingId)).maybeSingle();
  return (data?.property_address as string | undefined) ?? `listing ${listingId}`;
}

/** Fields in `requested` whose saved value differs from `before`. */
function changedFields(before: Row | null, after: Row, requested: string[]): { changed: string[]; unchanged: string[] } {
  const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  const changed = requested.filter((k) => !before || !same(before[k], after[k]));
  return { changed, unchanged: requested.filter((k) => !changed.includes(k)) };
}

function summaryLine(parts: {
  action: string;
  address: string;
  entry?: Row;
  changed: string[];
  unchanged?: string[];
}): string {
  const e = parts.entry;
  const what = e
    ? [
        e.date && `${e.date}`,
        e.type && (TYPE_LABEL[String(e.type)] ?? String(e.type)),
        e.agent_name ? `agent ${e.agent_name}` : null,
      ].filter(Boolean).join(", ")
    : "";
  const fields = parts.changed.length ? `fields: ${parts.changed.join(", ")}` : "no fields changed";
  const same = parts.unchanged?.length ? ` (already the same: ${parts.unchanged.join(", ")})` : "";
  return `${parts.action}: ${parts.address}${what ? ` | ${what}` : ""} | ${fields}${same}`;
}

export async function addActivity(input: {
  listing_id: string;
  confirmed: boolean;
  type: (typeof ACTIVITY_TYPES)[number];
  date: string;
  agent_name?: string;
  is_repeat_visit?: boolean;
  follow_up_sent?: boolean;
  buyer_packet_requested?: boolean;
  raw_feedback?: string;
  display_feedback?: string;
  open_house_groups?: number;
  open_house_disclosure_requests?: number;
}) {
  const c = needsConfirm(input.confirmed);
  if (c) return c;
  const r = await listingById(input.listing_id);
  if ("error" in r) return r;
  const { listing_id: _l, confirmed: _c, ...fields } = input;
  void _l; void _c;
  const row = clean({
    ...fields,
    listing_id: r.listing.id,
    feedback_visible: false, // new feedback always starts hidden from the client
    logged_by: LOGGED_BY,
  });
  const { data, error } = await supabaseAdmin.from("activity_entries").insert(row).select().single();
  if (error) return { error: error.message };
  return {
    saved: data,
    saved_summary: summaryLine({ action: "Added activity", address: String(r.listing.property_address), entry: data, changed: Object.keys(clean(fields)) }),
    note: "Feedback (if any) is hidden from the client until Will makes it visible.",
  };
}

export async function updateActivity(input: { id: string; confirmed: boolean } & Row) {
  const c = needsConfirm(input.confirmed);
  if (c) return c;
  const { id, confirmed: _c, ...fields } = input;
  void _c;
  const updates = clean(fields);
  if (Object.keys(updates).length === 0) return { error: "Nothing to update." };
  const { data: before } = await supabaseAdmin.from("activity_entries").select().eq("id", id).maybeSingle();
  if (!before) return { error: "No activity entry with that id." };
  const { data, error } = await supabaseAdmin.from("activity_entries").update(updates).eq("id", id).select().maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "No activity entry with that id." };
  return {
    saved: data,
    saved_summary: summaryLine({ action: "Updated activity", address: await addressOf(data.listing_id), entry: data, ...changedFields(before, data, Object.keys(updates)) }),
  };
}

export async function addPlatformViews(input: {
  listing_id: string;
  confirmed: boolean;
  date: string;
  zillow_views?: number;
  redfin_views?: number;
  compass_views?: number;
}) {
  const c = needsConfirm(input.confirmed);
  if (c) return c;
  const r = await listingById(input.listing_id);
  if ("error" in r) return r;
  const row = clean({
    listing_id: r.listing.id,
    date: input.date,
    zillow_views: input.zillow_views,
    redfin_views: input.redfin_views,
    compass_views: input.compass_views,
    logged_by: LOGGED_BY,
  });
  const { data, error } = await supabaseAdmin.from("platform_views").insert(row).select().single();
  if (error) return { error: error.message };
  return {
    saved: data,
    saved_summary: summaryLine({
      action: "Added online views",
      address: String(r.listing.property_address),
      entry: { date: input.date },
      changed: ["zillow_views", "redfin_views", "compass_views"].filter((k) => row[k] !== undefined).map((k) => `${k}=${row[k]}`),
    }),
  };
}

export async function updateListing(input: { listing_id: string; confirmed: boolean } & Row) {
  const c = needsConfirm(input.confirmed);
  if (c) return c;
  const r = await listingById(input.listing_id);
  if ("error" in r) return r;
  const { listing_id: _l, confirmed: _c, ...fields } = input;
  void _l; void _c;
  const updates = clean(fields);
  if (Object.keys(updates).length === 0) return { error: "Nothing to update." };
  if (updates.status === "pending" && !updates.pending_date && !r.listing.pending_date) {
    return { error: "A pending_date is required when status is pending." };
  }
  if (updates.status === "sold" && !updates.sold_date && !r.listing.sold_date) {
    return { error: "A sold_date is required when status is sold." };
  }
  const { data, error } = await supabaseAdmin.from("listings").update(updates).eq("id", r.listing.id as string).select(LISTING_FIELDS).single();
  if (error) return { error: error.message };
  return {
    saved: listingSummary(data as Row),
    saved_summary: summaryLine({ action: "Updated listing", address: String((data as Row).property_address), ...changedFields(r.listing, data as Row, Object.keys(updates)) }),
  };
}

export async function addSeller(input: { listing_id: string; confirmed: boolean; first_name: string; last_name?: string; email?: string }) {
  const c = needsConfirm(input.confirmed);
  if (c) return c;
  const r = await listingById(input.listing_id);
  if ("error" in r) return r;
  const { count } = await supabaseAdmin.from("listing_sellers").select("id", { count: "exact", head: true }).eq("listing_id", r.listing.id as string);
  const { data, error } = await supabaseAdmin
    .from("listing_sellers")
    .insert(clean({ listing_id: r.listing.id, first_name: input.first_name, last_name: input.last_name, email: input.email, sort_order: count ?? 0 }))
    .select()
    .single();
  if (error) return { error: error.message };
  return {
    saved: data,
    saved_summary: summaryLine({
      action: `Added seller ${[input.first_name, input.last_name].filter(Boolean).join(" ")}`,
      address: String(r.listing.property_address),
      changed: Object.keys(clean({ first_name: input.first_name, last_name: input.last_name, email: input.email })),
    }),
  };
}

export async function updateSeller(input: { id: string; confirmed: boolean; first_name?: string; last_name?: string; email?: string }) {
  const c = needsConfirm(input.confirmed);
  if (c) return c;
  const updates = clean({ first_name: input.first_name, last_name: input.last_name, email: input.email });
  if (Object.keys(updates).length === 0) return { error: "Nothing to update." };
  const { data: before } = await supabaseAdmin.from("listing_sellers").select().eq("id", input.id).maybeSingle();
  if (!before) return { error: "No seller with that id." };
  const { data, error } = await supabaseAdmin.from("listing_sellers").update(updates).eq("id", input.id).select().maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "No seller with that id." };
  return {
    saved: data,
    saved_summary: summaryLine({
      action: `Updated seller ${[data.first_name, data.last_name].filter(Boolean).join(" ")}`,
      address: await addressOf(data.listing_id),
      ...changedFields(before, data, Object.keys(updates)),
    }),
  };
}
