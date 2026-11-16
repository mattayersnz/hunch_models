import assert from "node:assert/strict";
import { test } from "node:test";
import { homeExampleMarkdown } from "../site/lib/home-example.ts";
import { readModelMarkdown } from "../packages/model/src/index.ts";

test("the homepage example is canonical Markdown for the diagram it shows", () => {
    const { model, problems } = readModelMarkdown(homeExampleMarkdown);
    assert.ok(model);
    assert.deepEqual(problems, []);
    assert.equal(model.title, "A quieter start to the workday");
    assert.equal(model.premise, "People choose better work when messages can wait for the first half hour.");
    assert.deepEqual(model.scenes[0], {
        id: model.scenes[0].id,
        name: "First hour",
        emoji: "☕",
        pieces: ["desk", "chair", "laptop", "cup"],
        people: [{
            id: model.scenes[0].people[0].id,
            name: "Alex",
            about: "works from home",
            does: [
                {
                    id: model.scenes[0].people[0].does[0].id,
                    text: "makes coffee before opening the laptop",
                    marks: [],
                },
                {
                    id: model.scenes[0].people[0].does[1].id,
                    text: "writes down one priority at the desk",
                    marks: [],
                },
            ],
            thinks: [
                {
                    id: model.scenes[0].people[0].thinks[0].id,
                    text: "If I check messages now, I will lose the morning",
                    marks: ["hunch"],
                },
                {
                    id: model.scenes[0].people[0].thinks[1].id,
                    text: "I know what matters before everyone else weighs in",
                    marks: [],
                },
            ],
        }],
    });
});
