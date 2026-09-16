import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// Deliberately outside /api/admin/* — these links are clicked from an
// inbox with no login (per the PRD), so auth is the token itself, not the
// admin cookie. Renders plain HTML since a human opens this in a browser.

function page(title: string, body: string): NextResponse {
  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>${title}</title>
<style>body{font-family:system-ui,sans-serif;max-width:480px;margin:80px auto;padding:0 20px;color:#0f172a}</style>
</head><body><h1>${title}</h1><p>${body}</p></body></html>`;
  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const { data: link, error: linkError } = await supabaseAdmin
    .from("showing_magic_links")
    .select("*")
    .eq("token", token)
    .maybeSingle();

  if (linkError || !link) {
    return page("Link not found", "This link doesn't match any pending showing verification.");
  }
  if (link.used) {
    return page("Already used", "This link (or its counterpart for the same showing) has already been used.");
  }
  if (new Date(link.expires_at) < new Date()) {
    return page("Link expired", "This link has expired. The showing remains flagged for manual review in the tracker.");
  }

  const newStatus = link.action === "log_as_showing" ? "confirmed_occurred" : "excluded_self_or_open_house";

  const { error: statusError } = await supabaseAdmin
    .from("showing_events")
    .update({ status: newStatus })
    .eq("id", link.showing_event_id);
  if (statusError) {
    return page("Something went wrong", "Couldn't update the showing status. Please resolve this from the tracker admin instead.");
  }

  // Mark both tokens for this event used so the other link can't later
  // flip a status that's already been resolved.
  const { error: usedError } = await supabaseAdmin
    .from("showing_magic_links")
    .update({ used: true })
    .eq("showing_event_id", link.showing_event_id);
  if (usedError) {
    console.error("Failed to mark magic links used:", usedError.message);
  }

  return page(
    "Thanks — recorded",
    link.action === "log_as_showing"
      ? "Marked as a verified showing."
      : "Marked as not a showing (self-access or open house)."
  );
}
