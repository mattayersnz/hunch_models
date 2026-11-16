import { browserAuth, browserUser, sameOrigin } from "@/lib/browser-auth";
import { NextResponse } from "next/server";

export async function POST(request: Request): Promise<Response> {
    if (!sameOrigin(request)) return new Response("forbidden", { status: 403 });
    const user = await browserUser();
    if (!user) return NextResponse.redirect(new URL("/sign-in", request.url), 303);
    const form = await request.formData();
    const authorizationId = form.get("authorization_id");
    const decision = form.get("decision");
    if (typeof authorizationId !== "string" || !authorizationId) return NextResponse.redirect(new URL("/agents?oauth=invalid", request.url), 303);

    const client = await browserAuth();
    const result = decision === "approve"
        ? await client.auth.oauth.approveAuthorization(authorizationId, { skipBrowserRedirect: true })
        : await client.auth.oauth.denyAuthorization(authorizationId, { skipBrowserRedirect: true });
    if (result.error || !result.data?.redirect_url) return NextResponse.redirect(new URL("/agents?oauth=failed", request.url), 303);
    return NextResponse.redirect(result.data.redirect_url, 303);
}

