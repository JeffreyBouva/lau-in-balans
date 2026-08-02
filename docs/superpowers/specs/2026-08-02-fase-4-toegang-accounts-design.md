# Fase 4 — Toegang & accounts (design)

**Datum:** 2026-08-02 · **Status:** goedgekeurd door Jeffrey
**Context:** de app pivoteert van "alleen voor Laura's klanten" naar een publieke
App Store-app met twee niveaus: **free** (voeding loggen) en **coached** (alles, via
een 6-teken code van Laura). Dit is fase 4 van de v1.1-fasering
(4 toegang · 5 dashboard · 6 onboarding/profiel · 7 AI-limieten/proactief · 8 lancering).

## Doel

Een nieuwe gebruiker kan de app downloaden, een account maken (Apple/Google/e-mail),
optioneel een code van Laura verzilveren, de onboarding doorlopen en landen in een
app die per tier het juiste toont. Enforcement zit server-side, niet alleen in de UI.

## Flow (nieuwe gebruiker)

```text
splash → welkom → registreren/inloggen → codescherm → onboarding → app
```

1. **Splash** — bestaand expo-splash-screen; tijdelijk typografisch woordmerk
   ("Lau in Balans", Newsreader-serif op brand-cream #F6F3ED). Geen logo-werk in deze fase.
2. **Welkomscherm** (`(auth)/welkom`) — hero-zin + drie korte punten
   (voeding loggen is gratis · Lau.ai AI-coach · samen met coach Laura), knoppen
   **Registreren** en **Inloggen**. Dit is het eerste scherm zonder sessie.
3. **Registreren** (`(auth)/registreer`) — knoppen *Doorgaan met Apple* (achter
   config-vlag, zie Auth), *Doorgaan met Google*, en e-mail + wachtwoord.
   **Inloggen** (`(auth)/login`, bestaat) krijgt dezelfde social-knoppen.
4. **Codescherm** (`(auth)/code`) — "Ben je klant bij Laura?" met een 6-vaks
   code-invoer en **Overslaan**. Geldige code → tier wordt coached. Ongeldig →
   nette foutmelding, blijven op het scherm.
5. **Onboarding** (bestaat) — verplicht voor iedereen; de antwoorden worden
   **profielversie 1** (gebeurt al). Laura's schema na de eerste wekelijkse call
   wordt gewoon versie 2+ — geen wijziging nodig.
6. **App** — free: Eten open, rest zichtbaar-op-slot; coached: alles zoals nu.

Bestaande gebruiker met sessie: splash → app (bestaande gate blijft).
Code later ontvangen: invoeren kan vanaf elke slot-staat (CodeSheet); in fase 6 ook
via het profielscherm.

## Tiers — wat een free gebruiker ziet

| Plek | Free |
| --- | --- |
| Eten-tab | Volledig open (het gratis product) |
| Vandaag: eten-gemiddelden | Open (eigen logdata) |
| Vandaag: contactdagen, werkpunten, afspraak | SlotKaart per blok |
| Lau.ai-tab | Eén verzorgd slot-scherm (uitleg + "Ik heb een code") |
| Laura-knop | Opent mini-uitleg + code-invoer i.p.v. de flag-sheet |

**SlotKaart** is één herbruikbaar component: icoon, één zin wat het is, één zin
"hoort bij een coachingtraject van Laura", knop *Ik heb een code* → CodeSheet.
Warm en eerlijk. **Nooit prijzen, links of koop-taal** (App Store 3.1.3 —
echte-wereld-dienst, bijkopen loopt buiten de app om via Laura).

**Review-strategie:** geen gedragswissel richting Apple-review (verboden, 2.3.1).
De officiële route: demo-reviewaccount mét coached-code in de review-notes (fase 8).
De remote config is een ops-knop (copy/gedrag bijsturen, kill-switch), geen
reviewer-detectie.

## Datamodel (migratie `fase4_toegang`)

```sql
-- 1. Tier + coach optioneel
alter table public.clients add column tier text not null default 'free'
  check (tier in ('free','coached'));
alter table public.clients alter column coach_id drop not null;
update public.clients set tier = 'coached';  -- bestaande (demo)klanten zijn coached

-- 2. Invite-codes: kaal, eenmalig, geen vervaldatum in v1
create table public.invite_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,             -- 6 tekens, alfabet zonder O/0/I/1
  coach_id uuid not null references public.coaches (id),
  created_at timestamptz not null default now(),
  used_by uuid references public.clients (id),
  used_at timestamptz
);

-- 3. Remote config (key/value, door iedereen te lezen, door niemand te schrijven via API)
create table public.app_config (
  key text primary key,
  value jsonb not null
);
insert into public.app_config (key, value) values
  ('sloten_actief', 'true'),         -- slot-staten tonen voor free (ops-knop)
  ('apple_login_actief', 'false');   -- Apple-knop pas aan zodra het Dev-account er is
```

- **Registratie-trigger** `handle_new_user` op `auth.users` (security definer,
  `search_path` gehardend zoals `is_coach_of`): maakt een `clients`-rij aan
  (tier `free`, `coach_id` null, `naam` uit user-metadata of e-mail-prefix).
  Bestaat de rij al (seed-users), dan niets doen.
- **RPC `verzilver_code(p_code text)`** (security definer, gehardend):
  hoofdletterongevoelig; atomair (`update … where used_by is null returning`) zodat
  dubbel verzilveren onmogelijk is; zet `tier='coached'` + `coach_id` van de
  code-uitgever; geeft `true`/`false` terug (geen error-lek over welke codes bestaan).
  Al-coached klant die een code invoert: code wordt verbruikt, no-op verder — of
  netter: weiger met `false` als de klant al coached is (kies dit; code blijft bruikbaar).
- **RLS:** `invite_codes` — geen enkel select/insert/update-beleid voor `authenticated`
  (alles via de RPC en straks het dashboard met coach-RLS); `app_config` — select
  voor `anon` + `authenticated`, geen writes.
- **Codes aanmaken** zolang het dashboard er niet is: SQL in de Supabase-editor
  (gedocumenteerd in het plan), code-generatie in SQL (6 tekens uit
  `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`).

## Server-side enforcement

`lau-reply` weigert free-tier: na de JWT-check haalt de functie de client-rij op
(zit al in de parallelle context-load — profiel-query wordt uitgebreid met een
tier-check) en geeft **403 `coached vereist`** terug vóór er ook maar één
Claude-call gebeurt. De slot-UI is dus geen papieren slot.

## Auth

- **E-mail/wachtwoord:** bestaat (login); registreren erbij (`signUp`), zonder
  e-mailbevestiging-flow in deze fase (Supabase-default aan laten of uit — uit,
  om frictie te vermijden; heroverwegen richting lancering).
- **Google:** `signInWithOAuth({ provider: 'google' })` met redirect; werkt in de
  web-preview direct, op native via het bestaande scheme (`mobile://`) + WebBrowser.
  Google Cloud-consent-scherm + client-id's zet Jeffrey aan (stappen in het plan).
- **Apple:** knop + flow worden gebouwd maar staan achter `apple_login_actief=false`,
  want Sign in with Apple vereist het betaalde Apple Developer-account (Services ID),
  ook voor web. Verplichting geldt pas bij App Store-release (fase 8). Zodra het
  account er is: provider configureren + vlag om.
- **Sessie-context** (`sessie.tsx`) breidt uit met `tier` (uit `clients`) en
  `herlaadTier()` (na verzilveren). Routing-gate: geen sessie → welkom; sessie
  zonder profiel → onboarding; sessie mét profiel → app. Het codescherm is géén
  gate — het zit alleen in de verse registratie-flow (na `signUp`, vóór onboarding)
  en is met *Overslaan* passeerbaar. Wie later een code krijgt, gebruikt de
  CodeSheet vanaf een slot-staat.

## Componenten (nieuw)

- `(auth)/welkom.tsx`, `(auth)/registreer.tsx`, `(auth)/code.tsx`; `login.tsx` update.
- `components/SlotKaart.tsx` (kaart- en schermvariant), `components/CodeSheet.tsx`
  (bottom-sheet met dezelfde 6-vaks invoer, hergebruikt de bestaande `Sheet`).
- `components/CodeInvoer.tsx` (6 vakken, auto-advance, plakbaar).
- `lib/hooks/useConfig.ts` (app_config lezen, defaults bij offline).
- `lib/hooks/useTier.ts` of tier in SessieProvider (kies SessieProvider — één bron).

## Testen

- **RLS/RPC-tests** (bestaande testopzet tegen cloud): verzilveren van een geldige
  code; tweede keer verzilveren faalt; andermans/onzin-code faalt stil (`false`);
  al-coached klant → `false`; free-tier ziet `invite_codes` niet.
- **Unit:** code-alfabet/formaat-helper (shared), tier-afleiding in de app.
- **Integratie:** `lau-reply` met free-account → 403 (deno-test of handmatig).
- **Handmatig (web preview):** volledige registratie→code→onboarding→app-flow,
  beide tiers, code verzilveren vanaf een slot-staat.

## Buiten scope (bewust)

Tutorials en profielscherm (fase 6) · metering/afkap (fase 7) · push (fase 8) ·
Microsoft/Meta-login (later bij vraag) · invite-beheer-UI (fase 5) · e-mail-
verificatie en wachtwoord-reset-flows (richting lancering) · logo/branding.

## Risico's & afhankelijkheden

- **Apple-login** wacht op het Apple Developer-account — bewust achter een vlag.
- **Google OAuth-config** (Cloud-project, client-id's) is een Jeffrey-stap; zonder
  die config werkt de Google-knop nog niet maar blokkeert niets anders.
- **Trigger op auth.users** raakt alle nieuwe registraties — de RLS-testsuite moet
  groen blijven voor bestaande flows (seed-users hebben al een clients-rij).
