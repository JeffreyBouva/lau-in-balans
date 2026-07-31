import { View, StyleSheet } from 'react-native';
import { colors, radii } from '@/theme/tokens';

export function VoortgangsBalk({ fractie }: { fractie: number }) {
  const w = `${Math.max(0, Math.min(1, fractie)) * 100}%` as const;
  return (
    <View style={s.rail}><View style={[s.fill, { width: w }]} /></View>
  );
}
const s = StyleSheet.create({
  rail: { height: 3, backgroundColor: colors.hairlineSoft, borderRadius: radii.pill, overflow: 'hidden' },
  fill: { height: 3, backgroundColor: colors.sage, borderRadius: radii.pill },
});
