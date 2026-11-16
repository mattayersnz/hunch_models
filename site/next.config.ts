import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

const config: NextConfig = {
    // The renderer and kit are TypeScript source in this repo's workspace.
    transpilePackages: ["@hunch/model", "@hunch/kit"],
    turbopack: { root: fileURLToPath(new URL("..", import.meta.url)) },
    poweredByHeader: false,
};

export default config;
