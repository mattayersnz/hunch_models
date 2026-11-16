// End-to-end check of the site, driving the API the way Hunch will.
//
// Locally (`supabase start`, `npm run dev`), sign-in codes are read from Mailpit:
//   node scripts/smoke.ts [site-url] [mailpit-url]
//
// Against a deployed site there is no inbox to read, so set SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY. Then one real code is emailed to Resend's test inbox
// (proving SMTP works), each test owner's code comes from the auth admin API, and
// every user the run made is deleted at the end, taking their models with them.
//   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… SUPABASE_ANON_KEY=… node scripts/smoke.ts https://hunch.tech

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

const SITE = process.argv[2] ?? "http://127.0.0.1:4620";
const MAIL = process.argv[3] ?? "http://127.0.0.1:55324";
const SUPABASE = process.env.SUPABASE_URL ?? "http://127.0.0.1:55321";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
/** Deployed: codes come from the admin API, and the run cleans up after itself. */
const ADMIN_MODE = Boolean(SERVICE_KEY) && !SITE.startsWith("http://127.0.0.1") && !SITE.startsWith("http://localhost");
const madeUsers: string[] = [];

interface Session {
    access_token: string;
}
interface Published {
    slug: string;
    url: string;
    version: number;
    visibility: string;
    changed?: boolean;
}
interface Draft {
    title: string;
    scenes: { name: string; people: { name: string; does: (string | { text: string })[] }[] }[];
}
interface OwnerResponse {
    id: string;
    kind: string;
    body: string | null;
    piece: { kind: string; text: string } | null;
    current: boolean;
    hidden: boolean;
}

let passed = 0;
function step(name: string): void {
    passed++;
    console.log(`ok ${passed} - ${name}`);
}

