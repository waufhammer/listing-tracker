import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

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

export async function POST(request: NextRequest) {
  try {
    const { listing_id } = await request.json();

    if (!listing_id || typeof listing_id !== "string") {
      return NextResponse.json(
        { error: "listing_id is required" },
        { status: 400 }
      );
    }

    if (isExcludedIp(request)) {
      return NextResponse.json({ success: true, excluded: true });
    }

    const { error } = await supabaseAdmin.from("page_views").insert({
      listing_id,
      viewed_at: new Date().toISOString(),
    });

    if (error) {
      console.error("Failed to log page view:", error);
      return NextResponse.json(
        { error: "Failed to log page view" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}
