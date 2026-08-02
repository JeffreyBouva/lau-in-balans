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
    const d = p.get('error_description') ?? p.get('error');
    if (!d) return;
    setFout('Inloggen via de provider lukte niet.');
    ['error', 'error_code', 'error_description'].forEach((k) => p.delete(k));
    window.history.replaceState(null, '', window.location.pathname + (p.size ? `?${p}` : ''));
  }, [setFout]); // useState-setter is stabiel: draait één keer per scherm
}
