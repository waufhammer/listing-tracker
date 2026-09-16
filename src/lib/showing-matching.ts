// Core matching logic for the showing-verification feature (PRD matching
// steps 1-4). Deliberately plain functions, not server actions — reused by
// both the manual-ingest admin tool and (eventually) the real Gmail
// ingestion path, and easy to exercise directly without going through
// Next.js's server-action machinery.
import { randomBytes } from "crypto";
import { supabaseAdmin } from "./supabase";
import { matchListingForAddress, normalizeAddress } from "./address-normalize";
import type { ParsedKeyboxAccess, ParsedShowingConfirmed } from "./parsers/types";

// Configurable per the PRD ("this should be a configurable constant, not
// hardcoded, in case it needs tuning after observing real data").
export const MATCH_WINDOW_HOURS = 2;
export const NO_SHOW_SWEEP_HOURS = 3;
export const MAGIC_LINK_EXPIRY_DAYS = 30;

export type ShowingEventStatus =
  | "scheduled"
  | "confirmed_occurred"
  | "unconfirmed_occurred"
  | "no_show"
  | "needs_review"
  | "excluded_self_or_open_house";

export interface ShowingEventRow {
  id: string;
  listing_id: string | null;
  event_type: "showing_confirmed" | "keybox_access";
  raw_address: string;
  normalized_address: string;
  agent_name: string | null;
  agent_brokerage: string | null;
  agent_phone: string | null;
  agent_email: string | null;
  scheduled_time: string | null;
  access_time: string | null;
  gmail_message_id: string;
  raw_email_snippet: string | null;
  matched_event_id: string | null;
  status: ShowingEventStatus;
  created_at: string;
}

export interface FlaggedAgentRow {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  reason: string | null;
  active: boolean;
}

export interface IngestResult {
  event: ShowingEventRow;
  matched: ShowingEventRow | null;
  flagged: FlaggedAgentRow | null;
}

function windowBounds(center: Date, hours: number): { from: string; to: string } {
  const ms = hours * 60 * 60 * 1000;
  return {
    from: new Date(center.getTime() - ms).toISOString(),
    to: new Date(center.getTime() + ms).toISOString(),
  };
}

async function insertEvent(row: Record<string, unknown>): Promise<ShowingEventRow> {
  const { data, error } = await supabaseAdmin.from("showing_events").insert(row).select().single();
  if (error) throw new Error(`Failed to insert showing_event: ${error.message}`);
  return data as ShowingEventRow;
}

async function resolveListingId(rawAddress: string): Promise<{ listingId: string | null; normalized: string }> {
  const normalized = normalizeAddress(rawAddress);
  const { data: listings, error } = await supabaseAdmin.from("listings").select("id, property_address");
  if (error) throw new Error(`Failed to load listings for address matching: ${error.message}`);
  const match = matchListingForAddress(normalized, listings ?? []);
  return { listingId: match?.listingId ?? null, normalized: normalized.streetKey };
}

export async function checkFlaggedAgent(name: string | null, phone: string | null): Promise<FlaggedAgentRow | null> {
  const { data, error } = await supabaseAdmin.from("flagged_agents").select("*").eq("active", true);
  if (error) throw new Error(`Failed to load flagged_agents: ${error.message}`);
  const agents = (data ?? []) as FlaggedAgentRow[];

  const normalizedPhone = phone?.replace(/\D/g, "") || null;
  if (normalizedPhone) {
    const byPhone = agents.find((a) => a.phone && a.phone.replace(/\D/g, "") === normalizedPhone);
    if (byPhone) return byPhone;
  }
  if (name) {
    const byName = agents.find((a) => a.name.trim().toLowerCase() === name.trim().toLowerCase());
    if (byName) return byName;
  }
  return null;
}

