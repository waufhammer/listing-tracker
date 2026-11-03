// Minimal OAuth 2.1 authorization server for the /api/mcp connector (Claude
// working on the tracker with Will, from claude.ai). Ported from
// aufhammer-crm. There is exactly one user, so everything is stateless:
// client registrations, authorization codes, and access/refresh tokens are
// all HMAC-signed blobs rather than database rows. The signing key is
// derived from ADMIN_PASSWORD, so changing it also revokes every connector
// token.
//
// Clients identify themselves either via Dynamic Client Registration
// (/oauth/register hands back a signed client_id) or a Client ID Metadata
// Document (client_id is an https URL serving the client's metadata). Either
// way, redirect URIs are restricted to Claude's own domains, so a token can
// never be delivered anywhere else.

export const MCP_SCOPE = "tracker";
export const ACCESS_TOKEN_TTL_S = 60 * 60; // 1 hour
export const REFRESH_TOKEN_TTL_S = 60 * 60 * 24 * 30; // 30 days
export const AUTH_CODE_TTL_S = 120;

const CLAUDE_HOSTS = new Set(["claude.ai", "www.claude.ai", "claude.com", "www.claude.com"]);

type TokenPayload =
  | { t: "client"; ru: string[]; name?: string }
  | { t: "code"; cid: string; ru: string; cc: string; res: string; exp: number }
  | { t: "access"; cid: string; res: string; exp: number }
  | { t: "refresh"; cid: string; res: string; exp: number };

function secret(): string {
  const s = process.env.ADMIN_PASSWORD?.trim();
  if (!s) throw new Error("Missing ADMIN_PASSWORD env var");
  // Domain-separated from the admin session cookie key (src/lib/admin-session.ts).
  return `mcp-oauth:${s}`;
}

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): Uint8Array {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const bin = atob(padded);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function hmac(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return b64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(message))));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function sign(payload: TokenPayload): Promise<string> {
  const body = b64url(new TextEncoder().encode(JSON.stringify(payload)));
  return `${body}.${await hmac(body)}`;
}

export async function verify<T extends TokenPayload["t"]>(
  token: string | undefined | null,
  type: T
): Promise<Extract<TokenPayload, { t: T }> | null> {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot === -1) return null;
  const body = token.slice(0, dot);
  if (!timingSafeEqual(token.slice(dot + 1), await hmac(body))) return null;
  let payload: TokenPayload;
  try {
    payload = JSON.parse(new TextDecoder().decode(b64urlDecode(body)));
  } catch {
    return null;
  }
  if (payload.t !== type) return null;
  if ("exp" in payload && payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload as Extract<TokenPayload, { t: T }>;
}

export function nowS(): number {
  return Math.floor(Date.now() / 1000);
}

// claude.ai's callback lives on claude.ai / claude.com. Localhost is
// allowed outside production only, for testing with a local MCP client.
export function isAllowedRedirectUri(uri: string): boolean {
  let u: URL;
  try {
    u = new URL(uri);
  } catch {
    return false;
  }
  if (u.hash) return false;
  if (u.protocol === "https:" && CLAUDE_HOSTS.has(u.hostname)) return true;
  if (
    process.env.NODE_ENV !== "production" &&
    u.protocol === "http:" &&
    (u.hostname === "localhost" || u.hostname === "127.0.0.1")
  ) {
    return true;
  }
  return false;
}

export interface ResolvedClient {
  clientId: string;
  name: string;
  redirectUris: string[];
}

// Resolves a client_id to its registered redirect URIs: a signed DCR blob,
// or a CIMD https URL on a Claude domain (fetched — only from those hosts,
// so this can't be used to make the server fetch arbitrary URLs).
export async function resolveClient(clientId: string): Promise<ResolvedClient | null> {
  if (clientId.startsWith("https://")) {
    let u: URL;
    try {
      u = new URL(clientId);
    } catch {
      return null;
    }
    if (!CLAUDE_HOSTS.has(u.hostname)) return null;
    try {
      const res = await fetch(u, { headers: { Accept: "application/json" }, redirect: "error" });
      if (!res.ok) return null;
      const doc = await res.json();
      if (doc.client_id !== clientId || !Array.isArray(doc.redirect_uris)) return null;
      const redirectUris = (doc.redirect_uris as unknown[]).filter(
        (r): r is string => typeof r === "string" && isAllowedRedirectUri(r)
      );
      return { clientId, name: String(doc.client_name ?? u.hostname), redirectUris };
    } catch {
      return null;
    }
  }
  const reg = await verify(clientId, "client");
  if (!reg) return null;
  return { clientId, name: reg.name ?? "MCP client", redirectUris: reg.ru.filter(isAllowedRedirectUri) };
}

export async function verifyPkceS256(verifier: string, challenge: string): Promise<boolean> {
  if (!/^[A-Za-z0-9\-._~]{43,128}$/.test(verifier)) return false;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return timingSafeEqual(b64url(new Uint8Array(digest)), challenge);
}

// The canonical resource identifier for the MCP endpoint, used as the token
// audience. Derived from the request so local dev and production both work.
export function mcpResourceUrl(origin: string): string {
  return `${origin}/api/mcp`;
}

// Accept the resource with or without a trailing slash.
export function sameResource(a: string, b: string): boolean {
  return a.replace(/\/+$/, "") === b.replace(/\/+$/, "");
}
