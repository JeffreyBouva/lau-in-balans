import { TextInput, StyleSheet } from 'react-native';
import { colors, radii, fontFamily } from '@/theme/tokens';

/** 6-teken code-invoer: uppercase, alfabet zonder O/0/I/1, monospaced-gevoel via letterSpacing. */
export function CodeInvoer({ waarde, onWijzig }: { waarde: string; onWijzig: (v: string) => void }) {
  // Eén veld i.p.v. zes losse vakjes: plakken werkt, en wat de gebruiker ook typt
  // (kleine letters, streepjes, spaties) — er blijft een geldige code van over.
  function normaliseer(v: string) {
    onWijzig(v.toUpperCase().replace(/[^ABCDEFGHJKLMNPQRSTUVWXYZ23456789]/g, '').slice(0, 6));
  }
  return (
    <TextInput
      style={s.invoer}
      value={waarde}
      onChangeText={normaliseer}
      placeholder="ABC234"
      placeholderTextColor={colors.mutedSofter}
      autoCapitalize="characters"
      autoCorrect={false}
      // Geen autofill: deze code komt van Laura, niet uit een wachtwoordkluis of sms.
      autoComplete="off"
      maxLength={6}
      accessibilityLabel="Code van Laura"
    />
  );
}

const s = StyleSheet.create({
  invoer: {
    textAlign: 'center', fontFamily: fontFamily.sansMedium, fontSize: 26, letterSpacing: 12,
    paddingVertical: 18, borderWidth: 1, borderColor: colors.hairline, borderRadius: radii.cardLg,
    backgroundColor: colors.bgSurface, color: colors.ink,
  },
});
