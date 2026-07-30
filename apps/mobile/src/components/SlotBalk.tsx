import { View, StyleSheet } from 'react-native';
import { colors, radii } from '@/theme/tokens';

/**
 * Slot-balk (handoff § 3). Aantal slots = max(doel, waarde); gevuld = de handmaat-kleur,
 * leeg = bgNeutralSoft. Slots bóven het doel dimmen (opacity .55) — je ziet dat je erover
 * zit, zonder dat het fout voelt.
 */
export function SlotBalk({ waarde, doel, kleur }: { waarde: number; doel: number; kleur: string }) {
  const aantal = Math.max(doel, waarde);
  return (
    <View style={s.balk}>
      {Array.from({ length: aantal }, (_, i) => {
        const gevuld = i < waarde;
        const bovenDoel = i >= doel;
        return (
          <View
            key={i}
            style={[
              s.slot,
              { backgroundColor: gevuld ? kleur : colors.bgNeutralSoft },
              bovenDoel && s.bovenDoel,
            ]}
          />
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  balk: { flexDirection: 'row', gap: 6 },
  slot: { flex: 1, height: 10, borderRadius: radii.pill },
  bovenDoel: { opacity: 0.55 },
});
