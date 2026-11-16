import "server-only";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import { PIECES, piecesOf, readModelMarkdown, type HunchModel } from "@hunch/model";
import { agentProtocol } from "./protocol";
import { HttpError } from "./http";
import { admin } from "./supabase";
import { allVersions, createInvite, createModel, ownedModel, republish, responsesOf, versionDoc } from "./models";
import type { InviteRow, ModelRow, ResponseRow, Visibility } from "./rows";
import type { McpOwner } from "./mcp-auth";

const slug = z.string().regex(/^[A-Za-z0-9]{12}$/, "a slug is twelve letters or numbers");
const visibility = z.enum(["invite", "public"]);
const markdown = z.string().max(64 * 1024);

function ok(value: unknown) {
    return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] };
}

const CODES: Record<number, string> = { 400: "invalid_model", 404: "not_found", 429: "rate_limited" };

/**
 * Only a refusal this site wrote is repeated to the agent. Anything else is a database
 * or network error whose text names tables and constraints, so it is logged, not sent.
 */
function fail(error: unknown) {
    const known = error instanceof HttpError ? error : null;
    if (!known) console.error(error);
    const body = known
        ? { code: CODES[known.status] ?? "tool_failed", message: known.message, ...(known.detail ? { problems: known.detail } : {}), retryable: known.status === 429 }
        : { code: "server_error", message: "something went wrong; check list_models before retrying a publish", retryable: true };
    return { isError: true, content: [{ type: "text" as const, text: JSON.stringify(body) }] };
}

async function safely(run: () => Promise<unknown> | unknown) {
    try {
        return ok(await run());
    } catch (error) {
        return fail(error);
    }
}

function compile(source: string): { model: HunchModel; problems: string[] } {
    const { model, problems } = readModelMarkdown(source);
    if (!model) throw new HttpError(400, "That Markdown is not a model.", problems);
    return { model, problems };
}

function url(base: string, path: string): string {
    return `${base.replace(/\/$/, "")}${path}`;
}

/** New models one owner may publish through an agent in an hour. A loop stops here. */
const PUBLISH_LIMIT = 20;

async function underPublishLimit(owner: string): Promise<void> {
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count, error } = await admin().from("models").select("id", { count: "exact", head: true }).eq("owner", owner).gte("created_at", since);
    if (error) throw error;
    if ((count ?? 0) >= PUBLISH_LIMIT) throw new HttpError(429, `no more than ${PUBLISH_LIMIT} new models an hour; use update_model to change one`);
}

const readOnly = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const writesModel = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true };

