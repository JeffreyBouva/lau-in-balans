import { StyleSheet } from 'react-native';
import { colors, radii, fonts } from '@lau/shared';

export { colors, radii };

// RN heeft de exacte font-namen per gewicht nodig (Google-Fonts-pakketten).
export const fontFamily = {
  serif: 'Newsreader_400Regular',
  serifLight: 'Newsreader_300Light',
  serifMedium: 'Newsreader_500Medium',
  sans: 'DMSans_400Regular',
  sansLight: 'DMSans_300Light',
  sansMedium: 'DMSans_500Medium',
} as const;

// Tekststijlen uit de handoff-typografieschaal (Newsreader = serif, DM Sans = sans).
export const text = StyleSheet.create({
  onboardingHero: { fontFamily: fontFamily.serif, fontSize: 34, lineHeight: 41, letterSpacing: -0.5, color: colors.ink },
  schermTitel: { fontFamily: fontFamily.serif, fontSize: 28, lineHeight: 34, letterSpacing: -0.3, color: colors.ink },
  sheetTitel: { fontFamily: fontFamily.serif, fontSize: 26, lineHeight: 31, letterSpacing: -0.26, color: colors.ink },
  chatNaam: { fontFamily: fontFamily.serif, fontSize: 19, color: colors.ink },
  uitspraak: { fontFamily: fontFamily.serif, fontSize: 21, lineHeight: 29, color: colors.sageInk },
  bodyGroot: { fontFamily: fontFamily.sans, fontSize: 16, lineHeight: 26, color: colors.body },
  body: { fontFamily: fontFamily.sans, fontSize: 15, lineHeight: 23, color: colors.body },
  bodyKlein: { fontFamily: fontFamily.sans, fontSize: 14, lineHeight: 21, color: colors.bodySoft },
  label: { fontFamily: fontFamily.sans, fontSize: 13, lineHeight: 20, color: colors.muted },
  caption: { fontFamily: fontFamily.sans, fontSize: 12, lineHeight: 18, color: colors.muted },
  eyebrow: { fontFamily: fontFamily.sansMedium, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.mutedSofter },
});

export const shadow = {
  telefoon: { shadowColor: '#262A24', shadowOpacity: 0.35, shadowRadius: 30, shadowOffset: { width: 0, height: 24 } },
  tabActief: { shadowColor: '#262A24', shadowOpacity: 0.25, shadowRadius: 5, shadowOffset: { width: 0, height: 2 } },
  sheet: { shadowColor: '#262A24', shadowOpacity: 0.4, shadowRadius: 25, shadowOffset: { width: 0, height: -20 } },
} as const;
