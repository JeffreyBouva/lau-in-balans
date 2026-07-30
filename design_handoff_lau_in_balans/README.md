# Handoff: Lau in Balans — MVP webapp (klant-app + coach-dashboard)

## Overview

**Lau in Balans** is een leefstijl-coachingsproduct van Laura (menselijke coach). De MVP bestaat uit **twee losstaande applicaties** die één datamodel delen:

1. **Klant-app (mobiel)** — Vrouwen 28–45, druk gezinsleven, doel: duurzaam afvallen. Ze chatten dagelijks met **Lau.ai**, een AI-coach die per klant door Laura is ingesteld. Ze houden hun voeding bij op **handmaten** (geen calorieën). Ze kunnen op elk moment **Laura erbij halen** ("praat met een mens").
2. **Coach-dashboard (desktop)** — Laura ziet haar klanten, leest de gesprekken mee, kan zelf antwoorden als Laura, en stelt na het wekelijkse videogesprek (30 min) het **per-klant AI-profiel** bij. Dat profiel is de personalisatielaag van de prompt van Lau.ai.

Kern van het product: **AI doet het dagelijkse werk, de mens doet de wekelijkse richting.** De AI is nooit autonoom — alles wat Lau.ai zegt volgt uit een profiel dat Laura beheert.

---

## About the Design Files

De bestanden in dit pakket zijn **design references in HTML** — prototypes die het beoogde uiterlijk en gedrag laten zien. Het is **geen productiecode om over te nemen**.

De opdracht is om deze designs **na te bouwen in de bestaande omgeving van de doelcodebase** (React, Vue, React Native, SwiftUI, Flutter, wat er ook staat) met de daar gevestigde patterns, component-library en state-oplossing. Bestaat er nog geen codebase, kies dan het framework dat past bij het product (voor deze MVP ligt een web-app met React + een mobile-first PWA, of React Native voor de klant-app, het meest voor de hand) en implementeer de designs daar.

De HTML gebruikt een streaming-template-runtime (`support.js`, `<x-dc>`, `<sc-for>`, `<sc-if>`). **Negeer die runtime volledig** — hij is een prototyping-hulpmiddel, geen architectuurvoorstel. Wat je overneemt: layout, maten, kleuren, typografie, copy, states en interactielogica.

Alle styling in de prototypes staat inline. In de echte codebase horen die waarden in de tokens/thema-laag te landen (zie **Design Tokens**), niet inline.

## Fidelity

**High-fidelity.** Definitieve kleuren, typografie, spacing, radii, copy en interacties. Bouw het pixel-nauwkeurig na met de libraries van de codebase.

Uitzonderingen die bewust nog open staan:
- **Iconografie**: de prototypes gebruiken tekstglyphs (`←`, `↑`, `−`, `+`, `✓`, `i`) en gekleurde vierkantjes als placeholders. Vervang door de icon-set van de codebase (of Lucide/Phosphor bij een nieuw project). De gekleurde vierkantjes bij de handmaten mogen iconen worden (handpalm / vuist / holle hand / duim) — dat is zelfs sterk aan te raden.
- **Avatars**: initialen op een gekleurde cirkel. Vervang door echte foto's zodra beschikbaar, met initialen als fallback.
- **Illustraties/imagery**: geen enkele in dit design. Bewust — het product is tekst en rust.

---

## Bestanden in dit pakket

| Bestand | Wat het is |
|---|---|
| `Lau in Balans - v1.dc.html` | **De te bouwen versie.** Beide apps, alle 7+ schermen, volledig klikbaar. |
| `Lau in Balans - Concept A.dc.html` | Verworpen variant (referentie: los "Praat met Laura"-scherm, geen eten-logging). |
| `Lau in Balans - Concept B.dc.html` | Verworpen variant (referentie: intake in de chat, triage-eerst dashboard, live prompt-preview). |
| `support.js` | Runtime van het prototype. **Niet nodig voor implementatie.** |

De verworpen concepten zitten erbij voor context — v1 nam uit B de **bottom-sheet voor Laura** en de **antwoordbalk in het coach-transcript** over.

Openen: elk `.dc.html`-bestand direct in de browser. Bovenaan schakel je tussen **Klant-app** en **Coach-dashboard**; daaronder staat een rij "spring naar"-knoppen per scherm. Die twee rijen zijn **prototype-navigatie en horen niet in het product**.

---

## Design Tokens

### Kleuren

| Token | Hex | Gebruik |
|---|---|---|
| `bg/desk` | `#EAE6DE` | Achtergrond van de prototype-pagina. **Niet in het product** — alleen het canvas rond de mockup. |
| `bg/app` | `#F6F3ED` | App-achtergrond (klant én coach), en de bottom sheets. |
| `bg/surface` | `#FFFFFF` | Kaarten, inputs, bubbels van Lau, tabelrijen, coach-header. |
| `bg/surface-sunken` | `#FBF9F5` | Textarea in het wekelijkse gesprek, coach-antwoordbalk, niet-toegepaste voorstelkaart. |
| `bg/neutral-soft` | `#EFEBE2` | Lege portie-slots, neutrale avatars, week-staafjes zonder log, kleine info-cirkel. |
| `bg/neutral-softer` | `#F1EEE7` | Neutrale chips in het AI-profiel, status "Stil". |
| `line/hairline` | `#DCD6CA` | Standaard rand: inputs, secundaire buttons, telefoon-bezel, kaartranden in de coach-header. |
| `line/hairline-soft` | `#E5E0D6` | Kaartranden op app-achtergrond, scheidingslijnen in het dashboard. |
| `line/hairline-softer` | `#E9E4DA` | Rand van Lau-chatbubbels, chat-header-scheiding. |
| `line/table-row` | `#F1EEE7` | Rijscheiding in de klantentabel. |
| `line/table-head` | `#EDE8DE` | Onder de tabelkop; ranin coach-detailkaarten. |
| `line/dashed` | `#D3CCBE` | Gestippelde randen (afspraak-blok, handmaat-uitleg). |
| `text/ink` | `#262A24` | Koppen, primaire tekst, input-tekst. |
| `text/body` | `#5E6259` | Bodytekst, labels in lijsten. |
| `text/body-soft` | `#6E7168` | Secundaire bodytekst, hulptekst. |
| `text/muted` | `#8C8F84` | Metadata, subtitels. |
| `text/muted-soft` | `#9A9C91` | Voetnoten, disclaimers, placeholder-achtige tekst. |
| `text/muted-softer` | `#A3A59A` | Kleinste labels, uppercase-eyebrows, datums. |
| `accent/sage` | `#63805F` | **Primair accent (klantkant).** Primaire buttons, actieve staat, voortgangsbalk, eiwit-marker, verzendknop. |
| `accent/sage-hover` | `#55714F` | Hover op primaire buttons. |
| `accent/sage-deep` | `#4C6749` | Tekst op sage-soft, donkere variant primaire button in het gesprek. |
| `accent/sage-deeper` | `#3D5539` | Hover op `sage-deep`; tekst op geselecteerde chips. |
| `accent/sage-soft` | `#E7EEE3` | Vlakken: klantbubbels, "wat opvalt"-kaart, log-kaart in chat, actieve status. |
| `accent/sage-soft-border` | `#CFE0C8` | Rand op sage-soft vlakken (week-staafjes met log, toegepaste voorstelkaart). |
| `accent/sage-ink` | `#37452F` | Tekst op sage-soft (donkerst). |
| `accent/sage-mid` | `#6D8A68` | Uppercase-eyebrow op sage-soft vlakken. |
| `accent/sage-tint` | `#FBFDFA` | Achtergrond van een toegepaste voorstelkaart. |
| `accent/clay` | `#B0603F` | **Alleen coachkant + flags.** Flag-indicator, linkerrand van een wachtende rij, "rode vlag"-chip. |
| `accent/clay-soft` | `#F6E7E0` | Flag-banner, avatar van een wachtende klant, "Wacht op jou"-status. |
| `accent/clay-border` | `#EDD5C9` | Rand van de flag-banner en Laura-bubbels. |
| `accent/clay-ink` | `#93472B` | Tekst op clay-soft. |
| `laura/bubble-bg` | `#FBEFE8` | Achtergrond van een bericht dat Laura zelf stuurde. |
| `laura/bubble-ink` | `#6E4331` | Tekst in een Laura-bubbel. |
| `laura/avatar-bg` | `#EFEBE2` | Avatar van Laura. |
| `laura/avatar-ink` | `#8C6A56` | Initialen "La"; verzendknop van de coach. |
| `laura/avatar-ink-hover` | `#765645` | Hover op die verzendknop. |
| `food/eiwit` | `#63805F` | Handmaat eiwit (= sage). |
| `food/groente` | `#7E9C6E` | Handmaat groente. |
| `food/koolhydraten` | `#C1A277` | Handmaat koolhydraten. |
| `food/vet` | `#B0603F` | Handmaat vetten (= clay). |
| `overlay/scrim` | `rgba(38, 42, 36, .3)` | Achter een bottom sheet, met `backdrop-filter: blur(2px)`. |

