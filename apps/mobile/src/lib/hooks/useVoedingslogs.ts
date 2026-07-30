import { useCallback, useEffect, useState } from 'react';
import type { HandKey, Porties, Moment } from '@lau/shared';
import { supabase } from '../supabase';
import { dagStand, weekTotalen } from './useVoedingslogs.reducer';
import { vandaagISO, weekdagenTerug } from '../datum';

type Row = { id: string; datum: string; moment: Moment; porties: Porties; bron: 'chat' | 'eten' };

export function useVoedingslogs(clientId: string) {
  const [rows, setRows] = useState<Row[]>([]);
  const laad = useCallback(async () => {
    const { data } = await supabase.from('food_logs').select('id, datum, moment, porties, bron')
      .gte('datum', weekdagenTerug(7)[0]);
    setRows((data as Row[]) ?? []);
  }, []);
  useEffect(() => { laad(); }, [laad]);

  const vandaag = vandaagISO();
  const dag = dagStand(rows, vandaag);
  const week = weekTotalen(rows, weekdagenTerug(7));

  const pasQuickAan = useCallback(async (handmaat: HandKey, delta: number) => {
    const quick = rows.find((r) => r.datum === vandaag && r.bron === 'eten' && r.moment === 'Tussendoor');
    if (quick) {
      const nieuw = { ...quick.porties, [handmaat]: Math.max(0, quick.porties[handmaat] + delta) };
      await supabase.from('food_logs').update({ porties: nieuw }).eq('id', quick.id);
    } else if (delta > 0) {
      await supabase.from('food_logs').insert({ client_id: clientId, datum: vandaag, moment: 'Tussendoor',
        porties: { eiwit: 0, groente: 0, koolhydraten: 0, vet: 0, [handmaat]: delta }, bron: 'eten' });
    }
    await laad();
  }, [rows, vandaag, clientId, laad]);

  const voegLogToe = useCallback(async (moment: Moment, porties: Porties) => {
    await supabase.from('food_logs').insert({ client_id: clientId, datum: vandaag, moment, porties, bron: 'chat' });
    await laad();
  }, [clientId, vandaag, laad]);

  return { dag, week, pasQuickAan, voegLogToe, herlaad: laad };
}
