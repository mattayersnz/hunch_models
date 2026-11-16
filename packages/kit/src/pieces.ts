// pieces.ts
//
// The kit: everything a scene can hold. Each piece is a few solids inside one 30 × 30
// floor cell, written in the order they are drawn — back to front, bottom to top —
// which inside one cell is all painter's order needs.
//
// The set is small on purpose. A model is about people, so the props are the ordinary
// things people's days happen around: a phone, a couch, a desk, a door, a car. A name
// the kit does not know still draws, as a plain labelled crate, so an author is never
// stopped by the kit and the page never needs anything but this file to render.

import { box, cylinder, type Plan, type Projection, type SolidPaths } from "./iso.ts";
import type { SolidStyle } from "./svg.ts";

export const CELL = 30;

export type Shape =
    | { kind: "box"; plan: Plan; z: number; h: number; style?: SolidStyle }
    | { kind: "cyl"; cx: number; cy: number; r: number; z: number; h: number; style?: SolidStyle };

export interface PieceDef {
    name: string;
    aliases: string[];
    shapes: Shape[];
    /** Drawn after a person sitting on this piece: the arm nearest the viewer. */
    front?: Shape[];
    /** Where a seated person's hips go, if this is something to sit on. */
    seat?: { y: number; z: number; front: number };
    /** Height of the highest point, where an action marker hangs. */
    height: number;
}

const b = (x: number, y: number, w: number, d: number, z: number, h: number, r = 0, style?: SolidStyle): Shape => ({
    kind: "box",
    plan: { x, y, w, d, r },
    z,
    h,
    style,
});
const c = (cx: number, cy: number, r: number, z: number, h: number, style?: SolidStyle): Shape => ({ kind: "cyl", cx, cy, r, z, h, style });

const LIT: SolidStyle = { lit: true };

/** A small side table, for things too small to stand on the floor by themselves. */
const stand = (): Shape[] => [b(9, 9, 12, 12, 0, 10, 1, { halo: true })];

