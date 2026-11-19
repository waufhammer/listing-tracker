"use server";

import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { supabaseAdmin } from "./supabase";
import { ADMIN_COOKIE, isValidAdminSession } from "./admin-session";
import { formatChangeLog } from "./change-log";
import { futureDateError, stampActivityTimes } from "./activity-rules";
import { ADMIN_ACTOR_COOKIE, toAdminActor } from "./admin-actor";

/** The admin profile making this change ('will' unless the Assistant
 *  profile is selected in the sidebar). */
async function adminActor() {
  return toAdminActor((await cookies()).get(ADMIN_ACTOR_COOKIE)?.value);
}

/** Who changed a tracked row (read by the 0008 change_log trigger). */
async function byAdmin() {
  return { updated_by: await adminActor(), updated_at: new Date().toISOString() };
}

/** Admin deletes: stamp the row first so change_log records the admin, not the
 *  last editor, as the actor of the delete. */
async function stampedDelete(table: "listings" | "activity_entries" | "platform_views" | "listing_sellers", id: string) {
  await supabaseAdmin.from(table).update(await byAdmin()).eq("id", id);
  return supabaseAdmin.from(table).delete().eq("id", id);
}

async function requireAdmin() {
  const cookieStore = await cookies();
  const session = cookieStore.get(ADMIN_COOKIE);
  if (!(await isValidAdminSession(session?.value))) {
    throw new Error("Unauthorized");
  }
}

// ── Listings ────────────────────────────────────────────────────────────────

export async function getListings(
  orderBy: string = "property_address",
  ascending: boolean = true
) {
  await requireAdmin();
  const { data, error } = await supabaseAdmin
    .from("listings")
    .select("*")
    .order(orderBy, { ascending });
  return { data: data ?? [], error: error?.message ?? null };
}

export async function getListingById(id: string) {
  await requireAdmin();
  const { data, error } = await supabaseAdmin
    .from("listings")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return { data, error: error?.message ?? null };
}

export async function checkSlugAvailable(
  slug: string,
  excludeId?: string
) {
  await requireAdmin();
  let query = supabaseAdmin.from("listings").select("id").eq("slug", slug);
  if (excludeId) query = query.neq("id", excludeId);
  const { data, error } = await query.maybeSingle();
  if (error) return { available: false, error: error.message };
  return { available: !data, error: null };
}

export async function createListing(
  listingData: Record<string, unknown>
) {
  await requireAdmin();
  const { error } = await supabaseAdmin
    .from("listings")
    .insert({ ...listingData, client_link_token: newClientLinkToken(), ...(await byAdmin()) });
  return { error: error?.message ?? null };
}

/** 64 hex characters, the same shape as the 0005 backfill. */
function newClientLinkToken() {
  return randomBytes(32).toString("hex");
}

/** The listing's private seller link (admin only). */
export async function getClientLink(id: string) {
  await requireAdmin();
  const { data, error } = await supabaseAdmin
    .from("listings")
    .select("client_link_token, client_link_version, client_link_rotated_at")
    .eq("id", id)
    .maybeSingle();
  return { data, error: error?.message ?? null };
}

/** New token and version + 1: the old link and every cookie it set stop working. */
export async function rotateClientLink(id: string) {
  await requireAdmin();
  const { data: cur, error: readError } = await supabaseAdmin
    .from("listings")
    .select("client_link_version")
    .eq("id", id)
    .maybeSingle();
  if (readError || !cur) return { error: readError?.message ?? "Listing not found" };
  const { error } = await supabaseAdmin
    .from("listings")
    .update({
      ...(await byAdmin()),
      client_link_token: newClientLinkToken(),
      client_link_version: (cur.client_link_version ?? 1) + 1,
      client_link_rotated_at: new Date().toISOString(),
    })
    .eq("id", id);
  return { error: error?.message ?? null };
}

/** "Email me my link" requests from sellers that were not emailed (no
 *  RESEND_API_KEY, send failed, or hourly limit), last 14 days. */
export async function getUnsentClientLinkRequests() {
  await requireAdmin();
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabaseAdmin
    .from("client_link_requests")
    .select("id, email, created_at, listing_id, listings(property_address, client_link_token)")
    .eq("matched", true)
    .eq("sent", false)
    .gte("created_at", since)
    .order("created_at", { ascending: false });
  return { data: data ?? [], error: error?.message ?? null };
}

