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
    headTop,
    iso,
    lineSvg,
    num,
    pathOf,
    personShapes,
    placeShapes,
    solidSvg,
    unitOf,
    type PlacedShape,
    type Projection,
    type Vec2,
    type Vec3,
} from "@hunch/kit";
import type { HunchModel, Mark, ModelLine, Scene } from "./format.ts";
import { GRID, layoutScene, type Cell, type SceneLayout } from "./layout.ts";

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

function markSvg(id: string, label: string, at: Vec2, radius: number, ask: boolean): string {
    const ring = ask ? `<circle class="hm-ring" cx="${num(at[0])}" cy="${num(at[1])}" r="${num(radius + 3.5)}"/>` : "";
    return `<g class="hm-mark" data-id="${id}"${ask ? " data-ask" : ""}>${ring}<circle cx="${num(at[0])}" cy="${num(at[1])}" r="${num(radius)}"/><text x="${num(at[0])}" y="${num(at[1] + 0.5)}" style="font-size:${num(radius * 1.05)}px">${escapeXml(label)}</text></g>`;
}

/** A thought: a rounded bubble with a short trail of dots back to the head. */
function thoughtSvg(id: string, label: string, at: Vec2, from: Vec2, radius: number, ask: boolean): string {
    const [x, y] = at;
    const r = radius;
    const bubble = `M${num(x - r)} ${num(y)}a${num(r)} ${num(r)} 0 0 1 ${num(r)} ${num(-r)}a${num(r)} ${num(r)} 0 0 1 ${num(r)} ${num(r)}a${num(r)} ${num(r)} 0 0 1 ${num(-r)} ${num(r)}l${num(-r * 0.75)} ${num(r * 0.35)}l${num(r * 0.12)} ${num(-r * 0.62)}a${num(r)} ${num(r)} 0 0 1 ${num(-r * 0.37)} ${num(-r * 0.73)}Z`;
    const trail = [0.32, 0.62]
        .map((t, index) => {
            const px = from[0] + (x - r * 0.6 - from[0]) * t;
            const py = from[1] + (y + r - from[1]) * t;
            return `<circle class="hm-trail" cx="${num(px)}" cy="${num(py)}" r="${num(1.1 + index * 0.7)}"/>`;
        })
        .join("");
    const ring = ask ? `<circle class="hm-ring" cx="${num(x)}" cy="${num(y)}" r="${num(r + 3.5)}"/>` : "";
    return `<g class="hm-mark" data-id="${id}" data-thought${ask ? " data-ask" : ""}>${trail}${ring}<path class="hm-bubble" d="${bubble}"/><text x="${num(x)}" y="${num(y + 0.5)}" style="font-size:${num(r * 1.05)}px">${escapeXml(label)}</text></g>`;
}

export function sceneSvg(scene: Scene, layout: SceneLayout = layoutScene(scene)): string {
    // Fit the used floor plus the room every mark needs above it, measured in world
    // units on the assumption that a mark is about four units across (see RADIUS).
    const bounds = boundsOf(layout);
    const reach: Vec3[] = [
        [bounds.x0, bounds.y0, -5], [bounds.x1, bounds.y0, -5], [bounds.x0, bounds.y1, -5], [bounds.x1, bounds.y1, -5],
        [bounds.x0, bounds.y0, 0], [bounds.x1, bounds.y1, 0],
    ];
    layout.pieces.forEach((piece) => reach.push([...centreOf(piece.cell), piece.def.height + (piece.known ? 20 : 6)] as Vec3));
    layout.people.forEach((placed) => {
        const rows = Math.ceil(placed.person.thinks.length / THOUGHTS_PER_ROW);
        reach.push([...centreOf(placed.cell), headTop(placed.pose) + 10 + rows * 10] as Vec3);
    });
    const { projection, height } = fitWidth(reach, WIDTH, { pad: 22, maxUnit: MAX_UNIT, minHeight: 260, maxHeight: 520 });
    const u = unitOf(projection);
    const radius = Math.min(15, Math.max(10, RADIUS * u));

    // Solids, in painter's order by cell: a seated person is drawn with their seat.
    const drawn: Drawn[] = [];
    layout.pieces.forEach((piece) => {
        if (piece.seatedBy !== null) return;
        drawn.push({ depth: piece.cell[0] + piece.cell[1], svg: solids(placeShapes(piece.def.shapes, ...piece.cell, projection)) });
    });
    layout.people.forEach((placed) => {
        const seat = placed.seat === null ? null : layout.pieces[placed.seat];
        const parts = [
            seat ? solids(placeShapes(seat.def.shapes, ...placed.cell, projection)) : "",
            `<g data-id="${placed.person.id}">${solids(placeShapes(personShapes(placed.pose), ...placed.cell, projection))}</g>`,
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
        // Just above the crate; a mark that names it hangs above the label (LABEL_LIFT).
        const [cx, cy] = centreOf(piece.cell);
        const [x, y] = iso([cx, cy, piece.def.height], projection);
        labels.push(`<text class="hm-label" data-tone="muted" x="${num(x)}" y="${num(y - 1.2 * u)}" text-anchor="middle">${escapeXml(piece.name)}</text>`);
    });

    const perPiece = new Map<number, number>();
    layout.people.forEach((placed) => {
        const [cx, cy] = centreOf(placed.cell);
        const headY = placed.pose.kind === "sit" ? placed.cell[1] * CELL + placed.pose.seat.y + 1.5 : cy;
        const head = iso([cx, headY, headTop(placed.pose)], projection);
        labels.push(`<text class="hm-label" x="${num(head[0] + 4.6 * u)}" y="${num(head[1] + 3 * u)}">${escapeXml(placed.person.name)}</text>`);

        let loose = 0;
        placed.person.does.forEach((line: ModelLine) => {
            const label = layout.labels.get(line.id) ?? "";
            const pieceIndex = layout.actionAt.get(line.id) ?? null;
            if (pieceIndex !== null) {
                const piece = layout.pieces[pieceIndex];
                const [px, py] = centreOf(piece.cell);
                const count = perPiece.get(pieceIndex) ?? 0;
                perPiece.set(pieceIndex, count + 1);
                const base = iso([px, py, piece.def.height + (piece.known ? 0.5 : LABEL_LIFT)], projection);
                specs.push({ kind: "does", line, label, at: [base[0] + count * (radius * 2 + 4), base[1] - 9 * u], from: base, fixed: false });
                return;
            }
            // An action that names nothing in the scene sits on the floor in front of the person.
            const ox = placed.cell[0] * CELL;
            const oy = placed.cell[1] * CELL;
            const at = iso([ox + 3 + (loose % 3) * 9, oy + CELL + 1 + Math.floor(loose / 3) * 9, 0], projection);
            loose++;
            specs.push({ kind: "does", line, label, at, from: null, fixed: false });
        });

        placed.person.thinks.forEach((line, index) => {
            const row = Math.floor(index / THOUGHTS_PER_ROW);
            const inRow = Math.min(THOUGHTS_PER_ROW, placed.person.thinks.length - row * THOUGHTS_PER_ROW);
            const column = index % THOUGHTS_PER_ROW;
            const spacing = radius * 2 + 6;
            const at: Vec2 = [head[0] + (column - (inRow - 1) / 2) * spacing + radius * 0.6, head[1] - 9 * u - radius - row * (radius * 2 + 8)];
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
