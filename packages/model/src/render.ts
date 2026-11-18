// render.ts
//
// A hunch model as HTML: one card per scene with the drawing, and under it the words.
//
// The words are HTML, not SVG, so they wrap, read at 390px, and can be selected,
// translated and read aloud. The drawing carries only numbers and letters, each tied
// to its line by `data-id` — the same id a response points at — so hovering a line
// lights its marker and the site can hang a response on either.

import {
    CELL,
    PAGE_CSS,
    THEME_CSS,
    box,
    escapeXml,
    fitWidth,
    headPoint,
    headTop,
    iso,
    lineSvg,
    num,
    pathOf,
    personFaceDetails,
    personShapes,
    placeShapes,
    solidSvg,
    turnShapes,
    unitOf,
    type PlacedShape,
    type Projection,
    type Shape,
    type Vec2,
    type Vec3,
} from "@hunch/kit";
import type { HunchModel, Mark, ModelLine, Scene } from "./format.ts";
import { GRID, layoutScene, type Cell, type PlacedPiece, type SceneLayout } from "./layout.ts";

export type Theme = "dark" | "light" | "auto";

const WIDTH = 560;
/** A mark's radius in world units; clamped in pixels so it stays tappable and quiet. */
const RADIUS = 3.8;
/** Never zoom in past this many pixels per world unit, however small the scene. */
const MAX_UNIT = 4.6;
const THOUGHTS_PER_ROW = 4;
/** How far above an unknown piece its marks' leaders start, clearing its name. */
const LABEL_LIFT = 6;

const asks = (marks: Mark[]): boolean => marks.includes("unsure") || marks.includes("hunch");

const centreOf = ([col, row]: Cell): [number, number] => [col * CELL + CELL / 2, row * CELL + CELL / 2];

const shapesHeight = (shapes: Shape[]): number => Math.max(0, ...shapes.map((shape) => shape.z + shape.h));

function piecePlacement(piece: PlacedPiece, layout: SceneLayout): { cell: Cell; shapes: Shape[]; offset: Vec3; centre: Vec2; top: number } {
    if (piece.surface === null) {
        const shapes = piece.turned ? turnShapes(piece.def.shapes, "north") : piece.def.shapes;
        return { cell: piece.cell, shapes, offset: [0, 0, 0], centre: centreOf(piece.cell), top: piece.def.height };
    }
    const host = layout.pieces[piece.surface.host];
    const shapes = piece.def.surfaceShapes ?? piece.def.shapes;
    const [x, y, z] = piece.surface.at;
    return {
        cell: host.cell,
        shapes,
        offset: [x, y, z],
        centre: [host.cell[0] * CELL + x, host.cell[1] * CELL + y],
        top: z + shapesHeight(shapes),
    };
}

// MARK: - The drawing

interface MarkSpec {
    kind: "does" | "thinks";
    line: ModelLine;
    label: string;
    at: Vec2;
    /** Where its leader or trail starts: the piece it names, or the head that thinks it. */
    from: Vec2 | null;
    fixed: boolean;
}

/**
 * Moves marks apart until no two are closer than `2 × reach`, in place. Each mark only
 * ever moves up, away from the drawing, and in the order given, so the result is the
 * same every time and the first mark of a scene stays where layout put it.
 */
export function separate(points: Vec2[], reach: number): void {
    const gap = reach * 2;
    for (let index = 1; index < points.length; index++) {
        for (let guard = 0; guard < 40; guard++) {
            const clash = points.slice(0, index).find(([x, y]) => Math.hypot(points[index][0] - x, points[index][1] - y) < gap - 0.01);
            if (!clash) break;
            const dx = points[index][0] - clash[0];
            // Rise just far enough to clear the mark it hit.
            const lift = Math.sqrt(Math.max(0, gap * gap - dx * dx)) - (clash[1] - points[index][1]);
            points[index][1] -= Math.max(1, lift);
        }
    }
}

interface Drawn {
    depth: number;
    svg: string;
}

const solids = (placed: PlacedShape[]): string => placed.map(({ paths, style }) => solidSvg(paths, style)).join("");