export async function updateListing(
  id: string,
  updateData: Record<string, unknown>
) {
  await requireAdmin();
  const { error } = await supabaseAdmin
    .from("listings")
    .update({ ...updateData, ...(await byAdmin()) })
    .eq("id", id);
  return { error: error?.message ?? null };
}

export async function deleteListing(id: string) {
  await requireAdmin();
  // client_link_requests.listing_id (0005) has no ON DELETE CASCADE, so
  // detach those rows first (kept, listing_id cleared) or the delete fails.
  const { error: detachError } = await supabaseAdmin
    .from("client_link_requests")
    .update({ listing_id: null })
    .eq("listing_id", id);
  if (detachError) return { error: detachError.message };
  const { error } = await stampedDelete("listings", id);
  return { error: error?.message ?? null };
}

// ── Activity Entries ────────────────────────────────────────────────────────

export async function getActivityEntries(listingId: string) {
  await requireAdmin();
  const { data, error } = await supabaseAdmin
    .from("activity_entries")
    .select("*")
    .eq("listing_id", listingId)
    .order("date", { ascending: false });
  return { data: data ?? [], error: error?.message ?? null };
}

export async function getActivityEntryById(id: string) {
  await requireAdmin();
  const { data, error } = await supabaseAdmin
    .from("activity_entries")
    .select("*")
    .eq("id", id)
    .single();
  return { data, error: error?.message ?? null };
}

export async function getAllActivityEntries() {
  await requireAdmin();
  const { data, error } = await supabaseAdmin
    .from("activity_entries")
    .select("listing_id, type, buyer_packet_requested, open_house_groups, open_house_disclosure_requests, date");
  return { data: data ?? [], error: error?.message ?? null };
}

export async function getShowingCounts(listingIds: string[]) {
  await requireAdmin();
  const counts: Record<string, number> = {};
  await Promise.all(
    listingIds.map(async (listingId) => {
      const { count, error } = await supabaseAdmin
        .from("activity_entries")
        .select("id", { count: "exact", head: true })
        .eq("listing_id", listingId)
        .is("voided_at", null)
        .in("type", ["buyer_showing", "agent_preview"]);
      if (!error && count !== null) {
        counts[listingId] = count;
      }
    })
  );
  return counts;
}

// Dashboard page visits — logged by PageViewTracker on every load of the
// client-facing [slug] page, but never surfaced anywhere until now. One row
// per view (listing_id + timestamp only, no visitor identity), so "views"
// can include the agent/team checking the link, not just the client.
export async function getPageViewStats(listingId: string) {
  await requireAdmin();
  const { data, error } = await supabaseAdmin
    .from("page_views")
    .select("viewed_at")
    .eq("listing_id", listingId)
    .order("viewed_at", { ascending: false });

  if (error || !data) {
    return { total: 0, last7Days: 0, lastViewedAt: null as string | null, error: error?.message ?? null };
  }

  const sevenDaysAgoMs = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const last7Days = data.filter((d) => new Date(d.viewed_at).getTime() >= sevenDaysAgoMs).length;

  return {
    total: data.length,
    last7Days,
    lastViewedAt: data.length > 0 ? data[0].viewed_at : null,
    error: null,
  };
}

export async function checkRepeatVisit(
  listingId: string,
  agentName: string
) {
  await requireAdmin();
  const { data } = await supabaseAdmin
    .from("activity_entries")
    .select("id")
    .eq("listing_id", listingId)
    .ilike("agent_name", agentName.trim())
    .limit(1);
  return data && data.length > 0;
}

export async function createActivityEntry(
  entry: Record<string, unknown>
) {
  await requireAdmin();
  const future = futureDateError(entry.date);
  if (future) return { error: future };
  const row = stampActivityTimes({ ...entry });
  // raw_feedback keeps the original words; admin forms only have one box.
  if (row.display_feedback && !row.raw_feedback) row.raw_feedback = row.display_feedback;
  // Will saving it visible is the approval.
  if (row.feedback_visible === true) {
    row.feedback_approved_at = new Date().toISOString();
    row.feedback_approved_by = await adminActor();
  }
  const { error } = await supabaseAdmin
    .from("activity_entries")
    .insert({ ...row, ...(await byAdmin()) });
  return { error: error?.message ?? null };
}

