import { describe, expect, it } from 'vitest';
import { netteNaam, netteVoornaam } from './naam';

describe('netteNaam', () => {
  it('zet elk woord met een hoofdletter', () => {
    expect(netteNaam('jeffrey bouva')).toBe('Jeffrey Bouva');
  });

  it('houdt tussenvoegsels klein', () => {
    expect(netteNaam('iris de wit')).toBe('Iris de Wit');
    expect(netteNaam('sanne van der berg')).toBe('Sanne van der Berg');
    expect(netteNaam('mark ter horst')).toBe('Mark ter Horst');
  });

  it('geeft een tussenvoegsel vooraan wél een hoofdletter', () => {
    expect(netteNaam('de vries')).toBe('De Vries');
    expect(netteNaam('van dijk')).toBe('Van Dijk');
  });

  it('doet koppeltekens aan beide kanten', () => {
    expect(netteNaam('anne-marie')).toBe('Anne-Marie');
    expect(netteNaam('jan-willem de groot')).toBe('Jan-Willem de Groot');
  });

  it('doet apostrof-namen', () => {
    expect(netteNaam("d'angelo")).toBe("D'Angelo");
    expect(netteNaam("sean o'brien")).toBe("Sean O'Brien");
  });

  it('haalt witruimte en dubbele spaties weg', () => {
    expect(netteNaam('  dubbele   spaties ')).toBe('Dubbele Spaties');
  });

  it('laat namen die al goed staan met rust', () => {
    expect(netteNaam('Jeffrey Bouva')).toBe('Jeffrey Bouva');
    expect(netteNaam('Iris de Wit')).toBe('Iris de Wit');
    expect(netteNaam('Anne-Marie McDonald')).toBe('Anne-Marie McDonald');
    expect(netteNaam("D'Angelo")).toBe("D'Angelo");
  });

  it('lege string blijft leeg', () => {
    expect(netteNaam('')).toBe('');
    expect(netteNaam('   ')).toBe('');
  });

  it('schrijft de Nederlandse IJ als geheel', () => {
    expect(netteNaam('ijsbrand de jong')).toBe('IJsbrand de Jong');
  });

  it('corrigeert een tussenvoegsel dat in hoofdletters staat', () => {
    expect(netteNaam('iris DE wit')).toBe('Iris de Wit');
  });
});

describe('netteVoornaam', () => {
  it('geeft de eerste naam, netjes geschreven', () => {
    expect(netteVoornaam('jeffrey bouva')).toBe('Jeffrey');
  });

  it('geeft een lege string bij niets', () => {
    expect(netteVoornaam(null)).toBe('');
    expect(netteVoornaam(undefined)).toBe('');
    expect(netteVoornaam('  ')).toBe('');
  });
});
