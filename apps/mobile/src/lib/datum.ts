import { weekNummer, naarISODatum, vandaagISO } from '@lau/shared';
export { weekNummer, naarISODatum, vandaagISO };
export function weekdagenTerug(n: number): string[] {
  const uit: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    uit.push(naarISODatum(d));
  }
  return uit;
}
