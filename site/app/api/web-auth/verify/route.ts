import { browserAuth, NEXT_COOKIE, safeNext, sameOrigin } from "@/lib/browser-auth";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(request: Request): Promise<Response> {
    if (!sameOrigin(request)) return new Response("forbidden", { status: 403 });
    const tokenHash = (await request.formData()).get("token_hash");
    const failed = NextResponse.redirect(new URL("/sign-in?error=link", request.url), 303);
    if (typeof tokenHash !== "string" || !tokenHash) return failed;

    const store = await cookies();
    const next = safeNext(store.get(NEXT_COOKIE)?.value);
    const client = await browserAuth();
    const { error } = await client.auth.verifyOtp({ token_hash: tokenHash, type: "email" });
    if (error) return failed;
    store.delete(NEXT_COOKIE);
    return NextResponse.redirect(new URL(next, request.url), 303);
}
