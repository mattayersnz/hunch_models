import assert from "node:assert/strict";
import { test } from "node:test";
import { readModelMarkdown } from "../packages/model/src/index.ts";

const sample = `# Finding a first flat
:type: model
:tags: renting, private

Young renters give up before they ever talk to a [[Landlords|landlord]].
This second line is private.
// a note to myself, never published

🛋 Sunday evening at home
:who: Mia, 27, renting with two friends
:with: Couch, phone, couch
. scrolls listings on her phone
. saves six, messages none ?
{They'll want references I don't have} *
`;

test("canonical Markdown compiles through the model reader", () => {
    const { model, problems } = readModelMarkdown(sample);
    assert.ok(model);
    assert.equal(model.title, "Finding a first flat");
    assert.equal(model.premise, "Young renters give up before they ever talk to a landlord.");
    assert.equal(model.scenes[0].name, "Sunday evening at home");
    assert.equal(model.scenes[0].emoji, "🛋");
    assert.deepEqual(model.scenes[0].pieces, ["couch", "phone"]);
    assert.equal(model.scenes[0].people[0].about, "27, renting with two friends");
    assert.deepEqual(model.scenes[0].people[0].does[1].marks, ["unsure"]);
    assert.deepEqual(model.scenes[0].people[0].thinks[0].marks, ["hunch"]);
    assert.ok(problems.some((problem) => problem.includes(":tags: stays private")));
    assert.ok(problems.some((problem) => problem.includes("extra prose outside a scene stays private")));
});

test("a piece may carry a generic appearance without changing its name", () => {
    const { model } = readModelMarkdown(`# T\n:type: model\n\n## Station\n:with: ticket machine, ticket machine as appliance, medicine as container, day as usual\n. uses the ticket machine`);
    assert.ok(model);
    assert.deepEqual(model.scenes[0].pieces, ["ticket machine", "medicine", "day as usual"]);
    assert.deepEqual(model.scenes[0].pieceLooks, { "ticket machine": "appliance", medicine: "container" });
});

test("Markdown needs an explicit model title and type", () => {
    assert.equal(readModelMarkdown(7).model, null);
    const result = readModelMarkdown("# Just a note\n\n## A scene");
    assert.equal(result.model, null);
    assert.ok(result.problems.includes("a model needs :type: model"));
});

test("actions before a person belong to Someone and markers have a stable order", () => {
    const { model } = readModelMarkdown(`# T\n:type: model\n\n## Home\n. waits ! * ?`);
    assert.ok(model);
    assert.equal(model.scenes[0].people[0].name, "Someone");
    assert.deepEqual(model.scenes[0].people[0].does[0].marks, ["unsure", "hunch", "focus"]);
});

test("code, comments, unknown properties and unsupported lists never leave", () => {
    const { model, problems } = readModelMarkdown(`# T\n:type: model\n\n## Home\n:secret: no\n// no\n\`\`\`\nno\n\`\`\`\n- no\n. yes`);
    assert.ok(model);
    assert.deepEqual(model.scenes[0].people[0].does.map((line) => line.text), ["yes"]);
    assert.equal(problems.length, 6);
});

test("only plain prose before the first scene becomes the premise", () => {
    for (const line of ["[ ] email Sam about the rent", "{a private thought}", "[a square-bracketed line]", ". a stray bullet", "- pasted"]) {
        const { model, problems } = readModelMarkdown(`# T\n:type: model\n${line}\nThe premise.\n\n## Home\n. waits`);
        assert.ok(model);
        assert.equal(model.premise, "The premise.", line);
        assert.ok(problems.some((problem) => problem.startsWith("line 3:")), line);
    }
});

test("tasks stay private and a wikilink-led sentence is an action, not a thought", () => {
    const { model, problems } = readModelMarkdown(`# T\n:type: model\n\n## Home\n[ ] call [Bob]\n[x]\n[X] done [yes]\n[[Mia]] rings [[People/Bob|Bob]]\n{thinks} ?`);
    assert.ok(model);
    const person = model.scenes[0].people[0];
    assert.deepEqual(person.does.map((line) => line.text), ["Mia rings Bob"]);
    assert.deepEqual(person.thinks.map((line) => line.text), ["thinks"]);
    assert.deepEqual(person.thinks[0].marks, ["unsure"]);
    assert.equal(problems.filter((problem) => problem.includes("unsupported list line")).length, 3);
});

test("a thought is written in curly brackets; square brackets stay private", () => {
    const { model, problems } = readModelMarkdown(`# T\n:type: model\n\n## Home\n{curly}\n{marked} * ?\n[square]\n[Bob] rings *\n{open and never closed\n. waits`);
    assert.ok(model);
    const person = model.scenes[0].people[0];
    assert.deepEqual(person.thinks.map((line) => [line.text, line.marks]), [["curly", []], ["marked", ["unsure", "hunch"]]]);
    assert.deepEqual(person.does.map((line) => line.text), ["{open and never closed", "waits"]);
    assert.equal(problems.filter((problem) => problem.includes("[square brackets] stays private")).length, 2);
    assert.ok(!JSON.stringify(model).includes("square"));
});

test("a family, a flag or a skin tone opens a scene; a keycap does not", () => {
    const { model } = readModelMarkdown(`# T\n:type: model\n\n👨‍👩‍👧 Family dinner\n. eats\n🇳🇿 Abroad\n. flies\n👋🏽 Hello\n1️⃣ first\n. 🔥 burns it`);
    assert.ok(model);
    assert.deepEqual(model.scenes.map((scene) => [scene.emoji, scene.name]), [["👨‍👩‍👧", "Family dinner"], ["🇳🇿", "Abroad"], ["👋🏽", "Hello"]]);
    assert.deepEqual(model.scenes[2].people[0].does.map((line) => line.text), ["1️⃣ first", "🔥 burns it"]);
});

test("markers strip one pass each, and a doubled star is bold, not a hunch", () => {
    const { model } = readModelMarkdown(`# T\n:type: model\n\n## Home\n. a ! ! ! !\n. b !!!\n. c **\n. d *\n. Great news!`);
    assert.ok(model);
    const does = model.scenes[0].people[0].does;
    assert.deepEqual(does.map((line) => [line.text, line.marks]), [
        ["a !", ["focus"]], ["b", ["focus"]], ["c", []], ["d", ["hunch"]], ["Great news!", []],
    ]);
});
