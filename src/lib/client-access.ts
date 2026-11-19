// Seller access to the client page, with no password. Each listing has a long
// random client_link_token; opening /s/<token> sets a signed cookie for that
// listing (400 days, refreshed on every visit). The cookie is an HMAC of the
// listing id and client_link_version, keyed by CLIENT_LINK_SECRET, so
// "Reset client link" (version + 1) kills the old link and every old cookie.
// CLIENT_LINK_SECRET is separate from ADMIN_PASSWORD so changing the admin
// password doesn't sign every seller out.

import { cookies } from "next/headers";
import { ADMIN_COOKIE, hmac, isValidAdminSession } from "./admin-session";
import { WILL_EMAIL, pacificToday } from "./weekly-email";

/** Browsers cap cookie lifetime at 400 days. */
export const CLIENT_COOKIE_MAX_AGE = 400 * 24 * 60 * 60;

/** Short-lived marker set by /s/<token> so the next page view logs via = 'link'. */
export const FROM_LINK_COOKIE = "cl_from_link";

export const CLIENT_TOKEN_RE = /^[0-9a-f]{64}$/;

export function clientCookieName(listingId: string): string {
  return `cl_${listingId.slice(0, 8)}`;
}

function secret(): string | null {
  const s = process.env.CLIENT_LINK_SECRET?.trim();
  return s && s.length >= 16 ? s : null;
}

export async function signClientCookie(listingId: string, version: number): Promise<string> {
  const s = secret();
  if (!s) throw new Error("Missing CLIENT_LINK_SECRET env var (16+ characters)");
  return `${version}.${await hmac(`client-link:${s}`, `${listingId}:${version}`)}`;
}

export async function verifyClientCookie(
  value: string | undefined | null,
  listingId: string,
  version: number
): Promise<boolean> {
  if (!value || !secret()) return false;
  const expected = await signClientCookie(listingId, version);
  if (value.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < value.length; i++) diff |= value.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

export function clientCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: CLIENT_COOKIE_MAX_AGE,
  };
}

/**
 * Old /<slug> links already in sellers' inboxes keep working until
 * CLIENT_LINK_GRACE_UNTIL (YYYY-MM-DD, Pacific). On that date and after, a
 * visit without the cookie gets the "Get your link" form. Unset = no grace.
 */
export function legacyGraceActive(today: string = pacificToday()): boolean {
  const until = process.env.CLIENT_LINK_GRACE_UNTIL?.trim();
  return !!until && /^\d{4}-\d{2}-\d{2}$/.test(until) && today < until;
}

export type ClientAccess = "admin" | "cookie" | "legacy_slug" | null;

/** Who may see this listing's client page, from the request cookies. */
export async function hasClientAccess(listing: { id: string; client_link_version: number }): Promise<ClientAccess> {
  const jar = await cookies();
  if (await isValidAdminSession(jar.get(ADMIN_COOKIE)?.value)) return "admin";
  if (await verifyClientCookie(jar.get(clientCookieName(listing.id))?.value, listing.id, listing.client_link_version)) {
    return "cookie";
  }
  return legacyGraceActive() ? "legacy_slug" : null;
}

/** Contact shown on the "Get your link" page. */
export const CONTACT_EMAIL = WILL_EMAIL;
export function contactPhone(): string | null {
  // AGENT_PHONE is already set in Vercel (from the original setup).
  return process.env.CONTACT_PHONE?.trim() || process.env.AGENT_PHONE?.trim() || null;
}
