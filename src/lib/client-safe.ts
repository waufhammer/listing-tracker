// What the seller-facing client page may see. Everything passed to a client
// component is serialized into the page HTML, so private fields must be
// removed on the server, not just hidden in the UI.

/** Activity columns the client page may load. Never add private fields here
 *  (raw_feedback, follow_up_sent, logged_by, agent contact details). */
export const CLIENT_ACTIVITY_FIELDS =
  "id, date, type, agent_name, is_repeat_visit, buyer_packet_requested, display_feedback, feedback_visible, open_house_groups, open_house_disclosure_requests";

/** Listing columns the client page uses. Never `*`: listing_notes and any
 *  future column must not reach the page by default. */
export const CLIENT_LISTING_FIELDS =
  "id, slug, property_address, client_name, status, list_date, pending_date, sold_date, first_look, prior_days_on_market, photo_url, platform_views_public";

export const CLIENT_PLATFORM_VIEW_FIELDS = "date, zillow_views, redfin_views, compass_views, created_at";

export interface ClientActivityEntry {
  id: string;
  date: string;
  type: string;
  agent_name: string | null;
  is_repeat_visit: boolean;
  buyer_packet_requested: boolean;
  display_feedback: string | null;
  feedback_visible: boolean;
  open_house_groups: number | null;
  open_house_disclosure_requests: number | null;
}

/** Copy only client-safe fields; hidden feedback text is dropped entirely. */
export function toClientEntry(row: Record<string, unknown>): ClientActivityEntry {
  const visible = row.feedback_visible === true;
  return {
    id: String(row.id),
    date: String(row.date),
    type: String(row.type),
    agent_name: (row.agent_name as string | null) ?? null,
    is_repeat_visit: row.is_repeat_visit === true,
    buyer_packet_requested: row.buyer_packet_requested === true,
    display_feedback: visible ? ((row.display_feedback as string | null) ?? null) : null,
    feedback_visible: visible,
    open_house_groups: (row.open_house_groups as number | null) ?? null,
    open_house_disclosure_requests: (row.open_house_disclosure_requests as number | null) ?? null,
  };
}
