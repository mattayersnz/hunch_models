import { marked } from "marked";
import { agentProtocol } from "@/lib/protocol";

export const metadata = {
    title: "Connect an agent — Hunch models",
    description: "Connect an MCP agent to publish and manage hunch models on hunch.tech.",
};

export default function AgentsPage() {
    const html = marked.parse(agentProtocol, { async: false }) as string;
    return (
        <main className="docsShell">
            <nav className="docsNav" aria-label="Agent documentation">
                <a href="/">Hunch models</a>
                <span><a href="/dashboard">Your models</a> · <a href="/agents/protocol.md">Raw protocol</a></span>
            </nav>
            <article className="protocol" dangerouslySetInnerHTML={{ __html: html }} />
        </main>
    );
}
