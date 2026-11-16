// PATCH { hidden } → the owner hides or shows a response. Hidden responses stay in
// the owner's list and leave the counts visitors see.

import { handle, json, readBody, requireOwner, HttpError } from "@/lib/http";
import type { ResponseRow } from "@/lib/rows";
import { admin } from "@/lib/supabase";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Context): Promise<Response> {
    return handle(async () => {
        const owner = await requireOwner(request);
        const { id } = await params;
        if (!/^[0-9a-f-]{36}$/.test(id)) throw new HttpError(404, "no such response");
        const body = await readBody(request, 256);
        if (typeof body.hidden !== "boolean") throw new HttpError(400, "hidden must be true or false");
        const { data: found, error: findError } = await admin().from("responses").select("id, model_id, models!inner(owner)").eq("id", id).maybeSingle();
        if (findError) throw findError;
        const row = found as (Pick<ResponseRow, "id" | "model_id"> & { models: { owner: string } }) | null;
        if (!row || row.models.owner !== owner.id) throw new HttpError(404, "no such response");
        const { error } = await admin().from("responses").update({ hidden: body.hidden }).eq("id", id);
        if (error) throw error;
        return json({ id, hidden: body.hidden });
    });
}