export async function updateActivityEntry(
  id: string,
  updates: Record<string, unknown>
) {
  await requireAdmin();
  const future = futureDateError(updates.date);
  if (future) return { error: future };
  const row = { ...updates };
  const { data: before } = await supabaseAdmin
    .from("activity_entries")
    .select("display_feedback, raw_feedback, feedback_visible, follow_up_sent_at, feedback_received_at")
    .eq("id", id)
    .maybeSingle();
  stampActivityTimes(row, before);
  if ("display_feedback" in row || "feedback_visible" in row) {
    if (row.display_feedback && !row.raw_feedback && !before?.raw_feedback) row.raw_feedback = row.display_feedback;
    // Will ticking visible, or saving new text while it's visible, is the
    // approval (otherwise the 0007 trigger hides edited text again).
    const textChanged = "display_feedback" in row && (row.display_feedback ?? null) !== (before?.display_feedback ?? null);
    if (row.feedback_visible === true && (!before?.feedback_visible || textChanged)) {
      row.feedback_approved_at = new Date().toISOString();
      row.feedback_approved_by = await adminActor();
    }
  }
  const { error } = await supabaseAdmin
    .from("activity_entries")
    .update({ ...row, ...(await byAdmin()) })
    .eq("id", id);
  return { error: error?.message ?? null };
}

/** Feedback that was already visible before approvals existed (0007
 *  backfill marks it 'legacy'), for Will to re-read once. */
export async function getLegacyVisibleFeedback() {
  await requireAdmin();
  const { data, error } = await supabaseAdmin
    .from("activity_entries")
    .select("id, date, type, agent_name, display_feedback, raw_feedback, listing_id, listings(property_address)")
    .eq("feedback_approved_by", "legacy")
    .eq("feedback_visible", true)
    .order("date", { ascending: false });
  return { data: data ?? [], error: error?.message ?? null };
}

/** "Looks good": Will has re-read it. */
export async function approveLegacyFeedback(id: string) {
  await requireAdmin();
  const { error } = await supabaseAdmin
    .from("activity_entries")
    .update({ ...(await byAdmin()), feedback_approved_by: await adminActor(), feedback_approved_at: new Date().toISOString() })
    .eq("id", id)
    .eq("feedback_approved_by", "legacy");
  return { error: error?.message ?? null };
}

/** "Hide": take it off the client page and weekly email. Text is kept. */
export async function hideFeedback(id: string) {
  await requireAdmin();
  const { error } = await supabaseAdmin
    .from("activity_entries")
    .update({ ...(await byAdmin()), feedback_visible: false })
    .eq("id", id);
  return { error: error?.message ?? null };
}

export async function deleteActivityEntry(id: string) {
  await requireAdmin();
  const { error } = await stampedDelete("activity_entries", id);
  return { error: error?.message ?? null };
}

// ── Platform Views ──────────────────────────────────────────────────────────

export async function getPlatformViews(listingId: string) {
  await requireAdmin();
  const { data, error } = await supabaseAdmin
    .from("platform_views")
    .select("*")
    .eq("listing_id", listingId)
    .order("date", { ascending: false });
  return { data: data ?? [], error: error?.message ?? null };
}

export async function createPlatformView(
  entry: Record<string, unknown>
) {
  await requireAdmin();
  const future = futureDateError(entry.date);
  if (future) return { error: future };
  const { error } = await supabaseAdmin
    .from("platform_views")
    .insert({ ...entry, ...(await byAdmin()) });
  if (error?.code === "23505") return { error: "There is already an online views snapshot for that date. Edit it instead." };
  return { error: error?.message ?? null };
}

export async function updatePlatformView(
  id: string,
  updates: Record<string, unknown>
) {
  await requireAdmin();
  const { error } = await supabaseAdmin
    .from("platform_views")
    .update({ ...updates, ...(await byAdmin()) })
    .eq("id", id);
  return { error: error?.message ?? null };
}

export async function deletePlatformView(id: string) {
  await requireAdmin();
  const { error } = await stampedDelete("platform_views", id);
  return { error: error?.message ?? null };
}

// ── Listing Notes ───────────────────────────────────────────────────────────

export async function getListingNotes(listingId: string) {
  await requireAdmin();
  const { data, error } = await supabaseAdmin
    .from("listing_notes")
    .select("id, content, created_at")
    .eq("listing_id", listingId)
    .order("created_at", { ascending: true });
  return { data: data ?? [], error: error?.message ?? null };
}

export async function createListingNote(
  listingId: string,
  content: string
) {
  await requireAdmin();
  const { error } = await supabaseAdmin
    .from("listing_notes")
    .insert({ listing_id: listingId, content });
  return { error: error?.message ?? null };
}

export async function deleteListingNote(id: string) {
  await requireAdmin();
  const { error } = await supabaseAdmin
    .from("listing_notes")
    .delete()
    .eq("id", id);
  return { error: error?.message ?? null };
}

