import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();

    const envPassword = process.env.ADMIN_PASSWORD;
    console.log("ADMIN_PASSWORD env var exists:", !!envPassword, "length:", envPassword?.length);

    if (!password || password !== envPassword) {
      return NextResponse.json(
        { error: "Invalid password" },
        { status: 401 }
      );
    }

    const isProduction = process.env.NODE_ENV === "production";

    const response = NextResponse.json({ success: true });

    response.cookies.set("admin_session", "authenticated", {
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