function personFaceSvg(pose: Parameters<typeof personFaceDetails>[0], cell: Cell, projection: Projection, u: number): string {
    const details = personFaceDetails(pose);
    if (!details) return "";
    const world = ([x, y, z]: Vec3): Vec3 => [cell[0] * CELL + x, cell[1] * CELL + y, z];
    const eyes = details.eyes.map((point) => iso(world(point), projection));
    const mouth = details.mouth.map((point) => iso(world(point), projection)) as [Vec2, Vec2, Vec2];
    const radius = Math.min(2.3, Math.max(1.35, 0.48 * u));
    return `${eyes.map(([x, y]) => `<circle class="hm-face-eye" cx="${num(x)}" cy="${num(y)}" r="${num(radius)}"/>`).join("")}<path class="hm-face-mouth" d="M${num(mouth[0][0])} ${num(mouth[0][1])}Q${num(mouth[1][0])} ${num(mouth[1][1])} ${num(mouth[2][0])} ${num(mouth[2][1])}"/>`;
}

/** The used cells, as a world-space rectangle with a little margin. */
interface Bounds {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
}

function boundsOf(layout: SceneLayout): Bounds {
    const cells: Cell[] = [...layout.people.map((placed) => placed.cell), ...layout.pieces.map((piece) => piece.cell)];
    if (cells.length === 0) cells.push([1, 1], [2, 2]);
    const cols = cells.map(([col]) => col);
    const rows = cells.map(([, row]) => row);
    // Never narrower than two cells, so a scene of one person still stands on a floor.
    let [c0, c1, r0, r1] = [Math.min(...cols), Math.max(...cols), Math.min(...rows), Math.max(...rows)];
    if (c1 === c0) c1 < GRID - 1 ? c1++ : c0--;
    if (r1 === r0) r1 < GRID - 1 ? r1++ : r0--;
    const margin = 4;
    return { x0: c0 * CELL - margin, y0: r0 * CELL - margin, x1: (c1 + 1) * CELL + margin, y1: (r1 + 1) * CELL + margin };
}

function floorSvg({ x0, y0, x1, y1 }: Bounds, projection: Projection): string {
    const plate = solidSvg(box({ x: x0, y: y0, w: x1 - x0, d: y1 - y0, r: 2 }, -5, 5, projection), { tone: "mid", halo: true });
    const grid: string[] = [];
    for (let at = Math.ceil(x0 / CELL) * CELL; at < x1; at += CELL) {
        if (at > x0 + 1) grid.push(pathOf([iso([at, y0 + 2, 0], projection), iso([at, y1 - 2, 0], projection)]));
    }
    for (let at = Math.ceil(y0 / CELL) * CELL; at < y1; at += CELL) {
        if (at > y0 + 1) grid.push(pathOf([iso([x0 + 2, at, 0], projection), iso([x1 - 2, at, 0], projection)]));
    }
    return plate + lineSvg(grid.join(""), "faint", true);
}

// A mark in the drawing is the same key the list beside it uses (.hm-key in theme.ts):
// a circle for something done, a rounded square with one sharp corner for something
// thought, the label in the middle at half the key's width, a one-pixel outline, and
// the accent for a line the author asked about. Being the same shape in both places
// is what lets a reader find "b" in the drawing from "b" in the list.

function markSvg(id: string, label: string, at: Vec2, radius: number, ask: boolean): string {
    return `<g class="hm-mark" data-id="${id}"${ask ? " data-ask" : ""}><circle cx="${num(at[0])}" cy="${num(at[1])}" r="${num(radius)}"/>${keyText(label, at, radius)}</g>`;
}

const keyText = (label: string, [x, y]: Vec2, radius: number): string =>
    `<text x="${num(x)}" y="${num(y + 0.5)}" style="font-size:${num(radius * 1.05)}px">${escapeXml(label)}</text>`;

/**
 * The thought key: a square as wide as a mark, its corners rounded to 0.8 of its
 * half-width except the bottom left, at 0.2 — the list's 8px 8px 8px 2px on a 20px key.
 * The sharp corner is the one the trail of dots leaves from, toward the head.
 */
