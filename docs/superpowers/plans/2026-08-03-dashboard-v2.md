# Dashboard-v2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Coach-dashboard pixel-getrouw naar de handoff (§7 klantenlijst, §8 drie-koloms klantdetail, §9 wekelijks gesprek met échte prompt-preview).

**Architectuur:** UI-herbouw op de bestaande hooks/data (fase 5/7); twee nieuwe edge functions (`prompt-preview`, `sessie-voorstellen`) die de bestaande prompt-builder hergebruiken. Geen DB-migratie nodig (weekly_sessions bestaat; coach-RLS dekt alles).

**Spec:** `docs/superpowers/specs/2026-08-03-dashboard-v2-design.md` (aannames E1-E8) — **de maten/kleuren/copy staan in `design_handoff_lau_in_balans/README.md` §7-§9 + tokens/typografie/interactions: LEES DIE ALS EERSTE, dat is de bron.**
**Branch:** `dashboard-v2`

**Codebase-weetjes:**
- Bestaande data-laag NIET herbouwen: `useKlanten`, `useKlantChat`, `useKlantContext` (flags/voedingsweek/notities/gebruik/limiet), `useProfielVersies`, `useInvites`, `CoachProvider`. UI mag volledig vervangen; hooks alleen uitbreiden waar data mist (laatste weekly_session-datum in de lijst).
- Tailwind-tokens in `apps/coach/src/app/globals.css` (@theme) — vul aan met wat §7-§9 nodig heeft (table-row/head bestaan al; check clay-varianten, laura-kleuren, radius-waarden 14/16/20).
- Chat-realtime + antwoorden-als-Laura + flag-afronden + profiel-opslaan + notities bestaan en werken — herstyle ze naar de handoff-vorm (antwoordbalk, compacte bubbels, flag-banner) zonder de logica te slopen.
- Edge functions: patroon lau-ochtend (coach/service-clients, model-env, deno check, config.toml verify_jwt=false is hier FOUT — deze twee zijn coach-calls mét JWT: geen config-blok nodig, default verify_jwt=true is prima; de functie checkt daarbovenop is_coach_of). `_shared/prompt-builder.ts` bouwt {system, messages}; weekcontext-aggregatie zoals lau-reply.
- `weekly_sessions`: (client_id, datum default vandaag, notitie, signalen text[], voorstellen jsonb, resulting_profile_version uuid). Coach-RLS: select+insert eigen klanten (bestaat).
- NL, WCAG-lessen (text-body-equivalenten — let op: de handoff schrijft soms #8C8F84 voor betekenisvolle tekst; volg het ontwerp maar noteer contrast-afwijkingen als opvolgpunt i.p.v. stil aanpassen).

---

### Task 1: Chrome + klantenlijst (§7)

**Files:** Modify `apps/coach/src/app/page.tsx`, `apps/coach/src/components/Nav.tsx` (→ handoff-chrome), `apps/coach/src/lib/hooks/useKlanten.ts` (uitbreiden), globals.css (tokens aanvullen).

- [ ] Chrome per §Coach-dashboard-intro: witte balk, "Lau in Balans" Newsreader 18 + "· coach" 13, rechts datum (NL) + 34px Laura-avatar. Bestaande nav-links (Klanten/Invites/Uitloggen) integreren in deze chrome (E6) — subtiel rechts van het merk of bij de avatar.
- [ ] `useKlanten` uitbreiden: open-flag-count bestaat al; erbij: logs-dagen-van-7 (food_logs-aggregatie zoals de app) en laatste weekly_session-datum (`weekly_sessions` select datum order desc limit 1 — RLS dekt). "Wacht op jou"-afleiding (open flag || status stil → zie spec E2-mapping; let op: pill toont 'Wacht op jou' bij open flag; status 'stil' toont 'Stil' maar valt onder het Wacht-op-jou-filter).
- [ ] Lijst herbouwen als §7-tabel: kop + grid `2fr 1.1fr 2.2fr 1fr 1fr`, filterpills (default Wacht op jou — met fallback naar Alle als er niets wacht), avatar-initialen (flag → clay-tinten), status-pills, ellipsis-bericht, eten-rail (6px, fill N/7, sage ≥4), gesprek-datum, inset clay-rand bij wachtende rijen, hover `#FBF9F5`, voetnoot. Kop-teller "N actief · M wachten op jou".
- [ ] Verify: typecheck/build/lint coach. Commit: `feat(coach): dashboard-v2 — chrome + klantenlijst naar handoff §7`

### Task 2: Klantdetail — drie kolommen (§8)

**Files:** Rewrite `apps/coach/src/app/klant/[id]/page.tsx` (layout), herstyle `ChatBubbel` (compacte §8-varianten incl. Laura rechts-uitgelijnd… LET OP: §8 zegt Laura-bubbel "rechts uitgelijnd" in het coach-transcript — volg §8), nieuw `AntwoordBalk`, `FlagBanner`, `ProfielKolom` (kolom 2 op useProfielVersies), `EtenNotitiesKolom` (kolom 3 op useKlantContext incl. Lau-gebruik onderaan); /klant/[id]/profiel-route vervalt (redirect naar detail — kolom 2 ís de editor; versiehistorie als uitklap onderin kolom 2).

- [ ] Sub-header per §8 (terug-rond, avatar, naam 21px + metaregel "leeftijd · week N · doel · X van 7 dagen gelogd" — leeftijd uit clients.leeftijd, doel = eerste uit profiel.doelen), rechts "Wekelijks gesprek"-knop → `/klant/[id]/gesprek`.
- [ ] Flag-banner per §8 (oudste open flag, relatieve tijd, "Open sinds HH:MM"); "Flag afronden"-knop verhuist naar de antwoordbalk-regio per ontwerp.
- [ ] Grid `1.2fr 1fr .8fr`, scheidingslijnen, elke kolom eigen scroll (`max-h` + overflow, sticky sub-header).
- [ ] Kolom 1: transcript met §8-maten (compacte bubbels, log-bubbel met eyebrow + samenvattingsregel — porties uit food_logs zoals de app doet), antwoordbalk per §8 (avatar, pill-input, ronde verzendknop `#8C6A56`, hint-regel die na verzenden wisselt, Enter verstuurt) op de bestaande verstuurAlsCoach + realtime.
- [ ] Kolom 2: chips (chip-varianten neutraal/positief/let-op — mapping: eerste doel positief; portiedoel-chips: achterblijvend t.o.v. weekgemiddelde = let-op; beperkingen met 'allergie' = let-op; verder neutraal — licht toe in comments) voor de lijstvelden mét bewerken (klik = toggle bestaande waarde, invoerveldje voor nieuwe chip), textareas voor aanpak/toon/vermijden, savestatus rechtsboven ("opgeslagen" ↔ "wijziging niet bewaard"), opslaan → bestaande slaOp (nieuwe versie), uitleg-kaart onderaan + compacte versiehistorie (uitklapbaar).
- [ ] Kolom 3: handmaten-kaart (waarde-pills sage/clay t.o.v. profieldoelen + voetnoot-zin), notities (kaarten, nieuwste boven, textarea + Bewaren), Lau-gebruik-sectie (bestaand component, herstyled naar dezelfde kaartvorm).
- [ ] Verify: typecheck/build/lint. Commit: `feat(coach): dashboard-v2 — klantdetail drie kolommen naar handoff §8`

### Task 3: Wekelijks gesprek (§9) — UI

**Files:** Create `apps/coach/src/app/klant/[id]/gesprek/page.tsx`, `apps/coach/src/lib/hooks/useGesprek.ts`.

- [ ] Layout per §9: kop, grid 1fr 1fr. Links: vastleggen-kaart (grote textarea) + signaalchips (multi-select; de zes uit het ontwerp als voorgedefinieerde set + "Rode vlag" clay-variant) + "Wat de logs zeggen"-kaart (zelfde handmaten-regels + zin). Rechts: voorstellen-kaart (teller "N van 3 toegepast"; knop "Voorstellen ophalen" → edge function; kaart-states open/toegepast/overgeslagen met oud-doorgestreept/nieuw) + prompt-preview-kaart (sage-soft; witte bubbel Newsreader 18; toelichtingsregels; knop "Ververs preview" → edge function; uitklapbare rauwe systemprompt — E3/E8).
- [ ] `useGesprek(clientId)`: state notitie/signalen/voorstellen/toepassingen; `haalVoorstellen()` → invoke `sessie-voorstellen`; `haalPreview(conceptProfiel)` → invoke `prompt-preview`; `legVast()` → (a) indien toepassingen: bouw concept-profiel (huidige hoogste versie + toegepaste voorstellen per veld) en schrijf één nieuwe profielversie via de bestaande insert-flow (author = coach), (b) insert weekly_session {notitie, signalen, voorstellen (met besluit per voorstel), resulting_profile_version}, (c) knop-flow per §9 ("Vastleggen…" → "Opgeslagen — Lau is bijgesteld" → tweede klik terug naar detail). Concept-profiel-mapping: voorstel.veld → AIProfile-veld (de function levert veldnamen uit een vaste enum — zie Task 4; onbekend veld = alleen tonen, niet toepasbaar).
- [ ] Fail-safes: functions nog niet gedeployed (FunctionsError) → nette melding "Voorstellen/preview beschikbaar na deploy van de nieuwe functions" (patroon nogNietBeschikbaar); vastleggen werkt ook zónder voorstellen (alleen notitie+signalen).
- [ ] Verify: typecheck/build/lint. Commit: `feat(coach): dashboard-v2 — wekelijks gesprek naar handoff §9`

### Task 4: Edge functions `prompt-preview` + `sessie-voorstellen` + eindverificatie

**Files:** Create `supabase/functions/prompt-preview/index.ts`, `supabase/functions/sessie-voorstellen/index.ts`.

- [ ] Beide: JWT-flow zoals lau-reply (anon-client + getUser), maar de caller is een COACH: check via service-client `clients.select('id').eq('id', body.client_id).eq('coach_id', coachId)` (1 rij = ok, anders 403). Geen config.toml-blok (verify_jwt default aan is juist hier). CORS zoals lau-reply.
- [ ] `prompt-preview`: body `{ client_id, concept_profiel? }`; profiel = concept of hoogste versie (service); weekcontext = zelfde aggregatie als lau-reply; `bouwPrompt` uit `_shared/prompt-builder.ts` met een fictief nieuwBericht ("(ochtend-opening)") — response bevat `systemPrompt`; daarna één create-call (`LAU_SUGGESTIE_MODEL`, max_tokens 300, system = die prompt + instructie "schrijf het eerste ochtendbericht van maandag aan [voornaam], max 2 zinnen") → `opening` (refusal/fout → opening null, systemPrompt blijft). Response `{ systemPrompt, opening }`.
- [ ] `sessie-voorstellen`: body `{ client_id, notitie, signalen }`; context = profiel + weekdata; create-call (`LAU_MODEL` — dit verdient het betere model, max_tokens 1000) met een strak geformatteerde opdracht: retourneer UITSLUITEND JSON-array van max 3 `{ veld, oud, nieuw, toelichting }` waar veld ∈ {doelen, portiedoelen, knelpunten, voorkeuren, beperkingen, checkinRitme, aanpak, toon, vermijdenInCoaching} en oud/nieuw strings zijn (voor lijstvelden: de lijst als '· '-gejoined string; de app parsed lijstvelden terug op '·'). Parse defensief (patroon genereerSuggesties), valideer veldnamen, max 3. Fout → `{ voorstellen: [] }`.
- [ ] `deno check` beide + lau-reply schoon; deno.lock terugdraaien.
- [ ] Eindverificatie: coach typecheck/build/lint · mobile typecheck (niets geraakt) · `npm test` 30 · rls-suite ongewijzigd groen (geen DB-wijziging).
- [ ] Jeffrey-stappen onderaan dit plan (deploys van de twee functions + test-flow).
- [ ] Commit: `feat(ai): prompt-preview + sessie-voorstellen — de echte prompt-pipeline voor het dashboard`

## Self-review

Dekking: §7 (T1), §8 (T2), §9 (T3+T4), E1-E8 verwerkt, bestaande features behouden (E6), geen migratie nodig (weekly_sessions bestaat, RLS dekt). Prompt-preview via de echte builder (handoff-eis). Contrast-afwijkingen van het ontwerp worden genoteerd, niet stil gefixt.

## Jeffrey-stappen (na de bouw)

Eindstand bij oplevering: `npm run typecheck -w apps/coach` 0 · `npm run typecheck -w apps/mobile` 0 ·
`npm run build -w apps/coach` succes · `npm run lint -w apps/coach` schoon · `npm test` 30 groen ·
`npm run test:rls` 54 groen (alles; geen DB-wijziging in deze branch) · `deno check` schoon op
`prompt-preview`, `sessie-voorstellen` en `lau-reply`.

**Geen migratie in deze branch** — `weekly_sessions` en de coach-RLS bestaan sinds fase 5. Er is dus
niets te pushen; alleen de twee nieuwe functions moeten de deur uit.

1. **De twee functions deployen** (twee losse commando's, volgorde maakt niet uit):

   ```bash
   supabase functions deploy prompt-preview
   ```

   ```bash
   supabase functions deploy sessie-voorstellen
   ```

   Verwacht per commando: `Deployed Functions on project jzovciuubkwvbwxphamf: <naam>` en een
   dashboard-link. Foutbetekenis: `Access token not provided` = eerst `supabase login` ·
   `Cannot find project ref` = `supabase link --project-ref jzovciuubkwvbwxphamf` ·
   een bundel-fout op `../../../packages/shared/...` = je draait het commando niet vanuit de
   repo-root (de functions importeren de gedeelde types via een relatief pad).

   Geen `config.toml`-blok nodig: beide functions worden door het dashboard met Laura's JWT
   aangeroepen, dus de standaard `verify_jwt = true` is hier precies goed. Ze checken daarbovenop
   zelf dat de klant van de ingelogde coach is (anders 403).

   Secrets: `ANTHROPIC_API_KEY` staat er al sinds fase 3 en is het enige wat verplicht is.
   `LAU_MODEL` (default `claude-sonnet-5`, gebruikt door `sessie-voorstellen`) en
   `LAU_SUGGESTIE_MODEL` (default `claude-haiku-4-5`, gebruikt door `prompt-preview`) zijn optioneel
   — zelfde namen als lau-reply/lau-ochtend, dus een modelwissel is één `supabase secrets set`.

2. **Dashboard herstarten en inloggen**:

   ```bash
   npm run dev -w apps/coach
   ```

   → <http://localhost:3000>, inloggen als `laura@demo.lauinbalans.nl` / `demo-demo-2026`.
   Herstarten is nodig omdat de dev-server nog op de oude build draait.

3. **De hele flow doorlopen** (de visuele check die ik niet kan doen):
   - **Klantenlijst** (§7): kop-teller "N actief · M wachten op jou", filterpills, eten-rail per rij,
     inset clay-rand bij rijen die op Laura wachten.
   - **Sanne openen** → **drie kolommen** (§8): transcript + antwoordbalk links, profiel-chips in het
     midden (savestatus rechtsboven), handmaten/notities/Lau-gebruik rechts. Elke kolom scrollt apart.
   - **"Wekelijks gesprek"** rechtsboven → §9-scherm.
   - **Notitie typen** in de grote textarea (zonder notitie blijft de knop uit — dat is bedoeld) en een
     paar **signaalchips** aanzetten.
   - **"Voorstellen ophalen"** → knop leest "Lau denkt na…", daarna maximaal 3 kaarten met veldnaam,
     nieuwe waarde en de oude doorgestreept. Foutbetekenis: "Beschikbaar na deploy van de nieuwe
     functions" = stap 1 is (nog) niet gelukt · "De voorstellen ophalen lukte niet" = de function
     draait maar geeft een fout — kijk in Supabase → Edge Functions → sessie-voorstellen → Logs ·
     "Lau zag in deze notitie geen aanleiding" is géén fout, dat is een geldige uitkomst (bij twijfel:
     de logregel `geen bruikbare voorstellen` in dezelfde logs vertelt of het model écht niets zag).
   - **Toepassen/Overslaan** per kaart → de teller rechtsboven ("N van M toegepast") loopt mee.
   - **"Ververs preview"** → witte bubbel in Newsreader met het gesimuleerde maandagochtendbericht.
     Klap **"Bekijk de volledige prompt"** uit: dat is letterlijk de systemprompt die Lau in productie krijgt
     (dezelfde `bouwPrompt` als lau-reply), dus het toegepaste voorstel hoort er in het profielblok in
     te staan. Staat er wél een prompt maar geen bubbel, dan gaf het model niets bruikbaars terug —
     de prompt is de kern, dat is geen storing. Toggle je daarna nog een voorstel, dan meldt de kaart
     dat de preview verouderd is; verversen kost tokens, dus dat gebeurt alleen op de knop.
   - **"Vastleggen en terug naar Sanne"** → label wordt "Opgeslagen — Lau is bijgesteld"; **tweede klik** gaat
     terug naar het klantdetail. Check daar in kolom 2 dat de versiehistorie er een versie bij heeft
     met de toegepaste wijziging erin.

4. **PR openen** — de branch staat op origin, maar deze laatste commits nog niet:

   ```bash
   git push origin dashboard-v2
   ```

   Daarna: <https://github.com/JeffreyBouva/lau-in-balans/compare/fase-7-ai-limieten...dashboard-v2>
   — is fase 7 al in `main` gemerged, gebruik dan
   <https://github.com/JeffreyBouva/lau-in-balans/compare/main...dashboard-v2>.
