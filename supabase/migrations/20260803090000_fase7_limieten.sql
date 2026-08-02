-- Fase 7: Lau-gebruik meten en begrenzen + proactieve berichten, plus twee meelifters
-- uit het hardening-logboek (A12 flags-tier-check, M5 profiel-caps).
--
-- Volgorde: eerst de opslag (ai_usage), dan de knoppen (limiet per klant +
-- config-default), dan de vlag op messages, dan de dashboard-RPC, dan de twee
-- hardening-punten. Extensions pg_cron/pg_net staan hier bewust NIET in (A16): de
-- cron-koppeling loopt via het Supabase-dashboard.

-- ── 1. ai_usage: één rij per beantwoord Lau-bericht ──
-- Alleen de service role schrijft (lau-reply en lau-ochtend), dus géén insert-policy.
-- De klant leest niets (D5/A17: geen saldo-teller in de app — de nette afkap ís de
-- interface); de coach leest de eigen klanten voor het quota-blok in het dashboard.
-- Tokens loggen we voor latere kostenanalyse; de limiet telt berichten (D1/A13).
create table public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  created_at timestamptz not null default now(),
  model text not null,
  input_tokens int not null default 0,
  output_tokens int not null default 0
);
-- Zelfde vorm als messages_client_created_idx: tellen per klant binnen een periode.
create index ai_usage_client_created_idx on public.ai_usage (client_id, created_at desc);
alter table public.ai_usage enable row level security;
-- Geen `to`-clausule (huisstijl, zie rls.sql): is_coach_of is false voor iedereen die
-- niet de coach van de klant is, en anon mag 'm sinds de hardening niet eens uitvoeren —
-- die krijgt dus geen rijen, of een permission-error op de functie.
create policy coach_leest_ai_usage on public.ai_usage
  for select using (public.is_coach_of(client_id));

-- ── 2. clients.ai_limiet: per-klant override op de config-default ──
-- null = "gebruik de standaard"; 0 zou een klant stil dichtzetten zonder dat dat als
-- keuze leest — wie dat wil zet de klant op status 'gestopt'. De guard-trigger bevriest
-- alleen id/coach_id/startdatum/created_at, dus de bestaande coach_wijzigt_klanten-policy
-- dekt het schrijven vanuit het dashboard al.
alter table public.clients add column ai_limiet int
  check (ai_limiet is null or ai_limiet > 0);

-- ── 3. app_config: default-maandlimiet + killswitch voor het ochtendbericht ──
-- app_config is publiek leesbaar (ook anon) — een limietgetal en een aan/uit-vlag zijn
-- daarvoor geschikt, zie de comment op de tabel. `on conflict do nothing` houdt de
-- migratie herhaalbaar zonder bestaande, handmatig bijgestelde waarden te overschrijven.
insert into public.app_config (key, value) values
  ('ai_maandlimiet', '300'::jsonb),
  ('ochtendbericht_actief', 'true'::jsonb)
on conflict (key) do nothing;

-- ── 4. messages.proactief: door Lau geïnitieerd, niet als antwoord ──
-- Maakt "heeft deze klant vandaag al een ochtendbericht gehad?" één query.
alter table public.messages add column proactief boolean not null default false;

-- ── 5. RPC ai_gebruik_deze_maand: de teller voor het dashboard ──
-- Coach-only; lau-reply telt zelf met de service role en heeft deze RPC niet nodig.
-- Kalendermaand = Europe/Amsterdam (patroon hardening I8): rond de maandwissel zit er
-- 1-2 uur verschil met UTC, en dat mag geen bericht in de verkeerde maand laten vallen.
-- Beide kanten van de vergelijking staan daarom in Amsterdamse lokale tijd. Dat kost het
-- gebruik van ai_usage_client_created_idx op de created_at-kant, maar het gaat om
-- hooguit honderden rijen per klant per maand.
create or replace function public.ai_gebruik_deze_maand(p_client uuid)
returns int
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_maandstart timestamp;
  v_aantal bigint;