function thoughtKeyPath([x, y]: Vec2, r: number): string {
    const round = r * 0.8;
    const sharp = r * 0.2;
    const [left, top, right, bottom] = [x - r, y - r, x + r, y + r];
    return [
        `M${num(left + round)} ${num(top)}`,
        `H${num(right - round)}`,
        `A${num(round)} ${num(round)} 0 0 1 ${num(right)} ${num(top + round)}`,
        `V${num(bottom - round)}`,
        `A${num(round)} ${num(round)} 0 0 1 ${num(right - round)} ${num(bottom)}`,
        `H${num(left + sharp)}`,
        `A${num(sharp)} ${num(sharp)} 0 0 1 ${num(left)} ${num(bottom - sharp)}`,
        `V${num(top + round)}`,
        `A${num(round)} ${num(round)} 0 0 1 ${num(left + round)} ${num(top)}`,
        "Z",
    ].join("");
}

/** A thought: the thought key, with a short trail of dots back to the head. */
function thoughtSvg(id: string, label: string, at: Vec2, from: Vec2, radius: number, ask: boolean): string {
    const [x, y] = at;
    const r = radius;
    const trail = [0.32, 0.62]
        .map((t, index) => {
            const px = from[0] + (x - r - from[0]) * t;
            const py = from[1] + (y + r - from[1]) * t;
            return `<circle class="hm-trail" cx="${num(px)}" cy="${num(py)}" r="${num(1.1 + index * 0.7)}"/>`;
        })
        .join("");
    return `<g class="hm-mark" data-id="${id}" data-thought${ask ? " data-ask" : ""}>${trail}<path class="hm-bubble" d="${thoughtKeyPath(at, r)}"/>${keyText(label, at, r)}</g>`;
}

// MARK: - Names and loose actions

/** A screen rectangle. */
interface Box {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
}

/**
 * The largest a name is drawn, in drawing units: the label grows on a narrow card so
 * it stays readable on a phone (see .hm-label in theme.ts), and overlaps are judged at
 * that size so a name that clears its neighbours on a phone clears them everywhere.
 */
const NAME_SIZE = 15;
/** A monospace character's advance with the label's letter spacing, per unit of size. */
const NAME_ADVANCE = 0.64;
/** A drawing shows a name up to this many characters; the list beneath has it whole. */
const NAME_CHARS = 16;

const nameText = (name: string): string => {
    const chars = [...name];
    return chars.length > NAME_CHARS ? `${chars.slice(0, NAME_CHARS - 1).join("").trimEnd()}…` : name;
};

const overlap = (a: Box, b: Box): number =>
    Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));

/** The screen rectangle around a world-space block. */
function screenBox([x0, y0, z0]: Vec3, [x1, y1, z1]: Vec3, projection: Projection): Box {
    const corners: Vec2[] = [];
    for (const x of [x0, x1]) for (const y of [y0, y1]) for (const z of [z0, z1]) corners.push(iso([x, y, z], projection));
    const xs = corners.map(([x]) => x);
    const ys = corners.map(([, y]) => y);
    return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

/** The floor rectangle and height a set of shapes fills, in its cell's coordinates. */
function footprint(shapes: Shape[]): { x0: number; y0: number; x1: number; y1: number; top: number } {
    const xs: number[] = [];
    const ys: number[] = [];
    for (const shape of shapes) {
        if (shape.kind === "box") {
            xs.push(shape.plan.x, shape.plan.x + shape.plan.w);
            ys.push(shape.plan.y, shape.plan.y + shape.plan.d);
        } else if (shape.kind === "cyl") {
            xs.push(shape.cx - shape.r, shape.cx + shape.r);
            ys.push(shape.cy - shape.r, shape.cy + shape.r);
        } else {
            for (const [x, y] of shape.ring) {
                xs.push(x);
                ys.push(y);
            }
        }
    }
    return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys), top: shapesHeight(shapes) };
}

/** What a name should not sit on: each person's figure and each piece, on screen. */
function sceneObstacles(layout: SceneLayout, projection: Projection): { box: Box; person: number | null }[] {
    const found: { box: Box; person: number | null }[] = [];
    layout.people.forEach((placed, index) => {
        const [ox, oy] = [placed.cell[0] * CELL, placed.cell[1] * CELL];
        const body = footprint(personShapes(placed.pose));
        found.push({ box: screenBox([ox + body.x0, oy + body.y0, 0], [ox + body.x1, oy + body.y1, body.top], projection), person: index });
    });
    layout.pieces.forEach((piece) => {
        if (piece.seatedBy !== null || piece.surface !== null) return;
        const placed = piecePlacement(piece, layout);
        const [ox, oy] = [placed.cell[0] * CELL, placed.cell[1] * CELL];
        const area = footprint(placed.shapes);
        found.push({ box: screenBox([ox + area.x0, oy + area.y0, 0], [ox + area.x1, oy + area.y1, area.top], projection), person: null });
    });
    return found;
}

