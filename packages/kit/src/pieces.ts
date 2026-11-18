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

import { box, cylinder, depthOf, extrude, roundedPlan, type Plan, type Projection, type SolidPaths, type Vec2, type Vec3 } from "./iso.ts";
import type { SolidStyle } from "./svg.ts";

export const CELL = 30;

export type Shape =
    | { kind: "box"; plan: Plan; z: number; h: number; style?: SolidStyle }
    | { kind: "poly"; ring: Vec2[]; z: number; h: number; style?: SolidStyle }
    | { kind: "cyl"; cx: number; cy: number; r: number; z: number; h: number; style?: SolidStyle };

export interface PieceDef {
    name: string;
    aliases: string[];
    shapes: Shape[];
    /** A host surface that can carry the small props whose surfaceShapes are defined. */
    surface?: { z: number; slots: Vec2[] };
    /** The prop without its floor stand, centred on the origin for a host surface slot. */
    surfaceShapes?: Shape[];
    /** Drawn after a person sitting on this piece: the arm nearest the viewer. */
    front?: Shape[];
    /** Where a seated person's hips go, if this is something to sit on. */
    seat?: { y: number; z: number; front: number };
    /** Height of the highest point, where an action marker hangs. */
    height: number;
}

const b = (x: number, y: number, w: number, d: number, z: number, h: number, r: number | undefined = undefined, style?: SolidStyle): Shape => ({
    kind: "box",
    plan: { x, y, w, d, r: r ?? Math.min(0.9, w / 2, d / 2) },
    z,
    h,
    style,
});
const c = (cx: number, cy: number, r: number, z: number, h: number, style?: SolidStyle): Shape => ({ kind: "cyl", cx, cy, r, z, h, style });

