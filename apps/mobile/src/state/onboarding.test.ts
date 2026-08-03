import { describe, expect, it } from 'vitest';
import { legeOnboarding, metDoelStap, metKeuze, naarProfiel } from './onboarding';
import { suggereerPortiedoelen } from '../lib/portiesuggestie';

describe('naarProfiel', () => {
  it('mapt onboarding-antwoorden naar een AIProfile met defaults', () => {
    const ob = { ...legeOnboarding(), doelen: ['Duurzaam afvallen'], voorkeuren: ['Vegetarisch'], beperkingen: ['Noten-allergie'], veiligheid: 'soms' as const };
    const p = naarProfiel(ob);
    expect(p.doelen).toEqual(['Duurzaam afvallen']);
    expect(p.voorkeuren).toContain('Vegetarisch');
    expect(p.beperkingen).toEqual(['Noten-allergie']);
    expect(p.veiligheidsvlag).toBe('soms');
    expect(p.knelpunten).toEqual([]);
    expect(typeof p.aanpak).toBe('string');
  });
  it('default-veiligheidsvlag is "overgeslagen" als niets gekozen', () => {
    expect(naarProfiel(legeOnboarding()).veiligheidsvlag).toBe('overgeslagen');
  });
  it('leeg → geen lege entries: weekvorm/afkeer/extra voegen niets toe', () => {
    const p = naarProfiel(legeOnboarding());
    expect(p.knelpunten).toEqual([]);
    expect(p.beperkingen).toEqual([]);
    // voorkeuren bevat alleen de twee ritme-regels, geen lege strings.
    expect(p.voorkeuren).toEqual(['3 maaltijden per dag', 'Gemiddeld actief op een dag']);
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
    // afkeer → voorkeuren, met "Liever niet:"-prefix, vóór de ritme-regels
    expect(p.voorkeuren.slice(0, 2)).toEqual(['Vegetarisch', 'Liever niet: vis, kwark']);
    // extra → beperkingen (veiligheidsrelevant: staat onder allergie/medicatie)
    expect(p.beperkingen).toEqual(['Noten-allergie', 'Metformine, 2x per dag']);
  });

  it('neemt de portiedoelen over die de klant zelf gezet heeft', () => {
    const ob = { ...legeOnboarding(), portiedoelen: { eiwit: 5, groente: 7, koolhydraten: 2, vet: 3 } };
    const p = naarProfiel(ob);
    expect(p.portiedoelen).toEqual({ eiwit: 5, groente: 7, koolhydraten: 2, vet: 3 });
    // kopie, geen gedeelde referentie: later bewerken mag de state niet raken.
    expect(p.portiedoelen).not.toBe(ob.portiedoelen);
  });

  it('zet maaltijdritme en activiteit als leesbare regel in voorkeuren, bouw nergens', () => {
    const ob = metKeuze(legeOnboarding(), { bouw: 'vrouw', maaltijden: 4, activiteit: 'rustig' });
    const p = naarProfiel(ob);
    expect(p.voorkeuren).toContain('4 maaltijden per dag');
    expect(p.voorkeuren).toContain('Rustige dagen, weinig beweging');
    // privacy: geslacht/bouw hoort niet in het profiel dat Lau.ai leest.
    const alles = JSON.stringify(p).toLowerCase();
    expect(alles).not.toMatch(/vrouw|\bman\b|geslacht/);
  });
});

describe('legeOnboarding', () => {
  it('start neutraal: geen aanname over bouw, 3 maaltijden, gemiddeld actief', () => {
    const ob = legeOnboarding();
    expect(ob.bouw).toBe('zeg-ik-liever-niet');
    expect(ob.maaltijden).toBe(3);
    expect(ob.activiteit).toBe('gemiddeld');
    expect(ob.aangeraakt).toEqual([]);
  });
  it('heeft meteen een voorstel als portiedoelen (geen lege of vaste waarde)', () => {
    const ob = legeOnboarding();
    expect(ob.portiedoelen).toEqual(suggereerPortiedoelen({ bouw: 'zeg-ik-liever-niet', maaltijden: 3, activiteit: 'gemiddeld' }));
  });
});

describe('metKeuze', () => {
  it('herberekent de portiedoelen bij een nieuwe keuze', () => {
    const ob = metKeuze(legeOnboarding(), { bouw: 'vrouw' });
    expect(ob.portiedoelen).toEqual({ eiwit: 3, groente: 3, koolhydraten: 3, vet: 3 });
    const actiever = metKeuze(ob, { activiteit: 'actief' });
    expect(actiever.portiedoelen).toEqual({ eiwit: 4, groente: 3, koolhydraten: 4, vet: 3 });
    expect(metKeuze(actiever, { maaltijden: 4 }).portiedoelen).toEqual({ eiwit: 5, groente: 4, koolhydraten: 5, vet: 4 });
  });

  it('laat een handmatig gezet doel met rust, de rest beweegt gewoon mee', () => {
    const ob = metDoelStap(metKeuze(legeOnboarding(), { bouw: 'vrouw' }), 'groente', +2); // groente 3 → 5
    const na = metKeuze(ob, { bouw: 'man' });
    expect(na.portiedoelen.groente).toBe(5); // aangeraakt: blijft staan
    expect(na.portiedoelen.eiwit).toBe(6); // niet aangeraakt: volgt het voorstel
    expect(na.portiedoelen.koolhydraten).toBe(6);
    expect(na.portiedoelen.vet).toBe(6);
  });

  it('raakt de andere antwoorden niet aan', () => {
    const ob = { ...legeOnboarding(), doelen: ['Meer energie'], afkeer: 'vis' };
    const na = metKeuze(ob, { maaltijden: 2 });
    expect(na.doelen).toEqual(['Meer energie']);
    expect(na.afkeer).toBe('vis');
  });
});

describe('metDoelStap', () => {
  it('telt op en af en markeert het doel als aangeraakt', () => {
    const ob = metDoelStap(legeOnboarding(), 'eiwit', +1);
    expect(ob.portiedoelen.eiwit).toBe(6); // voorstel 5 + 1
    expect(ob.aangeraakt).toEqual(['eiwit']);
    expect(metDoelStap(ob, 'eiwit', -1).portiedoelen.eiwit).toBe(5);
    expect(metDoelStap(ob, 'eiwit', -1).aangeraakt).toEqual(['eiwit']); // niet dubbel
  });

  it('klemt op 1..12 — een doel van 0 bestaat niet', () => {
    let ob = legeOnboarding();
    for (let i = 0; i < 20; i++) ob = metDoelStap(ob, 'vet', -1);
    expect(ob.portiedoelen.vet).toBe(1);
    for (let i = 0; i < 30; i++) ob = metDoelStap(ob, 'vet', +1);
    expect(ob.portiedoelen.vet).toBe(12);
  });

  it('laat de andere handmaten ongemoeid', () => {
    const start = legeOnboarding();
    const ob = metDoelStap(start, 'koolhydraten', +1);
    expect(ob.portiedoelen.eiwit).toBe(start.portiedoelen.eiwit);
    expect(ob.portiedoelen.groente).toBe(start.portiedoelen.groente);
    expect(ob.portiedoelen.vet).toBe(start.portiedoelen.vet);
  });
});
