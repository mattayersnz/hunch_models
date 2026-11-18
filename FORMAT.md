# model.json, version 1

```ts
interface HunchModel { version: 1; title: string; premise?: string; scenes: Scene[] }
interface Scene      { id: string; name: string; emoji?: string; people: Person[]; pieces: string[]; pieceLooks?: Record<string, PieceLook> }
interface Person     { id: string; name: string; about?: string; does: ModelLine[]; thinks: ModelLine[] }
interface ModelLine  { id: string; text: string; marks: ("unsure" | "hunch" | "focus")[] }
type PieceLook       = "handheld" | "paper" | "container" | "appliance" | "display" | "seat" |
                       "surface" | "storage" | "vehicle" | "plant" | "building" | "fixture"
```

An author may omit every `id`: `readModel` always recomputes them, and ignores any it
is handed.

`pieces` always carries the author's semantic names. `pieceLooks` may give an unknown
piece a generic kit appearance without changing that meaning; its keys must name entries
in `pieces`, and an invalid key or look costs only itself. In Markdown, the same hint is
written naturally: `:with: ticket machine as appliance, medicine as container`. A
dedicated kit piece wins unless the author explicitly supplies a look. Without a hint,
the renderer makes a cautious deterministic suggestion and otherwise uses the labelled
crate.

## Limits

title 120 · premise 280 · scene name 80 · person name 60 · about 120 · line 280 ·
12 scenes · 4 people a scene · 12 does and 12 thinks a person · 12 pieces a scene.
Text over a limit is cut; items over a limit are dropped; both are reported.
All text is single-line and plain. Markup is never interpreted.

## Ids

An id is a hash of what a piece says and where it sits. An unchanged line keeps its
id across every republish, so its responses stay with it; an edited line is a new
piece. Hunch computes the same ids in Swift, so this is part of the format.

1. **Normalise** each text: Unicode NFC, trim, collapse whitespace to one space,
   lowercase.
2. **Occurrence**: how many earlier siblings had the same normalised key —
   scenes among scenes, people among the people of one scene, lines among the lines of
   one person and kind.
3. **Hash** the parts with FNV-1a 64 over UTF-8, with byte `0x1f` between parts, and
   write the result in base 36, zero-padded to 13 characters.

| Piece  | Prefix | Parts |
|--------|--------|-------|
| scene  | `s` | `"scene"`, scene, occurrence |
| person | `p` | `"person"`, scene, person, occurrence |
| line   | `d` (does) or `t` (thinks) | `"line"`, scene, person, `"does"`/`"thinks"`, text, occurrence |

`occurrence` is written in decimal. Pinned values are in `tests/model.test.ts`:
`lineId("Home", "Mia", "does", "makes tea", 0)` is `d3543mzzg29j96`.

A person's `about` and a scene's `emoji` are not part of any id, so they can be
refined without losing a response.
