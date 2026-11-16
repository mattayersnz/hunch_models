// markdown.ts
//
// The portable spelling of a hunch model. It deliberately follows Hunch's default
// model-note grammar, then hands the draft to readModel so there is still exactly one
// place that cleans text, applies limits and computes ids.

import type { Mark, ModelDraft, PersonDraft, SceneDraft } from "./format.ts";
import { readModel, type ReadResult } from "./read.ts";

export interface MarkdownReadResult extends ReadResult {
    /** Non-fatal lines that stayed private, prefixed with their one-based line number. */
    problems: string[];
}

interface PersonBuild extends PersonDraft {
    does: ({ text: string; marks: Mark[] })[];
    thinks: ({ text: string; marks: Mark[] })[];
}

interface SceneBuild extends SceneDraft {
    people: PersonBuild[];
    pieces: string[];
}

const property = /^:([^:\n]{1,40}):\s*(.*)$/;
const heading = /^(#{1,6})\s+(.+)$/;
const task = /^\[[ x]\](?:\s|$)/i;
const otherList = /^(?:[-+*]\s|\d+\.\s)/;
const bullet = /^\.{1,3}\s+(.*)$/;
const markedThought = /^\[.*\]\s+[?*!]+(?:\s+[?*!]+)*$/;
const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/**
 * An emoji-led line, by Hunch's own rule: the line's first whole character (so a family,
 * a flag or a skin tone is one emoji) opens a section when its first code point is drawn
 * as an emoji by default, or is an emoji above U+2600. A digit keycap is therefore not one.
 */
function emojiSection(text: string): { emoji: string; name: string } | null {
    const first = graphemes.segment(text)[Symbol.iterator]().next().value?.segment;
    if (!first) return null;
    const lead = String.fromCodePoint(first.codePointAt(0)!);
    const opens = /^\p{Emoji_Presentation}$/u.test(lead) || (/^\p{Emoji}$/u.test(lead) && lead.codePointAt(0)! > 0x2600);
    if (!opens) return null;
    const rest = text.slice(first.length);
    if (!/^\s/.test(rest) || !rest.trim()) return null;
    return { emoji: first, name: rest.trim() };
}

/** A whole-line `[thought]`, optionally followed by marks. `[[links]]` and tasks are not. */
function isThought(text: string): boolean {
    if (!text.startsWith("[") || text.startsWith("[[") || task.test(text)) return false;
    return text.endsWith("]") || markedThought.test(text);
}

function plain(text: string): string {
    let out = text.replace(/\[\[([^\[\]]+)\]\]/g, (_whole, inner: string) => {
        const bar = inner.lastIndexOf("|");
        if (bar >= 0) return inner.slice(bar + 1);
        const slash = inner.lastIndexOf("/");
        return slash >= 0 ? inner.slice(slash + 1) : inner;
    });
    out = out.replaceAll("**", "").replaceAll("__", "").replaceAll("`", "");
    return out;
}

const MARKERS: readonly [string, Mark][] = [["?", "unsure"], ["*", "hunch"], ["!", "focus"]];

/**
 * The body without one trailing marker, or null. Hunch's rule: whitespace, then a run of
 * the token. `*` is capped at one, because doubled it is a bold delimiter.
 */
function stripMarker(body: string, token: string): string | null {
    if (!body.endsWith(token)) return null;
    let end = body.length;
    while (end > 0 && body[end - 1] === token) {
        end -= 1;
        if (token === "*") break;
    }
    if (end === 0 || !/\s/.test(body[end - 1])) return null;
    const head = body.slice(0, end).trimEnd();
    return head ? head : null;
}

function marked(text: string): { text: string; marks: Mark[] } {
    const found = new Set<Mark>();
    let body = text.trim();
    // One pass per marker, each striking at most one, as Hunch's parser does. Draining
    // until nothing strips would read lines differently from the app.
    for (let pass = 0; pass < MARKERS.length; pass++) {
        let struck = false;
        for (const [token, mark] of MARKERS) {
            const stripped = stripMarker(body, token);
            if (stripped === null) continue;
            body = stripped;
            found.add(mark);
            struck = true;
            break;
        }
        if (!struck) break;
    }
    return { text: plain(body), marks: (["unsure", "hunch", "focus"] as const).filter((mark) => found.has(mark)) };
}

function privateLine(problems: string[], line: number, what: string): void {
    problems.push(`line ${line}: ${what} stays private`);
}

/**
 * Reads the canonical Markdown interchange format. The Markdown itself is never the
 * stored document: callers keep only the clean model returned by readModel.
 */
export function readModelMarkdown(input: unknown): MarkdownReadResult {
    if (typeof input !== "string") return { model: null, problems: ["expected Markdown text"] };
    const source = input.replace(/\r\n?/g, "\n");
    const lines = source.split("\n");
    const problems: string[] = [];
    let title: string | null = null;
    let premise: string | undefined;
    let hasType = false;
    let inFence = false;
    let scene: SceneBuild | null = null;
    let person: PersonBuild | null = null;
    const scenes: SceneBuild[] = [];

    const startScene = (name: string, emoji?: string): void => {
        scene = { name: plain(name), ...(emoji ? { emoji } : {}), people: [], pieces: [] };
        scenes.push(scene);
        person = null;
    };

    const currentPerson = (): PersonBuild => {
        if (person) return person;
        person = { name: "Someone", does: [], thinks: [] };
        scene!.people.push(person);
        return person;
    };

    lines.forEach((raw, index) => {
        const at = index + 1;
        const text = raw.trim();
        if (text.startsWith("```")) {
            inFence = !inFence;
            privateLine(problems, at, "code");
            return;
        }
        if (inFence) {
            if (text) privateLine(problems, at, "code");
            return;
        }
        if (!text) return;
        if (text.startsWith("//")) {
            privateLine(problems, at, "a comment");
            return;
        }

        const headed = heading.exec(text);
        if (headed) {
            if (headed[1].length === 1) {
                if (title === null) title = plain(headed[2]);
                else privateLine(problems, at, "another title");
            } else {
                startScene(headed[2]);
            }
            return;
        }
        const field = property.exec(text);
        if (field) {
            const name = field[1].toLowerCase();
            const value = field[2].trim();
            if (name === "type") {
                if (value.toLowerCase() === "model") hasType = true;
                else problems.push(`line ${at}: :type: must be model`);
                return;
            }
            if (name === "who" && scene) {
                const comma = value.indexOf(",");
                const personName = plain((comma < 0 ? value : value.slice(0, comma)).trim());
                const about = comma < 0 ? "" : plain(value.slice(comma + 1).trim());
                if (!personName) {
                    problems.push(`line ${at}: :who: needs a name`);
                    return;
                }
                person = { name: personName, ...(about ? { about } : {}), does: [], thinks: [] };
                scene.people.push(person);
                return;
            }
            if (name === "with" && scene) {
                scene.pieces.push(...value.split(",").map((piece) => plain(piece.trim())).filter(Boolean));
                return;
            }
            privateLine(problems, at, `:${name}:`);
            return;
        }

        // Hunch tries a bullet before an emoji, so ". 🔥 burns it" is an action.
        const emoji = bullet.test(text) ? null : emojiSection(text);
        if (emoji) {
            startScene(emoji.name, emoji.emoji);
            return;
        }

        // Tasks and pasted lists are checked before anything that could publish them.
        if (task.test(text) || otherList.test(text)) {
            privateLine(problems, at, "an unsupported list line");
            return;
        }

        if (scene) {
            if (isThought(text)) {
                const closing = text.lastIndexOf("]");
                currentPerson().thinks.push(marked(`${text.slice(1, closing)}${text.slice(closing + 1)}`));
                return;
            }
            const dotted = bullet.exec(text);
            currentPerson().does.push(marked(dotted ? dotted[1] : text));
            return;
        }

        // Outside a scene only the first line of plain prose is published, as the premise.
        if (isThought(text) || bullet.test(text)) {
            privateLine(problems, at, "a line outside a scene");
            return;
        }
        if (premise === undefined) premise = plain(text);
        else privateLine(problems, at, "extra prose outside a scene");
    });

    if (title === null) problems.push("a model needs a # title");
    if (!hasType) problems.push("a model needs :type: model");
    if (title === null || !hasType) return { model: null, problems };

    const draft: ModelDraft = { title, ...(premise ? { premise } : {}), scenes };
    const read = readModel(draft);
    return { model: read.model, problems: [...problems, ...read.problems] };
}
