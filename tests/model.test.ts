// npm test

import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { hashParts, layoutScene, lineId, modelHtml, pieceForText, readModel, type HunchModel, type ModelDraft } from "../packages/model/src/index.ts";
import { separate } from "../packages/model/src/render.ts";
import type { Vec2 } from "@hunch/kit";

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
