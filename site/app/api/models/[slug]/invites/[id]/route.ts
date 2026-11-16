// DELETE → revokes an invite link. Responses made through it stay.

import { handle, json, requireOwner, HttpError } from "@/lib/http";
import { ownedModel } from "@/lib/models";
import { admin } from "@/lib/supabase";

type Context = { params: Promise<{ slug: string; id: string }> };

export async function DELETE(request: Request, { params }: Context): Promise<Response> {
    return handle(async () => {
        const owner = await requireOwner(request);
        const { slug, id } = await params;
        const row = await ownedModel(slug, owner.id);
        if (!/^[0-9a-f-]{36}$/.test(id)) throw new HttpError(404, "no such invite");
        const { data, error } = await admin()
            .from("invites")
            .update({ revoked_at: new Date().toISOString() })
            .eq("id", id)
            .eq("model_id", row.id)
            .is("revoked_at", null)
            .select("id");
        if (error) throw error;
        if (!data?.length) throw new HttpError(404, "no such invite");
        return json({ revoked: true });
    });
}
