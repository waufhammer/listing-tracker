import { NextResponse } from "next/server";

// Auth temporarily disabled for development
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
