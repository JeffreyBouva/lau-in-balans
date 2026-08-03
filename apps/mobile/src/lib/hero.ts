/**
 * De hero-regel op Vandaag (feedback § 4).
 *
 * Die stond vast op "Je vindt je ritme" — een mooie zin, maar hij klopte alleen bij
 * toeval. Nu kiest deze functie één vaste zin per situatie, op de echte stand van het
 * traject: hoe lang je meedoet, hoeveel dagen je deze week hebt gelogd, of er contact
 * was, en of je vandaag al iets hebt bijgehouden.
 *
 * Regels voor de teksten (guardrails uit de spec):
 * - nooit over gewicht, nooit een getal als oordeel ("3 van 7" leest als een cijfer);
 * - nooit een verwijt — een lege week is een uitnodiging, geen tekortkoming;
 * - free heeft geen traject, dus geen traject-taal (geen week, geen coach, geen contact);
 * - de voornaam mag ontbreken; elke zin loopt dan gewoon door.
 *
 * De volgorde van de checks is de kern: van de meest specifieke situatie naar de meest
 * algemene. De laatste regel is het vangnet — de oude zin, nu alleen nog als er niets
 * bijzonders te melden valt.
 */

export type HeroInvoer = {
  /** Netjes geschreven voornaam, of '' als die er niet is. */
  voornaam: string;
  /** Week in het traject (1-gebaseerd), of null zolang de klantrij nog niet binnen is. */
  weekNr: number | null;
  /** Dagen met een voedingslog, van de afgelopen 7. */
  dagenGelogd: number;
  /** Dagen met een bericht, van de afgelopen 7. */
  contactDagen: number;
  /** Of er vandaag al iets is gelogd. */
  gelogdVandaag: boolean;
  /** null zolang het tier-oordeel laadt; dan lezen we 'm als "nog geen free". */
  tier: 'free' | 'coached' | null;
};

/** ", Jeffrey" of "" — zo loopt elke zin ook zonder naam. */
function aanspreek(voornaam: string): string {
  const naam = voornaam.trim();
  return naam ? `, ${naam}` : '';
}

export function heroZin(input: HeroInvoer): string {
  const { voornaam, weekNr, dagenGelogd, contactDagen, gelogdVandaag, tier } = input;
  const jij = aanspreek(voornaam);

  // 1. Free: geen traject, geen coach, geen "week N". Wat er wél is, is loggen — en dat
  //    gaat hier op eigen tempo, zonder dat iemand meekijkt.
  if (tier === 'free') return `Je doet het op je eigen tempo${jij}.`;

  // 2. Eerste week: nog niets om over te rapporteren. Dit is de enige plek waar de zin
  //    over beginnen gaat — daarna gaat het over wat je doet.
  if (weekNr != null && weekNr <= 1) return `Fijn dat je er bent${jij}. We beginnen rustig.`;

  // 3. Vandaag al gelogd: het meest concrete dat we weten. Bevestigen, niet optellen.
  if (gelogdVandaag) return `Vandaag staat al genoteerd${jij}.`;

  // 4. Stil geweest: geen contact én bijna niets gelogd. Zacht heruitnodigen, en de
  //    stilte benoemen zonder er iets van te vinden.
  if (contactDagen === 0 && dagenGelogd <= 1) return `Het was even stil${jij}. Fijn dat je er weer bent.`;

  // 5. Nog niets gelogd deze week (er wás wel contact): de drempel zo laag mogelijk leggen.
  if (dagenGelogd === 0) return `Begin gerust klein${jij}. Eén maaltijd is al genoeg.`;

  // 6. Sterke week: vijf dagen of meer. "Gewoonte" gaat een stap verder dan het vangnet
  //    ("je vindt je ritme") — het is de zin die je verdient als het echt loopt.
  if (dagenGelogd >= 5) return `Dit begint een gewoonte te worden${jij}.`;

  // 7. Wisselende week (2 t/m 4 dagen): normaliseren. Dit is de meest voorkomende week
  //    en precies de week waarin mensen afhaken.
  if (dagenGelogd >= 2) return `Een week hoeft niet perfect${jij}. Deze telt gewoon mee.`;

  // 8. Vangnet: één dag gelogd, wél contact gehad, niet vandaag. Niets bijzonders — dan
  //    is de oude zin nog steeds de beste die we hebben.
  return `Je vindt je ritme${jij}.`;
}
