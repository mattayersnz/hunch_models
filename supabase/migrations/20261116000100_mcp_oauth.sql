-- Supabase's OAuth server issues the same JWT shape as ordinary sessions. Give
-- OAuth client tokens an MCP-specific audience so they cannot be confused with
-- Hunch app sessions. The site additionally requires client_id on every MCP call.

create or replace function public.hunch_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
    claims jsonb;
    oauth_client text;
begin
    claims := coalesce(event -> 'claims', '{}'::jsonb);
    oauth_client := coalesce(claims ->> 'client_id', event ->> 'client_id');

    if oauth_client is not null and oauth_client <> '' then
        claims := jsonb_set(claims, '{aud}', to_jsonb('https://hunch.tech/mcp'::text), true);
        claims := jsonb_set(claims, '{hunch_access}', to_jsonb('mcp'::text), true);
        event := jsonb_set(event, '{claims}', claims, true);
    end if;

    return event;
end;
$$;

grant usage on schema public to supabase_auth_admin;
grant execute on function public.hunch_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.hunch_access_token_hook(jsonb) from public, anon, authenticated;

