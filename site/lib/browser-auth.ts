import "server-only";

import { createServerClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { env } from "./env";

/** Where to land after the emailed link, remembered by the browser that asked for it. */
export const NEXT_COOKIE = "hunch-next";

/** A request-local Supabase client whose session lives only in secure cookies. */
export async function browserAuth() {
    const store = await cookies();
    return createServerClient(env.supabaseUrl(), env.anonKey(), {
        cookies: {
            getAll: () => store.getAll(),
            setAll: (values) => {
                try {
                    for (const { name, value, options } of values) store.set(name, value, options);
                } catch {
                    // Server Components cannot write response cookies. Route handlers can,
                    // and every operation that changes auth state runs through one.
                }
            },
        },
    });
}

/**
 * The person signed in to this browser. A token issued to an OAuth client is never a
 * browser session, even placed in the session cookie: the dashboard deletes accounts and
 * models, which a connected agent is promised it cannot do.
 */
export async function browserUser(): Promise<User | null> {
    const client = await browserAuth();
    const { data: claimed, error: claimsError } = await client.auth.getClaims();
    if (claimsError || !claimed || "client_id" in claimed.claims) return null;
    const { data, error } = await client.auth.getUser();
    return error ? null : data.user;
}

/** Whether a form post came from this site's own pages. Cookies alone are not proof. */
export function sameOrigin(request: Request): boolean {
    const origin = request.headers.get("origin");
    if (!origin) return false;
    const allowed = new Set([new URL(request.url).origin, env.siteUrl(request)]);
    return allowed.has(origin.replace(/\/$/, ""));
}

/** Refuse absolute and scheme-relative destinations in every browser auth redirect. */
export function safeNext(value: FormDataEntryValue | string | null | undefined, fallback = "/dashboard"): string {
    if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return fallback;
    try {
        const parsed = new URL(value, "https://hunch.invalid");
        return parsed.origin === "https://hunch.invalid" ? `${parsed.pathname}${parsed.search}${parsed.hash}` : fallback;
    } catch {
        return fallback;
    }
}

