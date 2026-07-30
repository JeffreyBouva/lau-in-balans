import type { HandKey, Porties } from './types';

export interface Handmaat {
  key: HandKey;
  naam: string;
  hand: string;
  uitleg: string;
  dagdoel: number;
  kleur: string;
}

export const HANDMATEN: readonly Handmaat[] = [
  { key: 'eiwit', naam: 'Eiwit', hand: 'Handpalm', uitleg: 'vlees, vis, kwark, tofu', dagdoel: 3, kleur: '#63805F' },
  { key: 'groente', naam: 'Groente', hand: 'Vuist', uitleg: 'alle groente en salade', dagdoel: 4, kleur: '#7E9C6E' },
  { key: 'koolhydraten', naam: 'Koolhydraten', hand: 'Holle hand', uitleg: 'rijst, pasta, brood, aardappel', dagdoel: 2, kleur: '#C1A277' },
  { key: 'vet', naam: 'Vetten', hand: 'Duim', uitleg: 'olie, kaas, avocado, pindakaas', dagdoel: 2, kleur: '#B0603F' },
] as const;

export const PORTIE_DOEL_DEFAULT: Porties = { eiwit: 3, groente: 4, koolhydraten: 2, vet: 2 };
export const LEGE_PORTIES: Porties = { eiwit: 0, groente: 0, koolhydraten: 0, vet: 0 };
