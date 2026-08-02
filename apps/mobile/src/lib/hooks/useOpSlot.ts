import { useSessie } from '@/lib/sessie';
import { useConfig } from './useConfig';

/**
 * Eén bron voor de slot-beslissing. `laden` = nog geen betrouwbaar oordeel — render dan
 * geen tier-afhankelijke blokken, dat voorkomt flitsen in beide richtingen:
 * - tier laadt nog (tier is null) → een slot bij een coached klant;
 * - config laadt nog (sloten_actief staat default op true) → een slot dat ops net uit zette.
 */
export function useOpSlot() {
  const { tier, tierLaden } = useSessie();
  const { slotenActief, laden: configLaden } = useConfig();
  return { opSlot: tier === 'free' && slotenActief, laden: tierLaden || configLaden };
}
