import { getPublicOrigin, metadataCorsOptionsRequestHandler } from "mcp-handler";
import { MCP_SCOPE } from "@/lib/oauth";

// RFC 8414 authorization server metadata for the MCP connector (see
// src/lib/oauth.ts). This app is both the authorization server and the
// resource server, so the issuer is just the site origin.
export function GET(request: Request) {
  const origin = getPublicOrigin(request);
  return Response.json(
    {
      issuer: origin,
      authorization_endpoint: `${origin}/oauth/authorize`,
      token_endpoint: `${origin}/oauth/token`,
      registration_endpoint: `${origin}/oauth/register`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
      scopes_supported: [MCP_SCOPE],
      client_id_metadata_document_supported: true,
    },
    { headers: { "Access-Control-Allow-Origin": "*" } }
  );
}

export const OPTIONS = metadataCorsOptionsRequestHandler();
