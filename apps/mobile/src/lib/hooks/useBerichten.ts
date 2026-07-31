import { useCallback, useEffect, useState } from 'react';
import type { Sender } from '@lau/shared';
import { supabase } from '../supabase';

export type Bericht = { id: string; sender: Sender; tekst: string | null; food_log_id: string | null; created_at: string };

export function useBerichten(clientId: string) {
  const [berichten, setBerichten] = useState<Bericht[]>([]);
  useEffect(() => {
    supabase.from('messages').select('id, sender, tekst, food_log_id, created_at')
      .order('created_at', { ascending: true }).then(({ data }) => setBerichten((data as Bericht[]) ?? []));
    const kanaal = supabase.channel(`messages:${clientId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `client_id=eq.${clientId}` },
        (payload) => setBerichten((b) => [...b, payload.new as Bericht]))
      .subscribe();
    return () => { supabase.removeChannel(kanaal); };
  }, [clientId]);

  const verstuur = useCallback(async (tekst: string) => {
    await supabase.from('messages').insert({ client_id: clientId, sender: 'client', tekst });
    // fase 3: hierna lau-reply Edge Function → AI-antwoord + typing-indicator
  }, [clientId]);

  return { berichten, verstuur };
}
