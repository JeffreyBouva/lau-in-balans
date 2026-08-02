'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ClientStatus, Sender } from '@lau/shared';
import { naarISODatum } from '@lau/shared';
import { supabase } from '@/lib/supabase';

/** Zeven dagen: de eten-rail in de lijst kijkt precies zo ver terug als de klant-app. */
const VENSTER = 7;

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
  /** Dagen met minstens één voedingslog in de laatste 7 kalenderdagen (0 t/m 7). */
  logsDagen: number;
  /** Datum (YYYY-MM-DD) van het laatste wekelijkse gesprek; null = nog geen gesprek. */
  laatsteGesprek: string | null;
  /**
   * Deze klant vroeg om een mens. Afgeleid van de open flags i.p.v. van `status`:
   * status is een traject-stand (nieuw/actief/stil/gestopt), "wacht op jou" is een
   * werkvoorraad — een actieve klant met een open flag hoort bovenaan Laura's dag.
   */
  wachtOpJou: boolean;
};

type Basisrij = Pick<KlantRij, 'id' | 'naam' | 'status' | 'startdatum'>;

const FOUTMELDING = 'Klanten laden lukte niet — probeer opnieuw.';

/** Eerste dag van het venster (vandaag − 6), lokale kalenderdag. */
function vensterStart(): string {
  const d = new Date();
  d.setDate(d.getDate() - (VENSTER - 1));
  return naarISODatum(d);
}

/**
 * Eigen klanten + per klant het laatste bericht, het aantal open flags, hoeveel dagen
 * er deze week gelogd is en de datum van het laatste wekelijkse gesprek.
 *
 * RLS filtert `clients` al op de ingelogde coach, dus een coach_id-filter is
 * overbodig. Per klant vier lichte query's (A11: zes klanten — geen view- of
 * join-optimalisatie), parallel per klant én over klanten heen.
 *
 * Gooit door bij elke fout — ook bij een mislukte deelquery, want die zou anders
 * als "geen berichten", "0 flags" of "niets gelogd" op het scherm belanden.
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

  // Eén peilmoment voor de hele lijst: anders kan de eerste klant een ander venster
  // krijgen dan de laatste als de fetch over middernacht heen loopt.
  const start = vensterStart();

  return Promise.all(
    ((data ?? []) as Basisrij[]).map(async (klant): Promise<KlantRij> => {
      const [bericht, flags, logs, gesprek] = await Promise.all([
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
        // Alleen de datums: de rail telt dágen met een log, niet maaltijden of porties.
        // client_id-filter is hier wél nodig: RLS geeft de coach álle logs van ál haar klanten.
        supabase.from('food_logs').select('datum').eq('client_id', klant.id).gte('datum', start),
        supabase
          .from('weekly_sessions')
          .select('datum')
          .eq('client_id', klant.id)
          .order('datum', { ascending: false })
          // Twee sessies op dezelfde dag houden zo een vaste volgorde (datum is een date).
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      if (bericht.error) throw bericht.error;
      if (flags.error) throw flags.error;
      if (logs.error) throw logs.error;
      if (gesprek.error) throw gesprek.error;

      const dagen = new Set(((logs.data ?? []) as { datum: string }[]).map((r) => r.datum));
      const openFlags = flags.count ?? 0;
      return {
        ...klant,
        laatsteBericht: (bericht.data as LaatsteBericht | null) ?? null,
        openFlags,
        // Aftoppen op 7: `gte` heeft geen bovengrens, dus een log met een datum in de
        // toekomst (klok- of tijdzoneverschil) zou de rail anders laten overlopen.
        logsDagen: Math.min(dagen.size, VENSTER),
        laatsteGesprek: (gesprek.data as { datum: string } | null)?.datum ?? null,
        wachtOpJou: openFlags > 0,
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
