-- App-feedback 1, punt 3: "Ik mis in de locked state een makkelijke manier om in contact
-- te komen met Laura voor een coachingtraject."
--
-- Aanname F1: een codeaanvraag is niets meer dan een verzoek in de database, zichtbaar in
-- het dashboard. Laura mailt of belt zelf en zet handmatig een code klaar — géén
-- automatische toekenning, geen betaalstroom, geen mail vanuit de app.
--
-- Wie mag wat:
--   klant  — maakt een aanvraag voor zichzelf en leest de eigen aanvragen, zodat de app
--            "je aanvraag staat klaar" kan tonen in plaats van de knop nog een keer.
--   coach  — leest en handelt af bij de eigen klanten (is_coach_of).
--   admin  — leest en handelt overal af (is_admin, sinds 20260803120000_admin.sql).
--
-- LET OP, en bewust zo: de aanvrager is bijna altijd een FREE klant, en die heeft nog géén
-- coach (clients.coach_id is null sinds fase 4). is_coach_of is voor zo'n klant bij elke
-- gewone coach false — een aanvraag zónder coach is dus alleen zichtbaar voor de admin.
-- Dat is precies goed: Laura ís de admin en zij is degene die codes uitdeelt. Een aanvraag
-- van een klant die al coached is (bijvoorbeeld "ik wil verlengen") ziet haar eigen coach
-- er wél bij staan.

-- ── 1. De tabel ──
create table public.code_aanvragen (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  -- Optioneel motivatietekstje uit de app; '' in plaats van null zodat het dashboard
  -- nooit op null hoeft te testen. De cap staat er om dezelfde reden als bij M5
  -- (werk_mijn_profiel_bij): dit is onbeperkt schrijfbaar door een klant, en één alinea
  -- is ruim — een kapotte of kwaadwillende client hoort hier geen megabytes te kunnen
  -- parkeren. 1000 tekens ≈ een half A4.
  bericht text not null default '' check (length(bericht) <= 1000),
  status text not null default 'open' check (status in ('open', 'afgehandeld')),
  created_at timestamptz not null default now(),
  afgehandeld_door uuid references public.coaches (id) on delete set null,
  afgehandeld_op timestamptz,
  -- Zelfde soort invariant als op invite_codes (used_by/used_at): afgehandeld_door mag
  -- null wórden als de coach verdwijnt, maar het moment van afhandelen blijft staan.
  check (status = 'open' or afgehandeld_op is not null)
);

comment on table public.code_aanvragen is
  'Verzoek van een klant om een coachingtraject (F1). Laura handelt buiten de app af en '
  'zet zelf een invite-code klaar; deze tabel is de werkvoorraad, geen toekenning.';
comment on column public.code_aanvragen.bericht is
  'Vrij tekstveld uit de app, mag leeg zijn. Nooit ongefilterd in een AI-prompt plakken.';

-- De dashboard-query: alleen open aanvragen, nieuwste eerst. Partial, want afgehandelde
-- aanvragen zijn historie en worden niet gelijst. `status` staat ook in de sleutel —
-- redundant binnen de partial index, maar het houdt de definitie leesbaar naast de
-- query (where status = 'open' order by created_at desc) en kost bij deze aantallen niets.
create index code_aanvragen_open_idx on public.code_aanvragen (status, created_at desc)
  where status = 'open';

-- Eén open aanvraag per klant. Dit is de vervanger van een voorwaarde die niet in een
-- policy past ("mag inserten mits er nog geen open aanvraag is"): een tweede insert botst
-- op deze index en geeft 23505. De app vertaalt die code naar "je aanvraag staat al
-- klaar" — precies de boodschap die de klant hoort te zien. Zodra Laura afhandelt komt de
-- sleutel vrij en kan de klant opnieuw aanvragen.
create unique index code_aanvragen_een_open_per_klant on public.code_aanvragen (client_id)
  where status = 'open';

alter table public.code_aanvragen enable row level security;

-- ── 2. Policies ──
-- Geen `to`-clausule (huisstijl, zie rls.sql): anon heeft auth.uid() is null en matcht
-- dus per definitie geen enkele rij; op de coach-takken loopt anon bovendien tegen de
-- ingetrokken execute op is_admin/is_coach_of aan.

-- Klant: een aanvraag voor zichzelf, altijd open en zonder afhandel-velden. Patroon:
-- klant_maakt_flag (hardening I4) — zonder die twee null-eisen zou een klant zichzelf
-- meteen als "afgehandeld door Laura" kunnen wegschrijven.
-- Bewust GEEN tier-check zoals bij flags (A12): aanvragen is juist het recht van de free
-- klant. Een coached klant mag het ook — "ik wil verlengen" hoort bij dezelfde bak.
create policy klant_maakt_aanvraag on public.code_aanvragen
  for insert with check (
    client_id = auth.uid() and status = 'open'
    and afgehandeld_door is null and afgehandeld_op is null
  );

-- Klant: de eigen aanvragen teruglezen, zodat de app de stand kan tonen.
create policy klant_leest_eigen_aanvragen on public.code_aanvragen
  for select using (client_id = auth.uid());

-- Coach/admin: lezen. is_coach_of bevat sinds de admin-migratie zelf al een admin-tak,
-- dus `public.is_admin() or` is strikt genomen dubbelop. Het staat er toch: het maakt op
-- deze tabel expliciet dat de admin de enige is die aanvragen van klanten zónder coach
-- ziet, en het blijft staan mocht die tak ooit uit is_coach_of verdwijnen. `or` kortsluit,
-- dus voor de admin is het één primary-key-lookup.
create policy coach_leest_aanvragen on public.code_aanvragen
  for select using (public.is_admin() or public.is_coach_of(client_id));

-- Coach/admin: afhandelen. Exact het patroon van coach_rondt_flag_af (hardening I4):
-- alleen vanuit 'open' (idempotent, en niemand kan een afgehandelde aanvraag herschrijven)
-- en alleen naar 'afgehandeld' met de afhandelaar én het moment ingevuld. Daarmee is
-- "wie heeft dit opgepakt" niet te vervalsen en kan een update niet stiekem het bericht
-- of de status-heen-en-weer gebruiken.
create policy coach_handelt_aanvraag_af on public.code_aanvragen
  for update using (
    (public.is_admin() or public.is_coach_of(client_id)) and status = 'open'
  )
  with check (
    (public.is_admin() or public.is_coach_of(client_id))
    and status = 'afgehandeld'
    and afgehandeld_door = auth.uid()
    and afgehandeld_op is not null
  );

-- Bewust geen delete-policy: een afgehandelde aanvraag is historie (wie vroeg wanneer om
-- een traject). Opruimen gaat vanzelf via de cascade op clients bij een AVG-verwijdering.
