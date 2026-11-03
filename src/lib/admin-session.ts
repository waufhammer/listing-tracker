// Admin session cookie. The value is an HMAC derived from ADMIN_PASSWORD, so
// it can't be forged by hand (the old value was the literal string
// "authenticated", which anyone could set). Changing ADMIN_PASSWORD logs
// everyone out. Web Crypto only, so this works in middleware and routes.

export const ADMIN_COOKIE = "admin_session";

async function hmac(key: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const k = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(message)));
  let s = "";
  for (const b of sig) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function adminSessionValue(): Promise<string> {
  const pw = process.env.ADMIN_PASSWORD?.trim();
  if (!pw) throw new Error("Missing ADMIN_PASSWORD env var");
  return hmac(`admin-session:${pw}`, "admin");
}

export async function isValidAdminSession(value: string | undefined | null): Promise<boolean> {
  if (!value) return false;
  const expected = await adminSessionValue();
  if (value.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < value.length; i++) diff |= value.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}
