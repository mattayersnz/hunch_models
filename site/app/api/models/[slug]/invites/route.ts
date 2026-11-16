// GET  → the model's invite links (without their keys, which are never kept).
// POST { label? } → a new invite link. Its key is in this response and nowhere else.

import { handle, json, readBody, requireOwner, text } from "@/lib/http";
import { createInvite, ownedModel } from "@/lib/models";
import { env } from "@/lib/env";
import type { InviteRow } from "@/lib/rows";
import { admin } from "@/lib/supabase";

type Context = { params: Promise<{ slug: string }> };

export async function GET(request: Request, { params }: Context): Promise<Response> {
    return handle(async () => {
        const owner = await requireOwner(request);
        const row = await ownedModel((await params).slug, owner.id);
        const { data, error } = await admin().from("invites").select("id, label, created_at, revoked_at").eq("model_id", row.id).order("created_at", { ascending: false });
        if (error) throw error;
        return json({ invites: data as Pick<InviteRow, "id" | "label" | "created_at" | "revoked_at">[] });
    });
}

export async function POST(request: Request, { params }: Context): Promise<Response> {
    return handle(async () => {
        const owner = await requireOwner(request);
        const row = await ownedModel((await params).slug, owner.id);
        const body = await readBody(request, 1024);
        const { invite, key } = await createInvite(row.id, text(body, "label", 80));
        return json({ id: invite.id, label: invite.label, url: `${env.siteUrl(request)}/m/${row.slug}?k=${key}` }, 201);
    });
}
