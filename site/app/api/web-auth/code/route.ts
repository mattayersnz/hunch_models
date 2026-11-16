import { NEXT_COOKIE, safeNext, sameOrigin } from "@/lib/browser-auth";
import { auth } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function POST(request: Request): Promise<Response> {
    // Without this another site could have a visitor's browser ask for someone's link.
    if (!sameOrigin(request)) return new Response("forbidden", { status: 403 });
    const form = await request.formData();
    const email = typeof form.get("email") === "string" ? String(form.get("email")).trim().toLowerCase() : "";
    const next = safeNext(form.get("next"));
    const back = new URL("/sign-in", request.url);
    back.searchParams.set("next", next);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
        back.searchParams.set("error", "email");
        return NextResponse.redirect(back, 303);
    }

    // The email's link carries a token hash to /auth/confirm (see supabase/templates), so
    // nothing here depends on which browser opens it.
    const { error } = await auth().auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
    back.searchParams.set(error ? "error" : "sent", error ? "send" : "1");
    const response = NextResponse.redirect(back, 303);
    // Where to land afterwards is remembered here, not in the email: the same template
    // serves codes the Hunch app asks for, which have nowhere to go.
    response.cookies.set(NEXT_COOKIE, next, { httpOnly: true, sameSite: "lax", secure: new URL(request.url).protocol === "https:", path: "/", maxAge: 3600 });
    return response;
}