**Kleurregel die je moet respecteren:** groen = de klant en zijn voortgang. Terracotta = **uitsluitend** aandacht-voor-de-coach (flags, achterblijvende waarden, rode vlaggen) en de identiteit van Laura-als-mens. Terracotta mag nooit als decoratie in de klant-app opduiken, behalve als handmaat-kleur voor vetten en in Laura's avatar/bubbel.

### Typografie

Twee families, van Google Fonts:

- **Newsreader** (serif) — `300, 400, 500`, ook italic beschikbaar. Voor koppen, uitspraken, en tekst waar rust en menselijkheid nodig is.
- **DM Sans** (sans) — `300, 400, 500`. Voor UI, bodytekst, labels, alle interface-elementen.

```
https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,300;0,6..72,400;0,6..72,500&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500&display=swap
```

Schaal zoals gebruikt (alle gewichten 400 tenzij vermeld):

| Rol | Font | Size | Line-height | Letter-spacing |
|---|---|---|---|---|
| Onboarding-hero | Newsreader | 34px | 1.2 | −.015em |
| Scherm-titel (klant) | Newsreader | 28–30px | 1.2–1.25 | −.01 / −.015em |
| Sheet-titel | Newsreader | 26px | 1.2 | −.01em |
| Dashboard-titel | Newsreader | 28px | normal | −.01em |
| Klantnaam (coach-detail) | Newsreader | 21px | normal | — |
| Uitspraak / "wat opvalt" | Newsreader | 21px | 1.4 | — |
| Prompt-preview (coach) | Newsreader | 18px | 1.5 | — |
| Chat-header naam | Newsreader | 19px | normal | — |
| Body groot | DM Sans | 16px | 1.65 | — |
| Body / chatbubbel | DM Sans | 15px | 1.55–1.6 | — |
| Body klein | DM Sans | 14–14.5px | 1.5–1.6 | — |
| Label / metadata | DM Sans | 13–13.5px | 1.5–1.6 | — |
| Caption | DM Sans | 12–12.5px | 1.5–1.55 | — |
| Eyebrow (uppercase) | DM Sans | 11–12px | — | .12–.16em, `uppercase` |
| Kleinste label | DM Sans | 11–11.5px | — | — |

`text-wrap: pretty` staat op alle lopende tekstblokken en koppen.

### Spacing, radii, shadows

- **Spacing** volgt een 2px-grid, praktisch: `2 4 6 7 8 10 11 12 13 14 16 17 18 20 22 24 26 28 30 32 40 44`. Meest gebruikt: `gap: 8/10/12/14/18/20/22`, `padding: 14px 16px` t/m `24px`.
- **Radii**: `4px` (handmaat-marker) · `6px` (bubbel-punt) · `10–12px` (kleine controls) · `14px` (input, kleine kaart) · `18px` (kaart) · `20px` (grote kaart, bubbel) · `24px` (voortgangskaart) · `26px` (sheet-top, telefoon in concept B) · `30px` (telefoon-bezel, sheet-top v1) · `999px` (pill, avatar, alle ronde buttons).
- **Shadows**:
  - Telefoon: `0 24px 60px -30px rgba(38, 42, 36, .35)`
  - Dashboard-venster: `0 24px 60px -34px rgba(38, 42, 36, .3)`
  - Bottom sheet: `0 -20px 50px -24px rgba(38, 42, 36, .4)`
  - Actieve tab in de tabbar: `0 2px 10px -4px rgba(38, 42, 36, .25)`
  - Flag-markering op tabelrij: `inset 3px 0 0 #B0603F` (geen echte shadow — een linkerrand)
- **Transitions**: `all .15s–.18s ease` op chips/buttons/kaarten; `width .35s ease` op de voortgangsbalk.

### Animaties (keyframes)

```css
@keyframes lauFade  { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
@keyframes lauSheet { from { transform: translateY(100%); }            to { transform: none; } }
@keyframes lauDot   { 0%, 60%, 100% { opacity: .25; } 30% { opacity: 1; } }
```

- `lauFade` — `.4s–.5s ease both`, op elke onboardingstap en op bevestigingsschermen.
- `lauSheet` — `.34s cubic-bezier(.22,.8,.3,1) both`, op bottom sheets.
- `lauDot` — `1.2s infinite` op drie 6px-bolletjes, met `.2s` en `.4s` delay. Typing-indicator.

### Afmetingen van de frames

- **Klant-app**: 390 × 844 (iPhone-logisch), radius 30px, 1px rand `#DCD6CA`. Geen device-bezel, geen statusbar — bewuste keuze van de klant.
- **Coach-dashboard**: max 1320px breed, 880px hoog, radius 18px. In productie: gewoon fullscreen responsive vanaf ~1200px; onder 1200px is het dashboard niet ontworpen (geef een melding of stapel de kolommen).

---

## Klant-app (mobiel)

Drie hoofdschermen achter een tabbar, plus een onboarding-flow ervoor, plus twee bottom sheets die over álles heen kunnen.

### Tabbar (persistent op alle hoofdschermen)

Absoluut gepositioneerd: `left/right/bottom: 0`, `padding: 12px 22px 22px`, achtergrond `linear-gradient(to top, #F6F3ED 65%, rgba(246,243,237,0))`, `display: flex; gap: 8px`.

Drie tabs, elk `flex: 1`, `padding: 13px 0`, `border-radius: 999px`, geen rand, 13px:
| Tab | Doel |
|---|---|
| **Vandaag** | Voortgangsscherm |
| **Lau.ai** | Chat |
| **Eten** | Voedingslog |

Actief: achtergrond `#FFFFFF`, tekst `#262A24`, shadow `0 2px 10px -4px rgba(38,42,36,.25)`. Inactief: transparant, tekst `#8C8F84`.

