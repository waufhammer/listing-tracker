import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import {
  CLIENT_TOKEN_RE,
  FROM_LINK_COOKIE,
  clientCookieName,
  clientCookieOptions,
  signClientCookie,
} from "@/lib/client-access";

// Private seller link from the weekly email: /s/<token>. Sets the listing's
// access cookie and redirects to the readable /<slug> page. Not logged as a
// page view (link previewers open this URL too); the view is logged by the
// page itself, with via = 'link'.

function noStore(res: NextResponse) {
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const expired = noStore(NextResponse.redirect(new URL("/link-expired", request.url), 303));
  if (!CLIENT_TOKEN_RE.test(token)) return expired;

  const { data: listing } = await supabaseAdmin
    .from("listings")
    .select("id, slug, client_link_version")
    .eq("client_link_token", token)
    .maybeSingle();
  if (!listing) return expired;

  const res = noStore(NextResponse.redirect(new URL(`/${listing.slug}`, request.url), 303));
  res.cookies.set(
    clientCookieName(listing.id),
    await signClientCookie(listing.id, listing.client_link_version),
    clientCookieOptions()
  );
  res.cookies.set(FROM_LINK_COOKIE, listing.id, { ...clientCookieOptions(), maxAge: 300 });
  return res;
}
