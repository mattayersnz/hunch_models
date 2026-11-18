// read.ts
//
// The one way in. Anything that arrives — a draft an author wrote, a model Hunch
// composed, a body posted to the site — goes through `readModel`, which returns a
// clean `HunchModel` with every id recomputed from content.
//
// It is lenient in the way config.json is in Hunch: a bad value costs only itself.
// A line that is not text is dropped and reported; an over-long one is cut and
// reported; the rest of the model still reads. Only a model with no title or no
// scenes at all is refused, because there would be nothing to show.

import {
    LIMITS,
    MARKS,
    type HunchModel,
    type Mark,
    type ModelLine,
    type Person,
    type Scene,
} from "./format.ts";
import { isPieceLook, type PieceLook } from "@hunch/kit";
import { Occurrences, lineId, normaliseKey, personId, sceneId } from "./ids.ts";

export interface ReadResult {
    model: HunchModel | null;
    problems: string[];
}

type Bag = Record<string, unknown>;

const isBag = (value: unknown): value is Bag =>
    typeof value === "object" && value !== null && !Array.isArray(value);

const isMark = (value: unknown): value is Mark =>
    typeof value === "string" && (MARKS as readonly string[]).includes(value);

/** Plain text, one line, no markup, within a limit. */
function cleanText(value: unknown, limit: number, where: string, problems: string[]): string | null {
    if (typeof value !== "string") {
        if (value !== undefined) problems.push(`${where}: expected text`);
        return null;
    }
    const text = value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
    if (!text) return null;
    if ([...text].length > limit) {
        problems.push(`${where}: cut to ${limit} characters`);
        return [...text].slice(0, limit).join("").trimEnd();
    }
    return text;
}

function listOf(value: unknown, where: string, problems: string[]): unknown[] {
    if (value === undefined) return [];
    if (Array.isArray(value)) return value;
    problems.push(`${where}: expected a list`);
    return [];
}

function capped<T>(items: T[], limit: number, where: string, problems: string[]): T[] {
    if (items.length <= limit) return items;
    problems.push(`${where}: kept the first ${limit} of ${items.length}`);
    return items.slice(0, limit);
}

function readLines(
    value: unknown,
    kind: "does" | "thinks",
    scene: string,
    person: string,
    where: string,
    problems: string[],
): ModelLine[] {
    const occurrences = new Occurrences();
    const lines: ModelLine[] = [];
    listOf(value, where, problems).forEach((entry, index) => {
        const at = `${where}[${index}]`;
        const raw = isBag(entry) ? entry.text : entry;
        const text = cleanText(raw, LIMITS.line, at, problems);
        // A blank line has nothing to say; anything else not text was reported by cleanText.
        if (text === null) {
            if (raw === undefined) problems.push(`${at}: dropped, no text`);
            return;
        }
        const marks = isBag(entry)
            ? [...new Set(listOf(entry.marks, `${at}.marks`, problems).filter(isMark))]
            : [];
        const occurrence = occurrences.next(normaliseKey(text));
        lines.push({ id: lineId(scene, person, kind, text, occurrence), text, marks });
    });
    return capped(lines, LIMITS.linesPerKind, where, problems);
}

function readPerson(value: unknown, scene: string, occurrences: Occurrences, where: string, problems: string[]): Person | null {
    if (!isBag(value)) {
        problems.push(`${where}: dropped, expected a person`);
        return null;
    }
    const name = cleanText(value.name, LIMITS.personName, `${where}.name`, problems);
    if (name === null) {
        problems.push(`${where}: dropped, a person needs a name`);
        return null;
    }
    const about = cleanText(value.about, LIMITS.about, `${where}.about`, problems);
    const person: Person = {
        id: personId(scene, name, occurrences.next(normaliseKey(name))),
        name,
        does: readLines(value.does, "does", scene, name, `${where}.does`, problems),
        thinks: readLines(value.thinks, "thinks", scene, name, `${where}.thinks`, problems),
    };
    if (about !== null) person.about = about;
    return person;
}

