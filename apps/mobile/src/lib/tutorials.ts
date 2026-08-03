import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Vlaggen voor de eerste-keer-uitleg per scherm (B1: lokaal op het toestel, geen server).
 * Eén vlag per tab; `resetTutorials(clientId)` zet ze alle drie terug — dat is de knop
 * "Uitleg opnieuw bekijken" op het profielscherm.
 *
 * De sleutel draagt de klant-id (F3, feedback 1.1). Stond de vlag alleen op de schermnaam,
 * dan deelden álle accounts op één toestel dezelfde vlag: wie na Jeffrey inlogde kreeg geen
 * uitleg meer te zien. Nu is de uitleg iets van de klant, niet van het toestel.
 *
 * De oude sleutels (`tutorial:<scherm>`) ruimen we bewust NIET op en migreren we niet: we
 * zouden moeten gokken bij welke klant ze horen — precies de aanname die het probleem
 * veroorzaakte. Het zijn drie losse bytes-sleutels die verder nooit meer gelezen worden.
 *
 * De overlay zelf woont in `components/Tutorial.tsx`; deze module weet alleen van de keys.
 */
export type TutorialScherm = 'vandaag' | 'chat' | 'eten';

export const TUTORIAL_SCHERMEN: readonly TutorialScherm[] = ['vandaag', 'chat', 'eten'];

const sleutel = (clientId: string, scherm: TutorialScherm) => `tutorial:${clientId}:${scherm}`;

/**
 * Is de uitleg van dit scherm al gezien door déze klant? Bij een storage-storing zeggen we
 * "ja": een overlay die bij elke start terugkomt is vervelender dan een gemiste uitleg, en
 * de gebruiker kan 'm altijd zelf terughalen vanuit het profiel.
 */
export async function isGezien(clientId: string, scherm: TutorialScherm): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(sleutel(clientId, scherm))) !== null;
  } catch (e) {
    console.warn('[tutorials] lezen mislukt:', e);
    return true;
  }
}

/** Markeer de uitleg als gezien (klaar én overslaan). Mislukt dit, dan komt 'ie terug. */
export async function markeerGezien(clientId: string, scherm: TutorialScherm): Promise<void> {
  try {
    await AsyncStorage.setItem(sleutel(clientId, scherm), '1');
  } catch (e) {
    console.warn('[tutorials] opslaan mislukt:', e);
  }
}

/** Alle vlaggen van déze klant weg: de uitleg verschijnt weer op elk scherm. */
export async function resetTutorials(clientId: string): Promise<void> {
  try {
    await AsyncStorage.multiRemove(TUTORIAL_SCHERMEN.map((scherm) => sleutel(clientId, scherm)));
  } catch (e) {
    console.warn('[tutorials] resetten mislukt:', e);
  }
}
