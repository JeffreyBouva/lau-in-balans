import { Pressable, Text, View, StyleSheet } from 'react-native';
import { colors, radii, fontFamily } from '@/theme/tokens';

/**
 * Handmaat-stepper (handoff § 3). De getoonde waarde is de dagsom (dag[key]);
 * onMin/onPlus muteren de quick-rij via de hook. `−` klemt op 0 (de hook klemt óók,
 * maar we disablen bij 0 voor UX), `+` heeft geen bovengrens.
 */
export function HandmaatStepper({
  waarde,
  doel,
  onMin,
  onPlus,
}: {
  waarde: number;
  doel: number;
  onMin: () => void;
  onPlus: () => void;
}) {
  const minUit = waarde <= 0;
  return (
    <View style={s.rij}>
      <Pressable
        onPress={onMin}
        disabled={minUit}
        accessibilityRole="button"
        accessibilityLabel="Portie eraf"
        style={[s.knop, s.min, minUit && s.minUit]}
      >
        <Text style={[s.minTeken, minUit && s.minTekenUit]}>−</Text>
      </Pressable>
      <Text style={s.teller}>
        {waarde} / {doel}
      </Text>
      <Pressable
        onPress={onPlus}
        accessibilityRole="button"
        accessibilityLabel="Portie erbij"
        style={[s.knop, s.plus]}
      >
        <Text style={s.plusTeken}>+</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  rij: { flexDirection: 'row', alignItems: 'center' },
  knop: { width: 34, height: 34, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' },
  min: { backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.hairline },
  minUit: { opacity: 0.4 },
  minTeken: { fontFamily: fontFamily.sans, fontSize: 20, lineHeight: 22, color: colors.ink },
  minTekenUit: { color: colors.muted },
  teller: { minWidth: 46, textAlign: 'center', fontFamily: fontFamily.sans, fontSize: 14, color: colors.body },
  plus: { backgroundColor: colors.sage },
  plusTeken: { fontFamily: fontFamily.sans, fontSize: 20, lineHeight: 22, color: colors.bgSurface },
});
