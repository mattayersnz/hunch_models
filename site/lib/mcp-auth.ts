import "server-only";

import { admin, auth } from "./supabase";
import { env } from "./env";

export interface McpOwner {
    id: string;
    email: string | null;
    clientId: string;
    token: string;
    expiresAt: number;
}

function bearer(request: Request): string | null {
    const match = /^Bearer\s+(\S+)$/i.exec(request.headers.get("authorization") ?? "");
    return match?.[1] ?? null;
}

function audienceIncludes(value: unknown, expected: string): boolean {
    return typeof value === "string" ? value === expected : Array.isArray(value) && value.includes(expected);
}

export function mcpResource(request: Request): string {
    return process.env.MCP_RESOURCE_URL?.replace(/\/$/, "") ?? `${env.siteUrl(request)}/mcp`;
}

/** Headers that let a browser-based MCP client read this endpoint's answers. */
export const MCP_CORS = {
    "access-control-allow-origin": "*",
    "access-control-expose-headers": "www-authenticate, mcp-session-id, mcp-protocol-version",
};

export function mcpChallenge(request: Request, error?: "invalid_token"): Response {
    const metadata = `${env.siteUrl(request)}/.well-known/oauth-protected-resource/mcp`;
    const detail = error ? ` error="${error}",` : "";
    return Response.json(
        { error: error ?? "authorization_required", error_description: "Connect hunch.tech and approve access first." },
        {
            status: 401,
            headers: {
                ...MCP_CORS,
                "cache-control": "no-store",
                "www-authenticate": `Bearer${detail} resource_metadata="${metadata}"`,
            },
        },
    );
}

/** A Supabase OAuth token issued for this MCP resource, never an ordinary Hunch session. */
export async function mcpOwner(request: Request): Promise<McpOwner | null> {
    const token = bearer(request);
    if (!token) return null;
    const { data, error } = await auth().auth.getClaims(token);
    if (error || !data) return null;
    const claims = data.claims;
    const clientId = claims.client_id;
    if (typeof claims.sub !== "string" || typeof clientId !== "string") return null;
    const expected = mcpResource(request);
    const localMayUseProductionAudience = process.env.NODE_ENV !== "production" && audienceIncludes(claims.aud, "https://hunch.tech/mcp");
    if (!audienceIncludes(claims.aud, expected) && !localMayUseProductionAudience) return null;
    // A signature only proves the token was issued. Whether it still stands (the person
    // pressed Disconnect, or deleted the account) is something only Supabase can say, and
    // without asking a revoked agent would keep working until the token expired.
    const { data: live, error: gone } = await admin().auth.getUser(token);
    if (gone || live.user?.id !== claims.sub) return null;
    return {
        id: claims.sub,
        email: typeof claims.email === "string" ? claims.email : null,
        clientId,
        token,
        expiresAt: claims.exp,
    };
}
