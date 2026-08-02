import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Vlaggen voor de eerste-keer-uitleg per scherm (B1: lokaal per toestel, geen server).
 * Eén vlag per tab; `resetTutorials()` zet ze alle drie terug — dat is de knop
 * "Uitleg opnieuw bekijken" op het profielscherm.
 *
 * De overlay zelf woont in `components/Tutorial.tsx`; deze module weet alleen van de keys.
 */
export type TutorialScherm = 'vandaag' | 'chat' | 'eten';

export const TUTORIAL_SCHERMEN: readonly TutorialScherm[] = ['vandaag', 'chat', 'eten'];

const sleutel = (scherm: TutorialScherm) => `tutorial:${scherm}`;

/**
 * Is de uitleg van dit scherm al gezien? Bij een storage-storing zeggen we "ja": een
 * overlay die bij elke start terugkomt is vervelender dan een gemiste uitleg, en de
 * gebruiker kan 'm altijd zelf terughalen vanuit het profiel.
 */
export async function isGezien(scherm: TutorialScherm): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(sleutel(scherm))) !== null;
  } catch (e) {
    console.warn('[tutorials] lezen mislukt:', e);
    return true;
  }
}

/** Markeer de uitleg als gezien (klaar én overslaan). Mislukt dit, dan komt 'ie terug. */
export async function markeerGezien(scherm: TutorialScherm): Promise<void> {
  try {
    await AsyncStorage.setItem(sleutel(scherm), '1');
  } catch (e) {
    console.warn('[tutorials] opslaan mislukt:', e);
  }
}

/** Alle vlaggen weg: de uitleg verschijnt weer op elk scherm. */
export async function resetTutorials(): Promise<void> {
  try {
    await AsyncStorage.multiRemove(TUTORIAL_SCHERMEN.map(sleutel));
  } catch (e) {
    console.warn('[tutorials] resetten mislukt:', e);
  }
}
