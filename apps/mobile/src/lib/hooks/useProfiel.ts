import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { PORTIE_DOEL_DEFAULT, type Porties } from '@lau/shared';

export function usePortiedoelen(): Porties {
  const [doelen, setDoelen] = useState<Porties>(PORTIE_DOEL_DEFAULT);
  useEffect(() => {
    supabase.rpc('mijn_portiedoelen').then(({ data }) => { if (data) setDoelen(data as Porties); });
  }, []);
  return doelen;
}
