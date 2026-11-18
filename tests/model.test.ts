// npm test

import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { hashParts, layoutScene, lineId, modelHtml, pieceForText, readModel, type HunchModel, type ModelDraft } from "../packages/model/src/index.ts";
import { looseSpots, separate } from "../packages/model/src/render.ts";
import { GENERIC_PIECES, PIECES, personFaceDetails, personShapes, pieceDefProblems, pieceNamed, type Facing, type Shape, type Vec2 } from "@hunch/kit";

const examples = join(dirname(fileURLToPath(import.meta.url)), "..", "examples");

function read(draft: unknown): HunchModel {
    const { model, problems } = readModel(draft);
    assert.ok(model, `expected a model, got: ${problems.join("; ")}`);
    return model;
}

const base: ModelDraft = {
    title: "T",
    scenes: [{ name: "Home", pieces: ["couch", "phone"], people: [{ name: "Mia", does: ["scrolls on her phone", "makes tea"], thinks: ["it's late"] }] }],
};

// MARK: - Ids

test("the hash is FNV-1a 64, checked against the published test vectors", () => {
    // FNV-1a 64 of "" is the offset basis, and of "a" is 0xaf63dc4c8601ec8c.
    const base36 = (hex: string): string => BigInt(hex).toString(36).padStart(13, "0");
    assert.equal(hashParts([""]), base36("0xcbf29ce484222325"));
    assert.equal(hashParts(["a"]), base36("0xaf63dc4c8601ec8c"));
});

test("pinned ids do not drift", () => {
    // Recorded on 16 November 2026. If this fails, the id algorithm changed and every
    // published response would lose its line: change FORMAT.md and Hunch's
    // ModelAnchor.swift together, deliberately, or not at all.
    assert.equal(lineId("Home", "Mia", "does", "makes tea", 0), "d3543mzzg29j96");
    assert.equal(lineId("Café", "Zoë", "thinks", "Ça va ✓", 1), "t36gmremnch7ae");
});

test("an unrelated edit keeps every other id", () => {
    const before = read(base);
    const edited = structuredClone(base);
    edited.scenes[0].people![0].does!.unshift("wakes up");
    edited.scenes[0].pieces!.push("lamp");
    const after = read(edited);
    const ids = (model: HunchModel): string[] => model.scenes[0].people[0].does.map((line) => line.id);
    assert.deepEqual(ids(after).slice(1), ids(before));
    assert.equal(after.scenes[0].people[0].thinks[0].id, before.scenes[0].people[0].thinks[0].id);
    assert.equal(after.scenes[0].id, before.scenes[0].id);
});

test("case and spacing do not change an id; words do", () => {
    const a = lineId("Home", "Mia", "does", "Makes  tea", 0);
    assert.equal(a, lineId("home", "mia", "does", "makes tea", 0));
    assert.notEqual(a, lineId("home", "mia", "does", "makes coffee", 0));
    assert.notEqual(a, lineId("home", "mia", "thinks", "makes tea", 0));
});

test("two identical lines get two ids", () => {
    const model = read({ title: "T", scenes: [{ name: "S", people: [{ name: "A", does: ["waits", "waits"] }] }] });
    const [first, second] = model.scenes[0].people[0].does;
    assert.notEqual(first.id, second.id);
});

test("ids handed in are ignored", () => {
    const model = read({ title: "T", scenes: [{ id: "forged", name: "S", people: [] }] });
    assert.notEqual(model.scenes[0].id, "forged");
});

// MARK: - Reading

test("a model needs a title and a scene", () => {
    assert.equal(readModel({ scenes: [{ name: "S" }] }).model, null);
    assert.equal(readModel({ title: "T", scenes: [] }).model, null);
    assert.equal(readModel("nope").model, null);
    assert.equal(readModel({ version: 2, title: "T", scenes: [{ name: "S" }] }).model, null);
});

test("a bad value costs only itself", () => {
    const { model, problems } = readModel({
        title: "T",
        scenes: [
            { name: "S", people: [{ name: "A", does: ["ok", 7, { text: "marked", marks: ["unsure", "bogus"] }] }, { about: "no name" }] },
            "not a scene",
        ],
    });
    assert.ok(model);
    assert.equal(model.scenes.length, 1);
    assert.equal(model.scenes[0].people.length, 1);
    assert.deepEqual(model.scenes[0].people[0].does.map((line) => line.text), ["ok", "marked"]);
    assert.deepEqual(model.scenes[0].people[0].does[1].marks, ["unsure"]);
    assert.ok(problems.length >= 3);
});