/**
 * Where a person's name goes: beside the head, on the outside of the group unless the
 * other side covers clearly less of the other people, the furniture and earlier names.
 */
function placeName(name: string, head: Vec2, u: number, outside: number, avoid: Box[]): { at: Vec2; side: number; box: Box } {
    const width = [...name].length * NAME_SIZE * NAME_ADVANCE;
    const y = head[1] + 3 * u;
    const gap = 7.4 * u;
    const beside = (side: number) => {
        const x = head[0] + side * gap;
        const box: Box = side > 0 ? { x0: x, y0: y - NAME_SIZE * 0.8, x1: x + width, y1: y + NAME_SIZE * 0.25 } : { x0: x - width, y0: y - NAME_SIZE * 0.8, x1: x, y1: y + NAME_SIZE * 0.25 };
        return { at: [x, y] as Vec2, side, box };
    };
    const candidates = [beside(outside), beside(-outside)];
    const score = (box: Box): number => avoid.reduce((sum, other) => sum + overlap(box, other), 0);
    // The other side has to be clearly better to be worth leaving the outside.
    return score(candidates[1].box) < score(candidates[0].box) * 0.6 ? candidates[1] : candidates[0];
}

/** Where on the floor a person's actions that name nothing go, in world coordinates. */
interface LooseStrip {
    origin: Vec2;
    /** Along the strip, then away from the person. */
    along: Vec2;
    away: Vec2;
}

/**
 * The floor in front of a person, unless something stands there — a desk pulled up to
 * a sitter, or the thing they use brought round to face them — and then the floor to
 * their right, then their left. Marks are drawn over everything, so this is only about
 * not sitting a number on top of a piece it has nothing to do with.
 */
function looseStrip(placed: SceneLayout["people"][number], layout: SceneLayout, count: number): LooseStrip {
    const ox = placed.cell[0] * CELL;
    const oy = placed.cell[1] * CELL;
    const depth = 2 + Math.ceil(Math.max(1, count) / 3) * 9;
    const candidates: { strip: LooseStrip; area: [number, number, number, number] }[] = [
        { strip: { origin: [ox + 3, oy + CELL + 1], along: [9, 0], away: [0, 9] }, area: [ox, oy + CELL, ox + CELL, oy + CELL + depth] },
        { strip: { origin: [ox + CELL + 1, oy + 3], along: [0, 9], away: [9, 0] }, area: [ox + CELL, oy, ox + CELL + depth, oy + CELL] },
        { strip: { origin: [ox - 1, oy + 3], along: [0, 9], away: [-9, 0] }, area: [ox - depth, oy, ox, oy + CELL] },
    ];
    const occupied: [number, number, number, number][] = [
        ...layout.people.map((other): [number, number, number, number] => [other.cell[0] * CELL + 7, other.cell[1] * CELL + 7, other.cell[0] * CELL + 23, other.cell[1] * CELL + 23]),
        ...layout.pieces
            .filter((piece) => piece.seatedBy === null && piece.surface === null)
            .map((piece): [number, number, number, number] => {
                const placement = piecePlacement(piece, layout);
                const area = footprint(placement.shapes);
                const [px, py] = [placement.cell[0] * CELL, placement.cell[1] * CELL];
                return [px + area.x0, py + area.y0, px + area.x1, py + area.y1];
            }),
    ];
    const clear = ([x0, y0, x1, y1]: [number, number, number, number]): boolean =>
        occupied.every(([a0, b0, a1, b1]) => a1 <= x0 || x1 <= a0 || b1 <= y0 || y1 <= b0);
    return (candidates.find((candidate) => clear(candidate.area)) ?? candidates[0]).strip;
}

