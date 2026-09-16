import { NextRequest, NextResponse } from "next/server";
import { sweepNoShows } from "@/lib/showing-matching";

// Vercel sends `Authorization: Bearer ${CRON_SECRET}` automatically for
// scheduled invocations when CRON_SECRET is set in the project — this also
// lets it be triggered manually for testing with the same header.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await sweepNoShows();
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error("No-show sweep failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sweep failed" },
      { status: 500 }
    );
  }
}
