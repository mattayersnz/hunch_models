# CLAUDE.md

Guidance for Claude Code working in this repository.

**Hunch models** is the hosted half of Hunch. A hunch model is a few small isometric scenes
of how someone thinks things go for people: who they are, where they are, what they do,
what they think. The author writes it as a note in the Hunch app, publishes it, and other
people open a link and say whether it matches their world. Not "is my idea good?" but
"is this how it is for you?"

This repo is public and MIT. It holds the format, the renderer, the piece kit, and the site
at **https://hunch.tech**. The Hunch app (github.com/mattayersnz/hunch) composes notes into
this format and talks to the site's API; its own CLAUDE.md has a "Hunch models" section for
that side. Since 16 November 2026 there is a second way in: an outside agent (Claude, Codex,
any MCP client) connects to **https://hunch.tech/mcp** and publishes a model from Markdown.
See "Agent access" below.

**Usually you are inside the Hunch repo, at `hunch/models/`**, where this repo is a git
submodule. Then the Hunch repo's `scripts/models.sh` is how work here is checked and shipped
(`setup`, `check`, `ship`), and "Working across both repos" in its CLAUDE.md is the
playbook. Commit here as in any repo; the Hunch repo then records which commit of this one
it goes with.

```
 model note (.md, truth) ──► Hunch ──► model.json ──► renderer ──► HTML + SVG
 in a Hunch collection      (Swift)   (FORMAT.md)    (this repo)   at hunch.tech/m/:slug
        ▲                                 ▲                                │
        │      Markdown from an agent ──► /mcp (readModelMarkdown)         │
        └──────── responses, shown in Hunch beside their lines ◄── API ◄───┘
```

The note is the authority. The site holds published snapshots and the responses to them,
and never writes back into a note.

## Commands

Node 22.18+ runs the TypeScript directly; there is no compile step for the packages.

```bash
npm install          # dev dependencies only: typescript, @types/node, esbuild; the site's own
npm test             # tests/*.test.ts: ids, reading, layout, rendering, the Markdown compiler
npm run check        # tsc over packages, examples, tests and scripts (the site has its own tsconfig)
npm run build        # examples/*.json → examples/out/*.html, dark and light
npm run bundle       # the renderer as one script → the Hunch app's Resources/model-renderer.js
npm run dev          # the site at http://127.0.0.1:4620 (needs local Supabase, below)
npm run smoke        # 37 end-to-end checks against the local site, codes and links read from Mailpit
npx tsc -p site      # typecheck the site
```

Local Supabase, on ports **553xx** so it can run beside another local Supabase project:

```bash
supabase start -x studio,imgproxy,edge-runtime,logflare,vector,supavisor,realtime,storage-api,postgres-meta
```

Copy `site/.env.example` to `site/.env.local` and fill it from `supabase status`. Mailpit
(sign-in emails) is at http://127.0.0.1:55324.

`supabase/config.toml` needs Supabase CLI **2.117 or later**: an older one refuses it with
"'db' has invalid keys". Matt's Mac has two, and a shell may find the old one first, so use
`/opt/homebrew/bin/supabase` there. The same goes for Node: `nvm` may default to 18, and
these commands need 22.18+.

The smoke test against the **live** site, which emails one real code to Resend's test inbox,
takes every other code from the auth admin API, and deletes every user it made:

```bash
SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… SUPABASE_ANON_KEY=… node scripts/smoke.ts https://hunch.tech
```

Never point the local-mode tests, or Hunch's `test-model-service.sh`, at hunch.tech: they
publish and delete without cleaning up users.

## Layout

