import { modelHtml, PAGE_CSS, readModel, THEME_CSS } from "@hunch/model";

const appStoreUrl = "https://apps.apple.com/nz/app/hunch/id6737346341";

const exampleModel = readModel({
    title: "A quieter start to the workday",
    premise: "People choose better work when messages can wait for the first half hour.",
    scenes: [{
        name: "First hour",
        emoji: "☕",
        pieces: ["desk", "chair", "laptop", "cup"],
        people: [{
            name: "Alex",
            about: "works from home",
            does: [
                "makes coffee before opening the laptop",
                "writes down one priority at the desk",
            ],
            thinks: [
                { text: "If I check messages now, I will lose the morning", marks: ["hunch"] },
                "I know what matters before everyone else weighs in",
            ],
        }],
    }],
}).model;

if (exampleModel === null) throw new Error("The homepage example model must be valid");

const exampleHtml = modelHtml(exampleModel);
const rendererCss = `${THEME_CSS}${PAGE_CSS.replace("body{", ".hm{")}`;

const steps = [
    {
        number: "01",
        title: "Start with a hunch",
        body: "Begin with an idea you think may be true about how life works for people. It does not need to be finished or certain.",
    },
    {
        number: "02",
        title: "Make the idea concrete",
        body: "Create a few scenes in Hunch, or ask any agent that connects over MCP to make them from Markdown. Show the people, setting, actions, and thoughts behind the idea.",
    },
    {
        number: "03",
        title: "Start the conversation",
        body: "Publish the hunch model as a link. People can say what resonates, what differs, and what their own situation adds. Each response stays connected to the part it is about.",
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
                    <h1 id="hero-title">A hunch is a humble start to a conversation.</h1>
                    <p className="heroIntro">
                        A hunch model puts an idea out there without pretending it is
                        finished. It shows the idea in a few real-life scenes—who is there,
                        what they do, and what they think—so other people can respond from
                        their own experience.
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

                <div className="modelExample">
                    <p className="eyebrow">Example hunch model</p>
                    <div className="hm heroModel" data-theme="dark">
                        <div className="hm-page" dangerouslySetInnerHTML={{ __html: exampleHtml }} />
                    </div>
                </div>
            </section>

            <section className="why" aria-labelledby="why-title">
                <p className="eyebrow">The core idea</p>
                <div>
                    <h2 id="why-title">Put an idea out there in a form people can respond to.</h2>
                    <p>
                        A hunch model is not a polished answer. It is a small, concrete
                        picture of how someone thinks things go for people: who is involved,
                        where they are, what they do, and what they think. It invites a
                        conversation around one useful question:
                        <em> is this how it is for you?</em>
                    </p>
                </div>
            </section>

            <section className="process" aria-labelledby="process-title">
                <div className="sectionHeading">
                    <p className="eyebrow">How it works</p>
                    <h2 id="process-title">From an idea to a shared hunch</h2>
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
                    <p className="eyebrow">Make a hunch model</p>
                    <h2 id="closing-title">Put an idea out there and see what comes back.</h2>
                    <p>
                        Make one in Hunch, or connect any MCP-capable agent to create and
                        publish one from Markdown.
                    </p>
                </div>
            </section>

            <footer>
                <span>🇳🇿 Designed and built by Matt Ayers</span>
            </footer>
        </main>
    );
}