/** Where each of a person's actions that name nothing goes, in world coordinates. */
export function looseSpots(layout: SceneLayout, personIndex: number): Vec3[] {
    const placed = layout.people[personIndex];
    const loose = placed.person.does.filter((line) => (layout.actionAt.get(line.id) ?? null) === null);
    const strip = looseStrip(placed, layout, placed.person.does.length);
    return loose.map((_, index) => looseSpot(strip, index));
}

const looseSpot = ({ origin, along, away }: LooseStrip, index: number): Vec3 => {
    const step = index % 3;
    const row = Math.floor(index / 3);
    return [origin[0] + along[0] * step + away[0] * row, origin[1] + along[1] * step + away[1] * row, 0];
};

export function sceneSvg(scene: Scene, layout: SceneLayout = layoutScene(scene)): string {
    // Fit the used floor plus the room every mark needs above it, measured in world
    // units on the assumption that a mark is about four units across (see RADIUS).
    const bounds = boundsOf(layout);
    const reach: Vec3[] = [
        [bounds.x0, bounds.y0, -5], [bounds.x1, bounds.y0, -5], [bounds.x0, bounds.y1, -5], [bounds.x1, bounds.y1, -5],
        [bounds.x0, bounds.y0, 0], [bounds.x1, bounds.y1, 0],
    ];
    layout.pieces.forEach((piece) => {
        const placed = piecePlacement(piece, layout);
        reach.push([...placed.centre, placed.top + (piece.known ? 20 : 6)] as Vec3);
    });
    layout.people.forEach((placed) => {
        const rows = Math.ceil(placed.person.thinks.length / THOUGHTS_PER_ROW);
        reach.push([...centreOf(placed.cell), headTop(placed.pose) + 10 + rows * 10] as Vec3);
    });
    const { projection, height } = fitWidth(reach, WIDTH, { pad: 22, maxUnit: MAX_UNIT, minHeight: 260, maxHeight: 520 });
    const u = unitOf(projection);
    const radius = Math.min(15, Math.max(10, RADIUS * u));

    // Solids, in painter's order by cell: a seated person is drawn with their seat.
    const drawn: Drawn[] = [];
    layout.pieces.forEach((piece, pieceIndex) => {
        if (piece.seatedBy !== null || piece.surface !== null) return;
        const surfaceProps = layout.pieces
            .filter((candidate) => candidate.surface?.host === pieceIndex)
            .map((candidate) => {
                const placed = piecePlacement(candidate, layout);
                return solids(placeShapes(placed.shapes, ...placed.cell, projection, placed.offset));
            })
            .join("");
        const own = piecePlacement(piece, layout);
        drawn.push({ depth: piece.cell[0] + piece.cell[1], svg: solids(placeShapes(own.shapes, ...piece.cell, projection)) + surfaceProps });
    });
    layout.people.forEach((placed) => {
        const seat = placed.seat === null ? null : layout.pieces[placed.seat];
        const parts = [
            seat ? solids(placeShapes(seat.def.shapes, ...placed.cell, projection)) : "",
            `<g data-id="${placed.person.id}">${solids(placeShapes(personShapes(placed.pose), ...placed.cell, projection))}${personFaceSvg(placed.pose, placed.cell, projection, u)}</g>`,
            seat?.def.front ? solids(placeShapes(seat.def.front, ...placed.cell, projection)) : "",
        ];
        drawn.push({ depth: placed.cell[0] + placed.cell[1] + 0.01, svg: parts.join("") });
    });
    drawn.sort((a, b) => a.depth - b.depth);

    // Marks go over everything, so no solid can hide a line someone may respond to.
    // They are placed first, then separated, then drawn.
    const labels: string[] = [];
    const specs: MarkSpec[] = [];

    layout.pieces.forEach((piece) => {
        if (piece.known) return;
        // Just above the generic object; a mark that names it hangs above the label.
        // Small generic pieces may share a host surface, so use their actual placement.
        const placed = piecePlacement(piece, layout);
        const [x, y] = iso([placed.centre[0], placed.centre[1], placed.top], projection);
        labels.push(`<text class="hm-label" data-tone="muted" x="${num(x)}" y="${num(y - 3.2 * u)}" text-anchor="middle">${escapeXml(piece.name)}</text>`);
    });

    const perPiece = new Map<number, number>();
    const obstacles = sceneObstacles(layout, projection);
    const placedNames: Box[] = [];
    layout.people.forEach((placed, personIndex) => {
        const [hx, hy, hz] = headPoint(placed.pose);
        const head = iso([placed.cell[0] * CELL + hx, placed.cell[1] * CELL + hy, hz], projection);
        // Names prefer the outside of the group, then whichever side covers least of the
        // other people, the furniture and the names already placed.
        const across = placed.cell[0] - placed.cell[1];
        const outside = placed.pose.kind === "sit" ? 1 : across === 0 ? (placed.cell[0] >= GRID / 2 ? 1 : -1) : Math.sign(across);
        const name = nameText(placed.person.name);
        const nameAt = placeName(name, head, u, outside, [...obstacles.filter((item) => item.person !== personIndex).map((item) => item.box), ...placedNames]);
        placedNames.push(nameAt.box);
        const labelSide = nameAt.side;
        labels.push(`<text class="hm-label" x="${num(nameAt.at[0])}" y="${num(nameAt.at[1])}"${labelSide < 0 ? ' text-anchor="end"' : ""}>${escapeXml(name)}</text>`);

        let loose = 0;
        const strip = looseStrip(placed, layout, placed.person.does.length);
        placed.person.does.forEach((line: ModelLine) => {
            const label = layout.labels.get(line.id) ?? "";
            const pieceIndex = layout.actionAt.get(line.id) ?? null;
            if (pieceIndex !== null) {
                const piece = layout.pieces[pieceIndex];
                const placed = piecePlacement(piece, layout);
                const [px, py] = placed.centre;
                const count = perPiece.get(pieceIndex) ?? 0;
                perPiece.set(pieceIndex, count + 1);
                const base = iso([px, py, placed.top + (piece.known ? 0.5 : LABEL_LIFT)], projection);
                specs.push({ kind: "does", line, label, at: [base[0] + count * (radius * 2 + 4), base[1] - 9 * u], from: base, fixed: false });
                return;
            }
            // An action that names nothing in the scene sits on the floor in front of the
            // person, or beside them when something stands in front (a desk pulled up).
            const at = iso(looseSpot(strip, loose), projection);
            loose++;
            specs.push({ kind: "does", line, label, at, from: null, fixed: false });
        });

        placed.person.thinks.forEach((line, index) => {
            const row = Math.floor(index / THOUGHTS_PER_ROW);
            const inRow = Math.min(THOUGHTS_PER_ROW, placed.person.thinks.length - row * THOUGHTS_PER_ROW);
            const column = index % THOUGHTS_PER_ROW;
            const spacing = radius * 2 + 6;
            const at: Vec2 = [head[0] + (column - (inRow - 1) / 2) * spacing + labelSide * radius * 0.6, head[1] - 9 * u - radius - row * (radius * 2 + 8)];
            specs.push({ kind: "thinks", line, label: layout.labels.get(line.id) ?? "", at, from: [head[0], head[1] - 1.5 * u], fixed: false });
        });
    });

    separate(specs.map((spec) => spec.at), radius + 4);
    const marks = specs.map((spec) => {
        const ask = asks(spec.line.marks);
        if (spec.kind === "thinks") return thoughtSvg(spec.line.id, spec.label, spec.at, spec.from ?? spec.at, radius, ask);
        const leader = spec.from ? lineSvg(pathOf([spec.from, [spec.at[0], spec.at[1] + radius]]), "mid") : "";
        return leader + markSvg(spec.line.id, spec.label, spec.at, radius, ask);
    });

    const body = [floorSvg(bounds, projection), ...drawn.map((item) => item.svg), ...labels, ...marks].join("");
    const who = scene.people.map((person) => person.name).join(", ");
    const label = `${scene.name}${who ? `, with ${who}` : ""}`;
    return `<svg class="hm-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${height}" role="img" aria-label="${escapeXml(label)}">${body}</svg>`;
}

