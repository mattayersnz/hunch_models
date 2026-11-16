import { agentProtocol } from "@/lib/protocol";

export function GET(): Response {
    return new Response(agentProtocol, {
        headers: {
            "content-type": "text/markdown; charset=utf-8",
            "cache-control": "public, max-age=300",
        },
    });
}
