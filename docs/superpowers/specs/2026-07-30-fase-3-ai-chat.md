# Lau in Balans — Fase 3: AI-chat (lau-reply) Design

Datum: 2026-07-30 · Status: ontwerp (autonoom opgesteld terwijl Jeffrey sliep; keuzes gedocumenteerd, toetsen bij terugkomst)

Vervolg op fase 2 (klant-app). Maakt de chat écht: Lau.ai antwoordt via een Supabase Edge
Function die de Claude-API aanroept, aangestuurd door het per-klant AI-profiel dat Laura beheert,
met de guardrails uit de fase-1-spec. Bron voor toon/copy/few-shots: de design handoff
(`design_handoff_lau_in_balans/README.md` § "2. Chat" antwoordtabel + openingsgesprek).

## Autonoom gemaakte keuzes (toetsen bij terugkomst)

| Keuze | Besluit | Waarom / alternatief |
|---|---|---|
| Model | `claude-sonnet-5` | De goedgekeurde fase-1-spec noemt "Claude (Sonnet)". Snel + goedkoop genoeg voor per-bericht coaching, hoge kwaliteit. De claude-api-skill-default is `claude-opus-5`; één regel wisselen als je meer diepgang wilt. |
| Thinking/effort | adaptief, `effort: "low"` | Korte, warme antwoorden (handoff-toon) met net genoeg redeneren voor guardrail-naleving; houdt de typing-indicator kort. `display: "omitted"`. |
| `max_tokens` | 1024, non-streaming | Antwoorden zijn kort; ruim onder de streaming-drempel, geen timeout-risico. Streaming is een latere optimalisatie. |
| Trigger | app roept de functie aan ná insert van een klantbericht (`supabase.functions.invoke('lau-reply')`) | Simpelst (geen DB-webhook-infra); conform fase-1-spec ("lau-reply · app, na insert"). |
| Rode-vlag-escalatie | AI antwoordt veilig + verwijst (Laura/huisarts/diëtist); **geen** auto-flag | Auto "AI-monitort-AI"-alerts staan in fase-1-spec bewust op v2. Laura leest mee. |
| Client-identiteit | uit de JWT (`auth.uid()`), niet uit de request-body | Voorkomt dat een klant namens een ander antwoorden laat genereren. |

## Scope

**In fase 3:**

- **`_shared/prompt-builder.ts`** — één pure module die de system-prompt + berichten-array bouwt
  uit: identiteit/toon van Lau → guardrails → het actieve AIProfile → weekcontext (portiedoelen
  vs. gelogde handmaten deze week) → few-shot-voorbeelden (de handoff-antwoordtabel). Volledig
  unit-testbaar zonder API-key.
- **`lau-reply` Edge Function** (Deno) — authenticeert de klant, laadt context met de service
  role, bouwt de prompt, roept Claude aan, schrijft het `ai`-bericht weg. De app krijgt het via
  de bestaande realtime-subscription (fase 2).
- **Guardrails** in de system-prompt (de 6 uit de fase-1-spec) + rode-vlag-instructie.
- **Guardrail-evals** — een script met lastige inputs (gewichtsvragen, calorieën, rode-vlag-
  signalen, medische/zwangerschap/medicatie-vragen) dat de prompt-opbouw én (optioneel, met key)
  echte antwoorden toetst aan de 6 regels.
- **App-koppeling** — `useBerichten.verstuur` roept ná de insert `lau-reply` aan; de typing-
  indicator draait tot het antwoord binnenkomt (via realtime). Idem: de log-sheet-save triggert
  een reactie (fase-3-markering uit fase 2 vervangen).

**Bewust NIET in fase 3 (→ latere fasen):** het ochtendbericht (pg_cron, fase 6), `session-suggest`
en `prompt-preview` (fase 5, wekelijks gesprek), streaming, AI-monitort-AI-alerts (v2).

## Architectuur

```text
supabase/functions/
├── _shared/
│   ├── prompt-builder.ts        # bouwt {system, messages} uit profiel + context + few-shots
│   ├── prompt-builder.test.ts   # unit-tests (deno test) — geen API-key nodig
│   ├── guardrails.ts            # de 6 guardrail-regels als system-prompt-tekst (herbruikt)
│   └── few-shots.ts             # de handoff-antwoordtabel als few-shot-voorbeelden
└── lau-reply/
    └── index.ts                 # Deno.serve: auth → context laden → prompt → Claude → insert
scripts/
└── guardrail-evals.mjs          # lastige inputs → toetst prompt-opbouw (+ optioneel echte calls)
```

### Prompt-builder (het hart)

`bouwPrompt(input) → { system: string, messages: {role, content}[] }` waar `input` = het actieve
`AIProfile`, de laatste ~20 berichten (klant/ai/coach), de weekcontext (portiedoelen +
dag-aggregaten deze week), en het nieuwe klantbericht.

**System-prompt-opbouw** (vaste volgorde, cache-vriendelijk — stabiel eerst):

1. **Identiteit & toon** van Lau (uit de handoff: warm, direct, korte berichten, handmaten als taal).
2. **Guardrails** (`guardrails.ts`, de 6 regels — zie onder).
3. **Het actieve AIProfile** (gestructureerd: doelen, portiedoelen, knelpunten, voorkeuren,
   beperkingen, checkin-ritme, aanpak, toon, **vermijden_in_coaching** (bindend), veiligheidsvlag).
