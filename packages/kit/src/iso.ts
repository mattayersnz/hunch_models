// iso.ts
//
// Isometric projection, extrusion and four-tone shading.
//
// The projection, the extrusion's outline/crease split and the shading buckets are
// adapted from the Anatomy skill's iso-kit (github.com/wheresryan22/anatomy, MIT,
// © 2026 Ryan). What is here is the small part a scene of people needs: boxes,
// rounded boxes and cylinders standing on a floor. Anatomy's machine parts — lathes,
// tubes, coils, audits — are deliberately not carried over.

export type Vec2 = [number, number];
export type Vec3 = [number, number, number];

export interface Projection {
    origin: Vec2;
    scale: number;
}

const AZIMUTH = (45 * Math.PI) / 180;
const ELEVATION = (30 * Math.PI) / 180;
const SIN_A = Math.sin(AZIMUTH);
const COS_A = Math.cos(AZIMUTH);
const SIN_E = Math.sin(ELEVATION);
const COS_E = Math.cos(ELEVATION);
const UNIT = Math.sqrt(1.6);
export const SHADES = 4;

/** Screen pixels per world unit, so marks drawn in screen space scale with the drawing. */
export const unitOf = ({ scale }: Projection): number => scale * UNIT;

export function iso([x, y, z]: Vec3, { origin, scale }: Projection): Vec2 {
    const k = scale * UNIT;
    return [origin[0] + (x * SIN_A - y * COS_A) * k, origin[1] + ((x * COS_A + y * SIN_A) * SIN_E - z * COS_E) * k];
}

/** Larger is nearer the viewer. Draw in ascending order. */
export function depthOf([x, y, z]: Vec3): number {
    return (x * COS_A + y * SIN_A) * COS_E + z * SIN_E;
}

const TOWARD_VIEWER: Vec2 = [COS_A, SIN_A];

const tenth = (value: number): string => {
    const text = (Math.round(value * 10) / 10).toFixed(1).replace(/\.0$/, "");
    return text === "-0" ? "0" : text;
};

export const num = tenth;

export function pathOf(points: readonly Vec2[], closed = false): string {
    if (!points.length) return "";
    return points.map(([x, y], at) => `${at ? "L" : "M"}${tenth(x)} ${tenth(y)}`).join("") + (closed ? "Z" : "");
}

// MARK: - Plans (footprints on the floor)

export interface Plan {
    x: number;
    y: number;
    w: number;
    d: number;
    r?: number;
}

export function roundedPlan({ x, y, w, d, r = 0 }: Plan, steps = 6): Vec2[] {
    const radius = Math.max(0, Math.min(r, w / 2, d / 2));
    if (radius === 0) return [[x, y], [x + w, y], [x + w, y + d], [x, y + d]];
    const corners: [number, number, number][] = [
        [x + w - radius, y + radius, -90],
        [x + w - radius, y + d - radius, 0],
        [x + radius, y + d - radius, 90],
        [x + radius, y + radius, 180],
    ];
    const out: Vec2[] = [];
    for (const [cx, cy, start] of corners) {
        for (let step = 0; step <= steps; step++) {
            const angle = ((start + (90 * step) / steps) * Math.PI) / 180;
            out.push([cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)]);
        }
    }
    return out;
}

export function circleRing(cx: number, cy: number, radius: number, steps = 28): Vec2[] {
    return Array.from({ length: steps }, (_, step): Vec2 => {
        const angle = (step / steps) * Math.PI * 2;
        return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)];
    });
}

// MARK: - Extrusion

export interface SolidPaths {
    fill: string;
    outline: string;
    crease: string;
    top: string;
    shades: string[];
    /** Footprint centre and base, for painter's order. */
    anchor: Vec3;
}

function signedArea(points: readonly Vec2[]): number {
    let area = 0;
    points.forEach(([ax, ay], index) => {
        const [bx, by] = points[(index + 1) % points.length];
        area += ax * by - bx * ay;
    });
    return area / 2;
}

const oriented = (points: Vec2[]): Vec2[] => (signedArea(points) < 0 ? [...points].reverse() : points);

function convexHull(points: Vec2[]): Vec2[] {
    const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    if (sorted.length < 3) return sorted;
    const cross = (o: Vec2, a: Vec2, b: Vec2): number => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const half = (list: Vec2[]): Vec2[] => {
        const out: Vec2[] = [];
        for (const point of list) {
            while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], point) <= 0) out.pop();
            out.push(point);
        }
        return out;
    };
    const lower = half(sorted);
    const upper = half([...sorted].reverse());
    return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

/** Index runs around a closed ring where `flags[i] === want`, each including its end vertex. */
function runsOf(flags: boolean[], want: boolean): number[][] {
    const count = flags.length;
    const start = flags.findIndex((flag, index) => flag !== flags[(index + count - 1) % count]);
    if (start < 0) return flags[0] === want ? [Array.from({ length: count + 1 }, (_, index) => index % count)] : [];
    const runs: number[][] = [];
    let run: number[] | null = null;
    for (let step = 0; step < count; step++) {
        const index = (start + step) % count;
        if (flags[index] === want) {
            if (!run) run = [index];
            run.push((index + 1) % count);
        } else if (run) {
            runs.push(run);
            run = null;
        }
    }
    if (run) runs.push(run);
    return runs;
}