// Implements PRD "Matching logic" steps 1-3. Step 4 (no-show sweep) is
// sweepNoShows() below.
export async function ingestShowingEvent(
  parsed: ParsedShowingConfirmed | ParsedKeyboxAccess,
  gmailMessageId: string,
  rawEmailSnippet: string
): Promise<IngestResult> {
  const { listingId, normalized } = await resolveListingId(parsed.rawAddress);

  const baseRow = {
    listing_id: listingId,
    event_type: parsed.eventType,
    raw_address: parsed.rawAddress,
    normalized_address: normalized,
    agent_name: parsed.agentName,
    agent_phone: parsed.agentPhone,
    agent_email: parsed.agentEmail,
    agent_brokerage: parsed.eventType === "showing_confirmed" ? parsed.agentBrokerage : null,
    scheduled_time: parsed.eventType === "showing_confirmed" ? parsed.scheduledTime.toISOString() : null,
    access_time: parsed.eventType === "keybox_access" ? parsed.accessTime.toISOString() : null,
    gmail_message_id: gmailMessageId,
    raw_email_snippet: rawEmailSnippet,
  };

  // Step 1: no confident listing match -> needs_review, stop.
  if (!listingId) {
    const event = await insertEvent({ ...baseRow, status: "needs_review" });
    return { event, matched: null, flagged: null };
  }

  const centerTime = parsed.eventType === "showing_confirmed" ? parsed.scheduledTime : parsed.accessTime;
  const { from, to } = windowBounds(centerTime, MATCH_WINDOW_HOURS);
  const counterpartType = parsed.eventType === "showing_confirmed" ? "keybox_access" : "showing_confirmed";
  const timeColumn = parsed.eventType === "showing_confirmed" ? "access_time" : "scheduled_time";

  const { data: counterparts, error: findError } = await supabaseAdmin
    .from("showing_events")
    .select("*")
    .eq("listing_id", listingId)
    .eq("event_type", counterpartType)
    .is("matched_event_id", null)
    .gte(timeColumn, from)
    .lte(timeColumn, to)
    .limit(1);
  if (findError) throw new Error(`Failed to search for a matching counterpart event: ${findError.message}`);
  const counterpart = (counterparts as ShowingEventRow[] | null)?.[0] ?? null;

  // Steps 2/3: found a same-listing counterpart within the window -> pair
  // both records and mark confirmed_occurred.
  if (counterpart) {
    const event = await insertEvent({ ...baseRow, status: "confirmed_occurred", matched_event_id: counterpart.id });
    const { error: pairError } = await supabaseAdmin
      .from("showing_events")
      .update({ matched_event_id: event.id, status: "confirmed_occurred" })
      .eq("id", counterpart.id);
    if (pairError) throw new Error(`Failed to pair counterpart event: ${pairError.message}`);
    return { event, matched: counterpart, flagged: null };
  }

  if (parsed.eventType === "showing_confirmed") {
    const event = await insertEvent({ ...baseRow, status: "scheduled" });
    return { event, matched: null, flagged: null };
  }

  // Unmatched keybox_access: a known self/open-house agent goes to
  // needs_review pending the approve/decline email rather than being
  // silently left as a plain unconfirmed_occurred.
  const flagged = await checkFlaggedAgent(parsed.agentName, parsed.agentPhone);
  const event = await insertEvent({ ...baseRow, status: flagged ? "needs_review" : "unconfirmed_occurred" });
  return { event, matched: null, flagged };
}

export async function createMagicLinks(showingEventId: string): Promise<{ logAsShowingToken: string; notAShowingToken: string }> {
  const expiresAt = new Date(Date.now() + MAGIC_LINK_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const logAsShowingToken = randomBytes(24).toString("hex");
  const notAShowingToken = randomBytes(24).toString("hex");

  const { error } = await supabaseAdmin.from("showing_magic_links").insert([
    { showing_event_id: showingEventId, token: logAsShowingToken, action: "log_as_showing", expires_at: expiresAt },
    { showing_event_id: showingEventId, token: notAShowingToken, action: "not_a_showing", expires_at: expiresAt },
  ]);
  if (error) throw new Error(`Failed to create magic links: ${error.message}`);

  return { logAsShowingToken, notAShowingToken };
}

// PRD matching step 4: sweep scheduled showings more than NO_SHOW_SWEEP_HOURS
// past their scheduled time with no paired keybox_access event.
export async function sweepNoShows(): Promise<{ count: number }> {
  const cutoff = new Date(Date.now() - NO_SHOW_SWEEP_HOURS * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabaseAdmin
    .from("showing_events")
    .update({ status: "no_show" })
    .eq("status", "scheduled")
    .is("matched_event_id", null)
    .lt("scheduled_time", cutoff)
    .select("id");
  if (error) throw new Error(`Failed to sweep no-shows: ${error.message}`);
  return { count: data?.length ?? 0 };
}
