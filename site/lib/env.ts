// Server configuration. Read lazily so a build without secrets still compiles.

function required(name: string): string {
    const value = process.env[name];
    if (!value) throw new Error(`${name} is not set`);
    return value;
}

export const env = {
    supabaseUrl: (): string => required("SUPABASE_URL"),
    anonKey: (): string => required("SUPABASE_ANON_KEY"),
    serviceKey: (): string => required("SUPABASE_SERVICE_ROLE_KEY"),
    ipSalt: (): string => required("IP_SALT"),
    /** Where links point. Falls back to the request's own origin in development. */
    siteUrl: (request: Request): string => (process.env.SITE_URL ?? new URL(request.url).origin).replace(/\/$/, ""),
};
