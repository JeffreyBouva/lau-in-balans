'use client';

import { useEffect, useState } from 'react';
import type { Moment, Porties } from '@lau/shared';
import { supabase } from '@/lib/supabase';

export type LogDetail = { moment: Moment; porties: Porties };

type Rij = { id: string; moment: Moment; porties: Porties };

/**
 * Moment + porties per food_log_id, voor de log-bubbels in het transcript (§8).
 *
 * Een log-bericht draagt alléén een food_log_id — de check-constraint op `messages`
 * eist dat `tekst` dan null is — dus de inhoud komt uit `food_logs`. Zelfde aanpak als
 * de klant-app (apps/mobile/src/app/(tabs)/chat.tsx: logMap), hier alleen voor de
 * id's die écht in het transcript staan.
 *
 * Faalt de query, dan blijft de map leeg: de bubbel toont dan zijn neutrale vorm i.p.v.
 * verzonnen porties.
 */
export function useLogPorties(ids: string[]): Record<string, LogDetail> {
  const [map, setMap] = useState<Record<string, LogDetail>>({});

  // `ids` is elke render een nieuwe array; de sleutel verandert alleen als er echt een
  // log-bericht bij komt — anders zou dit effect eeuwig opnieuw draaien.
  const sleutel = ids.join(',');

  useEffect(() => {
    const lijst = sleutel === '' ? [] : sleutel.split(',');
    // Geen log-berichten: niets op te halen. Een eerdere map laten staan kan geen kwaad —
    // de bubbels zoeken op id, en id's van een andere klant komen daar nooit voorbij.
    if (lijst.length === 0) return;
    let geldig = true;
    // client_id-filter is niet nodig: de id's komen uit het transcript van déze klant,
    // en RLS laat een coach alleen de logs van haar eigen klanten zien.
    void supabase
      .from('food_logs')
      .select('id, moment, porties')
      .in('id', lijst)
      .then(({ data, error }) => {
        if (!geldig) return;
        if (error) {
          console.error('[logporties] laden mislukt:', error.message);
          return;
        }
        setMap(
          Object.fromEntries(
            ((data ?? []) as Rij[]).map((r) => [r.id, { moment: r.moment, porties: r.porties }]),
          ),
        );
      });
    return () => {
      // Andere klant of een nieuw log-bericht: dit antwoord telt niet meer.
      geldig = false;
    };
  }, [sleutel]);

  return map;
}
