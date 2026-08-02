import type { AIProfile, Veiligheidsvlag } from '@lau/shared';
import { PORTIE_DOEL_DEFAULT } from '@lau/shared';

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

export type OnboardingState = {
  doelen: string[]; weekvorm: string[]; voorkeuren: string[]; beperkingen: string[];
  afkeer: string; extra: string; veiligheid: Veiligheidsvlag | null;
};

export function legeOnboarding(): OnboardingState {
  return { doelen: ['Duurzaam afvallen'], weekvorm: [], voorkeuren: [], beperkingen: [], afkeer: '', extra: '', veiligheid: null };
}

export function naarProfiel(ob: OnboardingState): AIProfile {
  return {
    doelen: ob.doelen,
    portiedoelen: { ...PORTIE_DOEL_DEFAULT },
    // weekvorm is weekcontext → knelpunten. Lege multi-select laat de lijst leeg.
    knelpunten: [...ob.weekvorm],
    // afkeer ("wat eet je liever niet") → voorkeuren, alleen als er iets staat.
    voorkeuren: ob.afkeer.trim() ? [...ob.voorkeuren, `Liever niet: ${ob.afkeer}`] : [...ob.voorkeuren],
    // extra (vrije tekst onder allergie/medicatie) is veiligheidsrelevant → beperkingen.
    beperkingen: ob.extra.trim() ? [...ob.beperkingen, ob.extra] : [...ob.beperkingen],
    checkinRitme: [],
    aanpak: 'Geen calorieën tellen, geen weegmomenten. Focus op maaltijdstructuur en handmaten.',
    toon: 'Warm en direct. Korte berichten.',
    vermijdenInCoaching: ob.veiligheid === 'voorzichtig' ? 'Voorzichtig met lichaamsbeeld; niet openen met gewicht of getallen.' : '',
    veiligheidsvlag: ob.veiligheid ?? 'overgeslagen',
  };
}
