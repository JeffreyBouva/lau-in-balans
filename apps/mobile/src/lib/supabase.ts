import 'react-native-url-polyfill/auto';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error('EXPO_PUBLIC_SUPABASE_URL en EXPO_PUBLIC_SUPABASE_ANON_KEY zijn verplicht — zie .env.example');
}

export const supabase = createClient(url, anonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    flowType: 'pkce',
    // Web: na een OAuth-redirect staat de code in de URL — die moet supabase-js zelf oppakken.
    // Gereserveerde query-params op web (nooit als route-param gebruiken):
    // code, error, error_code, error_description, access_token, sb_flow_id.
    detectSessionInUrl: Platform.OS === 'web',
  },
});
