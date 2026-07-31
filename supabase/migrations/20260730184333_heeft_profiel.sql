-- Klant mag zijn eigen AI-profiel niet lezen (coach-only), maar wél weten óf hij er een heeft.
create or replace function public.klant_heeft_profiel()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.ai_profile_versions v
    where v.client_id = auth.uid()
  );
$$;
revoke execute on function public.klant_heeft_profiel() from public, anon;
grant execute on function public.klant_heeft_profiel() to authenticated;
