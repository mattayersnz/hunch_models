import { browserAuth, browserUser, safeNext } from "@/lib/browser-auth";
import { redirect } from "next/navigation";

export default async function OAuthConsent({ searchParams }: { searchParams: Promise<{ authorization_id?: string }> }) {
    const authorizationId = (await searchParams).authorization_id;
    if (!authorizationId) redirect("/agents");
    const returnHere = safeNext(`/oauth/consent?authorization_id=${encodeURIComponent(authorizationId)}`);
    const user = await browserUser();
    if (!user) redirect(`/sign-in?next=${encodeURIComponent(returnHere)}`);

    const client = await browserAuth();
    const { data, error } = await client.auth.oauth.getAuthorizationDetails(authorizationId);
    if (error || !data) redirect("/agents?oauth=invalid");
    if ("redirect_url" in data) redirect(data.redirect_url);

    // The name is whatever the client registered as, so anyone can call theirs "Claude".
    // Where approval sends the connection is the part it cannot choose freely.
    let destination = data.redirect_uri;
    try {
        const parsed = new URL(data.redirect_uri);
        destination = parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.host : `${parsed.protocol}//${parsed.host}`;
    } catch {
        // Shown as given.
    }

    return (
        <main className="accountShell accountNarrow">
            <nav className="accountNav"><a href="/">Hunch</a><span>{user.email}</span></nav>
            <p className="eyebrow">Agent connection</p>
            <h1>Let {data.client.name || "this agent"} use Hunch?</h1>
            <p className="accountIntro">It will act as your Hunch account and can publish models to the web. Hunch does not give it access to your private notes.</p>
            <p className="notice">Approving sends this connection to <strong>{destination}</strong>. The name above is chosen by the agent, so connect only if you started this from an agent you trust and recognise that address.</p>
            <section className="consentCard">
                <h2>This connection can</h2>
                <ul>
                    <li>validate Hunch model Markdown;</li>
                    <li>publish and update models when you ask;</li>
                    <li>create and revoke invite links;</li>
                    <li>read your published models and their responses.</li>
                </ul>
                <p>It cannot delete models, delete your account, moderate responses, or read the Hunch app’s local collections.</p>
            </section>
            <form className="consentActions" method="post" action="/api/oauth/consent">
                <input type="hidden" name="authorization_id" value={data.authorization_id} />
                <button type="submit" name="decision" value="approve">Connect agent</button>
                <button className="secondaryButton" type="submit" name="decision" value="deny">Cancel</button>
            </form>
            <p className="finePrint">Requested scope: {data.scope || "email"}. Redirect: {data.redirect_uri}</p>
        </main>
    );
}

