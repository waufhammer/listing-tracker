import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, isValidAdminSession } from "@/lib/admin-session";

export async function middleware(request: NextRequest) {
  const session = request.cookies.get(ADMIN_COOKIE);

  if (!(await isValidAdminSession(session?.value))) {
    const login = new URL("/admin/login", request.url);
    // Send the connector approval page back to itself after login.
    if (request.nextUrl.pathname === "/oauth/authorize") {
      login.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
    }
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/((?!login).*)",
    "/admin",
    "/api/admin/:path*",
    // MCP connector approval page: requires the admin login.
    "/oauth/authorize",
  ],
};
