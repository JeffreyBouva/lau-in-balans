import { useEffect } from 'react';
import { Platform } from 'react-native';

/**
 * Bij een mislukte social login stuurt Supabase de gebruiker terug met
 * `error`/`error_description` in de query. Zonder dit blijft het scherm stil en lijkt
 * er niets gebeurd. Alleen web (native handelt de fout in socialLogin zelf af). De
 * params gaan meteen uit de URL, anders komt de melding bij elke refresh terug.
 */
export function useOAuthFoutUitUrl(setFout: (m: string) => void) {
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const p = new URLSearchParams(window.location.search);
    const code = p.get('error');
    const omschrijving = p.get('error_description') ?? code;
    if (!omschrijving) return;
    // access_denied = de gebruiker brak zelf af of weigerde toestemming. Net als
    // native ('geannuleerd') tonen we dan niets — wel de URL opschonen.
    if (code !== 'access_denied') setFout('Inloggen via de provider lukte niet.');
    ['error', 'error_code', 'error_description'].forEach((k) => p.delete(k));
    // p.toString() i.p.v. p.size: size bestaat pas in Safari 17+/Chrome 113+ en zou
    // daarvoor undefined zijn — dan gooien we de overige params ten onrechte weg.
    const rest = p.toString();
    window.history.replaceState(null, '', window.location.pathname + (rest ? `?${rest}` : ''));
  }, [setFout]); // useState-setter is stabiel: draait één keer per scherm
}
