# Fase 5 — Coach-dashboard (design)

**Datum:** 2026-08-02 · **Status:** autonoom uitgewerkt (Jeffrey: "aannames maken mag,
fixen we na fase 5") — alle aannames staan onderaan genummerd.
**Context:** fase 4 (tiers + invite-codes) is af. Dit is het naar voren gehaalde
dashboard (v1.1-fasering: 4 toegang · **5 dashboard** · 6 onboarding/profiel ·
7 AI-limieten/proactief · 8 lancering). Scope = het oorspronkelijke fase-4-dashboard
plus **invite-beheer**; quota-beheer volgt in fase 7 (heeft metering nodig).

## Doel

Laura logt in op een webdashboard (Next.js, `apps/coach`), ziet haar klanten,
leest chats mee en antwoordt als zichzelf, handelt flags af, stelt AI-profielen bij,
maakt notities en beheert invite-codes. Alles onder de bestaande coach-RLS.

## Wat er al ligt (geverifieerd)

- `apps/coach`: kale Next.js 16 + Tailwind 4-scaffold met `src/lib/supabase.ts`.
- Coach-RLS is compleet voor: clients lezen/wijzigen, messages lezen + **inserten als
  'coach'**, flags lezen + afronden (open→resolved met resolved_by/at), food_logs lezen,
  ai_profile_versions lezen + schrijven (`author = auth.uid()`, unieke versie per klant),
  coach_notes lezen/schrijven. `is_coach_of()` is de spil.
- De klant-app rendert `sender: 'coach'`-berichten al als Laura-bubbel en heeft realtime
  op messages (INSERT+UPDATE) en flags — een dashboard-antwoord verschijnt dus direct.
- `invite_codes` heeft bewust nog GEEN coach-policies (fase 4-besluit): die komen nu.

## Onderdelen

### 1. Migratie `fase5_dashboard`

```sql
-- Coach beheert eigen codes: zien + ongebruikte intrekken. Aanmaken via RPC.
create policy coach_leest_eigen_codes on public.invite_codes
  for select using (coach_id = auth.uid());
create policy coach_trekt_code_in on public.invite_codes
  for delete using (coach_id = auth.uid() and used_by is null and used_at is null);

-- RPC: coach maakt een code voor zichzelf. Definer; leidt de coach uit de JWT af en
-- hergebruikt de bestaande generator (service-role-only) via een interne call.
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
```

Plus RLS-tests: coach ziet alleen eigen codes; klant ziet niets (bestond al);
coach kan gebruikte code niet verwijderen; klant kan `maak_eigen_invite_code` niet
aanroepen (raise); coach wel.

### 2. Dashboard-app (`apps/coach`)

Client-side SPA-stijl (A2): supabase-js met sessie in localStorage, één
`CoachProvider` (sessie + coach-rij + gate), geen SSR-auth. Routes (App Router):

- **/login** — e-mail/wachtwoord. Na login: check eigen `coaches`-rij; geen rij →
  signOut + "Dit account is geen coach-account."
- **/** (klantenlijst) — eigen klanten met naam, status, week (via `weekNummer` uit
  `@lau/shared`), open-flag-badge (clay), laatste-bericht-tijd. Zes klanten → per
  klant een lichte query is prima (A11). Klik → detail.
- **/klant/[id]** — drie kolommen/secties:
  - **Chat**: volledige historie, realtime (messages INSERT+UPDATE — óók de
    streamende Lau-teksten groeien live), composer "Antwoord als Laura" → insert
    `{ client_id, sender: 'coach', tekst }`.
  - **Context-zijbalk**: open flags (met redenen + afronden-knop → update
    status/resolved_by/resolved_at), voedingsweek (7-daagse aggregatie zoals de app),
    notities (lijst + toevoegen), profiel-knop.
  - **Profiel-editor** (aparte route of paneel `/klant/[id]/profiel`): toont de
    hoogste versie; formulier met de bekende velden (A7); opslaan = INSERT
    versie+1 met `author = auth.uid()`. Versiehistorie als eenvoudige lijst
    (versie, datum, author).
- **/invites** — tabel van eigen codes (code, aangemaakt, status open/gebruikt-door),
  knop "Nieuwe code" (RPC `maak_eigen_invite_code`), intrekken-knop bij ongebruikte.

### 3. Styling

Brand-tokens uit `@lau/shared` (kleuren) gemapt in Tailwind 4 `@theme`; Newsreader +
DM Sans via `next/font`. Kleurregel gerespecteerd: sage = klant/voortgang, **clay =
coach-aandacht (flags) en Laura's identiteit** — het dashboard mag clay dus wél
ruimer gebruiken dan de klant-app. Sober en functioneel (A3): geen pixel-handoff
voor het dashboard, dus tabellen/kaarten in de bestaande visuele taal.

### 4. Realtime

Klantdetail subscribet op `messages` en `flags` van díe klant (zelfde
postgres_changes-patroon als de app, met de opruim-guard tegen dubbele topics).
Klantenlijst: fetch bij mount + bij window-focus (A4).

### 5. Testen

- RLS-tests voor de nieuwe policies/RPC (tegen cloud, bestaande conventies).
- `npm run typecheck -w apps/coach` + `next build` als bouwverificatie.
- Handmatige flow (Jeffrey later): inloggen als `laura@demo.lauinbalans.nl` /
  `demo-demo-2026`, klant openen, antwoorden, flag afronden, code maken.

## Buiten scope (bewust)

Wekelijks gesprek + AI-voorstelkaarten (A5, aparte fase) · quota-beheer (fase 7) ·
coach-aanmaak-UI (A8) · read_at/gelezen-markering (A9) · e-mail-notificaties ·
AVG-export (fase 8) · deploy/hosting van het dashboard (bij lancering).

## Aannames (na fase 5 samen doorlopen)

- **A1** Coach-login alleen e-mail/wachtwoord; geen social login voor coaches.
- **A2** Dashboard is client-side (geen SSR-auth/cookies). Simpelst; heroverwegen
  bij publieke deploy (dan @supabase/ssr).
- **A3** Geen dashboard-designs in de handoff → sober functioneel ontwerp op de
  brand-tokens, geen pixel-eis.
- **A4** Klantenlijst zonder realtime (refresh bij mount/focus); klantdetail wél.
- **A5** "Wekelijks gesprek" (voorstelkaarten, prompt-preview, WeeklySession) schuift
  naar een eigen fase ná 5 — het bouwt op dit dashboard voort.
- **A6** Antwoorden als Laura rondt flags NIET automatisch af; afronden is een
  expliciete knop (de flag is een hulpvraag, het antwoord is niet per se het einde).
- **A7** Profiel-editor is een formulier met de bekende profielvelden (doelen,
  portiedoelen, knelpunten, voorkeuren, beperkingen, checkinRitme, aanpak, toon,
  vermijdenInCoaching, veiligheidsvlag) — geen vrije JSON-editor.
- **A8** Nieuwe coaches aanmaken valt buiten v1 (Laura + Bea via seed). Het bekende
  admin-API-gedrag (stray free clients-rij bij coach-aanmaak) speelt hier dus niet.
- **A9** read_at blijft liggen (fase-4-notitie).
- **A10** NL-only, geen i18n.
- **A11** Query's per klant op de lijst (geen views/joins-optimalisatie) — 6 klanten;
  herzien bij opschalen.
- **A12** Flags-insert-policy krijgt in deze fase GEEN tier-check (staat als fase-5-
  notitie uit review): de LauraKnop is client-side gegate en de inbox is van Laura —
  risico is een enkele free-flag bij een storing. Oppakken bij fase 7 (limieten) als
  server-side hygiëne daar toch wordt aangescherpt.

## Opvolgpunten uit de eindreview (bewust uitgesteld, mee in het na-fase-5-gesprek)

- **M1** De refresh-and-retry op mutaties (coach-bericht, notitie, invite) gaat af op
  élke fout — bij een netwerkbreuk ná een geslaagde server-write kan dat een dubbele
  rij geven. Zelfde huisstijl als de klant-app; nette fix is de retry beperken tot
  auth-fouten (patroon: `slaOp` in useProfielVersies). Geldt dan ook voor mobile.
- **M5** Klein realtime-gat tussen de eerste chat-fetch en de kanaal-join (bericht in
  precies dat venster mist tot een herlaad). Goedkoopste fix: refetch bij
  visibilitychange zoals de klantenlijst al doet.
- **M6** De chat-autoscroll trekt Laura ook naar beneden als ze historie terugleest;
  alleen scrollen als ze al onderaan stond.
- **M7** Wijzigingen die Laura typt terwíjl "Profiel opslaan" loopt gaan verloren bij
  de versie-bump; velden disablen tijdens het opslaan of de bron-sleutel direct zetten.
- **M9** `npm run test:rls` is rood (3 verwachte fase5-failures) tot de migratie
  gepusht is — daarna 34/34 verwacht.
