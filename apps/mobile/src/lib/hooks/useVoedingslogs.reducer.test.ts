import { describe, expect, it } from 'vitest';
import { dagStand, weekTotalen } from './useVoedingslogs.reducer';

const logs = [
  { datum: '2026-07-30', porties: { eiwit: 1, groente: 2, koolhydraten: 1, vet: 0 } },
  { datum: '2026-07-30', porties: { eiwit: 1, groente: 0, koolhydraten: 0, vet: 1 } },
  { datum: '2026-07-29', porties: { eiwit: 2, groente: 1, koolhydraten: 1, vet: 1 } },
];

describe('dagStand', () => {
  it('sommeert de porties van één dag', () => {
    expect(dagStand(logs, '2026-07-30')).toEqual({ eiwit: 2, groente: 2, koolhydraten: 1, vet: 1 });
  });
  it('geeft lege porties bij een dag zonder logs', () => {
    expect(dagStand(logs, '2026-07-28')).toEqual({ eiwit: 0, groente: 0, koolhydraten: 0, vet: 0 });
  });
});
describe('weekTotalen', () => {
  it('geeft per dag de som in dagvolgorde', () => {
    expect(weekTotalen(logs, ['2026-07-29', '2026-07-30'])).toEqual([
      { datum: '2026-07-29', porties: { eiwit: 2, groente: 1, koolhydraten: 1, vet: 1 } },
      { datum: '2026-07-30', porties: { eiwit: 2, groente: 2, koolhydraten: 1, vet: 1 } },
    ]);
  });
});
