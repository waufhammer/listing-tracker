import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, adminSessionValue } from "@/lib/admin-session";
import { clientIp, recordLogin, tooManyFailedLogins } from "@/lib/login-rate-limit";

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();

    const envPassword = process.env.ADMIN_PASSWORD?.trim();
    const ip = clientIp(request);

    if (await tooManyFailedLogins(ip)) {
      return NextResponse.json(
        { error: "Too many tries. Wait 15 minutes and try again." },
        { status: 429 }
      );
    }

    if (!password || typeof password !== "string" || !envPassword || password.trim() !== envPassword) {
      await recordLogin(ip, false);
      return NextResponse.json(
        { error: "Invalid password" },
        { status: 401 }
      );
    }

    await recordLogin(ip, true);
    const isProduction = process.env.NODE_ENV === "production";

    const response = NextResponse.json({ success: true });

    response.cookies.set(ADMIN_COOKIE, await adminSessionValue(), {
      httpOnly: true,
      secure: isProduction,
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      sameSite: "lax",
    });

    return response;
  } catch {
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}
