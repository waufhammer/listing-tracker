import { createMcpHandler, getPublicOrigin, withMcpAuth } from "mcp-handler";
import { z } from "zod";
import { MCP_SCOPE, mcpResourceUrl, sameResource, verify } from "@/lib/oauth";
import {
  ACTIVITY_TYPES,
  LISTING_STATUSES,
  addActivity,
  addPlatformViews,
  addSeller,
  getActivity,
  getClientLinkViews,
  getListing,
  getPlatformViews,
  getWeeklyChecklist,
  getWeeklyEmails,
  listListings,
  recordWeeklyDraft,
  updateActivity,
  updateListing,
  updateSeller,
} from "@/lib/mcp/tracker";

// Remote MCP server so Claude can work on the listing tracker with Will,
// added in claude.ai as a custom connector. OAuth-protected (src/lib/oauth.ts;
// approval page needs the admin login). Writes add or edit only, never
// delete, and each requires confirmed: true after Will approves a summary.

function json(result: unknown) {
  const isError = !!result && typeof result === "object" && "error" in result;
  return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], isError };
}

const isoDate = z.iso.date();
const listingRef = z
  .string()
  .min(1)
  .describe("Listing id, slug, or part of the street address (e.g. \"Thorndyke\"). If it matches more than one listing, ask Will.");
const confirmed = z
  .boolean()
  .describe("Set true ONLY after showing Will exactly what will be saved and getting his OK in this conversation. false returns without saving.");
