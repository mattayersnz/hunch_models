# AGENTS.md

The short version of CLAUDE.md for coding agents. Read CLAUDE.md before changing the
format, ids, the database or the site's security.

## What this is

Hunch models: isometric scenes of how someone thinks things go for people, published from
a note in the Hunch app (`~/Projects/hunch`, separate repo) to **https://hunch.tech**, where
others say whether they match their world. This repo holds the format (`FORMAT.md`), the
renderer and piece kit (`packages/`), and the site (`site/`, Next.js on Vercel, Supabase).
Outside agents can also publish, from Markdown, over MCP at `https://hunch.tech/mcp`.

Usually this repo is checked out as the submodule `models/` inside the Hunch repo. Then use
Hunch's `./scripts/models.sh` (`setup`, `check`, `ship`) and its "Working across both repos"
playbook: commit here, check both sides, push this repo's `main`, then record the new commit
in Hunch.

## Commands

```bash
npm install
npm test             # ids, reading, layout, rendering, the Markdown compiler
npm run check        # tsc (packages, examples, tests, scripts); site: npx tsc -p site
npm run build        # examples → examples/out/*.html
npm run bundle       # renderer → the Hunch app's hunch/Resources/model-renderer.js
npm run dev          # site on :4620; needs `supabase start` (ports 553xx) and site/.env.local
npm run smoke        # end-to-end against the LOCAL site
```

Never run the local smoke test or Hunch's `test-model-service.sh` against hunch.tech.
These need Node 22.18+ and Supabase CLI 2.117+; on Matt's Mac that is
`/opt/homebrew/bin/supabase`, since an older one elsewhere on the path refuses `config.toml`.

## Rules

- **Ids are the contract with Hunch.** `ids.ts`, `normaliseKey` and `cleanText` in
  `read.ts` must match Hunch's `ModelAnchor.swift` byte for byte. Change both together and
  run Hunch's `scripts/test-models.sh`. The pinned ids in `tests/model.test.ts` must not move.
- **`readModel` is the only way in**, recomputes every id, and lets a bad value cost only
  itself.
- **Layout is deterministic and pieces are standard.** Add props to `PIECES` in
  `packages/kit/src/pieces.ts`; unknown names draw as labelled crates. Re-bundle for Hunch.
- **The database is reachable only through the site's route handlers.** RLS on, no
  policies, no privileges for `anon`/`authenticated`; routes use the service role and check
  ownership. A missing or foreign owner resource is always 404.
- **Three kinds of sign-in, none accepted in place of another.** The Hunch app's REST API
  takes a bearer session, the web account (`/dashboard`) a cookie session, and `/mcp` only an
  OAuth token. `requireOwner` and `browserUser` refuse a token carrying `client_id`;
  `mcpOwner` accepts nothing else, and asks Supabase on every call whether the token still
  stands. New pages and form posts read the session through `browserUser` and check
  `sameOrigin`.
- **`site/AGENT_PROTOCOL.md` is the external contract.** `/agents`, the raw Markdown route
  and the MCP resource all read that file. Keep MCP changes additive and keep unpublish,
  account deletion and response moderation human-only.
- **`readModelMarkdown` (`packages/model/src/markdown.ts`) follows Hunch's grammar.** Only
  plain prose before a scene is the premise; tasks and pasted lists stay private; a
  `[[link]]`-led line is an action. Add a case to `tests/markdown.test.ts` with any change.
- **The sign-in email links to `/auth/confirm`, never `{{ .ConfirmationURL }}`.** Opening
  the link must not spend the token, or a mail scanner uses up the code meant for the app.
- **Agent access is not switched on in the hosted Supabase project yet** (16 November
  2026). The settings it needs are listed in CLAUDE.md under "Agent access".
- **Schema changes are new migration files** in `supabase/migrations/`. The migrations
  workflow applies them to production on push to `main`, alongside Vercel's deploy, so a
  migration must work with the code already live.
- **Secrets** (Supabase keys, Resend) are set by the owner; never write them into files.
  `site/.env.local` is git-ignored.
- **No `any`, erasable TypeScript only** (no enums, namespaces or parameter properties),
  `.ts` extensions in `packages/` imports, no runtime dependencies in `packages/`.
- **Escape every value from a model** in HTML and SVG.
- Every push to `main` deploys hunch.tech through Vercel: treat it as a release.
