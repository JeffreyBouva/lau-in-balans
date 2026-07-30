import { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { weekNummer, vandaagISO, type Moment, type Porties } from '@lau/shared';
import { colors, radii, fontFamily, text } from '@/theme/tokens';
import { supabase } from '@/lib/supabase';
import { useKlantData } from '@/lib/klantdata';
import { useSheets } from '@/lib/sheets';
import { LauraKnop } from '@/components/LauraKnop';
import { Bericht } from '@/components/Bericht';

// Quick-replies die de klanttekst rechtstreeks versturen (handoff § 2). De speciale
// eerste chip "Ik heb gegeten" opent de log-sheet (openLog) en staat daarom apart.
const QUICK_REPLIES = ['Wat eet ik vanavond?', 'Ik heb trek', 'Hoe ga ik om met een etentje?', 'Ik ben moe vandaag'];

const cap = (w: string) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w);

export default function Chat() {
  const insets = useSafeAreaInsets();
  const { berichten, verstuur, openFlag } = useKlantData();
  const { openLaura, openLog } = useSheets();

  // Klant (voor het weeknummer in de header).
  const [klant, setKlant] = useState<{ startdatum: string } | null>(null);
  useEffect(() => {
    supabase.from('clients').select('startdatum').single().then(({ data }) => setKlant(data as any));
  }, []);

  // Porties voor de log-berichten los ophalen: een log-bericht draagt alleen een
  // food_log_id; de moment/porties halen we op uit food_logs en mappen we per id,
  // zodat elke Bericht-bubbel z'n eigen log meekrijgt.
  const [logMap, setLogMap] = useState<Record<string, { moment: Moment; porties: Porties }>>({});
  useEffect(() => {
    const ids = berichten.filter((b) => b.food_log_id).map((b) => b.food_log_id!);
    if (!ids.length) return;
    supabase.from('food_logs').select('id, moment, porties').in('id', ids)
      .then(({ data }) => setLogMap(Object.fromEntries(((data as any[]) ?? []).map((r) => [r.id, { moment: r.moment, porties: r.porties }]))));
  }, [berichten]);

  // Autoscroll naar onder bij een nieuw bericht (handoff § Autoscroll: scrollToEnd op
  // de container, niet scrollIntoView).
  const lijstRef = useRef<ScrollView>(null);
  useEffect(() => { lijstRef.current?.scrollToEnd({ animated: true }); }, [berichten.length]);

  const [input, setInput] = useState('');
  function verstuurInput() {
    const tekst = input.trim();
    if (!tekst) return;
    verstuur(tekst); // fase 3: lau-reply — Lau antwoordt hier nog niet
    setInput('');
  }

  const weekNr = klant ? weekNummer(klant.startdatum, vandaagISO()) : null;
  const datumBron = berichten[0]?.created_at ? new Date(berichten[0].created_at) : new Date();
  const datumLabel = cap(datumBron.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' }));

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 22 }]}>
        <View style={s.avatar}>
          <Text style={s.avatarL}>L</Text>
        </View>
        <View style={s.headerTekst}>
          <Text style={text.chatNaam}>Lau.ai</Text>
          <Text style={text.caption}>Ingesteld door Laura{weekNr != null ? ` · week ${weekNr}` : ''}</Text>
        </View>
        <LauraKnop openFlag={openFlag} onPress={openLaura} />
      </View>

      {/* Berichtenlijst */}
      <ScrollView
        ref={lijstRef}
        style={s.lijst}
        contentContainerStyle={s.lijstInhoud}
        onContentSizeChange={() => lijstRef.current?.scrollToEnd({ animated: false })}
        showsVerticalScrollIndicator={false}
      >
        {/* Datumscheiding */}
        <Text style={s.datum}>{datumLabel}</Text>

        {berichten.map((b) => (
          <Bericht key={b.id} bericht={b} log={b.food_log_id ? logMap[b.food_log_id] : undefined} />
        ))}

        {/* Disclaimerregel (guardrail: geen medisch advies, Laura leest mee) */}
        <View style={s.disclaimer}>
          <View style={s.infoCirkel}>
            <Text style={s.infoI}>i</Text>
          </View>
          <Text style={s.disclaimerTekst}>Lau geeft geen medisch advies. Laura leest mee.</Text>
        </View>
      </ScrollView>

      {/* Quick-reply-rij */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.quickRij}
        contentContainerStyle={s.quickInhoud}
      >
        <Pressable style={[s.chip, s.chipEten]} onPress={openLog}>
          <View style={s.chipBol} />
          <Text style={s.chipEtenTekst}>Ik heb gegeten</Text>
        </Pressable>
        {QUICK_REPLIES.map((q) => (
          <Pressable key={q} style={[s.chip, s.chipNeutraal]} onPress={() => verstuur(q)}>
            <Text style={s.chipTekst}>{q}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Composer (zit boven de tabbar; bottom-padding houdt 'm er vrij van) */}
      <View style={[s.composer, { paddingBottom: insets.bottom + 76 }]}>
        <TextInput
          style={s.input}
          value={input}
          onChangeText={setInput}
          placeholder="Schrijf iets aan Lau…"
          placeholderTextColor={colors.mutedSoft}
          returnKeyType="send"
          blurOnSubmit={false}
          onSubmitEditing={verstuurInput}
        />
        <Pressable style={s.verzend} onPress={verstuurInput}>
          <Text style={s.verzendGlyph}>↑</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgApp },

  // header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingHorizontal: 22,
    paddingBottom: 14,
    backgroundColor: colors.bgApp,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairlineSofter,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: radii.pill,
    backgroundColor: colors.sageSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarL: { fontFamily: fontFamily.serif, fontSize: 19, color: colors.sageInk },
  headerTekst: { flex: 1, gap: 2 },

  // berichtenlijst
  lijst: { flex: 1 },
  lijstInhoud: { paddingHorizontal: 22, paddingTop: 22, paddingBottom: 8, gap: 14 },
  datum: { textAlign: 'center', fontFamily: fontFamily.sans, fontSize: 12, color: colors.mutedSofter },

  // disclaimerregel
  disclaimer: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 2 },
  infoCirkel: {
    width: 24,
    height: 24,
    borderRadius: radii.pill,
    backgroundColor: colors.bgNeutralSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoI: { fontFamily: fontFamily.sans, fontSize: 12, color: colors.mutedSoft },
  disclaimerTekst: { flex: 1, fontFamily: fontFamily.sans, fontSize: 12, lineHeight: 18, color: colors.mutedSoft },

  // quick-reply-rij
  quickRij: { flexGrow: 0 },
  quickInhoud: { paddingHorizontal: 22, paddingBottom: 8, gap: 8, alignItems: 'center' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 9,
    paddingHorizontal: 15,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  chipEten: { backgroundColor: colors.sageSoft, borderColor: colors.sage },
  chipBol: { width: 7, height: 7, borderRadius: radii.pill, backgroundColor: colors.sage },
  chipEtenTekst: { fontFamily: fontFamily.sans, fontSize: 13, color: colors.sageDeeper },
  chipNeutraal: { backgroundColor: colors.bgSurface, borderColor: colors.hairline },
  chipTekst: { fontFamily: fontFamily.sans, fontSize: 13, color: colors.body },

  // composer
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 22,
    paddingTop: 12,
    backgroundColor: colors.bgApp,
  },
  input: {
    flex: 1,
    paddingVertical: 15,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radii.pill,
    backgroundColor: colors.bgSurface,
    fontFamily: fontFamily.sans,
    fontSize: 15,
    color: colors.ink,
  },
  verzend: {
    width: 48,
    height: 48,
    borderRadius: radii.pill,
    backgroundColor: colors.sage,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verzendGlyph: { fontSize: 22, lineHeight: 24, color: colors.bgSurface },
});
