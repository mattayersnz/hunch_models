# Hunch models

A hunch model is a small isometric scene, or a few of them, showing how someone thinks
things go for people: who they are, where they are, what they do, what they think.
Other people open a link and say whether it matches their world.

Not "is my idea good?" but "is this how it is for you?"

## What is here

```
packages/model/   the format, reading, layout and the HTML renderer. Pure TypeScript.
packages/kit/     isometric maths, the piece kit (people and ~20 props), the two themes.
site/             the hosted site: Next.js route handlers on Vercel, Supabase behind them.
supabase/         the schema (migrations/) and the sign-in code email templates.
examples/         five models as JSON, built to standalone HTML.
tests/            ids, reading, layout, rendering.
scripts/smoke.ts  the site end to end, against local Supabase.
```

There are no runtime dependencies. Node 22.18+ runs the TypeScript directly.

```bash
npm install        # TypeScript and Node types, for checking only
npm run build      # examples/*.json → examples/out/*.html, dark and light
npm test
npm run check      # tsc
npm run bundle     # the renderer as one script, for Hunch's offline preview
```

`npm run bundle` writes `../hunch/hunch/Resources/model-renderer.js` when the Hunch repo
sits beside this one. Hunch's preview runs that file, so re-bundle whenever the renderer
or the kit changes; Hunch's `test-models.sh` checks its ids against `packages/model`.

## How it fits together

```
 model note (.md) ──► Hunch ──► model.json ──► renderer ──► HTML + SVG
 in a collection               (FORMAT.md)    (this repo)   hosted, shared, responded to
```

The note in Hunch is the truth. A model is published as a snapshot of `model.json`,
which is the only thing that ever leaves the author's notes. This repo reads that
snapshot and draws it, identically in Hunch's offline preview and on the hosted page.

Scenes are drawn from standard pieces, never by hand. Every model therefore looks
like every other, a stranger can read one in a minute, and every piece can take a
response. An unknown prop still draws, as a labelled crate.

## Writing a model

```json
{
  "title": "Finding a first flat",
  "premise": "Young renters give up before they ever talk to a landlord.",
  "scenes": [{
    "name": "Sunday evening at home", "emoji": "🛋",
    "pieces": ["couch", "phone", "lamp"],
    "people": [{
      "name": "Mia", "about": "27, renting with two friends",
      "does": ["scrolls listings on her phone",
               { "text": "saves six, messages none", "marks": ["unsure"] }],
      "thinks": [{ "text": "They'll want references I don't have", "marks": ["hunch"] }]
    }]
  }]
}
```

- An action that names a piece ("on her **phone**") is drawn at that piece.
- A person sits on the first seat in the scene (couch, chair, bench, bed).
- `unsure` and `hunch` marks are drawn in the accent colour and ask for a response.

See [FORMAT.md](FORMAT.md) for the full format and the id algorithm, and
`packages/kit/src/pieces.ts` for every piece and its aliases.

## The site

Every page and endpoint is a route handler; no React runs on a model page. The
database has row level security on and no policies, and the browser roles have no
privileges, so the only way in is through these routes, which use the service role and
check ownership themselves.

| Route | Who | What |
|---|---|---|
| `POST /api/auth/code` `{email}` | Hunch | emails a six-digit code |
| `POST /api/auth/verify` `{email, code}` | Hunch | returns a session |
| `POST /api/auth/refresh` `{refresh_token}` | Hunch | renews it |
| `GET /api/models` | owner | their models with response counts |
| `POST /api/models` `{model, visibility?}` | owner | publish; invite-only unless `"public"` |
| `GET/PUT/DELETE /api/models/:slug` | owner | read, republish (a new version only if changed), unpublish |
| `GET /api/models/:slug/responses` | owner | every response, with the line it was about |
| `GET/POST /api/models/:slug/invites` | owner | list, or make an invite link (its key is shown once) |
| `DELETE /api/models/:slug/invites/:id` | owner | revoke a link |
| `PATCH /api/responses/:id` `{hidden}` | owner | hide or show a response |
| `GET /m/:slug[?k=key]` | anyone with the link | the model page |
| `POST /m/:slug/respond` | anyone with the link | resonates, differs, a note or an idea |

Owner routes take `Authorization: Bearer <access_token>`. A private model without a
valid key, and anyone else's model, is a 404. Visitors see counts, never other
people's words. A reaction replaces the same browser's earlier one. Responses are rate
limited per browser and per salted IP hash; IP addresses are never stored.

### Running it locally

```bash
supabase start -x studio,imgproxy,edge-runtime,logflare,vector,supavisor,realtime,storage-api,postgres-meta
# copy site/.env.example to site/.env.local and fill it from `supabase status`
npm run dev          # http://127.0.0.1:4620
npm run smoke        # 20 end-to-end checks; sign-in codes are read from Mailpit
```

This project uses ports 553xx so it can run beside another local Supabase project.

### Deploying

1. Link and push the schema to your hosted project:
   `supabase link --project-ref <your-project-ref>` then `supabase db push`.
2. In the Supabase dashboard, under Authentication → Emails, set the Magic Link and
   Confirm Signup templates to the ones in `supabase/templates/` (they send
   `{{ .Token }}`, a code, not a link), and add custom SMTP: the built-in sender only
   delivers to the project's team and a few emails an hour.
3. On Vercel, import the repo with Root Directory `site`, and set `SUPABASE_URL`,
   `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `IP_SALT` and `SITE_URL`.

## Licence

MIT. The isometric projection and shading are adapted from
[Anatomy](https://github.com/wheresryan22/anatomy) (MIT).