/** A convex prism: `ring` on the floor plane at height `z`, rising by `height`. */
export function extrude(ring: Vec2[], z: number, height: number, projection: Projection): SolidPaths {
    const count = ring.length;
    const counter = signedArea(ring) > 0;
    const [vx, vy] = TOWARD_VIEWER;
    const normals = ring.map(([ax, ay], index): Vec2 => {
        const [bx, by] = ring[(index + 1) % count];
        const length = Math.hypot(bx - ax, by - ay) || 1;
        const dx = (bx - ax) / length;
        const dy = (by - ay) / length;
        return counter ? [dy, -dx] : [-dy, dx];
    });
    const facing = normals.map(([nx, ny]) => nx * vx + ny * vy > 1e-9);
    const top = ring.map(([x, y]) => iso([x, y, z + height], projection));
    const bottom = ring.map(([x, y]) => iso([x, y, z], projection));

    const outline: string[] = [];
    const crease: string[] = [];
    for (const run of runsOf(facing, false)) outline.push(pathOf(run.map((index) => top[index])));
    for (const run of runsOf(facing, true)) {
        crease.push(pathOf(run.map((index) => top[index])));
        if (height > 0) outline.push(pathOf(run.map((index) => bottom[index])));
    }
    if (height > 0) {
        for (let index = 0; index < count; index++) {
            if (facing[(index + count - 1) % count] !== facing[index]) outline.push(pathOf([top[index], bottom[index]]));
        }
    }

    // Light from the left of the viewer: a face's shade is how squarely it meets it.
    const shades: string[][] = Array.from({ length: SHADES }, () => []);
    if (height > 0) {
        const [lx, ly] = [-SIN_A, COS_A];
        normals.forEach(([nx, ny], index) => {
            if (!facing[index]) return;
            const lit = (nx * lx + ny * ly + 1) / 2;
            const shade = Math.min(SHADES - 1, Math.max(0, Math.floor(lit * SHADES)));
            const next = (index + 1) % count;
            shades[shade].push(pathOf(oriented([top[index], top[next], bottom[next], bottom[index]]), true));
        });
    }

    const cx = ring.reduce((sum, [x]) => sum + x, 0) / count;
    const cy = ring.reduce((sum, [, y]) => sum + y, 0) / count;
    return {
        fill: pathOf(convexHull([...top, ...bottom]), true),
        outline: outline.join(""),
        crease: crease.join(""),
        top: pathOf(oriented(top), true),
        shades: shades.map((paths) => paths.join("")),
        anchor: [cx, cy, z],
    };
}

export const box = (plan: Plan, z: number, height: number, projection: Projection): SolidPaths =>
    extrude(roundedPlan(plan), z, height, projection);

export const cylinder = (cx: number, cy: number, radius: number, z: number, height: number, projection: Projection): SolidPaths =>
    extrude(circleRing(cx, cy, radius), z, height, projection);

/** A projection that fits `points` into a width × height box. */
export function fitProjection(points: Vec3[], width: number, height: number, pad = 24, maxUnit = Infinity): Projection {
    const flat = points.map((point) => iso(point, { origin: [0, 0], scale: 1 }));
    const xs = flat.map(([x]) => x);
    const ys = flat.map(([, y]) => y);
    const [left, right, up, down] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const scale = Math.min((width - pad * 2) / (right - left), (height - pad * 2) / (down - up), maxUnit / UNIT);
    return {
        origin: [width / 2 - ((left + right) / 2) * scale, height / 2 - ((up + down) / 2) * scale],
        scale,
    };
}

/**
 * Fits `points` to a width and lets the height follow, up to `maxHeight`, so a wide
 * scene does not sit in a tall empty card.
 */
export function fitWidth(
    points: Vec3[],
    width: number,
    { pad = 24, maxUnit = Infinity, minHeight = 0, maxHeight = Infinity }: { pad?: number; maxUnit?: number; minHeight?: number; maxHeight?: number } = {},
): { projection: Projection; height: number } {
    const flat = points.map((point) => iso(point, { origin: [0, 0], scale: 1 }));
    const xs = flat.map(([x]) => x);
    const ys = flat.map(([, y]) => y);
    const [left, right, up, down] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const scale = Math.min((width - pad * 2) / (right - left), (maxHeight - pad * 2) / (down - up), maxUnit / UNIT);
    const height = Math.max(minHeight, Math.ceil((down - up) * scale + pad * 2));
    return {
        projection: { origin: [width / 2 - ((left + right) / 2) * scale, height / 2 - ((up + down) / 2) * scale], scale },
        height,
    };
}