```
packages/model/src/   format.ts   the document types and limits
                      ids.ts      content-keyed piece ids (part of the format)
                      read.ts     readModel: the one way in; lenient, recomputes every id
                      markdown.ts readModelMarkdown: Markdown from an agent → a draft → readModel
                      layout.ts   where everything in a scene goes; pure and deterministic
                      render.ts   modelHtml / pageHtml / sceneSvg; marks are separated here
                      browser.ts  previewHtml(json) for Hunch's offline preview (bundled)
packages/kit/src/     iso.ts      projection, extrusion, four-tone shading, fitting
                      pieces.ts   the kit: a person (stand, sit) and ~22 props, with aliases
                      svg.ts      solids to markup
                      theme.ts    THEME_CSS (dark, light, auto) and PAGE_CSS
site/                 Next.js 16 on Vercel (see "The site" and "Agent access")
                      AGENT_PROTOCOL.md  what an outside agent is told; served three ways
                      lib/mcp.ts         the MCP tools; lib/mcp-auth.ts who may call them
                      lib/browser-auth.ts  the web account's cookie session
supabase/             migrations/, sign-in email templates, config.toml (local)
examples/             five models as JSON, and build.ts
scripts/              bundle.ts, smoke.ts
tests/                model.test.ts, markdown.test.ts
```

`packages/kit` and `packages/model` are npm workspaces (`@hunch/kit`, `@hunch/model`) whose
`exports` point at TypeScript source; the site imports them through `transpilePackages`.

## The format and its ids — the contract with Hunch

`FORMAT.md` is the specification. A model is `{version: 1, title, premise?, scenes}`; a
scene is a name, an emoji, people and kit pieces; a person is a name, an `about`, and lines
they **do** and **think**, each with marks (`unsure`, `hunch`, `focus`).

**Ids are a function of content, and they are the only thing tying a response to a line.**
A piece's id is FNV-1a 64 over the UTF-8 of `["line", scene, person, kind, text, occurrence]`
(each part normalised: NFC, trimmed, whitespace collapsed, lowercased), in base 36, padded
to 13, with a one-letter prefix. An unchanged line keeps its id across republishes, so its
responses stay with it; an edited line is a new piece. `about` and `emoji` are deliberately
not in any id, so they can be refined.

**The site never trusts an id it is handed.** `readModel` recomputes every one from the
cleaned text. Hunch computes the same ids in Swift (`ModelAnchor.swift`) to find which line
of the note a response is about, so the two implementations must agree byte for byte —
including `read.ts`'s text cleaning (control characters to spaces, whitespace collapsed,
limits counted in **code points**, right-trimmed after a cut) and JavaScript's own
whitespace set. Hunch's `scripts/test-models.sh` hands a composed note to this repo's
`readModel` and compares every id. **Change `ids.ts`, `normaliseKey` or `cleanText` only
together with `ModelAnchor.swift`**, and never without re-running that script: a drift is
every published response losing its line. The pinned values in `tests/model.test.ts`
(`d3543mzzg29j96`, `t36gmremnch7ae`) exist to fail loudly first.

**A bad value costs only itself.** `readModel` drops what it cannot read and cuts what is
too long, reporting each in `problems`, and refuses a model only when it has no title or no
scene. Limits live in `LIMITS` in format.ts and are mirrored in `ModelComposer.swift`.

## The renderer and the kit

**Standard pieces and constrained generic looks, never hand-drawn scenes.** Every model
looks like every other, a stranger can read one in a minute, and every piece can take a
response. A prop name the kit does not know takes a cautious generic look when its words
are unambiguous, or draws as a labelled crate. `pieceLooks` can choose a generic family
explicitly while `pieces` keeps the semantic name; Markdown spells that `ticket machine as
appliance`. The renderer remains deterministic and never needs AI.

**Layout is pure and deterministic** — the same scene lays out the same way in Hunch's
preview, on the site and in a test. A scene is a 4 × 4 floor of 30-unit cells. People stand
along the middle diagonal (`PEOPLE_CELLS`), side by side as the viewer sees them; props
fill the cells behind them first so people are never hidden. The first seat in a scene is
moved under the first person, who sits. Standing people turn toward each other only
through the three turns that keep a face in view (east, southEast, south): a block head
seen side-on is a blank panel. A sitter faces the viewer, so the piece their first action
names is brought into the cell in front of them and turned to face them (`turned`), the
way a desk is pulled up. An action is drawn at the piece its text names, by name or alias
as a whole word; otherwise on the floor in front of the person, or beside them when
something stands in front (`looseSpots`). Names avoid other figures, furniture and each
other where a side allows, carry a halo, are cut at 16 characters in the drawing, and grow
on a narrow card through the `hm-scene` container query. The floor and
the fit are sized to the used cells (`boundsOf`, `fitWidth`), and `separate` lifts marks
that would overlap.

