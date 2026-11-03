// Loads tracker data for the weekly seller email. Server-only (service key).
// Reads only client-safe fields: never listing_notes or raw_feedback.
import { supabaseAdmin } from "./supabase";
import { buildWeeklyEmail, type EmailListing, type WeeklyEmail } from "./weekly-email";

export const SIGNATURE_SETTING_KEY = "email_signature_html";

const ENTRY_FIELDS =
  "date, type, agent_name, buyer_packet_requested, display_feedback, feedback_visible, open_house_groups, open_house_disclosure_requests";
const LISTING_FIELDS =
  "id, slug, property_address, status, list_date, pending_date, sold_date, first_look, prior_days_on_market";

export async function loadWeeklyEmail(
  listingId: string,
  sendDate: string,
  opts: { testMode: boolean }
): Promise<{ email: WeeklyEmail | null; error: string | null }> {
  const [listingRes, sellersRes, entriesRes, sigRes] = await Promise.all([
    supabaseAdmin.from("listings").select(LISTING_FIELDS).eq("id", listingId).maybeSingle(),
    supabaseAdmin.from("listing_sellers").select("first_name, last_name, email, sort_order").eq("listing_id", listingId),
    supabaseAdmin.from("activity_entries").select(ENTRY_FIELDS).eq("listing_id", listingId),
    supabaseAdmin.from("app_settings").select("value").eq("key", SIGNATURE_SETTING_KEY).maybeSingle(),
  ]);
  const err = listingRes.error ?? sellersRes.error ?? entriesRes.error ?? sigRes.error;
  if (err) return { email: null, error: err.message };
  if (!listingRes.data) return { email: null, error: "Listing not found" };

  const email = buildWeeklyEmail({
    listing: listingRes.data as EmailListing,
    sellers: sellersRes.data ?? [],
    entries: entriesRes.data ?? [],
    sendDate,
    signatureHtml: (sigRes.data?.value as string | undefined) ?? null,
    testMode: opts.testMode,
  });
  return { email, error: null };
}

/** Active listings that get a weekly email. */
export async function activeListingIds(): Promise<string[]> {
  const { data } = await supabaseAdmin.from("listings").select("id").eq("status", "active");
  return (data ?? []).map((r) => r.id as string);
}
