-- Fase 6: de klant beheert het eigen profiel — lezen als subset, schrijven als merge.
--
-- ai_profile_versions is voor de klant coach-only (geen select-policy; insert alleen
-- versie 1 vanuit de onboarding, zie rls.sql). Deze twee RPC's zijn de enige route naar
-- het eigen profiel en houden de coach-velden (aanpak, toon, vermijdenInCoaching,
-- veiligheidsvlag) STRUCTUREEL buiten bereik: mijn_profiel bouwt het antwoord op uit een
-- expliciete whitelist, en werk_mijn_profiel_bij neemt alleen whitelist-keys over. Wie
-- later een coach-veld aan het profiel toevoegt hoeft hier dus niets te doen — het lekt
-- niet mee en is niet overschrijfbaar. Dat is bewust omgekeerd t.o.v. een blacklist.

-- ── 1. mijn_profiel: de klant-subset van de hoogste versie ──
-- Geen profiel (of geen sessie) → geen rij → null; de app toont dan de lege staat.
create or replace function public.mijn_profiel()
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'versie', v.versie,
    'doelen', v.profiel->'doelen',
    'portiedoelen', v.profiel->'portiedoelen',
    'knelpunten', v.profiel->'knelpunten',
    'voorkeuren', v.profiel->'voorkeuren',
    'beperkingen', v.profiel->'beperkingen',
    'checkinRitme', v.profiel->'checkinRitme'
  )
  from public.ai_profile_versions v
  where v.client_id = auth.uid()
  order by v.versie desc
  limit 1;
$$;
revoke execute on function public.mijn_profiel() from public, anon;
grant execute on function public.mijn_profiel() to authenticated;

-- ── 2. werk_mijn_profiel_bij: nieuwe versie met alleen de klant-velden gewijzigd ──
-- Append-only, net als de coach-kant: de historie blijft in het dashboard zichtbaar.
-- author = null heeft dezelfde betekenis als bij de onboarding: door de klant zelf.
-- Ontbrekende keys blijven ongewijzigd — de app mag dus een deelwijziging sturen.
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
