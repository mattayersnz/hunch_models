// Builds every example model to standalone HTML in examples/out/, dark and light.
//   node examples/build.ts

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pageHtml, readModel } from "../packages/model/src/index.ts";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "out");
mkdirSync(out, { recursive: true });

let failed = false;
for (const file of readdirSync(here).filter((name) => name.endsWith(".json")).sort()) {
    const { model, problems } = readModel(JSON.parse(readFileSync(join(here, file), "utf8")));
    for (const problem of problems) console.warn(`${file}: ${problem}`);
    if (!model) {
        failed = true;
        continue;
    }
    const name = basename(file, ".json");
    writeFileSync(join(out, `${name}.html`), pageHtml(model, "dark"));
    writeFileSync(join(out, `${name}-light.html`), pageHtml(model, "light"));
    console.log(`${name}: ${model.scenes.length} scene(s)`);
}
process.exitCode = failed ? 1 : 0;
