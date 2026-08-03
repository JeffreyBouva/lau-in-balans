'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useCoach } from '@/lib/coach';
import { ontbreektNog } from '@/lib/migratie';
import { supabase } from '@/lib/supabase';

export type CodeAanvraag = {
  id: string;
  client_id: string;
  /** Vrij tekstje uit de app; '' als de klant niets schreef (nooit null, zie de migratie). */
  bericht: string;
  created_at: string;
  /** Naam van de aanvrager; null als de clients-rij niet (meer) leesbaar is. */
  klantNaam: string | null;
};

type Rij = Omit<CodeAanvraag, 'klantNaam'>;

const LAADFOUT = 'De aanvragen laden lukte niet — probeer opnieuw.';
const AFHANDELFOUT = 'Deze aanvraag afhandelen lukte niet — probeer het opnieuw.';

/**
 * Open codeaanvragen, nieuwste eerst — precies wat de partial index
 * code_aanvragen_open_idx bedient. Afgehandelde aanvragen zijn historie en horen niet in
 * de werkvoorraad.
 *
 * Een coach_id-filter bestaat hier niet: de policy coach_leest_aanvragen scopet de tabel
 * al. LET OP (aanname F1): een aanvrager is meestal een FREE klant zónder coach, en die
 * is voor een gewone coach onzichtbaar — in de praktijk ziet alleen Laura (admin) deze
 * lijst gevuld. Dat is de bedoeling: zij deelt de codes uit.
 *
 * De namen komen uit één extra clients-query. Het e-mailadres van de klant staat in
 * auth.users en is voor een coach niet leesbaar; naam + aanvraagmoment is dus alles wat
 * dit scherm kan tonen.
 */
async function haalAanvragen(): Promise<CodeAanvraag[]> {
  const { data, error } = await supabase
    .from('code_aanvragen')
    .select('id, client_id, bericht, created_at')
    .eq('status', 'open')
    .order('created_at', { ascending: false });
  if (error) throw error;

  const rijen = (data ?? []) as Rij[];
  const ids = [...new Set(rijen.map((r) => r.client_id))];

  const namen = new Map<string, string>();
  if (ids.length > 0) {
    const { data: klanten, error: klantFout } = await supabase
      .from('clients')
      .select('id, naam')
      .in('id', ids);
    // Doorgooien: een lijst met naamloze regels is geen half verhaal maar een onbruikbaar
    // scherm — Laura kan dan niet zien wie er wacht.
    if (klantFout) throw klantFout;
    for (const k of (klanten ?? []) as { id: string; naam: string }[]) namen.set(k.id, k.naam);
  }

  // Een ontbrekende naam is géén fout: de klant kan net verwijderd zijn (AVG) terwijl de
  // aanvraag nog in beeld staat. De pagina toont dan "een verwijderde klant".
  return rijen.map((r) => ({ ...r, klantNaam: namen.get(r.client_id) ?? null }));
}

/**
 * De werkvoorraad codeaanvragen voor het dashboard: de open aanvragen en het afhandelen
 * ervan. Codes maken zit bewust níet hier — dat is `useInvites().maakCode()`; een
 * aanvraag is een verzoek, geen automatische toekenning (F1).
 *
 * Zolang de migratie 20260803140000_code_aanvragen.sql niet gepusht is bestaat de tabel
 * nog niet; dat pad krijgt een eigen vlag (`nogNietBeschikbaar`) in plaats van een kale
 * fout, zodat de pagina kan uitleggen wat er moet gebeuren (patroon: useInvites).
 */
