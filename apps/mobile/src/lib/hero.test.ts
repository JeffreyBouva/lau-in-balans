import { describe, expect, it } from 'vitest';
import { heroZin, type HeroInvoer } from './hero';

/** Een "gewone" coached klant halverwege het traject: valt zonder aanpassing op het vangnet. */
const BASIS: HeroInvoer = {
  voornaam: 'Jeffrey',
  weekNr: 4,
  dagenGelogd: 1,
  contactDagen: 3,
  gelogdVandaag: false,
  tier: 'coached',
};

const zin = (patch: Partial<HeroInvoer> = {}) => heroZin({ ...BASIS, ...patch });

describe('heroZin — per situatie een eigen zin', () => {
  it('free: geen traject-taal, iets dat bij alleen loggen past', () => {
    expect(zin({ tier: 'free' })).toBe('Je doet het op je eigen tempo, Jeffrey.');
  });

  it('eerste week: verwelkomend', () => {
    expect(zin({ weekNr: 1 })).toBe('Fijn dat je er bent, Jeffrey. We beginnen rustig.');
    expect(zin({ weekNr: 0 })).toBe('Fijn dat je er bent, Jeffrey. We beginnen rustig.');
  });

  it('vandaag al gelogd: bevestigend', () => {
    expect(zin({ gelogdVandaag: true })).toBe('Vandaag staat al genoteerd, Jeffrey.');
  });

  it('stil geweest: geen contact en bijna niets gelogd', () => {
    expect(zin({ contactDagen: 0, dagenGelogd: 0 })).toBe('Het was even stil, Jeffrey. Fijn dat je er weer bent.');
    expect(zin({ contactDagen: 0, dagenGelogd: 1 })).toBe('Het was even stil, Jeffrey. Fijn dat je er weer bent.');
  });

  it('niets gelogd deze week, maar wél contact: uitnodigend, geen verwijt', () => {
    expect(zin({ dagenGelogd: 0, contactDagen: 2 })).toBe('Begin gerust klein, Jeffrey. Eén maaltijd is al genoeg.');
  });

  it('sterke week: over ritme en regelmaat', () => {
    expect(zin({ dagenGelogd: 5 })).toBe('Dit begint een gewoonte te worden, Jeffrey.');
    expect(zin({ dagenGelogd: 7 })).toBe('Dit begint een gewoonte te worden, Jeffrey.');
  });

  it('wisselende week: normaliserend', () => {
    expect(zin({ dagenGelogd: 2 })).toBe('Een week hoeft niet perfect, Jeffrey. Deze telt gewoon mee.');
    expect(zin({ dagenGelogd: 4 })).toBe('Een week hoeft niet perfect, Jeffrey. Deze telt gewoon mee.');
  });

  it('vangnet: één dag gelogd, wél contact, niet vandaag', () => {
    expect(zin()).toBe('Je vindt je ritme, Jeffrey.');
  });
});

describe('heroZin — volgorde van de checks', () => {
  it('free gaat vóór alles: geen week-taal, geen contact-taal', () => {
    expect(zin({ tier: 'free', weekNr: 1, dagenGelogd: 0, contactDagen: 0 }))
      .toBe('Je doet het op je eigen tempo, Jeffrey.');
    expect(zin({ tier: 'free', dagenGelogd: 7, gelogdVandaag: true }))
      .toBe('Je doet het op je eigen tempo, Jeffrey.');
  });

  it('eerste week wint van een lege of juist volle week', () => {
    expect(zin({ weekNr: 1, dagenGelogd: 0, contactDagen: 0 }))
      .toBe('Fijn dat je er bent, Jeffrey. We beginnen rustig.');
    expect(zin({ weekNr: 1, dagenGelogd: 6, gelogdVandaag: true }))
      .toBe('Fijn dat je er bent, Jeffrey. We beginnen rustig.');
  });

  it('vandaag gelogd wint van elke weekstand', () => {
    expect(zin({ gelogdVandaag: true, dagenGelogd: 7 })).toBe('Vandaag staat al genoteerd, Jeffrey.');
    expect(zin({ gelogdVandaag: true, dagenGelogd: 1, contactDagen: 0 }))
      .toBe('Vandaag staat al genoteerd, Jeffrey.');
  });

  it('stil geweest wint van "niets gelogd"', () => {
    expect(zin({ dagenGelogd: 0, contactDagen: 0 })).toBe('Het was even stil, Jeffrey. Fijn dat je er weer bent.');
  });

  it('zonder weeknummer (klantrij nog niet binnen) blijft de weekstand leidend', () => {
    expect(zin({ weekNr: null, dagenGelogd: 5 })).toBe('Dit begint een gewoonte te worden, Jeffrey.');
    expect(zin({ weekNr: null })).toBe('Je vindt je ritme, Jeffrey.');
  });

  it('tier null (oordeel laadt nog) leest niet als free', () => {
    expect(zin({ tier: null, dagenGelogd: 5 })).toBe('Dit begint een gewoonte te worden, Jeffrey.');
  });
});

describe('heroZin — zonder voornaam', () => {
  const leeg = (patch: Partial<HeroInvoer> = {}) => zin({ voornaam: '', ...patch });

  it('elke tak loopt ook zonder naam', () => {
    expect(leeg({ tier: 'free' })).toBe('Je doet het op je eigen tempo.');
    expect(leeg({ weekNr: 1 })).toBe('Fijn dat je er bent. We beginnen rustig.');
    expect(leeg({ gelogdVandaag: true })).toBe('Vandaag staat al genoteerd.');
    expect(leeg({ contactDagen: 0 })).toBe('Het was even stil. Fijn dat je er weer bent.');
    expect(leeg({ dagenGelogd: 0, contactDagen: 2 })).toBe('Begin gerust klein. Eén maaltijd is al genoeg.');
    expect(leeg({ dagenGelogd: 5 })).toBe('Dit begint een gewoonte te worden.');
    expect(leeg({ dagenGelogd: 3 })).toBe('Een week hoeft niet perfect. Deze telt gewoon mee.');
    expect(leeg()).toBe('Je vindt je ritme.');
  });

  it('een naam van alleen witruimte telt als geen naam', () => {
    expect(zin({ voornaam: '   ' })).toBe('Je vindt je ritme.');
  });
});

describe('heroZin — guardrails', () => {
  const ALLE_STANDEN: Partial<HeroInvoer>[] = [
    { tier: 'free' },
    { weekNr: 1 },
    { gelogdVandaag: true },
    { contactDagen: 0, dagenGelogd: 0 },
    { dagenGelogd: 0, contactDagen: 2 },
    { dagenGelogd: 5 },
    { dagenGelogd: 3 },
    {},
  ];

  it('noemt nergens gewicht of kilo’s', () => {
    for (const stand of ALLE_STANDEN) {
      expect(zin(stand).toLowerCase()).not.toMatch(/gewicht|kilo|afval|dikker|dunner|weegschaal/);
    }
  });

  it('zet nergens een getal in de zin', () => {
    for (const stand of ALLE_STANDEN) {
      expect(zin(stand)).not.toMatch(/\d/);
    }
  });

  it('blijft kort genoeg voor de hero-regel', () => {
    for (const stand of ALLE_STANDEN) {
      expect(zin(stand).length).toBeLessThanOrEqual(70);
    }
  });
});
