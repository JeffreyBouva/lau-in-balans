import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, fontFamily } from '@/theme/tokens';

/**
 * Zichtbaar-maar-op-slot (fase 4-spec). Warm en eerlijk: wat het is + dat het bij een
 * coachingtraject hoort. NOOIT prijzen, links of koop-taal (App Store 3.1.3).
 * variant "kaart" = blok tussen andere kaarten; "scherm" = vult een hele tab.
 *
 * De CodeSheet hangt bewust niet hier maar één niveau hoger, in het scherm: twee slot-
 * kaarten op één scherm zouden anders elk hun eigen sheet meeslepen, en de sheet moet het
 * omklappen naar coached overleven om z'n sluit-animatie te kunnen afmaken. Na een
 * geslaagde verzilvering hoeft deze kaart zelf niets: het scherm rendert z'n open versie.
 *
 * `onAanvraag` is de tweede weg (feedback § 3): wie géén code heeft, kan er een aanvragen.
 * Bewust een rustige tekstlink onder de pil — wie wél een code heeft, moet die als eerste
 * zien.
 */
export function SlotKaart({ titel, uitleg, onCode, onAanvraag, variant = 'kaart' }: {
  titel: string;
  uitleg: string;
  onCode: () => void;
  onAanvraag?: () => void;
  variant?: 'kaart' | 'scherm';
}) {
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
        onPress={onCode}
      >
        <Text style={s.knopTekst}>Ik heb een code</Text>
      </Pressable>
      {onAanvraag && (
        <Pressable
          accessibilityRole="button"
          hitSlop={6}
          style={({ pressed }) => [s.aanvraag, pressed && { opacity: 0.6 }]}
          onPress={onAanvraag}
        >
          <Text style={s.aanvraagTekst}>Nog geen code? Vraag er een aan</Text>
        </Pressable>
      )}
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
  aanvraag: { marginTop: 10, paddingVertical: 4 },
  aanvraagTekst: { fontFamily: fontFamily.sans, fontSize: 13, lineHeight: 20, color: colors.bodySoft,
    textDecorationLine: 'underline' },
});