**Text is HTML, the drawing carries numbers and letters.** Words wrap, read at 390px, and
can be selected or read aloud; every line and its marker share a `data-id`, which is how
hover-linking and responding find each other.

**People are block figures from the same kit.** `personShapes` uses a cube head wider
than the body, a box torso, box arms and short box legs, with only lightly softened
corners, shared neutral four-tone material and a tiny SVG face on the head's front plane; it supports standing, every
turn and every seat. People have no inferred appearance or hair treatment. A face is drawn only when
its plane turns toward the viewer. People, standard props and generic props use the same
warm palette, softened default corners and outlines, so a person remains one object in the
scene rather than an illustration placed over it. The accent colour remains reserved for
hunch and unsure marks.

**Adding a piece**: append a `PieceDef` to `PIECES` in pieces.ts — its solids inside one
30 × 30 cell, listed back to front and bottom to top (that order is painter's order within
a cell), its `height` (where a marker hangs), aliases, and `seat`/`front` if a person can
sit on it. Then `npm run build`, look at it dark and light, and `npm run bundle` so Hunch's
preview matches.

Generic families live in `GENERIC_PIECES` in the same file and obey
`pieceDefProblems`: one 30 × 30 cell, at most eight approved primitives, and no geometry
above the cell's 30-unit height. Keep `PIECE_LOOKS`, Swift's `ModelPieceLook`, FORMAT.md
and the Markdown protocol in step. Suggestions in `suggestedPieceLook` must be cautious:
an ambiguous name is a labelled crate until the author or agent supplies `as <look>`.

The look is adapted from the Anatomy skill (MIT; attributed in `iso.ts` and `LICENSE`):
projection, extrusion, four-tone shading. Machine parts were deliberately not carried over.

## The site

Next.js on Vercel. **A model page and every API endpoint is a route handler**; no React runs
on a model page. The web account's pages (`/sign-in`, `/auth/confirm`, `/dashboard`,
`/oauth/consent`, `/agents`) are ordinary server components with no client script: every
action is a form post. `/m/:slug` returns the renderer's own HTML plus a few lines of plain script for
responding (`site/lib/page.ts`), under a strict CSP with a per-request nonce,
`referrer-policy: no-referrer` (an invite key is in the URL), and `no-store`.

**The database is reachable only through these routes.** Every table has row level security
on and *no* policies, and `anon` and `authenticated` have no privileges at all. The routes use
the service role (`site/lib/supabase.ts`, server-only) and check ownership themselves
(`requireOwner`, `ownedModel`). A leaked publishable key reads nothing; the smoke test
asserts it.

**No means 404, never 403.** A private model without a live key, and anyone else's model,
answer "not found", so a slug alone says nothing about whether a private model exists.

| Route | Who | What |
|---|---|---|
| `POST /api/auth/code` · `verify` · `refresh` | Hunch | email a code, exchange it for a session, renew it |
| `DELETE /api/account` | owner | permanently delete the account and everything it published |
| `GET` / `POST /api/models` | owner | list with counts; publish (invite-only unless asked) |
| `GET` / `PUT` / `DELETE /api/models/:slug` | owner | read; republish (a version only if changed); unpublish |
| `GET /api/models/:slug/responses` | owner | every response, with its piece's text and whether it is current |
| `GET` / `POST /api/models/:slug/invites`, `DELETE …/:id` | owner | list, make (key shown once), revoke |
| `PATCH /api/responses/:id` | owner | hide or show |
| `GET /m/:slug[?k=key]` | anyone with the link | the page |
| `POST /m/:slug/respond` | anyone with the link | resonates, differs, a note or an idea |
| `POST /mcp` | an approved agent | the MCP tools (Streamable HTTP, stateless, JSON replies) |
| `GET /.well-known/oauth-protected-resource/mcp` | anyone | where an MCP client finds the OAuth server |
| `GET /agents` · `/agents/protocol.md` · `/llms.txt` | anyone | the agent protocol, as a page and as Markdown |
| `GET /sign-in`, `POST /api/web-auth/code` | anyone | ask for a sign-in email |
| `GET /auth/confirm`, `POST /api/web-auth/verify` | the email's reader | a button; pressing it signs the browser in |
| `POST /api/web-auth/sign-out` | web owner | end the browser session |
| `GET /dashboard`, `/dashboard/models/:slug` | web owner | models, invites, responses, connected agents |
| `POST /api/dashboard` | web owner | visibility, invites, hide a response, unpublish, disconnect an agent, delete the account |
| `GET /oauth/consent`, `POST /api/oauth/consent` | web owner | approve or refuse an agent's connection |

