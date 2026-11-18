import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { buildMcpServer } from "@/lib/mcp-server";

// Claude connector endpoint: https://<app>/api/mcp/<secret key>
// Stateless: a fresh server + transport per request.
async function handle(request: Request, ctx: RouteContext<"/api/mcp/[key]">) {
  const { key } = await ctx.params;
  if (!key?.startsWith("nf_")) {
    return Response.json({ error: "Missing or invalid key" }, { status: 401 });
  }
  const server = buildMcpServer(key);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  return transport.handleRequest(request);
}

export const POST = handle;
export const GET = handle;
export const DELETE = handle;
