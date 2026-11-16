// The shapes rows come back in. The tables are described in
// supabase/migrations; these are what the server code relies on.

export type Visibility = "public" | "invite";
export type ResponseKind = "resonates" | "differs" | "note" | "idea";
export const RESPONSE_KINDS: readonly ResponseKind[] = ["resonates", "differs", "note", "idea"];
export const REACTIONS: readonly ResponseKind[] = ["resonates", "differs"];

export interface ModelRow {
    id: string;
    owner: string;
    slug: string;
    title: string;
    visibility: Visibility;
    current_version: number;
    created_at: string;
    updated_at: string;
}

export interface VersionRow {
    model_id: string;
    n: number;
    doc: unknown;
    created_at: string;
}

export interface InviteRow {
    id: string;
    model_id: string;
    token_hash: string;
    label: string | null;
    created_at: string;
    revoked_at: string | null;
}

export interface ResponseRow {
    id: string;
    model_id: string;
    version: number;
    piece_id: string | null;
    kind: ResponseKind;
    body: string | null;
    name: string | null;
    responder: string;
    invite_id: string | null;
    hidden: boolean;
    created_at: string;
}

export interface CountRow {
    piece_id: string | null;
    kind: ResponseKind;
    n: number;
}
