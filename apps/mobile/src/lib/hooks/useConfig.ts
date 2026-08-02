import { useEffect, useState } from 'react';
import { supabase } from '../supabase';

type Config = { slotenActief: boolean; appleLoginActief: boolean };
const DEFAULTS: Config = { slotenActief: true, appleLoginActief: false };

// Eén query per app-run: schermen die useConfig gebruiken delen dezelfde belofte.
// Bij een fout wissen we de cache, zodat een volgende mount het opnieuw probeert.
let cache: Promise<Config> | null = null;
// Laatst opgeloste waarde: een tweede mount (tabwissel) begint hiermee meteen op
// laden=false, zodat tier-afhankelijke blokken niet bij elke navigatie een frame leegstaan.
let gereed: Config | null = null;

function haal(): Promise<Config> {
  if (cache) return cache;
  // Promise.resolve: de PostgREST-builder is een PromiseLike, geen echte Promise.
  const lopend = Promise.resolve(supabase.from('app_config').select('key, value'))
    .then(({ data }): Config => {
      if (!data) { cache = null; return DEFAULTS; }
      const map = Object.fromEntries(data.map((r) => [r.key, r.value]));
      return { slotenActief: map.sloten_actief !== false, appleLoginActief: map.apple_login_actief === true };
    })
    // Een gooiende belofte (netwerk/parse) mag de cache niet vergiftigen: wissen en met de
    // defaults verder, anders blijft elke volgende mount aan dezelfde kapotte belofte hangen.
    .catch((): Config => { cache = null; return DEFAULTS; })
    .then((c) => { gereed = c; return c; });
  cache = lopend;
  return lopend;
}

/**
 * Remote ops-knoppen uit app_config; bij offline/fout gelden de defaults.
 * `laden` is true tot de eerste resolve — gebruik 'm om UI die van deze vlaggen afhangt
 * even uit te stellen (zie useOpSlot), anders flitst de default-stand voorbij.
 */
export function useConfig(): Config & { laden: boolean } {
  const [config, setConfig] = useState<Config>(gereed ?? DEFAULTS);
  const [laden, setLaden] = useState(gereed === null);
  useEffect(() => {
    let levend = true;
    haal().then((c) => { if (levend) { setConfig(c); setLaden(false); } });
    return () => { levend = false; };
  }, []);
  return { ...config, laden };
}
