# Lau in Balans — MVP Design (v1)

Datum: 2026-07-30 · Status: goedgekeurd ontwerp, klaar voor implementatieplan

## Context & propositie

Lau in Balans is AI-assisted voedingscoaching: de AI (**Lau.ai**) doet het dagelijkse coachen,
Laura is de menselijke laag die meeleest, ingrijpt en de AI wekelijks per klant bijstelt.
Wat we met deze MVP valideren is de propositie — AI-gedreven coaching, aangestuurd door een
wekelijks menselijk gesprek — niet of coaching werkt.

De kernloop die moet kloppen:

1. Klant stelt een vraag / logt eten / zoekt steun in de app.
2. Lau.ai coacht, contextbewust vanuit het per-klant profiel dat Laura beheert.
3. "Praat met Laura" is altijd één tik weg (flag naar Laura).
4. Wekelijks gesprek: Laura stelt het AI-profiel bij; dat is de personalisatiemotor.

**Bronnen:** de projectbrief (Lean MVP-plan) en de design handoff in
`design_handoff_lau_in_balans/` (README + `Lau in Balans - v1.dc.html` zijn leidend voor
UI, tokens, copy en interacties — high-fidelity en definitief).

**Bewuste afwijking van de brief:** geen responsive webapp voor de klant, maar een
**React Native app (Expo) voor iOS en Android**. Het coach-dashboard blijft web.

## Besluiten (met Jeffrey vastgesteld)

| Besluit | Keuze |
|---|---|
| Klant-app | Expo React Native, iOS + Android |
| Coach-dashboard | Next.js (App Router), losse webapp, desktop ≥ 1200px |
| Backend | Supabase (EU-regio): Postgres, Auth, RLS, Realtime, Edge Functions |
| Architectuur | Supabase-first: apps praten direct met Supabase; RLS is de beveiligingslaag; alleen AI-logica in Edge Functions |
| Repo | Monorepo in deze repo (npm workspaces) |
| Scope-extra's in v1 | Proactief ochtendbericht + push-notificaties én AI-voorstelkaarten in het wekelijks gesprek |

## Architectuur

```text
lau-in-balans/
├── apps/
│   ├── mobile/          Expo React Native (TypeScript) — klant-app
│   └── coach/           Next.js + Tailwind — coach-dashboard
├── packages/
│   └── shared/          Dependency-vrije TypeScript: domeintypes, handmaten-constanten,
│                        design-tokens (importeerbaar door Node én Deno)
├── supabase/
│   ├── migrations/      SQL-schema + RLS-policies + pg_cron
│   └── functions/       Edge Functions (Deno)
│       ├── _shared/     prompt-builder (één pipeline voor alles)
│       ├── lau-reply/   chat- en log-antwoorden van Lau
│       ├── morning-message/  dagelijks ochtendbericht (via pg_cron)
│       ├── session-suggest/  AI-profielvoorstellen uit sessienotitie
│       └── prompt-preview/   preview in het wekelijks gesprek
└── design_handoff_lau_in_balans/   design-referentie (blijft staan)
```

### Klant-app (apps/mobile)

- **Expo + TypeScript**, navigatie met **Expo Router**: route-groep `(onboarding)` als
  stack (8 stappen), `(tabs)` met Vandaag / Lau.ai / Eten.
- **Styling: RN StyleSheet + een tokens-module** met de kleuren, typografie, radii en
  spacing uit de handoff. Geen NativeWind/Tamagui: pixel-precieze handoff + eerste
  RN-project = geen extra abstractielaag. Fonts via `@expo-google-fonts/newsreader` en
  `@expo-google-fonts/dm-sans`.
- **Bottom sheets** (Eten loggen, Praat met Laura): eigen lichtgewicht component
  (RN Modal + Animated; scrim met blur, `lauSheet`-easing `.34s cubic-bezier(.22,.8,.3,1)`,
  sluiten via scrim-tik). Geen sheet-library.
- **State**: React context + hooks. Serverdata direct via `supabase-js`; chat via een
  Realtime-subscription op `messages`. Geen Redux/Zustand/React Query in v1.
- **Push**: `expo-notifications` + Expo Push Service (APNs/FCM via EAS). Token wordt bij
  login geregistreerd in `push_tokens`.
- Dev: **Expo Go** + iOS-simulator. Distributie testramp: **EAS Build → TestFlight**
  (Apple Developer-account nodig, €99/jr) en Google Play internal testing.

### Coach-dashboard (apps/coach)

- Next.js (App Router) + **Tailwind**, design-tokens als CSS-variabelen.
- Schermen: klantenlijst (filters, flag-markering), klantdetail (3 kolommen: meelezen
  realtime + antwoorden als Laura, AI-profiel-editor, eten & notities), wekelijks gesprek
  (vastleggen → voorstellen → prompt-preview → vastleggen).
- Onder 1200px: nette melding dat het dashboard voor desktop is ontworpen (conform handoff).

### Shared (packages/shared)

