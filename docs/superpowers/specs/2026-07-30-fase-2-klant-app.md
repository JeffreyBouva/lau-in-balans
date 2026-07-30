# Lau in Balans — Fase 2: Klant-app (Expo) Design

Datum: 2026-07-30 · Status: goedgekeurd ontwerp, klaar voor implementatieplan

Vervolg op fase 1 (fundament). Bouwt de klant-app-UI pixel-precies uit de design handoff,
gekoppeld aan de echte (gehoste) Supabase. Bron voor alle maten/kleuren/copy/interacties:
`design_handoff_lau_in_balans/README.md` + `Lau in Balans - v1.dc.html` (high-fidelity,
definitief). De tokens staan al in `@lau/shared`.

## Besluiten (met Jeffrey vastgesteld)

| Besluit | Keuze |
|---|---|
| Datalaag in fase 2 | Echte Supabase meteen: login, echte reads/writes, onboarding schrijft profiel-v1 |
| AI-antwoorden | Bewust NIET in fase 2 — chat/log slaan echt op, maar Lau antwoordt pas in fase 3 |
| Open states (loading/error/leeg/offline) | Zelf sobere, toon-vaste defaults + lijst voor de designer |
| Meekijken | Verificatie in de iOS-simulator per plak; geen device-check door Jeffrey nodig |
| Chat-`send` in fase 2 | Ja — klant kan een bericht sturen (opgeslagen), zonder AI-antwoord |

## Scope & de grens met fase 3

**In fase 2:**

- **Login** (e-mail/wachtwoord, Supabase auth, sessie persistent).
- **Onboarding** (8 stappen) die bij afronding **profiel-v1** wegschrijft (`ai_profile_versions`,
  `versie 1`, `author null` = system) via de `klant_schrijft_versie_1`-policy.
- **Tabbar + 3 hoofdschermen** die live data lezen: Vandaag (voortgang), Lau.ai (chat), Eten (log).
- **Bottom sheet "Eten loggen"** → schrijft een `food_logs`-rij + een `messages`-log-rij.
- **Bottom sheet "Praat met Laura"** → schrijft een `flags`-rij; knop-status volgt de open flag.
- **Chat versturen**: klant-bericht wordt opgeslagen (`messages`, sender `client`).

**Bewust NIET in fase 2 (→ fase 3):** alle AI-antwoorden. De chat toont bestaande berichten en
laat sturen toe, maar er komt **geen** Lau-antwoord, geen typing-indicator-vervolg en geen
AI-reactie na een log. Die komen via de `lau-reply` Edge Function + prompt-builder + guardrails
in fase 3. Ook geen ochtendbericht/push (fase 6) en geen quick-reply-AI-logica.

## Architectuur

```text
apps/mobile/
├── app/                          # expo-router routes
│   ├── _layout.tsx               # root: fonts laden + SessieProvider + routing-gate
│   ├── (auth)/login.tsx          # loginscherm
│   ├── (onboarding)/_layout.tsx  # stack; stap-state in context
│   ├── (onboarding)/[stap].tsx   # of losse schermen per stap
│   └── (tabs)/
│       ├── _layout.tsx           # tabbar (Vandaag / Lau.ai / Eten)
│       ├── vandaag.tsx
│       ├── chat.tsx
│       └── eten.tsx
├── lib/
│   ├── supabase.ts               # bestaat al (fase 1)
│   ├── sessie.tsx                # SessieProvider + useSessie (auth-state, login, logout)
│   └── hooks/
│       ├── useProfiel.ts         # actief AI-profiel van de ingelogde klant
│       ├── useVoedingslogs.ts    # logs (dag + week), insert/update/delete
│       ├── useBerichten.ts       # messages + realtime-subscription, send
│       └── useFlag.ts            # open flag + aanmaken
├── components/                   # herbruikbare UI (bubbels, chips, stepper, sheet, avatar…)
│   ├── Sheet.tsx                 # scrim + lauSheet-animatie, sluiten via scrim-tik
│   ├── Handmaat-stepper, Chip, VoortgangsBalk, Bericht-bubbel, TabBar-item, …
└── theme/
    └── tokens.ts                 # re-export van @lau/shared tokens + RN-specifieke maps
                                  #   (fontfamilies per gewicht, tekststijlen, schaduwen)
```

