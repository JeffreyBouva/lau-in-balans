import { useState } from 'react';
import {
  View, Text, Pressable, ScrollView, StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useSessie } from '@/lib/sessie';
import { colors, fontFamily, text } from '@/theme/tokens';
import { PrimaireKnop } from '@/components/PrimaireKnop';
import { CodeInvoer } from '@/components/CodeInvoer';

/**
 * Eerste stap na registreren: heb je een code van Laura, dan gaat alles open (tier
 * 'coached'). Dit scherm leeft in de (onboarding)-groep zodat de routing-gate het niet
 * terugkaatst; overslaan gaat gewoon door naar de profiel-onboarding.
 */
export default function Code() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { herlaadTier } = useSessie();
  const [code, setCode] = useState('');
  const [fout, setFout] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);

  async function verzilver() {
    if (code.length < 6) { setFout('Vul de 6-tekencode in die je van Laura hebt gekregen.'); return; }
    setBezig(true); setFout(null);
    const { data, error } = await supabase.rpc('verzilver_code', { p_code: code });
    setBezig(false);
    if (error) {
      // Netwerk/serverfout is iets anders dan een foute code — anders sturen we iemand
      // met een prima code naar Laura terwijl alleen de verbinding hapert.
      console.warn('[code] verzilveren mislukt:', error.message);
      setFout('Het lukte even niet om je code te controleren. Probeer het zo nog eens.');
      return;
    }
    if (data !== true) {
      setFout('Deze code klopt niet of is al gebruikt. Check ’m bij Laura.');
      return;
    }
    await herlaadTier();
    router.replace('/(onboarding)');
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.root}>
      <ScrollView
        contentContainerStyle={[s.scroll, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled">
        <View style={s.inner}>
          <Text style={text.schermTitel}>Ben je klant bij Laura?</Text>
          <Text style={[text.bodyGroot, { marginTop: 8 }]}>
            Dan heb je een code van haar gekregen. Vul ’m in en alles gaat open — ook zonder code
            kun je gewoon je voeding bijhouden.
          </Text>
          <View style={s.invoerBlok}>
            <CodeInvoer waarde={code} onWijzig={(v) => { setCode(v); setFout(null); }} />
            {fout && <Text style={[text.bodyKlein, { color: colors.clayInk }]}>{fout}</Text>}
          </View>
          <PrimaireKnop label="Code verzilveren" onPress={verzilver} bezig={bezig} />
          <Pressable onPress={() => router.replace('/(onboarding)')} disabled={bezig}
            style={s.overslaan} accessibilityRole="button">
            <Text style={s.overslaanTekst}>Ik heb geen code — overslaan</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgApp },
  scroll: { flexGrow: 1, justifyContent: 'center' },
  inner: { paddingHorizontal: 26 },
  invoerBlok: { marginVertical: 26, gap: 10 },
  overslaan: { alignItems: 'center', paddingVertical: 16 },
  overslaanTekst: { fontFamily: fontFamily.sans, fontSize: 15, color: colors.sageDeep },
});