test("limits cut and say so", () => {
    const long = "x".repeat(400);
    const { model, problems } = readModel({ title: long, scenes: [{ name: "S", people: [{ name: "A", does: Array.from({ length: 20 }, (_, i) => `step ${i}`) }] }] });
    assert.ok(model);
    assert.equal(model.title.length, 120);
    assert.equal(model.scenes[0].people[0].does.length, 12);
    assert.ok(problems.some((problem) => problem.includes("kept the first 12")));
});

test("control characters and newlines are flattened", () => {
    const model = read({ title: "a\nb\u0007c", scenes: [{ name: "S" }] });
    assert.equal(model.title, "a b c");
});

test("piece looks are additive, constrained and only name pieces in their scene", () => {
    const { model, problems } = readModel({
        title: "T",
        scenes: [{
            name: "S",
            pieces: ["Ticket machine", "medicine", "plain"],
            pieceLooks: { "TICKET MACHINE": "appliance", medicine: "container", plain: "sparkly", missing: "paper" },
        }],
    });
    assert.ok(model);
    assert.deepEqual(model.scenes[0].pieceLooks, { "ticket machine": "appliance", medicine: "container" });
    assert.equal(problems.filter((problem) => problem.includes("pieceLooks")).length, 2);
});

// MARK: - Layout

test("no two things share a cell, and a seat moves under its sitter", () => {
    for (const file of readdirSync(examples).filter((name) => name.endsWith(".json"))) {
        const model = read(JSON.parse(readFileSync(join(examples, file), "utf8")));
        for (const scene of model.scenes) {
            const layout = layoutScene(scene);
            const cells = new Set<string>();
            for (const placed of layout.people) cells.add(placed.cell.join());
            for (const piece of layout.pieces) {
                if (piece.seatedBy !== null) {
                    assert.deepEqual(piece.cell, layout.people[piece.seatedBy].cell, `${file}: seat under its sitter`);
                    continue;
                }
                if (piece.surface !== null) {
                    assert.deepEqual(piece.cell, layout.pieces[piece.surface.host].cell, `${file}: surface prop shares its host cell`);
                    continue;
                }
                assert.ok(!cells.has(piece.cell.join()), `${file}: ${piece.name} shares a cell`);
                cells.add(piece.cell.join());
            }
            for (const [col, row] of [...layout.people.map((p) => p.cell), ...layout.pieces.map((p) => p.cell)]) {
                assert.ok(col >= 0 && col < 4 && row >= 0 && row < 4, `${file}: inside the floor`);
            }
        }
    }
});

test("an action finds the piece it names, as a whole word or alias", () => {
    assert.equal(pieceForText("scrolls listings on her phone", ["couch", "phone"]), 1);
    assert.equal(pieceForText("lies on the sofa", ["couch", "phone"]), 0);
    assert.equal(pieceForText("sounds phoney", ["phone"]), null);
    assert.equal(pieceForText("sketches on the whiteboard", ["whiteboard"]), 0);
});

test("layout is the same every time", () => {
    const model = read(base);
    const once = JSON.stringify([...layoutScene(model.scenes[0]).labels]);
    assert.equal(JSON.stringify([...layoutScene(model.scenes[0]).labels]), once);
});

test("larger groups stay gathered around the centre and turn toward one another", () => {
    const model = read({ title: "T", scenes: [{ name: "S", people: ["A", "B", "C", "D"].map((name) => ({ name })) }] });
    const people = layoutScene(model.scenes[0]).people;
    assert.deepEqual(people.map(({ cell }) => cell), [[1, 2], [2, 1], [2, 2], [1, 1]]);
    // Each turns as nearly toward the others as it can while keeping its face in view.
    assert.deepEqual(people.map(({ pose }) => pose.facing), ["east", "south", "east", "southEast"]);
});

