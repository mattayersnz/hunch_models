export default async function SignIn({ searchParams }: { searchParams: Promise<{ next?: string; sent?: string; error?: string }> }) {
    const query = await searchParams;
    return (
        <main className="accountShell accountNarrow">
            <nav className="accountNav"><a href="/">Hunch</a><a href="/agents">Agent protocol</a></nav>
            <p className="eyebrow">Hunch models</p>
            <h1>Sign in by email.</h1>
            <p className="accountIntro">Use the same email as Hunch. We will send a magic link; no password is created.</p>
            {query.sent === "1" ? <p className="notice">Check your email. The link returns you here securely.</p> : null}
            {query.error === "link" ? <p className="errorNotice">That link has expired or was already used. Ask for a new one.</p> : null}
            {query.error === "email" ? <p className="errorNotice">That does not look like an email address.</p> : null}
            {query.error && query.error !== "link" && query.error !== "email" ? <p className="errorNotice">The link could not be sent. Wait a minute and try again.</p> : null}
            <form className="stackForm" method="post" action="/api/web-auth/code">
                <input type="hidden" name="next" value={query.next ?? "/dashboard"} />
                <label>Email<input required type="email" name="email" autoComplete="email" maxLength={254} /></label>
                <button type="submit">Email me a magic link</button>
            </form>
        </main>
    );
}