// MARK: - The words

const TAG: Record<Mark, string> = { unsure: "is this right?", hunch: "a hunch", focus: "" };

function lineHtml(line: ModelLine, label: string): string {
    const ask = asks(line.marks);
    const tags = line.marks.map((mark) => TAG[mark]).filter(Boolean).map((tag) => `<span class="hm-tag">${tag}</span>`).join("");
    return `<li data-id="${line.id}" tabindex="0"${ask ? " data-ask" : ""}><span class="hm-key" aria-hidden="true">${escapeXml(label)}</span><span>${escapeXml(line.text)}${tags}</span></li>`;
}

function sceneHtml(scene: Scene, index: number): string {
    const layout = layoutScene(scene);
    const does = scene.people.reduce((sum, person) => sum + person.does.length, 0);
    const thinks = scene.people.reduce((sum, person) => sum + person.thinks.length, 0);
    const readout = [does ? `${does} does` : "", thinks ? `${thinks} thinks` : ""].filter(Boolean).join(" · ");
    const who = scene.people.map((person) => person.name).join(" · ");
    const corner = (at: string, text: string): string => (text ? `<span class="hm-corner" data-at="${at}">${escapeXml(text)}</span>` : "");
    const title = `${scene.emoji ? `${scene.emoji} ` : ""}${scene.name}`;
    const people = scene.people
        .map((person) => {
            const about = person.about ? ` <span>${escapeXml(person.about)}</span>` : "";
            const doesList = person.does.length
                ? `<h4>Does</h4><ol class="hm-does">${person.does.map((line) => lineHtml(line, layout.labels.get(line.id) ?? "")).join("")}</ol>`
                : "";
            const thinksList = person.thinks.length
                ? `<h4>Thinks</h4><ul class="hm-thinks">${person.thinks.map((line) => lineHtml(line, layout.labels.get(line.id) ?? "")).join("")}</ul>`
                : "";
            return `<div class="hm-person" data-id="${person.id}"><h3>${escapeXml(person.name)}${about}</h3>${doesList}${thinksList}</div>`;
        })
        .join("");
    return `<section class="hm-scene" data-id="${scene.id}" aria-label="${escapeXml(scene.name)}"><figure class="hm-card">${corner("fig", `Scene ${String(index + 1).padStart(2, "0")}`)}${corner("title", title)}${corner("hint", who)}${corner("readout", readout)}${sceneSvg(scene, layout)}</figure><div class="hm-legend">${people}</div></section>`;
}

