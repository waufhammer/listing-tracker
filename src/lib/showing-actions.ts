"use server";

import crypto from "crypto";
import { requireAdmin } from "./actions";
import { supabaseAdmin } from "./supabase";
import { parseShowingTimeEmail } from "./parsers/showingtime";
import { parseSupraEmail } from "./parsers/supra";
import {
  ingestShowingEvent,
  createMagicLinks,
  sweepNoShows,
  type ShowingEventStatus,
  type ShowingEventRow,
  type FlaggedAgentRow,
} from "./showing-matching";
import { sendFlaggedAgentAlert } from "./resend";

// ── Showing events ──────────────────────────────────────────────────────────

const ATTENTION_STATUSES: ShowingEventStatus[] = ["unconfirmed_occurred", "no_show", "needs_review"];

export async function getShowingEvents(opts?: { listingId?: string; includeResolved?: boolean }) {
  await requireAdmin();
  let query = supabaseAdmin.from("showing_events").select("*").order("created_at", { ascending: false });
  if (opts?.listingId) query = query.eq("listing_id", opts.listingId);
  if (!opts?.includeResolved) query = query.in("status", ATTENTION_STATUSES);
  const { data, error } = await query;
  return { data: (data ?? []) as ShowingEventRow[], error: error?.message ?? null };
}

export async function getUpcomingShowings() {
  await requireAdmin();
  const { data, error } = await supabaseAdmin
    .from("showing_events")
    .select("*")
    .eq("status", "scheduled")
    .order("scheduled_time", { ascending: true });
  return { data: (data ?? []) as ShowingEventRow[], error: error?.message ?? null };
}

export async function resolveShowingEvent(id: string, newStatus: ShowingEventStatus) {
  await requireAdmin();
  const { error } = await supabaseAdmin.from("showing_events").update({ status: newStatus }).eq("id", id);
  return { error: error?.message ?? null };
}

// ── Flagged agents ──────────────────────────────────────────────────────────

export async function getFlaggedAgents() {
  await requireAdmin();
  const { data, error } = await supabaseAdmin.from("flagged_agents").select("*").order("name");
  return { data: (data ?? []) as FlaggedAgentRow[], error: error?.message ?? null };
}

export async function createFlaggedAgent(agent: {
  name: string;
  phone?: string;
  email?: string;
  reason?: string;
}) {
  await requireAdmin();
  const { error } = await supabaseAdmin.from("flagged_agents").insert(agent);
  return { error: error?.message ?? null };
}

export async function updateFlaggedAgent(id: string, updates: Record<string, unknown>) {
  await requireAdmin();
  const { error } = await supabaseAdmin.from("flagged_agents").update(updates).eq("id", id);
  return { error: error?.message ?? null };
}

export async function deleteFlaggedAgent(id: string) {
  await requireAdmin();
  const { error } = await supabaseAdmin.from("flagged_agents").delete().eq("id", id);
  return { error: error?.message ?? null };
}

// ── Manual ingest ────────────────────────────────────────────────────────────
// Entry point for the paste-a-raw-email admin tool. Runs the exact same
// parse -> match -> insert pipeline a real Gmail webhook would use, so it
// doubles as the Phase 1 test harness and a permanent debugging aid.

export interface ManualIngestResult {
  parsed: unknown;
  event: ShowingEventRow | null;
  matched: ShowingEventRow | null;
  flaggedAgent: FlaggedAgentRow | null;
  alertSent: boolean;
  alertError: string | null;
}

export async function manualIngestEmail(rawText: string, sourceType: "showingtime" | "supra") {
  await requireAdmin();

  const parsed = sourceType === "showingtime" ? parseShowingTimeEmail(rawText) : parseSupraEmail(rawText);

  if (!parsed.ok) {
    return { data: null, error: parsed.reason };
  }
  if (parsed.eventType === "ignorable") {
    const data: ManualIngestResult = {
      parsed,
      event: null,
      matched: null,
      flaggedAgent: null,
      alertSent: false,
      alertError: null,
    };
    return { data, error: null };
  }

  // Pasted emails have no real Gmail message ID; hash the trimmed text so
  // re-pasting the same email is idempotent instead of hitting the unique
  // constraint as an error.
  const gmailMessageId = `manual:${crypto.createHash("sha256").update(rawText.trim()).digest("hex")}`;

  let ingestResult;
  try {
    ingestResult = await ingestShowingEvent(parsed, gmailMessageId, rawText.slice(0, 2000));
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Failed to ingest event." };
  }

  const { event, matched, flagged } = ingestResult;

  let alertSent = false;
  let alertError: string | null = null;
  if (flagged) {
    try {
      const { logAsShowingToken, notAShowingToken } = await createMagicLinks(event.id);
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "";
      await sendFlaggedAgentAlert({
        event,
        agent: flagged,
        logAsShowingUrl: `${baseUrl}/api/showing-links/${logAsShowingToken}`,
        notAShowingUrl: `${baseUrl}/api/showing-links/${notAShowingToken}`,
      });
      alertSent = true;
    } catch (err) {
      alertError = err instanceof Error ? err.message : "Failed to send flagged-agent alert.";
    }
  }

  const data: ManualIngestResult = { parsed, event, matched, flaggedAgent: flagged, alertSent, alertError };
  return { data, error: null };
}

export async function runNoShowSweep() {
  await requireAdmin();
  try {
    const result = await sweepNoShows();
    return { data: result, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Sweep failed." };
  }
}

export async function getVerifiedShowingCounts(listingIds: string[]) {
  await requireAdmin();
  const counts: Record<string, number> = {};
  await Promise.all(
    listingIds.map(async (listingId) => {
      const { count, error } = await supabaseAdmin
        .from("showing_events")
        .select("id", { count: "exact", head: true })
        .eq("listing_id", listingId)
        .eq("status", "confirmed_occurred");
      if (!error && count !== null) counts[listingId] = count;
    })
  );
  return counts;
}
