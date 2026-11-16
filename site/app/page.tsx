const appStoreUrl = "https://apps.apple.com/nz/app/hunch/id6737346341";

const steps = [
    {
        number: "01",
        title: "Make the idea concrete",
        body: "In Hunch, turn an idea from your notes into a few small scenes: who is there, what is happening, what people do and what they think.",
    },
    {
        number: "02",
        title: "Share the situation",
        body: "Publish the model as a link. Instead of presenting a conclusion, you give people enough surrounding context to recognise what does—or does not—match their world.",
    },
    {
        number: "03",
        title: "Learn where it holds",
        body: "People can say what resonates, what differs, and what the model is missing. Their responses come back to Hunch beside the parts of the idea they are about.",
    },
];

function AppStoreLink({ className = "" }: { className?: string }) {
    return (
        <a className={`appStoreLink ${className}`.trim()} href={appStoreUrl}>
            <span className="storeMark" aria-hidden="true">H</span>
            <span>
                <small>Download on the</small>
                <strong>App Store</strong>
            </span>
            <span className="linkArrow" aria-hidden="true">↗</span>
        </a>
    );
}

export default function Home() {
    return (
        <main>
            <section className="hero" aria-labelledby="hero-title">
                <div className="heroCopy">
                    <p className="eyebrow">Hunch models</p>
                    <h1 id="hero-title">Test your ideas with reality.</h1>
                    <p className="heroIntro">
                        A hunch model puts an idea into a situation people can respond to.
                        See where it matches their experience, where it differs, and what
                        the idea may be missing.
                    </p>
                    <div className="heroActions">
                        <AppStoreLink />
                        <p>Hunch is available for iOS and macOS.</p>
                    </div>
                </div>

                <div className="modelSketch" aria-label="An idea becomes a model, which gathers responses from different situations">
                    <div className="sketchLabel">Example hunch model</div>
                    <div className="scene">
                        <span className="person personOne" aria-hidden="true" />
                        <span className="person personTwo" aria-hidden="true" />
                        <span className="thought thoughtOne">What happens?</span>
                        <span className="thought thoughtTwo">What do they think?</span>
                    </div>
                    <div className="response responseOne"><span>Resonates</span><b>✓</b></div>
                    <div className="response responseTwo"><span>Differs</span><b>↔</b></div>
                    <div className="response responseThree"><span>Another situation</span><b>+</b></div>
                </div>
            </section>

            <section className="why" aria-labelledby="why-title">
                <p className="eyebrow">Why a model?</p>
                <div>
                    <h2 id="why-title">An idea is easier to test when people can see the assumptions around it.</h2>
                    <p>
                        A hunch model is a few small scenes of how you think things go for
                        people. It is not a vote on whether your idea is good. It is a way
                        to ask a more useful question: <em>is this how it is for you?</em>
                    </p>
                </div>
            </section>

            <section className="process" aria-labelledby="process-title">
                <div className="sectionHeading">
                    <p className="eyebrow">How it works</p>
                    <h2 id="process-title">From a note to a clearer idea</h2>
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
                    <h2 id="closing-title">Give your next idea a world to meet.</h2>
                    <p>Create and publish hunch models from your own notes in the Hunch app.</p>
                </div>
                <AppStoreLink className="closingLink" />
            </section>

            <footer>
                <span>Hunch models</span>
                <span>Ideas, tested in context.</span>
            </footer>
        </main>
    );
}
