# Fase 7 — AI-limieten, proactieve Lau & quota-beheer (design)

**Datum:** 2026-08-03 · **Status:** autonoom uitgewerkt (aannames gelogd, na afloop
samen doorlopen). Scope = Jeffrey's punten 8, 9, 10 + het fase 5-uitgestelde
quota-beheer + gelogde hardening (A12 flags-tier-check, M5 profiel-caps).

## Doel

Lau-gebruik wordt gemeten en begrensd (bijkopen loopt via Laura, géén in-app-aankoop
en géén kooptaal — App Store 3.1.3). Lau stuurt zelf een ochtendbericht als er nog
niets gelogd is. Modelkeuze is config, geen code.

## Onderdelen

### 1. Migratie `fase7_limieten`

- **`ai_usage`**: (id, client_id FK cascade, created_at, model text, input_tokens int,
  output_tokens int). `lau-reply` schrijft één rij per beantwoord bericht. RLS: coach
  leest eigen klanten (`is_coach_of`); klant leest niets (v1 — de afkap-melding is de
  interface); geen insert-policies (service-role schrijft). Index (client_id, created_at).
- **`clients.ai_limiet int null`** — per-klant override; null = config-default.
  `app_config` krijgt `ai_maandlimiet` (default **300** berichten/kalendermaand — A13).
  Guard-trigger blijft af van deze kolom (alleen id/coach_id/startdatum/created_at zijn
  bevroren); de bestaande `coach_wijzigt_klanten`-policy dekt het dashboard-schrijven.
- **RPC `ai_gebruik_deze_maand(p_client uuid)`** (definer): count ai_usage-rijen in de
  lopende kalendermaand (Europe/Amsterdam). Coach-only (check `is_coach_of`), voor het
  dashboard. `lau-reply` telt zelf met service-role (geen RPC nodig).
- **`messages.proactief boolean not null default false`** — markeert door Lau
  geïnitieerde berichten; maakt "al een proactief bericht vandaag?" triviaal.
- **A12-meelifter**: `klant_maakt_flag`-policy krijgt een tier-check (alleen
  `tier = 'coached'` mag flaggen) — de LauraKnop was al client-side gegate.
- **M5-meelifter**: `werk_mijn_profiel_bij` (create or replace): no-op-detectie
  (`v_nieuw = v_profiel` → return huidige versie, geen lege versie-spam) + caps
  (max 20 items per lijst, max 200 tekens per item — ruim boven normaal gebruik).
- Extensions `pg_cron`/`pg_net` NIET in de migratie (A16): de cron-koppeling loopt via
  het Supabase-dashboard (Jeffrey-stap) — robuuster dan vault-afhankelijke SQL.

### 2. `lau-reply`: metering + afkap + model-config

Vóór de Claude-call (in de bestaande parallelle load): tel deze maand voor deze klant
(service-role count op ai_usage) en lees de limiet (clients.ai_limiet ??
app_config.ai_maandlimiet). Bij bereikt: **429** met body `limiet bereikt` — geen
Claude-call, geen usage-rij. Na een geslaagd antwoord: insert ai_usage met
`finaal.usage.input_tokens/output_tokens` en het model. Model uit env:
`LAU_MODEL` (default `claude-sonnet-5`), suggesties `LAU_SUGGESTIE_MODEL`
(default `claude-haiku-4-5`) — punt 10-abstractie; gateway is YAGNI (A15).

### 3. App: nette afkap

`verstuur` in `useBerichten`: bij een 429 van de invoke → eigen bericht blijft staan,
typing-indicator uit, en een lokale (niet-opgeslagen) systeemregel in de chat:
"Je Lau-gesprekken voor deze maand zijn op. Bespreek het met Laura — zij kan er meer
voor je aanzetten." (geen prijzen/links/kooptaal). Suggestie-chips verbergen zolang
de limiet-staat actief is (reset bij nieuwe maand/geslaagd antwoord).

### 4. Proactieve Lau: edge function `lau-ochtend`

Nieuwe Deno-function, aangeroepen door een dagelijkse cron (±10:30 Europe/Amsterdam):
- Auth: alleen met een geheime header `x-cron-secret` == env `CRON_SECRET` (de functie
  draait met service-role; geen JWT-flow).
- Killswitch: `app_config.ochtendbericht_actief` (default `true` — A14).
- Selecteert coached klanten mét profiel waarvoor vandaag (Europe/Amsterdam) geen
  food_log én geen proactief bericht bestaat, en die de AI-limiet niet bereikt hebben.
- Per klant: kort warm berichtje via `LAU_SUGGESTIE_MODEL` (Haiku — goedkoop) op basis
  van voornaam + weekcontext, mét de guardrails (geen getallen, handmaten-taal);
  fallback op een vaste NL-tekst als de call faalt. Insert als
  `{ sender: 'ai', proactief: true }` + ai_usage-rij. Max 1/dag/klant (query-guard).
- De app toont het gewoon als Lau-bericht (realtime bestaat al); push volgt in fase 8.

### 5. Dashboard: quota-beheer (klantdetail-zijbalk)

Sectie "Lau-gebruik": "N van M deze maand" (RPC `ai_gebruik_deze_maand` + limiet) met
subtiele voortgangsbalk (clay bij ≥90%), en een limiet-veld (number-input + opslaan →
`clients.update({ ai_limiet })`, leeg = standaard). Copy: "Standaard: 300/maand."

## Buiten scope (bewust)

Push-notificaties (fase 8) · klant-zichtbaar saldo (A17) · betalingen/facturatie ·
AI-gateway (A15) · guardrail-evals fase B live draaien (kost API-tegoed; de bestaande
evals + few-shots blijven de basis — punt 10's "strakker trainen" komt terug bij de
wekelijks-gesprek-fase met echte gesprekdata).

## Aannames (D-serie, na afloop doorlopen)

- **D1/A13** Meeteenheid = beantwoorde berichten (begrijpelijk voor Laura én klant);
  tokens worden wél gelogd voor latere analyse. Maandlimiet default 300, per klant
  overschrijfbaar in het dashboard, "wat is teveel" bepalen we op echte meetdata.
- **D2/A14** Proactief = één ochtendbericht per dag, alleen bij géén log vandaag,
  killswitch in app_config. Tekst AI-gegenereerd (Haiku) met vaste fallback.
- **D3/A15** Geen Vercel AI Gateway: modelkeuze via env-vars is de hele behoefte nu.
- **D4/A16** Cron-koppeling via het Supabase-dashboard (Cron-integratie → edge function
  met de secret-header), niet via pg_cron-SQL in de migratie — testbaar en zonder
  vault-afhankelijkheid. Function is idempotent en handmatig triggerbaar.
- **D5/A17** De klant ziet géén saldo-teller; alleen de nette afkap-melding. Een teller
  nodigt uit tot "opmaken" en voegt UI-ruis toe. Heroverwegen op feedback.
- **D6** De 429-melding leeft alleen client-side (niet in messages): geen DB-vervuiling,
  en de melding verdwijnt vanzelf bij een nieuwe maand.
- **D7** Proactieve berichten tellen mee in de maandlimiet (het is Lau-gebruik), maar
  de ochtend-function slaat klanten óver die op de limiet zitten (geen afkap-verrassing
  door een bericht dat de klant niet vroeg).
