# Open design-vragen — voor Laura's designer

Onderdelen die de design handoff bewust openliet of die we in fase 2 sober zelf hebben
ingevuld. Elk item: waar het zit, wat we nu doen, en de vraag aan de designer. Verzameld
tijdens de bouw van de klant-app (fase 2, 2026-07-30).

## Niet-ontworpen schermen die we sober hebben ingevuld

- **Loginscherm** (`app/(auth)/login.tsx`). De handoff start bij de onboarding; er is geen
  login-ontwerp. Nu: rustig scherm in de huisstijl (merknaam serif/sage, e-mail + wachtwoord
  in de onboarding-input-stijl, primaire sage-knop, foutregel in `clayInk`).
  **Vraag:** hoe wil je het login-/welkomscherm? Logo? "Wachtwoord vergeten"? Registratie?

## States die de handoff openliet ("vraag terug bij de designer")

- **Loading / skeleton.** Nu: rustige laadmomenten, geen harde flits; data verschijnt zodra
  binnen. Nog geen skeletons. **Vraag:** wil je skeleton-placeholders per scherm, of volstaat
  een subtiele spinner?
- **Lege staten.** Chat zonder berichten, week zonder logs, nieuwe klant zonder data. Nu:
  korte warme regel in `text/muted` / een "nog niets gelogd"-variant op het Eten-scherm.
  **Vraag:** definitieve copy + eventueel een illustratieloze rustkaart per lege staat.
- **Foutmeldingen.** Nu: nette regel in de neutrale/clay-tint (bijv. mislukte login). Geen
  technische tekst. **Vraag:** toon + plek van fouten (inline vs. banner vs. toast).
- **Offline.** Nu: geen offline-write-queue; schrijfacties melden en laten opnieuw proberen.
  **Vraag:** hoe zichtbaar moet offline zijn, en moeten logs/berichten offline queueën?
- **Escalatieflow achter "Rode vlag".** Coach-kant (dashboard), niet de klant-app — hier n.v.t.

## Bewuste fase-2-keuzes die aanscherping kunnen gebruiken

- **Voedingslog: dagstand ↔ per-maaltijd.** `food_logs` is per maaltijd; het Eten-scherm toont
  de **dagsom** en de steppers muteren één "quick"-rij (`bron:'eten'`, `moment:'Tussendoor'`),
  terwijl de log-sheet aparte maaltijdrijen maakt (`bron:'chat'`, gekozen moment). `−` klemt de
  quick-rij op 0. **Vraag:** klopt dit mentale model, of wil je dat de steppers per maaltijd
  werken i.p.v. een dagbucket?
- **Weekkaart-staafjes** (Eten + Vandaag) tonen "aantal gelogde handmaten per dag" (0–4), niet
  de som van porties — dat matcht de handoff-demo `[3,4,3,0,4,2,0]` en houdt de schaal compact.
  **Vraag:** is "aantal handmaten" de bedoelde maat, of iets anders?
- **"Wat opvalt" (Vandaag) en "Lau kijkt mee" (Eten)** tonen nu **statische, afgeleide** regels
  (geen AI). In fase 3 verrijkt de AI deze. **Vraag:** welke toon/inhoud voor de niet-AI-fallback?
- **Reden-chips in de Laura-sheet** hergebruiken het gedeelde `Chip`-component (padding 12/18,
  14.5px) i.p.v. de § 6-waarden (10/15, 13px). **Vraag:** pixel-exacte reden-chips gewenst, of
  is de gedeelde chip-stijl prima?

## Technische UX-punten (geen designvraag, wel te doen)

- **Toetsenbord in de chat.** De composer heeft nog geen `KeyboardAvoidingView` (zou vechten
  met de vaste tabbar-clearance). Nette toetsenbord-afhandeling volgt in een latere iteratie.
- **AI-antwoorden** (chat-reactie, log-reactie, ochtendbericht, typing-indicator) staan
  gemarkeerd met `// fase 3` en komen via de `lau-reply` Edge Function + prompt-builder + guardrails.
