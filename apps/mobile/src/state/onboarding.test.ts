import { describe, expect, it } from 'vitest';
import { legeOnboarding, naarProfiel } from './onboarding';
import { PORTIE_DOEL_DEFAULT } from '@lau/shared';

describe('naarProfiel', () => {
  it('mapt onboarding-antwoorden naar een AIProfile met defaults', () => {
    const ob = { ...legeOnboarding(), doelen: ['Duurzaam afvallen'], voorkeuren: ['Vegetarisch'], beperkingen: ['Noten-allergie'], veiligheid: 'soms' as const };
    const p = naarProfiel(ob);
    expect(p.doelen).toEqual(['Duurzaam afvallen']);
    expect(p.voorkeuren).toEqual(['Vegetarisch']);
    expect(p.beperkingen).toEqual(['Noten-allergie']);
    expect(p.veiligheidsvlag).toBe('soms');
    expect(p.portiedoelen).toEqual(PORTIE_DOEL_DEFAULT);
    expect(p.knelpunten).toEqual([]);
    expect(typeof p.aanpak).toBe('string');
  });
  it('default-veiligheidsvlag is "overgeslagen" als niets gekozen', () => {
    expect(naarProfiel(legeOnboarding()).veiligheidsvlag).toBe('overgeslagen');
  });
});