Elk scherm dat de tabbar toont moet `padding-bottom: 110px` in zijn scrollgebied hebben (chat: `92px` op de composer, omdat die zelf boven de tabbar zit).

### 1. Onboarding — 8 stappen

Doel: Lau leren wie je bent, zonder dat het als formulier voelt. Alles is later aanpasbaar.

**Header** (`padding: 26px 26px 0`): merknaam links (Newsreader 15px, `#63805F`, letter-spacing .02em), stap-indicator rechts (12px, `#9A9C91`, "Stap N van 7" of "Klaar"). Daaronder een voortgangsbalk: 3px hoog, rail `#E5E0D6`, fill `#63805F`, breedte = `(stap+1)/8`, `transition: width .35s ease`, radius 999px.

**Body**: `flex: 1; overflow: auto; padding: 30px 26px 24px`, elke stap `animation: lauFade .4s ease both`.

**Footer**: `padding: 16px 26px 26px`, achtergrond `linear-gradient(to top, #F6F3ED 60%, transparent)`. Terug-button (52×52, rond, wit, rand `#DCD6CA`, `←`) alleen vanaf stap 2. Primaire button `flex: 1`, hoogte 52, radius 999, `#63805F`, wit, 16px; hover `#55714F`.

| # | Titel | Inhoud | CTA |
|---|---|---|---|
| 0 | "Fijn dat je er bent." | 64px sage-soft cirkel met "L" (Newsreader 26px). Twee alinea's 16px/1.65 `#5E6259`. Disclaimer-kaart (wit, rand, radius 18, 13px/1.6 `#6E7168`). | Laten we beginnen |
| 1 | "Waar wil je naartoe?" | Multi-select chips: Duurzaam afvallen · Meer energie · Minder snacken 's avonds · Rust rond eten · Betere routine met het gezin. Default aan: *Duurzaam afvallen*. | Verder |
| 2 | "Hoe ziet je week eruit?" | Multi-select: Druk gezin · Werk 3 dagen · Wisselende diensten · Vaak buitenshuis eten · Sport 2x per week. Voetnoot: "Vertel later gerust meer in de chat — ik onthoud het." | Verder |
| 3 | "Wat eet je graag?" | Multi-select: Alles · Weinig vlees · Vegetarisch · Geen vis · Snel klaar (< 25 min). Plus vrij tekstveld "Wat eet je liever niet?" (placeholder "bijv. vis, kwark, pittig"). | Verder |
| 4 | "Is er iets waar ik op moet letten?" | Multi-select: Noten-allergie · Lactose-intolerant · Glutenvrij · Medicatie · Geen van deze. Vrij tekstveld. Info-kaart: "Laura leest dit als eerste." | Verder |
| 5 | "Zo houden we je eten bij." | **Uitleg handmaten.** Alinea over géén calorieën / eigen hand als maat. Vier kaarten (wit, rand, radius 18, `padding: 15px 17px`, `gap: 14`): 14px gekleurd vierkantje (radius 4) + hand-naam 15px `#262A24` + uitleg 13px `#8C8F84`. Voetnoot over "twee tikken". | Duidelijk |
| 6 | "Nog één vraag, en die mag je overslaan." | **Veiligheidsvraag** over relatie met eten/lichaam. Drie single-select opties, elk een volle-breedte kaart (`text-align: left`, radius 18, `padding: 16px 18px`, 15px/1.5): "Nee, dat speelt niet bij mij" · "Soms wel — houd er rekening mee" · "Ja, daar wil ik voorzichtig mee zijn". Daaronder een sage-soft kaart met de uitleg dat dit bepaalt *hoe* Lau praat, niet of je welkom bent, plus doorverwijzing. Tekstlink "Sla deze vraag over" (14px, `#9A9C91`, underline offset 3px) → springt naar stap 7. | Verder |
| 7 | "Dank je, Sanne. Ik weet genoeg om te beginnen." | Sage cirkel "L". Alinea. Kaart "Je eerste week" met 3 regels: ochtendbericht / loggen op handmaten / "Donderdag 20 aug · eerste gesprek met Laura, 30 minuten." | Naar Lau |

**Chip-stijl** (overal in onboarding): `padding: 12px 18px`, radius 999, 14.5px. Uit: wit + rand `#E5E0D6` + tekst `#5E6259`. Aan: `#E7EEE3` + rand `#63805F` + tekst `#3D5539`.

**Input-stijl**: volle breedte, `padding: 14px 16px`, rand `#E5E0D6`, radius 14, wit, 15px, `outline: none`.

### 2. Chat met Lau.ai

**Header** (`padding: 22px 22px 14px`, achtergrond `#F6F3ED`, onderrand `#E9E4DA`, `gap: 13`): 42px sage-soft cirkel "L" · naam "Lau.ai" (Newsreader 19px) + "Ingesteld door Laura · week 3" (12px `#8C8F84`) · **Laura-knop** rechts (zie Laura-knop hieronder).

**Berichtenlijst** (`flex: 1; overflow: auto; padding: 22px 22px 8px; gap: 14`), autoscrollt naar onder bij nieuwe berichten en bij het aanzetten van de typing-indicator. Bovenaan een datumscheiding: gecentreerd, 12px `#A3A59A`.

Drie berichttypes:

| Type | Uitlijning | Stijl |
|---|---|---|
| **Lau** (`ai`) | links | max-width 82%, `padding: 14px 18px`, radius `20px 20px 20px 6px`, wit, rand `#E9E4DA`, tekst `#3D4139`, 15px/1.6 |
| **Klant** (`me`) | rechts | max-width 78%, `padding: 14px 18px`, radius `20px 20px 6px 20px`, `#E7EEE3`, tekst `#37452F`, 15px/1.55 |
| **Voedingslog** (`log`) | rechts | max-width 82%, `padding: 15px 17px`, radius `20px 20px 6px 20px`, `#E7EEE3`. Binnen: eyebrow met het moment (12px, uppercase, .1em, `#6D8A68`), daaronder per portie een regel: 11px gekleurd vierkantje + "2 × vuist groente" (14.5px `#37452F`), `gap: 7` |
| **Laura** (`laura`) | links | max-width 82%, radius `20px 20px 20px 6px`, `#FBEFE8`, rand `#EDD5C9`, tekst `#6E4331`. *Komt voor in het coach-transcript; in de klant-app is dit het type dat je moet gebruiken als Laura zelf antwoordt.* |

**Typing-indicator**: links, `padding: 14px 18px`, wit + rand, radius `20px 20px 20px 6px`, drie 6px sage-bolletjes met `lauDot`.

**Disclaimer-regel** onderaan de lijst (niet in een bubbel): 24px `#EFEBE2` cirkel met "i" + "Lau geeft geen medisch advies. Laura leest mee." (12px `#9A9C91`).

**Quick-reply-rij** (`padding: 0 22px 8px`, horizontaal scrollbaar, `gap: 8`). Eerste chip is speciaal:
- **"Ik heb gegeten"** — rand `#63805F`, achtergrond `#E7EEE3`, tekst `#3D5539`, met een 7px sage bolletje ervoor. Opent de log-sheet. Hover `#DEE8D8`.
- Daarna: "Wat eet ik vanavond?" · "Ik heb trek" · "Hoe ga ik om met een etentje?" · "Ik ben moe vandaag" — wit, rand `#DCD6CA`, 13px `#5E6259`; hover rand `#63805F` + tekst `#4C6749`. Klik = verstuurt die tekst als bericht van de klant.

