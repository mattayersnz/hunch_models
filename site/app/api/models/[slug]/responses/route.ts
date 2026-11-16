// GET → every response to the owner's model, hidden ones included, each with the text
// of the piece it was about as that version showed it.

import { piecesOf } from "@hunch/model";
import { handle, json, requireOwner } from "@/lib/http";
import { allVersions, ownedModel, responsesOf } from "@/lib/models";

type Context = { params: Promise<{ slug: string }> };

export async function GET(request: Request, { params }: Context): Promise<Response> {
    return handle(async () => {
        const owner = await requireOwner(request);
        const row = await ownedModel((await params).slug, owner.id);
        const [versions, responses] = await Promise.all([allVersions(row.id), responsesOf(row.id)]);
        const pieces = new Map([...versions].map(([n, model]) => [n, piecesOf(model)]));
        const current = pieces.get(row.current_version);
        return json({
            version: row.current_version,
            responses: responses.map(({ model_id: _model, responder, ...response }) => {
                const piece = response.piece_id ? pieces.get(response.version)?.get(response.piece_id) : null;
                return {
                    ...response,
                    // Same responder across responses, without handing out their key.
                    responder: responder.slice(0, 6),
                    piece: piece ? { kind: piece.kind, text: piece.text } : null,
                    // Whether the line it was about is still in the model as it stands.
                    current: response.piece_id === null || (current?.has(response.piece_id) ?? false),
                };
            }),
        });
    });
}
