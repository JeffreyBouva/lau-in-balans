/**
 * Contextuele chat-suggesties (regel-gebaseerd). Ze bewegen mee met het dagdeel en met
 * of je vandaag al gelogd hebt. Dit is tier 1; de AI-laag (vervolgsuggesties op basis van
 * wat je net zei) komt hier later overheen — dan vervangt/verrijkt die deze lijst.
 */
export function chatSuggesties(nu: Date, ctx: { gelogdVandaag: boolean }): string[] {
  const uur = nu.getHours();
  let basis: string[];
  if (uur < 10) basis = ['Wat zal ik ontbijten?', 'Ik heb weinig tijd vanochtend', 'Ik heb nog geen trek'];
  else if (uur < 14) basis = ['Wat eet ik als lunch?', 'Ik heb trek', 'Het is een drukke dag'];
  else if (uur < 17) basis = ['Ik heb een dip', 'Een goed tussendoortje?', 'Ik heb zin in iets zoets'];
  else if (uur < 22) basis = ['Wat eet ik vanavond?', 'Hoe ga ik om met een etentje?', 'Weinig zin om te koken'];
  else basis = ['Ik heb nog trek', 'Ik ben moe vandaag', 'Ik heb slecht geslapen'];

  // Heb je vandaag al gelogd, dan een reflectieve erbij (de weekdata is er dan ook).
  return ctx.gelogdVandaag ? [...basis, 'Hoe doe ik het deze week?'] : basis;
}
