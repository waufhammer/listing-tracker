import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { ADMIN_COOKIE, isValidAdminSession } from "@/lib/admin-session";
import { isBotUserAgent } from "@/lib/bots";
import {
  FROM_LINK_COOKIE,
  clientCookieName,
  clientCookieOptions,
  legacyGraceActive,
  signClientCookie,
  verifyClientCookie,
} from "@/lib/client-access";

// Comma-separated IPs to skip logging for (e.g. the agent's own home/office
// network), set via the EXCLUDED_VIEW_IPS env var. Behind Vercel, the real
// client IP is the first entry in x-forwarded-for.
function isExcludedIp(request: NextRequest): boolean {
  const excluded = (process.env.EXCLUDED_VIEW_IPS ?? "")
    .split(",")
    .map((ip) => ip.trim())
    .filter(Boolean);
  if (excluded.length === 0) return false;

  const forwardedFor = request.headers.get("x-forwarded-for");
  const clientIp = forwardedFor?.split(",")[0]?.trim();
  return !!clientIp && excluded.includes(clientIp);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  try {
    const { listing_id } = await request.json();

    if (!listing_id || typeof listing_id !== "string" || !UUID.test(listing_id)) {
      return NextResponse.json(
        { error: "listing_id is required" },
        { status: 400 }
      );
    }

    if (isBotUserAgent(request.headers.get("user-agent"))) {
      return NextResponse.json({ success: true, excluded: true });
    }

    // Team view: Will's own visits while logged into admin are not logged,
    // so the view log only shows the client link being opened by others.
    if (await isValidAdminSession(request.cookies.get(ADMIN_COOKIE)?.value)) {
      return NextResponse.json({ success: true, excluded: true });
    }

    const { data: listing } = await supabaseAdmin
      .from("listings")
      .select("id, client_link_version")
      .eq("id", listing_id)
      .maybeSingle();
    if (!listing) {
      return NextResponse.json({ error: "Unknown listing" }, { status: 404 });
    }

    // How this viewer got in. Decided here from cookies, never from the body.
    const cookieName = clientCookieName(listing.id);
    const hasCookie = await verifyClientCookie(
      request.cookies.get(cookieName)?.value,
      listing.id,
      listing.client_link_version
    );
    const fromLink = request.cookies.get(FROM_LINK_COOKIE)?.value === listing.id;
    const via = hasCookie ? (fromLink ? "link" : "cookie") : legacyGraceActive() ? "legacy_slug" : null;
    if (!via) {
      return NextResponse.json({ error: "No access" }, { status: 403 });
    }

    // Server components can't set cookies, so the page's view ping renews the
    // seller's cookie (another 400 days) or, for an old /<slug> link during
    // the grace period, sets it for the first time.
    const withCookie = async (res: NextResponse) => {
      res.cookies.set(cookieName, await signClientCookie(listing.id, listing.client_link_version), clientCookieOptions());
      if (fromLink) res.cookies.delete(FROM_LINK_COOKIE);
      return res;
    };

    if (isExcludedIp(request)) {
      return withCookie(NextResponse.json({ success: true, excluded: true }));
    }

    const row = {
      listing_id,
      viewed_at: new Date().toISOString(),
      user_agent: request.headers.get("user-agent")?.slice(0, 300) ?? null,
      via,
    };
    const { error } = await supabaseAdmin.from("page_views").insert(row);

    if (error) {
      console.error("Failed to log page view:", error);
      return NextResponse.json(
        { error: "Failed to log page view" },
        { status: 500 }
      );
    }

    return withCookie(NextResponse.json({ success: true }));
  } catch {
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}
