import { describe, expect, it } from 'vitest';
import { relatieveDag } from './datum';

// Vaste peilmomenten (TZ staat op Europe/Amsterdam, zie vitest.config.ts).
const NU = new Date('2026-08-03T14:00:00+02:00');

describe('relatieveDag — zinsdeel voor "Je aanvraag van {…} staat klaar"', () => {
  it('vandaag, ook een paar minuten geleden', () => {
    expect(relatieveDag('2026-08-03T13:55:00+02:00', NU)).toBe('vandaag');
    expect(relatieveDag('2026-08-03T00:10:00+02:00', NU)).toBe('vandaag');
  });

  it('telt kalenderdagen, geen 24-uursblokken', () => {
    // 16 uur geleden, maar wel de vorige kalenderdag.
    expect(relatieveDag('2026-08-02T22:00:00+02:00', NU)).toBe('gisteren');
  });

  it('twee tot zes dagen in dagen', () => {
    expect(relatieveDag('2026-08-01T09:00:00+02:00', NU)).toBe('2 dagen geleden');
    expect(relatieveDag('2026-07-29T09:00:00+02:00', NU)).toBe('5 dagen geleden');
  });

  it('vanaf een week de datum, zonder jaar binnen hetzelfde jaar', () => {
    expect(relatieveDag('2026-07-27T09:00:00+02:00', NU)).toBe('27 juli');
    expect(relatieveDag('2026-01-05T09:00:00+01:00', NU)).toBe('5 januari');
  });

  it('een ander jaar krijgt het jaartal erbij', () => {
    expect(relatieveDag('2025-12-24T09:00:00+01:00', NU)).toBe('24 december 2025');
  });

  it('een tijdstempel in de toekomst (klokverschil) leest als vandaag', () => {
    expect(relatieveDag('2026-08-03T23:30:00+02:00', NU)).toBe('vandaag');
  });

  it('een onleesbare datum geeft een lege string', () => {
    expect(relatieveDag('geen datum', NU)).toBe('');
  });
});
