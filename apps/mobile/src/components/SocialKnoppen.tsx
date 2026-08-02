import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, fontFamily } from '@/theme/tokens';
import { socialLogin } from '@/lib/oauth';
import { useConfig } from '@/lib/hooks/useConfig';

/** Apple/Google-knoppen + "of"-scheiding. Apple staat achter de remote vlag
 *  (apple_login_actief) tot het Apple Developer-account er is. */
export function SocialKnoppen({ onFout }: { onFout: (m: string) => void }) {
  const { appleLoginActief } = useConfig();
  const [bezig, setBezig] = useState<null | 'google' | 'apple'>(null);

  async function start(provider: 'google' | 'apple') {
    setBezig(provider);
    const uitkomst = await socialLogin(provider);
    setBezig(null);
    if (uitkomst.status === 'fout') onFout(uitkomst.melding); // 'geannuleerd' = stil, geen melding
  }

  return (
    <View style={s.blok}>
      {appleLoginActief && (
        <Pressable style={({ pressed }) => [s.knop, s.apple, pressed && s.gedrukt]}
          disabled={bezig !== null} onPress={() => start('apple')}>
          <Ionicons name="logo-apple" size={19} color={colors.bgSurface} />
          <Text style={[s.tekst, { color: colors.bgSurface }]}>
            {bezig === 'apple' ? 'Bezig…' : 'Doorgaan met Apple'}
          </Text>
        </Pressable>
      )}
      <Pressable style={({ pressed }) => [s.knop, s.google, pressed && s.gedrukt]}
        disabled={bezig !== null} onPress={() => start('google')}>
        <Ionicons name="logo-google" size={17} color={colors.ink} />
        <Text style={[s.tekst, { color: colors.ink }]}>{bezig === 'google' ? 'Bezig…' : 'Doorgaan met Google'}</Text>
      </Pressable>
      <View style={s.ofRij}>
        <View style={s.lijn} /><Text style={s.of}>of met e-mail</Text><View style={s.lijn} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  blok: { gap: 10, marginBottom: 14 },
  knop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9,
    paddingVertical: 14, borderRadius: radii.pill, borderWidth: 1 },
  gedrukt: { opacity: 0.7 },
  apple: { backgroundColor: colors.ink, borderColor: colors.ink },
  google: { backgroundColor: colors.bgSurface, borderColor: colors.hairline },
  tekst: { fontFamily: fontFamily.sansMedium, fontSize: 15 },
  ofRij: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 },
  lijn: { flex: 1, height: 1, backgroundColor: colors.hairlineSofter },
  of: { fontFamily: fontFamily.sans, fontSize: 12, color: colors.mutedSoft },
});
