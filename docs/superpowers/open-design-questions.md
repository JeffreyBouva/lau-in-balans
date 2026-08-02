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

## Dashboard-v2 — opvolgpunten (coach-dashboard, 2026-08-02)

Verzameld tijdens de bouw van §7 (klantenlijst), §8 (klantdetail) en §9 (wekelijks gesprek).
De maten en kleuren zijn gevolgd zoals de handoff ze voorschrijft; wat hieronder staat is
bewust **niet** stil aangepast.

### Contrast onder de WCAG AA-drempel (4,5:1 voor tekst < 24px)

De handoff schrijft deze combinaties voor en ze zijn zo gebouwd. Ze staan in de code
gemarkeerd met `contrast-opvolgpunt:`, zodat ze in één grep terug te vinden zijn.

| Paar | ≈ | Waar |
|---|---|---|
| `#A3A59A` op wit | 2,5:1 | eyebrows, tabelkop, "week N", "N/7", voetnoten, doorgestreepte oude waarde (§9) |
| `#A3A59A` op `#FBF9F5` / cream | 2,4:1 | hint-regel antwoordbalk, kop-eyebrow §9 |
| `#8C8F84` op `#F1EEE7` | 2,8:1 | "Stil"-pil (§7) |
| `#8C8F84` op `#FBF9F5` | 3,2:1 | uitleg-kaart kolom 2, veldnaam voorstelkaart (§9) |
| `#8C8F84` op wit | 3,3:1 | metaregel klantdetail, datum in de chrome, kaartkoppen |
| `#B0603F` op `#F6E7E0` | 3,5:1 | flag-banner-detail (§8) |
| `#63805F` op wit | 3,9:1 | savestatus kolom 2 ("opgeslagen" ↔ "wijziging niet bewaard") |
| `#6E7168` op `#EFEBE2` | 4,2:1 | inactieve filterpil (§7) |
| wit op `#63805F` | 4,4:1 | actieve filterpil (§7), "Toepassen" (§9) — bij 12,5px |

Ruim genoeg en dus géén punt: `#93472B` op `#F6E7E0` (5,6:1) en `#4C6749` op `#E7EEE3` (4,9:1).

**Vraag:** mogen de kleinste labels een tint donkerder (bijv. `#A3A59A` → `#8C8F84` en
`#8C8F84` → `#6E7168`), of is dit een bewuste keuze voor rust boven contrast? Het gaat om
tekst die betekenis draagt — een status-pil, een savestatus — niet om decoratie.

### Openstaande ontwerpvragen

- **Autosave in kolom 2** (aanname E5). Het profiel slaat nu expliciet op via de knop, met een
  zichtbare savestatus; élke opslag is een nieuwe versie, dus autosave zou de versiehistorie
  vollopen. De handoff noemt autosave wel als productienoot. **Vraag:** autosave met debounce
  (en dan versies samenvoegen binnen een tijdvenster), of expliciet opslaan houden?
- **Gespreksgeschiedenis** (aanname E7). `weekly_sessions` bewaart elke sessie met notitie,
  signalen en de genomen besluiten, maar er is nog geen scherm dat oude gesprekken terugtoont —
  §9 gaat alleen over het gesprek van vandaag. **Vraag:** waar hoort die historie: als tijdlijn
  in het klantdetail, of als uitklap in het gespreksscherm zelf?
- **Escalatieflow achter "Rode vlag".** De chip bestaat sinds §9 en wordt vastgelegd in
  `weekly_sessions.signalen`, maar hij doet verder niets — de handoff verwijst hier naar de
  designer. **Vraag:** wat gebeurt er na het aanvinken? (doorverwijsbrief, taak voor Laura,
  markering op de klant, melding aan een behandelaar?) Dit raakt guardrail 4, dus het is de
  belangrijkste van deze drie.