**Composer** (`padding: 12px 22px 92px`, achtergrond `#F6F3ED`): input `flex: 1`, `padding: 15px 18px`, rand `#DCD6CA`, radius 999, wit, 15px, placeholder "Schrijf iets aan Lau…". Enter verstuurt. Verzendknop 48×48 rond `#63805F` met `↑`; hover `#55714F`. De bottom-padding van 92px houdt de composer vrij van de tabbar — implementeer dat in de echte app liever als een `safe-area` + tabbar-hoogte.

**Antwoordlogica in het prototype** (keyword-matching, 1100ms delay). Dit is een **demo-stand-in voor de echte LLM-call**, maar de antwoorden zijn zorgvuldig geschreven en tonen precies de gewenste toon en inhoudelijke lijn. Neem ze mee als few-shot-voorbeelden of fixtures:

| Trigger (lowercase, substring) | Antwoord |
|---|---|
| `vanavond`, of `wat` + `eet` | "Je hebt kip in huis en de kinderen eten mee, zei je maandag. Kip met zoete aardappel uit de oven en een grote bak sla: één handpalm kip voor jou, twee vuisten groente, een holle hand aardappel. Twintig minuten, één plaat." |
| `trek`, `honger` | "Even kijken naar vandaag: je zit op twee handpalmen eiwit. Dat is meestal waar de trek vandaan komt. Kwark met kaneel of een handje kip werkt beter dan je ertegen verzetten." |
| `etentje`, `restaurant`, `weekend` | "Een etentje hoef je niet goed te maken. Eet ervoor normaal, kies wat je echt lekker vindt, stop als je genoeg hebt. Loggen mag je overslaan — morgen pak je de gewone dag weer op." |
| `laura` | "Dat kan altijd. Tik op Laura bovenaan — ze krijgt een bericht en leest onze gesprekken van deze week terug." |
| `gewicht`, `kilo` | "Laura heeft me gevraagd niet met getallen te beginnen, en ik ben het daarmee eens. Wat ik wel zie: je avonden zijn rustiger dan drie weken terug. Dat gaat vooruit, ook als de weegschaal stilstaat." |
| `moe`, `druk`, `geen tijd` | "Dan doen we vandaag niets nieuws. Eén ding: zet je eigen bord klaar voordat de bedtijdronde begint. Loggen mag je vandaag overslaan." |
| `gelogd`, `gegeten` | "Dank je. Ik zie het staan — dit hoef je niet perfect te doen, alleen vaak genoeg zodat we een patroon zien." |
| *fallback* | "Dank dat je het deelt. Vertel me iets meer — waar begon het vandaag?" |

**Openingsgesprek in het prototype** (5 berichten, gebruik als seed-fixture):
1. Lau: "Goedemorgen Sanne. Gisteren zei je dat de avonden het moeilijkst zijn — hoe ging het na het eten?"
2. Klant: "Verrassend rustig eigenlijk. Ik heb thee gezet in plaats van de koekjestrommel gepakt."
3. Lau: "Dat is precies de ruil waar we het over hadden. Niet minder willen, maar iets anders klaar hebben staan. Wat maakte dat het gisteren lukte?"
4. **Log** — Lunch: 1 eiwit, 2 groente, 1 koolhydraten
5. Lau: "Mooie lunch — handpalm eiwit en twee vuisten groente. Als je vanmiddag nog trek krijgt, is dat meestal het eiwit. Kwark of een handje kip erbij doet meer dan je denkt."

### 3. Eten (voedingslog)

Doel: bijhouden zonder tellen. **Nergens een calorie, gram of macro.**

**Header**: eyebrow "Donderdag 13 aug" (12px, uppercase, .14em, `#9A9C91`) + titel "Vandaag gegeten" (Newsreader 28px, −.015em) + Laura-knop rechts.

Introregel: "Geen calorieën — je eigen hand is de maat. Tik om een portie toe te voegen." (14.5px/1.6 `#6E7168`).

**Vier portiekaarten** (wit, rand `#E5E0D6`, radius 20, `padding: 18`, `gap: 14`), één per handmaat. Elke kaart:
- Rij: 16px gekleurd vierkantje (radius 4) · naam 15.5px `#262A24` + `"{hand} · {uitleg}"` 12.5px `#9A9C91` · stepper rechts.
- **Stepper**: `−` 34×34 rond, wit, rand `#DCD6CA`; teller `"{n} / {doel}"` (14px `#5E6259`, min-width 46, gecentreerd); `+` 34×34 rond `#63805F` wit. `−` klemt op 0, `+` heeft geen bovengrens.
- **Slot-balk**: `display: flex; gap: 6`, aantal slots = `max(doel, n)`. Elk slot `flex: 1`, hoogte 10, radius 999. Gevuld = de kleur van die handmaat; leeg = `#EFEBE2`. Slots boven het doel krijgen `opacity: .55` — je ziet dat je erover zit, zonder dat het fout voelt.

**Handmaten** (het datamodel hiervan hoort in de backend, per klant instelbaar):

| Key | Naam | Hand | Uitleg | Dagdoel | Kleur |
|---|---|---|---|---|---|
| `eiwit` | Eiwit | Handpalm | vlees, vis, kwark, tofu | 3 | `#63805F` |
| `groente` | Groente | Vuist | alle groente en salade | 4 | `#7E9C6E` |
| `koolhydraten` | Koolhydraten | Holle hand | rijst, pasta, brood, aardappel | 2 | `#C1A277` |
| `vet` | Vetten | Duim | olie, kaas, avocado, pindakaas | 2 | `#B0603F` |

**"Lau kijkt mee"-kaart** (sage-soft, radius 20, `padding: 20`): eyebrow + één regel die reageert op de stand van vandaag:
- eiwit ≥ 3: "Drie handpalmen eiwit — dat is je doel. Dit zijn de dagen dat je 's avonds minder trek hebt."
- anders: "Je zit op {n} van 3 handpalmen eiwit. Bij het avondeten is dat het makkelijkst bij te sturen: kip, vis of kwark als toetje."

**Weekkaart** (wit, radius 20): eyebrow "Deze week" + zeven kolommen ma–zo. Staafje: volle breedte, hoogte `14 + waarde × 8` px (of 10px bij niets gelogd), radius 8, sage-soft + rand `#CFE0C8` als er gelogd is, anders `#EFEBE2` + `#E9E4DA`. Demo-waarden: `[3, 4, 3, 0, 4, 2, 0]`. Onder: "Vijf dagen gelogd. Regelmaat is het punt, geen perfecte week."

**Uitleg-blok** onderaan: gestippelde rand `#D3CCBE`, radius 20, met de vier handmaten als één regel per stuk.

### 4. Vandaag (voortgang)

**Header**: eyebrow "Week 3" + "Je vindt je ritme, Sanne." (Newsreader 30px) + Laura-knop.

**Contactkaart** (wit, radius 24, `padding: 22`): label "Dagen dat we contact hadden" + zeven kolommen ma–zo. Blokje: volle breedte, 34px hoog, radius 12, sage-soft + rand `#CFE0C8` bij contact, `#EFEBE2` + `#E9E4DA` bij niets. Demo: `[wel, wel, wel, niet, wel, wel, niet]`. Onder: "Vijf van zeven dagen. Dat is meer dan vorige week, en genoeg om iets te veranderen."

