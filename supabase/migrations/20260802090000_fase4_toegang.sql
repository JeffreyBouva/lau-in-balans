-- Fase 4: tiers, invite-codes, app_config, registratie-trigger, verzilver-RPC.

-- pgcrypto levert gen_random_bytes(): een CSPRNG voor de invite-codes.
create extension if not exists pgcrypto with schema extensions;

-- ── 1. clients: tier + coach optioneel ──
alter table public.clients add column tier text not null default 'free'
  check (tier in ('free', 'coached'));
alter table public.clients alter column coach_id drop not null;
update public.clients set tier = 'coached';  -- bestaande (demo)klanten zijn coached

-- Guard versoepelen: coach_id mag één transitie maken (NULL → coach, het verzilveren).
-- Een al-gekoppelde coach blijft onwijzigbaar.
create or replace function public.clients_guard_update()
returns trigger language plpgsql
set search_path = ''
as $$
begin
  if new.id <> old.id
     or (old.coach_id is not null and new.coach_id is distinct from old.coach_id)
     or new.startdatum <> old.startdatum
     or new.created_at <> old.created_at then
    raise exception 'clients: id, coach_id, startdatum en created_at zijn niet wijzigbaar';
  end if;
  return new;
end;
$$;

-- ── 2. invite_codes: kaal, eenmalig, geen vervaldatum in v1 ──
create table public.invite_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code = upper(code) and length(code) = 6),
  coach_id uuid not null references public.coaches (id),
  created_at timestamptz not null default now(),
  used_by uuid references public.clients (id) on delete set null,
  used_at timestamptz,
  -- used_by mag null wórden (klant verwijderd → FK set null), maar used_at blijft
  -- staan: de code is en blijft verbrand.
  check (used_by is null or used_at is not null)
);
-- Case-insensitief uniek: het verzilveren matcht op upper(code).
create unique index invite_codes_code_upper_idx on public.invite_codes (upper(code));
create index invite_codes_coach_idx on public.invite_codes (coach_id);
alter table public.invite_codes enable row level security;
-- Bewust GEEN policies voor authenticated: alles loopt via de RPC's.
-- Coach-beheer-policies komen in fase 5 (dashboard).

-- ── 3. app_config: remote ops-knoppen, leesbaar voor iedereen ──
create table public.app_config (
  key text primary key,
  value jsonb not null
);
alter table public.app_config enable row level security;
create policy iedereen_leest_config on public.app_config
  for select to anon, authenticated using (true);
insert into public.app_config (key, value) values
  ('sloten_actief', 'true'::jsonb),
  ('apple_login_actief', 'false'::jsonb);
comment on table public.app_config is 'Publiek leesbaar (ook anon) — hier NOOIT gevoelige waarden in zetten.';

-- ── 4. Registratie-trigger: elke nieuwe auth-user krijgt een clients-rij ──
-- Vlag rol='coach' in app_metadata zou coach-accounts overslaan, maar LET OP: via de
-- admin-API werkt dat NIET — GoTrue zet app_metadata pas in een UPDATE ná de insert,
-- dus de trigger ziet 'm nooit (gepind door de documenting-test in tests/rls/fase4.test.ts).
-- Afspraak: wie via admin een coach aanmaakt, ruimt de trigger-rij zelf op (seed doet dit).
-- Bewust app_metadata en niet user_metadata: alleen de service role kan die schrijven,
-- terwijl user_metadata bij signUp door de gebruiker zelf te vullen is.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if new.raw_app_meta_data->>'rol' = 'coach' then
    return new;
  end if;
  insert into public.clients (id, naam, tier)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data->>'naam', ''),
      nullif(new.raw_user_meta_data->>'full_name', ''),  -- Google/Apple
      split_part(coalesce(new.email, 'nieuw'), '@', 1)
    ),
    'free'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
-- geen grants nodig: een 'returns trigger'-functie is niet via PostgREST aanroepbaar

-- ── 5. RPC verzilver_code: atomair, lekt niet welke codes bestaan ──
create or replace function public.verzilver_code(p_code text)
returns boolean
language plpgsql security definer
set search_path = ''
as $$
declare
  v_coach uuid;
  v_tier text;
  v_bestaande_coach uuid;
begin
  if auth.uid() is null then
    return false;
  end if;
  -- Lock op de eigen klant-rij: serialiseert claims per gebruiker en geeft
  -- tier + huidige coach in één probe. Geen rij (coach-login) → uniform false.
  select c.tier, c.coach_id into v_tier, v_bestaande_coach
    from public.clients c where c.id = auth.uid() for update;
  if v_tier is null or v_tier = 'coached' then
    return false;
  end if;
  -- Coach van de code éérst lezen (zonder claim): een code van een andere coach
  -- dan de bestaande koppeling zou anders pas ná de claim op de guard knallen.
  select ic.coach_id into v_coach from public.invite_codes ic
   where upper(ic.code) = upper(trim(p_code)) and ic.used_by is null and ic.used_at is null;
  if v_coach is null then
    return false;
  end if;
  if v_bestaande_coach is not null and v_bestaande_coach <> v_coach then
    return false;
  end if;
  -- Claim (atomair; race met een andere claimer valt terug op false).
  -- Ook op used_at: een verwijderde klant (used_by → null via FK) mag z'n
  -- verbrande code niet laten herrijzen.
  update public.invite_codes
     set used_by = auth.uid(), used_at = now()
   where upper(code) = upper(trim(p_code)) and used_by is null and used_at is null
  returning coach_id into v_coach;
  if v_coach is null then
    return false;
  end if;
  update public.clients set tier = 'coached', coach_id = v_coach where id = auth.uid();
  return true;
end;
$$;
revoke execute on function public.verzilver_code(text) from public, anon;
grant execute on function public.verzilver_code(text) to authenticated;

-- ── 6. RPC maak_invite_code: alleen service_role (dashboard/SQL; fase 5 krijgt coach-UI) ──
-- Alfabet zonder verwarrende tekens (geen O/0/I/1); 32 tekens.
create or replace function public.maak_invite_code(p_coach uuid)
returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  v_chars constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text;
  v_bytes bytea;
  i int;
begin
  -- 256 is deelbaar door 32 (lengte alfabet): modulo geeft geen bias.
  for poging in 1..20 loop
    v_bytes := extensions.gen_random_bytes(6);
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(v_chars, 1 + (get_byte(v_bytes, i - 1) % length(v_chars)), 1);
    end loop;
    begin
      insert into public.invite_codes (code, coach_id) values (v_code, p_coach);
      return v_code;
    exception when unique_violation then
      -- botsing: ~1 op 1 miljard per bestaande code — opnieuw proberen
      null;
    end;
  end loop;
  raise exception 'geen vrije invite-code na 20 pogingen';
end;
$$;
revoke execute on function public.maak_invite_code(uuid) from public, anon, authenticated;
grant execute on function public.maak_invite_code(uuid) to service_role;

-- ── 7. mijn_tier: de klant leest z'n eigen tier al via RLS (clients select),
--     maar een expliciete RPC houdt de app-code simpel en werkt ook vlak na signup ──
create or replace function public.mijn_tier()
returns text
language sql stable security definer
set search_path = ''
as $$
  select coalesce(
    (select c.tier from public.clients c where c.id = auth.uid()),
    'free'
  );
$$;
revoke execute on function public.mijn_tier() from public, anon;
grant execute on function public.mijn_tier() to authenticated;
