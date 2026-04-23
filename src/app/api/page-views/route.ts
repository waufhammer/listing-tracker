import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const { listing_id } = await request.json();

    if (!listing_id || typeof listing_id !== "string") {
      return NextResponse.json(
        { error: "listing_id is required" },
        { status: 400 }
      );
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