export function useCodeAanvragen() {
  const { coach } = useCoach();
  const coachId = coach?.id ?? null;

  // null = nog nooit geladen; daarna altijd de laatst bekende stand — een mislukte
  // refresh laat de oude lijst dus staan, mét foutmelding erboven.
  const [aanvragen, setAanvragen] = useState<CodeAanvraag[] | null>(null);
  const [fout, setFout] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);
  const [nogNietBeschikbaar, setNogNiet] = useState(false);
  // Ophogen = opnieuw ophalen. Via een teller i.p.v. een callback die zelf fetcht,
  // zodat élke laadbeurt dezelfde weg loopt en de effect-cleanup de race-guard is.
  const [tik, setTik] = useState(0);

  const [bezigeAanvraag, setBezigeAanvraag] = useState<string | null>(null);
  const [afhandelFout, setAfhandelFout] = useState<string | null>(null);

  useEffect(() => {
    let actueel = true;
    (async () => {
      try {
        const rijen = await haalAanvragen();
        if (!actueel) return;
        setAanvragen(rijen);
        // Pas wissen als er een verse stand tegenover staat.
        setFout(null);
        setNogNiet(false); // een geslaagde laadbeurt bewijst dat de migratie er is
      } catch (e) {
        console.error('[aanvragen] laden mislukt:', e);
        if (!actueel) return;
        if (ontbreektNog(e as { code?: string; message?: string })) {
          setNogNiet(true);
          // Ook een (lege) stand wegschrijven: anders blijft `laden` true en hangt de
          // sectie op de skeleton in plaats van de uitleg te tonen.
          setAanvragen((a) => a ?? []);
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

  // Dubbelklik-guard in een ref: de bezig-state is er voor de knoppen, maar die is pas
  // ná de re-render zichtbaar in deze closure.
  const afRef = useRef(false);

  /** true = afgehandeld (de regel verdwijnt uit de lijst). */
  const handelAf = useCallback(
    async (id: string): Promise<boolean> => {
      if (afRef.current) return false;
      if (!coachId) {
        // Kan alleen als de sessie onder Laura's voeten wegvalt; nooit stil laten.
        setAfhandelFout(AFHANDELFOUT);
        return false;
      }
      afRef.current = true;
      setBezigeAanvraag(id);
      setAfhandelFout(null);

      // Exact de drie velden die de policy eist (status + afgehandeld_door = auth.uid() +
      // afgehandeld_op not null); `status = 'open'` staat ook in de USING-kant, dus
      // filteren we er zelf ook op — dat maakt afhandelen idempotent.
      const rond = () =>
        supabase
          .from('code_aanvragen')
          .update({
            status: 'afgehandeld',
            afgehandeld_door: coachId,
            afgehandeld_op: new Date().toISOString(),
          })
          .eq('id', id)
          .eq('status', 'open')
          .select('id');
      let { data, error } = await rond();
      if (error && !ontbreektNog(error)) {
        // Vrijwel altijd een verlopen token (laptop uit slaapstand) → sessie verversen en
        // precies één keer opnieuw proberen. Bij een ontbrekende tabel heeft dat geen zin.
        await supabase.auth.refreshSession();
        ({ data, error } = await rond());
      }

      afRef.current = false;
      setBezigeAanvraag(null);

      if (ontbreektNog(error)) {
        setNogNiet(true);
        return false;
      }
      // LET OP: een door RLS geweigerde update geeft géén error maar 0 rijen — zonder
      // deze telling zou een mislukte afhandeling als succes op het scherm komen.
      if (error || (data ?? []).length === 0) {
        console.error('[aanvragen] afhandelen mislukt:', error?.message ?? '0 rijen geraakt');
        setAfhandelFout(AFHANDELFOUT);
        // Waarschijnlijk is de aanvraag elders al afgehandeld; een verse stand toont dat.
        setTik((t) => t + 1);
        return false;
      }

      setAanvragen((a) => (a === null ? a : a.filter((rij) => rij.id !== id)));
      return true;
    },
    [coachId],
  );

  return {
    aanvragen: aanvragen ?? [],
    /** Alleen de eerste keer: een refresh op de achtergrond houdt de lijst staan. */
    laden: aanvragen === null && fout === null,
    fout,
    /** true zolang een handmatige retry loopt (voor de knop-staat). */
    bezig,
    herlaad,
    /** true = de migratie code_aanvragen is nog niet gepusht (de tabel ontbreekt). */
    nogNietBeschikbaar,
    handelAf,
    /** Id van de aanvraag die nu afgehandeld wordt (voor de knop-staat), anders null. */
    bezigeAanvraag,
    afhandelFout,
  };
}