4. **Weekcontext**: portiedoelen vs. gelogde handmaten deze week (uit food_logs-aggregaten).
5. **Few-shots** (`few-shots.ts`): de handoff-antwoordtabel als voorbeeld-vraag→antwoord-paren,
   zodat toon en inhoudelijke lijn kloppen.

De `messages`-array is de recente gespreksgeschiedenis (klant→`user`, ai/coach→`assistant`),
eindigend op het nieuwe klantbericht. `vermijden_in_coaching` is bindend: staat er "niet openen
met gewicht of getallen", dan doet Lau dat niet.

### `lau-reply` Edge Function

```text
Deno.serve(req):
  1. Auth: lees de JWT uit de Authorization-header → verifieer via anon-client → auth.uid() = clientId
     (401 als geen geldige sessie).
  2. Service-client (SUPABASE_SERVICE_ROLE_KEY, env-secret): laad
     - actief AIProfile (hoogste versie) voor clientId
     - laatste ~20 messages van clientId (oud→nieuw)
     - food_logs van deze week → weekcontext-aggregaat
  3. bouwPrompt(...) → {system, messages}
  4. Anthropic-SDK (npm:@anthropic-ai/sdk, key uit ANTHROPIC_API_KEY-secret):
     model claude-sonnet-5, thinking adaptief/effort low, max_tokens 1024.
     Check stop_reason vóór content lezen (refusal → nette fallbacktekst).
  5. Insert een `messages`-rij (sender 'ai', tekst = antwoord) met de service role.
     → de app krijgt 'm via de bestaande realtime-subscription.
  6. Respond 200 (het antwoord hoeft niet in de body — de app leest via realtime).
```

Secrets als Supabase-**Edge-Function-secrets** (niet in git): `ANTHROPIC_API_KEY` (Jeffrey zet
deze), `SUPABASE_SERVICE_ROLE_KEY` en `SUPABASE_URL` (door Supabase geïnjecteerd in Edge Functions).

### Guardrails (in de system-prompt, niet optioneel)

De 6 uit de fase-1-spec, plus rode-vlag-gedrag:

1. **Geen medisch advies** — bij klachten/twijfel/medische vragen: verwijs naar huisarts of diëtist.
2. **Nooit calorieën, grammen of macro's** — handmaten zijn de enige eenheid.
3. **`vermijden_in_coaching` is bindend** (bijv. niet openen met gewicht/getallen).
4. **Rode vlaggen** (eetstoornis-signalen, ondervoeding, psychische nood, zwangerschap, medicatie):
   coach niet door; reageer warm, breng Laura in beeld ("tik op Laura bovenaan") en verwijs naar
   een professional. **Geen** getallen/dieetadvies in zo'n reactie.
5. **Laura is één tik weg** — noem de Laura-knop als de klant een mens wil of iets niet goed voelt.
6. **Toon** — warm, direct, korte berichten; geen wollige complimenten; handmaten als taal.

De guardrail-evals (onder) toetsen dat de gebouwde prompt deze regels bevat én dat echte
antwoorden (met key) ze naleven op een set lastige inputs.

## Testaanpak

- **prompt-builder unit-tests** (`deno test`): profiel → prompt bevat alle guardrail-regels,
  `vermijden_in_coaching` staat erin, weekcontext klopt (portiedoelen vs. gelogde handmaten),
  few-shots aanwezig, berichten-mapping (klant→user, ai/coach→assistant) klopt, geen calorieën
  in de vaste tekst. **Geen API-key nodig** — dit is het leeuwendeel en kan nu al.
- **guardrail-evals** (`scripts/guardrail-evals.mjs`): ~8 lastige inputs. Fase A (nu, geen key):
  toetst dat de prompt-opbouw de juiste guardrails/copy bevat per input. Fase B (met key, na
  deploy): draait echte calls en toetst antwoorden aan de regels (geen calorieën/getallen bij
  gewichtsvraag; rode vlag → Laura/professional; medische vraag → doorverwijzen).
- **Integratie/live** (na deploy + key): een klantbericht in de app → typing-indicator →
  Lau-antwoord verschijnt via realtime. Dit vereist Jeffrey (secret + deploy).

## Wat Jeffrey moet doen (kan Claude niet zonder)

1. **`ANTHROPIC_API_KEY`** als Supabase Edge-Function-secret zetten
   (`supabase secrets set ANTHROPIC_API_KEY=...`).
2. **De functie deployen** (`supabase functions deploy lau-reply`) — jouw cloud/token.
3. Daarna kan Claude de guardrail-evals-fase-B + de live-integratietest draaien.

Tot dan bouwt Claude: de prompt-builder + tests, de functie-code, de guardrail-evals (fase A),
en de app-koppeling — allemaal zonder key/deploy verifieerbaar op prompt-niveau.

## Open punten & risico's

- **Kosten**: Sonnet 5 per bericht is bij 1–10 klanten verwaarloosbaar; herzien bij opschalen.
  Prompt caching (stabiele system-prefix) houdt herhaalde context goedkoop.
- **Latency**: adaptief/low houdt het snel; als antwoorden traag voelen, thinking uit +
  `effort: "low"` (Sonnet 5 accepteert `disabled`), of streamen naar de app.
- **Model-keuze**: Sonnet 5 vs. Opus 5 — bewust op Sonnet gezet (spec); één regel om te wisselen.
- **Rode-vlag-detectie** leunt in fase 3 op de guardrail-prompt (geen aparte classifier); de
  v2-"AI-monitort-AI"-laag komt later. Laura leest mee als vangnet.
