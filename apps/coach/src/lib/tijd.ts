/**
 * Relatieve tijd in het NL, kort genoeg voor één lijstregel:
 * "zojuist" · "12 min" · "3 uur" · "gisteren" · anders de datum ("12 mrt").
 *
 * `nu` is injecteerbaar zodat een lijst één peilmoment kan delen (en om te testen).
 */
export function relatieveTijd(iso: string, nu: Date = new Date()): string {
  const toen = new Date(iso);
  const ms = nu.getTime() - toen.getTime();
  if (Number.isNaN(ms)) return '';
  // Ook een tijdstempel in de toekomst (klokverschil client/server) valt hieronder.
  if (ms < 60_000) return 'zojuist';
  const minuten = Math.floor(ms / 60_000);
  if (minuten < 60) return `${minuten} min`;
  // Dagen tellen op kalenderdagen, niet op 24-uursblokken: 23:00 → 07:00 leest
  // als "gisteren", niet als "8 uur".
  const dagen = kalenderdagen(toen, nu);
  if (dagen <= 0) return `${Math.floor(minuten / 60)} uur`;
  if (dagen === 1) return 'gisteren';
  return korteDatum(toen, nu);
}

/** Hele kalenderdagen tussen twee momenten, lokale tijd. */
function kalenderdagen(van: Date, tot: Date): number {
  const a = new Date(van.getFullYear(), van.getMonth(), van.getDate()).getTime();
  const b = new Date(tot.getFullYear(), tot.getMonth(), tot.getDate()).getTime();
  // Afronden i.p.v. floor: een zomertijdsprong maakt een "dag" 23 of 25 uur lang.
  return Math.round((b - a) / 86_400_000);
}

function korteDatum(d: Date, nu: Date): string {
  return d.toLocaleDateString('nl-NL', {
    day: 'numeric',
    month: 'short',
    // Jaar alleen als het afwijkt — anders ruis op een lijstregel.
    ...(d.getFullYear() === nu.getFullYear() ? {} : { year: 'numeric' }),
  });
}
