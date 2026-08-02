import { useState } from 'react';
import {
  View, Text, TextInput, ScrollView, StyleSheet, KeyboardAvoidingView, Platform, Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSessie } from '@/lib/sessie';
import { useOAuthFoutUitUrl } from '@/lib/hooks/useOAuthFoutUitUrl';
import { PrimaireKnop } from '@/components/PrimaireKnop';
import { SocialKnoppen } from '@/components/SocialKnoppen';
import { colors, radii, fontFamily, text } from '@/theme/tokens';

export default function Registreer() {
  const { registreer } = useSessie();
  const router = useRouter();
  const [naam, setNaam] = useState('');
  const [email, setEmail] = useState('');
  const [ww, setWw] = useState('');
  const [fout, setFout] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);
  // Loopt er een social-flow, dan gaat de e-mail-knop op slot (en andersom).
  const [socialBezig, setSocialBezig] = useState(false);
  // Bij "confirm email" aan in Supabase is er nog geen sessie: dan blijven we hier staan
  // met een vriendelijke melding in plaats van door te routeren naar een dood scherm.
  const [bevestigNodig, setBevestigNodig] = useState(false);
  useOAuthFoutUitUrl(setFout);

  async function maakAccount() {
    if (!naam.trim() || !email.trim() || ww.length < 8) {
      setFout('Vul je naam en e-mail in, en kies een wachtwoord van minimaal 8 tekens.');
      return;
    }
    setBezig(true); setFout(null);
    const { error, bevestigingNodig } = await registreer(email, ww, naam);
    setBezig(false);
    if (error) { setFout(error); return; }
    if (bevestigingNodig) { setBevestigNodig(true); return; }
    // Task 7 maakt deze route; tot dan kent typedRoutes 'm niet — cast eruit halen zodra hij bestaat.
    router.replace('/(onboarding)/code' as never); // de gate stuurt sessies zonder profiel hierheen
  }

  if (bevestigNodig) {
    return (
      <View style={[s.root, s.gecentreerd, s.inner]}>
        <Text style={s.merk}>Lau in Balans</Text>
        <Text style={text.schermTitel}>Check je e-mail</Text>
        <Text style={[text.bodyGroot, { marginTop: 10 }]}>
          We hebben een bevestigingslink gestuurd naar {email.trim()}. Klik erop en log daarna in —
          dan zetten we samen de eerste stap.
        </Text>
        <Pressable onPress={() => router.replace('/(auth)/login')} style={s.wissel} accessibilityRole="button">
          <Text style={s.wisselTekst}>Naar inloggen</Text>
        </Pressable>
        {/* Uitweg bij een typefout in het adres: terug naar het formulier, gegevens blijven staan. */}
        <Pressable onPress={() => setBevestigNodig(false)} style={s.wissel} accessibilityRole="button">
          <Text style={s.wisselTekst}>Ander e-mailadres gebruiken</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.root}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <View style={s.inner}>
          <Text style={s.merk}>Lau in Balans</Text>
          <Text style={[text.bodyGroot, { marginBottom: 24 }]}>Maak een account om te beginnen.</Text>
          <SocialKnoppen onFout={setFout} disabled={bezig} onBezig={setSocialBezig} />
          <TextInput style={s.input} placeholder="Naam" value={naam} onChangeText={setNaam}
            autoComplete="name" textContentType="name" autoCapitalize="words"
            placeholderTextColor={colors.mutedSoft} />
          <TextInput style={s.input} placeholder="E-mail" autoCapitalize="none" keyboardType="email-address"
            autoComplete="email" textContentType="emailAddress" autoCorrect={false}
            value={email} onChangeText={setEmail} placeholderTextColor={colors.mutedSoft} />
          <TextInput style={s.input} placeholder="Wachtwoord (min. 8 tekens)" secureTextEntry
            autoComplete="new-password" textContentType="newPassword"
            value={ww} onChangeText={setWw} placeholderTextColor={colors.mutedSoft} />
          {fout && <Text style={[text.bodyKlein, { color: colors.clayInk, marginBottom: 8 }]}>{fout}</Text>}
          <PrimaireKnop label="Account maken" onPress={maakAccount} bezig={bezig || socialBezig} />
          <Pressable onPress={() => router.replace('/(auth)/login')} style={s.wissel} accessibilityRole="button">
            <Text style={s.wisselTekst}>Ik heb al een account — inloggen</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgApp },
  scroll: { flexGrow: 1, justifyContent: 'center' },
  gecentreerd: { justifyContent: 'center' },
  inner: { padding: 26 },
  merk: { fontFamily: fontFamily.serif, fontSize: 22, color: colors.sage, letterSpacing: 0.4, marginBottom: 8 },
  input: { padding: 14, borderWidth: 1, borderColor: colors.hairlineSoft, borderRadius: radii.input,
    backgroundColor: colors.bgSurface, fontFamily: fontFamily.sans, fontSize: 15, marginBottom: 12, color: colors.ink },
  wissel: { alignItems: 'center', paddingVertical: 14 },
  wisselTekst: { fontFamily: fontFamily.sans, fontSize: 14, color: colors.sageDeep },
});
