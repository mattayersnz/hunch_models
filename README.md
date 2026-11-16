# Hunch models

A hunch model is a small isometric scene, or a few of them, showing how someone thinks
things go for people: who they are, where they are, what they do, what they think.
Other people open a link and say whether it matches their world.

Not "is my idea good?" but "is this how it is for you?"

## What is here

```
packages/model/   the format, reading, layout and the HTML renderer. Pure TypeScript.
packages/kit/     isometric maths, the piece kit (people and ~20 props), the two themes.
examples/         five models as JSON, built to standalone HTML.
tests/            ids, reading, layout, rendering.
```

There are no runtime dependencies. Node 22.18+ runs the TypeScript directly.

```bash
npm install        # TypeScript and Node types, for checking only
npm run build      # examples/*.json → examples/out/*.html, dark and light
npm test
npm run check      # tsc
```

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

## Licence

MIT. The isometric projection and shading are adapted from
[Anatomy](https://github.com/wheresryan22/anatomy) (MIT).
