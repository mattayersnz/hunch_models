import { env } from "@/lib/env";
import { mcpResource } from "@/lib/mcp-auth";

export function GET(request: Request): Response {
    return Response.json({
        resource: mcpResource(request),
        resource_name: "Hunch models",
        resource_documentation: `${env.siteUrl(request)}/agents`,
        authorization_servers: [`${env.supabaseUrl().replace(/\/$/, "")}/auth/v1`],
        scopes_supported: ["email"],
        bearer_methods_supported: ["header"],
    }, {
        headers: {
            "access-control-allow-origin": "*",
            "cache-control": "public, max-age=300",
        },
    });
}
