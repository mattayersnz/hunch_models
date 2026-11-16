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
import { createHash, randomBytes } from "node:crypto";

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

interface Mail {
    Text: string;
    HTML: string;
}

async function mailFor(email: string): Promise<Mail> {
    for (let attempt = 0; attempt < 20; attempt++) {
        const list = (await (await fetch(`${MAIL}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`)).json()) as { messages: { ID: string }[] };
        if (list.messages.length) return (await (await fetch(`${MAIL}/api/v1/message/${list.messages[0].ID}`)).json()) as Mail;
        await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error(`no email arrived for ${email}`);
}

function codeIn(message: Mail): string {
    const match = /\b(\d{6})\b/.exec(message.Text || message.HTML);
    if (!match) throw new Error("the email carries no code");
    return match[1];
}

/** The path of the email's sign-in link: /auth/confirm?token_hash=… */
function linkIn(message: Mail): string {
    const match = /href="[^"]*(\/auth\/confirm\?token_hash=[^"&]+)"/.exec(message.HTML);
    if (!match) throw new Error("the email carries no sign-in link");
    return match[1];
}

const codeFor = async (email: string): Promise<string> => codeIn(await mailFor(email));

// MARK: - A browser, for the web account

/** A cookie jar: the web account is a cookie session, which `call` does not keep. */
type Jar = Map<string, string>;

function keep(jar: Jar, response: Response): void {
    for (const line of response.headers.getSetCookie()) {
        const pair = line.split(";")[0];
        const at = pair.indexOf("=");
        const name = pair.slice(0, at);
        const value = pair.slice(at + 1);
        if (!value || /max-age=0/i.test(line)) jar.delete(name);
        else jar.set(name, value);
    }
}

const cookies = (jar: Jar): string => [...jar].map(([name, value]) => `${name}=${value}`).join("; ");

async function visit(jar: Jar, path: string): Promise<{ status: number; text: string; location: string }> {
    const response = await fetch(SITE + path, { redirect: "manual", headers: { cookie: cookies(jar) } });
    keep(jar, response);
    return { status: response.status, text: await response.text(), location: response.headers.get("location") ?? "" };
}

/** A form post, as the site's own pages make it. `origin: null` sends none. */
async function post(jar: Jar, path: string, fields: Record<string, string>, origin: string | null = SITE): Promise<{ status: number; location: string }> {
    const response = await fetch(SITE + path, {
        method: "POST",
        redirect: "manual",
        headers: { "content-type": "application/x-www-form-urlencoded", cookie: cookies(jar), ...(origin ? { origin } : {}) },
        body: new URLSearchParams(fields),
    });
    keep(jar, response);
    return { status: response.status, location: response.headers.get("location") ?? "" };
}

// MARK: - An MCP client

interface ToolReply {
    isError: boolean;
    data: Record<string, unknown>;
}

async function mcp(token: string | null, method: string, params: Record<string, unknown> = {}): Promise<Response> {
    return fetch(`${SITE}/mcp`, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json, text/event-stream", ...(token ? { authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    });
}

async function tool(token: string, name: string, args: Record<string, unknown> = {}): Promise<ToolReply> {
    const response = await mcp(token, "tools/call", { name, arguments: args });
    const reply = (await response.json()) as { result?: { isError?: boolean; content: { text: string }[] } };
    assert.ok(reply.result, `${name} answered ${response.status} with no result`);
    return { isError: reply.result.isError === true, data: JSON.parse(reply.result.content[0].text) as Record<string, unknown> };
}

const claimsOf = (jwt: string): Record<string, unknown> => JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString()) as Record<string, unknown>;

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

// MARK: - Agent discovery and web account entry

const protocol = await call("GET", "/agents/protocol.md");
assert.equal(protocol.status, 200, protocol.text);
assert.match(protocol.headers.get("content-type") ?? "", /text\/markdown/);
assert.ok(protocol.text.includes("https://hunch.tech/mcp"));
step("the canonical agent protocol is available as Markdown");

const metadata = await call("GET", "/.well-known/oauth-protected-resource/mcp");
assert.equal(metadata.status, 200, metadata.text);
assert.equal(metadata.json.resource, `${SITE}/mcp`);
assert.deepEqual(metadata.json.scopes_supported, ["email"]);
step("MCP publishes protected-resource discovery metadata");

const unauthenticatedMcp = await call("POST", "/mcp");
assert.equal(unauthenticatedMcp.status, 401, unauthenticatedMcp.text);
assert.match(unauthenticatedMcp.headers.get("www-authenticate") ?? "", /resource_metadata=/);
step("MCP requires an OAuth bearer token");

const signInPage = await call("GET", "/sign-in");
assert.equal(signInPage.status, 200, signInPage.text);
assert.ok(signInPage.text.includes("magic link"));
step("the web account offers passwordless sign-in");

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

// MARK: - The web account, and an agent over OAuth and MCP

const browser: Jar = new Map();
const webEmail = `smoke-web-${randomBytes(4).toString("hex")}@example.test`;
let webLink: string;
let appCode: string | null = null;
if (ADMIN_MODE) {
    // No inbox to read: the admin API hands over the same token hash the email would carry.
    const user = await admin("POST", "users", { email: webEmail, email_confirm: true });
    madeUsers.push(String(user.id));
    const link = await admin("POST", "generate_link", { type: "magiclink", email: webEmail });
    const properties = (link.properties ?? link) as Record<string, unknown>;
    webLink = `/auth/confirm?token_hash=${encodeURIComponent(String(properties.hashed_token))}`;
} else {
    assert.equal((await post(browser, "/api/web-auth/code", { email: webEmail, next: "/dashboard" }, "https://elsewhere.example")).status, 403);
    const asked = await post(browser, "/api/web-auth/code", { email: webEmail, next: "/dashboard" });
    assert.equal(asked.status, 303);
    assert.match(asked.location, /sent=1/, asked.location);
    const message = await mailFor(webEmail);
    webLink = linkIn(message);
    appCode = codeIn(message);
    step("a sign-in email is sent to the site's own form only, with a code and a link");
}

// A mail scanner follows links. Opening this one must spend nothing.
const scanner: Jar = new Map();
for (let round = 0; round < 2; round++) {
    const page = await visit(scanner, webLink);
    assert.equal(page.status, 200, page.text.slice(0, 200));
    assert.ok(page.text.includes("Sign in on this browser"));
}
if (appCode) {
    // The same token is the code Hunch asks its owner to type. It must still work.
    const second = `smoke-web-${randomBytes(4).toString("hex")}@example.test`;
    assert.equal((await post(new Map(), "/api/web-auth/code", { email: second, next: "/dashboard" })).status, 303);
    const message = await mailFor(second);
    await visit(new Map(), linkIn(message));
    const typed = await call("POST", "/api/auth/verify", { email: second, code: codeIn(message) });
    assert.equal(typed.status, 200, typed.text);
    assert.equal((await call("DELETE", "/api/account", undefined, (typed.json as unknown as Session).access_token)).status, 200);
}
step("opening the emailed link only shows a button, and leaves the code usable");

const tokenHash = new URL(webLink, SITE).searchParams.get("token_hash")!;
assert.equal((await post(browser, "/api/web-auth/verify", { token_hash: tokenHash }, null)).status, 403);
const signedIn = await post(browser, "/api/web-auth/verify", { token_hash: tokenHash });
assert.equal(signedIn.status, 303);
assert.ok(signedIn.location.endsWith("/dashboard"), signedIn.location);
const dashboard = await visit(browser, "/dashboard");
assert.equal(dashboard.status, 200);
assert.ok(dashboard.text.includes(webEmail));
assert.match((await post(new Map(), "/api/web-auth/verify", { token_hash: tokenHash })).location, /error=link/);
step("pressing the button signs the browser in, once");

const oauthServer = await fetch(`${SUPABASE}/auth/v1/.well-known/oauth-authorization-server`);
if (!oauthServer.ok) {
    console.log(`# skipped the agent connection: the Supabase OAuth server is off (${oauthServer.status})`);
} else {
    const endpoints = (await oauthServer.json()) as { registration_endpoint: string; authorization_endpoint: string; token_endpoint: string };
    const redirect = "http://127.0.0.1:9999/callback";
    const registered = await fetch(endpoints.registration_endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ client_name: "Hunch smoke test", redirect_uris: [redirect], grant_types: ["authorization_code", "refresh_token"], response_types: ["code"], token_endpoint_auth_method: "none" }),
    });
    const client = (await registered.json()) as { client_id?: string };
    assert.ok(client.client_id, `registration answered ${registered.status}`);
    const clientId = client.client_id;

    const verifier = randomBytes(32).toString("base64url");
    const authorize = new URL(endpoints.authorization_endpoint);
    const asking: Record<string, string> = {
        response_type: "code", client_id: clientId, redirect_uri: redirect, scope: "email", state: "smoke",
        code_challenge: createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256", resource: `${SITE}/mcp`,
    };
    for (const [name, value] of Object.entries(asking)) authorize.searchParams.set(name, value);
    const sentToConsent = (await fetch(authorize, { redirect: "manual" })).headers.get("location") ?? "";
    assert.match(sentToConsent, /\/oauth\/consent\?authorization_id=/, sentToConsent);
    const consentPath = sentToConsent.replace(/^https?:\/\/[^/]+/, "");
    const authorizationId = new URL(sentToConsent).searchParams.get("authorization_id")!;
    step("an agent registers itself and is sent to the consent page");

    assert.match((await visit(new Map(), consentPath)).location, /\/sign-in/);
    const consent = await visit(browser, consentPath);
    assert.equal(consent.status, 200);
    assert.ok(consent.text.includes("Hunch smoke test"));
    assert.ok(consent.text.includes("127.0.0.1:9999"), "the consent page does not say where the connection goes");
    assert.equal((await post(browser, "/api/oauth/consent", { authorization_id: authorizationId, decision: "approve" }, "https://elsewhere.example")).status, 403);
    step("consent needs a signed-in owner on this site, and names the agent's destination");

    const approved = await post(browser, "/api/oauth/consent", { authorization_id: authorizationId, decision: "approve" });
    assert.ok(approved.location.startsWith(redirect), approved.location);
    const exchanged = await fetch(endpoints.token_endpoint, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ grant_type: "authorization_code", code: new URL(approved.location).searchParams.get("code")!, redirect_uri: redirect, client_id: clientId, code_verifier: verifier }),
    });
    const grant = (await exchanged.json()) as { access_token?: string; refresh_token?: string };
    assert.ok(grant.access_token, `the token exchange answered ${exchanged.status}`);
    const agent = grant.access_token;
    const claims = claimsOf(agent);
    assert.equal(claims.aud, "https://hunch.tech/mcp", "the access-token hook is not enabled");
    assert.equal(claims.client_id, clientId);
    step("approval gives the agent a token stamped for MCP");

    const hello = await mcp(agent, "initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "smoke", version: "1" } });
    assert.equal(hello.status, 200, await hello.clone().text());
    assert.equal(hello.headers.get("access-control-allow-origin"), "*");
    assert.ok((await hello.text()).includes("hunch-models"));
    // A live Hunch session with a model of its own: the first owner's account is gone by now.
    const stranger = await signIn();
    const theirs = await call("POST", "/api/models", { model: draft }, stranger);
    assert.equal(theirs.status, 201, theirs.text);
    assert.equal((await call("GET", "/api/models", undefined, stranger)).status, 200);
    assert.equal((await mcp(stranger, "tools/list")).status, 401, "a Hunch app session opened /mcp");
    step("MCP opens for the agent's token and not for a Hunch session");

    // A task before the first scene and one inside it: neither may be published.
    const source = "# Smoke over MCP\n:type: model\n[ ] a private task\nThe premise.\n\n## Home\n:who: Mia\n. waits\n[ ] call [Bob]\n[hopes] ?";
    const made = await tool(agent, "publish_model", { markdown: source });
    assert.ok(!made.isError, JSON.stringify(made.data));
    const agentSlug = String(made.data.slug);
    assert.equal(made.data.visibility, "invite");
    assert.match(String(made.data.share_url), /\?k=[A-Za-z0-9]{32}$/);
    assert.equal((await call("GET", `/m/${agentSlug}`)).status, 404);
    assert.equal((await fetch(String(made.data.share_url))).status, 200);
    const read = await tool(agent, "get_model", { slug: agentSlug });
    const stored = JSON.stringify(read.data.model);
    assert.equal((read.data.model as { premise?: string }).premise, "The premise.");
    assert.ok(!stored.includes("task") && !stored.includes("Bob"), stored);
    step("an agent publishes from Markdown, invite-only, and private lines stay private");

    const refused = await tool(agent, "publish_model", { markdown: "# No type\n\n## Home" });
    assert.ok(refused.isError);
    assert.equal(refused.data.code, "invalid_model");
    assert.ok(Array.isArray(refused.data.problems));
    assert.equal((await tool(agent, "get_model", { slug: (theirs.json as unknown as Published).slug })).data.code, "not_found");
    assert.equal((await call("DELETE", "/api/account", undefined, stranger)).status, 200);
    const strangerId = String(claimsOf(stranger).sub);
    if (madeUsers.includes(strangerId)) madeUsers.splice(madeUsers.indexOf(strangerId), 1);
    step("refused Markdown says why, and another owner's model is not found");

    // The token is good at /mcp and nowhere else, even dressed as a browser session.
    assert.equal((await call("GET", "/api/models", undefined, agent)).status, 403);
    const sessionCookie = [...browser.keys()].find((name) => /^sb-.*-auth-token(\.0)?$/.test(name));
    assert.ok(sessionCookie, "no session cookie to imitate");
    const session = { access_token: agent, refresh_token: grant.refresh_token, token_type: "bearer", expires_in: 3600, expires_at: claims.exp, user: { id: claims.sub } };
    const forged: Jar = new Map([[sessionCookie.replace(/\.0$/, ""), `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`]]);
    assert.match((await visit(forged, "/dashboard")).location, /\/sign-in/);
    assert.match((await post(forged, "/api/dashboard", { action: "unpublish", slug: agentSlug, confirm: "yes", return: "/dashboard" })).location, /\/sign-in/);
    assert.match((await post(forged, "/api/dashboard", { action: "delete_account", confirm: "DELETE", return: "/" })).location, /\/sign-in/);
    assert.ok(!(await tool(agent, "get_model", { slug: agentSlug })).isError, "the forged session changed something");
    step("the agent's token is refused by the REST API and as a dashboard session");

    const disconnected = await post(browser, "/api/dashboard", { action: "revoke_grant", client_id: clientId, return: "/dashboard" });
    assert.equal(disconnected.status, 303);
    assert.ok(!disconnected.location.includes("error"), disconnected.location);
    const after = await mcp(agent, "tools/list");
    assert.equal(after.status, 401);
    assert.match(after.headers.get("www-authenticate") ?? "", /invalid_token/);
    step("disconnecting the agent stops its token at once");

    if (ADMIN_MODE) {
        // Best effort: a registered client is the one thing deleting the user leaves behind.
        await fetch(`${SUPABASE}/auth/v1/admin/oauth/clients/${clientId}`, { method: "DELETE", headers: { apikey: SERVICE_KEY!, ...(SERVICE_KEY!.startsWith("ey") ? { authorization: `Bearer ${SERVICE_KEY}` } : {}) } });
    }
}

assert.equal((await post(browser, "/api/dashboard", { action: "delete_account", confirm: "DELETE", return: "/" }, null)).status, 403);
const closed = await post(browser, "/api/dashboard", { action: "delete_account", confirm: "DELETE", return: "/" });
assert.equal(closed.status, 303);
assert.match((await visit(browser, "/dashboard")).location, /\/sign-in/);
if (ADMIN_MODE) {
    const users = (await admin("GET", "users?per_page=200")) as { users?: { id: string; email: string }[] };
    assert.ok(!users.users?.some((user) => user.email === webEmail), "the web account's user remains");
    for (const id of [...madeUsers]) if (!users.users?.some((user) => user.id === id)) madeUsers.splice(madeUsers.indexOf(id), 1);
}
step("the dashboard deletes the web account, and only from the site's own form");

if (madeUsers.length) {
    for (const id of madeUsers) await admin("DELETE", `users/${id}`);
    const left = (await admin("GET", "users?per_page=200")) as { users?: { id: string }[] };
    assert.ok(!left.users?.some((user) => madeUsers.includes(user.id)), "test users remain");
    step(`the run's ${madeUsers.length} users, and everything they published, are deleted`);
}

console.log(`# ${passed} passed`);
