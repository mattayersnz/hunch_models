// svg.ts
//
// Turning solids into markup. Every colour is a CSS variable from theme.ts, so one
// drawing serves both the dark and the light page.

import type { SolidPaths } from "./iso.ts";

export const escapeXml = (text: string): string =>
    text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

export type Tone = "hi" | "mid" | "lo" | "faint" | "ask";

export interface SolidStyle {
    tone?: Tone;
    halo?: boolean;
    /** A part meant to read as skin or cloth rather than furniture: one step brighter. */
    lit?: boolean;
}

export function solidSvg(paths: SolidPaths, { tone = "hi", halo = false, lit = false }: SolidStyle = {}): string {
    const parts: string[] = [];
    if (halo) parts.push(`<path class="hm-halo" d="${paths.fill}"/>`);
    parts.push(`<path class="hm-fill" d="${paths.fill}"/>`);
    paths.shades.forEach((d, shade) => {
        if (d) parts.push(`<path class="hm-shade" data-shade="${shade}" d="${d}"/>`);
    });
    parts.push(`<path class="hm-top" d="${paths.top}"/>`);
    if (paths.crease) parts.push(`<path class="hm-line" data-tone="faint" d="${paths.crease}"/>`);
    parts.push(`<path class="hm-line" data-tone="${tone}" d="${paths.outline}"/>`);
    return `<g class="hm-solid"${lit ? " data-lit" : ""}>${parts.join("")}</g>`;
}

export const lineSvg = (d: string, tone: Tone = "lo", dotted = false): string =>
    d ? `<path class="hm-line" data-tone="${tone}"${dotted ? " data-dotted" : ""} d="${d}"/>` : "";
