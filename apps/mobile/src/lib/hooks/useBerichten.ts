import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import type { Sender } from '@lau/shared';
import { supabase } from '../supabase';

export type Bericht = { id: string; sender: Sender; tekst: string | null; food_log_id: string | null; created_at: string };

const KOLOMMEN = 'id, sender, tekst, food_log_id, created_at';

/**
 * Is dit de maandlimiet-afkap (429) van lau-reply?
 *
 * supabase-js 2.111 (@supabase/functions-js 2.111): `functions.invoke()` gooit NIET, maar
 * geeft `{ data: null, error }` terug. Bij een non-2xx doet FunctionsClient intern
 * `throw new FunctionsHttpError(response)` en `FunctionsError` zet dat argument op
 * `this.context` — `error.context` ÍS dus de fetch-Response, met `.status` erop.
 * Defensief uitgelezen: bij een netwerkfout (FunctionsFetchError) is `context` de
 * onderliggende fetch-error zonder status, en dan is dit gewoon false.
 */
function isLimiet(error: unknown): boolean {
  return (error as { context?: { status?: unknown } } | null | undefined)?.context?.status === 429;
}

export function useBerichten(clientId: string) {
  const [berichten, setBerichten] = useState<Bericht[]>([]);
  // Typing-indicator: aan vanaf het versturen tot Lau's ai-antwoord via realtime binnenkomt.
  const [wachtOpLau, setWachtOpLau] = useState(false);
  // AI-gegenereerde vervolgsuggesties (tier 2) uit het lau-reply-antwoord. Leeg → de chat
  // valt terug op de regel-gebaseerde suggesties.
  const [aiSuggesties, setAiSuggesties] = useState<string[]>([]);
  // Maandlimiet bereikt (lau-reply gaf 429): je bericht is wél opgeslagen, Lau antwoordt
  // alleen niet meer deze maand. De chat kapt dan netjes af (zie chat.tsx).
  const [limietBereikt, setLimietBereikt] = useState(false);

  const laad = useCallback(async () => {
    // getSession() wacht op het herstel uit storage; zonder sessie niet query'en, anders
    // draait 'ie als anon → 0 rijen → zou de lijst wissen.
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data } = await supabase.from('messages').select(KOLOMMEN)
      .order('created_at', { ascending: true });
    if (data) {
      setBerichten(data as Bericht[]);
      // De afkap-vlag is een momentopname van één invoke, geen stand van zaken. Elke
      // geslaagde (her)laad — mount, INITIAL_SESSION, SIGNED_IN, TOKEN_REFRESHED —
      // verdient dus een verse poging: de maand kan om zijn of Laura kan de limiet
      // verhoogd hebben. Zit 'ie er nog steeds op, dan komt de 429 gewoon terug.
      setLimietBereikt(false);
    }
  }, []);

  useEffect(() => {
    laad();
    const topic = `messages:${clientId}`;
    // Ruim een achtergebleven kanaal met dezelfde topic op (Fast Refresh / dubbele mount),
    // anders gooit supabase-js "cannot add postgres_changes callbacks after subscribe()".
    supabase.getChannels().filter((c) => c.topic === `realtime:${topic}`).forEach((c) => supabase.removeChannel(c));
    const kanaal = supabase.channel(topic)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `client_id=eq.${clientId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const nieuw = payload.new as Bericht;
            // Dedup: een optimistisch getoond bericht komt ook via de realtime-echo terug.
            setBerichten((b) => (b.some((m) => m.id === nieuw.id) ? b : [...b, nieuw]));
            if (nieuw.sender === 'ai') {
              setWachtOpLau(false); // Lau's antwoord begint → indicator uit
              // Een nieuw ai-antwoord bewijst dat er weer ruimte is (nieuwe maand of een
              // door Laura verhoogde limiet) → de afkap-regel mag weg.
              setLimietBereikt(false);
            }
          } else if (payload.eventType === 'UPDATE') {
            // Streaming: Lau's bericht groeit via UPDATE-events; vervang de tekst op id.
            const gewijzigd = payload.new as Bericht;
            setBerichten((b) => b.map((m) => (m.id === gewijzigd.id ? { ...m, ...gewijzigd } : m)));
            if (gewijzigd.sender === 'ai') setWachtOpLau(false);
          }
        })
      .subscribe();
    // De eerste mount-load kan als anon draaien (sessie nog niet uit storage in geheugen)
    // → 0 rijen. Herlaad zodra er een sessie beschikbaar is, bij ELK auth-event — met
    // name INITIAL_SESSION na een page-reload, en SIGNED_IN/TOKEN_REFRESHED daarna.
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) laad();
    });
    // Zelfde gedachte, tweede ingang: wie de app wegleggt en later terugkomt hoort niet
    // op een afkap-melding van uren geleden te stuiten. Op web is AppState de
    // visibilitychange-API; ontbreekt die (SSR, oude browser), dan geeft
    // addEventListener undefined terug — vandaar de optionele remove().
    const appSub = AppState.addEventListener('change', (staat) => {
      if (staat === 'active') setLimietBereikt(false);
    });
    return () => {
      supabase.removeChannel(kanaal);
      sub.subscription.unsubscribe();
      appSub?.remove();
    };
  }, [clientId, laad]);

  const verstuur = useCallback(async (tekst: string) => {
    setWachtOpLau(true);
    setAiSuggesties([]); // oude suggesties weg zodra je een nieuw bericht stuurt
    const insert = () => supabase.from('messages')
      .insert({ client_id: clientId, sender: 'client', tekst }).select(KOLOMMEN).single();
    let { data, error } = await insert();
    if (error) {
      // Vrijwel altijd een verlopen token → sessie verversen en precies één keer opnieuw proberen.
      await supabase.auth.refreshSession();
      ({ data, error } = await insert());
    }
    if (error || !data) {
      console.error('[chat] versturen mislukt:', error?.message);
      setWachtOpLau(false);
      return;
    }
    const rij = data as Bericht;
    // Optimistisch tonen (dedup tegen de realtime-echo).
    setBerichten((b) => (b.some((m) => m.id === rij.id) ? b : [...b, rij]));
    // AI-antwoord groeit via realtime; het invoke-antwoord geeft het volledige antwoord +
    // de vervolgsuggesties terug.
    supabase.functions.invoke('lau-reply')
      .then(({ data, error }) => {
        // Maandlimiet: geen antwoord meer, dus ook geen typ-indicator en geen suggesties.
        // Het eigen bericht blijft staan — het is opgeslagen, Lau reageert alleen niet.
        if (isLimiet(error)) {
          setLimietBereikt(true);
          setWachtOpLau(false);
          return;
        }
        const d = data as { suggesties?: unknown; berichtId?: string; tekst?: string } | null;
        // Garandeer de volledige tekst, ook als een streaming-UPDATE onderweg gemist is.
        if (d?.berichtId && typeof d.tekst === 'string') {
          const id = d.berichtId, volledig = d.tekst;
          setBerichten((b) => b.map((m) => (m.id === id ? { ...m, tekst: volledig } : m)));
        }
        const s = d?.suggesties;
        if (Array.isArray(s) && s.length) setAiSuggesties(s.filter((x): x is string => typeof x === 'string'));
      })
      .catch(() => setWachtOpLau(false));
    setTimeout(() => setWachtOpLau(false), 30_000); // veiligheids-timeout als er niets komt
  }, [clientId]);

  return { berichten, verstuur, wachtOpLau, aiSuggesties, limietBereikt };
}
