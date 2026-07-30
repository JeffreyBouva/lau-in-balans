import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useSessie } from '@/lib/sessie';
import { PrimaireKnop } from '@/components/PrimaireKnop';
import { colors, radii, fontFamily, text } from '@/theme/tokens';

export default function Login() {
  const { login } = useSessie();
  const [email, setEmail] = useState('');
  const [ww, setWw] = useState('');
  const [fout, setFout] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);

  async function probeer() {
    setBezig(true); setFout(null);
    const { error } = await login(email.trim(), ww);
    setBezig(false);
    if (error) setFout(error);
  }
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.root}>
      <View style={s.inner}>
        <Text style={s.merk}>Lau in Balans</Text>
        <Text style={[text.bodyGroot, { marginBottom: 24 }]}>Welkom terug. Log in om verder te gaan.</Text>
        <TextInput style={s.input} placeholder="E-mail" autoCapitalize="none" keyboardType="email-address"
          value={email} onChangeText={setEmail} placeholderTextColor={colors.mutedSoft} />
        <TextInput style={s.input} placeholder="Wachtwoord" secureTextEntry
          value={ww} onChangeText={setWw} placeholderTextColor={colors.mutedSoft} />
        {fout && <Text style={[text.bodyKlein, { color: colors.clayInk, marginBottom: 8 }]}>{fout}</Text>}
        <PrimaireKnop label="Inloggen" onPress={probeer} bezig={bezig} />
      </View>
    </KeyboardAvoidingView>
  );
}
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgApp, justifyContent: 'center' },
  inner: { padding: 26 },
  merk: { fontFamily: fontFamily.serif, fontSize: 22, color: colors.sage, letterSpacing: 0.4, marginBottom: 8 },
  input: { padding: 14, borderWidth: 1, borderColor: colors.hairlineSoft, borderRadius: radii.input, backgroundColor: colors.bgSurface, fontFamily: fontFamily.sans, fontSize: 15, marginBottom: 12, color: colors.ink },
});
