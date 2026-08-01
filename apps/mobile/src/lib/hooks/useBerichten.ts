import { useCallback, useEffect, useState } from 'react';
import type { Sender } from '@lau/shared';
import { supabase } from '../supabase';

export type Bericht = { id: string; sender: Sender; tekst: string | null; food_log_id: string | null; created_at: string };

const KOLOMMEN = 'id, sender, tekst, food_log_id, created_at';

export function useBerichten(clientId: string) {
  const [berichten, setBerichten] = useState<Bericht[]>([]);
  // Typing-indicator: aan vanaf het versturen tot Lau's ai-antwoord via realtime binnenkomt.
  const [wachtOpLau, setWachtOpLau] = useState(false);
  // AI-gegenereerde vervolgsuggesties (tier 2) uit het lau-reply-antwoord. Leeg → de chat
  // valt terug op de regel-gebaseerde suggesties.
  const [aiSuggesties, setAiSuggesties] = useState<string[]>([]);

  const laad = useCallback(async () => {
    // getSession() wacht op het herstel uit storage; zonder sessie niet query'en, anders
    // draait 'ie als anon → 0 rijen → zou de lijst wissen.
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data } = await supabase.from('messages').select(KOLOMMEN)
      .order('created_at', { ascending: true });
    if (data) setBerichten(data as Bericht[]);
  }, []);

  useEffect(() => {
    laad();
    const topic = `messages:${clientId}`;
    // Ruim een achtergebleven kanaal met dezelfde topic op (Fast Refresh / dubbele mount),
    // anders gooit supabase-js "cannot add postgres_changes callbacks after subscribe()".
    supabase.getChannels().filter((c) => c.topic === `realtime:${topic}`).forEach((c) => supabase.removeChannel(c));
    const kanaal = supabase.channel(topic)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `client_id=eq.${clientId}` },
        (payload) => {
          const nieuw = payload.new as Bericht;
          // Dedup: een optimistisch getoond bericht komt ook via de realtime-echo terug.
          setBerichten((b) => (b.some((m) => m.id === nieuw.id) ? b : [...b, nieuw]));
          if (nieuw.sender === 'ai') setWachtOpLau(false); // Lau heeft geantwoord → indicator uit
        })
      .subscribe();
    // De eerste mount-load kan als anon draaien (sessie nog niet uit storage in geheugen)
    // → 0 rijen. Herlaad zodra er een sessie beschikbaar is, bij ELK auth-event — met
    // name INITIAL_SESSION na een page-reload, en SIGNED_IN/TOKEN_REFRESHED daarna.
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) laad();
    });
    return () => { supabase.removeChannel(kanaal); sub.subscription.unsubscribe(); };
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
    // AI-antwoord komt via realtime; de vervolgsuggesties komen terug in het invoke-antwoord.
    supabase.functions.invoke('lau-reply')
      .then(({ data }) => {
        const s = (data as { suggesties?: unknown } | null)?.suggesties;
        if (Array.isArray(s) && s.length) setAiSuggesties(s.filter((x): x is string => typeof x === 'string'));
      })
      .catch(() => setWachtOpLau(false));
    setTimeout(() => setWachtOpLau(false), 30_000); // veiligheids-timeout als er niets komt
  }, [clientId]);

  return { berichten, verstuur, wachtOpLau, aiSuggesties };
}
