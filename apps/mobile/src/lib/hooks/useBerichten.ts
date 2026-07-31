import { useCallback, useEffect, useState } from 'react';
import type { Sender } from '@lau/shared';
import { supabase } from '../supabase';

export type Bericht = { id: string; sender: Sender; tekst: string | null; food_log_id: string | null; created_at: string };

export function useBerichten(clientId: string) {
  const [berichten, setBerichten] = useState<Bericht[]>([]);
  // Typing-indicator: aan vanaf het versturen tot Lau's ai-antwoord via realtime binnenkomt.
  const [wachtOpLau, setWachtOpLau] = useState(false);
  useEffect(() => {
    supabase.from('messages').select('id, sender, tekst, food_log_id, created_at')
      .order('created_at', { ascending: true }).then(({ data }) => setBerichten((data as Bericht[]) ?? []));
    const kanaal = supabase.channel(`messages:${clientId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `client_id=eq.${clientId}` },
        (payload) => {
          const nieuw = payload.new as Bericht;
          setBerichten((b) => [...b, nieuw]);
          if (nieuw.sender === 'ai') setWachtOpLau(false); // Lau heeft geantwoord → indicator uit
        })
      .subscribe();
    return () => { supabase.removeChannel(kanaal); };
  }, [clientId]);

  const verstuur = useCallback(async (tekst: string) => {
    setWachtOpLau(true);
    await supabase.from('messages').insert({ client_id: clientId, sender: 'client', tekst });
    supabase.functions.invoke('lau-reply').catch(() => setWachtOpLau(false)); // antwoord komt via realtime
    // veiligheids-timeout: verberg de indicator na 30s als er niets komt
    setTimeout(() => setWachtOpLau(false), 30_000);
  }, [clientId]);

  return { berichten, verstuur, wachtOpLau };
}
