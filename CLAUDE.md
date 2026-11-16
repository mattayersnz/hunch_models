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
that side.

**Usually you are inside the Hunch repo, at `hunch/models/`**, where this repo is a git
submodule. Then the Hunch repo's `scripts/models.sh` is how work here is checked and shipped
(`setup`, `check`, `ship`), and "Working across both repos" in its CLAUDE.md is the
playbook. Commit here as in any repo; the Hunch repo then records which commit of this one
it goes with.

```
 model note (.md, truth) ──► Hunch ──► model.json ──► renderer ──► HTML + SVG
 in a Hunch collection      (Swift)   (FORMAT.md)    (this repo)   at hunch.tech/m/:slug
        ▲                                                                  │
        └──────── responses, shown in Hunch beside their lines ◄── API ◄───┘
```

The note is the authority. The site holds published snapshots and the responses to them,
and never writes back into a note.

## Commands

Node 22.18+ runs the TypeScript directly; there is no compile step for the packages.

```bash
npm install          # dev dependencies only: typescript, @types/node, esbuild; the site's own
npm test             # tests/model.test.ts: ids, reading, layout, rendering
npm run check        # tsc over packages, examples, tests and scripts (the site has its own tsconfig)
npm run build        # examples/*.json → examples/out/*.html, dark and light
npm run bundle       # the renderer as one script → the Hunch app's Resources/model-renderer.js
npm run dev          # the site at http://127.0.0.1:4620 (needs local Supabase, below)
npm run smoke        # 20 end-to-end checks against the local site, codes read from Mailpit
npx tsc -p site      # typecheck the site
```

Local Supabase, on ports **553xx** so it can run beside another local Supabase project:

```bash
supabase start -x studio,imgproxy,edge-runtime,logflare,vector,supavisor,realtime,storage-api,postgres-meta
```

Copy `site/.env.example` to `site/.env.local` and fill it from `supabase status`. Mailpit
(sign-in emails) is at http://127.0.0.1:55324.

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
                      layout.ts   where everything in a scene goes; pure and deterministic
                      render.ts   modelHtml / pageHtml / sceneSvg; marks are separated here
                      browser.ts  previewHtml(json) for Hunch's offline preview (bundled)
packages/kit/src/     iso.ts      projection, extrusion, four-tone shading, fitting
                      pieces.ts   the kit: a person (stand, sit) and ~22 props, with aliases
                      svg.ts      solids to markup
                      theme.ts    THEME_CSS (dark, light, auto) and PAGE_CSS
site/                 Next.js 16 on Vercel; route handlers only (see "The site")
supabase/             migrations/, sign-in email templates, config.toml (local)
examples/             five models as JSON, and build.ts
scripts/              bundle.ts, smoke.ts
tests/                model.test.ts
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

**Standard pieces, never hand-drawn scenes.** Every model looks like every other, a
stranger can read one in a minute, and every piece can take a response. A prop name the kit
does not know draws as a labelled crate, so an author is never blocked and rendering never
needs AI.

**Layout is pure and deterministic** — the same scene lays out the same way in Hunch's
preview, on the site and in a test. A scene is a 4 × 4 floor of 30-unit cells. People stand
along the middle diagonal (`PEOPLE_CELLS`), side by side as the viewer sees them; props
fill the cells behind them first so people are never hidden. The first seat in a scene is
moved under the first person, who sits. An action is drawn at the piece its text names, by
name or alias as a whole word; otherwise on the floor in front of the person. The floor and
the fit are sized to the used cells (`boundsOf`, `fitWidth`), and `separate` lifts marks
that would overlap.

**Text is HTML, the drawing carries numbers and letters.** Words wrap, read at 390px, and
can be selected or read aloud; every line and its marker share a `data-id`, which is how
hover-linking and responding find each other.

**Adding a piece**: append a `PieceDef` to `PIECES` in pieces.ts — its solids inside one
30 × 30 cell, listed back to front and bottom to top (that order is painter's order within
a cell), its `height` (where a marker hangs), aliases, and `seat`/`front` if a person can
sit on it. Then `npm run build`, look at it dark and light, and `npm run bundle` so Hunch's
preview matches.

The look is adapted from the Anatomy skill (MIT; attributed in `iso.ts` and `LICENSE`):
projection, extrusion, four-tone shading. Machine parts were deliberately not carried over.

## The site

Next.js on Vercel, but **every page and endpoint is a route handler**; no React runs on a
model page. `/m/:slug` returns the renderer's own HTML plus a few lines of plain script for
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
  `SITE_URL=https://hunch.tech` (production only; previews use their own origin).
- **Vercel** project `hunch-models`, Root Directory `site`, connected to GitHub: every push
  to `main` deploys hunch.tech, so **a push to `main` is a release** — run the checks first. `site/package.json` must declare everything `next build`
  needs (including `typescript`), because Vercel installs from that folder.
- **Email** goes through Resend SMTP from `no-reply@hunch.tech`. The Magic Link and Confirm
  Signup templates must carry `{{ .Token }}` (a code, not a link); copies are in
  `supabase/templates/`. hunch.tech's DNS also carries Google Workspace mail records — leave
  them alone when changing anything there.

## Hunch, the other half

- Hunch composes a `:type: model` note (`ModelComposer.swift`), keeps private everything a
  stranger should not read, and publishes only when the person presses Publish.
- Its offline preview runs **this** renderer: `npm run bundle` writes the app's
  `hunch/Resources/model-renderer.js` (from `hunch/models/`, or from a `../hunch` beside this
  repo). Re-bundle after any change to `packages/`, and commit the regenerated file in the
  Hunch repo; `scripts/models.sh check` there fails while it is stale. Do not edit it by hand.
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

- Agents cannot draft a model note from a person's notes, and there is no coding-agent skill
  or MCP server over the API yet (phase 4 of the plan).
- In Hunch, a response does not yet scroll the editor to its line.
- The home page at hunch.tech is a placeholder.