The first block is the Hunch app's REST API, with a bearer session. The web account is a
cookie session. `/mcp` takes only an OAuth token. The three do not accept each other's
credentials, and that is the design, not an accident (see "Agent access").

Rules worth knowing before changing any of it:

- **Versions are immutable.** A republish inserts `model_versions` row n+1 only when the
  model's JSON changed; responses record the version they were given about.
- **Invite keys are stored only as a SHA-256.** The key is in the response that made it and
  nowhere else. Hunch remembers one invite per invite-only model as the owner's own link,
  because it cannot fetch a key again.
- **One reaction per browser per piece.** `record_reaction` (SQL) replaces a responder's
  earlier resonates/differs atomically; notes and ideas accumulate.
- **Visitors see counts, the owner sees words.** `response_counts` excludes hidden rows.
- **Rate limits** are per responder key and per salted IP hash (`IP_SALT`); raw addresses
  are never stored.
- **A respond request from another site is refused** by comparing its `Origin` host with
  the request's `Host`/`x-forwarded-host` and `SITE_URL` — not with `request.url`, which
  Next reports as `localhost` in development.
- Owner auth is Supabase email OTP proxied through `/api/auth/*`, so Hunch knows only the
  site's address. The hosted project sends 8-digit codes; nothing assumes a length.

## Supabase, Vercel and email

- **Schema** is `supabase/migrations/`. Add a new migration file for any change; never edit
  an applied one. Apply locally with `supabase db reset`. **Production is applied by
  `.github/workflows/migrations.yml`** on any push to `main` that adds a migration (it needs
  the `SUPABASE_ACCESS_TOKEN` secret and `SUPABASE_PROJECT_REF` variable on GitHub). From
  Matt's Mac `supabase db push` also works: the CLI login is enough, no database password.
  Vercel deploys from the same push at the same time, so a migration must be safe for the
  code already live — add before you depend, and never rename or drop in the same push.
- **Keys**: the site uses the new publishable and secret keys (legacy JWT keys retire in
  2027). They go in Vercel as `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`, set by the
  owner with `vercel env add`, never typed by an agent. Also `SUPABASE_URL`, `IP_SALT`,
  `SITE_URL=https://hunch.tech` (production only; previews use their own origin), and
  `MCP_RESOURCE_URL=https://hunch.tech/mcp` (all hosted environments).
- **Vercel** project `hunch-models`, Root Directory `site`, connected to GitHub: every push
  to `main` deploys hunch.tech, so **a push to `main` is a release** — run the checks first. `site/package.json` must declare everything `next build`
  needs (including `typescript`), because Vercel installs from that folder.
- **Email** goes through Resend SMTP from `no-reply@hunch.tech`. The Magic Link and Confirm
  Signup templates carry `{{ .Token }}` for Hunch and a link to
  `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}` for the web dashboard, never
  `{{ .ConfirmationURL }}`: that link spends the token on GET, so a mail scanner following it
  uses up the code before it is typed into Hunch. `/auth/confirm` only shows a button, and
  the button's POST verifies. Copies are in `supabase/templates/`; the hosted templates are
  pasted in by the owner and must match. hunch.tech's DNS also carries Google Workspace mail records — leave
  them alone when changing anything there.
- **Agent access** needs hosted Auth settings no migration can make: the OAuth server, its
  consent path, dynamic registration and the access-token hook. They are listed under
  "Agent access" above, with how to tell whether they are set.

## Agent access

