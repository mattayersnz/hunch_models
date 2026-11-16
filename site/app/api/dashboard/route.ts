import { browserAuth, browserUser, safeNext, sameOrigin } from "@/lib/browser-auth";
import { env } from "@/lib/env";
import { createInvite, ownedModel } from "@/lib/models";
import type { ResponseRow } from "@/lib/rows";
import { admin } from "@/lib/supabase";
import { NextResponse } from "next/server";

function back(request: Request, path: string): NextResponse {
    return NextResponse.redirect(new URL(safeNext(path), request.url), 303);
}

export async function POST(request: Request): Promise<Response> {
    if (!sameOrigin(request)) return new Response("forbidden", { status: 403 });
    const user = await browserUser();
    if (!user) return NextResponse.redirect(new URL("/sign-in?next=/dashboard", request.url), 303);
    const form = await request.formData();
    const action = form.get("action");
    const returnTo = safeNext(form.get("return"));

    try {
        if (action === "visibility") {
            const slug = String(form.get("slug") ?? "");
            const visibility = form.get("visibility");
            if (visibility !== "invite" && visibility !== "public") throw new Error("invalid visibility");
            const row = await ownedModel(slug, user.id);
            const { error } = await admin().from("models").update({ visibility, updated_at: new Date().toISOString() }).eq("id", row.id);
            if (error) throw error;
        } else if (action === "create_invite") {
            const slug = String(form.get("slug") ?? "");
            const row = await ownedModel(slug, user.id);
            const rawLabel = String(form.get("label") ?? "").trim();
            const label = rawLabel ? [...rawLabel].slice(0, 80).join("") : null;
            const { key } = await createInvite(row.id, label);
            const response = back(request, returnTo);
            const inviteURL = `${env.siteUrl(request)}/m/${slug}?k=${key}`;
            response.cookies.set("hunch-invite", `${slug}|${encodeURIComponent(inviteURL)}`, { httpOnly: true, sameSite: "lax", secure: new URL(request.url).protocol === "https:", path: "/dashboard", maxAge: 120 });
            return response;
        } else if (action === "revoke_invite") {
            const row = await ownedModel(String(form.get("slug") ?? ""), user.id);
            const invite = String(form.get("invite_id") ?? "");
            if (!/^[0-9a-f-]{36}$/.test(invite)) throw new Error("invalid invite");
            const { error } = await admin().from("invites").update({ revoked_at: new Date().toISOString() }).eq("id", invite).eq("model_id", row.id).is("revoked_at", null);
            if (error) throw error;
        } else if (action === "response_visibility") {
            const id = String(form.get("response_id") ?? "");
            const hidden = form.get("hidden") === "true";
            if (!/^[0-9a-f-]{36}$/.test(id)) throw new Error("invalid response");
            const { data, error: findError } = await admin().from("responses").select("id, models!inner(owner)").eq("id", id).maybeSingle();
            if (findError) throw findError;
            const found = data as (Pick<ResponseRow, "id"> & { models: { owner: string } }) | null;
            if (!found || found.models.owner !== user.id) throw new Error("no such response");
            const { error } = await admin().from("responses").update({ hidden }).eq("id", id);
            if (error) throw error;
        } else if (action === "unpublish") {
            if (form.get("confirm") !== "yes") throw new Error("confirmation required");
            const row = await ownedModel(String(form.get("slug") ?? ""), user.id);
            const { error } = await admin().from("models").delete().eq("id", row.id);
            if (error) throw error;
        } else if (action === "revoke_grant") {
            const clientId = String(form.get("client_id") ?? "");
            const client = await browserAuth();
            const { error } = await client.auth.oauth.revokeGrant({ clientId });
            if (error) throw error;
        } else if (action === "delete_account") {
            if (form.get("confirm") !== "DELETE") throw new Error("confirmation required");
            const { error } = await admin().auth.admin.deleteUser(user.id, false);
            if (error) throw error;
            const response = back(request, "/");
            const client = await browserAuth();
            await client.auth.signOut();
            return response;
        } else {
            throw new Error("unknown action");
        }
        return back(request, returnTo);
    } catch (error) {
        console.error(error);
        const url = new URL(returnTo, request.url);
        url.searchParams.set("error", "action");
        return NextResponse.redirect(url, 303);
    }
}

