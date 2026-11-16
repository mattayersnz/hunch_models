import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

const config: NextConfig = {
    // The renderer and kit are TypeScript source in this repo's workspace.
    transpilePackages: ["@hunch/model", "@hunch/kit"],
    turbopack: { root: fileURLToPath(new URL("..", import.meta.url)) },
    // Route handlers read the one canonical protocol at runtime on Vercel.
    outputFileTracingIncludes: { "/*": ["./AGENT_PROTOCOL.md"] },
    poweredByHeader: false,
};

export default config;