export function createMcpServer(owner: McpOwner, siteURL: string): McpServer {
    const server = new McpServer(
        { name: "hunch-models", version: "1.0.0" },
        {
            instructions: "Read hunch://protocol/markdown before drafting. Publishing changes the outside world: publish only when the person explicitly asks, and default to invite-only.",
            maxToolInputElements: 500,
        },
    );

    server.registerResource("Hunch model Markdown", "hunch://protocol/markdown", {
        title: "Hunch model Markdown protocol",
        description: "The complete authoring, publishing, privacy and tool contract.",
        mimeType: "text/markdown",
    }, async (uri) => ({ contents: [{ uri: uri.href, mimeType: "text/markdown", text: agentProtocol }] }));

    server.registerResource("Hunch model pieces", "hunch://kit/pieces", {
        title: "Available isometric pieces",
        description: "Known prop names and aliases. Unknown props still draw as labelled crates.",
        mimeType: "application/json",
    }, async (uri) => ({
        contents: [{
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(PIECES.map(({ name, aliases }) => ({ name, aliases })), null, 2),
        }],
    }));

    server.registerTool("validate_model", {
        title: "Validate model Markdown",
        description: "Compile Hunch model Markdown without saving or publishing anything. Read hunch://protocol/markdown first.",
        inputSchema: { markdown },
        annotations: readOnly,
    }, ({ markdown: source }) => safely(() => {
        const result = readModelMarkdown(source);
        return { valid: result.model !== null, model: result.model, problems: result.problems };
    }));

    server.registerTool("publish_model", {
        title: "Publish a new hunch model",
        description: "Publish only after an explicit request. Defaults to invite-only; invite publishing creates one secret share URL shown once.",
        inputSchema: {
            markdown,
            visibility: visibility.optional().describe("Omit for invite-only. Use public only when explicitly requested."),
            invite_label: z.string().max(80).optional(),
        },
        annotations: writesModel,
    }, ({ markdown: source, visibility: requested, invite_label }) => safely(async () => {
        const compiled = compile(source);
        const chosen: Visibility = requested ?? "invite";
        await underPublishLimit(owner.id);
        const row = await createModel(owner.id, compiled.model, chosen);
        const pageUrl = url(siteURL, `/m/${row.slug}`);
        let shareUrl = pageUrl;
        if (chosen === "invite") {
            try {
                const { key } = await createInvite(row.id, invite_label ?? "Created by an agent");
                shareUrl = `${pageUrl}?k=${key}`;
            } catch (error) {
                // An invite-only model with no invite is a page nobody can open, and the
                // agent would be told publishing failed. Take it back so a retry is clean.
                await admin().from("models").delete().eq("id", row.id);
                throw error;
            }
        }
        return { slug: row.slug, version: 1, visibility: chosen, page_url: pageUrl, share_url: shareUrl, problems: compiled.problems };
    }));

    server.registerTool("update_model", {
        title: "Update a published hunch model",
        description: "Compile Markdown and publish a new immutable version only when its model content changed. Existing invite URLs remain valid.",
        inputSchema: { slug, markdown, visibility: visibility.optional() },
        annotations: writesModel,
    }, ({ slug: modelSlug, markdown: source, visibility: requested }) => safely(async () => {
        const current = await ownedModel(modelSlug, owner.id);
        const compiled = compile(source);
        const result = await republish(current, compiled.model, requested ?? current.visibility);
        return {
            slug: result.row.slug,
            version: result.row.current_version,
            visibility: result.row.visibility,
            changed: result.changed,
            page_url: url(siteURL, `/m/${result.row.slug}`),
            problems: compiled.problems,
        };
    }));

    server.registerTool("list_models", {
        title: "List published hunch models",
        description: "List this owner's models, newest first, including visibility, version and response count.",
        annotations: readOnly,
    }, () => safely(async () => {
        const { data, error } = await admin()
            .from("models")
            .select("slug, title, visibility, current_version, created_at, updated_at, responses(count)")
            .eq("owner", owner.id)
            .order("updated_at", { ascending: false });
        if (error) throw error;
        return {
            models: (data as (Pick<ModelRow, "slug" | "title" | "visibility" | "current_version" | "created_at" | "updated_at"> & { responses: { count: number }[] })[])
                .map(({ responses, ...row }) => ({ ...row, page_url: url(siteURL, `/m/${row.slug}`), responses: responses[0]?.count ?? 0 })),
        };
    }));

    server.registerTool("get_model", {
        title: "Read a published hunch model",
        description: "Return one current model.json snapshot. The source Markdown is not retained.",
        inputSchema: { slug },
        annotations: readOnly,
    }, ({ slug: modelSlug }) => safely(async () => {
        const row = await ownedModel(modelSlug, owner.id);
        return { slug: row.slug, version: row.current_version, visibility: row.visibility, model: await versionDoc(row.id, row.current_version) };
    }));

    server.registerTool("set_visibility", {
        title: "Change model visibility",
        description: "Make a model public or invite-only. Public is an open-world side effect and must be explicit.",
        inputSchema: { slug, visibility },
        annotations: { ...writesModel, idempotentHint: true },
    }, ({ slug: modelSlug, visibility: chosen }) => safely(async () => {
        const current = await ownedModel(modelSlug, owner.id);
        const model = await versionDoc(current.id, current.current_version);
        const { row } = await republish(current, model, chosen);
        return { slug: row.slug, visibility: row.visibility, page_url: url(siteURL, `/m/${row.slug}`) };
    }));

    server.registerTool("get_responses", {
        title: "Read responses to a hunch model",
        description: "Return owner-visible responses with the historical piece text and whether it is still current.",
        inputSchema: { slug },
        annotations: readOnly,
    }, ({ slug: modelSlug }) => safely(async () => {
        const row = await ownedModel(modelSlug, owner.id);
        const [versions, responses] = await Promise.all([allVersions(row.id), responsesOf(row.id)]);
        const pieces = new Map([...versions].map(([n, model]) => [n, piecesOf(model)]));
        const current = pieces.get(row.current_version);
        return {
            version: row.current_version,
            responses: responses.map(({ model_id: _model, responder, ...response }) => {
                const piece = response.piece_id ? pieces.get(response.version)?.get(response.piece_id) : null;
                return {
                    ...response,
                    responder: responder.slice(0, 6),
                    piece: piece ? { kind: piece.kind, text: piece.text } : null,
                    current: response.piece_id === null || (current?.has(response.piece_id) ?? false),
                };
            }),
        };
    }));

    server.registerTool("list_invites", {
        title: "List model invites",
        description: "List invite metadata. Secret keys cannot be recovered after creation.",
        inputSchema: { slug },
        annotations: readOnly,
    }, ({ slug: modelSlug }) => safely(async () => {
        const row = await ownedModel(modelSlug, owner.id);
        const { data, error } = await admin().from("invites")
            .select("id, label, created_at, revoked_at")
            .eq("model_id", row.id)
            .order("created_at", { ascending: false });
        if (error) throw error;
        return { invites: data as Pick<InviteRow, "id" | "label" | "created_at" | "revoked_at">[] };
    }));

    server.registerTool("create_invite", {
        title: "Create a model invite",
        description: "Create a secret invite URL. The key is shown in this result once and must not be logged or published.",
        inputSchema: { slug, label: z.string().max(80).optional() },
        annotations: writesModel,
    }, ({ slug: modelSlug, label }) => safely(async () => {
        const row = await ownedModel(modelSlug, owner.id);
        const { invite, key } = await createInvite(row.id, label ?? null);
        return { id: invite.id, label: invite.label, url: `${url(siteURL, `/m/${row.slug}`)}?k=${key}` };
    }));

    server.registerTool("revoke_invite", {
        title: "Revoke a model invite",
        description: "Make one invite URL stop working. Responses already made through it remain.",
        inputSchema: { slug, invite_id: z.string().uuid() },
        annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    }, ({ slug: modelSlug, invite_id }) => safely(async () => {
        const row = await ownedModel(modelSlug, owner.id);
        const { data, error } = await admin().from("invites")
            .update({ revoked_at: new Date().toISOString() })
            .eq("id", invite_id)
            .eq("model_id", row.id)
            .is("revoked_at", null)
            .select("id");
        if (error) throw error;
        if (!data?.length) throw new HttpError(404, "no such live invite");
        return { id: invite_id, revoked: true };
    }));

    return server;
}