**"Wat opvalt"** (sage-soft, radius 24): eyebrow `#6D8A68` + uitspraak in Newsreader 21px/1.4 `#37452F` ("Vier avonden koos je bewust voor een warme maaltijd — en daarna had je minder trek.") + regel 14px `#4C6749` over de donderdagavond.

**"Eten bijhouden"-kaart** (wit, radius 24): eyebrow + "Openen"-knop (→ Eten-tab). Vier regels: 12px marker + "{naam} · {hand}" + gemiddelde rechts. Demo-gemiddelden: eiwit `2,1 van 3` · groente `4,3 van 4` · koolhydraten `1,8 van 2` · vetten `1,6 van 2`. Onder: "Gemiddelde handmaten per dag deze week. Groente is je sterkste punt."

**"Waar we aan werken"**: drie kaarten (wit, radius 18, `padding: 16px 18px`), elk 10px rond bolletje + tekst + status rechts:
1. "Eerst je eigen bord, dan de bedtijdronde" — 4 van 7 — sage bolletje
2. "Elke maaltijd een handpalm eiwit" — 2,1 gem. — sage bolletje
3. "Donderdagavond een plan" — nieuw — `#C7BEAE` bolletje (nog niet begonnen)

**Afspraak-blok**: gestippelde rand, 38px Laura-avatar "La" + "Donderdag 20 aug · gesprek met Laura, 30 min."

### 5. Bottom sheet — Eten loggen

Getriggerd door de "Ik heb gegeten"-chip in de chat.

**Scrim**: `position: absolute; inset: 0`, `rgba(38,42,36,.3)`, `backdrop-filter: blur(2px)`. Klik = sluiten.

**Sheet**: `left/right/bottom: 0`, `max-height: 82%`, achtergrond `#F6F3ED`, radius `30px 30px 0 0`, shadow `0 -20px 50px -24px rgba(38,42,36,.4)`, `animation: lauSheet .34s cubic-bezier(.22,.8,.3,1) both`. Bovenaan een greep: 44×4px, radius 999, `#DCD6CA`, gecentreerd.

Inhoud (`padding: 14px 26px 26px; gap: 18`):
1. Titel "Wat heb je gegeten?" (Newsreader 26px) + "Op handmaten. Bij benadering is goed genoeg." (14px `#8C8F84`).
2. **Momentkeuze**: vier gelijke buttons (`flex: 1`, `padding: 11px 0`, radius 12, 12.5px): Ontbijt · Lunch · Avondeten · Tussendoor. Default *Avondeten*. Actief = sage-soft + sage rand.
3. **Vier stepper-rijen** (wit, rand, radius 18, `padding: 15px 17px`): 14px marker + naam + "{hand} · {uitleg}" + stepper (32×32 knoppen, teller min-width 20, 15px). Startwaarden: eiwit 1, groente 1, koolhydraten 1, vet 0.
4. **Acties**: "Later" (`flex: none`, `padding: 15px 20px`, wit, rand, radius 999) + "Bewaren" (`flex: 1`, sage, wit, radius 999).

**Bij Bewaren**: alle porties > 0 worden opgeteld bij de dagstand, de sheet sluit, de app springt naar de **chat**, het log-bericht verschijnt als bubbel, de typing-indicator gaat aan, en na 1000ms komt het antwoord van Lau:
- bevat eiwit ≥ 1: "Genoteerd. Handpalm eiwit erbij — dat is precies waar we deze week op letten. Hoe voelde het bord?"
- geen eiwit: "Genoteerd. Ik zie geen eiwit bij deze maaltijd; als je straks trek krijgt, weet je waar het aan ligt. Geen ramp, gewoon iets om te weten."

Alles op 0 → sheet sluit zonder iets te doen. De draft reset naar `1/1/1/0`.

### 6. Bottom sheet — Praat met Laura

**Laura-knop** (op alle drie de hoofdschermen, rechtsboven): `display: flex; gap: 8`, `padding: 9px 15px`, radius 999, 13px. Met een 7px bolletje ervoor.
- Nog geen flag: wit, rand `#DCD6CA`, tekst `#5E6259`, bolletje `#C7BEAE`.
- Flag verstuurd: `#E7EEE3`, rand `#63805F`, tekst `#4C6749`, bolletje `#63805F`. Het bolletje is de statusindicator — de klant ziet zonder tekst dat haar bericht staat.

**Sheet** (zelfde mechanica als de log-sheet, `max-height: 86%`), twee states:

**State `idle`** (`padding: 16px 26px 28px; gap: 18`):
1. 58px `#EFEBE2` cirkel "La" (Newsreader 22px `#8C6A56`) + "Laura" (Newsreader 25px) + "jouw coach · leest je gesprekken mee" (12.5px).
2. Alinea 15.5px/1.65: "Wil je iets aan een mens vragen, of voelt iets niet goed? Laat het hier weten. Laura krijgt een bericht en leest je week terug. Je hoeft niet uit te leggen waarom."
3. Textarea (min-height 104, `padding: 15px 17px`, rand `#E5E0D6`, radius 20, wit, 15px/1.6, `resize: none`), placeholder "Wil je iets meegeven? (mag ook leeg)".
4. **Redenchips** (multi-select, niet verplicht): Het weekend · Ik twijfel aan het advies · Ik zit even vast · Iets persoonlijks. `padding: 10px 15px`, radius 999, 13px.
5. Primaire button "Laura laten meekijken" (`padding: 17px`, sage, radius 999, 16px) + gecentreerde regel "Hulp vragen hoort erbij. Het is geen falen." (13px `#9A9C91`).

**State `sent`** (`animation: lauFade .45s ease both`):
1. 72px sage-soft cirkel met `✓` (28px `#63805F`).
2. "Laura heeft je bericht." (Newsreader 29px).
3. "Ze leest je gesprekken van deze week terug en reageert meestal dezelfde dag, uiterlijk de volgende ochtend."
4. Witte kaart: "Lau blijft gewoon beschikbaar. Je hoeft niet te wachten met vragen."
5. Secundaire button "Terug naar Lau" (wit, rand, radius 999).

De flagstate is in het prototype niet resetbaar — in productie sluit Laura de flag af vanuit het dashboard, waarna de klantkant terug naar `idle` gaat.

---

## Coach-dashboard (desktop)

**Chrome** (`padding: 18px 28px`, wit, onderrand `#E5E0D6`): "Lau in Balans" (Newsreader 18px) + "· coach" (DM Sans 13px `#A3A59A`) · rechts de datum (13px `#8C8F84`) + 34px Laura-avatar.

### 7. Klantenlijst

`padding: 32px 40px 40px`, inhoud `max-width: 1000px`, gecentreerd, `gap: 24`.

**Kop**: "Jouw klanten" (Newsreader 28px) + "9 actief · 2 wachten op jou" (14px). Rechts drie filterpills (`padding: 9px 15px`, 12.5px): **Wacht op jou** (default) · Alle · Loopt goed.
- *Wacht op jou* toont status `Wacht op jou` + `Stil`.
- *Loopt goed* toont alles behalve `Wacht op jou`.

**Tabel** (wit, rand, radius 18, `overflow: hidden`). Grid: `2fr 1.1fr 2.2fr 1fr 1fr`, `gap: 18px`, `padding: 16px 24px` per rij.

