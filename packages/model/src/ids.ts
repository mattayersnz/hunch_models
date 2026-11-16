// ids.ts
//
// Every piece's id is a hash of what it says and where it sits, never a counter and
// never a position. That is what lets an author republish a model and keep every
// response on the lines they did not change: an unchanged line hashes the same, and
// an edited one is a new piece whose old responses stay with the old version.
//
// Hunch computes the same ids in Swift (ModelAnchor.swift), so this algorithm is part
// of the format. FORMAT.md spells it out; the tests pin known values.

/** Folded so that a capital or a double space fixed later does not orphan a response. */
export function normaliseKey(text: string): string {
    return text.normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase();
}

const FNV_OFFSET = 0xcbf29ce484222325n;
const FNV_PRIME = 0x100000001b3n;
const MASK = 0xffffffffffffffffn;
const SEPARATOR = 0x1f; // unit separator: cannot be typed into a note line

/** FNV-1a, 64-bit, over the UTF-8 of each part with a separator between. */
export function hashParts(parts: readonly string[]): string {
    const encoder = new TextEncoder();
    let hash = FNV_OFFSET;
    parts.forEach((part, index) => {
        if (index > 0) hash = ((hash ^ BigInt(SEPARATOR)) * FNV_PRIME) & MASK;
        for (const byte of encoder.encode(part)) hash = ((hash ^ BigInt(byte)) * FNV_PRIME) & MASK;
    });
    return hash.toString(36).padStart(13, "0");
}

/**
 * Counts repeats of the same key, so two identical lines in one place get two ids.
 * One counter per parent: occurrence is "how many of these came before, here".
 */
export class Occurrences {
    private seen = new Map<string, number>();

    next(key: string): number {
        const count = this.seen.get(key) ?? 0;
        this.seen.set(key, count + 1);
        return count;
    }
}

export const sceneId = (scene: string, occurrence: number): string =>
    "s" + hashParts(["scene", normaliseKey(scene), String(occurrence)]);

export const personId = (scene: string, person: string, occurrence: number): string =>
    "p" + hashParts(["person", normaliseKey(scene), normaliseKey(person), String(occurrence)]);

export const lineId = (
    scene: string,
    person: string,
    kind: "does" | "thinks",
    text: string,
    occurrence: number,
): string =>
    (kind === "does" ? "d" : "t") +
    hashParts(["line", normaliseKey(scene), normaliseKey(person), kind, normaliseKey(text), String(occurrence)]);
