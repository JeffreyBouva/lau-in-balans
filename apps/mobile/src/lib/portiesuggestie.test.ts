import { describe, expect, it } from 'vitest';
import {
  suggereerPortiedoelen, klemPortiedoel, PORTIEDOEL_MIN, PORTIEDOEL_MAX,
  type Bouw, type Activiteit,
} from './portiesuggestie';
import { HANDMATEN } from '@lau/shared';

const ALLE_BOUW: Bouw[] = ['vrouw', 'man', 'zeg-ik-liever-niet'];
const ALLE_ACTIVITEIT: Activiteit[] = ['rustig', 'gemiddeld', 'actief'];
const ALLE_MAALTIJDEN = [2, 3, 4];

const doel = (bouw: Bouw, maaltijden: number, activiteit: Activiteit) =>
  suggereerPortiedoelen({ bouw, maaltijden, activiteit });

describe('suggereerPortiedoelen — vrouw (1 handmaat per maaltijd)', () => {
  it('gemiddeld: 1 per maaltijd, dus het aantal maaltijden', () => {
    expect(doel('vrouw', 2, 'gemiddeld')).toEqual({ eiwit: 2, groente: 2, koolhydraten: 2, vet: 2 });
    expect(doel('vrouw', 3, 'gemiddeld')).toEqual({ eiwit: 3, groente: 3, koolhydraten: 3, vet: 3 });
    expect(doel('vrouw', 4, 'gemiddeld')).toEqual({ eiwit: 4, groente: 4, koolhydraten: 4, vet: 4 });
  });

  it('rustig: alleen koolhydraten −1', () => {
    expect(doel('vrouw', 3, 'rustig')).toEqual({ eiwit: 3, groente: 3, koolhydraten: 2, vet: 3 });
    expect(doel('vrouw', 4, 'rustig')).toEqual({ eiwit: 4, groente: 4, koolhydraten: 3, vet: 4 });
  });

  it('actief: koolhydraten +1 en eiwit +1, groente en vet blijven', () => {
    expect(doel('vrouw', 3, 'actief')).toEqual({ eiwit: 4, groente: 3, koolhydraten: 4, vet: 3 });
    expect(doel('vrouw', 4, 'actief')).toEqual({ eiwit: 5, groente: 4, koolhydraten: 5, vet: 4 });
  });
});

describe('suggereerPortiedoelen — man (2 handmaten per maaltijd)', () => {
  it('gemiddeld: het dubbele van vrouw', () => {
    expect(doel('man', 2, 'gemiddeld')).toEqual({ eiwit: 4, groente: 4, koolhydraten: 4, vet: 4 });
    expect(doel('man', 3, 'gemiddeld')).toEqual({ eiwit: 6, groente: 6, koolhydraten: 6, vet: 6 });
    expect(doel('man', 4, 'gemiddeld')).toEqual({ eiwit: 8, groente: 8, koolhydraten: 8, vet: 8 });
  });

  it('rustig en actief corrigeren met dezelfde ±1, niet met een factor', () => {
    expect(doel('man', 3, 'rustig')).toEqual({ eiwit: 6, groente: 6, koolhydraten: 5, vet: 6 });
    expect(doel('man', 3, 'actief')).toEqual({ eiwit: 7, groente: 6, koolhydraten: 7, vet: 6 });
    expect(doel('man', 4, 'actief')).toEqual({ eiwit: 9, groente: 8, koolhydraten: 9, vet: 8 });
  });
});