/** Hovering or focusing a line lights its marker, and the reverse. No dependencies. */
export const LINK_SCRIPT = `
(() => {
  const root = document.querySelector(".hm");
  if (!root) return;
  const clear = () => { root.removeAttribute("data-hot"); root.querySelectorAll("[data-hot]").forEach((el) => el.removeAttribute("data-hot")); };
  const light = (target) => {
    const el = target instanceof Element ? target.closest(".hm-mark[data-id], .hm-legend li[data-id]") : null;
    clear();
    if (!el) return;
    const id = el.getAttribute("data-id");
    root.setAttribute("data-hot", "");
    root.querySelectorAll('[data-id="' + id + '"]').forEach((match) => match.setAttribute("data-hot", ""));
  };
  root.addEventListener("pointerover", (event) => light(event.target));
  root.addEventListener("pointerleave", clear);
  root.addEventListener("focusin", (event) => light(event.target));
  root.addEventListener("focusout", clear);
})();
`;

/** The model's body: header and scenes. The site wraps this in its own page. */
export function modelHtml(model: HunchModel): string {
    const premise = model.premise ? `<p class="hm-premise">${escapeXml(model.premise)}</p>` : "";
    const scenes = model.scenes.map(sceneHtml).join(`<div class="hm-then" aria-hidden="true">then</div>`);
    return `<header class="hm-head"><p class="hm-kicker">Hunch model</p><h1>${escapeXml(model.title)}</h1>${premise}</header>${scenes}`;
}

/** A standalone page, for examples and for Hunch's offline preview. */
export function pageHtml(model: HunchModel, theme: Theme = "auto"): string {
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeXml(model.title)}</title><style>${THEME_CSS}${PAGE_CSS}</style></head><body><div class="hm" data-theme="${theme}"><main class="hm-page">${modelHtml(model)}<p class="hm-foot">A hunch model: how someone thinks things go for people. Does it match your world?</p></main></div><script>${LINK_SCRIPT}</script></body></html>`;
}