begin
  if not public.is_coach_of(p_client) then
    raise exception 'geen toegang tot deze klant';
  end if;
  v_maandstart := date_trunc('month', now() at time zone 'Europe/Amsterdam');
  select count(*) into v_aantal
    from public.ai_usage u
   where u.client_id = p_client
     and (u.created_at at time zone 'Europe/Amsterdam') >= v_maandstart;
  return v_aantal::int;
end;
$$;
revoke execute on function public.ai_gebruik_deze_maand(uuid) from public, anon;
grant execute on function public.ai_gebruik_deze_maand(uuid) to authenticated;

-- ── 6. A12: flaggen is een coached-recht ──
-- De LauraKnop was al client-side gegate op tier; dit sluit de DB-kant. De bestaande
-- voorwaarden uit de hardening-migratie (I4: alleen de eigen klant, alleen status 'open',
-- zonder afhandel-velden) blijven ongewijzigd staan — de tier-check komt er bovenop.
-- De subquery op clients draait onder de RLS van de aanroeper; klant_leest_zichzelf geeft
-- precies de eigen rij, dus dit werkt zonder is_coach_of-achtige definer-omweg en zonder
-- iets over andere klanten te verraden.
drop policy klant_maakt_flag on public.flags;
create policy klant_maakt_flag on public.flags
  for insert with check (
    client_id = auth.uid() and status = 'open'
    and resolved_by is null and resolved_at is null
    and exists (
      select 1 from public.clients c
      where c.id = auth.uid() and c.tier = 'coached'
    )
  );

-- ── 7. M5: werk_mijn_profiel_bij — no-op-detectie + caps ──
-- Create or replace op de fase 6-versie (20260802230000_fase6_profiel.sql). Migraties
-- draaien op volgorde van bestandsnaam, dus deze 20260803090000 komt hoe dan ook ná de
-- create in fase 6 — of die nu al op het project staat of in dezelfde push meekomt (en
-- ook bij een verse `db reset`). De body hieronder is die van fase 6, met exact twee
-- toevoegingen (allebei gemarkeerd met "M5"):
--   1. caps in de lijst-validatie: max 20 items, elk max 200 tekens;
--   2. no-op-detectie ná de merge: een wijziging die niets verandert geeft de huidige
--      versie terug in plaats van een lege versie aan de historie toe te voegen.
create or replace function public.werk_mijn_profiel_bij(p_wijziging jsonb)
returns int
language plpgsql security definer
set search_path = ''
as $$
declare
  -- De vijf text-array-velden en (apart, want ander type) portiedoelen: samen de zes
  -- keys die de klant mag schrijven. Alles daarbuiten wordt genegeerd.
  v_lijstvelden constant text[] := array['doelen', 'knelpunten', 'voorkeuren', 'beperkingen', 'checkinRitme'];
  v_toegestaan constant text[] := array['doelen', 'knelpunten', 'voorkeuren', 'beperkingen', 'checkinRitme', 'portiedoelen'];
  v_handen constant text[] := array['eiwit', 'groente', 'koolhydraten', 'vet'];
  v_client uuid := auth.uid();
  v_key text;
  v_waarde jsonb;
  v_getal numeric;
  v_versie int;
  v_profiel jsonb;
  v_nieuw jsonb;