const LIT: SolidStyle = { lit: true };
// People use the kit's neutral material. Their overlapping parts keep their own
// outlines, but never pick up the green lit treatment reserved for small surfaces.
const PERSON: SolidStyle = {};

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
        surfaceShapes: [b(-6, -3.5, 12, 7, 0, 0.8, 0.5), b(-5, 2.5, 10, 1, 0.8, 6, 0, LIT)],
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
        // A little shorter than a real bed's proportions so a sitter's shins can hang
        // in front of the mattress and still stay inside the bed's own cell.
        shapes: [b(5, 2, 20, 2.5, 0, 16, 0.6), b(5, 4, 20, 21.5, 0, 7, 1, { halo: true }), b(6, 4.5, 18, 20.5, 7, 2.5, 1.5, LIT), b(8, 5.5, 14, 5, 9.5, 2.2, 2, LIT)],
        seat: { y: 14, z: 9.5, front: 25.5 },
        height: 16,
    },
    {
        name: "desk",
        aliases: ["workstation"],
        shapes: [b(4, 8, 2, 14, 0, 12), b(24, 8, 2, 14, 0, 12), b(4, 8, 22, 1.2, 4, 8), b(3, 7, 24, 16, 12, 1.5, 0.6, { halo: true })],
        surface: { z: 13.5, slots: [[11.5, 15], [22, 16]] },
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
        surfaceShapes: [c(0, 0, 2.2, 0, 3.8, LIT)],
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

// MARK: - Generic looks

/**
 * A deliberately small visual vocabulary for things the standard kit does not name.
 * The model keeps the author's words; this only chooses the family of object those
 * words are drawn as. Every look is built from the same primitives as the curated kit.
 */
export const PIECE_LOOKS = [
    "handheld",
    "paper",
    "container",
    "appliance",
    "display",
    "seat",
    "surface",
    "storage",
    "vehicle",
    "plant",
    "building",
    "fixture",
] as const;

export type PieceLook = (typeof PIECE_LOOKS)[number];

export const isPieceLook = (value: unknown): value is PieceLook =>
    typeof value === "string" && (PIECE_LOOKS as readonly string[]).includes(value);

/** Generic shapes are labelled with the semantic piece name by the renderer. */
export const GENERIC_PIECES: Record<PieceLook, PieceDef> = {
    handheld: {
        name: "handheld",
        aliases: [],
        shapes: [...stand(), b(12, 12.5, 6, 5, 10, 2.2, 0.8, LIT)],
        surfaceShapes: [b(-3, -2.5, 6, 5, 0, 2.2, 0.8, LIT)],
        height: 12.2,
    },
    paper: {
        name: "paper",
        aliases: [],
        shapes: [...stand(), b(10.5, 11.5, 9, 7, 10, 0.7, 0.2, LIT)],
        surfaceShapes: [b(-4.5, -3.5, 9, 7, 0, 0.7, 0.2, LIT)],
        height: 10.7,
    },
    container: {
        name: "container",
        aliases: [],
        shapes: [...stand(), c(15, 15, 3.3, 10, 5, LIT), c(15, 15, 2.2, 15, 1)],
        surfaceShapes: [c(0, 0, 3.3, 0, 5, LIT), c(0, 0, 2.2, 5, 1)],
        height: 16,
    },
    appliance: {
        name: "appliance",
        aliases: [],
        shapes: [b(7, 8, 16, 14, 0, 16, 1.2, { halo: true }), b(9, 21.4, 12, 0.6, 9, 4.5, 0.2, LIT), b(12, 21.7, 6, 0.7, 3, 2, 0.2, LIT)],
        height: 16,
    },
    display: {
        name: "display",
        aliases: [],
        shapes: [c(15, 15, 4.5, 0, 1, { halo: true }), c(15, 15, 0.8, 1, 8), b(6, 14, 18, 1.5, 9, 11, 0.5, LIT)],
        height: 20,
    },
    seat: {
        name: "seat",
        aliases: [],
        shapes: [b(9.5, 10.5, 2, 2, 0, 7), b(18.5, 10.5, 2, 2, 0, 7), b(9.5, 18, 2, 2, 0, 7), b(18.5, 18, 2, 2, 0, 7), b(8.5, 9.5, 13, 11, 7, 1.8, 1, { halo: true })],
        seat: { y: 10.5, z: 8.8, front: 21 },
        height: 8.8,
    },
    surface: {
        name: "surface",
        aliases: [],
        shapes: [b(5, 8, 2, 14, 0, 11), b(23, 8, 2, 14, 0, 11), b(4, 7, 22, 16, 11, 1.6, 0.7, { halo: true })],
        surface: { z: 12.6, slots: [[11.5, 15], [21, 16]] },
        height: 12.6,
    },
    storage: {
        name: "storage",
        aliases: [],
        shapes: [b(6, 8, 18, 14, 0, 21, 0.8, { halo: true }), b(7, 21.4, 16, 0.6, 10, 1, 0, LIT), c(19, 22, 0.7, 11.5, 1.2, LIT)],
        height: 21,
    },
    vehicle: {
        name: "vehicle",
        aliases: [],
        shapes: [b(6, 8, 4, 2, 0, 4), b(20, 8, 4, 2, 0, 4), b(4, 9, 22, 12, 2.5, 6, 2, { halo: true }), b(10, 10, 10, 10, 8.5, 4, 2, LIT), b(6, 20, 4, 2, 0, 4), b(20, 20, 4, 2, 0, 4)],
        height: 12.5,
    },
    plant: {
        name: "plant",
        aliases: [],
        shapes: [c(15, 15, 4, 0, 5, { halo: true }), c(15, 15, 1, 5, 7), c(12.5, 15, 4, 9, 5, LIT), c(17.5, 15, 4, 10, 5, LIT)],
        height: 15,
    },
    building: {
        name: "building",
        aliases: [],
        shapes: [b(4, 4, 22, 22, 0, 20, 0.6, { halo: true }), b(3, 3, 24, 24, 20, 1.6, 0.5), b(12, 25.6, 6, 0.8, 0, 9, 0, LIT)],
        height: 21.6,
    },
    fixture: {
        name: "fixture",
        aliases: [],
        shapes: [c(15, 15, 4, 0, 1, { halo: true }), c(15, 15, 0.8, 1, 15), b(10, 12, 10, 6, 16, 5, 1, LIT)],
        height: 21,
    },
};

/** A cautious suggestion. Ambiguous names remain crates unless the author adds a hint. */
export function suggestedPieceLook(name: string): PieceLook | null {
    const words = new Set(name.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
    const has = (...candidates: string[]): boolean => candidates.some((candidate) => words.has(candidate));
    if (has("phone", "remote", "controller", "tool", "key", "keys", "camera")) return "handheld";
    if (has("paper", "document", "ticket", "photo", "photograph", "map", "card", "menu")) return "paper";
    if (has("bottle", "jar", "tin", "can", "box", "bin", "basket", "vase")) return "container";
    if (has("machine", "printer", "oven", "microwave", "kettle", "toaster", "washer", "dryer")) return "appliance";
    if (has("sign", "board", "whiteboard", "poster", "notice", "billboard")) return "display";
    if (has("stool", "seat", "ottoman")) return "seat";
    if (has("workbench", "surface", "worktop", "podium")) return "surface";
    if (has("cabinet", "locker", "drawer", "drawers", "cupboard", "wardrobe")) return "storage";
    if (has("bus", "train", "bike", "bicycle", "motorcycle", "scooter", "truck", "tram")) return "vehicle";
    if (has("flower", "flowers", "bush", "shrub", "sapling")) return "plant";
    if (has("hospital", "library", "warehouse", "factory", "station", "garage")) return "building";
    if (has("clock", "fan", "heater", "radiator", "tripod", "stand")) return "fixture";
    return null;
}

/** A named kit piece wins unless the author explicitly chooses a generic look. */
export function pieceForName(name: string, look?: PieceLook): { def: PieceDef; known: boolean } {
    if (look) return { def: GENERIC_PIECES[look], known: false };
    const named = pieceNamed(name);
    if (named) return { def: named, known: true };
    const suggested = suggestedPieceLook(name);
    return { def: suggested ? GENERIC_PIECES[suggested] : CRATE, known: false };
}

/** Mechanical guardrails shared by curated and generic pieces. */
export function pieceDefProblems(piece: PieceDef): string[] {
    const problems: string[] = [];
    if (piece.shapes.length === 0 || piece.shapes.length > 8) problems.push("needs 1–8 shapes");
    if (!(piece.height > 0 && piece.height <= CELL)) problems.push("height leaves its cell");
    for (const [index, shape] of piece.shapes.entries()) {
        if (shape.z < 0 || shape.h <= 0 || shape.z + shape.h > CELL) problems.push(`shape ${index} has an invalid height`);
        if (shape.kind === "box") {
            const { x, y, w, d } = shape.plan;
            const r = shape.plan.r ?? 0;
            if (w <= 0 || d <= 0 || x < 0 || y < 0 || x + w > CELL || y + d > CELL) problems.push(`shape ${index} leaves its cell`);
            if (r < 0 || r > Math.min(w, d) / 2) problems.push(`shape ${index} has an invalid radius`);
        } else if (shape.kind === "poly") {
            if (shape.ring.length < 3 || shape.ring.some(([x, y]) => x < 0 || y < 0 || x > CELL || y > CELL)) problems.push(`shape ${index} leaves its cell`);
        } else if (shape.r <= 0 || shape.cx - shape.r < 0 || shape.cy - shape.r < 0 || shape.cx + shape.r > CELL || shape.cy + shape.r > CELL) {
            problems.push(`shape ${index} leaves its cell`);
        }
    }
    return problems;
}

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

export type Facing = "north" | "northEast" | "east" | "southEast" | "south" | "southWest" | "west" | "northWest";
export type Pose = { kind: "stand"; facing: Facing } | { kind: "sit"; seat: NonNullable<PieceDef["seat"]>; facing: Facing };

const FACING_ANGLE: Record<Facing, number> = {
    north: Math.PI,
    northEast: (-3 * Math.PI) / 4,
    east: -Math.PI / 2,
    southEast: -Math.PI / 4,
    south: 0,
    southWest: Math.PI / 4,
    west: Math.PI / 2,
    northWest: (3 * Math.PI) / 4,
};

/** Shapes turned about their cell's centre to face another way, in painter's order. */
export const turnShapes = (shapes: Shape[], facing: Facing): Shape[] => rotateShapes(shapes, facing);

function rotateShapes(shapes: Shape[], facing: Facing): Shape[] {
    const angle = FACING_ANGLE[facing];
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const point = ([x, y]: Vec2): Vec2 => rotatePoint([x, y], facing);
    const rotated = angle === 0 ? shapes : shapes.map((shape): Shape => {
        if (shape.kind === "box") return { kind: "poly", ring: roundedPlan(shape.plan).map(point), z: shape.z, h: shape.h, style: shape.style };
        if (shape.kind === "poly") return { ...shape, ring: shape.ring.map(point) };
        const [cx, cy] = point([shape.cx, shape.cy]);
        return { ...shape, cx, cy };
    });
    return sortShapes(rotated);
}

function rotatePoint([x, y]: Vec2, facing: Facing): Vec2 {
    const angle = FACING_ANGLE[facing];
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const dx = x - 15;
    const dy = y - 15;
    return [15 + dx * cos - dy * sin, 15 + dx * sin + dy * cos];
}

function shapeAnchor(shape: Shape): Vec3 {
    if (shape.kind === "box") return [shape.plan.x + shape.plan.w / 2, shape.plan.y + shape.plan.d / 2, shape.z + shape.h / 2];
    if (shape.kind === "poly") {
        const x = shape.ring.reduce((sum, [value]) => sum + value, 0) / shape.ring.length;
        const y = shape.ring.reduce((sum, [, value]) => sum + value, 0) / shape.ring.length;
        return [x, y, shape.z + shape.h / 2];
    }
    return [shape.cx, shape.cy, shape.z + shape.h / 2];
}

/** Rear blocks first, so the torso naturally hides the far arm and leg. */
const sortShapes = (shapes: Shape[]): Shape[] => [...shapes].sort((a, b) => depthOf(shapeAnchor(a)) - depthOf(shapeAnchor(b)));

// A block figure: a cube head wider than the body it sits on, a box torso, box arms
// hanging at its sides and short box legs. The head is about two fifths of the
// figure's height, which is what makes it read as a person at the scene's small size
// and gives the face a flat plane to sit on. Corners are only just softened, so the
// parts read as blocks rather than pegs.
const HEAD = 10.5;
const HEAD_HALF = HEAD / 2;
const TORSO_W = 7.6;
const ARM_W = 2;
// Two legs fill the torso's width with a small gap between them, so their outer
// faces run straight down from the torso's sides. Standing and seated legs share
// the same x and cross-section, so a sitting figure is a standing one folded.
const LEG_W = 3.6;
const LEG_D = 3.6;
const LEG_XS = [15 - TORSO_W / 2, 15 + TORSO_W / 2 - LEG_W] as const;

const TORSO_D = 5;
const THIGH_H = 2.6;
const SEATED_TORSO_H = 7;
const SHIN_CLEARANCE = 0.2;

/**
 * Where a seated figure's body goes on its seat. A sitting figure perches on the
 * front of the seat: the knees sit just past the seat's edge and the torso directly
 * behind them, so the shins drop straight down in front of the torso, as a standing
 * figure's legs do under it. Seating the body at the back of the seat instead gave it
 * thighs as long as the seat is deep, twice a standing leg, and put the knees and
 * shins out in front of the figure rather than under it.
 */
function seatedBody(seat: NonNullable<PieceDef["seat"]>): { knee: number; torsoY: number } {
    const knee = seatedReach(seat);
    return { knee, torsoY: knee - LEG_D - TORSO_D };
}

/**
 * How far forward a seated figure reaches: the front of its knees, in the seat's
 * cell. The shins hang wholly in front of `seat.front`, with a sliver of air, so
 * they are never sunk into the seat they hang from; `seat.front` must therefore be
 * the true front of everything below the seat's surface, which a test holds every
 * seat to. Layout reads this to keep a desk clear of the sitter's knees.
 */
export function seatedReach(seat: NonNullable<PieceDef["seat"]>): number {
    return Math.max(seat.front + SHIN_CLEARANCE + LEG_D, seat.y + TORSO_D + LEG_D);
}

function headMetrics(pose: Pose): { y: number; bottom: number; top: number } {
    if (pose.kind === "stand") return { y: 15, bottom: 13, top: 13 + HEAD };
    const bottom = pose.seat.z + THIGH_H + SEATED_TORSO_H - 0.5;
    return { y: seatedBody(pose.seat).torsoY + TORSO_D / 2, bottom, top: bottom + HEAD };
}

const headBlock = (head: { y: number; bottom: number }): Shape =>
    b(15 - HEAD_HALF, head.y - HEAD_HALF, HEAD, HEAD, head.bottom, HEAD, 0.9, PERSON);

/** Head height above the floor, where thoughts rise from. */
export const headTop = (pose: Pose): number => headMetrics(pose).top;

/** Local centre of the head: labels and thought trails meet the figure rather than its cell. */
export function headPoint(pose: Pose): [x: number, y: number, z: number] {
    const head = headMetrics(pose);
    return [15, head.y, head.top - 3.6];
}

/** A block person: one compact object assembled from the same solids as the kit. */
export function personShapes(pose: Pose): Shape[] {
    const cx = 15;
    const head = headMetrics(pose);
    const torsoX = cx - TORSO_W / 2;
    if (pose.kind === "stand") {
        // Legs are centred under the torso's depth and stop where it starts.
        const shapes: Shape[] = [
            ...LEG_XS.map((x) => b(x, 15 - LEG_D / 2, LEG_W, LEG_D, 0, 5.5, 0.5, PERSON)),
            b(torsoX, 15 - TORSO_D / 2, TORSO_W, TORSO_D, 5.5, 8, 0.7, PERSON),
            b(torsoX - ARM_W, 13.5, ARM_W, 3, 7.2, 5.8, 0.5, PERSON),
            b(torsoX + TORSO_W, 13.5, ARM_W, 3, 7.2, 5.8, 0.5, PERSON),
            headBlock(head),
        ];
        return rotateShapes(shapes, pose.facing);
    }
    const { z } = pose.seat;
    const { knee, torsoY } = seatedBody(pose.seat);
    // A thigh runs from under the torso to the knee; the shin drops from under the
    // knee to the floor, sharing the thigh's x and its front face, so the leg is one
    // bent block with a crease at the knee. Shin then thigh per leg, far leg first:
    // the thigh paints over the shin's top, and the near leg over the far one. The
    // torso sits on the thighs rather than among them, so it can be painted after
    // them without covering the part of the lap that is in front of it.
    const legs: Shape[] = LEG_XS.flatMap((x) => [
        b(x, knee - LEG_D, LEG_W, LEG_D, 0, z, 0.5, PERSON),
        b(x, torsoY, LEG_W, knee - torsoY, z, THIGH_H, 0.5, PERSON),
    ]);
    const torso = b(torsoX, torsoY, TORSO_W, TORSO_D, z + THIGH_H, SEATED_TORSO_H, 0.7, PERSON);
    const [rearArm, frontArm] = sortShapes([
        b(torsoX - ARM_W, torsoY + 1, ARM_W, 3, z + THIGH_H + 1.2, 5.2, 0.5, PERSON),
        b(torsoX + TORSO_W, torsoY + 1, ARM_W, 3, z + THIGH_H + 1.2, 5.2, 0.5, PERSON),
    ]);
    const headShape = headBlock(head);
    // Legs occupy the same projected space as the lap. Paint them first so their
    // internal edges stop at the torso instead of reading through the seated body.
    const seated = [...legs, rearArm, torso, frontArm, headShape];
    return pose.facing === "south" ? seated : rotateShapes(seated, pose.facing);
}

export interface PersonFaceDetails {
    eyes: Vec3[];
    mouth: [Vec3, Vec3, Vec3];
}

/** Facial marks on the visible front plane; away-facing figures remain honest solids. */
export function personFaceDetails(pose: Pose): PersonFaceDetails | null {
    const angle = FACING_ANGLE[pose.facing];
    const outward: Vec2 = [-Math.sin(angle), Math.cos(angle)];
    if ((outward[0] + outward[1]) / Math.sqrt(2) < 0.18) return null;
    const head = headMetrics(pose);
    const front = head.y + HEAD_HALF + 0.05;
    const point = (x: number, z: number): Vec3 => {
        const [rx, ry] = rotatePoint([x, front], pose.facing);
        return [rx, ry, z];
    };
    // Eyes a little above the middle of the face and a wide smile under them, as on
    // a block figure; the control point sits below the corners so the curve dips.
    return {
        eyes: [point(12.4, head.bottom + 5.8), point(17.6, head.bottom + 5.8)],
        mouth: [point(12.9, head.bottom + 3.5), point(15, head.bottom + 1.6), point(17.1, head.bottom + 3.5)],
    };
}

// MARK: - Drawing

export interface PlacedShape {
    paths: SolidPaths;
    style: SolidStyle;
}

/** A shape set in cell (col, row), optionally offset within it, then projected. */
export function placeShapes(shapes: Shape[], col: number, row: number, projection: Projection, offset: Vec3 = [0, 0, 0]): PlacedShape[] {
    const ox = col * CELL + offset[0];
    const oy = row * CELL + offset[1];
    const oz = offset[2];
    return shapes.map((shape) => ({
        paths:
            shape.kind === "box"
                ? box({ ...shape.plan, x: shape.plan.x + ox, y: shape.plan.y + oy }, shape.z + oz, shape.h, projection)
                : shape.kind === "poly"
                  ? extrude(shape.ring.map(([x, y]) => [x + ox, y + oy]), shape.z + oz, shape.h, projection)
                  : cylinder(shape.cx + ox, shape.cy + oy, shape.r, shape.z + oz, shape.h, projection),
        style: shape.style ?? {},
    }));
}
