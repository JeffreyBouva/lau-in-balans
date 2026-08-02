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
 *
 * BELANGRIJK: roep de hooks DIRECT in deze component aan, niet via een losse lowercase
 * helper. Een `function waarden(clientId){ useBerichten(...) }` die hier werd aangeroepen
 * werd door React Compiler (reactCompiler: true) als pure functie op `clientId`
 * gememoïseerd → de begin-state (lege lijst) bleef eeuwig hangen, ook al laadde de hook
 * intern 47 berichten. Direct aanroepen laat de compiler ze correct als hooks tracken.
 */
type KlantData = ReturnType<typeof useBerichten> &
  ReturnType<typeof useFlag> &
  ReturnType<typeof useVoedingslogs>;

const Ctx = createContext<KlantData | null>(null);

export function KlantDataProvider({ clientId, children }: { clientId: string; children: ReactNode }) {
  const berichten = useBerichten(clientId);
  const flag = useFlag(clientId);
  const logs = useVoedingslogs(clientId);
  // Sleutels botsen niet: berichten/verstuur/wachtOpLau/aiSuggesties/limietBereikt ·
  // openFlag/maakFlag · dag/week/quick/pasQuickAan/voegLogToe/herlaad.
  const v: KlantData = { ...berichten, ...flag, ...logs };
  return <Ctx.Provider value={v}>{children}</Ctx.Provider>;
}

export function useKlantData() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useKlantData buiten KlantDataProvider');
  return v;
}
