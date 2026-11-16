// The two clients. `admin` bypasses row level security and is the only way the site
// touches the tables; it never leaves the server. `auth` is the anon client, used
// only to send and check sign-in codes.

import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env";

const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };

let adminClient: SupabaseClient | null = null;

export function admin(): SupabaseClient {
    adminClient ??= createClient(env.supabaseUrl(), env.serviceKey(), options);
    return adminClient;
}

/** A fresh anon client per call: its session state must not leak between requests. */
export function auth(): SupabaseClient {
    return createClient(env.supabaseUrl(), env.anonKey(), options);
}
