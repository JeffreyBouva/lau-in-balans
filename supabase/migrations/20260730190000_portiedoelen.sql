-- Klant mag zijn AI-profiel niet lezen (coach-only), maar de app heeft wél de portiedoelen nodig.
create or replace function public.mijn_portiedoelen()
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select v.profiel->'portiedoelen'
  from public.ai_profile_versions v
  where v.client_id = auth.uid()
  order by v.versie desc
  limit 1;
$$;
revoke execute on function public.mijn_portiedoelen() from public, anon;
grant execute on function public.mijn_portiedoelen() to authenticated;
