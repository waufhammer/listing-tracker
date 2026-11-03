import { getPublicOrigin, metadataCorsOptionsRequestHandler, protectedResourceHandler } from "mcp-handler";
import { mcpResourceUrl } from "@/lib/oauth";

// RFC 9728 protected resource metadata for /api/mcp. Served at both
// /.well-known/oauth-protected-resource and the path-suffixed
// /.well-known/oauth-protected-resource/api/mcp, since clients try either.
export function GET(request: Request) {
  const origin = getPublicOrigin(request);
  return protectedResourceHandler({
    authServerUrls: [origin],
    resourceUrl: mcpResourceUrl(origin),
  })(request);
}

export const OPTIONS = metadataCorsOptionsRequestHandler();