An outside agent connects to `/mcp`, the person signs in on hunch.tech and approves it, and
the agent can then validate, publish and update models from Markdown, manage invites and
read responses. `site/AGENT_PROTOCOL.md` is what the agent is told, and it is the one source
for `/agents`, `/agents/protocol.md` and the MCP resource `hunch://protocol/markdown`:
change behaviour and that file together.

**As of 16 November 2026 the code is live and no agent can connect yet.** The hosted
project's OAuth server was still off (its discovery address answered 404). Matt has to set,
in the Supabase dashboard: the OAuth server on, consent path `/oauth/consent`, dynamic
client registration on, the custom access-token hook `public.hunch_access_token_hook`, and
the two email templates from `supabase/templates/`. Check
`<SUPABASE_URL>/auth/v1/.well-known/oauth-authorization-server` before assuming it is done.

**What an agent may not do is the point.** No tool unpublishes, hides a response or deletes
the account, and the consent page promises exactly that. Keep those human-only, in the
dashboard. Publishing defaults to invite-only; public needs to be asked for.

**An OAuth token is good at `/mcp` and nowhere else, and three places enforce it.**
Supabase's OAuth tokens are ordinary user JWTs, and its `/user` endpoint accepts them
(measured), so each surface has to refuse them itself:

- `requireOwner` (`lib/http.ts`) refuses a bearer token carrying `client_id` on the REST API.
- `browserUser` (`lib/browser-auth.ts`) refuses one as a cookie session. Without that, an
  agent could put its own token in the session cookie and reach `/api/dashboard`, which
  deletes models and accounts. A new page or form post that reads the session must go
  through `browserUser`, never `getUser` directly.
- `mcpOwner` (`lib/mcp-auth.ts`) accepts only a token with `client_id` and the MCP audience,
  so an app or browser session is refused there.

**The audience comes from a database hook.** `hunch_access_token_hook` (the
`20261116000100_mcp_oauth` migration) stamps every OAuth client's token with
`aud = https://hunch.tech/mcp`. It is hardcoded, so a local token carries the production
audience and `mcpOwner` allows that outside production only. If the hook is not enabled,
every MCP call is refused: it fails closed.

**Every MCP call asks Supabase whether the token still stands** (`admin().auth.getUser`),
after checking its signature. A signature only proves the token was issued; without the
second question a disconnected agent, or one whose account was deleted, kept working until
the token expired, up to an hour. It costs one request per call and is why Disconnect is
immediate.

**Form posts check `Origin` (`sameOrigin`), every one of them.** Cookies are `SameSite=Lax`,
which is not the whole answer: `/api/web-auth/code` takes no cookie at all, and without the
check another site could have a visitor's browser ask for a sign-in email.

**The sign-in email's link must not sign anyone in when it is opened.** One template serves
both the Hunch app (which wants the code typed in) and the web account (which wants a link),
and the code and the link are the same one-time token. `{{ .ConfirmationURL }}` spends it on
GET, so a mail scanner following links would use up the code before the person typed it.
The link goes to `/auth/confirm?token_hash=…`, which shows a button; the button's POST to
`/api/web-auth/verify` spends the token. Where to land afterwards is a cookie set when the
email was asked for, not part of the link, so a link opened in another browser lands on the
dashboard.

**The consent page shows where approval sends the connection.** With dynamic registration
anyone can register a client called "Claude", so the name proves nothing and the redirect
host is shown beside it.

**`readModelMarkdown` follows Hunch's grammar, and privacy is the reason.** It reads the
default spelling of a model note and hands a draft to `readModel`, so ids, limits and
cleaning still have one home. Each of these was a published private line before it was a
rule, and `tests/markdown.test.ts` holds a case for each:

- Before the first scene only the first line of plain prose is published, as the premise.
  A task, a `{thought}` or a bullet there stays private.
- Tasks and pasted lists are tested before anything that could publish them. `[ ] call [Bob]`
  starts with `[` and ends with `]` and was once a thought.
- A thought is `{…}` on a line of its own. It was `[…]` until 16 November 2026; any line
  opening with a single `[` now stays private with a problem, in a scene or out of one,
  rather than becoming an action.
- A line led by a `[[link]]` is an action, not a thought.
- A scene's emoji is the line's first whole character by Hunch's rule (`isSectionEmoji`):
  a family, a flag or a skin tone opens a scene, a digit keycap does not, and a bullet is
  tried first.