- Domeintypes (Client, AIProfile, Message, FoodLog, Flag, CoachNote, WeeklySession),
  handmaten-constanten (keys, namen, handen, dagdoelen, kleuren) en design-tokens als
  TypeScript-constanten. Bewust zonder runtime-dependencies zodat Deno (Edge Functions)
  dezelfde bestanden kan importeren.

## Datamodel

Multi-coach vanaf dag één (brief: "ontwerp met meerdere coaches in gedachten"), ook al is
Laura in v1 de enige.

| Tabel | Velden (kern) |
|---|---|
| `coaches` | id (→ auth.users), naam |
| `clients` | id (→ auth.users), coach_id, naam, leeftijd, startdatum, status (`actief` / `nieuw` / `stil` / `gestopt`) — "week N" wordt afgeleid van startdatum |
| `ai_profile_versions` | **append-only**: client_id, versie, profiel (JSONB, zie onder), author (coach_id of `system`), created_at. Nieuwste versie = actieve profiel |
| `messages` | client_id, sender `ai` / `client` / `coach`, tekst, created_at, read_at (gelezen-status); log-berichten verwijzen naar food_log_id |
| `food_logs` | client_id, datum, moment (`Ontbijt` / `Lunch` / `Avondeten` / `Tussendoor`), porties JSONB `{eiwit, groente, koolhydraten, vet}`, bron `chat` / `eten` |
| `flags` | client_id, tekst, redenen[], status `open` / `resolved`, created_at, resolved_by/at |
| `coach_notes` | client_id, datum, tekst, type `intake` / `sessie` / `los` |
| `weekly_sessions` | client_id, datum, notitie, signalen[], voorstellen JSONB (incl. toegepast/overgeslagen), resulting_profile_version |
| `push_tokens` | client_id, expo_push_token, platform, updated_at |

**AIProfile (JSONB, gestructureerd — nadrukkelijk géén vrije tekst-blob):**
doelen[], portiedoelen `{handmaat: aantal/dag}`, knelpunten[], voorkeuren[],
beperkingen[] (allergieën/medisch), checkinRitme[], aanpak (tekst), toon (tekst),
vermijdenInCoaching (tekst, **bindend** voor de prompt), veiligheidsvlag
(uit onboarding-stap 6: `geen` / `soms` / `voorzichtig` / `overgeslagen`).
(JSONB-keys camelCase — bewuste keuze, kolommen blijven snake_case.)

Onboarding-antwoorden landen als **profielversie 1** (author `system`). Elke wijziging
door Laura = nieuwe versie; de reden staat in de sessienotitie of coach_note.

### RLS (beveiligingsmodel)

- Klant: uitsluitend rijen met `client_id = auth.uid()`; leesrechten op het eigen actieve
  profiel, schrijfrechten op eigen messages/food_logs/flags.
- Coach: alle rijen van klanten met `coach_id = eigen coach-id`; schrijft profielversies,
  notes, sessions, coach-messages, en zet flags op resolved.
- `ai_profile_versions` is voor klanten onzichtbaar behalve waar nodig; Edge Functions
  draaien met service role en zijn de enige plek met de Claude API-key.

### AVG & portabiliteit

- Supabase-project in EU-regio; gezondheidsdata blijft in de EU.
- Export vanaf dag één: knop in het klantdetail die alle data van één klant als JSON
  bundelt (profielversies, berichten, logs, flags, notities, sessies).

## AI-pipeline

Eén **prompt-builder** in `supabase/functions/_shared/`, gebruikt door álle functies —
de handoff eist expliciet dat de preview via dezelfde pipeline loopt als productie.

**Systeemprompt-opbouw:** identiteit & toon van Lau (uit de handoff-copy) → guardrails
(hieronder) → het actieve AIProfile (gestructureerd) → weekcontext (portiedoelen vs.
gelogde handmaten deze week) → few-shot-voorbeelden (de antwoordtabel uit de handoff).

| Functie | Trigger | Gedrag |
|---|---|---|
| `lau-reply` | app, na insert van klant- of logbericht | laadt actieve profielversie + laatste ~30 berichten + logs van deze week → Claude (Sonnet) → insert `ai`-bericht → realtime bij klant én coach-meeleesscherm |
| `morning-message` | pg_cron, dagelijks 's ochtends | per actieve klant één kort openingsbericht (zelfde pipeline, check-in-ritme uit profiel gerespecteerd) + push-notificatie |
| `session-suggest` | dashboard, wekelijks gesprek | input: sessienotitie + signalen + actueel profiel → **gestructureerde JSON**: max 3 voorstellen `{veld, oud, nieuw, motivatie}` → voorstelkaarten (toepassen/overslaan) |
| `prompt-preview` | dashboard, live in het wekelijks gesprek | draft-profiel (met toegepaste voorstellen) → gesimuleerd openingsbericht via de échte pipeline |

Push gaat óók uit bij een antwoord van Laura (coach-bericht) — "Sanne krijgt een melding"
uit de handoff. Typing-indicator in de app draait zolang `lau-reply` loopt; streaming is
een latere optimalisatie, de indicator blijft (onderdeel van de toon).

