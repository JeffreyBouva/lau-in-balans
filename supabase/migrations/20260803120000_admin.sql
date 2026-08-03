-- Laura als super admin.
--
-- Het datamodel is multi-coach vanaf dag één: een klant hangt aan clients.coach_id, en
-- verzilver_code zet die op de eigenaar van de verzilverde invite-code. Laura is daarin
-- gewoon één van de coaches — en zou dus de klant van een andere coach niet zien. Maar
-- Laura is de eigenaar van het product: zij moet altijd alles kunnen zien.
--
-- Aanpak: één vlag (coaches.is_admin) + één helper (is_admin()), en die helper hangen we
-- op twee plekken in: (1) in is_coach_of — de spil waar zeventien coach-policies en de
-- RPC ai_gebruik_deze_maand doorheen lopen, dus die erven de admin-tak in één klap; en
-- (2) met de hand in de vier policies die direct op coach_id matchen (clients ×2,
-- invite_codes ×2) omdat daar geen client_id is om is_coach_of op los te laten.
--
-- Wat NIET verandert: alle klant-policies. Een klant ziet nooit meer dan zichzelf, en
-- is_admin() is voor een klant per definitie false (er is geen coaches-rij). Er is ook
-- geen enkele insert/update-policy op public.coaches — de vlag is dus alleen door de
-- service role (of via SQL) te zetten, nooit door de gebruiker zelf.

-- ── 1. coaches.is_admin ──
alter table public.coaches add column is_admin boolean not null default false;
comment on column public.coaches.is_admin is
  'Admin = producteigenaar (Laura): ziet en beheert álle klanten, ongeacht clients.coach_id. '
  'Gewone coaches blijven bij hun eigen klanten. Alleen te zetten via de service role/SQL: '
  'op public.coaches bestaat geen insert- of update-policy voor authenticated.';

-- ── 2. De bestaande demo-Laura promoveren ──
-- Op de auth-e-mail en niet op naam: 'Laura' is geen sleutel. Bea blijft bewust géén
-- admin — zij is de isolatie-fixture (seed + rls.test.ts) die bewijst dat een gewone
-- coach níét bij de klanten van een ander komt.
-- Een échte (niet-demo) coach promoveer je later handmatig met:
--   update public.coaches set is_admin = true where id = '<uuid van de coach>';
update public.coaches c
   set is_admin = true
  from auth.users u
 where u.id = c.id
   and u.email = 'laura@demo.lauinbalans.nl';

-- ── 3. is_admin(): is de aanroeper de producteigenaar? ──
-- Security definer met lege search_path, zelfde vorm als is_coach_of (hardening C1):
-- definer omdat public.coaches onder RLS staat, lege search_path tegen de pg_temp-hijack.
-- Execute strak: alleen authenticated — anon heeft auth.uid() is null en zou sowieso
-- false krijgen, maar de functie hoort niet in het publieke API-oppervlak.
create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.coaches c where c.id = auth.uid() and c.is_admin
  );
$$;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- ── 4. is_coach_of: dezelfde functie, één tak erbij ──
-- Exact de signature en opties uit de hardening-migratie (C1) — alleen de body verandert,
-- zodat de zeventien policies die 'm gebruiken ongemoeid blijven staan.
-- `or` kortsluit: voor een gewone coach is is_admin() één primary-key-lookup op de eigen
-- coaches-rij, en stable houdt 'm binnen de query op één evaluatie.
-- LET OP: voor een admin geeft deze functie ook true voor een client_id dat niet bestaat.
-- Dat is onschadelijk — de policies filteren daarna nog steeds op een rij die er niet is,
-- en ai_gebruik_deze_maand telt dan gewoon 0 in plaats van 'geen toegang' te roepen.
create or replace function public.is_coach_of(p_client uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select public.is_admin() or exists (
    select 1 from public.clients c
    where c.id = p_client and c.coach_id = auth.uid()
  );
$$;
revoke execute on function public.is_coach_of(uuid) from public, anon;
grant execute on function public.is_coach_of(uuid) to authenticated;

-- ── 5. De vier policies die direct op coach_id matchen ──
-- Deze lopen niet door is_coach_of (clients ís de klantentabel; invite_codes heeft geen
-- client_id), dus hier komt de admin-tak met de hand bij. Drop + recreate: de bestaande
-- voorwaarden blijven letterlijk staan, er komt alleen `or public.is_admin()` bij.

-- clients: lezen.
drop policy coach_leest_klanten on public.clients;
create policy coach_leest_klanten on public.clients
  for select using (coach_id = auth.uid() or public.is_admin());

-- clients: wijzigen — de versie uit de hardening-migratie (I5: using én with check).
-- De guard-trigger clients_guard_update bevriest id/coach_id/startdatum/created_at ook
-- voor de admin: alles zien en bijsturen mag, maar een klant naar een andere coach
-- verplaatsen blijft een aparte, bewuste ingreep (SQL of service role).
drop policy coach_wijzigt_klanten on public.clients;
create policy coach_wijzigt_klanten on public.clients
  for update using (coach_id = auth.uid() or public.is_admin())
  with check (coach_id = auth.uid() or public.is_admin());

-- invite_codes (fase 5): eigen codes zien.
drop policy coach_leest_eigen_codes on public.invite_codes;
create policy coach_leest_eigen_codes on public.invite_codes
  for select using (coach_id = auth.uid() or public.is_admin());

-- invite_codes: ongebruikte codes intrekken. De voorwaarden op used_by/used_at blijven
-- exact staan — een verzilverde code is het spoor van de koppeling klant↔coach en is ook
-- voor de admin niet intrekbaar.
drop policy coach_trekt_code_in on public.invite_codes;
create policy coach_trekt_code_in on public.invite_codes
  for delete using (
    (coach_id = auth.uid() or public.is_admin())
    and used_by is null and used_at is null
  );
