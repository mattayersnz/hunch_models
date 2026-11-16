// POST { email } → emails a six-digit sign-in code. Hunch is the only caller.

import { handle, json, readBody, text, HttpError } from "@/lib/http";
import { auth } from "@/lib/supabase";

export async function POST(request: Request): Promise<Response> {
    return handle(async () => {
        const body = await readBody(request, 1024);
        const email = text(body, "email", 254, true)!.toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, "that is not an email address");
        const { error } = await auth().auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
        if (error) throw new HttpError(error.status === 429 ? 429 : 400, error.message);
        return json({ sent: true });
    });
}
