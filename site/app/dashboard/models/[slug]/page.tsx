import { browserUser } from "@/lib/browser-auth";
import { ownedModel, responsesOf, versionDoc } from "@/lib/models";
import type { InviteRow } from "@/lib/rows";
import { admin } from "@/lib/supabase";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

export default async function ModelDashboard({ params }: { params: Promise<{ slug: string }> }) {
    const user = await browserUser();
    const { slug } = await params;
    if (!user) redirect(`/sign-in?next=${encodeURIComponent(`/dashboard/models/${slug}`)}`);
    let row;
    try { row = await ownedModel(slug, user.id); } catch { notFound(); }
    const [{ data: inviteData, error }, responses, model] = await Promise.all([
        admin().from("invites").select("id, label, created_at, revoked_at").eq("model_id", row.id).order("created_at", { ascending: false }),
        responsesOf(row.id),
        versionDoc(row.id, row.current_version),
    ]);
    if (error) throw error;
    const invites = inviteData as Pick<InviteRow, "id" | "label" | "created_at" | "revoked_at">[];
    const flash = (await cookies()).get("hunch-invite")?.value;
    const newInvite = flash?.startsWith(`${slug}|`) ? decodeURIComponent(flash.slice(slug.length + 1)) : null;
    const returnTo = `/dashboard/models/${slug}`;

    return (
        <main className="accountShell">
            <nav className="accountNav"><a href="/dashboard">← Models</a><a href={`/m/${slug}`}>Open published model ↗</a></nav>
            <p className="eyebrow">{row.visibility} · version {row.current_version}</p>
            <h1>{model.title}</h1>
            <p className="accountIntro">{model.premise}</p>
            <section className="dashboardSection">
                <h2>Sharing</h2>
                <form className="inlineForm" method="post" action="/api/dashboard">
                    <input type="hidden" name="action" value="visibility" /><input type="hidden" name="slug" value={slug} /><input type="hidden" name="return" value={returnTo} />
                    <label>Visibility<select name="visibility" defaultValue={row.visibility}><option value="invite">Invite only</option><option value="public">Public</option></select></label><button>Save visibility</button>
                </form>
                {newInvite ? <p className="notice">New invite (shown briefly): <a href={newInvite}>{newInvite}</a></p> : null}
                <form className="inlineForm" method="post" action="/api/dashboard">
                    <input type="hidden" name="action" value="create_invite" /><input type="hidden" name="slug" value={slug} /><input type="hidden" name="return" value={returnTo} />
                    <label>Invite label<input name="label" maxLength={80} placeholder="Who is this for?" /></label><button>Create invite</button>
                </form>
                <div className="compactList">{invites.map((invite) => <div key={invite.id}><span>{invite.label || "Unlabelled invite"}<small>{invite.revoked_at ? "revoked" : new Date(invite.created_at).toLocaleDateString()}</small></span>{!invite.revoked_at ? <form method="post" action="/api/dashboard"><input type="hidden" name="action" value="revoke_invite" /><input type="hidden" name="slug" value={slug} /><input type="hidden" name="invite_id" value={invite.id} /><input type="hidden" name="return" value={returnTo} /><button className="secondaryButton">Revoke</button></form> : null}</div>)}</div>
            </section>
            <section className="dashboardSection">
                <h2>Responses</h2>
                {responses.length ? <div className="compactList">{responses.map((response) => <div key={response.id}><span><strong>{response.kind}</strong>{response.name ? ` · ${response.name}` : ""}<small>{response.body || "No note"}</small></span><form method="post" action="/api/dashboard"><input type="hidden" name="action" value="response_visibility" /><input type="hidden" name="response_id" value={response.id} /><input type="hidden" name="hidden" value={response.hidden ? "false" : "true"} /><input type="hidden" name="return" value={returnTo} /><button className="secondaryButton">{response.hidden ? "Show" : "Hide"}</button></form></div>)}</div> : <p>No responses yet.</p>}
            </section>
            <section className="dangerZone">
                <h2>Unpublish model</h2><p>Permanently removes every version, invite and response for this web copy.</p>
                <form method="post" action="/api/dashboard"><input type="hidden" name="action" value="unpublish" /><input type="hidden" name="slug" value={slug} /><input type="hidden" name="return" value="/dashboard" /><label className="checkLabel"><input required type="checkbox" name="confirm" value="yes" /> I understand this cannot be undone</label><button className="dangerButton">Unpublish</button></form>
            </section>
        </main>
    );
}

