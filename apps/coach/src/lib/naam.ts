/**
 * Avatar-initialen zoals de handoff ze tekent: "Sanne Vermeer" → SV,
 * "Noor El Amrani" → NA (eerste + láátste naamdeel, niet de tussenvoegsels),
 * en een enkele naam als twee letters — "Laura" → La, de coach-avatar in de chrome.
 *
 * Geeft nooit een lege string terug voor een gevulde naam: een avatar zonder
 * letters leest als een laadfout.
 */
export function initialen(naam: string): string {
  const delen = naam.trim().split(/\s+/).filter(Boolean);
  if (delen.length === 0) return '?';
  if (delen.length === 1) {
    const woord = delen[0];
    return woord.slice(0, 2).charAt(0).toUpperCase() + woord.slice(1, 2).toLowerCase();
  }
  const eerste = delen[0].charAt(0);
  const laatste = delen[delen.length - 1].charAt(0);
  return `${eerste}${laatste}`.toUpperCase();
}

/** Voornaam voor lijstregels en aanspreekvormen ("Sanne Vermeer" → "Sanne"). */
export function voornaam(naam: string): string {
  return naam.trim().split(/\s+/)[0] ?? naam;
}