### Guardrails (niet optioneel)

In de systeemprompt én in de UI:

1. **Geen medisch advies**; bij klachten/twijfel doorverwijzen naar huisarts of diëtist.
   Disclaimer in onboarding stap 0 en permanent onderaan de chat.
2. **Nooit calorieën, grammen of macro's** — handmaten zijn de enige eenheid, ook in
   AI-antwoorden.
3. **`vermijdenInCoaching` is bindend** (bijv. "nooit openen met gewicht of getallen").
4. **Rode vlaggen** (eetstoornis-signalen, ondervoeding, psychische nood, zwangerschap,
   medicatie): Lau coacht niet door maar brengt Laura in beeld; Laura heeft de
   "Rode vlag"-chip in het wekelijks gesprek.
5. **Laura is altijd één tik weg** — de Laura-knop staat op elk hoofdscherm.
6. **Laura's berichten zijn visueel onderscheiden** van Lau (eigen bubbelkleur); de klant
   weet altijd of ze met mens of AI praat.

## Auth & flows

- **Klant-invite:** Laura maakt een klant aan in het dashboard → Supabase invite-mail →
  klant zet wachtwoord in de app → onboarding (8 stappen) → antwoorden worden
  profielversie 1 → chat opent met het eerste bericht van Lau.
- **Laura:** account wordt geseed (migration); login op het dashboard met e-mail/wachtwoord.
- **Flag-flow:** klant verstuurt flag (sheet) → status `sent` in de app, bolletje op de
  Laura-knop → banner + rij-markering in het dashboard → Laura reageert als zichzelf en
  rondt de flag af → klant-app terug naar `idle`.

## Testaanpak

- **Unit** (vitest / `deno test`): prompt-builder (profiel → prompt, guardrail-regels
  aanwezig), portie-optelling en week-aggregaties, week-afleiding uit startdatum.
- **RLS-tests** tegen lokale Supabase: klant kan niet bij andere klanten, coach niet bij
  andermans klanten — gezondheidsdata, dus dit is een blocker voor elke release.
- **Guardrail-evals:** klein script met lastige inputs (gewichtsvragen, calorieën-vragen,
  rode-vlag-signalen, medische vragen) dat de antwoorden toetst aan de zes regels.
  Handmatig gedraaid vóór elke teststap; zelfde rol als Laura's "lastige klant"-test.
- **UI:** pixel-vergelijking met de handoff per scherm; verder handmatig via de testramp
  (Laura → Jeffrey/vriendin → 1–3 betaklanten).

## Fasering

1. **Fundament** — tooling (watchman, Supabase CLI, EAS CLI), monorepo-scaffolding,
   Supabase-project (EU), schema + RLS + seed met de demo-data uit de handoff.
2. **Klant-app, pixel-precies met lokale data** — tokens & fonts, onboarding, tabbar,
   Vandaag, Eten, chat-UI, beide bottom sheets.
3. **Chat end-to-end** — prompt-builder + `lau-reply` + guardrails + realtime;
   voedingslog → AI-reactie; guardrail-evals draaien.
4. **Coach-dashboard** — klantenlijst, klantdetail (meelezen, antwoorden als Laura,
   profiel-editor met versiehistorie, notities, flags), auth voor Laura.
5. **Wekelijks gesprek** — vastleggen, `session-suggest`-voorstelkaarten,
   `prompt-preview`, vastleggen als WeeklySession + nieuwe profielversie.
6. **Testramp-klaar** — invites, ochtendbericht (pg_cron) + push, AVG-export,
   lege/loading/error-states, EAS Build → TestFlight.

Elke fase eindigt met werkende, geteste software; fase 2 is al demo-baar op een telefoon.

## Bewust niet in v1

Betalingen/abonnementen (handmatig factureren), AI-monitort-AI-alerts,
gewicht/stappen/slaap-tracking, productendatabase met voedingswaarden, analytics/heatmaps,
meerdere coaches in de UI (datamodel kan het al), self-service onboarding, contentbibliotheek.

## Open punten & risico's

- **Ontbrekende designs:** loading-, error-, lege staten, offline-gedrag, formulier-
  validatie en de escalatieflow achter "Rode vlag" zijn niet ontworpen. De handoff zegt:
  terugvragen aan de designer, niet improviseren. Tot die er zijn gebruiken we sobere,
  toon-vaste defaults en houden we een lijstje bij voor de designer.
- **Apple Developer-account** is nodig vóór TestFlight (fase 6) — op tijd aanvragen,
  goedkeuring kan dagen duren.
- **Eerste RN-project:** Expo Go dekt alles in fase 2–5; pas bij push-notificaties
  (fase 6) is een EAS development build nodig. Dat risico is bewust naar achteren geschoven.
- **Kosten Claude-calls:** Sonnet per bericht + één ochtendbericht per klant per dag is
  bij 1–10 klanten verwaarloosbaar; herzien bij opschalen.
