import { TextInput, StyleSheet } from 'react-native';
import { colors, radii, fontFamily } from '@/theme/tokens';

/** 6-teken code-invoer: uppercase, alfabet zonder O/0/I/1, monospaced-gevoel via letterSpacing. */
export function CodeInvoer({ waarde, onWijzig, onVoltooi, autoFocus, editable = true }: {
  waarde: string;
  onWijzig: (v: string) => void;
  /** Enter/Done op het toetsenbord — meestal dezelfde actie als de verzilver-knop. */
  onVoltooi?: () => void;
  autoFocus?: boolean;
  editable?: boolean;
}) {
  // Eén veld i.p.v. zes losse vakjes: plakken werkt, en wat de gebruiker ook typt
  // (kleine letters, streepjes, spaties) — er blijft een geldige code van over.
  // Bewust GEEN maxLength: die kapt native af vóór onChangeText, waardoor "ABC-234"
  // als 5 tekens binnenkomt. De slice(0, 6) hieronder cap't na het schoonvegen.
  function normaliseer(v: string) {
    onWijzig(v.toUpperCase().replace(/[^ABCDEFGHJKLMNPQRSTUVWXYZ23456789]/g, '').slice(0, 6));
  }
  return (
    <TextInput
      style={s.invoer}
      value={waarde}
      onChangeText={normaliseer}
      onSubmitEditing={onVoltooi}
      returnKeyType="done"
      autoFocus={autoFocus}
      editable={editable}
      placeholder="ABC234"
      placeholderTextColor={colors.mutedSofter}
      autoCapitalize="characters"
      autoCorrect={false}
      // Geen autofill: deze code komt van Laura, niet uit een wachtwoordkluis of sms.
      autoComplete="off"
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