test("every standing figure shows its face, whatever the size of the group", () => {
    for (let count = 1; count <= 4; count++) {
        const model = read({ title: "T", scenes: [{ name: "S", people: ["A", "B", "C", "D"].slice(0, count).map((name) => ({ name })) }] });
        for (const placed of layoutScene(model.scenes[0]).people) {
            assert.ok(personFaceDetails(placed.pose), `${count} people: ${placed.person.name} faces ${placed.pose.facing}`);
        }
    }
});

test("what a sitter uses is brought in front of them and turned to face them", () => {
    const model = read({ title: "T", scenes: [{ name: "S", pieces: ["couch", "tv", "lamp"], people: [{ name: "A", does: ["watches the tv"] }] }] });
    const layout = layoutScene(model.scenes[0]);
    const sitter = layout.people[0];
    const tv = layout.pieces.find((piece) => piece.def.name === "screen");
    const lamp = layout.pieces.find((piece) => piece.def.name === "lamp");
    assert.ok(tv && lamp);
    assert.deepEqual(tv.cell, [sitter.cell[0], sitter.cell[1] + 1]);
    assert.equal(tv.turned, true);
    assert.equal(lamp.turned, false);
});

test("a sitter's own furniture and a standing person's props stay where layout puts them", () => {
    const model = read({ title: "T", scenes: [{ name: "S", pieces: ["chair", "desk", "tv"], people: [{ name: "A", does: ["watches the tv"] }, { name: "B", does: ["turns off the tv"] }] }] });
    const layout = layoutScene(model.scenes[0]);
    const tv = layout.pieces.find((piece) => piece.def.name === "screen");
    assert.ok(tv);
    // The desk already stands in front of the sitter, so the tv is not brought round.
    assert.equal(tv.turned, false);
});

test("an action that names nothing never lands on a piece", () => {
    const scenes = [
        { pieces: ["chair", "desk"], people: [{ name: "A", does: ["thinks hard", "sighs", "waits", "stretches"] }] },
        { pieces: ["couch", "tv"], people: [{ name: "A", does: ["watches the tv", "sighs"] }] },
        { pieces: ["chair"], people: [{ name: "A", does: ["sighs"] }] },
    ];
    for (const scene of scenes) {
        const model = read({ title: "T", scenes: [{ name: "S", ...scene }] });
        const layout = layoutScene(model.scenes[0]);
        const spots = looseSpots(layout, 0);
        assert.ok(spots.length > 0);
        for (const piece of layout.pieces) {
            if (piece.seatedBy !== null || piece.surface !== null) continue;
            for (const shape of piece.def.shapes) {
                const { x, y } = extent(shape);
                const [ox, oy] = [piece.cell[0] * 30, piece.cell[1] * 30];
                for (const [sx, sy] of spots) {
                    const inside = sx > ox + x[0] && sx < ox + x[1] && sy > oy + y[0] && sy < oy + y[1];
                    assert.ok(!inside, `${scene.pieces.join(", ")}: an action sits on the ${piece.def.name}`);
                }
            }
        }
    }
});

test("a long name is shortened in the drawing and whole in the list", () => {
    const model = read({ title: "T", scenes: [{ name: "S", people: [{ name: "Alexandria-Rose Featherstonehaugh" }] }] });
    const html = modelHtml(model);
    assert.ok(html.includes(">Alexandria-Rose…</text>"));
    assert.ok(html.includes("Alexandria-Rose Featherstonehaugh"));
});

test("a sitter faces the same way as the seat", () => {
    const model = read({ title: "T", scenes: [{ name: "S", pieces: ["chair"], people: [{ name: "A" }] }] });
    assert.equal(layoutScene(model.scenes[0]).people[0].pose.facing, "south");
});

test("the surface laptop opens toward the sitter", () => {
    const laptop = pieceNamed("laptop");
    assert.ok(laptop?.surfaceShapes);
    const screen = laptop.surfaceShapes.find((shape) => shape.kind === "box" && shape.h === 6);
    assert.ok(screen?.kind === "box");
    assert.ok(screen.plan.y > 0);
});

test("a seated worker has the desk directly in front of them", () => {
    const model = read({ title: "T", scenes: [{ name: "S", pieces: ["desk", "chair"], people: [{ name: "A" }] }] });
    const layout = layoutScene(model.scenes[0]);
    const person = layout.people[0];
    const desk = layout.pieces.find((piece) => piece.def.name === "desk");
    assert.ok(desk);
    // Pulled up close, but only as close as the sitter's knees allow.
    assert.equal(desk.cell[0], person.cell[0]);
    const ahead = desk.cell[1] - person.cell[1];
    assert.ok(ahead >= 0.6 && ahead < 0.75, `desk ${ahead} cells ahead`);
});

