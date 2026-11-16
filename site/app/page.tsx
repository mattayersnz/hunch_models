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
        body: "Notice an idea taking shape in your notes: something you think may be true about how life works for people.",
    },
    {
        number: "02",
        title: "Give it a real-life context",
        body: "Build a few scenes around it in Hunch. Show the people, setting, actions, and thoughts that would make the hunch true.",
    },
    {
        number: "03",
        title: "See where it holds",
        body: "Publish the model as a link. People can say what resonates, what differs, and what their own situation adds. Their responses return to Hunch beside the parts they are about.",
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
                    <h1 id="hero-title">Test your hunches with reality.</h1>
                    <p className="heroIntro">
                        A hunch starts as an idea in your notes. A hunch model brings it
                        into the context of real life—who is there, what happens, and what
                        people think—so others can say where it matches their experience.
                    </p>
                    <div className="heroActions">
                        <AppStoreLink />
                        <a className="agentLink" href="/agents">Connect an agent</a>
                        <a className="agentLink" href="/dashboard">Your models</a>
                        <p>Hunch is available for iPhone and Mac.</p>
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
                <p className="eyebrow">Why a model?</p>
                <div>
                    <h2 id="why-title">A hunch becomes testable when it has a real-life context.</h2>
                    <p>
                        A hunch model turns the assumptions around an idea into a few small
                        scenes: the people involved, their situation, what they do, and what
                        they think. It invites a more useful question than “is my idea good?”:
                        <em> is this how it is for you?</em>
                    </p>
                </div>
            </section>

            <section className="process" aria-labelledby="process-title">
                <div className="sectionHeading">
                    <p className="eyebrow">How it works</p>
                    <h2 id="process-title">From a hunch to a clearer view</h2>
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
                    <p className="eyebrow">Made in Hunch</p>
                    <h2 id="closing-title">Bring your next hunch into the world.</h2>
                    <p>Use Hunch to turn an idea from your notes into a model people can respond to.</p>
                </div>
            </section>

            <footer>
                <span>Designed and built by Matt Ayers</span>
            </footer>
        </main>
    );
}
