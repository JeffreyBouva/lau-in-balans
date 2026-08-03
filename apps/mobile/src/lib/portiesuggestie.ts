import { HANDMATEN, type HandKey, type Porties } from '@lau/shared';

/**
 * Voorstel voor de dagdoelen in handmaten (Precision Nutrition).
 *
 * Waarom we NIET naar gewicht vragen: de maat ís de hand van de klant. Een groter
 * lichaam heeft een grotere handpalm, dus "1 handpalm eiwit" is bij een grotere
 * persoon automatisch meer eten. De portie schaalt dus vanzelf mee. Wat per persoon
 * wél verschilt is het AANTAL porties per dag — en dat is precies wat deze functie
 * schat. Gewicht en calorieën komen hier nergens in voor (zie ook de guardrail
 * "niet openen met gewicht of getallen" in supabase/functions/_shared/guardrails.ts).
 */
export type Bouw = 'vrouw' | 'man' | 'zeg-ik-liever-niet';
export type Activiteit = 'rustig' | 'gemiddeld' | 'actief';

/** Een dagdoel van 0 is geen doel — de ondergrens is dus 1. 12 is hetzelfde plafond
 *  als het profielscherm, de RPC en het coach-dashboard. */
export const PORTIEDOEL_MIN = 1;
export const PORTIEDOEL_MAX = 12;

/** Klemt een dagdoel op 1..12 en maakt er altijd een heel getal van. */
export function klemPortiedoel(n: number): number {
  // NaN overleeft Math.min/max, en een NaN-doel zou als leeg vakje op het
  // Eten-scherm landen. Alles wat geen getal is, valt terug op het minimum.
  if (Number.isNaN(n)) return PORTIEDOEL_MIN;
  return Math.min(PORTIEDOEL_MAX, Math.max(PORTIEDOEL_MIN, Math.round(n)));
}

/**
 * Basisporties per maaltijd, de standaard uit de handmaten-methode:
 * vrouw 1 handpalm / 1 vuist / 1 holle hand / 1 duim, man het dubbele.
 * "Zeg ik liever niet" zit er precies tussenin (1,5) — die halve portie ronden we
 * pas ná het vermenigvuldigen af, zodat het antwoord echt in het midden landt en
 * niet stiekem naar één van de twee toe kruipt. Zie AFRONDING.
 */
const BASIS_PER_MAALTIJD: Record<Bouw, Porties> = {
  vrouw: { eiwit: 1, groente: 1, koolhydraten: 1, vet: 1 },
  man: { eiwit: 2, groente: 2, koolhydraten: 2, vet: 2 },
  'zeg-ik-liever-niet': { eiwit: 1.5, groente: 1.5, koolhydraten: 1.5, vet: 1.5 },
};

/**
 * Halve porties: eiwit en groente naar boven, koolhydraten en vet naar beneden.
 * Dat is de veilige kant van de methode — eiwit en groente verzadigen en zijn de
 * twee waar bijna niemand te veel van binnenkrijgt.
 */
const AFRONDING: Record<HandKey, (n: number) => number> = {
  eiwit: Math.ceil,
  groente: Math.ceil,
  koolhydraten: Math.floor,
  vet: Math.floor,
};

/**
 * Activiteit corrigeert alléén de brandstof: koolhydraten omlaag bij rustige dagen,
 * koolhydraten én eiwit omhoog bij veel beweging. Groente en vet blijven gelijk —
 * die hangen niet aan hoeveel je die dag beweegt.
 */
const CORRECTIE: Record<Activiteit, Partial<Record<HandKey, number>>> = {
  rustig: { koolhydraten: -1 },
  gemiddeld: {},
  actief: { eiwit: +1, koolhydraten: +1 },
};

/** Voorgestelde dagdoelen: basis per maaltijd × aantal maaltijden, dan de
 *  activiteitscorrectie, dan klemmen op 1..12. */
export function suggereerPortiedoelen(input: {
  bouw: Bouw;
  maaltijden: number;
  activiteit: Activiteit;
}): Porties {
  const basis = BASIS_PER_MAALTIJD[input.bouw];
  const correctie = CORRECTIE[input.activiteit];
  const uit = {} as Porties;
  for (const h of HANDMATEN) {
    const perDag = AFRONDING[h.key](basis[h.key] * input.maaltijden);
    uit[h.key] = klemPortiedoel(perDag + (correctie[h.key] ?? 0));
  }
  return uit;
}