test("small work props sit on the desk instead of separate floor stands", () => {
    const model = read({ title: "T", scenes: [{ name: "S", pieces: ["desk", "chair", "laptop", "cup"], people: [{ name: "A" }] }] });
    const layout = layoutScene(model.scenes[0]);
    const deskIndex = layout.pieces.findIndex((piece) => piece.def.name === "desk");
    assert.ok(deskIndex >= 0);
    for (const name of ["laptop", "cup"]) {
        const prop = layout.pieces.find((piece) => piece.def.name === name);
        assert.ok(prop);
        assert.equal(prop.surface?.host, deskIndex);
        assert.deepEqual(prop.cell, layout.pieces[deskIndex].cell);
    }
});

test("generic looks keep semantic names and use deterministic kit geometry", () => {
    const model = read({
        title: "T",
        scenes: [{
            name: "S",
            pieces: ["ticket machine", "medicine bottle", "mystery"],
            pieceLooks: { "ticket machine": "display" },
            people: [{ name: "A", does: ["checks the ticket machine"] }],
        }],
    });
    const layout = layoutScene(model.scenes[0]);
    assert.equal(layout.pieces[0].name, "ticket machine");
    assert.equal(layout.pieces[0].def.name, "display");
    assert.equal(layout.pieces[0].known, false);
    assert.equal(layout.pieces[1].def.name, "container");
    assert.equal(layout.pieces[2].def.name, "crate");
    assert.equal(layout.actionAt.get(model.scenes[0].people[0].does[0].id), 0);
});

test("every standard and generic piece stays inside the construction grammar", () => {
    for (const piece of [...PIECES, ...Object.values(GENERIC_PIECES)]) {
        assert.deepEqual(pieceDefProblems(piece), [], piece.name);
    }
});

test("the block figure supports all eight rotations", () => {
    const facings: Facing[] = ["north", "northEast", "east", "southEast", "south", "southWest", "west", "northWest"];
    const shapes = facings.map((facing) => JSON.stringify(personShapes({ kind: "stand", facing })));
    assert.equal(new Set(shapes).size, facings.length);
});

test("the block torso hides the rear arm", () => {
    const shapes = personShapes({ kind: "stand", facing: "south" });
    const torso = shapes.findIndex((shape) => shape.kind === "box" && shape.plan.w === 7.6 && shape.h === 8);
    const arms = shapes.flatMap((shape, at) => (shape.kind === "box" && shape.plan.w === 2 ? [at] : []));
    assert.equal(arms.length, 2);
    assert.ok(arms[0] < torso && torso < arms[1]);
});

const near = (a: number, b: number): boolean => Math.abs(a - b) < 1e-9;
const isLeg = (shape: Shape): shape is Extract<Shape, { kind: "box" }> => shape.kind === "box" && near(shape.plan.w, 3.6);

test("seated legs stop behind the torso", () => {
    const shapes = personShapes({ kind: "sit", seat: { y: 11, z: 7, front: 22 }, facing: "south" });
    const torso = shapes.findIndex((shape) => shape.kind === "box" && shape.plan.w === 7.6 && shape.h === 7);
    const legs = shapes.flatMap((shape, at) => (isLeg(shape) ? [at] : []));
    assert.equal(legs.length, 4);
    assert.ok(legs.every((leg) => leg < torso));
});

test("seated shins drop straight from their knees", () => {
    const shapes = personShapes({ kind: "sit", seat: { y: 11, z: 7, front: 22 }, facing: "south" });
    const legs = shapes.filter(isLeg);
    const thighs = legs.filter((shape) => shape.z === 7).sort((a, b) => a.plan.x - b.plan.x);
    const shins = legs.filter((shape) => shape.z === 0).sort((a, b) => a.plan.x - b.plan.x);
    assert.equal(thighs.length, 2);
    assert.equal(shins.length, 2);
    for (let index = 0; index < 2; index++) {
        assert.equal(shins[index].plan.x, thighs[index].plan.x);
        assert.ok(near(shins[index].plan.y + shins[index].plan.d, thighs[index].plan.y + thighs[index].plan.d));
        assert.equal(shins[index].h, thighs[index].z);
    }
});

