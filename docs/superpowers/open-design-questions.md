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
bewust **niet** stil aangepast. Het contrastpunt is inmiddels wél opgelost (2026-08-03,
feedbackronde 1 punt 9) — de maten, layout en fonts staan nog altijd zoals de handoff ze
voorschrijft, alleen de tekstkleuren zijn binnen het palet een stap donkerder gezet.

### Contrast onder de WCAG AA-drempel (4,5:1 voor tekst < 24px) — OPGELOST 2026-08-03

De vraag hieronder is beantwoord door Jeffrey (feedbackronde 1, punt 9): *"Het dashboard mist
soms nog wel wat contrast, dan is de tekst te zacht gekleurd tegen de achtergrond. Kun je daar
nog een optimalisatie op doen zonder het hele design naar de klote te helpen."* Alle 31
`contrast-opvolgpunt`-markeringen zijn verwerkt; er staan er nog twee in de code (zie
"Bewust gelaten" onderaan).

> **De oorspronkelijke vraag was:** mogen de kleinste labels een tint donkerder (bijv.
> `#A3A59A` → `#8C8F84` en `#8C8F84` → `#6E7168`), of is dit een bewuste keuze voor rust
> boven contrast? Antwoord: donkerder mag, maar binnen het merkpalet en zonder layout-,
> font- of maatwijzigingen.

#### De regel die nu geldt

Tekst die informatie draagt haalt ≥ 4,5:1. Het palet heeft precies drie tekstkleuren die dat
lukt: `ink #262A24`, `body #5E6259` en `body-soft #6E7168`. `muted #8C8F84` (3,3:1 op wit) en
`muted-softer #A3A59A` (2,5:1) halen het nergens en zijn daarom als tékstkleur uit het
dashboard verdwenen — ze staan nog wel in `globals.css`, want dat bestand is de spiegel van
`packages/shared/src/tokens.ts`.

Twee zachtheidsniveaus blijven bestaan; welk niveau mag hangt af van de achtergrond:

| Achtergrond | zachtste kleur die AA haalt | ratio |
|---|---|---|
| wit `#FFFFFF` | `body-soft` | 4,97:1 |
| surface-sunken `#FBF9F5` | `body-soft` | 4,73:1 |
| sage-tint `#FBFDFA` | `body-soft` | 4,86:1 |
| cream `#F6F3ED` | `body` (body-soft haalt 4,49:1 — 0,01 tekort) | 5,63:1 |
| neutral-soft `#EFEBE2` / neutral-softer `#F1EEE7` | `body` | 5,24 / 5,38:1 |

Toegepast als: `muted-softer` → `body-soft` (op cream/neutral → `body`), `muted` → `body`.
Waar het ontwerp een soft/ink-paar heeft, is de ink-helft gekozen; waar het een accent
gebruikte, de eerstvolgende donkerdere tint van dezelfde familie.

#### Wat er is veranderd (gemeten, WCAG relative luminance)

