import type { ReactNode } from 'react';
import { View, Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii } from '@/theme/tokens';
import { tik } from '@/lib/haptics';
import { LauraKnop } from '@/components/LauraKnop';

/**
 * Gedeelde topbar voor de drie hoofdschermen (feedback § 7: het profiel-poppetje stond
 * alleen op Vandaag, waardoor de kop per tab anders voelde).
 *
 * Links staat de scherm-eigen inhoud (`children`) — eyebrow + titel op Vandaag/Eten, het
 * Lau.ai-blok met avatar op Chat. Rechts staat ALTIJD dezelfde knoppenrij: de Laura-knop
 * en het profiel-icoon.
 *
 * Het profiel-icoon staat er in élke stand, ook op slot: juist daar zitten uitloggen en
 * het invoeren van een code. De Laura-knop mag wél weg (`toonLaura={false}`) — op Chat is
 * er in de slot-stand nog geen coach om te bereiken, en zolang de tier laadt weten we niet
 * of dit een free-klant is.
 */
export function SchermKop({
  children,
  openFlag,
  onLaura,
  lauraLabel,
  toonLaura = true,
  uitlijning = 'boven',
  style,
}: {
  /** De scherm-eigen linkerkant. */
  children: ReactNode;
  openFlag: boolean;
  onLaura: () => void;
  /** Overschrijft het a11y-label van de Laura-knop — bijv. 'Ik heb een code'. */
  lauraLabel?: string;
  /** Chat zet de Laura-knop uit op slot en tijdens het tier-laden. */
  toonLaura?: boolean;
  /** 'boven' = kop met eyebrow + titel (Vandaag/Eten); 'midden' = avatar-rij (Chat). */
  uitlijning?: 'boven' | 'midden';
  /** Scherm-eigen chroom om de kop heen (Chat heeft padding + onderrand). */
  style?: StyleProp<ViewStyle>;
}) {
  const router = useRouter();
  return (
    <View style={[s.kop, uitlijning === 'midden' ? s.midden : s.boven, style]}>
      <View style={s.links}>{children}</View>
      <View style={s.knoppen}>
        {toonLaura && <LauraKnop openFlag={openFlag} label={lauraLabel} onPress={onLaura} />}
        {/* Profiel: eigen gegevens, doelen, code verzilveren en uitloggen. */}
        <Pressable
          onPress={() => { tik(); router.push('/profiel'); }}
          accessibilityRole="button"
          accessibilityLabel="Profiel"
          hitSlop={8}
          style={({ pressed }) => [s.profielKnop, pressed && s.gedrukt]}
        >
          <Ionicons name="person-circle-outline" size={28} color={colors.muted} />
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  kop: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  boven: { alignItems: 'flex-start' },
  midden: { alignItems: 'center' },
  links: { flex: 1 },
  knoppen: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  profielKnop: { width: 36, height: 36, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' },
  gedrukt: { opacity: 0.55, transform: [{ scale: 0.92 }] },
});
