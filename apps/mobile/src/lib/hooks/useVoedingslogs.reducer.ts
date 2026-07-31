import type { Porties } from '@lau/shared';
import { dagTotaal } from '@lau/shared';

type Log = { datum: string; porties: Porties };

export function dagStand(logs: Log[], datum: string): Porties {
  return dagTotaal(logs.filter((l) => l.datum === datum));
}
export function weekTotalen(logs: Log[], datums: string[]): { datum: string; porties: Porties }[] {
  return datums.map((datum) => ({ datum, porties: dagStand(logs, datum) }));
}
