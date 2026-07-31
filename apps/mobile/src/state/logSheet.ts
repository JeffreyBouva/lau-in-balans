import type { HandKey, Moment, Porties } from '@lau/shared';

export type Draft = { moment: Moment; porties: Porties };

export function legeDraft(): Draft {
  return { moment: 'Avondeten', porties: { eiwit: 1, groente: 1, koolhydraten: 1, vet: 0 } };
}

export function pas(d: Draft, h: HandKey, delta: number): Draft {
  return { ...d, porties: { ...d.porties, [h]: Math.max(0, d.porties[h] + delta) } };
}

export function heeftIets(d: Draft): boolean {
  return Object.values(d.porties).some((n) => n > 0);
}
