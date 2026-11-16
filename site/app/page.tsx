export default function Home() {
    return (
        <main style={{ width: "min(640px, 100% - 32px)", margin: "0 auto", padding: "96px 0" }}>
            <p style={{ font: "500 11px/1 ui-monospace, Menlo, monospace", letterSpacing: ".1em", textTransform: "uppercase", color: "#6e6e6e" }}>Hunch models</p>
            <h1 style={{ color: "#e8e8e8", fontWeight: 600, fontSize: 30, lineHeight: 1.2 }}>Not “is my idea good?” but “is this how it is for you?”</h1>
            <p>A hunch model is a few small scenes of how someone thinks things go for people: what they do, and what they think. You get one as a link, and you say whether it matches your world.</p>
            <p>Models are made in Hunch, from the author’s own notes.</p>
        </main>
    );
}
