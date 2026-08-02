'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ClientStatus, Sender } from '@lau/shared';
import { supabase } from '@/lib/supabase';

export type LaatsteBericht = {
  sender: Sender;
  tekst: string | null;
  /** Gezet = voedingslog-bericht (tekst is dan null; zie check-constraint op messages). */
  food_log_id: string | null;
  created_at: string;
};

export type KlantRij = {
  id: string;
  naam: string;
  status: ClientStatus;
  startdatum: string; // ISO-datum (YYYY-MM-DD)
  laatsteBericht: LaatsteBericht | null;
  openFlags: number;
};

type Basisrij = Pick<KlantRij, 'id' | 'naam' | 'status' | 'startdatum'>;

const FOUTMELDING = 'Klanten laden lukte niet — probeer opnieuw.';

/**
 * Eigen klanten + per klant het laatste bericht en het aantal open flags.
 *
 * RLS filtert `clients` al op de ingelogde coach, dus een coach_id-filter is
 * overbodig. Per klant twee lichte query's (A11: zes klanten — geen view- of
 * join-optimalisatie), parallel per klant én over klanten heen.
 *
 * Gooit door bij elke fout — ook bij een mislukte deelquery, want die zou anders
 * als "geen berichten" of "0 flags" op het scherm belanden.
 */
async function haalKlanten(): Promise<KlantRij[]> {
  // Op naam gesorteerd i.p.v. op activiteit: bij zes klanten weegt een vaste plek in
  // de lijst zwaarder dan recency — rijen die bij elke refresh verspringen kosten
  // Laura meer dan ze opleveren.
  const { data, error } = await supabase
    .from('clients')
    .select('id, naam, status, startdatum')
    .order('naam');
  if (error) throw error;

  return Promise.all(
    ((data ?? []) as Basisrij[]).map(async (klant): Promise<KlantRij> => {
      const [bericht, flags] = await Promise.all([
        supabase
          .from('messages')
          .select('created_at, sender, tekst, food_log_id')
          .eq('client_id', klant.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('flags')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', klant.id)
          .eq('status', 'open'),
      ]);
      if (bericht.error) throw bericht.error;
      if (flags.error) throw flags.error;
      return {
        ...klant,
        laatsteBericht: (bericht.data as LaatsteBericht | null) ?? null,
        openFlags: flags.count ?? 0,
      };
    }),
  );
}

/**
 * Klantenlijst-state. Geen realtime (A4): fetch bij mount, opnieuw zodra het tabblad
 * weer zichtbaar wordt, en handmatig via `herlaad` (retry-knop).
 */
export function useKlanten() {
  // null = nog nooit geladen; daarna altijd de laatst bekende stand — een mislukte
  // achtergrond-refresh laat de oude lijst dus staan, mét foutmelding erboven.
  const [klanten, setKlanten] = useState<KlantRij[] | null>(null);
  const [fout, setFout] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);
  // Ophogen = opnieuw ophalen. Via een teller i.p.v. een callback die setState doet,
  // zodat élke fetch dezelfde weg loopt en de effect-cleanup de race-guard is.
  const [tik, setTik] = useState(0);

  useEffect(() => {
    let actueel = true;
    (async () => {
      try {
        const rijen = await haalKlanten();
        if (!actueel) return;
        setKlanten(rijen);
        // Pas wissen als er een verse stand tegenover staat.
        setFout(null);
      } catch (e) {
        console.error('[klanten] laden mislukt:', e);
        if (actueel) setFout(FOUTMELDING);
      } finally {
        if (actueel) setBezig(false);
      }
    })();
    return () => {
      // Een nieuwe beurt (tik) of unmount: het antwoord van deze fetch telt niet meer.
      actueel = false;
    };
  }, [tik]);

  const herlaad = useCallback(() => {
    setBezig(true);
    setTik((t) => t + 1);
  }, []);

  useEffect(() => {
    // Terug op het tabblad → verse stand.
    const opZichtbaarheid = () => {
      if (document.visibilityState === 'visible') setTik((t) => t + 1);
    };
    document.addEventListener('visibilitychange', opZichtbaarheid);
    return () => document.removeEventListener('visibilitychange', opZichtbaarheid);
  }, []);

  return {
    klanten: klanten ?? [],
    /** Alleen de eerste keer: een refresh op de achtergrond houdt de lijst staan. */
    laden: klanten === null && fout === null,
    fout,
    /** true zolang een handmatige retry loopt (voor de knop-staat). */
    bezig,
    herlaad,
  };
}