describe('suggereerPortiedoelen — zeg ik liever niet (het midden)', () => {
  it('bij een even uitkomst precies het midden tussen vrouw en man', () => {
    // 1,5 × 2 = 3 en 1,5 × 4 = 6: geen halve portie, dus geen afronding nodig.
    expect(doel('zeg-ik-liever-niet', 2, 'gemiddeld')).toEqual({ eiwit: 3, groente: 3, koolhydraten: 3, vet: 3 });
    expect(doel('zeg-ik-liever-niet', 4, 'gemiddeld')).toEqual({ eiwit: 6, groente: 6, koolhydraten: 6, vet: 6 });
  });

  it('halve portie (1,5 × 3 = 4,5): eiwit en groente omhoog, koolhydraten en vet omlaag', () => {
    expect(doel('zeg-ik-liever-niet', 3, 'gemiddeld')).toEqual({ eiwit: 5, groente: 5, koolhydraten: 4, vet: 4 });
  });

  it('activiteit werkt hetzelfde als bij de andere twee', () => {
    expect(doel('zeg-ik-liever-niet', 3, 'rustig')).toEqual({ eiwit: 5, groente: 5, koolhydraten: 3, vet: 4 });
    expect(doel('zeg-ik-liever-niet', 3, 'actief')).toEqual({ eiwit: 6, groente: 5, koolhydraten: 5, vet: 4 });
  });

  it('ligt voor elke maaltijdstand tussen vrouw en man in', () => {
    for (const maaltijden of ALLE_MAALTIJDEN) {
      for (const activiteit of ALLE_ACTIVITEIT) {
        const v = doel('vrouw', maaltijden, activiteit);
        const m = doel('man', maaltijden, activiteit);
        const tussen = doel('zeg-ik-liever-niet', maaltijden, activiteit);
        for (const h of HANDMATEN) {
          expect(tussen[h.key]).toBeGreaterThanOrEqual(v[h.key]);
          expect(tussen[h.key]).toBeLessThanOrEqual(m[h.key]);
        }
      }
    }
  });
});

describe('suggereerPortiedoelen — klemming', () => {
  it('nooit 0: een rustige dag kan het laagste doel niet onder 1 duwen', () => {
    // vrouw, 1 maaltijd, rustig: 1 − 1 = 0 → geklemd op 1.
    expect(doel('vrouw', 1, 'rustig')).toEqual({ eiwit: 1, groente: 1, koolhydraten: 1, vet: 1 });
    // De laagste stand die de UI toestaat (2 maaltijden) blijft ook boven 0.
    expect(doel('vrouw', 2, 'rustig').koolhydraten).toBe(1);
  });

  it('nooit boven 12, ook niet bij een absurd aantal maaltijden', () => {
    const veel = doel('man', 9, 'actief');
    for (const h of HANDMATEN) expect(veel[h.key]).toBe(PORTIEDOEL_MAX);
  });

  it('elke combinatie uit de UI geeft hele getallen binnen 1..12', () => {
    for (const bouw of ALLE_BOUW) {
      for (const maaltijden of ALLE_MAALTIJDEN) {
        for (const activiteit of ALLE_ACTIVITEIT) {
          const p = doel(bouw, maaltijden, activiteit);
          for (const h of HANDMATEN) {
            expect(Number.isInteger(p[h.key])).toBe(true);
            expect(p[h.key]).toBeGreaterThanOrEqual(PORTIEDOEL_MIN);
            expect(p[h.key]).toBeLessThanOrEqual(PORTIEDOEL_MAX);
          }
        }
      }
    }
  });

  it('vult alle vier de handmaten, geen enkele ontbreekt', () => {
    expect(Object.keys(doel('vrouw', 3, 'gemiddeld')).sort()).toEqual(HANDMATEN.map((h) => h.key).sort());
  });
});

describe('klemPortiedoel', () => {
  it('klemt op de grenzen en rondt af op hele porties', () => {
    expect(klemPortiedoel(0)).toBe(1);
    expect(klemPortiedoel(-4)).toBe(1);
    expect(klemPortiedoel(13)).toBe(12);
    expect(klemPortiedoel(4.5)).toBe(5);
    expect(klemPortiedoel(7)).toBe(7);
  });

  it('geen NaN naar buiten: die valt terug op het minimum', () => {
    expect(klemPortiedoel(Number.NaN)).toBe(1);
    expect(klemPortiedoel(Number.POSITIVE_INFINITY)).toBe(PORTIEDOEL_MAX);
  });
});
