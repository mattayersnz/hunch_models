// GET    → the owner's model: its current version and settings.
// PUT    { model, visibility? } → republish. A new version only if the model changed.
// DELETE → unpublish: the model, every version, invite and response.

import { handle, json, readBody, requireOwner } from "@/lib/http";
import { MAX_MODEL_BYTES, modelFrom, ownedModel, republish, versionDoc, visibilityOf } from "@/lib/models";
import { env } from "@/lib/env";
import { admin } from "@/lib/supabase";

type Context = { params: Promise<{ slug: string }> };

export async function GET(request: Request, { params }: Context): Promise<Response> {
    return handle(async () => {
        const owner = await requireOwner(request);
        const row = await ownedModel((await params).slug, owner.id);
        const model = await versionDoc(row.id, row.current_version);
        return json({ slug: row.slug, url: `${env.siteUrl(request)}/m/${row.slug}`, visibility: row.visibility, version: row.current_version, model });
    });
}

export async function PUT(request: Request, { params }: Context): Promise<Response> {
    return handle(async () => {
        const owner = await requireOwner(request);
        const current = await ownedModel((await params).slug, owner.id);
        const body = await readBody(request, MAX_MODEL_BYTES);
        const { model, problems } = modelFrom(body.model);
        const { row, changed } = await republish(current, model, visibilityOf(body.visibility, current.visibility));
        return json({ slug: row.slug, url: `${env.siteUrl(request)}/m/${row.slug}`, visibility: row.visibility, version: row.current_version, changed, problems });
    });
}

export async function DELETE(request: Request, { params }: Context): Promise<Response> {
    return handle(async () => {
        const owner = await requireOwner(request);
        const row = await ownedModel((await params).slug, owner.id);
        const { error } = await admin().from("models").delete().eq("id", row.id);
        if (error) throw error;
        return json({ deleted: true });
    });
}
