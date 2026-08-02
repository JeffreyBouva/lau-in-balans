import { useEffect, useState } from 'react';
import { supabase } from '../supabase';

type Config = { slotenActief: boolean; appleLoginActief: boolean };
const DEFAULTS: Config = { slotenActief: true, appleLoginActief: false };

/** Remote ops-knoppen uit app_config; bij offline/fout gelden de defaults. */
export function useConfig(): Config {
  const [config, setConfig] = useState<Config>(DEFAULTS);
  useEffect(() => {
    supabase.from('app_config').select('key, value').then(({ data }) => {
      if (!data) return;
      const map = Object.fromEntries(data.map((r) => [r.key, r.value]));
      setConfig({
        slotenActief: map.sloten_actief !== false,
        appleLoginActief: map.apple_login_actief === true,
      });
    });
  }, []);
  return config;
}
