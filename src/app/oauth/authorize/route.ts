import { getPublicOrigin } from "mcp-handler";
import { AUTH_CODE_TTL_S, mcpResourceUrl, nowS, resolveClient, sameResource, sign } from "@/lib/oauth";

// OAuth authorization endpoint for the MCP connector. src/middleware.ts
// requires a valid admin session to reach it at all; it then shows an
// Allow/Deny page. The form posts back here (same-origin; the session cookie
// is SameSite=Lax, so a cross-site POST arrives without it and is sent to
// the login page instead of approving).

interface AuthRequest {
  clientId: string;
  clientName: string;
  redirectUri: string;
  codeChallenge: string;
  state: string | null;
  resource: string;
}

type Parsed = { ok: true; req: AuthRequest } | { ok: false; redirect?: string; message: string };

async function parse(params: URLSearchParams, origin: string): Promise<Parsed> {
  const clientId = params.get("client_id");
  const redirectUri = params.get("redirect_uri");
  if (!clientId || !redirectUri) return { ok: false, message: "Missing client_id or redirect_uri." };

  const client = await resolveClient(clientId);
  if (!client) return { ok: false, message: "Unknown or unsupported client." };
  if (!client.redirectUris.includes(redirectUri)) {
    return { ok: false, message: "redirect_uri is not registered for this client." };
  }

  // From here on, errors go back to the (now trusted) redirect_uri.
  const state = params.get("state");
  const fail = (code: string, description: string): Parsed => {
    const u = new URL(redirectUri);
    u.searchParams.set("error", code);
    u.searchParams.set("error_description", description);
    if (state) u.searchParams.set("state", state);
    return { ok: false, redirect: u.toString(), message: description };
  };

  if (params.get("response_type") !== "code") return fail("unsupported_response_type", "response_type must be code");
  const codeChallenge = params.get("code_challenge");
  if (!codeChallenge || params.get("code_challenge_method") !== "S256") {
    return fail("invalid_request", "PKCE with S256 is required");
  }
  const expected = mcpResourceUrl(origin);
  const resource = params.get("resource") ?? expected;
  if (!sameResource(resource, expected)) return fail("invalid_target", "Unknown resource");

  return {
    ok: true,
    req: { clientId, clientName: client.name, redirectUri, codeChallenge, state, resource: expected },
  };
}

const PAGE_HEADERS = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Frame-Options": "DENY",
  "Content-Security-Policy": "frame-ancestors 'none'",
};

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function page(body: string, status = 200): Response {
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Connect to Listing Tracker</title>
<style>
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f8fafc;font-family:system-ui,-apple-system,sans-serif;color:#0f172a;padding:16px;box-sizing:border-box}
.card{max-width:400px;width:100%;background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:32px;box-shadow:0 1px 2px rgba(0,0,0,.05)}
h1{font-size:18px;margin:0 0 4px}p{font-size:14px;color:#475569;line-height:1.5}
.row{display:flex;gap:8px;margin-top:24px}button{flex:1;padding:8px 12px;border-radius:6px;font-size:14px;font-weight:500;cursor:pointer}
.allow{background:#0f172a;color:#fff;border:1px solid #0f172a}.deny{background:#fff;color:#0f172a;border:1px solid #cbd5e1}
</style></head><body><div class="card">${body}</div></body></html>`,
    { status, headers: PAGE_HEADERS }
  );
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = await parse(url.searchParams, getPublicOrigin(request));
  if (!parsed.ok) {
    if (parsed.redirect) return Response.redirect(parsed.redirect, 302);
    return page(`<h1>Can't connect</h1><p>${escapeHtml(parsed.message)}</p>`, 400);
  }

  const hidden = [...url.searchParams.entries()]
    .map(([k, v]) => `<input type="hidden" name="${escapeHtml(k)}" value="${escapeHtml(v)}">`)
    .join("");
  return page(`<h1>Connect to Listing Tracker</h1>
<p><strong>${escapeHtml(parsed.req.clientName)}</strong> is asking to access your listing tracker: read listings, activity, feedback, notes, and views, and add or edit them after you confirm each save. It cannot delete anything.</p>
<form method="post">${hidden}<div class="row">
<button class="deny" name="decision" value="deny">Deny</button>
<button class="allow" name="decision" value="allow" autofocus>Allow</button>
</div></form>`);
}

export async function POST(request: Request) {
  const form = await request.formData();
  const params = new URLSearchParams();
  for (const [k, v] of form.entries()) if (typeof v === "string") params.set(k, v);

  const parsed = await parse(params, getPublicOrigin(request));
  if (!parsed.ok) {
    if (parsed.redirect) return Response.redirect(parsed.redirect, 302);
    return page(`<h1>Can't connect</h1><p>${escapeHtml(parsed.message)}</p>`, 400);
  }

  const { req } = parsed;
  const redirect = new URL(req.redirectUri);
  if (params.get("decision") === "allow") {
    const code = await sign({
      t: "code",
      cid: req.clientId,
      ru: req.redirectUri,
      cc: req.codeChallenge,
      res: req.resource,
      exp: nowS() + AUTH_CODE_TTL_S,
    });
    redirect.searchParams.set("code", code);
  } else {
    redirect.searchParams.set("error", "access_denied");
  }
  if (req.state) redirect.searchParams.set("state", req.state);
  redirect.searchParams.set("iss", getPublicOrigin(request));
  return Response.redirect(redirect.toString(), 303);
}