/** A shape's extent on the floor and in height, in its cell's coordinates. */
function extent(shape: Shape): { x: [number, number]; y: [number, number]; z: [number, number] } {
    const z: [number, number] = [shape.z, shape.z + shape.h];
    if (shape.kind === "box") return { x: [shape.plan.x, shape.plan.x + shape.plan.w], y: [shape.plan.y, shape.plan.y + shape.plan.d], z };
    if (shape.kind === "cyl") return { x: [shape.cx - shape.r, shape.cx + shape.r], y: [shape.cy - shape.r, shape.cy + shape.r], z };
    const xs = shape.ring.map(([x]) => x);
    const ys = shape.ring.map(([, y]) => y);
    return { x: [Math.min(...xs), Math.max(...xs)], y: [Math.min(...ys), Math.max(...ys)], z };
}

const seats = [...PIECES, ...Object.values(GENERIC_PIECES)].filter((piece) => piece.seat);

test("a seat's front is the true front of everything below its surface", () => {
    for (const piece of seats) {
        for (const shape of [...piece.shapes, ...(piece.front ?? [])]) {
            if (shape.z >= piece.seat!.z) continue;
            assert.ok(extent(shape).y[1] <= piece.seat!.front + 1e-9, `${piece.name}: a shape below the seat reaches past its front`);
        }
    }
});

test("seated shins hang in front of the seat and drop directly in front of the torso", () => {
    for (const piece of seats) {
        const seat = piece.seat!;
        const shapes = personShapes({ kind: "sit", seat, facing: "south" });
        const torso = shapes.find((shape): shape is Extract<Shape, { kind: "box" }> => shape.kind === "box" && shape.plan.w === 7.6);
        const shins = shapes.filter(isLeg).filter((shape) => shape.z === 0);
        assert.ok(torso, piece.name);
        assert.equal(shins.length, 2, piece.name);
        for (const shin of shins) {
            assert.ok(near(shin.plan.y, torso.plan.y + torso.plan.d), piece.name);
            assert.ok(shin.plan.y > seat.front, `${piece.name}: shins are sunk into the seat`);
        }
        for (const shape of shapes) {
            const { x, y, z } = extent(shape);
            assert.ok(x[0] >= 0 && y[0] >= 0 && x[1] <= 30 && y[1] <= 30 && z[1] <= 30, `${piece.name}: leaves its cell`);
        }
    }
});

test("a desk pulled up to a sitter never touches them", () => {
    for (const piece of seats) {
        const { model } = readModel({ title: "t", scenes: [{ name: "s", pieces: [piece.name, "desk"], people: [{ name: "Mia", does: ["works"] }] }] });
        const layout = layoutScene(model!.scenes[0]);
        const sitter = layout.people[0];
        const desk = layout.pieces.find((placed) => placed.def.name === "desk");
        assert.equal(sitter.pose.kind, "sit", piece.name);
        assert.ok(desk, piece.name);
        const world = (shape: Shape, [col, row]: [number, number]) => {
            const { x, y, z } = extent(shape);
            return { x: [x[0] + col * 30, x[1] + col * 30], y: [y[0] + row * 30, y[1] + row * 30], z };
        };
        const apart = (a: [number, number], b: [number, number]): boolean => a[1] <= b[0] || b[1] <= a[0];
        for (const body of personShapes(sitter.pose).map((shape) => world(shape, sitter.cell))) {
            for (const part of desk.def.shapes.map((shape) => world(shape, desk.cell))) {
                assert.ok(apart(body.x as [number, number], part.x as [number, number]) || apart(body.y as [number, number], part.y as [number, number]) || apart(body.z, part.z), `${piece.name}: the desk touches its sitter`);
            }
        }
    }
});

