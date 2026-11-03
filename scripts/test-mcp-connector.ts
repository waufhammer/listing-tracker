// Local end-to-end check of the admin session + MCP connector. Run against
// `PORT=3123 npm run dev`:  npx tsx --env-file=.env.local scripts/test-mcp-connector.ts
// Read-only against the database except one no-op listing edit.
import { createHash, randomBytes } from "node:crypto";
const B = "http://localhost:3123";
const b64u = (b: Buffer) => b.toString("base64url");
let failed = 0;
const ok = (c: boolean, m: string) => { if (!c) failed++; console.log(c ? "PASS" : "FAIL", m); };
(async () => {
  // Admin session
  let r = await fetch(`${B}/admin`, { headers: { cookie: "admin_session=authenticated" }, redirect: "manual" });
  ok(r.status === 307, "old forgeable cookie value no longer gets into admin");
  r = await fetch(`${B}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: "wrong" }) });
  ok(r.status === 401, "wrong password rejected");
  r = await fetch(`${B}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: process.env.ADMIN_PASSWORD }) });
  const setCookie = r.headers.get("set-cookie") ?? "";
  const cookie = setCookie.split(";")[0];
  ok(r.status === 200 && !cookie.endsWith("=authenticated"), "login sets signed cookie");
  r = await fetch(`${B}/admin`, { headers: { cookie }, redirect: "manual" });
  ok(r.status === 200, "signed cookie gets into admin");

  // OAuth
  const redirect = "https://claude.ai/api/mcp/auth_callback";
  r = await fetch(`${B}/oauth/register`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ client_name: "Claude", redirect_uris: [redirect] }) });
  const reg = await r.json(); ok(r.status === 201, "register claude.ai redirect");
  r = await fetch(`${B}/oauth/register`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ redirect_uris: ["https://evil.example/cb"] }) });
  ok(r.status === 400, "register foreign redirect rejected");
  const verifier = b64u(randomBytes(32));
  const challenge = b64u(createHash("sha256").update(verifier).digest());
  const q = new URLSearchParams({ response_type: "code", client_id: reg.client_id, redirect_uri: redirect, code_challenge: challenge, code_challenge_method: "S256", state: "xyz", resource: `${B}/api/mcp` });
  r = await fetch(`${B}/oauth/authorize?${q}`, { redirect: "manual" });
  const loc = r.headers.get("location") ?? "";
  ok(r.status === 307 && loc.includes("/admin/login") && (new URL(loc, B).searchParams.get("next") ?? "").includes("code_challenge="), "authorize without login -> login page, returns after");
  r = await fetch(`${B}/oauth/authorize?${q}`, { headers: { cookie: "admin_session=authenticated" }, redirect: "manual" });
  ok(r.status === 307, "authorize with forged cookie blocked");
  r = await fetch(`${B}/oauth/authorize?${q}`, { headers: { cookie }, redirect: "manual" });
  const html = await r.text(); ok(r.status === 200 && html.includes("Allow") && html.includes("Listing Tracker"), "consent page shown");
  const form = new URLSearchParams(q); form.set("decision", "allow");
  r = await fetch(`${B}/oauth/authorize`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: form, redirect: "manual" });
  ok(r.status === 307, "approve without login blocked");
  r = await fetch(`${B}/oauth/authorize`, { method: "POST", headers: { cookie, "content-type": "application/x-www-form-urlencoded" }, body: form, redirect: "manual" });
  const cb = new URL(r.headers.get("location")!);
  ok(r.status === 303 && cb.searchParams.get("state") === "xyz", "approve redirects to callback");
  const tok = (p: Record<string, string>) => fetch(`${B}/oauth/token`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(p) });
  r = await tok({ grant_type: "authorization_code", code: cb.searchParams.get("code")!, redirect_uri: redirect, client_id: reg.client_id, code_verifier: b64u(randomBytes(32)) });
  ok(r.status === 400, "wrong PKCE verifier rejected");
  r = await tok({ grant_type: "authorization_code", code: cb.searchParams.get("code")!, redirect_uri: redirect, client_id: reg.client_id, code_verifier: verifier, resource: `${B}/api/mcp` });
  const t = await r.json(); ok(r.status === 200 && !!t.access_token, "code exchanged for tokens");

  // MCP
  let id = 0;
  const mcp = async (token: string, method: string, params?: unknown) => {
    const res = await fetch(`${B}/api/mcp`, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json", accept: "application/json, text/event-stream", "mcp-protocol-version": "2025-06-18" }, body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }) });
    const txt = await res.text();
    const line = txt.split("\n").find((l) => l.startsWith("data: "));
    return { status: res.status, body: line ? JSON.parse(line.slice(6)) : txt };
  };
  const call = async (name: string, args: unknown) => {
    const res = await mcp(t.access_token, "tools/call", { name, arguments: args });
    const c = res.body?.result;
    return { isError: !!c?.isError, data: c ? JSON.parse(c.content[0].text) : res.body };
  };
  let m = await mcp(t.access_token, "initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "1" } });
  ok(m.status === 200 && JSON.stringify(m.body).includes("listing-tracker"), "MCP initialize");
  m = await mcp(t.access_token, "tools/list");
  const tools = (m.body?.result?.tools ?? []).map((x: { name: string }) => x.name);
  console.log("  tools:", tools.join(", "));
  ok(!tools.some((n: string) => /delete/.test(n)), "no delete tools");
  m = await mcp(t.access_token.slice(0, -2) + "xx", "tools/list");
  ok(m.status === 401, "tampered token rejected");

  let c = await call("list_listings", { status: "active" });
  const active = c.data.listings ?? [];
  console.log("  active:", active.map((l: { property_address: string; dom: number; cdom: number }) => `${l.property_address} DOM ${l.dom} CDOM ${l.cdom}`).join("; "));
  ok(active.length >= 1, "list_listings");
  c = await call("get_listing", { listing: "28th" });
  ok(c.data.listing?.property_address === "2568 28th Ave W", "get_listing by partial address");
  c = await call("get_listing", { listing: "Ave W" });
  ok(c.isError && /matches/.test(c.data.error), "ambiguous address asks instead of guessing");
  c = await call("get_listing", { listing: "1536 Thorndyke" });
  ok(c.data.listing?.status === "sold", "exact address still reaches a sold listing");
  c = await call("get_activity", { listing: "Thorndyke", from: "2026-10-26", to: "2026-11-01" });
  ok(Array.isArray(c.data.entries) && c.data.entries.length > 0, `get_activity (${c.data.entries?.length} entries)`);
  c = await call("get_weekly_checklist", { send_date: "2026-11-02" });
  ok(Array.isArray(c.data.listings), "get_weekly_checklist");
  console.log("  checklist:", JSON.stringify(c.data.listings.map((l: Record<string, unknown[]>) => ({ a: l.property_address, noFb: l.showings_without_feedback.length, hidden: l.feedback_not_client_visible.length, sellers: l.seller_problems }))));
  c = await call("get_weekly_emails", { send_date: "2026-11-02" });
  ok(c.data.emails?.length >= 1 && c.data.emails.every((e: { to: string[]; cc: string[] }) => e.to.join() === "will.aufhammer@compass.com" && e.cc.length === 0), "weekly emails default to test mode (Will only)");
  c = await call("add_seller", { listing: "Thorndyke", confirmed: false, first_name: "Test" });
  ok(c.isError && /Not saved/.test(c.data.error), "write without confirmation does not save");
  c = await call("update_listing", { listing: "Thorndyke", confirmed: true, property_address: "1537 Thorndyke Ave W" });
  ok(!c.isError && c.data.saved?.property_address === "1537 Thorndyke Ave W", "confirmed no-op listing edit saves");
  console.log(failed ? `\n${failed} FAILED` : "\nall passed");
})();
