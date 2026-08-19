"use server";

import { cookies } from "next/headers";
import { supabaseAdmin } from "./supabase";

async function requireAdmin() {
  const cookieStore = await cookies();
  const session = cookieStore.get("admin_session");
  if (!session || session.value !== "authenticated") {
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
  const { error } = await supabaseAdmin.from("listings").insert(listingData);
  return { error: error?.message ?? null };
}

export async function updateListing(
  id: string,
  updateData: Record<string, unknown>
) {
  await requireAdmin();
  const { error } = await supabaseAdmin
    .from("listings")
    .update(updateData)
    .eq("id", id);
  return { error: error?.message ?? null };
}

export async function deleteListing(id: string) {
  await requireAdmin();
  const { error } = await supabaseAdmin
    .from("listings")
    .delete()
    .eq("id", id);
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
    .select("listing_id, type, buyer_packet_requested, open_house_groups, date");
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
        .in("type", ["buyer_showing", "agent_preview"]);
      if (!error && count !== null) {
        counts[listingId] = count;
      }
    })
  );
  return counts;
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
  const { error } = await supabaseAdmin
    .from("activity_entries")
    .insert(entry);
  return { error: error?.message ?? null };
}

export async function updateActivityEntry(
  id: string,
  updates: Record<string, unknown>
) {
  await requireAdmin();
  const { error } = await supabaseAdmin
    .from("activity_entries")
    .update(updates)
    .eq("id", id);
  return { error: error?.message ?? null };
}

export async function deleteActivityEntry(id: string) {
  await requireAdmin();
  const { error } = await supabaseAdmin
    .from("activity_entries")
    .delete()
    .eq("id", id);
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
  const { error } = await supabaseAdmin
    .from("platform_views")
    .insert(entry);
  return { error: error?.message ?? null };
}

export async function updatePlatformView(
  id: string,
  updates: Record<string, unknown>
) {
  await requireAdmin();
  const { error } = await supabaseAdmin
    .from("platform_views")
    .update(updates)
    .eq("id", id);
  return { error: error?.message ?? null };
}

export async function deletePlatformView(id: string) {
  await requireAdmin();
  const { error } = await supabaseAdmin
    .from("platform_views")
    .delete()
    .eq("id", id);
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

export async function uploadPropertyPhoto(formData: FormData) {
  await requireAdmin();
  const file = formData.get("file") as File;
  const slug = formData.get("slug") as string;

  if (!file || !slug) {
    return { url: null, error: "File and slug are required" };
  }

  if (!file.type.startsWith("image/")) {
    return { url: null, error: "File must be an image (JPEG, PNG, HEIC, etc.)" };
  }

  const maxBytes = 10 * 1024 * 1024;
  if (file.size > maxBytes) {
    const mb = (file.size / (1024 * 1024)).toFixed(1);
    return { url: null, error: `File is too large (${mb} MB). Maximum size is 10 MB.` };
  }

  const fileExt = file.name.split(".").pop();
  const filePath = `${slug}-${Date.now()}.${fileExt}`;

  const uploadResult = await Promise.race([
    supabaseAdmin.storage.from("property-photos").upload(filePath, file),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Upload timed out after 30 seconds. Check that the property-photos storage bucket exists in Supabase.")), 30000)
    ),
  ]);

  const { error: uploadError } = uploadResult;

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
}
