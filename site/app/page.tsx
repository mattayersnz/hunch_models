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
        title: "Reveal the assumptions",
        body: "Putting the people, setting, actions, and thoughts into scenes makes the assumptions behind an idea visible.",
    },
    {
        number: "02",
        title: "Get specific feedback",
        body: "People respond to the individual parts that resonate or differ, instead of judging the whole idea with a simple yes or no.",
    },
    {
        number: "03",
        title: "Learn from what comes back",
        body: "Every response stays connected to the exact part it is about, making it clear what holds, what needs changing, and what the model is missing.",
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
                    <h1 id="hero-title">A hunch model shows how an idea might play out in real life.</h1>
                    <p className="heroIntro">
                        It turns an abstract hunch into a few small scenes: the people
                        involved, the situation they are in, what they do, and what they
                        think. Share it, and people can respond to the specific parts that
                        match—or do not match—their own experience.
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
                <p className="eyebrow">What it is</p>
                <div>
                    <h2 id="why-title">A concrete model of an idea, made to be discussed.</h2>
                    <p>
                        Each scene uses simple visual pieces and plain-language lines to
                        show a situation and the people in it. The model is deliberately
                        small and provisional: a humble start to a conversation, not a
                        finished answer. It asks one practical question:
                        <em> is this how it is for you?</em>
                    </p>
                </div>
            </section>

            <section className="process" aria-labelledby="process-title">
                <div className="sectionHeading">
                    <p className="eyebrow">Why it is useful</p>
                    <h2 id="process-title">Make an idea clear enough to learn from.</h2>
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
                    <h2 id="closing-title">Turn a hunch into something people can actually respond to.</h2>
                    <p>
                        Make a model in Hunch on iPhone or Mac, or ask any MCP-capable agent
                        to create and publish one from Markdown.
                    </p>
                </div>
            </section>

            <footer>
                <span>🇳🇿 Designed and built by Matt Ayers</span>
            </footer>
        </main>
    );
}
