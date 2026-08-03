import type { AIProfile, HandKey, Porties, Veiligheidsvlag } from '@lau/shared';
import { HANDMATEN } from '@lau/shared';
// Relatief pad, geen '@/'-alias: vitest draait deze module buiten de Metro-resolver om.
import {
  suggereerPortiedoelen, klemPortiedoel, type Activiteit, type Bouw,
} from '../lib/portiesuggestie';

/**
 * Chip-opties. Ze wonen hier en niet in het onboardingscherm, omdat het profielscherm
 * dezelfde velden bewerkt — één bron, dus onboarding en profiel blijven gelijklopen.
 * De lijsten zijn suggesties: eigen antwoorden (uit de vrije tekstvelden of van Laura)
 * blijven bewaard, het profielscherm toont ze als extra chip.
 */
export const DOEL_OPTIES = ['Duurzaam afvallen', 'Meer energie', "Minder snacken 's avonds", 'Rust rond eten', 'Betere routine met het gezin'];
/** Weekvorm in de onboarding = knelpunten in het profiel (zie naarProfiel). */
export const WEEKVORM_OPTIES = ['Druk gezin', 'Werk 3 dagen', 'Wisselende diensten', 'Vaak buitenshuis eten', 'Sport 2x per week'];
export const VOORKEUR_OPTIES = ['Alles', 'Weinig vlees', 'Vegetarisch', 'Geen vis', 'Snel klaar (< 25 min)'];
export const BEPERKING_OPTIES = ['Noten-allergie', 'Lactose-intolerant', 'Glutenvrij', 'Medicatie', 'Geen van deze'];
/** Alleen op het profielscherm: de onboarding vraagt (nog) niet naar het check-in-ritme. */
export const CHECKIN_RITME_OPTIES = ['Elke ochtend', 'Elke avond', 'Een paar keer per week', 'Alleen doordeweeks', 'In het weekend', 'Liever zo min mogelijk'];

// ── Dagdoelen-stap ──────────────────────────────────────────────────────────
// De drie keuzes waarmee we de portiedoelen voorstellen. Geen gewicht en geen
// lengte: de handmaat schaalt al mee met het lichaam van de klant (zie
// lib/portiesuggestie.ts), dus die vragen zouden alleen maar schuren met de
// afspraak dat we niet over gewicht of getallen beginnen.

export const BOUW_OPTIES: { label: string; waarde: Bouw }[] = [
  { label: 'Vrouw', waarde: 'vrouw' },
  { label: 'Man', waarde: 'man' },
  { label: 'Zeg ik liever niet', waarde: 'zeg-ik-liever-niet' },
];
export const MAALTIJD_OPTIES: { label: string; waarde: number }[] = [
  { label: '2', waarde: 2 },
  { label: '3', waarde: 3 },
  { label: '4', waarde: 4 },
];
export const ACTIVITEIT_OPTIES: { label: string; waarde: Activiteit }[] = [
  { label: 'Rustig', waarde: 'rustig' },
  { label: 'Gemiddeld', waarde: 'gemiddeld' },
  { label: 'Actief', waarde: 'actief' },
];

/** Hoe de twee ritme-antwoorden in het profiel terechtkomen — leesbare regels,
 *  zodat Lau.ai er in de coaching rekening mee houdt. Bouw/geslacht gaat NIET mee:
 *  dat is alleen invoer voor het voorstel en Lau heeft het niet nodig. */
const ACTIVITEIT_PROFIELREGEL: Record<Activiteit, string> = {
  rustig: 'Rustige dagen, weinig beweging',
  gemiddeld: 'Gemiddeld actief op een dag',
  actief: 'Actieve dagen, veel beweging',
};

export type OnboardingState = {
  doelen: string[]; weekvorm: string[]; voorkeuren: string[]; beperkingen: string[];
  afkeer: string; extra: string; veiligheid: Veiligheidsvlag | null;
  /** Alleen invoer voor het portievoorstel — gaat bewust niet mee naar het profiel. */
  bouw: Bouw; maaltijden: number; activiteit: Activiteit;
  portiedoelen: Porties;
  /** Handmaten waar de klant zélf aan gedraaid heeft: die bewegen niet meer mee
   *  met het voorstel als een van de drie keuzes verandert. */
  aangeraakt: HandKey[];
};

