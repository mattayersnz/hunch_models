import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createMcpServer } from "@/lib/mcp";
import { MCP_CORS, mcpChallenge, mcpOwner, mcpResource } from "@/lib/mcp-auth";
import { env } from "@/lib/env";

export const maxDuration = 30;

export async function POST(request: Request): Promise<Response> {
    const owner = await mcpOwner(request);
    if (!owner) return mcpChallenge(request, request.headers.has("authorization") ? "invalid_token" : undefined);
    const transport = new WebStandardStreamableHTTPServerTransport({
        enableJsonResponse: true,
        maxRequestBodySize: 128 * 1024,
    });
    const server = createMcpServer(owner, env.siteUrl(request));
    await server.connect(transport);
    const answer = await transport.handleRequest(request, {
        authInfo: {
            token: owner.token,
            clientId: owner.clientId,
            scopes: ["email"],
            expiresAt: owner.expiresAt,
            resource: new URL(mcpResource(request)),
            extra: { owner: owner.id },
        },
    });
    const headers = new Headers(answer.headers);
    for (const [name, value] of Object.entries(MCP_CORS)) headers.set(name, value);
    headers.set("cache-control", "no-store");
    return new Response(answer.body, { status: answer.status, headers });
}

export function GET(): Response {
    return Response.json({ error: "Use MCP Streamable HTTP POST requests." }, { status: 405, headers: { allow: "POST" } });
}

export function DELETE(): Response {
    return new Response(null, { status: 405, headers: { allow: "POST" } });
}

export function OPTIONS(): Response {
    return new Response(null, {
        status: 204,
        headers: {
            ...MCP_CORS,
            "access-control-max-age": "86400",
            "access-control-allow-methods": "POST, OPTIONS",
            "access-control-allow-headers": "authorization, content-type, accept, mcp-protocol-version, mcp-session-id",
        },
    });
}
