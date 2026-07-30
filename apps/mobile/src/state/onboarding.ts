import type { AIProfile, Veiligheidsvlag } from '@lau/shared';
import { PORTIE_DOEL_DEFAULT } from '@lau/shared';

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