/** Startstand: het neutrale midden (geen aanname over wie er voor je zit),
 *  3 maaltijden, gemiddeld actief. */
const START_KEUZES = { bouw: 'zeg-ik-liever-niet' as Bouw, maaltijden: 3, activiteit: 'gemiddeld' as Activiteit };

export function legeOnboarding(): OnboardingState {
  return {
    doelen: ['Duurzaam afvallen'], weekvorm: [], voorkeuren: [], beperkingen: [],
    afkeer: '', extra: '', veiligheid: null,
    ...START_KEUZES,
    portiedoelen: suggereerPortiedoelen(START_KEUZES),
    aangeraakt: [],
  };
}

/**
 * Een van de drie keuzes wijzigt → de portiedoelen die de klant nog niet zelf heeft
 * aangeraakt schuiven mee met het nieuwe voorstel. Aangeraakte doelen blijven staan.
 */
export function metKeuze(
  ob: OnboardingState,
  patch: Partial<Pick<OnboardingState, 'bouw' | 'maaltijden' | 'activiteit'>>,
): OnboardingState {
  const volgend = { ...ob, ...patch };
  const voorstel = suggereerPortiedoelen(volgend);
  const portiedoelen = { ...volgend.portiedoelen };
  for (const h of HANDMATEN) {
    if (!volgend.aangeraakt.includes(h.key)) portiedoelen[h.key] = voorstel[h.key];
  }
  return { ...volgend, portiedoelen };
}

/**
 * De klant draait zelf aan een stepper: klemmen op 1..12 en dit doel voortaan met
 * rust laten. Ook als de waarde door de klemming gelijk blijft is het een bewuste
 * keuze, dus markeren we 'm hoe dan ook als aangeraakt.
 */
export function metDoelStap(ob: OnboardingState, key: HandKey, stap: number): OnboardingState {
  return {
    ...ob,
    portiedoelen: { ...ob.portiedoelen, [key]: klemPortiedoel(ob.portiedoelen[key] + stap) },
    aangeraakt: ob.aangeraakt.includes(key) ? ob.aangeraakt : [...ob.aangeraakt, key],
  };
}

export function naarProfiel(ob: OnboardingState): AIProfile {
  return {
    doelen: ob.doelen,
    // De klant heeft deze zelf gezet in de dagdoelen-stap (voorstel + eigen correcties).
    portiedoelen: { ...ob.portiedoelen },
    // weekvorm is weekcontext → knelpunten. Lege multi-select laat de lijst leeg.
    knelpunten: [...ob.weekvorm],
    // afkeer ("wat eet je liever niet") → voorkeuren, alleen als er iets staat.
    // Maaltijdritme en activiteit gaan als leesbare regel mee, zodat een voorstel
    // van Lau.ai bij de dag van de klant past.
    voorkeuren: [
      ...ob.voorkeuren,
      ...(ob.afkeer.trim() ? [`Liever niet: ${ob.afkeer}`] : []),
      `${ob.maaltijden} maaltijden per dag`,
      ACTIVITEIT_PROFIELREGEL[ob.activiteit],
    ],
    // extra (vrije tekst onder allergie/medicatie) is veiligheidsrelevant → beperkingen.
    beperkingen: ob.extra.trim() ? [...ob.beperkingen, ob.extra] : [...ob.beperkingen],
    checkinRitme: [],
    aanpak: 'Geen calorieën tellen, geen weegmomenten. Focus op maaltijdstructuur en handmaten.',
    toon: 'Warm en direct. Korte berichten.',
    vermijdenInCoaching: ob.veiligheid === 'voorzichtig' ? 'Voorzichtig met lichaamsbeeld; niet openen met gewicht of getallen.' : '',
    veiligheidsvlag: ob.veiligheid ?? 'overgeslagen',
  };
}
