# Hunch models agent protocol

Connect a remote MCP client to:

```text
https://hunch.tech/mcp
```

The connection opens hunch.tech in the person's browser. They sign in by email and
approve the client. A connected client may validate, publish and update models, manage
invite links and read responses. It cannot unpublish models, hide responses or delete
the account.

## What a model is

A hunch model is a small set of real-life scenes: who is there, what surrounds them,
what they do and what they think. hunch.tech turns the document into an isometric page
where other people can say what resonates, what differs and what their context adds.

The uploaded Markdown is an interchange format. hunch.tech extracts and validates a
`model.json` snapshot and stores that snapshot, not the source Markdown.

## Markdown format

```markdown
# Finding a first flat
:type: model

Young renters give up before they ever talk to a landlord.

🛋 Sunday evening at home
:who: Mia, 27, renting with two friends
:with: couch, phone, lamp
. scrolls listings on her phone
. saves six, messages none ?
{They'll want references I don't have} *

## The viewing
:who: Mia
. fills in the form at the door
:who: Agent, property manager
. hands out application forms !
{I need someone who will pay on time}
```

- `# …` is the title. Exactly one is published.
- `:type: model` is required.
- The first line of plain prose before a scene is the premise. Everything else there stays
  private: later prose, bullets, thoughts and tasks.
- `## …` starts a scene without an emoji. An emoji-led line starts a scene with that emoji.
- `:who: Name, about` starts a person. The text after the first comma is optional context.
- `:with: …` is a comma-separated list of props. Unknown props draw as labelled crates.
- `. …` is something the current person does. Prose inside a scene is also an action.
- `{…}` on a line of its own is something the current person thinks. A line that
  opens with a single `[` is not a thought and stays private. A line that starts with a
  `[[link]]` is an action, and `[ ]` or `[x]` is a task, which stays private.
- An action or thought before `:who:` belongs to `Someone`.
- A trailing ` ?` marks uncertainty, ` *` marks a hunch and ` !` marks focus. Marks may combine.
- `**bold**`, `__bold__` and inline-code delimiters are removed. `[[Note|shown]]` publishes as `shown`.

Comments beginning `//`, fenced code, unknown properties and unsupported list lines are
reported but stay private. A model is refused only when it has no title, no `:type: model`
or no scene. Overlong values are cut and excess items are dropped with a problem report.

## Limits

Title 120 · premise 280 · scene name 80 · person name 60 · about 120 · line 280 ·
12 scenes · 4 people per scene · 12 actions and 12 thoughts per person · 12 props per scene.
The complete request must fit within 64 KiB.

## Publishing workflow

1. Call `validate_model` while drafting. Resolve errors; review non-fatal private-line and limit problems.
2. Call `publish_model` only after the person asks to publish.
3. Omit `visibility` for invite-only publishing. The tool creates an initial invite and returns its secret `share_url` once.
4. Use `visibility: public` only when the person explicitly wants an indexed, open page.
5. Keep the returned `slug` for `update_model`, `get_responses` and invite management.

An invite model's bare `page_url` deliberately answers 404. Share its `share_url`, which
contains a secret key. Invite keys are never stored in recoverable form; if one is lost,
create another. Republishing creates a version only when the compiled model changes, and
unchanged lines keep their response IDs.

## Tools

### `validate_model`

Input: `{ markdown }`. Returns `{ valid, model, problems }` without saving anything.

### `publish_model`

Input: `{ markdown, visibility?, invite_label? }`. `visibility` is `invite` by default or
`public`. Returns the slug, version, page URL, share URL and problems. Invite-only publishing
creates one invite so the returned share URL works immediately.

### `update_model`

Input: `{ slug, markdown, visibility? }`. Updates the compiled snapshot. Omit visibility to
preserve it. The site cannot recover an old invite key; retain the earlier share URL or call
`create_invite`.

### `list_models` and `get_model`

List the owner's summaries or read one current `model.json` snapshot.

### `set_visibility`

Input: `{ slug, visibility }`. Public pages need no key. An invite-only page needs a live invite.

### `get_responses`

Input: `{ slug }`. Returns every owner-visible response with the text it addressed and whether
that piece still exists in the current version. Visitors see counts, never other people's words.

### `list_invites`, `create_invite`, `revoke_invite`

List metadata, create a secret URL shown once, or revoke a link. Revocation does not delete
responses already made through it.

## Safety and privacy

- Publishing and visibility changes are external side effects. Do them only on an explicit request.
- Default to invite-only when visibility is not stated.
- Never put an invite URL in logs, public notes or source control.
- Never claim ignored Markdown was published. Report the returned `problems`.
- Do not sign or attribute model lines to a person unless their document does.
- The MCP deliberately provides no account deletion, unpublish or response-moderation tool.

## Errors

A failed tool call returns `{ code, message, retryable }`, with `problems` when Markdown was
refused. The codes are `invalid_model`, `not_found`, `rate_limited`, `tool_failed` and
`server_error`. `not_found` means the slug or invite is absent or belongs to another account;
the distinction is intentionally hidden. `rate_limited` means more than 20 new models were
published in an hour: update an existing one, or wait. After `server_error` on a publish, call
`list_models` before retrying so an interruption does not create a duplicate.

An HTTP 401 means the connection is no longer approved: the person disconnected the agent,
or the token expired. Reconnect the MCP client.
