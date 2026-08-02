# Fase 6 — Onboarding-flow, tutorials, profiel & doelen (design)

**Datum:** 2026-08-02 · **Status:** autonoom uitgewerkt (zelfde afspraak als fase 5:
aannames gelogd, na afloop samen doorlopen).
**Scope** = Jeffrey's punten 3-7: onboarding verplicht (bestaat al), tutorials per
scherm, profielscherm met eigen gegevens, eetdoelen zelf aanpassen.

## Doel

Een nieuwe gebruiker landt na de onboarding op Vandaag en krijgt daar (en op Lau.ai en
Eten) een korte eerste-keer-uitleg. Iedereen kan de eigen onboarding-gegevens en
portiedoelen inzien en bijstellen op een profielscherm — als nieuwe, voor Laura
zichtbare profielversie. Coach-velden blijven onzichtbaar en onaantastbaar.

## Onderdelen

### 1. Migratie `fase6_profiel` (push = Jeffrey-stap, zelfde als fase 5)

Twee RPC's (security definer, `search_path=''`, huisstijl):

- **`mijn_profiel()`** → jsonb: de KLANT-SUBSET van de hoogste profielversie —
  `doelen, portiedoelen, knelpunten, voorkeuren, beperkingen, checkinRitme` plus
  `versie`. De coach-velden (`aanpak, toon, vermijdenInCoaching, veiligheidsvlag`)
  worden server-side weggelaten: de klant kan ze nooit lezen.
- **`werk_mijn_profiel_bij(p_wijziging jsonb)`** → int (nieuwe versie): leest de
  hoogste versie, overschrijft ALLEEN de zes klant-velden uit de input (ontbrekende
  keys = ongewijzigd laten), insert versie n+1 met `author = null` (zelfde betekenis
  als de onboarding: door de klant zelf). Validatie in de functie: portiedoelen zijn
  integers 0..12; arrays zijn text-arrays. Unique-race (client_id, versie): één retry
  in de functie, daarna exception. Alleen `authenticated`; coach-accounts zonder
  clients-rij → exception.

RLS-tests (`tests/rls/fase6.test.ts`, cloud, wegwerp-fixtures): subset-lezen lekt geen
coach-velden; bijwerken maakt versie n+1 author null met coach-velden ongewijzigd;
coach-velden in de input worden genegeerd; anon kan niets; klant zonder profiel krijgt
een nette lege uitkomst. Verwacht falend tot de push — eerlijk rapporteren.

### 2. Profielscherm (app)

Route `src/app/profiel.tsx` (root-stack, buiten de tabs), bereikbaar via een
instellingen-icoon (Ionicons `person-circle-outline`) in de Vandaag-header naast de
LauraKnop. Inhoud, in kaarten (bestaande visuele taal):

- **Account**: naam + e-mail (read-only uit sessie/clients) · tier-badge
  ("Coachingtraject" sage / "Gratis" neutraal) · bij free: "Ik heb een code" → bestaande
  `CodeSheet` · **Uitloggen** (bestond nog nergens in de UI!).
- **Mijn gegevens** (uit `mijn_profiel()`): doelen, knelpunten, voorkeuren,
  beperkingen, check-in-ritme — bewerkbaar met de chip-patronen uit de onboarding.
- **Mijn portiedoelen**: vier steppers (HandmaatStepper-patroon) 0..12.
- Opslaan → `werk_mijn_profiel_bij` → bevestiging "Opgeslagen — Lau rekent vanaf nu
  met je nieuwe doelen." (portiedoelen voeden direct `mijn_portiedoelen()`/Eten).
- **Uitleg opnieuw bekijken** → reset de tutorial-vlaggen (zie §3) → terug naar Vandaag.

### 3. Tutorials (eerste-keer-uitleg per scherm)

- Component `Tutorial`: overlay (scrim + kaart onderaan) met 2-3 stappen per scherm —
  elke stap benoemt een element ("Hier zie je je week", "Met deze knop haal je Laura
  erbij"), knoppen "Volgende" / "Klaar" + "Overslaan". Geen spotlight-cutouts (B2).
- Stappen per scherm: **Vandaag** (weekoverzicht+contactdagen · wat-opvalt · Laura-knop),
  **Lau.ai** (chat met Lau · "Ik heb gegeten"-actie vs. suggesties · Laura leest mee),
  **Eten** (steppers/handmaten · weekstaafjes · geen calorieën).
- Getoond bij het eerste bezoek per scherm per toestel; vlag in AsyncStorage
  (`tutorial:vandaag|chat|eten`) (B1). Free-tier: op Lau.ai geen tutorial zolang het
  slot actief is (er valt niets uit te leggen); wél zodra 'ie openklapt.
- **Landing wordt Vandaag** (B3): na onboarding én bij app-start landt de gebruiker op
  `/(tabs)/vandaag` (was chat) — conform Jeffrey punt 4 (voortgang eerst, dan Lau.ai,
  dan Eten).

## Buiten scope (bewust)

E-mail/wachtwoord wijzigen en account verwijderen (fase 8, AVG) · avatar/foto ·
notificatie-voorkeuren (fase 7/8) · tutorials in het coach-dashboard.

## Aannames (loggen en na afloop doorlopen)

- **B1** Tutorial-vlaggen lokaal per toestel (AsyncStorage): her-installatie toont de
  uitleg opnieuw — acceptabel, eerder wenselijk. Geen migratie nodig.
- **B2** Tutorial-vorm is een stappenkaart-overlay zonder spotlight-uitsnedes:
  begrijpelijk, robuust over schermformaten, en snel te bouwen. Spotlight kan later.
- **B3** Standaard-landing wordt Vandaag (onboarding-einde én gate-default). De
  tab-volgorde blijft Vandaag · Lau.ai · Eten.
- **C1** Profielscherm is een losse route met een icoon op de Vandaag-header; daar
  wonen ook uitloggen, code verzilveren en tutorials-reset.
- **C2** Klant-bewerkingen worden een nieuwe profielversie met `author = null` —
  append-only, dus volledig zichtbaar (en overrulebaar) voor Laura in het dashboard.
  Coach-velden zijn voor de klant onleesbaar én onschrijfbaar (server-side merge).
- **C3** Óók coached klanten mogen hun doelen aanpassen (punt 7 is generiek gesteld).
  Laura ziet elke wijziging als versie in de historie; het gesprek erover is coaching,
  geen technische blokkade.
- **C4** Dashboard-versiehistorie labelt author-null-versies nu "onboarding" — na deze
  fase kan dat ook "klant" betekenen. Label in het dashboard aanpassen naar
  "klant/onboarding" (kleine tekstwijziging, meenemen in Task 3).
