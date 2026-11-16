// layout.ts
//
// Where everything in a scene goes. Pure and deterministic: the same scene always
// lays out the same way, on any machine, with no model and no randomness — which is
// what lets Hunch's preview, the hosted page and a coding agent's build all agree.
//
// A scene is a 4 × 4 floor of cells. The first two people frame its centre, and larger
// groups fill the near and far centre cells instead of marching out to the corners.
// Props fill the cells behind them first, so people are never hidden by furniture.

import { CELL, CRATE, pieceNamed, wordsFor, type Facing, type PieceDef, type Pose } from "@hunch/kit";
import { normaliseKey } from "./ids.ts";
import type { Person, Scene } from "./format.ts";

export const GRID = 4;
export const FLOOR = GRID * CELL;

export type Cell = [col: number, row: number];

/** A compact group around the centre, in the order a scene introduces its people. */
const PEOPLE_CELLS: Cell[] = [[1, 2], [2, 1], [2, 2], [1, 1]];

/** One of eight natural turns toward a point in the scene. */
function facingToward([col, row]: Cell, [targetCol, targetRow]: [number, number]): Facing {
    const dx = Math.sign(targetCol - col);
    const dy = Math.sign(targetRow - row);
    if (dx === 0 && dy < 0) return "north";
    if (dx > 0 && dy < 0) return "northEast";
    if (dx > 0 && dy === 0) return "east";
    if (dx > 0 && dy > 0) return "southEast";
    if (dx === 0 && dy > 0) return "south";
    if (dx < 0 && dy > 0) return "southWest";
    if (dx < 0 && dy === 0) return "west";
    if (dx < 0 && dy < 0) return "northWest";
    return "south";
}

export interface PlacedPiece {
    name: string;
    def: PieceDef;
    known: boolean;
    cell: Cell;
    /** Index into `people` of whoever sits on it. */
    seatedBy: number | null;
    /** Small props can share a host cell by sitting in one of its surface slots. */
    surface: { host: number; at: [x: number, y: number, z: number] } | null;
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
        return { name, def: def ?? CRATE, known: def !== null, cell: [0, 0], seatedBy: null, surface: null };
    });

    // People take seats in order while there are seats; the seat moves to them.
    const seats = pieces.map((piece, index) => (piece.def.seat ? index : -1)).filter((index) => index >= 0);
    const centre: [number, number] = [
        peopleCells.reduce((sum, [col]) => sum + col, 0) / Math.max(1, peopleCells.length),
        peopleCells.reduce((sum, [, row]) => sum + row, 0) / Math.max(1, peopleCells.length),
    ];
    const people: PlacedPerson[] = scene.people.map((person, index) => {
        const seat = seats[index] ?? null;
        const cell = peopleCells[index];
        // Seats in the kit open toward +y. A sitter follows the furniture; standing
        // figures turn as a whole toward the other people in their scene.
        const facing: Facing = seat === null ? facingToward(cell, centre) : "south";
        if (seat === null) return { person, cell, pose: { kind: "stand", facing }, seat: null };
        const piece = pieces[seat];
        piece.cell = cell;
        piece.seatedBy = index;
        return { person, cell, pose: { kind: "sit", seat: piece.def.seat!, facing }, seat };
    });

    // A desk belongs in front of a sitter, not in an arbitrary empty corner. Pair
    // each available desk with a seated person when the cell they face is open.
    const paired = new Set<number>();
    const reservedCells = new Set<string>();
    for (const person of people.filter((placed) => placed.seat !== null)) {
        const desk = pieces.findIndex((piece, index) => piece.def.name === "desk" && piece.seatedBy === null && !paired.has(index));
        if (desk < 0) break;
        const cell: Cell = [person.cell[0], person.cell[1] + 1];
        if (cell[1] >= GRID || peopleCells.some((taken) => sameCell(taken, cell))) continue;
        // Keep the logical cell reserved but pull the desk back within it: a whole
        // cell of air would make the sitter look beside the desk rather than at it.
        pieces[desk].cell = [person.cell[0], person.cell[1] + 0.6];
        paired.add(desk);
        reservedCells.add(cell.join());
    }

    // A laptop or cup belongs on the desk when the scene has one. The prop keeps
    // its own identity (and therefore its own action marker), but shares the host's
    // cell and is drawn from its stand-free surface shapes above the desktop.
    const surfaced = new Set<number>();
    for (const hostIndex of paired) {
        const host = pieces[hostIndex];
        if (!host.def.surface) continue;
        for (const [x, y] of host.def.surface.slots) {
            const propIndex = pieces.findIndex((piece, index) =>
                index !== hostIndex &&
                piece.seatedBy === null &&
                piece.surface === null &&
                piece.def.surfaceShapes !== undefined &&
                !paired.has(index) &&
                !surfaced.has(index)
            );
            if (propIndex < 0) break;
            const prop = pieces[propIndex];
            prop.cell = host.cell;
            prop.surface = { host: hostIndex, at: [x, y, host.def.surface.z] };
            surfaced.add(propIndex);
        }
    }

    // Everything else, back cells first; within a band, nearest the middle of the screen first.
    const free: Cell[] = [];
    for (let col = 0; col < GRID; col++) for (let row = 0; row < GRID; row++) free.push([col, row]);
    const open = free
        .filter((cell) => !peopleCells.some((taken) => sameCell(taken, cell)) && !reservedCells.has(cell.join()))
        .sort((a, b) => a[0] + a[1] - (b[0] + b[1]) || Math.abs(a[0] - a[1]) - Math.abs(b[0] - b[1]) || a[0] - b[0]);
    let next = 0;
    for (const [index, piece] of pieces.entries()) {
        if (piece.seatedBy === null && !paired.has(index) && !surfaced.has(index)) piece.cell = open[next++];
    }

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