| Paar | voor | na | waar |
|---|---|---|---|
| `#A3A59A` → `#6E7168` op wit | 2,50 | **4,97** | tabelkop §7, "week N", "N/7", "· coach", voetnoot handmaten, notitiedatum, eyebrows §9, teller voorstellen, logs-zin |
| `#A3A59A` → `#6E7168` op `#FBF9F5` | 2,38 | **4,73** | hint-regel antwoordbalk, doorgestreepte oude waarde §9 |
| `#A3A59A` → `#5E6259` op cream | 2,26 | **5,63** | eyebrows §8 (de drie kolommen staan op cream), dagscheider in de chat, kop-eyebrow §9, voetnoot klantenlijst, "Lau coacht dagelijks" |
| `#6E7168` → `#5E6259` op cream | 4,49 | **5,63** | teller onder de dashboardkop ("3 actief · 1 wacht op jou") |
| `#8C8F84` → `#5E6259` op wit | 3,29 | **6,24** | gespreksdatum §7, datum in de chrome, metaregel klantdetail, kaartkoppen §8, "Overslaan" §9, uitgezette veiligheidschip |
| `#8C8F84` → `#5E6259` op `#FBF9F5` | 3,13 | **5,93** | uitleg-kaart kolom 2, veldnaam voorstelkaart §9 |
| `#8C8F84` → `#5E6259` op cream | 2,97 | **5,63** | veldlabels kolom 2, versiehistorie, lege-lijst-melding |
| `#8C8F84` → `#5E6259` op `#F1EEE7` | 2,84 | **5,38** | "Stil"-pil §7, "Overgeslagen"-pil §9, uitgezette chip kolom 2 |
| `#6E7168` → `#5E6259` op `#EFEBE2` | 4,18 | **5,24** | "Nieuw"/"Gestopt"-pil §7, avatar-initialen in de rij |
| `#8C8F84` → `#6E7168` (placeholders) | 3,29 | **4,97** | alle input-/textarea-placeholders — bewust body-**soft** en niet body, zodat een leeg veld leeg blijft ogen |
| `#63805F` → `#4C6749` op cream | 3,96 | **5,67** | savestatus kolom 2 ("opgeslagen" ↔ "wijziging niet bewaard") |
| `#6D8A68` → `#4C6749` op `#E7EEE3` | 3,23 | **5,30** | eyebrow log-bubbel §8, eyebrow prompt-preview §9 |
| `#B0603F` → `#93472B` op `#F6E7E0` | 3,80 | **5,49** | "Open sinds …" in de flag-banner §8 |
| wit op `#63805F` → op `#4C6749` | 4,39 | **6,28** | actieve filterpil §7, "Wekelijks gesprek", "Toepassen" §9 |
| wit op hover `#63805F` → `#55714F` | 4,39 | **5,44** | hover van `Knop` variant `primair` — licht nog steeds op, alleen een tint minder ver |

(De oude tabel noemde 3,5:1 voor de flag-banner; nagerekend is dat 3,80:1.)

#### Wat dit kost aan hiërarchie

- **Ingeleverd, want het palet heeft geen tint tussen `muted` en `body-soft`:** waar
  `muted` en `muted-softer` naast elkaar stonden op hetzelfde vlak, vallen ze nu samen.
  Concreet: in de handmaten-kaart is de kop even donker als de regels eronder, en de
  uitgezette chip in kolom 2 verschilt van een aanstaande chip alleen nog door de doorhaling
  (plus `aria-pressed`, dat het al deed). Op de drie kolommen van §8 — die op cream staan —
  vallen eyebrow en veldlabel samen in `body`.
- **Behouden:** de zacht/zachter-tweedeling waar de achtergrond het toelaat (wit, sunken,
  sage-tint) — daar staat het tertiaire niveau in `body-soft` en het secundaire in `body`.
  En de hiërarchie die niet aan kleur hangt: 11px uppercase + 0,12em tracking voor eyebrows,
  12px voor labels, 13,5–15px voor lopende tekst, serif voor koppen.

#### Bewust gelaten

- **Laura-monogram** (`#8C6A56` op `#EFEBE2`, 4,09:1) in de chrome en in de antwoordbalk.
  Beide zijn `aria-hidden` decoratie — de naam staat er in een `sr-only`-regel resp. in het
  label van het invoerveld naast — en de Laura-familie heeft geen donkerdere ink die niet
  "hover" of "bubbel" betekent. Staat als enige nog met `contrast-opvolgpunt:` in de code.
- **Niet-tekstuele elementen:** voortgangsbalken (`#C7BEAE` / sage), handmaat-markers,
  hairlines, gestippelde randen, het clay-bolletje in de flag-banner. WCAG 1.4.3 gaat over
  tekst; deze dragen geen informatie die niet ook in woorden staat.
- **Uitgeschakelde knoppen** (`disabled:opacity-60/70`). WCAG zondert inactieve controls uit,
  en de opacity is precies het signaal dát ze inactief zijn.

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
