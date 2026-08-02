import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, fontFamily } from '@/theme/tokens';
import { CodeSheet } from '@/components/CodeSheet';

/**
 * Zichtbaar-maar-op-slot (fase 4-spec). Warm en eerlijk: wat het is + dat het bij een
 * coachingtraject hoort. NOOIT prijzen, links of koop-taal (App Store 3.1.3).
 * variant "kaart" = blok tussen andere kaarten; "scherm" = vult een hele tab.
 *
 * Na een geslaagde verzilvering hoeft hier niets te gebeuren: de CodeSheet herlaadt de
 * tier en de schermen die deze kaart tonen renderen vanzelf hun open versie.
 */
export function SlotKaart({ titel, uitleg, variant = 'kaart' }: {
  titel: string; uitleg: string; variant?: 'kaart' | 'scherm';
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  return (
    <View style={variant === 'scherm' ? s.scherm : s.kaart}>
      <View style={s.slotBol}>
        {/* Decoratief: de titel eronder vertelt het verhaal al. */}
        <Ionicons name="lock-closed" size={18} color={colors.sageMid} accessible={false} />
      </View>
      <Text style={s.titel}>{titel}</Text>
      <Text style={s.uitleg}>{uitleg}</Text>
      <Text style={s.traject}>Dit hoort bij een coachingtraject van Laura.</Text>
      <Pressable
        accessibilityRole="button"
        style={({ pressed }) => [s.knop, pressed && { opacity: 0.7 }]}
        onPress={() => setSheetOpen(true)}
      >
        <Text style={s.knopTekst}>Ik heb een code</Text>
      </Pressable>
      <CodeSheet zichtbaar={sheetOpen} onSluit={() => setSheetOpen(false)} />
    </View>
  );
}

const s = StyleSheet.create({
  kaart: { backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.hairlineSofter,
    borderRadius: radii.cardXl, padding: 22, gap: 8, alignItems: 'flex-start' },
  scherm: { flex: 1, justifyContent: 'center', paddingHorizontal: 34, gap: 8, alignItems: 'flex-start' },
  slotBol: { width: 40, height: 40, borderRadius: radii.pill, backgroundColor: colors.sageSoft,
    alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  titel: { fontFamily: fontFamily.serif, fontSize: 20, lineHeight: 26, color: colors.ink },
  uitleg: { fontFamily: fontFamily.sans, fontSize: 14, lineHeight: 21, color: colors.bodySoft },
  traject: { fontFamily: fontFamily.sans, fontSize: 13, color: colors.sageMid, marginTop: 2 },
  knop: { marginTop: 12, paddingVertical: 10, paddingHorizontal: 18, borderRadius: radii.pill,
    borderWidth: 1, borderColor: colors.sage, backgroundColor: colors.sageSoft },
  knopTekst: { fontFamily: fontFamily.sansMedium, fontSize: 13, color: colors.sageDeep },
});