- **Fonts**: `@expo-google-fonts/newsreader` + `@expo-google-fonts/dm-sans`, geladen in het
  root-layout met `expo-font`; splash blijft tot fonts klaar zijn. RN heeft de exacte
  font-namen per gewicht nodig (bijv. `Newsreader_400Regular`, `DMSans_500Medium`) — die map
  komt in `theme/tokens.ts` bovenop de kleur/radii/spacing-tokens uit `@lau/shared`.
- **Sessie-provider**: laadt de huidige Supabase-sessie (persistent via AsyncStorage), biedt
  `login/logout` en de ingelogde `clientId`. Het root-layout stuurt op basis daarvan naar
  `(auth)`, `(onboarding)` of `(tabs)`.
- **Datahooks**: elk één verantwoordelijkheid, bovenop `supabase-js`; geen globale store.
  `useBerichten` opent een realtime-subscription op `messages` (gefilterd op de eigen
  `client_id`) zodat fase 3's AI-antwoorden vanzelf binnenkomen.
- **Styling**: `StyleSheet.create` + tokens; geen NativeWind/Tamagui. Componenten klein en
  per verantwoordelijkheid gesplitst (een scherm componeert kleine bouwstenen).

## Schermen & databronnen

Exacte layout/maten/copy: de handoff. Hier de databinding per scherm.

- **Login** *(niet in de handoff — sober default in de huisstijl)*: e-mail + wachtwoord,
  primaire sage-knop, disclaimerregel. Fout → toon-vaste foutmelding. Bij succes route de
  sessie-gate door.
- **Onboarding** (stap 0–7): lokale stap-state (context). Multi-selects/tekstvelden zoals de
  handoff. Stap 7 "Naar Lau" → schrijft **profiel-v1** (doelen, voorkeuren, beperkingen,
  veiligheidsvlag uit stap 6, plus de defaults voor de overige velden) en navigeert naar de
  chat. Insert gebruikt `return=minimal` (klant mag het profiel daarna niet teruglezen — dat
  is coach-only).
- **Vandaag** (`useVoedingslogs` week + `useBerichten` voor contactdagen): week-N afgeleid uit
  `startdatum` (`weekNummer` uit `@lau/shared`); contactkaart (7 dagen), "wat opvalt"-kaart,
  eten-gemiddelden, "waar we aan werken", afspraak-blok. In fase 2 tonen "wat opvalt" en
  "waar we aan werken" nog **statische/afgeleide** samenvattingen (geen AI) — toon-vast en
  gemarkeerd als fase-3-verrijking.
- **Eten** (`useVoedingslogs` dag + week): vier portiekaarten met steppers (per handmaat,
  dagdoel uit het profiel/`@lau/shared`), slot-balken, weekkaart. `+`/`−` schrijft direct naar
  `food_logs` (of aggregeert een dag — zie Datamodel-notitie). "Lau kijkt mee"-kaart: statische
  regel op basis van de dagstand (geen AI).
- **Chat** (`useBerichten`): berichtenlijst (Lau/klant/log/Laura-bubbels), datumscheiding,
  disclaimerregel, quick-reply-rij, composer. Versturen slaat een `client`-bericht op. **Geen
  AI-antwoord** (fase 3). "Ik heb gegeten" opent de log-sheet; de Laura-knop opent de Laura-sheet.
- **Sheet — Eten loggen**: moment + vier steppers; "Bewaren" schrijft een `food_logs`-rij én een
  `messages`-log-rij, sluit, springt naar de chat waar de log-bubbel verschijnt (zonder AI-reactie).
- **Sheet — Praat met Laura**: textarea + redenchips; "Laura laten meekijken" schrijft een
  `flags`-rij (status open). State `sent`; de Laura-knop toont daarna de "verstuurd"-status
  (bolletje) zolang de flag open is.

### Datamodel-notitie (voedingslog)