export const PIECES: PieceDef[] = [
    {
        name: "phone",
        aliases: ["mobile", "smartphone", "cellphone", "iphone"],
        shapes: [...stand(), b(12.5, 11.5, 4.5, 7, 10, 0.9, 0.8, LIT)],
        height: 11,
    },
    {
        name: "laptop",
        aliases: ["computer", "notebook", "macbook", "pc"],
        shapes: [b(6, 8, 18, 14, 0, 10, 1, { halo: true }), b(9, 11.5, 12, 1, 10, 7.5, 0, LIT), b(9, 12.5, 12, 7, 10, 0.8)],
        height: 17.5,
    },
    {
        name: "screen",
        aliases: ["tv", "television", "monitor", "display"],
        shapes: [c(15, 15, 5, 0, 1, { halo: true }), c(15, 15, 1, 1, 6), b(5, 14, 20, 1.6, 7, 12, 0.4, LIT)],
        height: 19,
    },
    {
        name: "couch",
        aliases: ["sofa", "settee", "lounge"],
        shapes: [b(3, 6, 24, 4, 0, 15, 1.2), b(3, 9, 24, 13, 0, 7, 1, { halo: true }), b(3, 9, 3.5, 13, 0, 10.5, 1)],
        front: [b(23.5, 9, 3.5, 13, 0, 10.5, 1)],
        seat: { y: 11, z: 7, front: 22 },
        height: 15,
    },
    {
        name: "chair",
        aliases: ["armchair", "seat", "stool"],
        shapes: [
            b(9, 8, 12, 2, 0, 18, 0.5),
            b(9.5, 19, 1.4, 1.4, 0, 7),
            b(19.1, 19, 1.4, 1.4, 0, 7),
            b(9.5, 10, 1.4, 1.4, 0, 7),
            b(19.1, 10, 1.4, 1.4, 0, 7),
            b(9, 10, 12, 11, 7, 1.5, 0.8),
        ],
        seat: { y: 11, z: 8.5, front: 21.5 },
        height: 18,
    },
    {
        name: "bench",
        aliases: ["pew"],
        shapes: [b(5, 11, 2, 7, 0, 6), b(23, 11, 2, 7, 0, 6), b(3, 10, 24, 9, 6, 1.6, 0.6, { halo: true })],
        seat: { y: 11, z: 7.6, front: 19.5 },
        height: 8,
    },
    {
        name: "bed",
        aliases: ["mattress"],
        shapes: [b(5, 2, 20, 2.5, 0, 16, 0.6), b(5, 4, 20, 24, 0, 7, 1, { halo: true }), b(6, 4.5, 18, 22, 7, 2.5, 1.5, LIT), b(8, 5.5, 14, 5, 9.5, 2.2, 2, LIT)],
        seat: { y: 14, z: 9.5, front: 27 },
        height: 16,
    },
    {
        name: "desk",
        aliases: ["workstation"],
        shapes: [b(4, 8, 2, 14, 0, 12), b(24, 8, 2, 14, 0, 12), b(4, 8, 22, 1.2, 4, 8), b(3, 7, 24, 16, 12, 1.5, 0.6, { halo: true })],
        height: 13.5,
    },
    {
        name: "table",
        aliases: ["dining table", "kitchen table"],
        shapes: [c(15, 15, 6, 0, 1, { halo: true }), c(15, 15, 1.4, 1, 10), c(15, 15, 10, 11, 1.6)],
        height: 12.6,
    },
    {
        name: "counter",
        aliases: ["kitchen", "bar", "till", "checkout", "reception"],
        shapes: [b(3, 9, 24, 11, 0, 13.5, 0.5, { halo: true }), b(2, 8, 26, 13, 13.5, 1.4, 0.6, LIT)],
        height: 15,
    },
    {
        name: "door",
        aliases: ["doorway", "entrance", "exit"],
        shapes: [b(7, 13, 2, 3, 0, 25), b(21, 13, 2, 3, 0, 25), b(9, 13.6, 12, 1.8, 0, 23, 0, LIT), b(7, 13, 16, 3, 23, 2.4)],
        height: 25.4,
    },
    {
        name: "building",
        aliases: ["house", "home", "shop", "store", "office", "cafe", "school", "church", "bank", "work"],
        shapes: [b(4, 4, 22, 22, 0, 20, 0.5, { halo: true }), b(3, 3, 24, 24, 20, 1.6, 0.5), b(12, 25.6, 6, 0.8, 0, 9, 0, LIT)],
        height: 21.6,
    },
    {
        name: "car",
        aliases: ["vehicle", "taxi", "uber", "van", "ute"],
        shapes: [
            b(6, 8, 4, 2, 0, 4),
            b(20, 8, 4, 2, 0, 4),
            b(3, 9, 24, 12, 2.5, 6, 2, { halo: true }),
            b(9, 10, 12, 10, 8.5, 5, 2, LIT),
            b(6, 20, 4, 2, 0, 4),
            b(20, 20, 4, 2, 0, 4),
        ],
        height: 13.5,
    },
    {
        name: "tree",
        aliases: ["park", "garden", "outside"],
        shapes: [c(15, 15, 5, 0, 0.8, { halo: true }), c(15, 15, 1.6, 0.8, 10), c(15, 15, 8, 10, 9, LIT), c(15, 15, 5, 19, 5, LIT)],
        height: 24,
    },
    {
        name: "plant",
        aliases: ["pot plant", "flowers"],
        shapes: [c(15, 15, 4, 0, 6, { halo: true }), c(15, 15, 5.5, 6, 6, LIT)],
        height: 12,
    },
    {
        name: "letter",
        aliases: ["letters", "mail", "envelope", "post", "bill", "bills", "form", "paperwork", "contract"],
        shapes: [...stand(), b(11, 11, 8.5, 6, 10, 0.6, 0, LIT), b(11.6, 12.4, 8.5, 6, 10.6, 0.6, 0, LIT)],
        height: 11.2,
    },
    {
        name: "book",
        aliases: ["books", "journal", "diary", "bible", "notes", "notebooks"],
        shapes: [...stand(), b(11, 11, 8, 6, 10, 1.4, 0.3), b(11.5, 11.4, 7.5, 5.5, 11.4, 1.4, 0.3, LIT), b(11.2, 11.2, 7.6, 5.8, 12.8, 1.2, 0.3)],
        height: 14,
    },
    {
        name: "cup",
        aliases: ["coffee", "mug", "tea", "drink"],
        shapes: [...stand(), c(15, 15, 2.4, 10, 4, LIT)],
        height: 14,
    },
    {
        name: "coins",
        aliases: ["money", "cash", "savings", "rent", "payment", "wallet"],
        shapes: [...stand(), c(13, 14, 2.8, 10, 1), c(13, 14, 2.8, 11, 1), c(13, 14, 2.8, 12, 1, LIT), c(17.5, 16.5, 2.8, 10, 1, LIT)],
        height: 13,
    },
    {
        name: "bag",
        aliases: ["backpack", "handbag", "suitcase", "luggage", "shopping"],
        shapes: [b(10, 12, 10, 6, 0, 10, 1.5, { halo: true }), b(13, 14.4, 4, 1.2, 10, 2.5, 0.4)],
        height: 12.5,
    },
    {
        name: "lamp",
        aliases: ["light"],
        shapes: [c(15, 15, 3.5, 0, 1, { halo: true }), c(15, 15, 0.6, 1, 17), c(15, 15, 4.5, 18, 5, LIT)],
        height: 23,
    },
    {
        name: "shelf",
        aliases: ["bookcase", "shelves", "cupboard", "fridge", "wardrobe"],
        shapes: [b(5, 9, 20, 9, 0, 24, 0.4, { halo: true }), b(6, 17.6, 18, 0.6, 7.5, 1, 0, LIT), b(6, 17.6, 18, 0.6, 15.5, 1, 0, LIT)],
        height: 24,
    },
];

