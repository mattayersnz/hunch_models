import { PAGE_CSS, THEME_CSS } from "@hunch/model";
import { ModelTransformDemo } from "./model-transform-demo";

const appStoreUrl = "https://apps.apple.com/nz/app/hunch/id6737346341";

const rendererCss = `${THEME_CSS}${PAGE_CSS.replace("body{", ".hm{")}`;

const steps = [
    {
        number: "01",
        title: "Reveal the assumptions",
        body: "Showing who is involved, what they do, and what they think makes the assumptions behind an idea visible.",
    },
    {
        number: "02",
        title: "Get specific feedback",
        body: "People can respond to the individual parts that resonate or differ, rather than judging the whole idea at once.",
    },
    {
        number: "03",
        title: "Learn what to change",
        body: "Each response stays connected to the part it concerns, so you can see what holds, what needs work, and what is missing.",
    },
];

function AppStoreLink({ className = "" }: { className?: string }) {
    return (
        <a className={`appStoreLink ${className}`.trim()} href={appStoreUrl} aria-label="Download Hunch on the App Store">
            <img src="/app-store-badge.svg" alt="Download on the App Store" width="120" height="40" />
        </a>
    );
}

export default function Home() {
    return (
        <main>
            <style dangerouslySetInnerHTML={{ __html: rendererCss }} />
            <section className="hero" aria-labelledby="hero-title">
                <div className="heroCopy">
                    <p className="eyebrow">Hunch models</p>
                    <h2 id="hero-title">A tool to get feedback on your hunches.</h2>
                    <p className="heroIntro">
                        A hunch model turns an idea into scenes with people, places, actions,
                        and thoughts. Any person or AI agent can use this tool to create and
                        share one, then learn what matches, what differs, and what is missing.
                    </p>
                    <div className="heroActions">
                        <div className="heroDownload">
                            <AppStoreLink />
                            <p>Hunch is available for iPhone and Mac.</p>
                        </div>
                        <nav className="heroLinks" aria-label="Hunch models">
                            <a className="agentLink" href="/agents">Create with any agent</a>
                            <a className="agentLink" href="/dashboard">Your models</a>
                        </nav>
                    </div>
                </div>

                <ModelTransformDemo />
            </section>

            <section className="why" aria-labelledby="why-title">
                <p className="eyebrow">What it is</p>
                <div>
                    <h2 id="why-title">A small model for a useful conversation.</h2>
                    <p>
                        Each scene combines simple visual pieces with plain language to show
                        a situation and the people in it. The model is a humble starting
                        point, not a finished answer. It asks one question:
                        <em> is this how it is for you?</em>
                    </p>
                </div>
            </section>

            <section className="process" aria-labelledby="process-title">
                <div className="sectionHeading">
                    <p className="eyebrow">Why it is useful</p>
                    <h2 id="process-title">See the idea more clearly.</h2>
                </div>
                <ol className="steps">
                    {steps.map((step) => (
                        <li key={step.number}>
                            <span className="stepNumber">{step.number}</span>
                            <h3>{step.title}</h3>
                            <p>{step.body}</p>
                        </li>
                    ))}
                </ol>
            </section>

            <section className="closing" aria-labelledby="closing-title">
                <div>
                    <p className="eyebrow">Create one</p>
                    <h2 id="closing-title">Make your hunch concrete.</h2>
                    <p>
                        Create a model in Hunch, or ask any agent that supports MCP to create
                        and publish one from Markdown.
                    </p>
                </div>
            </section>

            <footer>
                <span>🇳🇿 Designed and built by Matt Ayers</span>
            </footer>
        </main>
    );
}
