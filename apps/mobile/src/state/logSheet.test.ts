import { describe, expect, it } from 'vitest';
import { legeDraft, pas, heeftIets } from './logSheet';

describe('logSheet-draft', () => {
  it('start op 1/1/1/0 met moment Avondeten', () => {
    const d = legeDraft();
    expect(d.porties).toEqual({ eiwit: 1, groente: 1, koolhydraten: 1, vet: 0 });
    expect(d.moment).toBe('Avondeten');
  });
  it('past een handmaat aan en klemt op 0', () => {
    expect(pas(legeDraft(), 'vet', -1).porties.vet).toBe(0);
    expect(pas(legeDraft(), 'eiwit', 1).porties.eiwit).toBe(2);
  });
  it('heeftIets is false bij alles 0', () => {
    expect(heeftIets({ moment: 'Lunch', porties: { eiwit: 0, groente: 0, koolhydraten: 0, vet: 0 } })).toBe(false);
  });
});