Kop (`padding: 14px 24px`, onderrand `#EDE8DE`, 11px uppercase .12em `#A3A59A`): Klant · Status · Laatste in de chat · Eten gelogd · Gesprek.

Per rij:
- **Klant**: 36px avatar (initialen) + naam 15px + "week N" 12px `#A3A59A`. Avatar bij een flag: `#F6E7E0` / `#93472B`; anders `#EFEBE2` / `#6E7168`.
- **Status**: pill, `padding: 6px 13px`, radius 999, 12px. `Wacht op jou` → clay-soft/clay-ink · `Actief` → sage-soft/sage-deep · `Nieuw` → `#EFEBE2`/`#6E7168` · `Stil` → `#F1EEE7`/`#8C8F84`.
- **Laatste in de chat**: 14px `#6E7168`, één regel, `text-overflow: ellipsis`.
- **Eten gelogd**: 6px hoge rail `#EFEBE2` + fill `logs/7`. Fill sage bij ≥ 4 dagen, anders `#C7BEAE`. Ernaast "N/7" (12px).
- **Gesprek**: datum 13px `#8C8F84`.
- Rij met `Wacht op jou` krijgt `box-shadow: inset 3px 0 0 #B0603F`. Hover: achtergrond `#FBF9F5`. Klik → klantdetail.

**Demo-data** (gebruik als seed):

| Naam | Init. | Week | Status | Laatste bericht | Logs | Gesprek |
|---|---|---|---|---|---|---|
| Sanne Vermeer | SV | 3 | Wacht op jou | "Ik wil even met een mens praten over het weekend." | 5 | do 20 aug |
| Iris de Wit | IW | 7 | Wacht op jou | "Lau snapt niet dat ik nachtdiensten heb." | 3 | vr 21 aug |
| Fleur Bakker | FB | 2 | Actief | Lau: "Mooi dat je de lunch hebt voorbereid." | 7 | di 18 aug |
| Marieke Jansen | MJ | 11 | Actief | Vraagt om recepten voor het weekend. | 6 | wo 19 aug |
| Noor El Amrani | NA | 1 | Nieuw | Intake afgerond, profiel nog niet bijgesteld. | 1 | ma 17 aug |
| Esther Kok | EK | 9 | Stil | Vier dagen geen reactie op Lau. | 0 | do 20 aug |

Voetnoot: "Klik een klant om mee te lezen, te reageren en het AI-profiel bij te stellen."

### 8. Klantdetail — drie kolommen

**Sub-header** (`padding: 20px 32px`, wit, onderrand): terug-knop 36px rond · 42px sage-soft avatar "SV" · naam (Newsreader 21px) + "38 · week 3 · duurzaam afvallen · 5 van 7 dagen gelogd" (12px) · rechts "Wekelijks gesprek" (sage pill, `padding: 11px 18px`, 13px).

**Flag-banner** (`padding: 13px 32px`, `#F6E7E0`, onderrand `#EDD5C9`): 8px clay bolletje + "Sanne vroeg 2 uur geleden om jou: '…'" (13.5px `#93472B`) + rechts "Open sinds 11:20" (12.5px `#B0603F`). Verdwijnt bij "Flag afronden".

**Grid**: `1.2fr 1fr .8fr`, scheidingslijnen `#E5E0D6`, elke kolom eigen scroll.

#### Kolom 1 — Meelezen

Kop: eyebrow "Meelezen · deze week" + "Lau coacht dagelijks" (12px, rechts).

Transcript (`gap: 11`), compacte varianten van de chatbubbels: Lau 13px/1.55 wit + rand `#EDE8DE`, radius `14px 14px 14px 4px`, max 88% · klant sage-soft radius `14px 14px 4px 14px`, max 84% · **Laura** `#FBEFE8` + rand `#EDD5C9`, tekst `#6E4331`, rechts uitgelijnd · **log** sage-soft `padding: 12px 14px`, radius `14px 14px 4px 14px`, met eyebrow (10.5px uppercase `#6D8A68`) + samenvattingsregel 12.5px.

Demo-transcript (8 items): Lau opent → klant antwoordt over thee → **log Lunch** ("1 × handpalm eiwit · 2 × vuist groente · 1 × holle hand koolhydraten") → Lau over eiwit → klant over donderdag/Jeroen → Lau biedt woensdag een voorstel aan → klant: "Graag. Ik wil trouwens even met een mens praten over het weekend."

**Antwoordbalk** (`padding: 12px 24px 20px`, bovenrand `#EDE8DE`, achtergrond `#FBF9F5`) — dit is Laura's directe kanaal:
- 26px Laura-avatar + input (`padding: 12px 15px`, radius 999, 13.5px, placeholder "Reageer als Laura — Sanne ziet dat dit van jou komt…") + verzendknop 38×38 rond `#8C6A56` (hover `#765645`).
- Enter of klik voegt een `laura`-bericht toe aan het transcript en scrollt naar onder.
- Onder: hint 11.5px `#A3A59A`, "Sanne ziet duidelijk dat dit bericht van jou komt, niet van Lau." → na verzenden: "Verstuurd als Laura · Sanne krijgt een melding".
- Rechts, zolang de flag open is: **"Flag afronden"** (`padding: 7px 13px`, radius 999, wit, rand `#EDD5C9`, 11.5px `#93472B`; hover rand `#B0603F`).

#### Kolom 2 — AI-profiel

Kop: eyebrow "AI-profiel" + savestatus rechts (12px `#63805F`): "opgeslagen" → bij elke wijziging "wijziging niet bewaard". *In productie: echte autosave met debounce, plus zichtbare versiehistorie.*

Dit is **de personalisatielaag van de prompt**. Twee veldtypes:

**Chip-velden** (read-only in de UI van het prototype; in productie editable). Chip-varianten: `neutraal` `#F1EEE7`/`#5E6259` · `positief` sage-soft/sage-deep · `let op` clay-soft/clay-ink.

| Veld | Waarden (demo) |
|---|---|
| Doel | Duurzaam afvallen *(positief)* · ± 6 kg in 6 maanden · Energie voor het gezin |
| Portiedoelen (handmaten, per dag) | 3 × handpalm eiwit *(let op)* · 4 × vuist groente *(positief)* · 2 × holle hand · 2 × duim vet |
| Knelpunt | Avond na het eten · Donderdag: partner werkt laat *(let op)* |
| Voorkeuren | 3 maaltijden · Weinig vlees · Geen vis · Max 25 min |
| Beperkingen | Noten-allergie *(let op)* · Geen medicatie |
| Check-in ritme | 's ochtends kort · 's avonds op eigen initiatief · Duwtje na 3 stille dagen |

**Tekstvelden** (textarea, min-height 62, `padding: 12px 14px`, rand `#E5E0D6`, radius 12, 13.5px/1.55, `resize: vertical`):

| Veld | Waarde (demo) |
|---|---|
| Aanpak | "Geen calorieën tellen, geen weegmomenten in de chat. Focus op maaltijdstructuur, avondroutine en handmaten." |
| Toon van coaching | "Warm en direct. Korte berichten. Geen wollige complimenten — Sanne prikt daar doorheen." |
| Vermijden in coaching | "Niet openen met gewicht of getallen. Geen strakke weekschema's. Voorzichtig met lichaamsbeeld." |

