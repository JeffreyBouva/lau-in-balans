# Fase 7 — AI-limieten & proactieve Lau — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gemeten en begrensd Lau-gebruik (429-afkap + dashboard-quota-beheer), dagelijks proactief ochtendbericht, modelkeuze via env.

**Architectuur:** `ai_usage`-eventtabel + limiet (per-klant override, config-default); check + telling in `lau-reply` vóór de Claude-call; nieuwe `lau-ochtend`-function achter een cron-secret; dashboard-increment op de bestaande klantdetail-zijbalk. Migratie-push en deploys blijven Jeffrey-stappen.

**Spec:** `docs/superpowers/specs/2026-08-03-fase-7-ai-limieten-design.md` (aannames D1-D7)
**Branch:** `fase-7-ai-limieten`

**Codebase-weetjes:**
- Migratie-conventies: fase 5/6-migraties (definer, search_path='', grants, guard-trigger-inventaris). `werk_mijn_profiel_bij` staat in `20260802230000_fase6_profiel.sql` — M5-hardening = create or replace mét behoud van bestaand gedrag + de nieuwe guards.
- `lau-reply`: parallelle context-load (Promise.all van 4) + streaming; `finaal.usage` bevat input/output_tokens; cors-helper; 403/503-patronen. NOOIT de streaming-flow herstructureren.
- Tests: `tests/rls/fase7.test.ts` per fase 6-conventie (header "vereist push", wegwerp-fixtures, eindstaat-asserts, administratie vóór asserts).
- App: `useBerichten.verstuur` → invoke; FunctionsHttpError van supabase-js bevat `context.status` (check de geïnstalleerde versie!). Chat rendert `berichten` + suggesties; een lokale systeemregel kan als state in de hook + rendertak in chat.tsx (patroon TypIndicator).
- Dashboard: `useKlantContext` (4 parallelle queries) + zijbalk in `klant/[id]/page.tsx`; mutatie-patronen met rijen-geraakt-check; `coach_wijzigt_klanten`-policy dekt de limiet-update al.
- Tijdzone: kalenderdag/maand ALTIJD Europe/Amsterdam (patroon: hardening I8, `naarISODatum`).

---

### Task 1: Migratie `fase7_limieten` + RLS-tests

**Files:** Create `supabase/migrations/20260803090000_fase7_limieten.sql`, `tests/rls/fase7.test.ts`.

- [ ] Migratie, in deze volgorde: (1) `ai_usage`-tabel + index + RLS (coach-select via is_coach_of; verder niets); (2) `alter table clients add column ai_limiet int` + check (null of > 0); (3) `insert into app_config values ('ai_maandlimiet', '300'::jsonb), ('ochtendbericht_actief', 'true'::jsonb)`; (4) `alter table messages add column proactief boolean not null default false`; (5) RPC `ai_gebruik_deze_maand(p_client uuid) returns int` — definer, `if not public.is_coach_of(p_client) then raise; end if;` daarna count op ai_usage waar `created_at >= date_trunc('month', now() at time zone 'Europe/Amsterdam')` (let op: vergelijk in dezelfde tijdzone — `(created_at at time zone 'Europe/Amsterdam') >= date_trunc('month', now() at time zone 'Europe/Amsterdam')`); grant authenticated. (6) A12: drop + recreate `klant_maakt_flag` met de bestaande voorwaarden ÉN `exists (select 1 from public.clients c where c.id = auth.uid() and c.tier = 'coached')`. (7) M5: create or replace `werk_mijn_profiel_bij` — bestaande body + ná de merge: `if v_nieuw = v_profiel then return v_versie; end if;` en in de lijst-validatie: max 20 elementen (`jsonb_array_length`), elk element max 200 tekens — anders exception 'te veel of te lange items'.
- [ ] Tests (push pending, header): ai_usage — coach leest eigen klant-rijen (service seedt er twee), andere coach/klant/anon → 0 of error; RPC weigert niet-eigen klant; flags — free-klant kan geen flag meer maken (coached wel; free-fixture via een niet-verzilverde wegwerp-klant); profiel — identieke wijziging geeft hetzelfde versienummer terug zonder nieuwe rij; 21 items of een item van 300 tekens → error. Draai éénmaal, rapporteer de verwachte failures exact; `npm run test:rls` — bestaande suites moeten groen blijven (fase 6-failures verdwijnen zodra Jeffrey pusht; meld de actuele stand).
- [ ] Commit: `feat(db): fase 7 — ai_usage, limieten, proactief-vlag, flags-tier-check, profiel-caps (push pending)`

### Task 2: `lau-reply` — limiet-check, metering, model-env

**Files:** Modify `supabase/functions/lau-reply/index.ts`.

