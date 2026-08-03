# App-feedbackronde 1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development.

**Goal:** Jeffrey's negen feedbackpunten na de eerste echte doorloop van app + dashboard.

**Branch:** `app-feedback-1` (na dashboard-v2)

**De negen punten → taken**

| # | Feedback | Taak |
|---|---|---|
| 1 | Tutorial moet elementen uitlichten (spotlight) i.p.v. alleen een kaart | T3 |
| 1.1 | Nieuwe gebruiker zag geen tutorial | T3 (vlaggen per klant i.p.v. per toestel) |
| 2 | Is alle data echt? | T4 (werkpunten/afspraak/Lau-regel waren hardcoded) |
| 3 | Code aanvragen vanuit de slot-staat | T1 (db+dashboard) + T5 (app) |
| 4 | Hero-tekst "Je vindt je ritme" is generiek | T4 (dynamisch op traject/voortgang) |
| 5 | Google-naam in kleine letters | T2 |
| 6 | Zelf portiedoelen kiezen + suggestie, na PN-uitleg | T5 |
| 7 | Profiel-icoon alleen op Vandaag | T2 (consistente topbar) |
| 8 | Overal "Lau.ai" i.p.v. "Lau" | T2 |
| 9 | Dashboard-contrast te zacht | T6 |

**Aannames (F-serie)**
- **F1** Codeaanvraag is een verzoek in de DB (`code_aanvragen`), zichtbaar in het dashboard;
  Laura mailt/belt zelf en zet handmatig een code klaar. Geen automatische toekenning.
- **F2** Tutorial-spotlight meet echte elementen op (measureInWindow) met een gat in de scrim.
  Lukt meten niet (web-edge), dan valt 'ie terug op de huidige kaart-only-vorm.
- **F3** Tutorial-vlaggen worden per klant-id opgeslagen (`tutorial:<clientId>:<scherm>`),
  zodat een nieuw account op hetzelfde toestel de uitleg wél krijgt.
- **F4** Portiedoel-suggestie op basis van bouw (m/v/anders), aantal maaltijden en
  activiteit — NOOIT gewicht (guardrail + PN schaalt al mee met de hand).
- **F5** Werkpunten en het afspraak-blok worden verwijderd i.p.v. verzonnen: er is geen
  databron. Werkpunten komen terug als het wekelijks gesprek ze vult (weekly_sessions).
- **F6** Namen worden genormaliseerd bij weergave én bij schrijven (`netteNaam`).
