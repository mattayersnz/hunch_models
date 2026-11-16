// GET  → the owner's models, newest first, with response counts.
// POST { model, visibility? } → publishes a new model. Invite-only unless asked.

import { handle, json, readBody, requireOwner } from "@/lib/http";
import { MAX_MODEL_BYTES, createModel, modelFrom, visibilityOf } from "@/lib/models";
import { env } from "@/lib/env";
import type { ModelRow } from "@/lib/rows";
import { admin } from "@/lib/supabase";

export async function GET(request: Request): Promise<Response> {
    return handle(async () => {
        const owner = await requireOwner(request);
        const { data, error } = await admin()
            .from("models")
            .select("slug, title, visibility, current_version, created_at, updated_at, responses(count)")
            .eq("owner", owner.id)
            .order("updated_at", { ascending: false });
        if (error) throw error;
        const rows = data as (Pick<ModelRow, "slug" | "title" | "visibility" | "current_version" | "created_at" | "updated_at"> & { responses: { count: number }[] })[];
        const base = env.siteUrl(request);
        return json({
            models: rows.map(({ responses, ...row }) => ({ ...row, url: `${base}/m/${row.slug}`, responses: responses[0]?.count ?? 0 })),
        });
    });
}

export async function POST(request: Request): Promise<Response> {
    return handle(async () => {
        const owner = await requireOwner(request);
        const body = await readBody(request, MAX_MODEL_BYTES);
        const { model, problems } = modelFrom(body.model);
        const row = await createModel(owner.id, model, visibilityOf(body.visibility, "invite"));
        return json({ slug: row.slug, url: `${env.siteUrl(request)}/m/${row.slug}`, visibility: row.visibility, version: 1, problems }, 201);
    });
}
