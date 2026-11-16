// The public surface of @hunch/model: read a model, lay it out, render it.

export * from "./format.ts";
export { readModel, piecesOf, type ReadResult } from "./read.ts";
export { hashParts, normaliseKey, sceneId, personId, lineId } from "./ids.ts";
export { layoutScene, pieceForText, type SceneLayout } from "./layout.ts";
export { modelHtml, pageHtml, sceneSvg, LINK_SCRIPT, type Theme } from "./render.ts";
export { THEME_CSS, PAGE_CSS } from "../../kit/src/theme.ts";
export { PIECES, pieceNamed } from "../../kit/src/pieces.ts";
