import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { supabase } from '../supabase';
import { PORTIE_DOEL_DEFAULT, type Porties } from '@lau/shared';

/**
 * De dagdoelen per handmaat uit het profiel. Ophalen bij élke focus, niet alleen bij het
 * monteren: het Eten-scherm is een tab en blijft gemonteerd, dus na een wijziging op het
 * profielscherm zou het anders met de oude doelen blijven rekenen.
 */
export function usePortiedoelen(): Porties {
  const [doelen, setDoelen] = useState<Porties>(PORTIE_DOEL_DEFAULT);
  useFocusEffect(
    useCallback(() => {
      let actueel = true;
      supabase.rpc('mijn_portiedoelen').then(({ data }) => { if (actueel && data) setDoelen(data as Porties); });
      return () => { actueel = false; };
    }, []),
  );
  return doelen;
}
