'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ontbreektNog } from '@/lib/migratie';
import { supabase } from '@/lib/supabase';

export type InviteCode = {
  id: string;
  code: string;
  created_at: string;
  /** De klant die de code verzilverde; null zolang hij openstaat (of na AVG-verwijdering). */
  used_by: string | null;
  /** Blijft staan als used_by null wordt: de code is en blijft verbrand. */
  used_at: string | null;
  /** Naam van die klant — null bij een open code of een klant die niet meer bestaat. */
  klantNaam: string | null;
};

type Rij = Omit<InviteCode, 'klantNaam'>;

const LAADFOUT = 'De invite-codes laden lukte niet — probeer opnieuw.';
const MAAKFOUT = 'Een nieuwe code maken lukte niet — probeer het opnieuw.';
const TREKFOUT = 'Deze code intrekken lukte niet — mogelijk is hij net gebruikt.';

/**
 * Eigen invite-codes, nieuwste eerst. Een coach_id-filter is overbodig: de policy
 * coach_leest_eigen_codes scopet de tabel al op de ingelogde coach.
 *
 * De namen bij gebruikte codes komen uit één extra clients-query (de coach mag haar
 * eigen klanten lezen — en een klant die een code verzilverde ís haar klant). Bewust
 * geen embedded join: invite_codes.used_by wijst naar clients, maar PostgREST zou die
 * relatie onder RLS per rij moeten oplossen en dat is hier geen winst.
 */
async function haalCodes(): Promise<InviteCode[]> {
  const { data, error } = await supabase
    .from('invite_codes')
    .select('id, code, created_at, used_by, used_at')
    .order('created_at', { ascending: false });
  if (error) throw error;

  const rijen = (data ?? []) as Rij[];
  const ids = [...new Set(rijen.map((r) => r.used_by).filter((v): v is string => v !== null))];

  const namen = new Map<string, string>();
  if (ids.length > 0) {
    const { data: klanten, error: klantFout } = await supabase
      .from('clients')
      .select('id, naam')
      .in('id', ids);
    // Doorgooien: zonder namen zou "Gebruikt door" een half verhaal worden, en een
    // stille deelfout is precies waar een coach op afgaat.
    if (klantFout) throw klantFout;
    for (const k of (klanten ?? []) as { id: string; naam: string }[]) namen.set(k.id, k.naam);
  }

  return rijen.map((r) => ({
    ...r,
    klantNaam: r.used_by ? (namen.get(r.used_by) ?? null) : null,
  }));
}

/**
 * Invite-beheer voor de ingelogde coach: lijst, nieuwe code maken (RPC) en een
 * ongebruikte code intrekken (delete).
 *
 * Zolang de fase5-migratie niet gepusht is bestaan de policies en de RPC nog niet;
 * dat pad krijgt een eigen vlag (`nogNietBeschikbaar`) in plaats van een kale fout,
 * zodat de pagina kan uitleggen wat er moet gebeuren.
 */
