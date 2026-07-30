import { describe, expect, it } from 'vitest';
import { dagTotaal, naarISODatum, telPortiesOp, vandaagISO, weekNummer } from './helpers.ts';
import { LEGE_PORTIES } from './handmaten.ts';

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
  it('rekent over een DST-overgang heen in hele dagen', () => {
    expect(weekNummer('2026-03-25', '2026-04-01')).toBe(2);
  });
  it('rekent over een jaargrens heen', () => {
    expect(weekNummer('2025-12-29', '2026-01-05')).toBe(2);
  });
  it('gooit op ongeldig datumformaat', () => {
    expect(() => weekNummer('2026-07-30T10:00:00.000Z', '2026-07-30')).toThrow();
    expect(() => weekNummer('kaas', '2026-07-30')).toThrow();
  });
});

describe('naarISODatum', () => {
  it('formatteert de lokale kalenderdag', () => {
    expect(naarISODatum(new Date(2026, 6, 30))).toBe('2026-07-30');
  });
  it('padt maand en dag naar twee cijfers', () => {
    expect(naarISODatum(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
  it('gebruikt de lokale dag, niet de UTC-dag (middernacht-grens)', () => {
    // 1 jan 2026 00:30 lokaal is in Europe/Amsterdam 31 dec 2025 23:30 UTC.
    expect(naarISODatum(new Date(2026, 0, 1, 0, 30))).toBe('2026-01-01');
  });
});

describe('vandaagISO', () => {
  it('geeft vandaag in YYYY-MM-DD', () => {
    expect(vandaagISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(vandaagISO()).toBe(naarISODatum(new Date()));
  });
});

describe('telPortiesOp', () => {
  it('telt per handmaat op', () => {
    expect(
      telPortiesOp({ eiwit: 1, groente: 2, koolhydraten: 1, vet: 0 }, { eiwit: 1, groente: 0, koolhydraten: 0, vet: 1 }),
    ).toEqual({ eiwit: 2, groente: 2, koolhydraten: 1, vet: 1 });
  });
  it('muteert geen van beide inputs', () => {
    const a = { eiwit: 1, groente: 2, koolhydraten: 1, vet: 0 };
    const b = { eiwit: 1, groente: 0, koolhydraten: 0, vet: 1 };
    telPortiesOp(a, b);
    expect(a).toEqual({ eiwit: 1, groente: 2, koolhydraten: 1, vet: 0 });
    expect(b).toEqual({ eiwit: 1, groente: 0, koolhydraten: 0, vet: 1 });
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
  it('geeft een vers object terug, niet de gedeelde constante', () => {
    const resultaat = dagTotaal([]);
    expect(resultaat).not.toBe(LEGE_PORTIES);
    resultaat.eiwit += 1;
    expect(LEGE_PORTIES.eiwit).toBe(0);
  });
});
