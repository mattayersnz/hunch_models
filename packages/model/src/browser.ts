// The renderer for a page that is not a Node process — Hunch's offline preview loads
// this as one script and calls `HunchModels.previewHtml(json)`. Built by
// scripts/bundle.ts into a single file with no imports.

import { pageHtml, type Theme } from "./render.ts";
import { readModel } from "./read.ts";

/** The whole page for a model, or a short page saying why it cannot be drawn. */
export function previewHtml(json: string, theme: Theme = "auto"): string {
    let input: unknown;
    try {
        input = JSON.parse(json);
    } catch {
        return "<!doctype html><p>That is not a model.</p>";
    }
    const { model, problems } = readModel(input);
    if (!model) return `<!doctype html><meta charset="utf-8"><body style="font:15px system-ui;padding:24px"><p>Nothing to draw yet.</p><ul>${problems.map((p) => `<li>${p.replace(/</g, "&lt;")}</li>`).join("")}</ul>`;
    return pageHtml(model, theme);
}

(globalThis as { HunchModels?: unknown }).HunchModels = { previewHtml };
