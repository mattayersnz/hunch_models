-- Hunch models: published snapshots of a model note, the invite links that open
-- them, and the responses people leave.
--
-- Every table has row level security on and no policies, and the browser roles
-- (anon, authenticated) have no privileges at all. The only way in is the site's
-- server routes, which use the service role and do their own owner checks. A leaked
-- anon key therefore reads nothing.

create table public.models (
    id uuid primary key default gen_random_uuid(),
    owner uuid not null references auth.users (id) on delete cascade,
    -- Unguessable, so an invite-only model is not found by walking slugs.
    slug text not null unique check (slug ~ '^[A-Za-z0-9]{12}$'),
    title text not null check (char_length(title) between 1 and 120),
    visibility text not null default 'invite' check (visibility in ('public', 'invite')),
    current_version integer not null default 1 check (current_version >= 1),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index models_owner on public.models (owner, updated_at desc);

-- Immutable: a republish adds a version, it never rewrites one, so every response
-- keeps the exact model it was given about.
create table public.model_versions (
    model_id uuid not null references public.models (id) on delete cascade,
    n integer not null check (n >= 1),
    doc jsonb not null check (octet_length(doc::text) <= 65536),
    created_at timestamptz not null default now(),
    primary key (model_id, n)
);

-- The key itself is shown once, when the link is made, and only its hash is kept.
create table public.invites (
    id uuid primary key default gen_random_uuid(),
    model_id uuid not null references public.models (id) on delete cascade,
    token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
    label text check (char_length(label) <= 80),
    created_at timestamptz not null default now(),
    revoked_at timestamptz
);

create index invites_model on public.invites (model_id);

create table public.responses (
    id uuid primary key default gen_random_uuid(),
    model_id uuid not null references public.models (id) on delete cascade,
    version integer not null,
    -- A content-keyed piece id from model.json; null is the model as a whole.
    piece_id text check (piece_id ~ '^[spdt][0-9a-z]{13}$'),
    kind text not null check (kind in ('resonates', 'differs', 'note', 'idea')),
    body text check (char_length(body) <= 1000),
    name text check (char_length(name) <= 60),
    -- A random key the responder's browser keeps, so they can change their mind.
    responder text not null check (responder ~ '^[A-Za-z0-9]{16,64}$'),
    -- A salted hash, never the address: enough to slow a flood, nothing to leak.
    ip_hash text check (ip_hash ~ '^[0-9a-f]{64}$'),
    invite_id uuid references public.invites (id) on delete set null,
    hidden boolean not null default false,
    created_at timestamptz not null default now(),
    -- A note or an idea says something; a reaction may say why.
    check (kind in ('resonates', 'differs') or char_length(coalesce(body, '')) > 0)
);

create index responses_model on public.responses (model_id, created_at desc);
create index responses_ip on public.responses (ip_hash, created_at desc);
create index responses_responder on public.responses (responder, created_at desc);

-- One reaction per responder per piece: answering again replaces it.
create unique index responses_one_reaction
    on public.responses (model_id, coalesce(piece_id, ''), responder)
    where kind in ('resonates', 'differs');

-- What visitors see: counts per piece and kind, never anyone's words.
create function public.response_counts(p_model uuid)
returns table (piece_id text, kind text, n bigint)
language sql
stable
set search_path = ''
as $$
    select r.piece_id, r.kind, count(*)
    from public.responses r
    where r.model_id = p_model and not r.hidden
    group by r.piece_id, r.kind
$$;

-- Replaces a responder's earlier reaction to the same piece, atomically.
create function public.record_reaction(
    p_model uuid, p_version integer, p_piece text, p_kind text, p_body text,
    p_name text, p_responder text, p_ip_hash text, p_invite uuid
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
    new_id uuid;
begin
    delete from public.responses
    where model_id = p_model
      and coalesce(piece_id, '') = coalesce(p_piece, '')
      and responder = p_responder
      and kind in ('resonates', 'differs');
    insert into public.responses (model_id, version, piece_id, kind, body, name, responder, ip_hash, invite_id)
    values (p_model, p_version, p_piece, p_kind, p_body, p_name, p_responder, p_ip_hash, p_invite)
    returning id into new_id;
    return new_id;
end;
$$;

alter table public.models enable row level security;
alter table public.model_versions enable row level security;
alter table public.invites enable row level security;
alter table public.responses enable row level security;

revoke all on public.models, public.model_versions, public.invites, public.responses from anon, authenticated;
revoke all on function public.response_counts(uuid) from public, anon, authenticated;
revoke all on function public.record_reaction(uuid, integer, text, text, text, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.response_counts(uuid) to service_role;
grant execute on function public.record_reaction(uuid, integer, text, text, text, text, text, text, uuid) to service_role;