- [ ] Model-config bovenaan: `const MODEL = Deno.env.get('LAU_MODEL') ?? 'claude-sonnet-5';` en `const SUGGESTIE_MODEL = Deno.env.get('LAU_SUGGESTIE_MODEL') ?? 'claude-haiku-4-5';` — gebruik ze op de twee create/stream-plekken.
- [ ] Limiet-check: breid de bestaande Promise.all uit met (a) `db.from('ai_usage').select('id', { count: 'exact', head: true }).eq('client_id', clientId).gte('created_at', <maandstart Europe/Amsterdam als ISO>)` en (b) `db.from('app_config').select('value').eq('key', 'ai_maandlimiet').maybeSingle()`; de tier-query selecteert voortaan `tier, ai_limiet`. Ná de 403-check: `const limiet = klant.ai_limiet ?? Number(configRes.data?.value ?? 300); if ((usageRes.count ?? 0) >= limiet) return new Response('limiet bereikt', { status: 429, headers: cors });` Maandstart in Deno: bereken de Amsterdamse maandstart (Intl/`toLocaleString('sv-SE', { timeZone: 'Europe/Amsterdam' })`-patroon) — schrijf een klein helpertje met comment.
- [ ] Metering: ná de slotschrijf van het antwoord (en vóór de suggesties): `await db.from('ai_usage').insert({ client_id: clientId, model: MODEL, input_tokens: finaal?.usage?.input_tokens ?? 0, output_tokens: finaal?.usage?.output_tokens ?? 0 });` — LET OP: `finaal` bestaat alleen in de try; til de usage-waarden in variabelen die de catch overleven (0/0 bij een hik — het antwoord telt dan alsnog als 1 bericht). Best-effort: een insert-fout mag het antwoord niet breken (catch + console.warn).
- [ ] `deno check` schoon; `git checkout -- deno.lock`. Commit: `feat(lau-reply): maandlimiet-check (429), ai_usage-metering, model uit env`

### Task 3: `lau-ochtend` edge function

**Files:** Create `supabase/functions/lau-ochtend/index.ts`; Modify `supabase/config.toml` (`[functions.lau-ochtend] verify_jwt = false`).

- [ ] Function: (1) check `req.headers.get('x-cron-secret') === Deno.env.get('CRON_SECRET')` anders 401; (2) killswitch `app_config.ochtendbericht_actief !== true` → 200 'uit'; (3) selecteer coached klanten met een profielversie (service-role; join/2 queries), en filter per klant: geen food_log met `datum = vandaag (Europe/Amsterdam)`, geen `messages` met `proactief = true` vandaag, en usage deze maand < limiet (zelfde helpers als lau-reply — deel ze via `_shared/limiet.ts`: maandstart-helper + limiet-lezer); (4) per kandidaat: Haiku-call (SUGGESTIE_MODEL-env) met een korte systemprompt (identiteit + GUARDRAILS uit `_shared/guardrails.ts` + "schrijf één kort warm ochtendbericht (max 2 zinnen) aan [voornaam]; er is vandaag nog niets gelogd; nodig zacht uit, geen verwijt, geen getallen"); bij een fout: vaste fallback "Goedemorgen [voornaam] ☀️ Nog niets gelogd vandaag — twee tikken en je dag staat. Hoe is je ochtend?"; (5) insert `{ client_id, sender: 'ai', tekst, proactief: true }` + ai_usage-rij (model, tokens of 0/0); (6) response: JSON met aantallen (kandidaten, verstuurd, overgeslagen) voor de cron-logs. Sequentieel per klant (6 klanten — geen rate-zorgen), fouten per klant geïsoleerd (één klant mag de rest niet blokkeren).
- [ ] `deno check` schoon (beide functions); config.toml-blok toegevoegd. Commit: `feat(ai): lau-ochtend — dagelijks proactief bericht achter cron-secret`

### Task 4: App — 429-afhandeling

**Files:** Modify `apps/mobile/src/lib/hooks/useBerichten.ts`, `apps/mobile/src/app/(tabs)/chat.tsx`, `apps/mobile/src/lib/klantdata.tsx` (alleen als de context-sleutels wijzigen).

- [ ] `useBerichten`: nieuwe state `limietBereikt: boolean`. In de invoke-afhandeling: detecteer een 429 (check hoe supabase-js FunctionsHttpError de status geeft in de geïnstalleerde versie — `error.context.status`; verifieer in node_modules) → `setLimietBereikt(true)`, `setWachtOpLau(false)`, geen suggesties. Reset: bij een geslaagd antwoord (ai-INSERT via realtime) → false. Exporteer `limietBereikt`.
- [ ] `chat.tsx`: bij `limietBereikt` een systeemregel-kaartje in de berichtenlijst (stijl disclaimer-regel, ander icoon bijv. maan/pauze): "Je Lau-gesprekken voor deze maand zijn op. Bespreek het met Laura — zij kan er meer voor je aanzetten." — GEEN prijzen/links/kooptaal. Suggestie-chips + "Ik heb gegeten"-rij verbergen zolang limietBereikt (de composer mag blijven: berichten opslaan mag, alleen Lau antwoordt niet — nee, simpeler en eerlijker: composer disabled met placeholder "Lau is er volgende maand weer voor je" — kies dit).
- [ ] Typecheck + web-export + `npm test`. Commit: `feat(mobile): nette afkap bij maandlimiet (429) zonder kooptaal`

