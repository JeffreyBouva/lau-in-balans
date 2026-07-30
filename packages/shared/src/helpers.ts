import type { Porties } from './types';
import { LEGE_PORTIES } from './handmaten';

const MS_PER_DAG = 86_400_000;

/** Week N sinds startdatum (1-based). Datums als ISO-strings (YYYY-MM-DD), tijdzone-vrij. */
export function weekNummer(startdatum: string, vandaag: string): number {
  const start = Date.parse(`${startdatum}T00:00:00Z`);
  const nu = Date.parse(`${vandaag}T00:00:00Z`);
  const dagen = Math.floor((nu - start) / MS_PER_DAG);
  return Math.max(1, Math.floor(dagen / 7) + 1);
}

export function telPortiesOp(a: Porties, b: Porties): Porties {
  return {
    eiwit: a.eiwit + b.eiwit,
    groente: a.groente + b.groente,
    koolhydraten: a.koolhydraten + b.koolhydraten,
    vet: a.vet + b.vet,
  };
}

export function dagTotaal(logs: ReadonlyArray<{ porties: Porties }>): Porties {
  return logs.reduce<Porties>((som, log) => telPortiesOp(som, log.porties), LEGE_PORTIES);
}
