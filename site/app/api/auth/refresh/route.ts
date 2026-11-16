// POST { refresh_token } → a fresh session.

import { handle, json, readBody, text, HttpError } from "@/lib/http";
import { auth } from "@/lib/supabase";

export async function POST(request: Request): Promise<Response> {
    return handle(async () => {
        const body = await readBody(request, 4096);
        const refreshToken = text(body, "refresh_token", 2048, true)!;
        const { data, error } = await auth().auth.refreshSession({ refresh_token: refreshToken });
        if (error || !data.session) throw new HttpError(401, "sign in again");
        const { session } = data;
        return json({ access_token: session.access_token, refresh_token: session.refresh_token, expires_at: session.expires_at });
    });
}
