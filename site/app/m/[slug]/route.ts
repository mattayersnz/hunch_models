// GET /m/:slug[?k=key] → the model as a page.
//
// Served as a plain HTML response rather than a React page: the renderer already
// writes the whole document, and a page people open from a message should be small,
// fast and run nothing it does not need.

import { randomBytes } from "node:crypto";
import { HttpError } from "@/lib/http";
import { access, counts, modelBySlug, versionDoc } from "@/lib/models";
import { countsByPiece, modelPage } from "@/lib/page";

type Context = { params: Promise<{ slug: string }> };

const notFound = (): Response =>
    new Response(
        `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Not found</title><body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#0b0b0b;color:#a3a3a3;font:15px/1.6 system-ui,sans-serif"><p>This model is not here. If someone sent you a link, ask them for a new one.</p>`,
        { status: 404, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" } },
    );

export async function GET(request: Request, { params }: Context): Promise<Response> {
    const { slug } = await params;
    const key = new URL(request.url).searchParams.get("k");
    try {
        const { row } = await access(await modelBySlug(slug), key);
        const [model, rows] = await Promise.all([versionDoc(row.id, row.current_version), counts(row.id)]);
        const nonce = randomBytes(16).toString("base64");
        const html = modelPage({ model, slug: row.slug, key: row.visibility === "invite" ? key : null, counts: countsByPiece(rows), nonce });
        const headers: Record<string, string> = {
            "content-type": "text/html; charset=utf-8",
            "content-security-policy": `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
            "referrer-policy": "no-referrer",
            "x-content-type-options": "nosniff",
            // Counts change as people respond, and an invite page must never sit in a shared cache.
            "cache-control": "no-store",
        };
        if (row.visibility === "invite") headers["x-robots-tag"] = "noindex, nofollow";
        return new Response(html, { headers });
    } catch (error) {
        if (error instanceof HttpError && error.status === 404) return notFound();
        console.error(error);
        return new Response("Something went wrong.", { status: 500, headers: { "cache-control": "no-store" } });
    }
}