De handoff toont een **dagstand** per handmaat (steppers op het Eten-scherm) én losse logs per
maaltijd (de log-sheet, en de weekkaart per dag). `food_logs` is per-maaltijd (`moment`,
`porties`, `datum`). Fase 2 kiest: het **Eten-scherm** toont/muteert de **dagsom** door de
`food_logs` van vandaag te aggregeren; een stepper-mutatie schrijft/actualiseert een impliciete
"dag"-log (moment afgeleid, of een dag-aggregatierij). De **log-sheet** maakt expliciete
maaltijdlogs met een gekozen moment. Beide tellen op tot dezelfde dagsom. De precieze mapping
(één dagrij bijwerken vs. per stepper-tik een rij) wordt in het plan vastgelegd; leidend is dat
de weekkaart en de dagstand consistent blijven en dat `klant_wijzigt/wist_eigen_logs` de mutaties
dekken (RLS uit fase 1).

## Open states (sobere defaults)

Toon-vaste defaults, bijgehouden in `docs/superpowers/open-design-questions.md`:

- **Loading**: rustige sage-spinner of skeleton in surface-kleur; nooit een harde flits.
- **Leeg**: korte, warme regel in `text/muted` (bijv. chat zonder berichten, week zonder logs).
- **Fout**: nette regel in de neutrale/clay-tint met een "opnieuw"-actie; geen technische tekst.
- **Offline**: subtiele banner; schrijfacties queueën niet in fase 2 (melden + opnieuw).
- **Escalatieflow achter "Rode vlag"**: niet in de klant-app (coach-kant); hier n.v.t.

Elke default die we invullen komt op de lijst zodat de designer 'm later kan aanscherpen.

## Guardrails in de UI (uit fase-1 spec, ook zonder AI relevant)

- Disclaimer in onboarding stap 0 én permanent onderaan de chat.
- Nergens calorieën/grammen/macro's — handmaten zijn de enige eenheid.
- De Laura-knop staat op elk hoofdscherm en is niet weg te configureren.
- Laura-berichten (mochten ze er zijn) visueel onderscheiden (eigen bubbelkleur).

## Bouwvolgorde

Elk een testbare, in de simulator te bekijken plak:

1. **Fonts/tokens + sessie** — theme/tokens, fontlaad in root-layout, SessieProvider + routing-gate.
2. **Login** — scherm + auth + doorrouteren (bestaande/nieuwe klant).
3. **Onboarding** — 8 stappen + profiel-v1 wegschrijven.
4. **Tabbar + Vandaag** — tabbar-component + het voortgangsscherm op echte data.
5. **Eten** — portiekaarten/steppers/weekkaart + food_log-mutaties.
6. **Chat** — berichtenlijst + composer + realtime + versturen (zonder AI).
7. **Bottom sheets** — Sheet-component + Eten-loggen + Praat-met-Laura, met hun writes.

## Testen

- **Unit** (vitest): scherm-/sheet-reducers (bijv. de log-draft, dagstand-aggregatie), en
  pure helpers; portie/week-berekening hergebruikt uit `@lau/shared` (al getest).
- **Datahooks**: dunne integratietests waar zinvol tegen de cloud (net als de RLS-tests) —
  bijv. dat een log-insert de dagsom verhoogt en dat een flag de knop-status omzet. Zwaartepunt
  blijft de RLS-suite uit fase 1 voor toegang.
- **Visueel**: per plak in de iOS-simulator vergelijken met de handoff (maten/kleuren/copy).
- Geen geautomatiseerde pixel-snapshots in fase 2.

## Bewust niet in fase 2

AI-antwoorden/prompt-builder/guardrail-evals (fase 3), coach-dashboard (fase 4), wekelijks
gesprek (fase 5), push/ochtendbericht/AVG-export/EAS-TestFlight (fase 6), geautomatiseerde
pixel-tests, offline-write-queue.

## Open punten & risico's

- **Onboarding vs. bestaande klant**: de seed gaf alleen Sanne een profiel. Onboarding testen
  we met een verse/profiel-loze klant (bijv. Noor, of een nieuw account); de hoofd-app met Sanne.
- **Voedingslog-mapping** (dagstand ↔ per-maaltijd-logs): definitieve keuze in het plan.
- **Ontbrekende designs** (login, states) vullen we sober in en loggen we voor de designer.
- **Fonts op device**: Google-Fonts-pakketten laden async; splash vasthouden tot klaar.
