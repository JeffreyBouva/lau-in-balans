import type { Porties } from './types.ts';
import { LEGE_PORTIES } from './handmaten.ts';

const MS_PER_DAG = 86_400_000;

/** Week N sinds startdatum (1-based). Datums als ISO-strings (YYYY-MM-DD), tijdzone-vrij. */
export function weekNummer(startdatum: string, vandaag: string): number {
  const start = Date.parse(`${startdatum}T00:00:00Z`);
  const nu = Date.parse(`${vandaag}T00:00:00Z`);
  const dagen = Math.floor((nu - start) / MS_PER_DAG);
  if (!Number.isFinite(dagen)) {
    throw new Error(`weekNummer: verwacht YYYY-MM-DD, kreeg "${startdatum}" / "${vandaag}"`);
  }
  return Math.max(1, Math.floor(dagen / 7) + 1);
}

/** Lokale kalenderdag als YYYY-MM-DD — géén toISOString().slice: die geeft de UTC-dag. */
export function naarISODatum(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const vandaagISO = (): string => naarISODatum(new Date());

export function telPortiesOp(a: Porties, b: Porties): Porties {
  return {
    eiwit: a.eiwit + b.eiwit,
    groente: a.groente + b.groente,
    koolhydraten: a.koolhydraten + b.koolhydraten,
    vet: a.vet + b.vet,
  };
}

export function dagTotaal(logs: ReadonlyArray<{ porties: Porties }>): Porties {
  // Spread: met een lege logs-array geeft reduce de seed zélf terug — zonder copy
  // zou de caller de gedeelde LEGE_PORTIES-constante kunnen muteren.
  return logs.reduce<Porties>((som, log) => telPortiesOp(som, log.porties), { ...LEGE_PORTIES });
}
