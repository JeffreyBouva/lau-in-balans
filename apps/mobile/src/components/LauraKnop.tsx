import { Pressable, Text, View, StyleSheet } from 'react-native';
import { colors, radii, fontFamily } from '@/theme/tokens';
import { stoot } from '@/lib/haptics';

/**
 * Laura-knop (handoff § 6). Rechtsboven op elk hoofdscherm — de tik naar Laura.
 * Het bolletje is de statusindicator: de klant ziet zonder tekst of haar flag staat.
 * - Geen flag: wit, rand hairline, tekst body, bolletje hairlineHover (#C7BEAE).
 * - Flag verstuurd: sage-soft, rand sage, tekst sage-deep, bolletje sage.
 */
export function LauraKnop({ openFlag, onPress }: { openFlag: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={() => { stoot(); onPress(); }}
      // Zonder role geeft react-native-web een Pressable geen tabstop; het label vertelt
      // wat het bolletje visueel doet (screenreaders zien de kleur niet).
      accessibilityRole="button"
      accessibilityLabel={openFlag ? 'Laura — bericht verstuurd' : 'Praat met Laura'}
      style={({ pressed }) => [s.knop, openFlag ? s.aan : s.uit, pressed && s.gedrukt]}
    >
      <View style={[s.bol, { backgroundColor: openFlag ? colors.sage : colors.hairlineHover }]} />
      <Text style={[s.tekst, { color: openFlag ? colors.sageDeep : colors.body }]}>Laura</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  knop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 9,
    paddingHorizontal: 15,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  gedrukt: { opacity: 0.6 },
  uit: { backgroundColor: colors.bgSurface, borderColor: colors.hairline },
  aan: { backgroundColor: colors.sageSoft, borderColor: colors.sage },
  bol: { width: 7, height: 7, borderRadius: radii.pill },
  tekst: { fontFamily: fontFamily.sans, fontSize: 13 },
});
