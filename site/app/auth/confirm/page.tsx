import { redirect } from "next/navigation";

export const metadata = { title: "Sign in — Hunch models", robots: { index: false } };

/**
 * The page a sign-in email's link opens. Opening it signs nobody in: the token is spent
 * only by the button's POST. Mail scanners follow links, and the same token is the code
 * the Hunch app asks its owner to type, so a link that verified on GET would let a
 * scanner use that code up before the person could.
 */
export default async function Confirm({ searchParams }: { searchParams: Promise<{ token_hash?: string }> }) {
    const tokenHash = (await searchParams).token_hash;
    if (!tokenHash || !/^[A-Za-z0-9_-]{16,128}$/.test(tokenHash)) redirect("/sign-in?error=link");
    return (
        <main className="accountShell accountNarrow">
            <nav className="accountNav"><a href="/">Hunch</a><a href="/agents">Agent protocol</a></nav>
            <p className="eyebrow">Hunch models</p>
            <h1>Sign in to hunch.tech?</h1>
            <p className="accountIntro">This signs this browser in to your published models. If you asked for a code in the Hunch app, type the code there instead: signing in here uses it up.</p>
            <form className="stackForm" method="post" action="/api/web-auth/verify">
                <input type="hidden" name="token_hash" value={tokenHash} />
                <button type="submit">Sign in on this browser</button>
            </form>
        </main>
    );
}
