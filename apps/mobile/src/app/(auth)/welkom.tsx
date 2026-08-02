import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontFamily, text } from '@/theme/tokens';
import { PrimaireKnop } from '@/components/PrimaireKnop';

const PUNTEN = [
  { icoon: '✓', tekst: 'Houd je voeding bij in handmaten — gratis, zonder calorieën tellen.' },
  { icoon: '✓', tekst: 'Lau.ai: een AI-coach die met je meedenkt, dag en nacht.' },
  { icoon: '✓', tekst: 'Samen met coach Laura, voor wie een coachingtraject volgt.' },
];

export default function Welkom() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.root, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 30 }]}>
      <View style={s.boven}>
        <Text style={s.merk}>Lau in Balans</Text>
        <Text style={s.hero}>Rust in je eetritme.</Text>
        <Text style={[text.bodyGroot, { marginTop: 6 }]}>
          De app hoort bij de voedingscoaching van Laura — en voeding bijhouden kan iedereen, gratis.
        </Text>
        <View style={s.punten}>
          {PUNTEN.map((p) => (
            <View key={p.tekst} style={s.punt}>
              <Text style={s.puntIcoon}>{p.icoon}</Text>
              <Text style={s.puntTekst}>{p.tekst}</Text>
            </View>
          ))}
        </View>
      </View>
      <View style={s.acties}>
        <PrimaireKnop label="Account maken" onPress={() => router.push('/(auth)/registreer')} />
        <Pressable onPress={() => router.push('/(auth)/login')} style={s.loginLink}>
          <Text style={s.loginTekst}>Ik heb al een account</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgApp, paddingHorizontal: 26, justifyContent: 'space-between' },
  boven: { gap: 8 },
  merk: { fontFamily: fontFamily.serif, fontSize: 20, color: colors.sage, letterSpacing: 0.4, marginBottom: 18 },
  hero: { fontFamily: fontFamily.serif, fontSize: 34, lineHeight: 41, letterSpacing: -0.5, color: colors.ink },
  punten: { marginTop: 26, gap: 14 },
  punt: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  puntIcoon: { fontFamily: fontFamily.sansMedium, fontSize: 14, color: colors.sage, lineHeight: 22 },
  puntTekst: { flex: 1, fontFamily: fontFamily.sans, fontSize: 15, lineHeight: 22, color: colors.body },
  acties: { gap: 14 },
  loginLink: { alignItems: 'center', paddingVertical: 8 },
  loginTekst: { fontFamily: fontFamily.sans, fontSize: 15, color: colors.sageDeep },
});
