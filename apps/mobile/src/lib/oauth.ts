import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { supabase } from './supabase';

WebBrowser.maybeCompleteAuthSession();

type Provider = 'google' | 'apple';

/**
 * Social login. Web: volledige redirect (supabase-js pakt de sessie op via
 * detectSessionInUrl). Native: auth-sessie in een browser-sheet + code-exchange.
 * Native werkt pas echt op een dev-build; de web-preview is de testroute nu.
 */
export async function socialLogin(provider: Provider): Promise<{ error: string | null }> {
  const FOUT = 'Inloggen lukte niet. Probeer het nog eens.';
  if (Platform.OS === 'web') {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin },
    });
    return { error: error ? FOUT : null };
  }
  const redirectTo = makeRedirectUri(); // gebruikt het app-scheme ("mobile")
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error || !data.url) return { error: FOUT };
  const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (res.type !== 'success') return { error: null }; // geannuleerd — geen foutmelding
  const codeMatch = res.url.match(/[?&]code=([^&]+)/);
  if (!codeMatch) return { error: FOUT };
  const { error: xe } = await supabase.auth.exchangeCodeForSession(codeMatch[1]);
  return { error: xe ? FOUT : null };
}
