import { cookies } from 'next/headers';

const COOKIE_NAME = 'admin_session';
const SESSION_VALUE = process.env.ADMIN_SECRET || 'fallback-secret';

export function setAdminCookie(cookieStore) {
  cookieStore.set(COOKIE_NAME, SESSION_VALUE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  });
}

export function clearAdminCookie(cookieStore) {
  cookieStore.set(COOKIE_NAME, '', { maxAge: 0, path: '/' });
}

export function isAuthenticated() {
  const cookieStore = cookies();
  const val = cookieStore.get(COOKIE_NAME)?.value;
  return val === SESSION_VALUE;
}

export function checkAdminCookie(request) {
  const val = request.cookies.get(COOKIE_NAME)?.value;
  return val === SESSION_VALUE;
}