async function call(method: string, path: string, body?: unknown, token?: string, headers: Record<string, string> = {}): Promise<{ status: number; json: Record<string, unknown>; text: string; headers: Headers }> {
    const response = await fetch(SITE + path, {
        method,
        headers: { ...(body ? { "content-type": "application/json" } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers },
        body: body === undefined ? undefined : JSON.stringify(body),
        redirect: "manual",
    });
    const text = await response.text();
    let json: Record<string, unknown> = {};
    try {
        json = JSON.parse(text) as Record<string, unknown>;
    } catch {
        // an HTML page
    }
    return { status: response.status, json, text, headers: response.headers };
}

async function codeFor(email: string): Promise<string> {
    for (let attempt = 0; attempt < 20; attempt++) {
        const list = (await (await fetch(`${MAIL}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`)).json()) as { messages: { ID: string }[] };
        if (list.messages.length) {
            const message = (await (await fetch(`${MAIL}/api/v1/message/${list.messages[0].ID}`)).json()) as { Text: string; HTML: string };
            const match = /\b(\d{6})\b/.exec(message.Text || message.HTML);
            if (match) return match[1];
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error(`no code arrived for ${email}`);
}

async function admin(method: string, path: string, body?: unknown): Promise<Record<string, unknown>> {
    const response = await fetch(`${SUPABASE}/auth/v1/admin/${path}`, {
        method,
        headers: { apikey: SERVICE_KEY!, ...(SERVICE_KEY!.startsWith("ey") ? { authorization: `Bearer ${SERVICE_KEY}` } : {}), "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`admin ${path}: ${response.status} ${text}`);
    return text ? (JSON.parse(text) as Record<string, unknown>) : {};
}

/** A code for this address without sending email: make the user, then ask for a magic link's OTP. */
async function adminCodeFor(email: string): Promise<string> {
    const user = await admin("POST", "users", { email, email_confirm: true });
    madeUsers.push(String(user.id));
    const link = await admin("POST", "generate_link", { type: "magiclink", email });
    const properties = (link.properties ?? link) as Record<string, unknown>;
    return String(properties.email_otp);
}

async function signIn(): Promise<string> {
    const email = `smoke-${randomBytes(4).toString("hex")}@example.test`;
    let code: string;
    if (ADMIN_MODE) {
        code = await adminCodeFor(email);
    } else {
        const sent = await call("POST", "/api/auth/code", { email });
        assert.equal(sent.status, 200, sent.text);
        code = await codeFor(email);
    }
    const verified = await call("POST", "/api/auth/verify", { email, code });
    assert.equal(verified.status, 200, verified.text);
    return (verified.json as unknown as Session).access_token;
}

const responder = randomBytes(12).toString("hex");
const other = randomBytes(12).toString("hex");

// MARK: - Signing in and publishing

if (ADMIN_MODE) {
    // One real email, to Resend's test inbox: Supabase only accepts this if SMTP works.
    const delivered = "delivered@resend.dev";
    const sent = await call("POST", "/api/auth/code", { email: delivered });
    assert.equal(sent.status, 200, `sending a code failed, so SMTP is not working: ${sent.text}`);
    const users = (await admin("GET", "users?per_page=200")) as { users?: { id: string; email: string }[] };
    const made = users.users?.find((user) => user.email === delivered);
    if (made) madeUsers.push(made.id);
    step("a sign-in code is emailed through the configured SMTP");
}

const token = await signIn();
step("an owner signs in with a code");

assert.equal((await call("POST", "/api/auth/verify", { email: "nobody@example.test", code: "000000" })).status, 401);
step("a wrong code is refused");

const draft = JSON.parse(readFileSync(new URL("../examples/first-flat.json", import.meta.url), "utf8")) as Draft;
assert.equal((await call("POST", "/api/models", { model: draft })).status, 401);
step("publishing needs a session");

assert.equal((await call("POST", "/api/models", { model: { title: "" } }, token)).status, 400);
step("a model that does not read is refused with its problems");

const created = await call("POST", "/api/models", { model: draft }, token);
assert.equal(created.status, 201, created.text);
const published = created.json as unknown as Published;
assert.equal(published.visibility, "invite");
assert.match(published.slug, /^[A-Za-z0-9]{12}$/);
step("publishing is invite-only by default");

// MARK: - Invite links

assert.equal((await call("GET", `/m/${published.slug}`)).status, 404);
assert.equal((await call("GET", `/m/${published.slug}?k=${"x".repeat(32)}`)).status, 404);
step("an invite model is a 404 without a live key");

const invite = await call("POST", `/api/models/${published.slug}/invites`, { label: "Sam" }, token);
assert.equal(invite.status, 201, invite.text);
const inviteUrl = new URL(String(invite.json.url));
const key = inviteUrl.searchParams.get("k")!;
const page = await call("GET", `/m/${published.slug}?k=${key}`);
assert.equal(page.status, 200);
assert.ok(page.text.includes("Finding a first flat"));
assert.match(page.headers.get("x-robots-tag") ?? "", /noindex/);
assert.match(page.headers.get("content-security-policy") ?? "", /script-src 'nonce-/);
step("an invite link opens the page, unindexed and under a strict CSP");

// MARK: - Responding

const line = (await call("GET", `/api/models/${published.slug}`, undefined, token)).json as { model: { scenes: { people: { does: { id: string; text: string }[] }[] }[] } };
const lineId = line.model.scenes[0].people[0].does[0].id;

const respond = (body: Record<string, unknown>, headers: Record<string, string> = {}) =>
    call("POST", `/m/${published.slug}/respond`, { key, responder, ...body }, undefined, { origin: SITE, ...headers });

let reply = await respond({ piece: lineId, kind: "resonates" });
assert.equal(reply.status, 201, reply.text);
reply = await respond({ piece: lineId, kind: "differs", body: "I message straight away" });
assert.deepEqual(reply.json.counts, { differs: 1 });
step("a reaction is replaced when the same person answers again");

reply = await call("POST", `/m/${published.slug}/respond`, { key, responder: other, piece: lineId, kind: "resonates" }, undefined, { origin: SITE });
assert.deepEqual(reply.json.counts, { differs: 1, resonates: 1 });
step("another person's reaction counts separately");

assert.equal((await respond({ piece: lineId, kind: "note" })).status, 400);
assert.equal((await respond({ piece: "dzzzzzzzzzzzzz", kind: "resonates" })).status, 400);
assert.equal((await respond({ piece: lineId, kind: "shout" })).status, 400);
assert.equal((await respond({ piece: lineId, kind: "resonates" }, { origin: "https://elsewhere.example" })).status, 403);
assert.equal((await call("POST", `/m/${published.slug}/respond`, { responder, piece: lineId, kind: "resonates" }, undefined, { origin: SITE })).status, 404);
step("empty notes, unknown pieces and kinds, other sites and missing keys are refused");

assert.equal((await respond({ piece: null, kind: "idea", body: "Show the median wait for a reply" })).status, 201);
step("an idea about the whole model is kept");

// MARK: - The owner's view

const listed = await call("GET", `/api/models/${published.slug}/responses`, undefined, token);
const responses = (listed.json as { responses: OwnerResponse[] }).responses;
assert.equal(responses.length, 3);
const differs = responses.find((r) => r.kind === "differs")!;
assert.equal(differs.piece?.text, "scrolls listings on her phone");
assert.equal(differs.body, "I message straight away");
step("the owner reads every response with the line it was about");

const stranger = await signIn();
assert.equal((await call("GET", `/api/models/${published.slug}/responses`, undefined, stranger)).status, 404);
assert.equal((await call("PATCH", `/api/responses/${differs.id}`, { hidden: true }, stranger)).status, 404);
step("another owner sees nothing of it");

assert.equal((await call("PATCH", `/api/responses/${differs.id}`, { hidden: true }, token)).status, 200);
reply = await call("POST", `/m/${published.slug}/respond`, { key, responder: randomBytes(12).toString("hex"), piece: lineId, kind: "resonates" }, undefined, { origin: SITE });
assert.deepEqual(reply.json.counts, { resonates: 2 });
step("a hidden response leaves the visible counts");

// MARK: - Republishing

const edited = structuredClone(draft);
edited.scenes[0].people[0].does.push("closes the app");
const again = (await call("PUT", `/api/models/${published.slug}`, { model: edited }, token)).json as unknown as Published;
assert.equal(again.version, 2);
assert.equal(again.changed, true);
const same = (await call("PUT", `/api/models/${published.slug}`, { model: edited }, token)).json as unknown as Published;
assert.equal(same.version, 2);
assert.equal(same.changed, false);
step("republishing adds a version only when the model changed");

const afterEdit = (await call("GET", `/api/models/${published.slug}/responses`, undefined, token)).json as { responses: OwnerResponse[] };
assert.ok(afterEdit.responses.every((r) => r.current));
step("responses to unchanged lines carry across versions");

// MARK: - Revoking and opening up

const invites = (await call("GET", `/api/models/${published.slug}/invites`, undefined, token)).json as { invites: { id: string }[] };
assert.equal((await call("DELETE", `/api/models/${published.slug}/invites/${invites.invites[0].id}`, undefined, token)).status, 200);
assert.equal((await call("GET", `/m/${published.slug}?k=${key}`)).status, 404);
step("a revoked invite link stops working");

await call("PUT", `/api/models/${published.slug}`, { model: edited, visibility: "public" }, token);
const open = await call("GET", `/m/${published.slug}`);
assert.equal(open.status, 200);
assert.equal(open.headers.get("x-robots-tag"), null);
step("a public model opens for anyone");

// MARK: - The database refuses the browser

const anonKey = process.env.SUPABASE_ANON_KEY;
if (anonKey) {
    for (const table of ["models", "model_versions", "invites", "responses"]) {
        const direct = await fetch(`${SUPABASE}/rest/v1/${table}?select=*`, { headers: { apikey: anonKey, authorization: `Bearer ${anonKey}` } });
        const rows = direct.ok ? ((await direct.json()) as unknown[]) : [];
        assert.ok(!direct.ok || rows.length === 0, `${table} readable with the anon key`);
    }
    const asOwner = await fetch(`${SUPABASE}/rest/v1/models?select=*`, { headers: { apikey: anonKey, authorization: `Bearer ${token}` } });
    assert.ok(!asOwner.ok || ((await asOwner.json()) as unknown[]).length === 0, "models readable with an owner's own token");
    step("the anon key and a user token read nothing directly");
} else {
    console.log("# skipped the direct-read check: set SUPABASE_ANON_KEY");
}

// MARK: - Unpublishing

assert.equal((await call("DELETE", `/api/models/${published.slug}`, undefined, token)).status, 200);
assert.equal((await call("GET", `/m/${published.slug}`)).status, 404);
step("unpublishing removes the page");

// MARK: - Deleting the account

assert.equal((await call("DELETE", "/api/account")).status, 401);
step("account deletion needs a session");

const accountModelReply = await call("POST", "/api/models", { model: draft }, token);
assert.equal(accountModelReply.status, 201, accountModelReply.text);
const accountModel = accountModelReply.json as unknown as Published;
const accountInviteReply = await call("POST", `/api/models/${accountModel.slug}/invites`, { label: "Deletion check" }, token);
assert.equal(accountInviteReply.status, 201, accountInviteReply.text);
const accountInvite = new URL(String(accountInviteReply.json.url));
const accountKey = accountInvite.searchParams.get("k")!;
assert.equal((await call(
    "POST",
    `/m/${accountModel.slug}/respond`,
    { key: accountKey, responder: randomBytes(12).toString("hex"), piece: lineId, kind: "resonates" },
    undefined,
    { origin: SITE },
)).status, 201);

assert.equal((await call("DELETE", "/api/account", undefined, token)).status, 200);
assert.equal((await call("GET", `/m/${accountModel.slug}?k=${accountKey}`)).status, 404);
assert.equal((await call("GET", "/api/models", undefined, token)).status, 401);
const deletedUser = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString()) as { sub?: string };
const deletedUserIndex = deletedUser.sub ? madeUsers.indexOf(deletedUser.sub) : -1;
if (deletedUserIndex >= 0) madeUsers.splice(deletedUserIndex, 1);
step("deleting an account removes its user, models, invites and responses");

if (madeUsers.length) {
    for (const id of madeUsers) await admin("DELETE", `users/${id}`);
    const left = (await admin("GET", "users?per_page=200")) as { users?: { id: string }[] };
    assert.ok(!left.users?.some((user) => madeUsers.includes(user.id)), "test users remain");
    step(`the run's ${madeUsers.length} users, and everything they published, are deleted`);
}

console.log(`# ${passed} passed`);
