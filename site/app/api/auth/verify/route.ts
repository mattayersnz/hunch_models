// POST { email, code } → a session for Hunch to keep in the Keychain.

import { handle, json, readBody, text, HttpError } from "@/lib/http";
import { auth } from "@/lib/supabase";

export async function POST(request: Request): Promise<Response> {
    return handle(async () => {
        const body = await readBody(request, 1024);
        const email = text(body, "email", 254, true)!.toLowerCase();
        const code = text(body, "code", 12, true)!.replace(/\s/g, "");
        const { data, error } = await auth().auth.verifyOtp({ email, token: code, type: "email" });
        if (error || !data.session) throw new HttpError(401, "that code did not work");
        const { session } = data;
        return json({
            access_token: session.access_token,
            refresh_token: session.refresh_token,
            expires_at: session.expires_at,
            user: { id: session.user.id, email: session.user.email },
        });
    });
}
