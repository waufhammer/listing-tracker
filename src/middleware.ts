import { NextResponse } from "next/server";

// Auth temporarily disabled — troubleshoot login issue later
export function middleware() {
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/((?!login).*)",
    "/admin",
    "/api/admin/:path*",
  ],
};
