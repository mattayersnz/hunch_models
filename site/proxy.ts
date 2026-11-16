import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";

/** Keep the browser's short-lived access token and rotating refresh token together. */
export async function proxy(request: NextRequest) {
    let response = NextResponse.next({ request });
    const client = createServerClient(env.supabaseUrl(), env.anonKey(), {
        cookies: {
            getAll: () => request.cookies.getAll(),
            setAll: (values) => {
                for (const { name, value } of values) request.cookies.set(name, value);
                response = NextResponse.next({ request });
                for (const { name, value, options } of values) response.cookies.set(name, value, options);
            },
        },
    });
    // getClaims verifies a present session and performs a refresh when necessary.
    await client.auth.getClaims();
    return response;
}

export const config = {
    // Only pages and form posts that read the browser session. The MCP endpoint, its
    // discovery document and the Hunch app's REST API carry bearer tokens, never cookies.
    matcher: ["/((?!_next/static|_next/image|favicon.ico|mcp|\\.well-known|agents/protocol\\.md|api/auth|api/models|api/responses|api/account|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};

