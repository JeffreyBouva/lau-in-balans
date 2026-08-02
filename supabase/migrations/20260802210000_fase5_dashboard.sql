-- Fase 5: coach beheert de eigen invite-codes vanuit het dashboard.
-- Fase 4 liet invite_codes bewust zónder policies voor authenticated (alles liep via
-- de RPC's); dit is precies het stukje dat de coach zelf mag doen: eigen codes zien,
-- eigen ongebruikte codes intrekken, en een nieuwe code voor zichzelf maken.

-- ── 1. Policies: coach ziet en trekt eigen codes in ──
-- Geen `to`-clausule (huisstijl, zie rls.sql): anon heeft auth.uid() is null en
-- matcht dus per definitie geen enkele rij.
create policy coach_leest_eigen_codes on public.invite_codes
  for select using (coach_id = auth.uid());
-- Alleen ongebruikte codes zijn intrekbaar: een verzilverde code is het spoor van de
-- koppeling klant↔coach en blijft staan. Ook op used_at filteren, niet alleen op
-- used_by: bij een AVG-verwijdering wordt used_by null (FK on delete set null) terwijl
-- de code verbrand blijft — zonder used_at-check zou die alsnog wisbaar worden.
create policy coach_trekt_code_in on public.invite_codes
  for delete using (coach_id = auth.uid() and used_by is null and used_at is null);

-- ── 2. RPC maak_eigen_invite_code: coach maakt een code voor zichzelf ──
-- De coach komt uit de JWT, niet uit een parameter: daarmee kan niemand een code op
-- naam van een ándere coach zetten.
--
-- LET OP: maak_invite_code is service_role-only (fase 4: execute ingetrokken voor
-- authenticated). Dat botst hier niet — deze functie is security definer en draait dus
-- als haar owner, en PostgreSQL toetst het EXECUTE-recht van de binnenaanroep tegen
-- díe owner in plaats van tegen de aanroepende coach. De generator blijft daarmee
-- onbereikbaar voor een directe PostgREST-call, terwijl deze wrapper 'm wél kan
-- gebruiken. Zou de grant op maak_invite_code ooit terugkomen, dan is dat een gat:
-- p_coach is daar vrij invulbaar.
create or replace function public.maak_eigen_invite_code()
returns text
language plpgsql security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.coaches c where c.id = auth.uid()) then
    raise exception 'alleen coaches kunnen codes aanmaken';
  end if;
  return public.maak_invite_code(auth.uid());
end;
$$;
revoke execute on function public.maak_eigen_invite_code() from public, anon;
grant execute on function public.maak_eigen_invite_code() to authenticated;