- Markers strip one pass each, and `*` only singly, as `LineParser.splitMarkers` does.

Hunch's `scripts/test-models.sh` hands its sample note to this compiler and requires the
same model.json the app composes. That is one sample, so a rule changed on either side wants
a case added here too.

**It is deliberately stricter than the app in one place.** In Hunch, a task or a numbered
line inside a scene is published as something the person does. From an agent they stay
private, because an agent's Markdown is likelier to carry a stray to-do. So the same note
can publish differently by the two routes; do not "fix" either to match without deciding
that.

**Smaller rules.** `publish_model` takes back a model whose invite could not be made, and
allows 20 new models an hour per owner (`PUBLISH_LIMIT`). A tool failure carries a code
(`invalid_model`, `not_found`, `rate_limited`, `tool_failed`, `server_error`), and only an
`HttpError` this site threw is repeated to the agent: a database error names tables, so it
is logged instead. `/mcp` answers, the 401 included, carry CORS headers for browser
clients. `site/proxy.ts` refreshes the browser session and skips `/mcp`, the discovery
document and the app's REST routes, which never carry cookies. `protocol.ts` reads
`AGENT_PROTOCOL.md` from disk at load, which is why `next.config.ts` traces it into the
build.

**Checking it.** The smoke test drives the whole path as a browser and an agent would,
with a cookie jar and plain `fetch`: the sign-in email, its link opened twice without
spending the code, the button, then a client registered at the OAuth server, authorized
with PKCE, approved on the consent page, its token used at `/mcp` to publish from Markdown,
then tried on the REST API and in a forged session cookie, and refused again the moment the
dashboard disconnects it. Each of those refusals is a hole that was once open, so a failure
there is not a flaky test. Where the OAuth server is off it says so and skips the
connection, which is what it does against hunch.tech until the hosted settings are on. The
deployed mode of that section (token hash from the admin API, the client deleted
afterwards) has not been run.

## Hunch, the other half

- Hunch composes a `:type: model` note (`ModelComposer.swift`), keeps private everything a
  stranger should not read, and publishes only when the person presses Publish.
- Its offline preview runs **this** renderer: `npm run bundle` writes the app's
  `hunch/Resources/model-renderer.js` (from `hunch/models/`, or from a `../hunch` beside this
  repo). Re-bundle after any change to `packages/`, and commit the regenerated file in the
  Hunch repo; `scripts/models.sh check` there fails while it is stale. Do not edit it by hand.
- An agent's Markdown is compiled here by `readModelMarkdown`, which mirrors what
  `ModelComposer.swift` and `LineParser.swift` do with a model note. A change to how Hunch
  reads a model note wants the same change there.
- Its client (`ModelService.swift`) speaks the API above. A breaking change to a route or
  a reply shape needs the matching change in Hunch, and Hunch builds that shipped stay in the
  wild: prefer additive changes.

## Conventions

- **Never `any`.** Narrow `unknown` with type guards; give row and reply shapes interfaces
  (`site/lib/rows.ts`).
- **Erasable TypeScript only**: Node strips types rather than compiling, so no `enum`,
  `namespace` or parameter properties. Imports inside `packages/` use explicit `.ts`
  extensions.
- **No runtime dependencies in `packages/`.** The renderer must run in Node, in the site and
  in a WKWebView unchanged.
- **Escape everything** that came from a model (`escapeXml`), and keep a test that proves it.
- Comments explain why, especially where a rule looks arbitrary but was measured.
- Commit messages end with the `Co-Authored-By` line the session gives.

## Not done yet

- In Hunch, a response does not yet scroll the editor to its line.
- The home page at hunch.tech is a placeholder.
- Agent access is deployed but not switched on in the hosted Supabase project, and no real
  MCP client (Claude, Codex) has connected to hunch.tech yet.
- The smoke test's web-account and agent section has only run locally, never in its
  deployed mode against hunch.tech.
- `readModelMarkdown` reads Hunch's default spelling only. A person who has respelled
  their grammar in Hunch publishes correctly from the app and not from an agent.
