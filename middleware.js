import { NextResponse } from 'next/server';

const COOKIE_NAME = 'admin_session';

export function middleware(request) {
  const { pathname } = request.nextUrl;

  // Only protect /admin routes (excluding /admin/login)
  if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login')) {
    const sessionCookie = request.cookies.get(COOKIE_NAME)?.value;
    const secret = process.env.ADMIN_SECRET || 'fallback-secret';

    if (sessionCookie !== secret) {
      const loginUrl = new URL('/admin/login', request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
