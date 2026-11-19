import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { CLIENT_BASE_URL } from "@/lib/weekly-email";

// "Email me my link" (POST { slug?, email }). Sends the private /s/<token>
// link only to an email that belongs to a seller on that listing (or, with
// no slug, on any active listing). The reply never says whether the email
// matched. At most MAX_SENDS_PER_HOUR emails per listing per hour. Without
// RESEND_API_KEY nothing is emailed; matched requests show on the admin home
// page for Will to send by hand.

const MAX_SENDS_PER_HOUR = 3;
const FROM = process.env.CLIENT_LINK_FROM?.trim() || "Aufhammer Homes <listings@aufhammerhomes.com>";

function reply() {
  return NextResponse.json({
    message: process.env.RESEND_API_KEY
      ? "If that email is on file, a link is on its way. Check your inbox in a minute or two."
      : "Thanks. If that email is on file, Will has been notified and will send your link shortly.",
  });
}

type ListingRow = { id: string; property_address: string; client_link_token: string };

async function sendLink(to: string, listing: ListingRow): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  const url = `${CLIENT_BASE_URL}/s/${listing.client_link_token}`;
  const text = [
    `Here is your private link to the activity page for ${listing.property_address}:`,
    "",
    url,
    "",
    "Open it on each phone or computer you use; after that, the page stays signed in on that device.",
    "Please don't forward this link. If you didn't ask for it, you can ignore this email.",
    "",
    "Will Aufhammer, Aufhammer Homes",
  ].join("\n");
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const html =
    `<p>Here is your private link to the activity page for ${esc(listing.property_address)}:</p>` +
    `<p><a href="${url}">Open your listing page</a></p>` +
    `<p>Open it on each phone or computer you use; after that, the page stays signed in on that device.</p>` +
    `<p>Please don't forward this link. If you didn't ask for it, you can ignore this email.</p>` +
    `<p>Will Aufhammer, Aufhammer Homes</p>`;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [to], subject: `Your link: ${listing.property_address}`, text, html }),
    });
    if (!res.ok) console.error("Resend failed:", res.status, await res.text());
    return res.ok;
  } catch (e) {
    console.error("Resend failed:", e);
    return false;
  }
}

export async function POST(request: NextRequest) {
  let body: { slug?: unknown; email?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const slug = typeof body.slug === "string" ? body.slug.trim().toLowerCase() : "";
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  let q = supabaseAdmin.from("listings").select("id, property_address, client_link_token");
  q = slug ? q.eq("slug", slug) : q.eq("status", "active");
  const { data: listings, error } = await q;
  if (error) {
    console.error("client-link request:", error);
    return reply();
  }
  const rows = (listings ?? []) as ListingRow[];

  const { data: sellers } = rows.length
    ? await supabaseAdmin.from("listing_sellers").select("listing_id, email").in("listing_id", rows.map((l) => l.id))
    : { data: [] };
  const matchedIds = new Set(
    (sellers ?? [])
      .filter((s) => typeof s.email === "string" && s.email.trim().toLowerCase() === email)
      .map((s) => s.listing_id as string)
  );
  const matched = rows.filter((l) => matchedIds.has(l.id));

  if (matched.length === 0) {
    await supabaseAdmin
      .from("client_link_requests")
      .insert({ listing_id: slug && rows[0] ? rows[0].id : null, email, matched: false, sent: false });
    return reply();
  }

  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  for (const listing of matched) {
    const { count } = await supabaseAdmin
      .from("client_link_requests")
      .select("id", { count: "exact", head: true })
      .eq("listing_id", listing.id)
      .eq("sent", true)
      .gte("created_at", hourAgo);
    const sent = (count ?? 0) < MAX_SENDS_PER_HOUR ? await sendLink(email, listing) : false;
    await supabaseAdmin.from("client_link_requests").insert({ listing_id: listing.id, email, matched: true, sent });
  }
  return reply();
}
