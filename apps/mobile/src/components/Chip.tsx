import { Pressable, Text, StyleSheet } from 'react-native';
import { colors, radii, fontFamily } from '@/theme/tokens';

export function Chip({ label, actief, onPress }: { label: string; actief: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[s.chip, actief ? s.aan : s.uit]}>
      <Text style={[s.tekst, { color: actief ? colors.sageDeeper : colors.body }]}>{label}</Text>
    </Pressable>
  );
}
const s = StyleSheet.create({
  chip: { paddingVertical: 12, paddingHorizontal: 18, borderRadius: radii.pill, borderWidth: 1 },
  uit: { backgroundColor: colors.bgSurface, borderColor: colors.hairlineSoft },
  aan: { backgroundColor: colors.sageSoft, borderColor: colors.sage },
  tekst: { fontFamily: fontFamily.sans, fontSize: 14.5 },
});
