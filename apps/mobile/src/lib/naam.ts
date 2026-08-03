/**
 * Nette weergave van een klantnaam (feedback § 5, aanname F6).
 *
 * Google levert de naam soms in kleine letters ("jeffrey bouva") en typen mensen zelf
 * ook niet altijd netjes. We poetsen daarom op twéé plekken: bij het schrijven (de naam
 * die met signUp meegaat) én bij het tonen. Bestaande rijen in de database laten we met
 * rust — die worden niet retroactief gecorrigeerd, de weergave dekt ze af.
 *
 * Alleen de eerste letter van elk naamdeel gaat omhoog; de rest blijft zoals hij is.
 * Zo overleven namen die al goed staan ("McDonald", "de Wit") deze functie ongewijzigd.
 */

/**
 * Nederlandse tussenvoegsels: klein, behalve als het naamdeel vooropstaat
 * ("iris de wit" → "Iris de Wit", maar "de vries" → "De Vries").
 */
const TUSSENVOEGSELS = new Set([
  'van', 'de', 'den', 'der', 'het', 'ter', 'te', 'ten', "'t", "'s",
]);

/** Eerste letter omhoog, met de Nederlandse IJ als geheel ("ijsbrand" → "IJsbrand"). */
function eersteOmhoog(deel: string): string {
  if (!deel) return deel;
  if (/^ij/i.test(deel)) return `IJ${deel.slice(2)}`;
  return deel.charAt(0).toUpperCase() + deel.slice(1);
}

/**
 * Eén naamdeel (zonder spaties): hoofdletter vooraan, en ook ná een apostrof die op één
 * letter volgt ("d'angelo" → "D'Angelo", "o'brien" → "O'Brien"). Een apostrof vooraan
 * hoort bij "'t"/"'s" en blijft dus onaangeroerd.
 */
function kapitaliseerDeel(deel: string): string {
  const omhoog = eersteOmhoog(deel);
  return omhoog.replace(
    /^(\p{L})(['’])(\p{L})/u,
    (_, letter: string, apostrof: string, na: string) => letter + apostrof + na.toUpperCase(),
  );
}

/** Koppelteken-namen krijgen aan beide kanten een hoofdletter ("anne-marie" → "Anne-Marie"). */
function kapitaliseer(woord: string): string {
  return woord.split('-').map(kapitaliseerDeel).join('-');
}

/**
 * Maakt van een ruwe naam een nette: witruimte weg, dubbele spaties samen, elk woord met
 * een hoofdletter, tussenvoegsels klein. Een lege (of alleen-witruimte) invoer blijft leeg,
 * zodat de aanroeper zelf kan beslissen wat er dan getoond wordt.
 */
export function netteNaam(ruw: string): string {
  return ruw
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((woord, i) => {
      const laag = woord.toLowerCase();
      return i > 0 && TUSSENVOEGSELS.has(laag) ? laag : kapitaliseer(woord);
    })
    .join(' ');
}

/** De voornaam uit een ruwe naam, netjes geschreven. Leeg als er geen naam is. */
export function netteVoornaam(ruw: string | null | undefined): string {
  return netteNaam(ruw ?? '').split(' ')[0] ?? '';
}