// ── Storage ─────────────────────────────────────────────────────────────────

const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp", "heic", "heif"];

export async function uploadPropertyPhoto(formData: FormData) {
  await requireAdmin();
  const file = formData.get("file") as File;
  const slug = formData.get("slug") as string;

  if (!file || !slug) {
    return { url: null, error: "File and slug are required" };
  }

  // Some mobile browsers report an empty type for HEIC/HEIF photos, so fall
  // back to checking the file extension before rejecting it.
  const fileExt = (file.name.split(".").pop() || "").toLowerCase();
  const looksLikeImage =
    file.type.startsWith("image/") || IMAGE_EXTENSIONS.includes(fileExt);
  if (!looksLikeImage) {
    return { url: null, error: "File must be an image (JPEG, PNG, HEIC, etc.)" };
  }

  const maxBytes = 10 * 1024 * 1024;
  if (file.size > maxBytes) {
    const mb = (file.size / (1024 * 1024)).toFixed(1);
    return { url: null, error: `File is too large (${mb} MB). Maximum size is 10 MB.` };
  }

  const filePath = `${slug}-${Date.now()}.${fileExt}`;

  try {
    const { error: uploadError } = await Promise.race([
      supabaseAdmin.storage.from("property-photos").upload(filePath, file),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Upload timed out after 30 seconds. Check that the property-photos storage bucket exists in Supabase.")), 30000)
      ),
    ]);

    if (uploadError) {
      if (uploadError.message.includes("Payload too large") || uploadError.message.includes("413")) {
        return { url: null, error: "File is too large to upload. Please use an image under 10 MB." };
      }
      return { url: null, error: `Upload failed: ${uploadError.message}` };
    }

    const {
      data: { publicUrl },
    } = supabaseAdmin.storage.from("property-photos").getPublicUrl(filePath);

    return { url: publicUrl, error: null };
  } catch (err) {
    return {
      url: null,
      error: err instanceof Error ? err.message : "Upload failed unexpectedly",
    };
  }
}

// ── Sellers ─────────────────────────────────────────────────────────────────

export async function getSellers(listingId: string) {
  await requireAdmin();
  const { data, error } = await supabaseAdmin
    .from("listing_sellers")
    .select("*")
    .eq("listing_id", listingId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  return { data: data ?? [], error: error?.message ?? null };
}

export async function createSeller(seller: {
  listing_id: string;
  first_name: string;
  last_name?: string | null;
  email?: string | null;
  sort_order?: number;
}) {
  await requireAdmin();
  const { error } = await supabaseAdmin.from("listing_sellers").insert({ ...seller, ...(await byAdmin()) });
  return { error: error?.message ?? null };
}

export async function updateSeller(id: string, updates: Record<string, unknown>) {
  await requireAdmin();
  const { error } = await supabaseAdmin.from("listing_sellers").update({ ...updates, ...(await byAdmin()) }).eq("id", id);
  return { error: error?.message ?? null };
}

export async function deleteSeller(id: string) {
  await requireAdmin();
  const { error } = await stampedDelete("listing_sellers", id);
  return { error: error?.message ?? null };
}

// ── Client link view log ────────────────────────────────────────────────────

export async function getPageViewLog(listingId: string, limit = 50) {
  await requireAdmin();
  const { data, error } = await supabaseAdmin
    .from("page_views")
    .select("id, viewed_at, user_agent, via")
    .eq("listing_id", listingId)
    .order("viewed_at", { ascending: false })
    .limit(limit);
  return { data: data ?? [], error: error?.message ?? null };
}

// ── Weekly seller update ────────────────────────────────────────────────────

export async function getWeeklyEmailPreview(listingId: string, sendDate: string) {
  await requireAdmin();
  const { loadWeeklyEmail } = await import("./weekly-email-data");
  return loadWeeklyEmail(listingId, sendDate, { testMode: true });
}

// ── Change history (0008) ──────────────────────────────────────────────────

export async function getChangeLogForListing(listingId: string, limit = 200) {
  await requireAdmin();
  const { data, error } = await supabaseAdmin
    .from("change_log")
    .select("at, actor, action, table_name, row_id, before, after")
    .eq("listing_id", listingId)
    .order("at", { ascending: false })
    .limit(limit);
  const rows = formatChangeLog((data ?? []) as Record<string, unknown>[]).filter(
    (x) => !("changed" in x) || Object.keys(x.changed).length > 0
  );
  return { data: rows, error: error?.message ?? null };
}
