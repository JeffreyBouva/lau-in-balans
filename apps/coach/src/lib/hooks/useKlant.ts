'use client';

import { useEffect, useState } from 'react';
import type { ClientStatus } from '@lau/shared';
import { supabase } from '@/lib/supabase';

export type Klant = {
  id: string;
  naam: string;
  status: ClientStatus;
  startdatum: string;
  /** null = niet ingevuld; de metaregel in §8 laat de leeftijd dan gewoon weg. */
  leeftijd: number | null;
};

type KlantStand = { clientId: string; klant: Klant | null; fout: boolean };

/**
 * De klant-rij zelf (naam, status, startdatum). RLS filtert `clients` al op de
 * ingelogde coach, dus geen rij = bestaat niet óf hoort bij een andere coach.
 *
 * Uitkomst getagd met de clientId waarvoor hij opgehaald is, zodat het antwoord van
 * een vorige klant nooit in het nieuwe scherm belandt (zie useKlantChat).
 */
export function useKlant(clientId: string) {
  const [stand, setStand] = useState<KlantStand | null>(null);

  useEffect(() => {
    let geldig = true;
    (async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, naam, status, startdatum, leeftijd')
        .eq('id', clientId)
        .maybeSingle();
      if (!geldig) return;
      // 22P02 = geen geldige uuid in de URL. Dat is geen storing maar gewoon een
      // adres dat niet bestaat → dezelfde "niet gevonden"-staat.
      const onbruikbaarId = error?.code === '22P02';
      if (error && !onbruikbaarId) console.error('[klant] laden mislukt:', error.message);
      setStand({
        clientId,
        klant: (data as Klant | null) ?? null,
        fout: error != null && !onbruikbaarId,
      });
    })();
    return () => {
      geldig = false;
    };
  }, [clientId]);

  const actueel = stand?.clientId === clientId ? stand : null;
  return {
    klant: actueel?.klant ?? null,
    laden: actueel === null,
    fout: actueel?.fout ?? false,
  };
}
