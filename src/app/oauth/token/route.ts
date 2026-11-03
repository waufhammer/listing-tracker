import { getPublicOrigin } from "mcp-handler";
import {
  ACCESS_TOKEN_TTL_S,
  MCP_SCOPE,
  REFRESH_TOKEN_TTL_S,
  mcpResourceUrl,
  nowS,
  sameResource,
  sign,
  verify,
  verifyPkceS256,
} from "@/lib/oauth";

const HEADERS = { "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" };

function error(code: string, description: string, status = 400) {
  return Response.json({ error: code, error_description: description }, { status, headers: HEADERS });
}

async function issueTokens(clientId: string, resource: string) {
  const now = nowS();
  return Response.json(
    {
      access_token: await sign({ t: "access", cid: clientId, res: resource, exp: now + ACCESS_TOKEN_TTL_S }),
      token_type: "Bearer",
      expires_in: ACCESS_TOKEN_TTL_S,
      refresh_token: await sign({ t: "refresh", cid: clientId, res: resource, exp: now + REFRESH_TOKEN_TTL_S }),
      scope: MCP_SCOPE,
    },
    { headers: HEADERS }
  );
}

// OAuth token endpoint (public clients, PKCE S256 required).
export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  if (!form) return error("invalid_request", "Expected application/x-www-form-urlencoded body");
  const get = (k: string) => {
    const v = form.get(k);
    return typeof v === "string" ? v : null;
  };
  const grantType = get("grant_type");
  const clientId = get("client_id");
  const expectedResource = mcpResourceUrl(getPublicOrigin(request));
  const resource = get("resource");
  if (resource && !sameResource(resource, expectedResource)) {
    return error("invalid_target", "Unknown resource");
  }

  if (grantType === "authorization_code") {
    const code = await verify(get("code"), "code");
    if (!code) return error("invalid_grant", "Invalid or expired authorization code");
    if (clientId && clientId !== code.cid) return error("invalid_grant", "Client mismatch");
    if (get("redirect_uri") !== code.ru) return error("invalid_grant", "redirect_uri mismatch");
    const verifier = get("code_verifier");
    if (!verifier || !(await verifyPkceS256(verifier, code.cc))) {
      return error("invalid_grant", "PKCE verification failed");
    }
    return issueTokens(code.cid, code.res);
  }

  if (grantType === "refresh_token") {
    const refresh = await verify(get("refresh_token"), "refresh");
    if (!refresh) return error("invalid_grant", "Invalid or expired refresh token");
    if (clientId && clientId !== refresh.cid) return error("invalid_grant", "Client mismatch");
    return issueTokens(refresh.cid, refresh.res);
  }

  return error("unsupported_grant_type", "Unsupported grant_type");
}

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: { ...HEADERS, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" },
  });
}