begin
  if v_client is null then
    raise exception 'niet ingelogd';
  end if;
  if p_wijziging is null or jsonb_typeof(p_wijziging) <> 'object' then
    raise exception 'ongeldige wijziging';
  end if;

  -- Validatie éérst en volledig: nooit half schrijven omdat het derde veld rammelt.
  foreach v_key in array v_lijstvelden loop
    if p_wijziging ? v_key then
      v_waarde := p_wijziging -> v_key;
      if jsonb_typeof(v_waarde) <> 'array' then
        raise exception 'ongeldige lijst: %', v_key;
      end if;
      -- text[] betekent hier: uitsluitend strings, ook geen geneste objecten of null.
      if exists (
        select 1 from jsonb_array_elements(v_waarde) e where jsonb_typeof(e) <> 'string'
      ) then
        raise exception 'ongeldige lijst: %', v_key;
      end if;
      -- M5: plafonds ruim boven normaal gebruik (de app toont een handjevol bullets).
      -- Ze houden een kapotte of kwaadwillende client uit het profiel dat straks in
      -- elke Lau-prompt meegaat — een lijst van 10.000 items zou daar de context vullen.
      if jsonb_array_length(v_waarde) > 20 then
        raise exception 'te veel of te lange items';
      end if;
      if exists (
        select 1 from jsonb_array_elements_text(v_waarde) e where length(e) > 200
      ) then
        raise exception 'te veel of te lange items';
      end if;
    end if;
  end loop;

  if p_wijziging ? 'portiedoelen' then
    v_waarde := p_wijziging -> 'portiedoelen';
    -- Exact de vier handmaten: geen ontbrekende hand (Eten rekent met alle vier) en
    -- geen extra keys die stilletjes in het profiel zouden belanden.
    -- Twee losse checks, geen `or`: Postgres garandeert geen evaluatievolgorde binnen
    -- één expressie, en jsonb_object_keys knalt op alles wat geen object is.
    if jsonb_typeof(v_waarde) <> 'object' then
      raise exception 'ongeldige portiedoelen';
    end if;
    if (select count(*) from jsonb_object_keys(v_waarde)) <> 4 then
      raise exception 'ongeldige portiedoelen';
    end if;
    foreach v_key in array v_handen loop
      if not (v_waarde ? v_key) or jsonb_typeof(v_waarde -> v_key) <> 'number' then
        raise exception 'ongeldige portiedoelen';
      end if;
      v_getal := (v_waarde ->> v_key)::numeric;  -- veilig: type is hierboven 'number'
      if v_getal <> trunc(v_getal) or v_getal < 0 or v_getal > 12 then
        raise exception 'ongeldige portiedoelen';  -- 12 = zelfde plafond als het dashboard
      end if;
    end loop;
  end if;

  -- Twee pogingen: verliest de insert de race op unique (client_id, versie), dan is er
  -- inmiddels een hogere versie — opnieuw lezen en opnieuw mergen (de wijziging van de
  -- ander gaat dus NIET verloren). Blijft het botsen, dan is er iets structureels aan de
  -- hand en krijgt de gebruiker een nette melding.
  for poging in 1..2 loop
    select v.versie, v.profiel into v_versie, v_profiel
      from public.ai_profile_versions v
     where v.client_id = v_client
     order by v.versie desc
     limit 1;
    if v_versie is null or jsonb_typeof(v_profiel) <> 'object' then
      raise exception 'geen profiel';  -- onboarding hoort versie 1 te maken
    end if;

    -- Whitelist-merge: start bij het bestaande profiel (coach-velden blijven dus exact
    -- staan) en zet alleen de aanwezige toegestane keys eroverheen.
    v_nieuw := v_profiel;
    foreach v_key in array v_toegestaan loop
      if p_wijziging ? v_key then
        v_nieuw := v_nieuw || jsonb_build_object(v_key, p_wijziging -> v_key);
      end if;
    end loop;

    -- M5: verandert er niets, dan komt er geen versie bij. De app stuurt bij elke
    -- opslaan-klik het hele blok mee, ook als de klant alleen keek; zonder deze check
    -- vult dat de historie (Laura's gereedschap) met identieke versies. jsonb-gelijkheid
    -- is inhoudelijk: sleutelvolgorde en whitespace tellen niet mee.
    if v_nieuw = v_profiel then
      return v_versie;
    end if;

    begin
      insert into public.ai_profile_versions (client_id, versie, profiel, author)
      values (v_client, v_versie + 1, v_nieuw, null);
      return v_versie + 1;
    exception when unique_violation then
      if poging = 2 then
        raise exception 'probeer het opnieuw';
      end if;
    end;
  end loop;
  raise exception 'probeer het opnieuw';  -- onbereikbaar, maar de functie moet sluiten
end;
$$;
revoke execute on function public.werk_mijn_profiel_bij(jsonb) from public, anon;
grant execute on function public.werk_mijn_profiel_bij(jsonb) to authenticated;
