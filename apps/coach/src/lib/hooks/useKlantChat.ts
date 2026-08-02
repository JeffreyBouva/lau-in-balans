'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Sender } from '@lau/shared';
import { supabase } from '@/lib/supabase';

export type ChatBericht = {
  id: string;
  sender: Sender;
  tekst: string | null;
  /** Gezet = voedingslog-bericht (tekst is dan null; zie check-constraint op messages). */
  food_log_id: string | null;
  created_at: string;
};

const KOLOMMEN = 'id, sender, tekst, food_log_id, created_at';
const LAADFOUT = 'Het gesprek laden lukte niet — probeer opnieuw.';
const VERSTUURFOUT = 'Je antwoord versturen lukte niet — probeer het opnieuw.';

/**
 * Alles wat aan één klant hangt in één state-object. Next hergebruikt deze component
 * als alléén [id] verandert, dus zonder die tag zou het gesprek van de vorige klant
 * even in het nieuwe scherm blijven staan. Zelfde truc als de coach-check in coach.tsx.
 */
type Stand = { clientId: string; berichten: ChatBericht[]; fout: string | null };

/** Verse serverstand vooropzetten, maar realtime-berichten die er (nog) niet in zitten behouden. */
function samenvoegen(vers: ChatBericht[], bestaand: ChatBericht[]): ChatBericht[] {
  const ids = new Set(vers.map((m) => m.id));
  const extra = bestaand.filter((m) => !ids.has(m.id));
  if (extra.length === 0) return vers;
  return [...vers, ...extra].sort(
    (a, b) => Date.parse(a.created_at) - Date.parse(b.created_at),
  );
}

/**
 * Het volledige gesprek van één klant, live.
 *
 * Realtime luistert op INSERT én UPDATE: Lau's antwoord wordt eerst als (bijna) leeg
 * bericht ingevoegd en groeit daarna via UPDATE-events (streaming) — alleen op INSERT
 * luisteren zou Laura een leeg bericht laten zien.
 *
 * De pagina draait achter de Gate, dus er is gegarandeerd een sessie: de anon-fetch-race
 * die de klant-app moest opvangen speelt hier niet.
 */
export function useKlantChat(clientId: string) {
  const [stand, setStand] = useState<Stand | null>(null);
  const [verstuurt, setVerstuurt] = useState(false);
  const [verstuurFout, setVerstuurFout] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);
  // Ophogen = opnieuw ophalen. Via een teller i.p.v. een callback die zelf fetcht,
  // zodat élke laadbeurt dezelfde weg loopt en de effect-cleanup de race-guard is.
  const [tik, setTik] = useState(0);

  const actueel = stand?.clientId === clientId ? stand : null;

  useEffect(() => {
    let geldig = true;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('messages')
          .select(KOLOMMEN)
          .eq('client_id', clientId)
          .order('created_at', { ascending: true });
        if (error) throw error;
        if (!geldig) return;
        const rijen = (data ?? []) as ChatBericht[];
        setStand((s) => ({
          clientId,
          // Realtime kan tijdens de fetch al iets hebben binnengebracht dat nog niet
          // in `rijen` zat — samenvoegen i.p.v. overschrijven, anders valt dat weg.
          berichten: s?.clientId === clientId ? samenvoegen(rijen, s.berichten) : rijen,
          fout: null,
        }));
      } catch (e) {
        console.error('[klantchat] laden mislukt:', e);
        if (!geldig) return;
        // Ook bij een storing een stand wegschrijven: anders blijft `laden` true en
        // hangt het scherm eeuwig op de skeleton.
        setStand((s) => ({
          clientId,
          berichten: s?.clientId === clientId ? s.berichten : [],
          fout: LAADFOUT,
        }));
      } finally {
        if (geldig) setBezig(false);
      }
    })();
    return () => {
      // Nieuwe beurt (tik), andere klant of unmount: dit antwoord telt niet meer.
      geldig = false;
    };
  }, [clientId, tik]);

  useEffect(() => {
    const topic = `dash-messages:${clientId}`;
    // Ruim een achtergebleven kanaal met dezelfde topic op (Fast Refresh / dubbele
    // mount in StrictMode), anders gooit supabase-js "cannot add postgres_changes
    // callbacks after subscribe()".
    supabase
      .getChannels()
      .filter((c) => c.topic === `realtime:${topic}`)
      .forEach((c) => supabase.removeChannel(c));
    const kanaal = supabase
      .channel(topic)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages', filter: `client_id=eq.${clientId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const nieuw = payload.new as ChatBericht;
            setStand((s) => {
              if (s?.clientId !== clientId) return s;
              // Dedup: een optimistisch getoond bericht komt ook via de echo terug.
              if (s.berichten.some((m) => m.id === nieuw.id)) return s;
              return { ...s, berichten: [...s.berichten, nieuw] };
            });
          } else if (payload.eventType === 'UPDATE') {
            // Streaming: Lau's bericht groeit via UPDATE-events; vervang op id.
            const gewijzigd = payload.new as ChatBericht;
            setStand((s) => {
              if (s?.clientId !== clientId) return s;
              if (!s.berichten.some((m) => m.id === gewijzigd.id)) return s;
              return {
                ...s,
                berichten: s.berichten.map((m) =>
                  m.id === gewijzigd.id ? { ...m, ...gewijzigd } : m,
                ),
              };
            });
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(kanaal);
    };
  }, [clientId]);

  const herlaad = useCallback(() => {
    setBezig(true);
    setTik((t) => t + 1);
  }, []);

  // Dubbelklik-/dubbel-sneltoets-guard in een ref: `verstuurt` is er voor de knopstaat,
  // maar die is pas ná de re-render zichtbaar in deze closure.
  const verstuurtRef = useRef(false);

  /** true = geplaatst (de pagina mag het invoerveld leegmaken). */
  const verstuurAlsCoach = useCallback(
    async (tekst: string): Promise<boolean> => {
      const schoon = tekst.trim();
      if (!schoon || verstuurtRef.current) return false;
      verstuurtRef.current = true;
      setVerstuurt(true);
      setVerstuurFout(null);

      const plaats = () =>
        supabase
          .from('messages')
          .insert({ client_id: clientId, sender: 'coach', tekst: schoon })
          .select(KOLOMMEN)
          .single();
      let { data, error } = await plaats();
      if (error) {
        // Vrijwel altijd een verlopen token (laptop uit slaapstand) → sessie verversen
        // en precies één keer opnieuw proberen.
        await supabase.auth.refreshSession();
        ({ data, error } = await plaats());
      }

      verstuurtRef.current = false;
      setVerstuurt(false);
      if (error || !data) {
        // Nooit stil falen: Laura moet zien dat haar antwoord níet bij de klant staat.
        console.error('[klantchat] versturen mislukt:', error?.message);
        setVerstuurFout(VERSTUURFOUT);
        return false;
      }

      const rij = data as ChatBericht;
      // Optimistisch tonen; de dedup hierboven vangt de realtime-echo op.
      setStand((s) => {
        if (s?.clientId !== clientId) return s;
        if (s.berichten.some((m) => m.id === rij.id)) return s;
        return { ...s, berichten: [...s.berichten, rij] };
      });
      return true;
    },
    [clientId],
  );

  return {
    berichten: actueel?.berichten ?? [],
    /** Alleen de allereerste keer: een retry laat het gesprek staan, mét melding erboven. */
    laden: actueel === null,
    fout: actueel?.fout ?? null,
    /** true zolang een handmatige retry loopt (voor de knop-staat). */
    bezig,
    herlaad,
    verstuurAlsCoach,
    verstuurt,
    verstuurFout,
  };
}
