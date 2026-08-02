import { useEffect, useState } from 'react';
import { supabase } from '../supabase';

type Config = { slotenActief: boolean; appleLoginActief: boolean };
const DEFAULTS: Config = { slotenActief: true, appleLoginActief: false };

// Eén query per app-run: schermen die useConfig gebruiken delen dezelfde belofte.
// Bij een fout wissen we de cache, zodat een volgende mount het opnieuw probeert.
let cache: Promise<Config> | null = null;
function haal(): Promise<Config> {
  if (cache) return cache;
  // Promise.resolve: de PostgREST-builder is een PromiseLike, geen echte Promise.
  const lopend = Promise.resolve(supabase.from('app_config').select('key, value')).then(({ data }): Config => {
    if (!data) { cache = null; return DEFAULTS; }
    const map = Object.fromEntries(data.map((r) => [r.key, r.value]));
    return { slotenActief: map.sloten_actief !== false, appleLoginActief: map.apple_login_actief === true };
  });
  cache = lopend;
  return lopend;
}

/** Remote ops-knoppen uit app_config; bij offline/fout gelden de defaults. */
export function useConfig(): Config {
  const [config, setConfig] = useState<Config>(DEFAULTS);
  useEffect(() => {
    let levend = true;
    haal().then((c) => { if (levend) setConfig(c); });
    return () => { levend = false; };
  }, []);
  return config;
}
