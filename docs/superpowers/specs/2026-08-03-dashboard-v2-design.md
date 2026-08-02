# Dashboard-v2 — het echte handoff-ontwerp (design)

**Datum:** 2026-08-03 · **Status:** gestart op Jeffrey's aanwijzing ("Ik wil gewoon het
juiste design, let's go!") — corrigeert aanname A3 uit fase 5.
**Bron van waarheid:** `design_handoff_lau_in_balans/README.md` §7 (klantenlijst),
§8 (klantdetail — drie kolommen), §9 (wekelijks gesprek incl. prompt-preview), plus de
token-/typografie-/interactie-secties. De `.dc.html`-prototypes zijn referentie.

## Doel

Het coach-dashboard pixel-getrouw naar het handoff-ontwerp: chrome + klantenlijst-tabel
met filters (§7), drie-koloms klantdetail met meelezen/antwoordbalk, AI-profiel-editor
en eten/notities (§8), en het wekelijks gesprek met vastleggen, voorstelkaarten en de
**echte prompt-preview** (§9 — "genereer de preview via dezelfde prompt-pipeline als de
productie-AI, niet met een string-concat").

## Datamapping (ontwerp → bestaande database)

- **"Wacht op jou"** (status-pill + clay-rij + flag-avatar) = klant met een open flag.
  De overige pills volgen `clients.status` (actief/nieuw/stil). Filters: *Wacht op jou*
  = open flag óf status stil · *Alle* · *Loopt goed* = geen open flag.
- **"Eten gelogd N/7"** = dagen met ≥1 food_log in de laatste 7 dagen (bestaat al als
  aggregatie). **"Gesprek"** = datum van de laatste weekly_session, anders "—".
- **Flag-banner** (§8) = oudste open flag; "Flag afronden" = bestaande resolve-flow.
- **AI-profiel kolom 2** = bewerkbaar (anders dan het read-only prototype — de
  productie-noot in de handoff vraagt dat): chips voor de lijstvelden, textareas voor
  aanpak/toon/vermijden; opslaan = nieuwe versie (bestaande flow); savestatus-indicator
  "opgeslagen"/"wijziging niet bewaard" (E5: expliciete save, geen autosave).
- **Handmaten-kaart kolom 3** = bestaande voedingsweek-aggregatie in de handoff-vorm
  (waarde-pills sage/clay t.o.v. profieldoelen). **Notities** = coach_notes.
  **Lau-gebruik** (fase 7) blijft, onderaan kolom 3 (bestond niet in de handoff — E7).
- **Wekelijks gesprek** (§9) = `weekly_sessions` (bestaat: notitie, signalen text[],
  voorstellen jsonb, resulting_profile_version). Vastleggen-flow: notitie + signaalchips
  → voorstellen → toegepaste voorstellen worden één nieuwe profielversie → weekly_session
  insert met verwijzing.

## Twee nieuwe edge functions (de "echt bouwen"-eis)

- **`prompt-preview`**: coach-JWT (check `is_coach_of`), input `{ client_id,
  concept_profiel? }` → bouwt met de bestaande `_shared/prompt-builder.ts` de system-
  prompt op het (concept)profiel + echte weekcontext, en genereert met het echte model
  (`LAU_SUGGESTIE_MODEL`, goedkoop) een gesimuleerd ochtend-openingsbericht. Response:
  `{ systemPrompt, opening }`. Zo ziet Laura letterlijk wat Lau krijgt én hoe dat klinkt.
- **`sessie-voorstellen`**: coach-JWT + is_coach_of, input `{ client_id, notitie,
  signalen }` → met het model max 3 voorstellen `[{ veld, oud, nieuw, toelichting }]`
  op basis van notitie + signalen + huidig profiel + weekdata. Fout → lege lijst + nette
  melding (Laura kan altijd handmatig het profiel in).

## Aannames (E-serie)

- **E1** §7/§8/§9 pixel-getrouw op de README-maten; niet-ontworpen states (loading/
  error/leeg — README §"Nog te ontwerpen") sober in dezelfde taal.
- **E2** Status-mapping zoals hierboven ("Wacht op jou" is afgeleid, geen DB-status).
- **E3** Prompt-preview toont ook de rauwe systemprompt (uitklapbaar) — dat is Jeffrey's
  "de prompts kunnen zien"; het handoff-ontwerp toont alleen de gesimuleerde opening.
- **E4** Voorstelkaarten AI-gegenereerd (geen statische demo): de demo-inhoud uit de
  README is referentie voor de VORM, niet de bron van de voorstellen.
- **E5** Geen autosave in kolom 2 (versie-spam); expliciete save + zichtbare savestatus.
  De handoff-productienoot over autosave staat op de opvolglijst.
- **E6** De bestaande dashboard-features die niet in de handoff staan (invites-pagina,
  Lau-gebruik, versiehistorie, nav) blijven bestaan en volgen de nieuwe visuele taal.
- **E7** Wekelijks-gesprek-navigatie: knop in de detail-subheader (per ontwerp);
  de gespreksgeschiedenis (lijst oude sessies) is v2-opvolgpunt.
- **E8** Prompt-preview-generatie kost tokens → alleen op expliciete actie (knop
  "Ververs preview"), niet live bij elke toggle; de systemprompt zelf wordt wél lokaal
  live herbouwd per toggle (goedkoop). Compromis binnen de "live meebeweegt"-eis.

## Buiten scope

Escalatie-flow achter de "Rode vlag"-chip (README: terugvragen aan designer — de chip
bestaat en markeert het signaal, de flow niet) · gespreksgeschiedenis (E7) · autosave
(E5) · mobiel dashboard (<1200px toont de bestaande melding-benadering, README §Frames).