Onderaan een uitleg-kaart (`#FBF9F5`, rand `#EDE8DE`, radius 14, 12px `#8C8F84`): "Gestructureerde data, geen vrije tekst. Lau krijgt dit bij elk bericht mee — inclusief de portiedoelen."

#### Kolom 3 — Eten & notities

**Handmaten-kaart** (wit, rand, radius 14): label "Handmaten · gemiddeld per dag" + vier regels: 12px marker + naam · hand + waarde-pill rechts (`padding: 5px 11px`, radius 999, 11.5px). Pill sage-soft als het doel gehaald is, clay-soft als het achterblijft. Demo: eiwit `2,1 van 3` **(clay)** · groente `4,3 van 4` · koolhydraten `1,8 van 2` · vetten `1,6 van 2`. Voetnoot: "Eiwit blijft achter op het doel. Groente zit ruim goed."

**Notities** (nieuwste boven), elk een witte kaart met datum (11px `#A3A59A`) + tekst (13.5px/1.6). Demo:
- "6 aug · na gesprek" — "Wil rust rond eten, niet nóg een schema. Werkt drie dagen, kinderen van 4 en 7. Avonden zijn het knelpunt."
- "30 jul · intake" — "Twee keer eerder een dieet met jojo-effect. Noten-allergie. Geen rode vlaggen, lichaamsbeeld ligt gevoelig."

**Toevoegen**: textarea (min-height 70, placeholder "Notitie toevoegen…") + "Bewaren" (wit, rand, radius 999, 13px; hover rand sage). Lege notitie doet niets; nieuwe notitie krijgt datum "13 aug · vandaag".

### 9. Wekelijks gesprek

De belangrijkste coach-flow: na de videocall van 30 minuten legt Laura vast wat er is gezegd en zet dat om in **profielwijzigingen**.

`padding: 30px 40px 48px`, inhoud `max-width: 1120px`, gecentreerd.

**Kop**: terug-knop + eyebrow "Wekelijks gesprek · Sanne Vermeer" + "Week 3 · videocall van 30 minuten, net afgerond" (Newsreader 26px).

**Grid**: `1fr 1fr`, `gap: 22`, `align-items: start`.

#### Links — stap 1: Vastleggen

Witte kaart (rand, radius 20, `padding: 24`): eyebrow "1 · Vastleggen" + label "Wat kwam er uit het gesprek?" + grote textarea (min-height 200, `#FBF9F5`, radius 14, 14px/1.65, `resize: vertical`). Demo-inhoud:

> Sanne is trots op haar avonden: 4 van 7 keer eerst zelf eten. Donderdag blijft lastig — dan werkt Jeroen laat en eet ze met de kinderen mee.
>
> Uit de logs: eiwit blijft achter, groente zit ruim goed.
>
> Ze schrok van mijn vraag naar haar gewicht. Wil daar niet mee openen. Vraagt om iets concreets voor donderdag.

Daaronder **"Wat viel op"**: multi-select signaalchips (`padding: 9px 15px`, radius 999, 12.5px): Trots op avondroutine · Donderdag knelpunt *(default aan)* · Eiwit blijft achter · Gewicht is gevoelig · Wil concrete maaltijd · **Rode vlag**. De laatste is een clay-chip (rand `#B0603F`, achtergrond clay-soft, tekst clay-ink) — die triggert in productie de escalatie-flow (doorverwijzing behandelaar).

Tweede kaart **"Wat de logs zeggen"**: dezelfde vier handmaat-regels met doel-pills + "Vijf dagen gelogd. Eiwit blijft achter — vooral op de dagen dat ze met de kinderen mee-eet."

#### Rechts — stap 2: Lau bijstellen

Witte kaart: eyebrow "2 · Lau bijstellen" + teller rechts ("N van 3 toegepast") + uitleg "Op basis van je notities en de logs. Jij beslist wat er in het profiel van Sanne verandert."

Drie voorstelkaarten (radius 16, `padding: 16px 18px`). Open: `#FBF9F5` + rand `#EDE8DE`. Toegepast: `#FBFDFA` + rand `#CFE0C8`. Elk toont veldnaam (12px `#8C8F84`), **nieuwe** waarde (14px `#262A24`), **oude** waarde doorgestreept (12.5px `#A3A59A`), en acties:
- Open → "Toepassen" (sage pill) + "Overslaan" (wit, rand).
- Beslist → statuspill: "Toegepast in profiel" (sage-soft) of "Overgeslagen" (`#F1EEE7`).

| # | Veld | Oud | Nieuw |
|---|---|---|---|
| 0 | Vermijden in coaching | "Voorzichtig met lichaamsbeeld." | "Nooit openen met gewicht of getallen. Voorzichtig met lichaamsbeeld." |
| 1 | Portiedoelen | "3 handpalm eiwit · 4 vuist groente · 2 holle hand · 2 duim" | "Eiwit expliciet benoemen bij avondeten met de kinderen — doel blijft 3 handpalm." |
| 2 | Focus komende week | "Eerst eigen bord, dan bedtijdronde." | "Donderdagavond: uiterlijk woensdag één maaltijd voorstellen die de kinderen ook eten." |

#### Rechts — stap 3: Prompt-preview

Sage-soft kaart (radius 20, `padding: 24`): eyebrow "3 · Zo klinkt Lau maandagochtend" + een **witte bubbel** (radius `18px 18px 18px 5px`, Newsreader 18px/1.5 `#37452F`) met het gesimuleerde openingsbericht, dat **live meebeweegt met de toegepaste voorstellen**:

- Niets toegepast: *"Goedemorgen Sanne. Hoe ver ben je met je streefgewicht?"* ← bewust ongewenst: dit is wat er gebeurt als Laura niets bijstelt.
- Iets toegepast: begint met "Goedemorgen Sanne."
  - voorstel 2 toegepast → + " Donderdag komt er weer aan — ik heb een ovenschotel bedacht die de kinderen ook eten. Wil je die woensdag zien?"; anders + " Hoe was je weekend?"
  - voorstel 1 toegepast → + " En denk aan één handpalm voor jezelf als je met de kinderen mee-eet."

Onder de bubbel een toelichtingsregel (12.5px `#4C6749`), samengesteld uit:
- voorstel 0 toegepast → "Geen gewicht of getallen in de opening. " · anders → "Let op: zonder de eerste wijziging kan Lau nog over gewicht openen. "
- voorstel 1 toegepast → "Eiwit wordt actief benoemd. "
- voorstel 2 toegepast → "Donderdag staat als focus."

**Afsluitknop**: "Vastleggen en terug naar Sanne" (`#4C6749`, radius 999, `padding: 12px 20px`, 13.5px; hover `#3D5539`). Na de eerste klik wordt het label "Opgeslagen — Lau is bijgesteld"; de tweede klik navigeert naar het klantdetail.

Deze preview is het hart van het vertrouwen in dit product: Laura ziet **vóór** ze opslaat wat haar bijstelling met de AI doet. Bouw hem echt — genereer de preview via dezelfde prompt-pipeline als de productie-AI, niet met een string-concat.

---

## Interactions & Behavior

### Navigatie

