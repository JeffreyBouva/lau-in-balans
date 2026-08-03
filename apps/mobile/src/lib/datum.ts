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

/**
 * Relatieve dag als zinsdeel: "Je aanvraag van {…} staat klaar bij Laura."
 * "vandaag" · "gisteren" · "3 dagen geleden" · daarna de datum ("12 juli").
 *
 * Dagen tellen op kalenderdagen, niet op 24-uursblokken: 23:50 → 00:10 leest als
 * "gisteren", niet als "vandaag". `nu` is injecteerbaar om te testen. Een onleesbare
 * datum geeft een lege string — de caller valt dan terug op een zin zonder datum.
 */
export function relatieveDag(iso: string, nu: Date = new Date()): string {
  const toen = new Date(iso);
  if (Number.isNaN(toen.getTime())) return '';
  // Ook een tijdstempel in de toekomst (klokverschil telefoon/server) valt op "vandaag".
  const dagen = kalenderdagen(toen, nu);
  if (dagen <= 0) return 'vandaag';
  if (dagen === 1) return 'gisteren';
  if (dagen < 7) return `${dagen} dagen geleden`;
  return toen.toLocaleDateString('nl-NL', {
    day: 'numeric',
    month: 'long',
    // Jaar alleen als het afwijkt — anders ruis in een korte zin.
    ...(toen.getFullYear() === nu.getFullYear() ? {} : { year: 'numeric' }),
  });
}

/** Hele kalenderdagen tussen twee momenten, lokale tijd. */
function kalenderdagen(van: Date, tot: Date): number {
  const a = new Date(van.getFullYear(), van.getMonth(), van.getDate()).getTime();
  const b = new Date(tot.getFullYear(), tot.getMonth(), tot.getDate()).getTime();
  // Afronden i.p.v. floor: een zomertijdsprong maakt een "dag" 23 of 25 uur lang.
  return Math.round((b - a) / 86_400_000);
}