function readScene(value: unknown, occurrences: Occurrences, where: string, problems: string[]): Scene | null {
    if (!isBag(value)) {
        problems.push(`${where}: dropped, expected a scene`);
        return null;
    }
    const name = cleanText(value.name, LIMITS.sceneName, `${where}.name`, problems);
    if (name === null) {
        problems.push(`${where}: dropped, a scene needs a name`);
        return null;
    }
    const people = new Occurrences();
    const pieces = capped(
        [...new Set(
            listOf(value.pieces, `${where}.pieces`, problems)
                .map((entry, index) => cleanText(entry, LIMITS.pieceName, `${where}.pieces[${index}]`, problems))
                .filter((piece): piece is string => piece !== null)
                .map((piece) => piece.toLowerCase()),
        )],
        LIMITS.pieces,
        `${where}.pieces`,
        problems,
    );
    const scene: Scene = {
        id: sceneId(name, occurrences.next(normaliseKey(name))),
        name,
        people: capped(
            listOf(value.people, `${where}.people`, problems)
                .map((entry, index) => readPerson(entry, name, people, `${where}.people[${index}]`, problems))
                .filter((person): person is Person => person !== null),
            LIMITS.peoplePerScene,
            `${where}.people`,
            problems,
        ),
        pieces,
    };
    if (value.pieceLooks !== undefined) {
        if (!isBag(value.pieceLooks)) {
            problems.push(`${where}.pieceLooks: expected an object`);
        } else {
            const lookEntries: [string, PieceLook][] = [];
            for (const [rawName, rawLook] of Object.entries(value.pieceLooks)) {
                const piece = cleanText(rawName, LIMITS.pieceName, `${where}.pieceLooks key`, problems)?.toLowerCase();
                if (piece === undefined || !pieces.includes(piece)) {
                    problems.push(`${where}.pieceLooks.${rawName}: dropped, no matching piece`);
                } else if (!isPieceLook(rawLook)) {
                    problems.push(`${where}.pieceLooks.${rawName}: dropped, unknown look`);
                } else {
                    lookEntries.push([piece, rawLook]);
                }
            }
            if (lookEntries.length > 0) scene.pieceLooks = Object.fromEntries(lookEntries);
        }
    }
    const emoji = cleanText(value.emoji, 8, `${where}.emoji`, problems);
    if (emoji !== null) scene.emoji = emoji;
    return scene;
}

export function readModel(input: unknown): ReadResult {
    const problems: string[] = [];
    if (!isBag(input)) return { model: null, problems: ["expected a model object"] };
    if (input.version !== undefined && input.version !== 1) {
        return { model: null, problems: [`version ${String(input.version)} is newer than this reader`] };
    }
    const title = cleanText(input.title, LIMITS.title, "title", problems);
    if (title === null) return { model: null, problems: [...problems, "a model needs a title"] };

    const occurrences = new Occurrences();
    const scenes = capped(
        listOf(input.scenes, "scenes", problems)
            .map((entry, index) => readScene(entry, occurrences, `scenes[${index}]`, problems))
            .filter((scene): scene is Scene => scene !== null),
        LIMITS.scenes,
        "scenes",
        problems,
    );
    if (scenes.length === 0) return { model: null, problems: [...problems, "a model needs at least one scene"] };

    const model: HunchModel = { version: 1, title, scenes };
    const premise = cleanText(input.premise, LIMITS.premise, "premise", problems);
    if (premise !== null) model.premise = premise;
    return { model, problems };
}

/** Every id a response may point at, with what it is. */
export function piecesOf(model: HunchModel): Map<string, { kind: "scene" | "person" | "does" | "thinks"; text: string }> {
    const out = new Map<string, { kind: "scene" | "person" | "does" | "thinks"; text: string }>();
    for (const scene of model.scenes) {
        out.set(scene.id, { kind: "scene", text: scene.name });
        for (const person of scene.people) {
            out.set(person.id, { kind: "person", text: person.name });
            for (const line of person.does) out.set(line.id, { kind: "does", text: line.text });
            for (const line of person.thinks) out.set(line.id, { kind: "thinks", text: line.text });
        }
    }
    return out;
}
