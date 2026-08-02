import { Pressable, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { colors, radii, fontFamily } from '@/theme/tokens';

export function PrimaireKnop({ label, onPress, bezig }: { label: string; onPress: () => void; bezig?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={bezig}
      // Zonder role geeft react-native-web een Pressable geen tabstop: één regel hier
      // maakt de primaire knop op elk scherm toetsenbordbereikbaar.
      accessibilityRole="button" accessibilityState={{ disabled: !!bezig, busy: !!bezig }}
      style={({ pressed }) => [s.knop, pressed && { backgroundColor: colors.sageHover }]}>
      {bezig ? <ActivityIndicator color="#fff" /> : <Text style={s.label}>{label}</Text>}
    </Pressable>
  );
}
const s = StyleSheet.create({
  knop: { height: 52, borderRadius: radii.pill, backgroundColor: colors.sage, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: fontFamily.sans, fontSize: 16, color: '#fff' },
});
