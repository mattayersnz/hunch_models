import "server-only";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const path = resolve(process.cwd(), "AGENT_PROTOCOL.md");

/** One source for the HTML docs, raw Markdown route and MCP resources. */
export const agentProtocol = readFileSync(path, "utf8");