test("legs line up with the torso and carry its outline, standing and seated", () => {
    for (const pose of [{ kind: "stand", facing: "south" }, { kind: "sit", seat: { y: 11, z: 7, front: 22 }, facing: "south" }] as const) {
        const shapes = personShapes(pose);
        const torso = shapes.find((shape): shape is Extract<Shape, { kind: "box" }> => shape.kind === "box" && shape.plan.w === 7.6);
        const legs = shapes.filter(isLeg);
        assert.ok(torso);
        assert.ok(legs.length >= 2, pose.kind);
        const xs = legs.map((leg) => leg.plan.x);
        assert.ok(near(Math.min(...xs), torso.plan.x), pose.kind);
        assert.ok(near(Math.max(...legs.map((leg) => leg.plan.x + leg.plan.w)), torso.plan.x + torso.plan.w), pose.kind);
        assert.ok(legs.every((leg) => leg.style?.outline !== false), pose.kind);
        assert.deepEqual(legs.map((leg) => leg.style), legs.map(() => torso.style), pose.kind);
    }
});

test("neutral block parts overlap instead of floating apart", () => {
    const shapes = personShapes({ kind: "stand", facing: "south" });
    assert.ok(shapes.every((shape) => shape.style?.lit !== true));
    const torso = shapes.find((shape) => shape.kind === "box" && shape.plan.w === 7.6);
    const head = shapes.find((shape) => shape.kind === "box" && shape.plan.w === 10.5);
    assert.ok(torso && head && torso.z + torso.h > head.z);
    const html = modelHtml(read(base));
    assert.ok(!html.includes("hm-person-outline"));
    assert.ok(!html.includes("hm-hair-line"));
});

test("the block head is a cube wider than the torso", () => {
    const shapes = personShapes({ kind: "stand", facing: "south" });
    const head = shapes.find((shape): shape is Extract<Shape, { kind: "box" }> => shape.kind === "box" && shape.plan.w === 10.5);
    assert.ok(head);
    assert.equal(head.plan.d, head.plan.w);
    assert.equal(head.h, head.plan.w);
    assert.ok(head.plan.w > 7.6);
});

test("faces appear only on a visible plane", () => {
    assert.ok(personFaceDetails({ kind: "stand", facing: "south" }));
    assert.equal(personFaceDetails({ kind: "stand", facing: "north" }), null);
});

test("every block variant stays inside one cell in every direction", () => {
    const facings: Facing[] = ["north", "northEast", "east", "southEast", "south", "southWest", "west", "northWest"];
    for (const facing of facings) {
        for (const shape of personShapes({ kind: "stand", facing })) {
            assert.ok(shape.z >= 0 && shape.h > 0 && shape.z + shape.h <= 30, `${facing}: height`);
            const points = shape.kind === "box"
                ? [[shape.plan.x, shape.plan.y], [shape.plan.x + shape.plan.w, shape.plan.y + shape.plan.d]]
                : shape.kind === "poly"
                  ? shape.ring
                  : [[shape.cx - shape.r, shape.cy - shape.r], [shape.cx + shape.r, shape.cy + shape.r]];
            assert.ok(points.every(([x, y]) => x >= -0.001 && y >= -0.001 && x <= 30.001 && y <= 30.001), `${facing}: footprint`);
        }
    }
});

test("separated marks never touch", () => {
    const points: Vec2[] = [[100, 100], [101, 101], [104, 98], [130, 100], [100, 100]];
    separate(points, 12);
    for (let i = 0; i < points.length; i++) {
        for (let j = 0; j < i; j++) assert.ok(Math.hypot(points[i][0] - points[j][0], points[i][1] - points[j][1]) >= 23.99);
    }
    assert.deepEqual(points[0], [100, 100]);
});

// MARK: - Rendering

test("every line is drawn and listed under the same id", () => {
    const model = read(JSON.parse(readFileSync(join(examples, "team-decision.json"), "utf8")));
    const html = modelHtml(model);
    for (const scene of model.scenes) {
        for (const person of scene.people) {
            for (const line of [...person.does, ...person.thinks]) {
                const count = html.split(`data-id="${line.id}"`).length - 1;
                assert.equal(count, 2, `${line.text}: once in the drawing, once in the words`);
            }
        }
    }
});

test("text is escaped everywhere", () => {
    const html = modelHtml(read({ title: "<b>x</b>", premise: "\"q\" & 'a'", scenes: [{ name: "<i>", pieces: ["<script>"], people: [{ name: "A<", does: ["<img src=x onerror=alert(1)>"] }] }] }));
    assert.ok(!/<(b|i|script|img)[\s>]/.test(html));
    assert.ok(html.includes("&lt;img src=x onerror=alert(1)&gt;"));
});
