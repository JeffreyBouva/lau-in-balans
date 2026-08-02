# Fase 6 — Profiel & tutorials — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Profielscherm met bewerkbare eigen gegevens/doelen (nieuwe profielversie), eerste-keer-tutorials op de drie tabs, landing op Vandaag.

**Architectuur:** Twee RPC's houden coach-velden server-side onbereikbaar (subset-lezen + merge-schrijven, author null, append-only). App: losse profiel-route + Tutorial-overlay met AsyncStorage-vlaggen. Migratie-push blijft een Jeffrey-stap (zelfde als fase 5) — tests worden geschreven en falen eerlijk tot de push.

**Spec:** `docs/superpowers/specs/2026-08-02-fase-6-profiel-tutorials-design.md` (aannames B1-B3, C1-C4)
**Branch:** `fase-6-profiel-tutorials`

**Codebase-weetjes:**
- Migratie-conventies: `supabase/migrations/20260802210000_fase5_dashboard.sql` (definer, search_path='', grants). Test-conventies: `tests/rls/fase5.test.ts` (wegwerp-fixtures, stil()-cleanup, header-comment "vereist push").
- Onboarding-chips/patronen: `apps/mobile/src/app/(onboarding)/index.tsx` (chipGroep, naarProfiel) en `apps/mobile/src/state/onboarding.ts`. AIProfile-type: `packages/shared/src/types.ts`.
- Bestaand hergebruik: `CodeSheet`, `Sheet`, `PrimaireKnop`, `Chip`, `HandmaatStepper`-patroon, `useOpSlot`, `useSessie` (tier, logout), haptics-helpers.
- De klant mag `ai_profile_versions` NIET direct lezen (coach-only RLS) — vandaar de RPC's.
- Routing: root-Stack in `src/app/_layout.tsx`; gate stuurt `/(tabs)/chat` als default — wordt vandaag (B3). Onboarding-einde (`(onboarding)/index.tsx` voltooi()) replace't naar chat — wordt vandaag.
- Eten leest doelen via `usePortiedoelen` (RPC `mijn_portiedoelen`) — nieuwe versie werkt daar automatisch in door; wel na opslaan een herlaad triggeren of bij focus verversen (check hoe usePortiedoelen laadt).

---

### Task 1: Migratie `fase6_profiel` + RLS-tests

**Files:** Create `supabase/migrations/20260802230000_fase6_profiel.sql`, `tests/rls/fase6.test.ts`.

- [ ] Migratie: `mijn_profiel()` returns jsonb — hoogste versie van auth.uid(); bouw het resultaat expliciet op met `jsonb_build_object('versie', versie, 'doelen', profiel->'doelen', 'portiedoelen', profiel->'portiedoelen', 'knelpunten', profiel->'knelpunten', 'voorkeuren', profiel->'voorkeuren', 'beperkingen', profiel->'beperkingen', 'checkinRitme', profiel->'checkinRitme')` (whitelist — coach-velden kunnen structureel niet lekken). Geen profiel → null. Grant authenticated, revoke anon/public.
- [ ] `werk_mijn_profiel_bij(p_wijziging jsonb)` returns int: lock eigen hoogste versie-rij-bepaling (advisory of gewoon retry), merge = `bestaand.profiel || jsonb_strip_alleen_toegestane_keys(p_wijziging)` — implementeer de whitelist expliciet (loop over de zes toegestane keys, alleen overnemen als aanwezig en van het juiste jsonb-type; portiedoelen: object met vier integer-waarden 0..12 — valideer met een check, anders exception 'ongeldige portiedoelen'). Insert versie n+1 author null; unique_violation → één retry met opnieuw gelezen hoogste versie, daarna exception. Geen bestaand profiel → exception 'geen profiel' (onboarding hoort eerst).
- [ ] NIET pushen (Jeffrey-stap). Tests schrijven per fase5-conventie: subset lekt geen coach-velden (schrijf eerst via service een versie mét coach-velden, lees als klant via RPC → alleen de zes keys + versie); bijwerken → versie n+1, author null, coach-velden identiek aan vorige versie; coach-veld in p_wijziging wordt genegeerd; portiedoelen buiten 0..12 → error; anon → error; klant zonder profiel → mijn_profiel null / bijwerken error. Run: verwacht falend op ontbrekende functies — rapporteer exact.
- [ ] Commit: `feat(db): fase 6 — mijn_profiel + werk_mijn_profiel_bij (klant-subset, merge-schrijven) + RLS-tests (push pending)`

### Task 2: Profielscherm + landing naar Vandaag

**Files:** Create `apps/mobile/src/app/profiel.tsx`, `apps/mobile/src/lib/hooks/useMijnProfiel.ts`; Modify `apps/mobile/src/app/(tabs)/vandaag.tsx` (icoon in header), `apps/mobile/src/app/_layout.tsx` (gate-default naar vandaag), `apps/mobile/src/app/(onboarding)/index.tsx` (voltooi → vandaag).

