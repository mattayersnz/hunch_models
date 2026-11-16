// Reading and writing models on behalf of a route. All SQL access lives here.

import "server-only";
import { readModel, type HunchModel } from "@hunch/model";
import { HttpError } from "./http";
import type { CountRow, InviteRow, ModelRow, ResponseRow, VersionRow, Visibility } from "./rows";
import { admin } from "./supabase";
import { isInviteKey, isSlug, randomToken, sha256 } from "./tokens";

export const MAX_MODEL_BYTES = 64 * 1024;

export function visibilityOf(value: unknown, fallback: Visibility): Visibility {
    if (value === undefined || value === null) return fallback;
    if (value === "public" || value === "invite") return value;
    throw new HttpError(400, "visibility must be public or invite");
}

/** A model from a request body, cleaned by the same reader every client uses. */
export function modelFrom(value: unknown): { model: HunchModel; problems: string[] } {
    const { model, problems } = readModel(value);
    if (!model) throw new HttpError(400, "not a model", problems);
    return { model, problems };
}

export async function modelBySlug(slug: string): Promise<ModelRow | null> {
    if (!isSlug(slug)) return null;
    const { data, error } = await admin().from("models").select("*").eq("slug", slug).maybeSingle();
    if (error) throw error;
    return (data as ModelRow | null) ?? null;
}

/** The owner's model, or a 404 that does not say whether someone else's exists. */
export async function ownedModel(slug: string, owner: string): Promise<ModelRow> {
    const row = await modelBySlug(slug);
    if (!row || row.owner !== owner) throw new HttpError(404, "no such model");
    return row;
}

export async function versionDoc(modelId: string, n: number): Promise<HunchModel> {
    const { data, error } = await admin().from("model_versions").select("doc").eq("model_id", modelId).eq("n", n).single();
    if (error) throw error;
    const { model } = readModel((data as Pick<VersionRow, "doc">).doc);
    if (!model) throw new Error(`stored version ${n} of ${modelId} does not read`);
    return model;
}

export async function allVersions(modelId: string): Promise<Map<number, HunchModel>> {
    const { data, error } = await admin().from("model_versions").select("n, doc").eq("model_id", modelId).order("n");
    if (error) throw error;
    const out = new Map<number, HunchModel>();
    for (const row of data as Pick<VersionRow, "n" | "doc">[]) {
        const { model } = readModel(row.doc);
        if (model) out.set(row.n, model);
    }
    return out;
}

export async function createModel(owner: string, model: HunchModel, visibility: Visibility): Promise<ModelRow> {
    for (let attempt = 0; attempt < 3; attempt++) {
        const { data, error } = await admin()
            .from("models")
            .insert({ owner, slug: randomToken(12), title: model.title, visibility })
            .select("*")
            .single();
        if (error?.code === "23505") continue; // slug collision: astronomically rare, try another
        if (error) throw error;
        const row = data as ModelRow;
        const { error: versionError } = await admin().from("model_versions").insert({ model_id: row.id, n: 1, doc: model });
        if (versionError) {
            await admin().from("models").delete().eq("id", row.id);
            throw versionError;
        }
        return row;
    }
    throw new Error("could not choose a slug");
}

/** Adds a version only when the model actually changed, so a repeated publish is free. */
export async function republish(row: ModelRow, model: HunchModel, visibility: Visibility): Promise<{ row: ModelRow; changed: boolean }> {
    const current = await versionDoc(row.id, row.current_version);
    const changed = JSON.stringify(current) !== JSON.stringify(model);
    const next = changed ? row.current_version + 1 : row.current_version;
    if (changed) {
        const { error } = await admin().from("model_versions").insert({ model_id: row.id, n: next, doc: model });
        if (error) throw error;
    }
    if (!changed && visibility === row.visibility) return { row, changed };
    const { data, error } = await admin()
        .from("models")
        .update({ title: model.title, visibility, current_version: next, updated_at: new Date().toISOString() })
        .eq("id", row.id)
        .select("*")
        .single();
    if (error) throw error;
    return { row: data as ModelRow, changed };
}

export async function counts(modelId: string): Promise<CountRow[]> {
    const { data, error } = await admin().rpc("response_counts", { p_model: modelId });
    if (error) throw error;
    return (data as CountRow[]).map((row) => ({ ...row, n: Number(row.n) }));
}

export async function responsesOf(modelId: string): Promise<ResponseRow[]> {
    const { data, error } = await admin()
        .from("responses")
        .select("id, model_id, version, piece_id, kind, body, name, responder, invite_id, hidden, created_at")
        .eq("model_id", modelId)
        .order("created_at", { ascending: false })
        .limit(2000);
    if (error) throw error;
    return data as ResponseRow[];
}

// MARK: - Invites

export async function createInvite(modelId: string, label: string | null): Promise<{ invite: InviteRow; key: string }> {
    const key = randomToken(32);
    const { data, error } = await admin()
        .from("invites")
        .insert({ model_id: modelId, token_hash: sha256(key), label })
        .select("*")
        .single();
    if (error) throw error;
    return { invite: data as InviteRow, key };
}

/** The live invite a key opens on this model, or null. */
export async function inviteFor(modelId: string, key: string | null): Promise<InviteRow | null> {
    if (!key || !isInviteKey(key)) return null;
    const { data, error } = await admin()
        .from("invites")
        .select("*")
        .eq("model_id", modelId)
        .eq("token_hash", sha256(key))
        .is("revoked_at", null)
        .maybeSingle();
    if (error) throw error;
    return (data as InviteRow | null) ?? null;
}

/**
 * Whether a visitor may see this model. A public model is open to anyone; an invite
 * model needs a live key. Either way the answer to "no" is a 404, never a 403, so a
 * slug alone says nothing about whether a private model exists.
 */
export async function access(row: ModelRow | null, key: string | null): Promise<{ row: ModelRow; invite: InviteRow | null }> {
    if (!row) throw new HttpError(404, "no such model");
    const invite = await inviteFor(row.id, key);
    if (row.visibility === "invite" && !invite) throw new HttpError(404, "no such model");
    return { row, invite };
}