export function useInvites() {
  // null = nog nooit geladen; daarna altijd de laatst bekende stand — een mislukte
  // refresh laat de oude lijst dus staan, mét foutmelding erboven.
  const [codes, setCodes] = useState<InviteCode[] | null>(null);
  const [fout, setFout] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);
  const [nogNietBeschikbaar, setNogNiet] = useState(false);
  // Ophogen = opnieuw ophalen. Via een teller i.p.v. een callback die zelf fetcht,
  // zodat élke laadbeurt dezelfde weg loopt en de effect-cleanup de race-guard is.
  const [tik, setTik] = useState(0);

  const [maakBezig, setMaakBezig] = useState(false);
  const [maakFout, setMaakFout] = useState<string | null>(null);
  const [bezigeCode, setBezigeCode] = useState<string | null>(null);
  const [trekFout, setTrekFout] = useState<string | null>(null);

  useEffect(() => {
    let actueel = true;
    (async () => {
      try {
        const rijen = await haalCodes();
        if (!actueel) return;
        setCodes(rijen);
        // Pas wissen als er een verse stand tegenover staat.
        setFout(null);
        setNogNiet(false); // een geslaagde laadbeurt bewijst dat de migratie er is
      } catch (e) {
        console.error('[invites] laden mislukt:', e);
        if (!actueel) return;
        if (ontbreektNog(e as { code?: string; message?: string })) {
          setNogNiet(true);
          // Ook een (lege) stand wegschrijven: anders blijft `laden` true en hangt de
          // pagina op de skeleton in plaats van de uitleg te tonen.
          setCodes((c) => c ?? []);
        } else {
          setFout(LAADFOUT);
        }
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

  // Dubbelklik-guards in refs: de bezig-states zijn er voor de knoppen, maar die zijn
  // pas ná de re-render zichtbaar in deze closures.
  const maakRef = useRef(false);
  const trekRef = useRef(false);

  /** De verse code, of null als er niets gemaakt is (zie `maakFout`/`nogNietBeschikbaar`). */
  const maakCode = useCallback(async (): Promise<string | null> => {
    if (maakRef.current) return null;
    maakRef.current = true;
    setMaakBezig(true);
    setMaakFout(null);

    const roep = () => supabase.rpc('maak_eigen_invite_code');
    let { data, error } = await roep();
    if (error && !ontbreektNog(error)) {
      // Vrijwel altijd een verlopen token (laptop uit slaapstand) → sessie verversen en
      // precies één keer opnieuw proberen. Bij een ontbrekende functie heeft dat geen zin.
      await supabase.auth.refreshSession();
      ({ data, error } = await roep());
    }

    maakRef.current = false;
    setMaakBezig(false);

    if (error || typeof data !== 'string') {
      if (ontbreektNog(error)) {
        setNogNiet(true);
        return null;
      }
      // Nooit stil falen: Laura moet zien dat er géén code klaarstaat.
      console.error('[invites] code maken mislukt:', error?.message ?? 'geen code terug');
      setMaakFout(MAAKFOUT);
      return null;
    }

    setNogNiet(false);
    // Herladen i.p.v. optimistisch invoegen: de RPC geeft alleen de code terug, en de
    // rij heeft ook id en created_at nodig (de id is de sleutel van `trekIn`).
    setTik((t) => t + 1);
    return data;
  }, []);

  /** true = ingetrokken; false = niets geraakt of mislukt (zie `trekFout`). */
  const trekIn = useCallback(async (id: string): Promise<boolean> => {
    if (trekRef.current) return false;
    trekRef.current = true;
    setBezigeCode(id);
    setTrekFout(null);

    // `used_by is null` staat ook in de policy; er zelf op filteren maakt het verschil
    // tussen "mocht niet" en "bestond niet meer" hier onzichtbaar — en dat is precies
    // goed: beide betekenen dat er niets is ingetrokken.
    const wis = () =>
      supabase.from('invite_codes').delete().eq('id', id).is('used_by', null).select('id');
    let { data, error } = await wis();
    if (error) {
      await supabase.auth.refreshSession();
      ({ data, error } = await wis());
    }

    trekRef.current = false;
    setBezigeCode(null);

    // LET OP: een door RLS geweigerde delete geeft géén error maar 0 rijen — zonder
    // deze telling zou een mislukte intrekking als succes op het scherm komen.
    if (error || (data ?? []).length === 0) {
      console.error('[invites] intrekken mislukt:', error?.message ?? '0 rijen geraakt');
      setTrekFout(TREKFOUT);
      // Waarschijnlijk is de code net verzilverd; een verse stand toont dat meteen.
      setTik((t) => t + 1);
      return false;
    }

    setCodes((c) => (c === null ? c : c.filter((rij) => rij.id !== id)));
    return true;
  }, []);

  return {
    codes: codes ?? [],
    /** Alleen de eerste keer: een refresh op de achtergrond houdt de lijst staan. */
    laden: codes === null && fout === null,
    fout,
    /** true zolang een handmatige retry loopt (voor de knop-staat). */
    bezig,
    herlaad,
    /** true = de fase5-migratie is nog niet gepusht (policies/RPC ontbreken). */
    nogNietBeschikbaar,
    maakCode,
    maakBezig,
    maakFout,
    trekIn,
    /** Id van de code die nu ingetrokken wordt (voor de knop-staat), anders null. */
    bezigeCode,
    trekFout,
  };
}
