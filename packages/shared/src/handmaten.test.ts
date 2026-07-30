import { describe, expect, it } from 'vitest';
import { HANDMATEN, LEGE_PORTIES, PORTIE_DOEL_DEFAULT } from './handmaten.ts';
import { colors } from './tokens.ts';
import type { HandKey } from './types.ts';

describe('HANDMATEN', () => {
  it('dekt elke HandKey precies één keer', () => {
    // map() en Object.keys() geven verse arrays, dus sort() muteert niets gedeelds.
    const keys = HANDMATEN.map((h) => h.key).sort();
    expect(keys).toEqual(Object.keys(LEGE_PORTIES).sort());
    expect(new Set(keys).size).toBe(HANDMATEN.length);
  });
});

describe('drift-invarianten', () => {
  it('PORTIE_DOEL_DEFAULT klopt met het dagdoel per handmaat', () => {
    for (const h of HANDMATEN) {
      expect(PORTIE_DOEL_DEFAULT[h.key]).toBe(h.dagdoel);
    }
  });

  it('de kleur per handmaat is het bijbehorende food-token', () => {
    const kleurToken: Record<HandKey, string> = {
      eiwit: colors.foodEiwit,
      groente: colors.foodGroente,
      koolhydraten: colors.foodKoolhydraten,
      vet: colors.foodVet,
    };
    for (const h of HANDMATEN) {
      expect(h.kleur).toBe(kleurToken[h.key]);
    }
  });
});

describe('gedeelde constanten', () => {
  it('zijn bevroren, zodat consumers ze niet kunnen muteren', () => {
    expect(Object.isFrozen(LEGE_PORTIES)).toBe(true);
    expect(Object.isFrozen(PORTIE_DOEL_DEFAULT)).toBe(true);
  });
});
