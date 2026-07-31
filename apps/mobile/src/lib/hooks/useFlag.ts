import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabase';

export function useFlag(clientId: string) {
  const [openFlag, setOpenFlag] = useState(false);
  const laad = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return; // zonder sessie niet als anon query'en
    const { data } = await supabase.from('flags').select('id').eq('status', 'open').limit(1);
    setOpenFlag((data?.length ?? 0) > 0);
  }, []);
  useEffect(() => {
    laad();
    const kanaal = supabase
      .channel(`flags:${clientId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'flags', filter: `client_id=eq.${clientId}` },
        () => laad(),
      )
      .subscribe();
    // Eerste mount-load kan als anon draaien (sessie nog niet in geheugen). Herlaad zodra
    // er een sessie is, bij elk auth-event (incl. INITIAL_SESSION na page-reload).
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) laad();
    });
    return () => {
      supabase.removeChannel(kanaal);
      sub.subscription.unsubscribe();
    };
  }, [clientId, laad]);
  const maakFlag = useCallback(async (tekst: string, redenen: string[]) => {
    await supabase.from('flags').insert({ client_id: clientId, tekst, redenen, status: 'open' });
    await laad();
  }, [clientId, laad]);
  return { openFlag, maakFlag };
}
