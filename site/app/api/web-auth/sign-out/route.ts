import { browserAuth, sameOrigin } from "@/lib/browser-auth";
import { NextResponse } from "next/server";

export async function POST(request: Request): Promise<Response> {
    if (!sameOrigin(request)) return new Response("forbidden", { status: 403 });
    const client = await browserAuth();
    await client.auth.signOut();
    return NextResponse.redirect(new URL("/", request.url), 303);
}