/** An unknown name: a crate, labelled with what the author wrote. */
export const CRATE: PieceDef = {
    name: "crate",
    aliases: [],
    shapes: [b(8, 8, 14, 14, 0, 11, 0.8, { halo: true })],
    height: 11,
};

const BY_NAME = new Map<string, PieceDef>();
for (const piece of PIECES) for (const name of [piece.name, ...piece.aliases]) BY_NAME.set(name, piece);

/** The kit piece for a name, or null when the kit has none. */
export const pieceNamed = (name: string): PieceDef | null => BY_NAME.get(name.trim().toLowerCase()) ?? null;

/** Every word that refers to this piece, for matching an action's text to it. */
export const wordsFor = (name: string): string[] => {
    const piece = pieceNamed(name);
    return piece ? [name.toLowerCase(), piece.name, ...piece.aliases] : [name.toLowerCase()];
};

// MARK: - People

export type Pose = { kind: "stand" } | { kind: "sit"; seat: NonNullable<PieceDef["seat"]> };

/** Head height above the floor, where thoughts rise from. */
export const headTop = (pose: Pose): number => (pose.kind === "sit" ? pose.seat.z + 2.4 + 10 + 5.2 : 26.2);

/** A person in a cell, facing the viewer's left, made of the same solids as the furniture. */
export function personShapes(pose: Pose): Shape[] {
    const cx = 15;
    if (pose.kind === "stand") {
        const cy = 15;
        return [
            b(cx - 2.8, cy - 1.2, 2.3, 2.6, 0, 11, 0.6),
            b(cx + 0.5, cy - 1.2, 2.3, 2.6, 0, 11, 0.6),
            b(cx - 4.6, cy - 1, 1.3, 2.2, 12, 8, 0.6, LIT),
            b(cx - 3.3, cy - 2, 6.6, 4.2, 11, 10, 1.6, LIT),
            b(cx + 3.3, cy - 1, 1.3, 2.2, 12, 8, 0.6, LIT),
            c(cx, cy, 2.6, 21, 5.2, LIT),
        ];
    }
    const { y, z, front } = pose.seat;
    // Thighs run from the hips to just past the seat's front edge, where the shins drop.
    const shin = Math.max(front - y + 0.4, 4);
    return [
        b(cx - 2.8, y, 2.3, shin, z, 2.4, 0.6),
        b(cx + 0.5, y, 2.3, shin, z, 2.4, 0.6),
        b(cx - 2.8, y + shin - 0.4, 2.3, 2.4, 0, z + 1, 0.6),
        b(cx + 0.5, y + shin - 0.4, 2.3, 2.4, 0, z + 1, 0.6),
        b(cx - 4.6, y + 0.4, 1.3, 2.2, z + 3.4, 8, 0.6, LIT),
        b(cx - 3.3, y - 0.6, 6.6, 4.2, z + 2.4, 10, 1.6, LIT),
        b(cx + 3.3, y + 0.4, 1.3, 2.2, z + 3.4, 8, 0.6, LIT),
        c(cx, y + 1.5, 2.6, z + 12.4, 5.2, LIT),
    ];
}

// MARK: - Drawing

export interface PlacedShape {
    paths: SolidPaths;
    style: SolidStyle;
}

/** A shape set in cell (col, row), projected. */
export function placeShapes(shapes: Shape[], col: number, row: number, projection: Projection): PlacedShape[] {
    const ox = col * CELL;
    const oy = row * CELL;
    return shapes.map((shape) => ({
        paths:
            shape.kind === "box"
                ? box({ ...shape.plan, x: shape.plan.x + ox, y: shape.plan.y + oy }, shape.z, shape.h, projection)
                : cylinder(shape.cx + ox, shape.cy + oy, shape.r, shape.z, shape.h, projection),
        style: shape.style ?? {},
    }));
}