- [ ] `useMijnProfiel`: laad via RPC `mijn_profiel` (sessie-gated zoals andere hooks; fout-state; herlaad); `slaOp(wijziging)` via RPC `werk_mijn_profiel_bij` (fout niet stil; bezig-state). Types: klant-subset-type lokaal afleiden van AIProfile (Pick).
- [ ] `profiel.tsx`: header met terug-knop (router.back) + titel "Profiel" (serif). Kaarten: Account (naam uit clients-query, e-mail uit session.user.email, tier-badge via useSessie.tier, bij free "Ik heb een code"-knop → CodeSheet, Uitloggen-knop → logout + router.replace('/(auth)/welkom')); Mijn gegevens (chip-multi-selects met de optielijsten uit de onboarding — hergebruik de constanten; staan die inline in (onboarding)/index.tsx, verplaats ze dan naar `apps/mobile/src/state/onboarding.ts` zodat beide schermen één bron hebben); Mijn portiedoelen (vier steppers 0..12, HandmaatStepper hergebruiken met doel-loze weergave of een simpele eigen stepper); Opslaan (PrimaireKnop, succes-melding); "Uitleg opnieuw bekijken" (reset tutorialvlaggen — API uit Task 3, bouw hier alvast de knop met een callback-stub als Task 3 later komt — NEE: Task 3 eerst de vlaggen-module laten maken kan niet, houd het simpel: importeer `resetTutorials()` uit `@/lib/tutorials` die Task 3 aanmaakt; bouw Task 2 en 3 in deze volgorde: eerst Task 3's vlaggen-module (klein), dan is de import er) — zie Task 3, de module `lib/tutorials.ts` wordt DAAR gemaakt; spreek af: Task 2 importeert 'm, dus Task 3-stap 1 (alleen de module) mag door de Task 2-agent alvast aangemaakt worden als die eerder loopt. Kies bij twijfel: maak `lib/tutorials.ts` in Task 2 (vlaggen + reset) en laat Task 3 de overlay bouwen.
- [ ] Vandaag-header: `person-circle-outline`-icoon (Pressable, role button, haptic tik) naast LauraKnop → router.push('/profiel').
- [ ] Gate + onboarding: `/(tabs)/chat` → `/(tabs)/vandaag` op beide plekken (B3).
- [ ] Verify: typecheck 0, web-export OK; runtime-check RPC's kan pas na push — bouw fail-safe (fout-state "Profiel laden lukte niet" bij ontbrekende functie, geen crash).
- [ ] Commit: `feat(mobile): profielscherm — eigen gegevens en doelen bewerken, uitloggen, landing op Vandaag`

### Task 3: Tutorials

**Files:** Create `apps/mobile/src/lib/tutorials.ts` (als Task 2 'm nog niet maakte), `apps/mobile/src/components/Tutorial.tsx`; Modify de drie tab-schermen.

- [ ] `lib/tutorials.ts`: `isGezien(scherm): Promise<boolean>` / `markeerGezien(scherm)` / `resetTutorials()` op AsyncStorage-keys `tutorial:vandaag|chat|eten`.
- [ ] `Tutorial.tsx`: props `{ scherm, stappen: { titel, tekst }[] }` — toont zichzelf eenmalig (isGezien-check in effect), overlay met scrim (bestaande kleuren), kaart onderaan (safe-area) met stap-titel (serif), tekst, voortgangs-dots, knoppen "Volgende"/"Klaar" + "Overslaan" (allemaal role button, haptic tik). Bij klaar/overslaan → markeerGezien. Fade-in (Animated, patroon uit Sheet).
- [ ] Integratie: Vandaag (3 stappen), Chat (3 stappen — alleen renderen als NIET op slot; bij `useOpSlot().opSlot` géén tutorial), Eten (3 stappen). Stappenteksten NL, warm, kort — schrijf ze conform de spec §3.
- [ ] Dashboard-label (C4): in `apps/coach/src/lib/hooks/useProfielVersies.ts` het author-null-label van 'onboarding' naar 'klant/onboarding'.
- [ ] Verify: typecheck mobile + coach 0, web-export OK, coach-build OK.
- [ ] Commit: `feat(mobile): eerste-keer-tutorials op de drie tabs + herafspelen vanuit profiel`

### Task 4: Eindverificatie

- [ ] Volledige batterij: mobile typecheck 0 · coach typecheck/build/lint 0 · `npm test` 30 groen · `npm run test:rls` → 31 groen + verwachte fase5/fase6-failures exact benoemd.
- [ ] Jeffrey-stappen onderaan dit plan: (1) `supabase db push` (fase 5 + 6 migraties samen), (2) fase5- en fase6-tests draaien (8/8 en alles groen verwacht), (3) app-flow: onboarding → landt op Vandaag → tutorials → profiel openen → doelen aanpassen → check in Eten én in het dashboard (nieuwe versie zichtbaar), (4) PR-links.
- [ ] Commit: `chore: fase 6 eindverificatie + Jeffrey-stappen`

## Self-review

Spec-dekking: RPC's+tests (T1), profielscherm+landing (T2), tutorials+C4-label (T3), verificatie (T4). Aannames B1-B3/C1-C4 verwerkt. Push-afhankelijkheid expliciet; fail-safe UI bij ontbrekende RPC's.
