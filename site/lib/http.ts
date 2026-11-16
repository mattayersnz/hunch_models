// Request and response helpers shared by every route.

import "server-only";
import { admin } from "./supabase";
import { env } from "./env";
import { sha256 } from "./tokens";

export class HttpError extends Error {
    constructor(readonly status: number, message: string, readonly detail?: string[]) {
        super(message);
    }
}

const NO_STORE = { "cache-control": "no-store" };

export const json = (body: unknown, status = 200): Response => Response.json(body, { status, headers: NO_STORE });

/** Runs a handler, turning an HttpError into its status and anything else into a 500. */
export async function handle(run: () => Promise<Response>): Promise<Response> {
    try {
        return await run();
    } catch (error) {
        if (error instanceof HttpError) return json({ error: error.message, ...(error.detail ? { problems: error.detail } : {}) }, error.status);
        console.error(error);
        return json({ error: "something went wrong" }, 500);
    }
}

type Bag = Record<string, unknown>;

/** The body as an object, refusing anything over `limit` bytes or not JSON. */
export async function readBody(request: Request, limit: number): Promise<Bag> {
    const declared = Number(request.headers.get("content-length") ?? "0");
    if (declared > limit) throw new HttpError(413, "too large");
    const text = await request.text();
    if (new TextEncoder().encode(text).length > limit) throw new HttpError(413, "too large");
    let value: unknown;
    try {
        value = JSON.parse(text);
    } catch {
        throw new HttpError(400, "expected JSON");
    }
    if (typeof value !== "object" || value === null || Array.isArray(value)) throw new HttpError(400, "expected a JSON object");
    return value as Bag;
}

export function text(bag: Bag, key: string, limit: number, required = false): string | null {
    const value = bag[key];
    if (value === undefined || value === null || value === "") {
        if (required) throw new HttpError(400, `${key} is required`);
        return null;
    }
    if (typeof value !== "string") throw new HttpError(400, `${key} must be text`);
    const trimmed = value.trim();
    if ([...trimmed].length > limit) throw new HttpError(400, `${key} is longer than ${limit} characters`);
    if (trimmed) return trimmed;
    if (required) throw new HttpError(400, `${key} is required`);
    return null;
}

export interface Owner {
    id: string;
    email: string | null;
}

/** The signed-in owner from `Authorization: Bearer <access token>`. */
export async function requireOwner(request: Request): Promise<Owner> {
    const header = request.headers.get("authorization") ?? "";
    const match = /^Bearer\s+(\S+)$/i.exec(header);
    if (!match) throw new HttpError(401, "sign in first");
    const { data, error } = await admin().auth.getUser(match[1]);
    if (error || !data.user) throw new HttpError(401, "sign in again");
    return { id: data.user.id, email: data.user.email ?? null };
}

/** A salted hash of the caller's address, so a flood can be slowed without keeping IPs. */
export function ipHash(request: Request): string | null {
    const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip");
    return forwarded ? sha256(`${env.ipSalt()}|${forwarded}`) : null;
}
