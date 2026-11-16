// POST /m/:slug/respond { piece, kind, body?, name?, responder, key? }
//
// The one public write. Anyone with the page may respond; that is the point. What
// keeps it honest is small: the piece must be in the model as it stands, a reaction
// replaces the same responder's last one, and a burst from one address or one
// browser is slowed down.

import { piecesOf } from "@hunch/model";
import { HttpError, handle, ipHash, json, readBody, text } from "@/lib/http";
import { access, modelBySlug, versionDoc } from "@/lib/models";
import { REACTIONS, RESPONSE_KINDS, type ResponseKind } from "@/lib/rows";
import { admin } from "@/lib/supabase";

type Context = { params: Promise<{ slug: string }> };

const WINDOW_MINUTES = 10;
const LIMIT_PER_WINDOW = 40;

async function recentCount(column: "ip_hash" | "responder", value: string): Promise<number> {
    const since = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString();
    const { count, error } = await admin().from("responses").select("id", { count: "exact", head: true }).eq(column, value).gte("created_at", since);
    if (error) throw error;
    return count ?? 0;
}

/** The page posting here must be served from the host this request came to. */
function isSameSite(request: Request): boolean {
    const origin = request.headers.get("origin");
    if (!origin) return true; // not a browser cross-site request
    let host: string;
    try {
        host = new URL(origin).host;
    } catch {
        return false;
    }
    const allowed = [request.headers.get("x-forwarded-host"), request.headers.get("host"), process.env.SITE_URL ? new URL(process.env.SITE_URL).host : null];
    return allowed.some((candidate) => candidate === host);
}

export async function POST(request: Request, { params }: Context): Promise<Response> {
    return handle(async () => {
        // A page on another site may not post here on a visitor's behalf.
        if (!isSameSite(request)) throw new HttpError(403, "not from this site");

        const body = await readBody(request, 4096);
        const key = text(body, "key", 64);
        const { row, invite } = await access(await modelBySlug((await params).slug), key);

        const kind = body.kind;
        if (typeof kind !== "string" || !(RESPONSE_KINDS as readonly string[]).includes(kind)) throw new HttpError(400, "unknown kind of response");
        const responseKind = kind as ResponseKind;
        const responder = text(body, "responder", 64, true)!;
        if (!/^[A-Za-z0-9]{16,64}$/.test(responder)) throw new HttpError(400, "bad responder");
        const said = text(body, "body", 1000);
        const name = text(body, "name", 60);
        if (!REACTIONS.includes(responseKind) && !said) throw new HttpError(400, "say something first");

        const model = await versionDoc(row.id, row.current_version);
        const piece = body.piece === null || body.piece === undefined || body.piece === "" ? null : body.piece;
        if (piece !== null && (typeof piece !== "string" || !piecesOf(model).has(piece))) throw new HttpError(400, "that line is no longer in the model");

        const ip = ipHash(request);
        if ((ip && (await recentCount("ip_hash", ip)) >= LIMIT_PER_WINDOW) || (await recentCount("responder", responder)) >= LIMIT_PER_WINDOW) {
            throw new HttpError(429, "That is a lot of responses. Try again in a few minutes.");
        }

        const record = { model_id: row.id, version: row.current_version, piece_id: piece, kind: responseKind, body: said, name, responder, ip_hash: ip, invite_id: invite?.id ?? null };
        if (REACTIONS.includes(responseKind)) {
            const { error } = await admin().rpc("record_reaction", {
                p_model: record.model_id, p_version: record.version, p_piece: record.piece_id, p_kind: record.kind,
                p_body: record.body, p_name: record.name, p_responder: record.responder, p_ip_hash: record.ip_hash, p_invite: record.invite_id,
            });
            if (error) throw error;
        } else {
            const { error } = await admin().from("responses").insert(record);
            if (error) throw error;
        }

        // The piece's counts as they now stand, so the page can update without reloading.
        let query = admin().from("responses").select("kind").eq("model_id", row.id).eq("hidden", false);
        query = piece === null ? query.is("piece_id", null) : query.eq("piece_id", piece);
        const { data, error } = await query;
        if (error) throw error;
        const tally: Partial<Record<ResponseKind, number>> = {};
        for (const { kind: k } of data as { kind: ResponseKind }[]) tally[k] = (tally[k] ?? 0) + 1;
        return json({ ok: true, counts: tally }, 201);
    });
}
