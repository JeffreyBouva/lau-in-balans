import { describe, expect, it } from 'vitest';
import { dagTotaal, telPortiesOp, weekNummer } from './helpers';
import { LEGE_PORTIES } from './handmaten';

describe('weekNummer', () => {
  it('is 1 op de startdag en de eerste zes dagen', () => {
    expect(weekNummer('2026-07-30', '2026-07-30')).toBe(1);
    expect(weekNummer('2026-07-30', '2026-08-05')).toBe(1);
  });
  it('is 2 op dag 7', () => {
    expect(weekNummer('2026-07-30', '2026-08-06')).toBe(2);
  });
  it('is 4 na drie volle weken', () => {
    expect(weekNummer('2026-07-09', '2026-07-30')).toBe(4);
  });
  it('klemt op 1 als vandaag vóór de startdatum ligt', () => {
    expect(weekNummer('2026-08-01', '2026-07-30')).toBe(1);
  });
});

describe('telPortiesOp', () => {
  it('telt per handmaat op', () => {
    expect(
      telPortiesOp({ eiwit: 1, groente: 2, koolhydraten: 1, vet: 0 }, { eiwit: 1, groente: 0, koolhydraten: 0, vet: 1 }),
    ).toEqual({ eiwit: 2, groente: 2, koolhydraten: 1, vet: 1 });
  });
});

describe('dagTotaal', () => {
  it('sommeert de porties van meerdere logs', () => {
    expect(
      dagTotaal([
        { porties: { eiwit: 1, groente: 2, koolhydraten: 1, vet: 0 } },
        { porties: { eiwit: 1, groente: 1, koolhydraten: 0, vet: 1 } },
      ]),
    ).toEqual({ eiwit: 2, groente: 3, koolhydraten: 1, vet: 1 });
  });
  it('geeft lege porties bij geen logs', () => {
    expect(dagTotaal([])).toEqual(LEGE_PORTIES);
  });
});
