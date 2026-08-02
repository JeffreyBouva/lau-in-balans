# Fase 5 — Coach-dashboard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Werkend coach-dashboard (Next.js, `apps/coach`): login, klantenlijst, chat meelezen/antwoorden als Laura, flags afronden, voedingsweek, notities, profiel-editor, invite-beheer.

**Architectuur:** Client-side SPA-stijl (supabase-js, geen SSR-auth). Eén CoachProvider (sessie + coach-gate). Bestaande coach-RLS draagt alles behalve invites; die krijgen een fase-5-migratie (policies + RPC) die als LAATSTE komt omdat `supabase db push` een Jeffrey-stap is.

**Tech stack:** Next.js 16 App Router · Tailwind 4 (`@theme` met brand-tokens) · supabase-js · Newsreader + DM Sans via next/font · Vitest RLS-tests tegen cloud.

**Spec:** `docs/superpowers/specs/2026-08-02-fase-5-coach-dashboard-design.md` (met aannames A1-A12)
**Branch:** `fase-5-coach-dashboard`

**Codebase-weetjes:**
- `apps/coach` is een kale Next.js-scaffold; `apps/coach/src/lib/supabase.ts` bestaat al (check inhoud, verwacht env `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`; `.env.local.example` toont de namen — Jeffrey's echte `.env.local` kan al bestaan; NOOIT `.env*` committen of printen).
- Kleuren uit `packages/shared/src/tokens.ts` (import `@lau/shared` werkt in Next via de workspace + `allowImportingTsExtensions`-vrije re-export `packages/shared/src/index.ts` — check hoe mobile 'm importeert; Next transpileert workspace-TS via `transpilePackages: ['@lau/shared']` in `next.config.ts` — zet dat aan als het er niet staat).
- Login-gegevens demo: `laura@demo.lauinbalans.nl` / `demo-demo-2026`.
- Coach-RLS bestaat al voor alles behalve `invite_codes` (zie spec §Wat er al ligt).
- Realtime-patroon (topic-opruimguard!) uit `apps/mobile/src/lib/hooks/useBerichten.ts` overnemen.
- De klant-app toont `sender:'coach'` als Laura-bubbel; streaming-AI-teksten groeien via UPDATE-events — het dashboard moet UPDATE dus ook verwerken.
- Runtime-verificatie van queries kan met een wegwerp-node-script dat inlogt als Laura (patroon: eerdere `_appcheck.mjs`; script na afloop verwijderen).

---

### Task 1: Fundament — CoachProvider, theme, layout, login

**Files:** Modify `apps/coach/src/lib/supabase.ts` (indien nodig), `apps/coach/src/app/layout.tsx`, `apps/coach/src/app/globals.css`, `apps/coach/next.config.ts`; Create `apps/coach/src/lib/coach.tsx` (provider), `apps/coach/src/app/login/page.tsx`, `apps/coach/src/components/Knop.tsx`.

- [ ] Supabase-client: `createClient(url, anonKey)` uit `NEXT_PUBLIC_*` env, met nette throw als ze ontbreken. `'use client'`-veilig (module-level is ok; alle consumers zijn client components).
- [ ] `next.config.ts`: `transpilePackages: ['@lau/shared']`.
- [ ] `globals.css` (Tailwind 4): `@theme` met de brand-kleuren uit `@lau/shared` als CSS-vars kan niet in @theme vanuit TS — dus de HEX-waarden overnemen mét comment "bron: packages/shared/src/tokens.ts" (cream `#F6F3ED`, surface `#FFFFFF`, ink `#262A24`, body `#5E6259`, muted `#8C8F84`, hairline `#DCD6CA`, sage `#63805F`, sageSoft/sageDeep uit tokens, clay-varianten uit tokens voor flags/Laura). Fonts: Newsreader (serif, koppen) + DM Sans (sans) via `next/font/google` in layout, gekoppeld aan CSS-vars.
- [ ] `coach.tsx` — CoachProvider ('use client'): sessie via `getSession()` + `onAuthStateChange`; bij sessie: `from('coaches').select('id, naam').eq('id', user.id).maybeSingle()`; geen rij → `signOut()` + foutstate "Dit account is geen coach-account."; exposes `{ coach, laden, login(email, ww), logout }`. Gate-component redirect (usePathname/useRouter): geen sessie of geen coach → `/login`; wel coach op `/login` → `/`.
- [ ] `/login`: merk ("Lau in Balans — coach"), e-mail + wachtwoord, foutmelding, submit → `login()`. Sober, brand-styling, NL. `<button>`/`<input>` native (web!) — geen RN-patronen.
- [ ] Layout: html lang="nl", fonts, provider + gate om children, cream-achtergrond.
- [ ] Verify: `npm run typecheck -w apps/coach` → 0; `npm run build -w apps/coach` → succes. Runtime-rooktest met wegwerp-script (login Laura → coaches-rij zichtbaar) mag via supabase-js buiten Next om.
- [ ] Commit: `feat(coach): fundament — provider met coach-gate, brand-theme, login`

### Task 2: Klantenlijst (/)

**Files:** Modify `apps/coach/src/app/page.tsx`; Create `apps/coach/src/lib/hooks/useKlanten.ts`.

- [ ] `useKlanten`: haalt eigen klanten (`from('clients').select('id, naam, status, startdatum')` — RLS filtert), en per klant (A11, 6 klanten): laatste bericht (`messages` select `created_at, sender, tekst` order desc limit 1) en open-flag-count (`flags` select id, status eq open). `Promise.all` per klant. Refresh bij window-focus (`visibilitychange`).
- [ ] Page: tabel/kaartenlijst — naam (serif), status-chip, "Week N" (via `weekNummer(startdatum, vandaagISO())` uit `@lau/shared`), laatste bericht (relatieve tijd + afzender-prefix "Lau:"/"Laura:"/niets), clay-badge met open-flag-aantal. Rij klikbaar → `/klant/[id]`. Lege staat: "Nog geen klanten."
- [ ] Verify: typecheck + build; wegwerp-script bevestigt dat Laura 6 klanten + hun laatste berichten kan lezen.
- [ ] Commit: `feat(coach): klantenlijst met week, laatste bericht en flag-badge`

### Task 3: Klantdetail — chat meelezen + antwoorden als Laura

**Files:** Create `apps/coach/src/app/klant/[id]/page.tsx`, `apps/coach/src/lib/hooks/useKlantChat.ts`, `apps/coach/src/components/ChatBubbel.tsx`.

- [ ] `useKlantChat(clientId)`: initial fetch messages (volledig, chronologisch), realtime-kanaal `dash-messages:${clientId}` op INSERT én UPDATE (filter client_id), dedup op id, UPDATE vervangt tekst (streaming groeit live). Topic-opruimguard zoals `useBerichten`. `verstuurAlsCoach(tekst)`: insert `{ client_id, sender: 'coach', tekst }` + optimistisch tonen.
- [ ] `ChatBubbel`: sender-varianten — client (rechts, sage-soft), ai (links, wit + hairline), coach/Laura (links, clay-tinten, "Laura"-label). Voedingslog-berichten (food_log_id) compact als "📋 voedingslog" — detail hoeft niet in v1.
- [ ] Page: header (klantnaam, status, week, terug-link), chatkolom met autoscroll naar onder, composer "Antwoord als Laura…" + verzendknop (disabled bij leeg/bezig).
- [ ] Verify: typecheck + build; wegwerp-script: als Laura een coach-bericht inserten bij Sanne → verschijnt in messages (daarna testbericht verwijderen via service-key).
- [ ] Commit: `feat(coach): klantdetail — chat meelezen, realtime, antwoorden als Laura`

### Task 4: Klantdetail — flags, voedingsweek, notities (zijbalk)

**Files:** Modify `apps/coach/src/app/klant/[id]/page.tsx`; Create `apps/coach/src/lib/hooks/useKlantContext.ts`, `apps/coach/src/components/FlagKaart.tsx`, `apps/coach/src/components/VoedingsWeek.tsx`, `apps/coach/src/components/Notities.tsx`.

- [ ] `useKlantContext(clientId)`: open flags (+ realtime op flags van deze klant), food_logs laatste 7 dagen → aggregatie per handmaat (zelfde reken-helpers als de app: `dagStand`/`weekTotalen` zitten in mobile — NIET importeren uit mobile; kleine lokale reduce is prima), coach_notes (order datum desc) + `voegNotitieToe(tekst)`.
- [ ] `FlagKaart`: clay-styling, tekst + redenen-chips + datum, knop "Afronden" → update `{ status:'resolved', resolved_by: coachId, resolved_at: new Date().toISOString() }` (policy eist exact deze velden). Na afronden verdwijnt 'ie uit de open-lijst.
- [ ] `VoedingsWeek`: 7 kolommen (dagletters) met totaal-gelogde handmaten per dag + week-gemiddelden per handmaat t.o.v. dagdoelen uit de HOOGSTE profielversie (`ai_profile_versions` select profiel order versie desc limit 1 → `profiel.portiedoelen`).
- [ ] `Notities`: lijst (datum + tekst) + textarea + opslaan.
- [ ] Verify: typecheck + build; wegwerp-script: flag afronden als Laura werkt (en terugdraaien via service-key zodat de demo-flag open blijft).
- [ ] Commit: `feat(coach): flags afronden, voedingsweek en notities in klantdetail`

### Task 5: Profiel-editor + versiehistorie

**Files:** Create `apps/coach/src/app/klant/[id]/profiel/page.tsx`, `apps/coach/src/lib/hooks/useProfielVersies.ts`.

- [ ] `useProfielVersies(clientId)`: alle versies (versie, created_at, author, profiel) order desc; `slaOp(profiel)` → insert `{ client_id, versie: hoogste+1, author: coachId, profiel }`.
- [ ] Page: formulier op basis van het `AIProfile`-type uit `@lau/shared` (A7): tekstvelden/chips voor doelen, knelpunten, voorkeuren, beperkingen, checkinRitme (arrays: comma/enter-gescheiden tag-invoer of simpele textarea-per-regel — kies simpel), numeriek ×4 voor portiedoelen, selects/tekst voor aanpak, toon, veiligheidsvlag, textarea vermijdenInCoaching (label "BINDEND voor Lau"). Onder het formulier: versiehistorie-lijst (v3 · 2 aug · Laura). Opslaan → nieuwe versie + bevestiging.
- [ ] Let op de unieke constraint (client_id, versie): bij een race gewoon de fout tonen ("Er is net een nieuwe versie opgeslagen — herlaad.").
- [ ] Verify: typecheck + build; wegwerp-script: versie n+1 schrijven als Laura lukt (daarna verwijderen via service-key zodat demo-stand intact blijft — mag: append-only geldt de app, service-role kan corrigeren).
- [ ] Commit: `feat(coach): profiel-editor met versiehistorie`

### Task 6: Migratie fase5_dashboard + RLS-tests + /invites

**Files:** Create `supabase/migrations/20260802210000_fase5_dashboard.sql` (exact de SQL uit de spec §1), `tests/rls/fase5.test.ts`, `apps/coach/src/app/invites/page.tsx`, `apps/coach/src/lib/hooks/useInvites.ts`.

- [ ] Migratie schrijven (spec §1 letterlijk; zelfde hardening-conventies).
- [ ] **NIET `supabase db push` draaien** — Jeffrey-stap. De UI en tests worden gebouwd; de tests draaien pas na de push (documenteer dat in de testfile-kop en rapporteer het).
- [ ] `tests/rls/fase5.test.ts` (conventies van fase4.test.ts, eigen wegwerp-coach + -klant): coach ziet alleen eigen codes; andere coach ziet ze niet; coach verwijdert eigen ongebruikte code; gebruikte code verwijderen → 0 rijen geraakt; klant kan `maak_eigen_invite_code` niet (error/geen data); coach kan het wel en de code voldoet aan het formaat.
- [ ] `useInvites`: lijst eigen codes (code, created_at, used_by → naam via aparte clients-query, used_at), `maakCode()` (RPC `maak_eigen_invite_code`), `trekIn(id)` (delete). Foutpaden netjes (RPC bestaat pas na push: toon "Nog niet beschikbaar — migratie moet nog gepusht" bij een RPC-error met function-not-found).
- [ ] `/invites`-page: tabel + "Nieuwe code"-knop (toont de verse code groot, met kopieer-knop) + intrekken bij ongebruikt. Link in de app-header/nav (nav: Klanten · Invites · Uitloggen).
- [ ] Verify: typecheck + build. RLS-tests: `npx vitest run tests/rls/fase5.test.ts` — verwacht FALEN zolang de migratie niet gepusht is; draai ze één keer en rapporteer de uitkomst eerlijk (gefaald-op-ontbrekende-objecten = verwacht).
- [ ] Commit: `feat(coach): invite-beheer + fase5-migratie + RLS-tests (push pending)`

### Task 7: Eindverificatie + navigatie-polish

- [ ] Gedeelde nav in layout (alleen ingelogd): Klanten · Invites · rechts "Laura · Uitloggen".
- [ ] Volledige batterij: `npm run typecheck -w apps/coach` → 0 · `npm run build -w apps/coach` → succes · `npm run test:rls` → oude 25 groen (fase5-tests apart, push pending) · `npm run typecheck -w apps/mobile` → 0 (niets gebroken).
- [ ] Jeffrey-stappen documenteren: (1) `supabase db push` (fase 5-migratie), (2) daarna `npx vitest run tests/rls/fase5.test.ts` (of ik draai 'm), (3) dashboard lokaal: `npm run dev -w apps/coach` → localhost:3000, login laura@demo / demo-demo-2026, (4) `apps/coach/.env.local` met NEXT_PUBLIC-vars indien nog niet aanwezig.
- [ ] Commit: `chore(coach): nav + fase 5 eindverificatie`

## Self-review

Spec-dekking: migratie+RPC (T6), login/gate (T1), klantenlijst (T2), chat+realtime+antwoorden (T3), flags/week/notities (T4), profiel-editor (T5), invites (T6), styling/fonts (T1), tests (T6/T7). Aannames A1-A12 gerespecteerd. Push-afhankelijkheid expliciet gemaakt (T6-volgorde + eerlijke test-rapportage).

## Jeffrey-stappen (na de bouw)

Stand na Task 7: `npm run typecheck -w apps/coach` 0 · `npm run build -w apps/coach` succes · `npm run lint -w apps/coach` schoon · `npm run typecheck -w apps/mobile` 0 · `npm test` 30 groen · `npm run test:rls` 31 groen + 3 rood — die drie zijn allemaal `tests/rls/fase5.test.ts` en vallen om op de nog niet gepushte migratie (`maak_eigen_invite_code` staat niet in de schema-cache). Stap 1 en 2 hieronder maken ze groen.

1. **Migratie pushen** — `supabase db push` zet `supabase/migrations/20260802210000_fase5_dashboard.sql` op de gehoste database (geen lokale Docker-stack).
2. **RLS-tests fase 5** — `npx vitest run tests/rls/fase5.test.ts` → 8/8 groen verwacht. Daarna is `npm run test:rls` in z'n geheel groen (34).
3. **Dashboard lokaal** — `npm run dev -w apps/coach` → <http://localhost:3000>. Inloggen met `laura@demo.lauinbalans.nl` / `demo-demo-2026`. `apps/coach/.env.local` bestaat al (NEXT_PUBLIC-vars staan erin), dus er hoeft niets te worden aangemaakt.
4. **Flow doorlopen** (de visuele check die ik niet kan doen):
   - klant openen vanuit de lijst;
   - **als Laura antwoorden in de chat — en dat antwoord ook in de klant-app terugzien**, dat is de kern van fase 5;
   - een flag afronden (verdwijnt uit "open", teller op de klantenlijst zakt);
   - profiel bewerken en opslaan → nieuwe versie verschijnt in de versiehistorie;
   - `/invites`: code maken, kopiëren, en een ongebruikte code weer intrekken.
5. **PR's openen** — beide branches staan nog lokaal voor; eerst `git push -u origin fase-4-toegang-accounts` en `git push -u origin fase-5-coach-dashboard`, dan:
   - fase 4: <https://github.com/JeffreyBouva/lau-in-balans/compare/main...fase-4-toegang-accounts>
   - fase 5 (staat bovenop fase 4): <https://github.com/JeffreyBouva/lau-in-balans/compare/fase-4-toegang-accounts...fase-5-coach-dashboard> — is fase 4 al in `main` gemerged, gebruik dan <https://github.com/JeffreyBouva/lau-in-balans/compare/main...fase-5-coach-dashboard>