| Van | Actie | Naar |
|---|---|---|
| Onboarding stap 7 | "Naar Lau" | Chat |
| Onboarding stap 6 | "Sla deze vraag over" | Stap 7 |
| Tabbar | tab-klik | Vandaag / Chat / Eten |
| Vandaag | "Openen" op de eten-kaart | Eten |
| Elk hoofdscherm | Laura-knop | Laura-sheet |
| Chat | "Ik heb gegeten" | Log-sheet |
| Log-sheet | "Bewaren" | Chat (met nieuw log-bericht + AI-reactie) |
| Sheet | scrim-klik / "Sluiten" / "Later" | terug naar het scherm eronder |
| Klantenlijst | rij-klik | Klantdetail |
| Klantdetail | "Wekelijks gesprek" | Wekelijks gesprek |
| Wekelijks gesprek | terug-knop of 2e klik op afsluiten | Klantdetail |

### Timings

- AI-antwoord in de chat: **1100ms** typing-indicator, dan het bericht.
- AI-reactie na een voedingslog: **1000ms**.
- Onboardingstap-wissel: `lauFade .4s`.
- Sheet openen: `lauSheet .34s cubic-bezier(.22,.8,.3,1)`.
- Voortgangsbalk: `width .35s ease`.
- Chip/button hover: `.15s–.18s ease`.

In productie: vervang de vaste delays door de echte streaming-respons, maar houd de typing-indicator — die is onderdeel van de toon.

### Autoscroll

- Klant-chat: scroll naar onder bij een nieuw bericht **en** bij het aanzetten van de typing-indicator.
- Coach-transcript: scroll naar onder als Laura een bericht verstuurt.
- Gebruik **niet** `scrollIntoView` — zet `scrollTop = scrollHeight` op de container.

### Hover states

| Element | Hover |
|---|---|
| Primaire sage button | `#63805F` → `#55714F` |
| Donkere sage button | `#4C6749` → `#3D5539` |
| Laura-verzendknop | `#8C6A56` → `#765645` |
| Secundaire (wit + rand) | rand `#DCD6CA` → `#C7BEAE` |
| Quick-reply chip | rand → `#63805F`, tekst → `#4C6749` |
| "Ik heb gegeten" chip | achtergrond `#E7EEE3` → `#DEE8D8` |
| Tabelrij | achtergrond → `#FBF9F5` |
| Notitie-bewaren | rand → `#63805F`, tekst → `#4C6749` |
| "Flag afronden" | rand `#EDD5C9` → `#B0603F` |

### Nog te ontwerpen (niet in de prototypes)

Loading-states, error-states, offline-gedrag, echte formuliervalidatie, push-notificaties, lege staten (nieuwe klant zonder logs of gesprekken), en de escalatieflow achter "Rode vlag". Vraag hierover terug bij de designer in plaats van te improviseren — de toon van dit product is fragiel.

---

## State Management

### Klant-app

```
kScreen        'onboarding' | 'chat' | 'eten' | 'voortgang'
sheet          null | 'log' | 'laura'
ob             0..7                       onboardingstap
doelen         string[]                   multi-select, default ['Duurzaam afvallen']
weekvorm       string[]
voorkeuren     string[]
beperkingen    string[]
veiligheid     string | null              single-select
afkeer         string                     vrij tekstveld stap 3
extra          string                     vrij tekstveld stap 4
messages       Message[]                  zie hieronder
input          string
typing         boolean
porties        { eiwit, groente, koolhydraten, vet }   dagstand, integers ≥ 0
draft          { eiwit, groente, koolhydraten, vet }   sheet-concept, reset naar 1/1/1/0
moment         'Ontbijt' | 'Lunch' | 'Avondeten' | 'Tussendoor'
flag           'idle' | 'sent'
flagText       string
flagReasons    string[]
```

```
Message =
  | { role: 'ai'    | 'me' | 'laura', text: string }
  | { role: 'log',  moment: string, items: [handKey, aantal][] }
```

### Coach-dashboard

```
cScreen        'lijst' | 'detail' | 'weekly'
cFilter        'Wacht op jou' | 'Alle' | 'Loopt goed'
cReply         string                     antwoordbalk
cExtra         Message[]                  door Laura toegevoegde berichten
cFlagOpen      boolean
aanpak         string                     profiel-textareas
toon           string
donts          string
profileSaved   'opgeslagen' | 'wijziging niet bewaard'
newNote        string
notities       { datum, tekst }[]         nieuwste eerst
sessionNotes   string
signalen       string[]                   default ['Donderdag knelpunt']
voorstellen    { 0|1|2 : 'open' | 'applied' | 'skipped' }
sessionSaved   boolean
```

### Datamodel voor de backend

Wat het prototype als lokale state houdt, hoort in productie zo te liggen:

- **Client** — id, naam, leeftijd, startdatum, coach-id, status.
- **AIProfile** (1-op-1 met client, **versioned**) — doelen, portiedoelen per handmaat, knelpunten, voorkeuren, beperkingen/allergieën, check-in-ritme, aanpak, toon, vermijden-in-coaching, veiligheidsvlag uit de onboarding. Dit object is de input van de prompt van Lau.ai. **Bewaar elke versie met auteur en tijdstip** — Laura moet kunnen terugkijken wat ze wanneer veranderde, en de reden staat in de sessienotitie.
- **Message** — client-id, afzender (`ai` | `client` | `coach`), tekst, timestamp, gelezen-status.
- **FoodLog** — client-id, datum, moment, `{handKey: aantal}`. Per maaltijd één record; de dagstand is een som. Ook de bron (chat of eten-scherm) vastleggen — nuttig voor productbeslissingen later.
- **Flag** — client-id, tekst, redenen, aangemaakt-op, status (`open` | `resolved`), afgehandeld-door/op.
- **CoachNote** — client-id, datum, tekst, type (`intake` | `sessie` | `los`).
- **WeeklySession** — client-id, datum, notitie, gekozen signalen, toegepaste/overgeslagen profielvoorstellen, resulterende AIProfile-versie.

### Guardrails (niet optioneel)

Deze horen in de systeemprompt én in de UI, en zijn onderdeel van de belofte van dit product:

1. **Geen medisch advies.** Lau geeft leefstijl-coaching. Bij klachten, twijfel of medische vragen verwijst hij naar huisarts of diëtist. De disclaimer staat in onboarding stap 0 én permanent onderaan de chat.
2. **Geen calorieën, grammen of macro's.** Nergens in de UI, nergens in de antwoorden. Handmaten zijn de enige eenheid.
3. **Gewicht is per klant geconfigureerd.** Bij Sanne staat "niet openen met getallen" in het profiel; Lau houdt zich daaraan. Het profielveld *Vermijden in coaching* is bindend.
4. **Rode vlaggen escaleren naar een mens.** Signalen van een eetstoornis, ondervoeding of psychische nood → Lau coacht niet door, maar brengt Laura in beeld. Laura's kant heeft daar de "Rode vlag"-chip voor.
5. **Laura is altijd één tik weg.** De Laura-knop staat op elk hoofdscherm en is nooit weg te configureren.
6. **Berichten van Laura zijn visueel onderscheiden** van berichten van Lau (`#FBEFE8` bubbel). De klant weet altijd of ze met een mens of met AI praat.

---

## Assets

Geen. Geen afbeeldingen, geen SVG-illustraties, geen iconenbestanden — alle "iconen" zijn tekstglyphs of gekleurde vormen (zie **Fidelity**). Fonts komen van Google Fonts (Newsreader, DM Sans). Alle copy is Nederlands en definitief zoals in dit document en de prototypes; de demo-namen en -data zijn verzonnen en mogen als seed/fixtures blijven staan.