### Task 5: Dashboard — Lau-gebruik + limiet-beheer

**Files:** Modify `apps/coach/src/lib/hooks/useKlantContext.ts`, `apps/coach/src/app/klant/[id]/page.tsx`; Create `apps/coach/src/components/LauGebruik.tsx`.

- [ ] `useKlantContext`: extra parallelle queries — RPC `ai_gebruik_deze_maand` (fail-safe: PGRST202 → `gebruik: null`, sectie toont "nog niet beschikbaar tot de migratie gepusht is"), `clients.select('ai_limiet')` (zit al bijna — check wat er al geladen wordt) en `app_config.ai_maandlimiet`; mutatie `stelLimietIn(waarde: number | null)` → `clients.update({ ai_limiet: waarde })` met rijen-geraakt-check.
- [ ] `LauGebruik.tsx`: "N van M deze maand" + voortgangsbalk (sage; clay vanaf 90%), number-input "Eigen limiet" (leeg = standaard, toon "Standaard: M/maand"), opslaan-knop met bezig/fout. In de zijbalk onder Voedingsweek.
- [ ] Coach typecheck/build/lint. Commit: `feat(coach): Lau-gebruik en limiet-beheer in klantdetail`

### Task 6: Eindverificatie

- [ ] Batterij: mobile+coach typecheck 0 · coach build+lint OK · `npm test` 30 groen · `npm run test:rls` (verwachte failures exact benoemen) · `deno check` beide functions schoon.
- [ ] Jeffrey-stappen onderaan dit plan: (1) `supabase db push` (fase 6 + 7 als 6 nog niet gepusht is), (2) `supabase secrets set CRON_SECRET=<lang random>` en optioneel `LAU_MODEL`/`LAU_SUGGESTIE_MODEL`, (3) `supabase functions deploy lau-reply` én `supabase functions deploy lau-ochtend`, (4) Supabase-dashboard → Cron: dagelijkse job ±10:30 Europe/Amsterdam → HTTP-request naar de lau-ochtend-URL met header `x-cron-secret`, (5) test: handmatige curl met de secret → JSON-aantallen; daarna RLS-tests fase 6+7, (6) PR-keten t/m fase-7.
- [ ] Commit: `chore: fase 7 eindverificatie + Jeffrey-stappen`

## Self-review

Spec-dekking: metering/afkap (T1/T2/T4), quota-dashboard (T5), proactief (T3), model-env (T2/T3), A12+M5 (T1), cron-als-Jeffrey-stap (T6, D4). Aannames D1-D7 verwerkt. Kooptaal-verbod expliciet in T4. Streaming-flow onaangeroerd; usage-variabelen overleven de catch (T2-waarschuwing).

## Jeffrey-stappen (na de bouw)

Eindstand bij oplevering: mobile/coach typecheck 0 · coach build+lint OK · 30 unit-tests
groen · deno check beide functions schoon · RLS 45 groen + 9 verwachte fase 7-failures
(migratie nog niet gepusht; fase 4-6 volledig groen).

1. `supabase db push` — fase 7-migratie (ai_usage, limieten, proactief, flags-tier-check,
   profiel-caps). Daarna `npx vitest run tests/rls/fase7.test.ts` → 12/12 verwacht.
   Let op: niet twee volledige RLS-runs kort na elkaar (GoTrue-ratelimit — 5 min pauze).
2. `supabase secrets set CRON_SECRET=<lang-willekeurig>` (bijv. `openssl rand -hex 32`).
   Optioneel: `LAU_MODEL` / `LAU_SUGGESTIE_MODEL` (defaults: sonnet-5 / haiku-4-5).
3. `supabase functions deploy lau-reply` en `supabase functions deploy lau-ochtend`.
4. Supabase-dashboard → Integrations → Cron: dagelijkse job om 10:30 Europe/Amsterdam →
   HTTP request naar de lau-ochtend-URL met header `x-cron-secret: <de secret>`.
5. Test handmatig: curl met de secret-header → JSON met aantallen; daarna in de app
   checken dat het ochtendbericht verschijnt (alleen bij een klant zonder log vandaag).
6. Quota testen: dashboard → klantdetail → "Lau-gebruik" → eigen limiet op 1 → in de app
   twee berichten sturen → tweede geeft de nette afkap-melding. Limiet terug op leeg.
7. PR-keten: fase-6 → fase-7 (`compare/fase-6-profiel-tutorials...fase-7-ai-limieten`).

Opvolgpuntje uit Task 4: LogSheet's fire-and-forget lau-reply-call toont de afkap-regel
niet (alleen chat-berichten doen dat) — klein, meenemen bij de aannames-doorloop.
