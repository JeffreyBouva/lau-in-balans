import { createContext, useContext, type ReactNode } from 'react';
import { useBerichten } from '@/lib/hooks/useBerichten';
import { useFlag } from '@/lib/hooks/useFlag';
import { useVoedingslogs } from '@/lib/hooks/useVoedingslogs';

/**
 * KlantDataProvider (C1-fix). supabase-js dedupt realtime-kanalen op topic en gooit
 * als een tweede consumer `.on('postgres_changes', …)` aanroept op een al-geabonneerd
 * kanaal. Daardoor crashten de tabs zodra chat + vandaag + eten + LauraSheet elk hun
 * eigen useBerichten/useFlag/useVoedingslogs mountten. Hier instantiëren we die hooks
 * exact één keer en delen we het resultaat via context — één subscriber per topic.
 * Bijkomend voordeel: één gedeelde flag-instance, dus alle LauraKnop's flippen samen.
 */
const Ctx = createContext<ReturnType<typeof waarden> | null>(null);

function waarden(clientId: string) {
  const berichten = useBerichten(clientId);
  const flag = useFlag(clientId);
  const logs = useVoedingslogs(clientId);
  // Sleutels botsen niet: berichten/verstuur/wachtOpLau · openFlag/maakFlag · dag/week/quick/pasQuickAan/voegLogToe/herlaad.
  return { ...berichten, ...flag, ...logs };
}

export function KlantDataProvider({ clientId, children }: { clientId: string; children: ReactNode }) {
  const v = waarden(clientId);
  return <Ctx.Provider value={v}>{children}</Ctx.Provider>;
}

export function useKlantData() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useKlantData buiten KlantDataProvider');
  return v;
}
