import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Dimensions } from 'react-native';
import { colors, radii, fontFamily } from '@/theme/tokens';
import { useSessie } from '@/lib/sessie';
import { useFlag } from '@/lib/hooks/useFlag';
import { Sheet } from '@/components/Sheet';
import { PrimaireKnop } from '@/components/PrimaireKnop';
import { Chip } from '@/components/Chip';

// Redenchips (multi-select, niet verplicht) — handoff § 6.
const REDENEN = ['Het weekend', 'Ik twijfel aan het advies', 'Ik zit even vast', 'Iets persoonlijks'];

// handoff § 6: de Laura-sheet is iets hoger dan de log-sheet (max-height 86%).
const MAX_HOOGTE = Dimensions.get('window').height * 0.86;

/**
 * Bottom sheet — Praat met Laura (handoff § 6). De klant kan op elk hoofdscherm
 * een mens erbij halen. Twee states: `idle` (bericht + redenen) en `sent`
 * (bevestiging). Versturen maakt een open flag; flags-realtime laat de Laura-knop
 * overal omslaan naar de "flag verstuurd"-staat.
 */
export function LauraSheet({ zichtbaar, onSluit }: { zichtbaar: boolean; onSluit: () => void }) {
  const { clientId } = useSessie();
  const { maakFlag } = useFlag(clientId!);
  const [tekst, setTekst] = useState('');
  const [redenen, setRedenen] = useState<string[]>([]);
  const [verzonden, setVerzonden] = useState(false);
  const [bezig, setBezig] = useState(false);

  // Terug naar de leegstaande idle-state zodra de sheet dicht is.
  useEffect(() => {
    if (!zichtbaar) {
      setVerzonden(false);
      setTekst('');
      setRedenen([]);
    }
  }, [zichtbaar]);

  async function verstuur() {
    setBezig(true);
    await maakFlag(tekst.trim(), redenen); // flags-realtime laat de Laura-knop overal omslaan
    setBezig(false);
    setVerzonden(true);
  }

  function sluitEnReset() {
    onSluit();
    setVerzonden(false);
    setTekst('');
    setRedenen([]);
  }

  function toggleReden(r: string) {
    setRedenen((huidig) => (huidig.includes(r) ? huidig.filter((x) => x !== r) : [...huidig, r]));
  }

  return (
    <Sheet zichtbaar={zichtbaar} onSluit={onSluit} maxHeight={MAX_HOOGTE}>
      {verzonden ? (
        <View style={s.sent}>
          <View style={s.check}>
            <Text style={s.checkTeken}>✓</Text>
          </View>
          <Text style={s.sentTitel}>Laura heeft je bericht.</Text>
          <Text style={s.sentRegel}>
            Ze leest je gesprekken van deze week terug en reageert meestal dezelfde dag, uiterlijk de volgende ochtend.
          </Text>
          <View style={s.sentKaart}>
            <Text style={s.sentKaartTekst}>Lau blijft gewoon beschikbaar. Je hoeft niet te wachten met vragen.</Text>
          </View>
          <Pressable onPress={sluitEnReset} style={s.terug}>
            <Text style={s.terugTekst}>Terug naar Lau</Text>
          </Pressable>
        </View>
      ) : (
        <View style={s.idle}>
          {/* Avatar + naam */}
          <View style={s.kop}>
            <View style={s.avatar}>
              <Text style={s.avatarLa}>La</Text>
            </View>
            <View style={s.kopTekst}>
              <Text style={s.naam}>Laura</Text>
              <Text style={s.subregel}>jouw coach · leest je gesprekken mee</Text>
            </View>
          </View>

          {/* Alinea */}
          <Text style={s.alinea}>
            Wil je iets aan een mens vragen, of voelt iets niet goed? Laat het hier weten. Laura krijgt een bericht en
            leest je week terug. Je hoeft niet uit te leggen waarom.
          </Text>

          {/* Textarea */}
          <TextInput
            style={s.textarea}
            value={tekst}
            onChangeText={setTekst}
            placeholder="Wil je iets meegeven? (mag ook leeg)"
            placeholderTextColor={colors.mutedSoft}
            multiline
            textAlignVertical="top"
          />

          {/* Redenchips */}
          <View style={s.chips}>
            {REDENEN.map((r) => (
              <Chip key={r} label={r} actief={redenen.includes(r)} onPress={() => toggleReden(r)} />
            ))}
          </View>

          {/* Primaire actie + geruststelling */}
          <View style={s.actie}>
            <PrimaireKnop label="Laura laten meekijken" onPress={verstuur} bezig={bezig} />
            <Text style={s.gerust}>Hulp vragen hoort erbij. Het is geen falen.</Text>
          </View>
        </View>
      )}
    </Sheet>
  );
}

const s = StyleSheet.create({
  // idle
  idle: { paddingHorizontal: 26, paddingTop: 6, paddingBottom: 28, gap: 18 },
  kop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: radii.pill,
    backgroundColor: colors.bgNeutralSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLa: { fontFamily: fontFamily.serif, fontSize: 22, color: colors.lauraAvatarInk },
  kopTekst: { flex: 1, gap: 2 },
  naam: { fontFamily: fontFamily.serif, fontSize: 25, letterSpacing: -0.25, color: colors.ink },
  subregel: { fontFamily: fontFamily.sans, fontSize: 12.5, color: colors.muted },

  alinea: { fontFamily: fontFamily.sans, fontSize: 15.5, lineHeight: 26, color: colors.body },

  textarea: {
    minHeight: 104,
    paddingVertical: 15,
    paddingHorizontal: 17,
    borderWidth: 1,
    borderColor: colors.hairlineSoft,
    borderRadius: radii.cardLg,
    backgroundColor: colors.bgSurface,
    fontFamily: fontFamily.sans,
    fontSize: 15,
    lineHeight: 24,
    color: colors.ink,
  },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  actie: { gap: 12 },
  gerust: { textAlign: 'center', fontFamily: fontFamily.sans, fontSize: 13, color: colors.mutedSoft },

  // sent
  sent: { paddingHorizontal: 26, paddingTop: 8, paddingBottom: 28, gap: 16, alignItems: 'center' },
  check: {
    width: 72,
    height: 72,
    borderRadius: radii.pill,
    backgroundColor: colors.sageSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkTeken: { fontSize: 28, lineHeight: 32, color: colors.sage },
  sentTitel: { fontFamily: fontFamily.serif, fontSize: 29, letterSpacing: -0.29, textAlign: 'center', color: colors.ink },
  sentRegel: { fontFamily: fontFamily.sans, fontSize: 15, lineHeight: 24, textAlign: 'center', color: colors.body },
  sentKaart: {
    width: '100%',
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.hairlineSoft,
    borderRadius: radii.card,
    padding: 18,
  },
  sentKaartTekst: { fontFamily: fontFamily.sans, fontSize: 14, lineHeight: 22, color: colors.bodySoft },
  terug: {
    alignSelf: 'stretch',
    paddingVertical: 16,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.bgSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  terugTekst: { fontFamily: fontFamily.sans, fontSize: 16, color: colors.body },
});
