import { isAllowedRedirectUri, sign } from "@/lib/oauth";

const CORS = { "Access-Control-Allow-Origin": "*" };

// RFC 7591 Dynamic Client Registration. Stateless: the returned client_id
// is a signed record of the client's redirect URIs (see src/lib/oauth.ts),
// and only Claude's callback URLs are accepted.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const redirectUris: unknown = body?.redirect_uris;
  if (
    !Array.isArray(redirectUris) ||
    redirectUris.length === 0 ||
    !redirectUris.every((r) => typeof r === "string" && isAllowedRedirectUri(r))
  ) {
    return Response.json(
      { error: "invalid_redirect_uri", error_description: "Only Claude callback URLs are allowed" },
      { status: 400, headers: CORS }
    );
  }
  const name = typeof body.client_name === "string" ? body.client_name.slice(0, 100) : undefined;
  const clientId = await sign({ t: "client", ru: redirectUris as string[], name });

  return Response.json(
    {
      client_id: clientId,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      client_name: name,
      redirect_uris: redirectUris,
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    },
    { status: 201, headers: CORS }
  );
}

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: { ...CORS, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" },
  });
}
