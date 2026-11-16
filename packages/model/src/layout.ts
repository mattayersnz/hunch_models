// layout.ts
//
// Where everything in a scene goes. Pure and deterministic: the same scene always
// lays out the same way, on any machine, with no model and no randomness — which is
// what lets Hunch's preview, the hosted page and a coding agent's build all agree.
//
// A scene is a 4 × 4 floor of cells. People stand along the middle diagonal, side by
// side as the viewer sees them, so nobody's thoughts rise over somebody else. Props
// fill the cells behind them first, so the people are never hidden by the furniture.

import { CELL, CRATE, pieceNamed, wordsFor, type PieceDef, type Pose } from "@hunch/kit";
import { normaliseKey } from "./ids.ts";
import type { Person, Scene } from "./format.ts";

export const GRID = 4;
export const FLOOR = GRID * CELL;

export type Cell = [col: number, row: number];

/** Same depth band (col + row = 3), spread across the screen: left, right, far left, far right. */
const PEOPLE_CELLS: Cell[] = [[1, 2], [2, 1], [0, 3], [3, 0]];

export interface PlacedPiece {
    name: string;
    def: PieceDef;
    known: boolean;
    cell: Cell;
    /** Index into `people` of whoever sits on it. */
    seatedBy: number | null;
}

export interface PlacedPerson {
    person: Person;
    cell: Cell;
    pose: Pose;
    /** Index into `pieces` of the seat, when sitting. */
    seat: number | null;
}

export interface SceneLayout {
    people: PlacedPerson[];
    pieces: PlacedPiece[];
    /** Line id → index into `pieces` the action names, or null when it names none. */
    actionAt: Map<string, number | null>;
    /** Number shown on each action, letter shown on each thought, by line id. */
    labels: Map<string, string>;
}

const wordPattern = (word: string): RegExp =>
    new RegExp(`(^|[^\\p{L}\\p{N}])${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^\\p{L}\\p{N}])`, "u");

/** Which of the scene's pieces an action names, by name or alias as a whole word. */
export function pieceForText(text: string, pieces: readonly string[]): number | null {
    const said = normaliseKey(text);
    for (let index = 0; index < pieces.length; index++) {
        if (wordsFor(pieces[index]).some((word) => wordPattern(word).test(said))) return index;
    }
    return null;
}

const sameCell = (a: Cell, b: Cell): boolean => a[0] === b[0] && a[1] === b[1];

const LETTERS = "abcdefghijklmnopqrstuvwxyz";

export function layoutScene(scene: Scene): SceneLayout {
    const peopleCells = PEOPLE_CELLS.slice(0, scene.people.length);
    const pieces: PlacedPiece[] = scene.pieces.map((name) => {
        const def = pieceNamed(name);
        return { name, def: def ?? CRATE, known: def !== null, cell: [0, 0], seatedBy: null };
    });

    // People take seats in order while there are seats; the seat moves to them.
    const seats = pieces.map((piece, index) => (piece.def.seat ? index : -1)).filter((index) => index >= 0);
    const people: PlacedPerson[] = scene.people.map((person, index) => {
        const seat = seats[index] ?? null;
        const cell = peopleCells[index];
        if (seat === null) return { person, cell, pose: { kind: "stand" }, seat: null };
        const piece = pieces[seat];
        piece.cell = cell;
        piece.seatedBy = index;
        return { person, cell, pose: { kind: "sit", seat: piece.def.seat! }, seat };
    });

    // Everything else, back cells first; within a band, nearest the middle of the screen first.
    const free: Cell[] = [];
    for (let col = 0; col < GRID; col++) for (let row = 0; row < GRID; row++) free.push([col, row]);
    const open = free
        .filter((cell) => !peopleCells.some((taken) => sameCell(taken, cell)))
        .sort((a, b) => a[0] + a[1] - (b[0] + b[1]) || Math.abs(a[0] - a[1]) - Math.abs(b[0] - b[1]) || a[0] - b[0]);
    let next = 0;
    for (const piece of pieces) if (piece.seatedBy === null) piece.cell = open[next++];

    const actionAt = new Map<string, number | null>();
    const labels = new Map<string, string>();
    let number = 0;
    let letter = 0;
    for (const person of scene.people) {
        for (const line of person.does) {
            actionAt.set(line.id, pieceForText(line.text, scene.pieces));
            labels.set(line.id, String(++number));
        }
        for (const line of person.thinks) labels.set(line.id, LETTERS[letter++ % LETTERS.length]);
    }
    return { people, pieces, actionAt, labels };
}
