/**
 * Design-tokens uit design_handoff_lau_in_balans/README.md.
 * Kleurregel: sage (groen) = klant & voortgang. Clay (terracotta) = uitsluitend
 * coach-aandacht (flags) + de identiteit van Laura-als-mens; nooit decoratie
 * in de klant-app (uitzonderingen: handmaat vetten, Laura-avatar/bubbel).
 */
export const colors = {
  // achtergronden
  bgApp: '#F6F3ED',
  bgSurface: '#FFFFFF',
  bgSurfaceSunken: '#FBF9F5',
  bgNeutralSoft: '#EFEBE2',
  bgNeutralSofter: '#F1EEE7',
  // lijnen
  hairline: '#DCD6CA',
  hairlineHover: '#C7BEAE', // hover op secundaire rand; ook neutrale/nog-niet-begonnen markers
  hairlineSoft: '#E5E0D6',
  hairlineSofter: '#E9E4DA',
  tableRow: '#F1EEE7',
  tableHead: '#EDE8DE',
  dashed: '#D3CCBE',
  // tekst
  ink: '#262A24',
  body: '#5E6259',
  bodySoft: '#6E7168',
  muted: '#8C8F84',
  mutedSoft: '#9A9C91',
  mutedSofter: '#A3A59A',
  // sage (primair accent, klantkant)
  sage: '#63805F',
  sageHover: '#55714F',
  sageDeep: '#4C6749',
  sageDeeper: '#3D5539',
  sageSoft: '#E7EEE3',
  sageSoftBorder: '#CFE0C8',
  sageInk: '#37452F',
  sageMid: '#6D8A68',
  sageTint: '#FBFDFA',
  // clay (alleen coachkant + flags)
  clay: '#B0603F',
  claySoft: '#F6E7E0',
  clayBorder: '#EDD5C9',
  clayInk: '#93472B',
  // Laura-als-mens
  lauraBubbleBg: '#FBEFE8',
  lauraBubbleInk: '#6E4331',
  lauraAvatarBg: '#EFEBE2',
  lauraAvatarInk: '#8C6A56',
  lauraAvatarInkHover: '#765645',
  // handmaten
  foodEiwit: '#63805F',
  foodGroente: '#7E9C6E',
  foodKoolhydraten: '#C1A277',
  foodVet: '#B0603F',
  // overlay
  scrim: 'rgba(38, 42, 36, 0.3)',
} as const;

export const radii = {
  marker: 4,
  bubbleTip: 6,
  controlSm: 12,
  input: 14,
  card: 18,
  cardLg: 20,
  cardXl: 24,
  sheetTop: 30,
  pill: 999,
} as const;

export const fonts = {
  serif: 'Newsreader',
  sans: 'DM Sans',
} as const;