const readOnly = { readOnlyHint: true, openWorldHint: false };
const write = { readOnlyHint: false, destructiveHint: false, openWorldHint: false };

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      "list_listings",
      {
        title: "List listings",
        description: "All listings (or one status), with DOM, CDOM (after a cancel and relist), First Look flag, and client link.",
        inputSchema: z.object({ status: z.enum(LISTING_STATUSES).optional() }),
        annotations: readOnly,
      },
      async ({ status }) => json(await listListings(status))
    );

    server.registerTool(
      "get_listing",
      {
        title: "Get listing",
        description: "One listing: details, sellers, activity totals, gaps in feedback, latest online views, and when the client link was last opened.",
        inputSchema: z.object({ listing: listingRef }),
        annotations: readOnly,
      },
      async ({ listing }) => json(await getListing(listing))
    );

    server.registerTool(
      "get_activity",
      {
        title: "Get activity",
        description:
          "Showings, agent previews, and open houses for a listing, newest first, optionally in a date range. Includes private raw_feedback and client-facing display_feedback (shown to the client only when feedback_visible).",
        inputSchema: z.object({ listing: listingRef, from: isoDate.optional(), to: isoDate.optional() }),
        annotations: readOnly,
      },
      async ({ listing, from, to }) => json(await getActivity(listing, from, to))
    );

    server.registerTool(
      "get_platform_views",
      {
        title: "Get online view snapshots",
        description: "Zillow, Redfin, and Compass view-count snapshots for a listing, newest first. Counts are cumulative and drop after a relist.",
        inputSchema: z.object({ listing: listingRef }),
        annotations: readOnly,
      },
      async ({ listing }) => json(await getPlatformViews(listing))
    );

    server.registerTool(
      "get_client_link_views",
      {
        title: "Get client link views",
        description: "When the client link was opened (newest first, with browser). Will's own logged-in visits are excluded.",
        inputSchema: z.object({ listing: listingRef, limit: z.number().int().min(1).max(500).default(50) }),
        annotations: readOnly,
      },
      async ({ listing, limit }) => json(await getClientLinkViews(listing, limit))
    );

    server.registerTool(
      "get_weekly_checklist",
      {
        title: "Weekly missing-data checklist",
        description:
          "For the Monday weekly seller update: per Active listing, showings in the covered week (previous Mon-Sun) with no feedback, feedback not yet visible to the client, open houses missing a group count, and missing seller emails.",
        inputSchema: z.object({ send_date: isoDate.optional().describe("The Monday (defaults to this week's Monday, Pacific)") }),
        annotations: readOnly,
      },
      async ({ send_date }) => json(await getWeeklyChecklist(send_date))
    );

    server.registerTool(
      "get_weekly_emails",
      {
        title: "Get weekly seller emails",
        description:
          "Finished weekly update emails (subject, to, cc, html, text) for Active listings, built from the tracker's fixed template. Use them exactly as given; never reword. Create drafts with includeSignature: true. test_mode true sends To Will only with no CC. existing_draft is set when a draft was already made for that week.",
        inputSchema: z.object({
          listing: listingRef.optional().describe("Omit for every Active listing"),
          send_date: isoDate.optional().describe("The Monday (defaults to this week's Monday, Pacific)"),
          test_mode: z.boolean().default(true),
        }),
        annotations: readOnly,
      },
      async (input) => json(await getWeeklyEmails(input))
    );

    server.registerTool(
      "record_weekly_draft",
      {
        title: "Record weekly draft",
        description: "After creating a weekly update Gmail draft, record its id so the same week is never drafted twice.",
        inputSchema: z.object({
          listing_id: z.uuid(),
          send_date: isoDate,
          gmail_draft_id: z.string().min(1),
          test_mode: z.boolean(),
        }),
        annotations: { ...write, idempotentHint: true },
      },
      async (input) => json(await recordWeeklyDraft(input))
    );

    server.registerTool(
      "add_activity",
      {
        title: "Add showing, preview, or open house",
        description:
          "Add one activity entry. Show Will a summary first and set confirmed only after he approves. Feedback always saves hidden from the client; use update_activity with feedback_visible after Will approves the client-facing text. If the address doesn't match exactly one listing, ask Will.",
        inputSchema: z.object({
          listing: listingRef,
          confirmed,
          type: z.enum(ACTIVITY_TYPES),
          date: isoDate,
          agent_name: z.string().optional(),
          is_repeat_visit: z.boolean().optional(),
          follow_up_sent: z.boolean().optional(),
          buyer_packet_requested: z.boolean().optional().describe("Buyer requested the disclosure package"),
          raw_feedback: z.string().optional().describe("Private: feedback exactly as the agent wrote it"),
          display_feedback: z.string().optional().describe("Client-facing version"),
          open_house_groups: z.number().int().min(0).optional(),
          open_house_disclosure_requests: z.number().int().min(0).optional(),
        }),
        annotations: { ...write, idempotentHint: false },
      },
      async (input) => json(await addActivity(input))
    );

    server.registerTool(
      "update_activity",
      {
        title: "Edit activity entry",
        description: "Edit fields on one activity entry (id from get_activity). Show Will the change first; confirmed only after he approves.",
        inputSchema: z.object({
          id: z.uuid(),
          confirmed,
          date: isoDate.optional(),
          type: z.enum(ACTIVITY_TYPES).optional(),
          agent_name: z.string().optional(),
          is_repeat_visit: z.boolean().optional(),
          follow_up_sent: z.boolean().optional(),
          buyer_packet_requested: z.boolean().optional(),
          raw_feedback: z.string().optional(),
          display_feedback: z.string().optional(),
          feedback_visible: z.boolean().optional().describe("true shows display_feedback to the client and puts it in the weekly email"),
          open_house_groups: z.number().int().min(0).optional(),
          open_house_disclosure_requests: z.number().int().min(0).optional(),
        }),
        annotations: { ...write, idempotentHint: true },
      },
      async (input) => json(await updateActivity(input))
    );

    server.registerTool(
      "add_platform_views",
      {
        title: "Add online view snapshot",
        description: "Add a Zillow/Redfin/Compass cumulative view-count snapshot for a date. Show Will first; confirmed only after he approves.",
        inputSchema: z.object({
          listing: listingRef,
          confirmed,
          date: isoDate,
          zillow_views: z.number().int().min(0).optional(),
          redfin_views: z.number().int().min(0).optional(),
          compass_views: z.number().int().min(0).optional(),
        }),
        annotations: { ...write, idempotentHint: false },
      },
      async (input) => json(await addPlatformViews(input))
    );

    server.registerTool(
      "update_listing",
      {
        title: "Edit listing",
        description:
          "Edit listing fields. For a cancel and relist: list_date = relist date, prior_days_on_market = days from earlier listing periods (CDOM minus DOM). Show Will first; confirmed only after he approves.",
        inputSchema: z.object({
          listing: listingRef,
          confirmed,
          property_address: z.string().min(1).optional().describe("Street address only, no city"),
          client_name: z.string().min(1).optional(),
          status: z.enum(LISTING_STATUSES).optional(),
          list_date: isoDate.optional(),
          pending_date: isoDate.optional(),
          sold_date: isoDate.optional(),
          prior_days_on_market: z.number().int().min(0).optional(),
          list_price: z.number().positive().optional(),
          sale_price: z.number().positive().optional(),
          offers_received: z.number().int().min(0).optional(),
        }),
        annotations: { ...write, idempotentHint: true },
      },
      async (input) => json(await updateListing(input))
    );

    server.registerTool(
      "add_seller",
      {
        title: "Add seller",
        description: "Add a seller to a listing (they receive the weekly email). Show Will first; confirmed only after he approves.",
        inputSchema: z.object({
          listing: listingRef,
          confirmed,
          first_name: z.string().min(1),
          last_name: z.string().optional(),
          email: z.email().optional(),
        }),
        annotations: { ...write, idempotentHint: false },
      },
      async (input) => json(await addSeller(input))
    );

    server.registerTool(
      "update_seller",
      {
        title: "Edit seller",
        description: "Edit a seller (id from get_listing). Show Will first; confirmed only after he approves.",
        inputSchema: z.object({
          id: z.uuid(),
          confirmed,
          first_name: z.string().min(1).optional(),
          last_name: z.string().optional(),
          email: z.email().optional(),
        }),
        annotations: { ...write, idempotentHint: true },
      },
      async (input) => json(await updateSeller(input))
    );
  },
  {
    serverInfo: { name: "listing-tracker", version: "1.0.0" },
    instructions:
      "Aufhammer Homes listing activity tracker. Never delete anything. Before any write, show Will a short summary of exactly what will be saved and wait for his OK. If an address doesn't match exactly one listing, ask; never guess. Seller-facing text (weekly emails) comes from the tracker's template: use it as given.",
  }
);

async function verifyToken(req: Request, bearerToken?: string) {
  const token = await verify(bearerToken, "access");
  if (!token || !sameResource(token.res, mcpResourceUrl(getPublicOrigin(req)))) return undefined;
  return {
    token: bearerToken!,
    clientId: token.cid,
    scopes: [MCP_SCOPE],
    expiresAt: token.exp,
    resource: new URL(token.res),
  };
}

const authHandler = withMcpAuth(handler, verifyToken, {
  required: true,
  resourceMetadataPath: "/.well-known/oauth-protected-resource/api/mcp",
});

export { authHandler as GET, authHandler as POST, authHandler as DELETE };
