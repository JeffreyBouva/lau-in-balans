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
  it('leeg → geen lege entries: weekvorm/afkeer/extra voegen niets toe', () => {
    const p = naarProfiel(legeOnboarding());
    expect(p.knelpunten).toEqual([]);
    expect(p.voorkeuren).toEqual([]);
    expect(p.beperkingen).toEqual([]);
  });
  it('behoudt weekvorm, afkeer en extra (voorheen weggegooid)', () => {
    const ob = {
      ...legeOnboarding(),
      voorkeuren: ['Vegetarisch'],
      beperkingen: ['Noten-allergie'],
      weekvorm: ['Druk gezin', 'Werk 3 dagen'],
      afkeer: 'vis, kwark',
      extra: 'Metformine, 2x per dag',
    };
    const p = naarProfiel(ob);
    // weekvorm → knelpunten (weekcontext)
    expect(p.knelpunten).toEqual(['Druk gezin', 'Werk 3 dagen']);
    // afkeer → voorkeuren, met "Liever niet:"-prefix
    expect(p.voorkeuren).toEqual(['Vegetarisch', 'Liever niet: vis, kwark']);
    // extra → beperkingen (veiligheidsrelevant: staat onder allergie/medicatie)
    expect(p.beperkingen).toEqual(['Noten-allergie', 'Metformine, 2x per dag']);
  });
});
