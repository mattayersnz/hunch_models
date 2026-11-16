import { browserAuth, browserUser } from "@/lib/browser-auth";
import type { ModelRow } from "@/lib/rows";
import { admin } from "@/lib/supabase";
import { redirect } from "next/navigation";

type ListedModel = Pick<ModelRow, "slug" | "title" | "visibility" | "current_version" | "updated_at"> & { responses: { count: number }[] };

export default async function Dashboard() {
    const user = await browserUser();
    if (!user) redirect("/sign-in?next=/dashboard");
    const [{ data, error }, grantsResult] = await Promise.all([
        admin().from("models")
            .select("slug, title, visibility, current_version, updated_at, responses(count)")
            .eq("owner", user.id)
            .order("updated_at", { ascending: false }),
        (await browserAuth()).auth.oauth.listGrants(),
    ]);
    if (error) throw error;
    const models = data as ListedModel[];
    const grants = grantsResult.data ?? [];

    return (
        <main className="accountShell">
            <nav className="accountNav"><a href="/">Hunch</a><span>{user.email}</span><form method="post" action="/api/web-auth/sign-out"><button className="linkButton">Sign out</button></form></nav>
            <p className="eyebrow">Your account</p>
            <h1>Published models.</h1>
            <p className="accountIntro">These are web copies. Your source notes stay in Hunch and are not stored here.</p>
            <section className="dashboardSection">
                <h2>Models</h2>
                {models.length ? <div className="modelList">{models.map((model) => (
                    <a className="modelRow" href={`/dashboard/models/${model.slug}`} key={model.slug}>
                        <span><strong>{model.title}</strong><small>{model.visibility} · version {model.current_version}</small></span>
                        <span>{model.responses[0]?.count ?? 0} responses →</span>
                    </a>
                ))}</div> : <p>No models have been published from this account.</p>}
            </section>
            <section className="dashboardSection">
                <h2>Connected agents</h2>
                {grants.length ? <div className="modelList">{grants.map((grant) => (
                    <div className="modelRow" key={grant.client.id}>
                        <span><strong>{grant.client.name}</strong><small>Connected {new Date(grant.granted_at).toLocaleDateString()}</small></span>
                        <form method="post" action="/api/dashboard"><input type="hidden" name="action" value="revoke_grant" /><input type="hidden" name="client_id" value={grant.client.id} /><input type="hidden" name="return" value="/dashboard" /><button className="secondaryButton">Disconnect</button></form>
                    </div>
                ))}</div> : <p>No agents are connected. <a href="/agents">How to connect one</a>.</p>}
            </section>
            <section className="dangerZone">
                <h2>Delete account</h2>
                <p>Permanently removes this web account, every published model, invite and response. It does not delete local Hunch notes.</p>
                <form className="inlineForm" method="post" action="/api/dashboard">
                    <input type="hidden" name="action" value="delete_account" /><input type="hidden" name="return" value="/" />
                    <label>Type DELETE<input required name="confirm" pattern="DELETE" /></label><button className="dangerButton">Delete account</button>
                </form>
            </section>
        </main>
    );
}

