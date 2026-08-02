import type { ClientStatus } from '@lau/shared';

/*
 * Kleurregel: sage = klant & voortgang, clay = coach-aandacht. Vandaar 'stil' in
 * clay (die klant vraagt om een zetje) en 'actief' juist rustig-neutraal: als vier
 * van de zes rijen groen oplichten, licht er niets meer op.
 */
const stijl: Record<ClientStatus, string> = {
  nieuw: 'border-sage-soft-border bg-sage-soft text-sage-ink',
  actief: 'border-hairline-soft bg-surface-sunken text-body',
  stil: 'border-clay-border bg-clay-soft text-clay-ink',
  gestopt: 'border-hairline bg-neutral-soft text-body',
};

/** Statuschip van een klant — zelfde vorm op de lijst en op het klantdetail. */
export function StatusChip({ status }: { status: ClientStatus }) {
  return (
    <span className={`rounded-full border px-2.5 py-0.5 text-xs ${stijl[status]}`}>{status}</span>
  );
}
