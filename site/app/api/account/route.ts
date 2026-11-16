// DELETE → permanently delete the signed-in owner and everything they published.

import { handle, json, requireOwner } from "@/lib/http";
import { admin } from "@/lib/supabase";

export async function DELETE(request: Request): Promise<Response> {
    return handle(async () => {
        const owner = await requireOwner(request);
        // `models.owner` cascades from auth.users, and every version, invite and response
        // cascades from its model. Delete the account itself so sign-in and refresh stop too.
        const { error } = await admin().auth.admin.deleteUser(owner.id, false);
        if (error) throw error;
        return json({ deleted: true });
    });
}
