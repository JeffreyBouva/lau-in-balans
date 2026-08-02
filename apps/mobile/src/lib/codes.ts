import { supabase } from './supabase';

export type VerzilverResultaat = 'ok' | 'ongeldig' | 'storing';

/** Verzilvert een 6-tekencode via de RPC. 'ongeldig' = code klopt niet of is al
 *  gebruikt; 'storing' = netwerk/server (code kan best geldig zijn — opnieuw proberen). */
export async function verzilverCode(code: string): Promise<VerzilverResultaat> {
  const { data, error } = await supabase.rpc('verzilver_code', { p_code: code });
  if (error) {
    console.warn('[codes] verzilveren mislukt:', error.message);
    return 'storing';
  }
  return data === true ? 'ok' : 'ongeldig';
}
