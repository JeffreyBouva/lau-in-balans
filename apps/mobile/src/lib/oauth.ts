import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { supabase } from './supabase';

type Provider = 'google' | 'apple';

/** Uitkomst van een social login. 'geannuleerd' is geen fout: de gebruiker sloot
 *  de browser of weigerde toestemming — dan tonen we geen foutmelding. */
export type OAuthUitkomst = { status: 'ok' } | { status: 'geannuleerd' } | { status: 'fout'; melding: string };

/**
 * Social login. Web: volledige redirect (supabase-js pakt de sessie op via
 * detectSessionInUrl). Native: auth-sessie in een browser-sheet + code-exchange.
 * Native werkt pas echt op een dev-build; de web-preview is de testroute nu.
 */
export async function socialLogin(provider: Provider): Promise<OAuthUitkomst> {
  const FOUT = 'Inloggen lukte niet. Probeer het nog eens.';
  if (Platform.OS === 'web') {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      // Terug naar /login (niet /): de index-redirect gooit query-params weg, waardoor
      // useOAuthFoutUitUrl provider-fouten nooit zou zien. Succes werkt daar ook: de
      // gate stuurt een verse sessie vanzelf door. NB: deze URL moet in de Supabase
      // Redirect URLs-allowlist staan.
      options: { redirectTo: `${window.location.origin}/login` },
    });
    return error ? { status: 'fout', melding: FOUT } : { status: 'ok' }; // web redirect: 'ok' = onderweg
  }
  const redirectTo = makeRedirectUri({ path: 'auth-callback' }); // scheme 'mobile' uit app.json (alleen op dev-build; Expo Go geeft exp://)
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error || !data.url) return { status: 'fout', melding: FOUT };
  const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (res.type !== 'success') {
    // 'locked' = er liep al een auth-sessie; de rest (cancel/dismiss) is gewoon afhaken.
    return res.type === WebBrowser.WebBrowserResultType.LOCKED
      ? { status: 'fout', melding: FOUT }
      : { status: 'geannuleerd' };
  }
  const params = new URL(res.url).searchParams; // react-native-url-polyfill staat aan
  if (params.get('error')) return { status: 'geannuleerd' }; // access_denied = gebruiker weigerde
  const code = params.get('code');
  if (!code) return { status: 'fout', melding: FOUT };
  const flowId = params.get('sb_flow_id'); // koppelt de code aan de juiste PKCE-verifier
  const { error: xe } = await supabase.auth.exchangeCodeForSession(code, flowId ? { flowId } : undefined);
  return xe ? { status: 'fout', melding: FOUT } : { status: 'ok' };
}
