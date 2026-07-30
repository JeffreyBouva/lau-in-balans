import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HANDMATEN, type Handmaat } from '@lau/shared';
import { colors, radii, fontFamily, text } from '@/theme/tokens';
import { useSessie } from '@/lib/sessie';
import { useVoedingslogs } from '@/lib/hooks/useVoedingslogs';
import { usePortiedoelen } from '@/lib/hooks/useProfiel';
import { useFlag } from '@/lib/hooks/useFlag';
import { LauraKnop } from '@/components/LauraKnop';
import { HandmaatStepper } from '@/components/HandmaatStepper';
import { SlotBalk } from '@/components/SlotBalk';

const WEEKDAG = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];
const GETAL = ['nul', 'één', 'twee', 'drie', 'vier', 'vijf', 'zes', 'zeven'];

const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1);
const weekdagLetter = (iso: string) => WEEKDAG[new Date(`${iso}T00:00:00`).getDay()];

export default function Eten() {
  const insets = useSafeAreaInsets();
  const { clientId } = useSessie();
  const { dag, week, pasQuickAan } = useVoedingslogs(clientId!);
  const doelen = usePortiedoelen();
  const { openFlag } = useFlag(clientId!);

  // Header-eyebrow: de echte datum van vandaag (NL, kort).
  const vandaagLabel = new Date().toLocaleDateString('nl-NL', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  });

  // "Lau kijkt mee": statische regel op de stand van vandaag. fase 3: AI-verrijkt.
  const lauRegel =
    dag.eiwit >= 3
      ? "Drie handpalmen eiwit — dat is je doel. Dit zijn de dagen dat je 's avonds minder trek hebt."
      : `Je zit op ${dag.eiwit} van 3 handpalmen eiwit. Bij het avondeten is dat het makkelijkst bij te sturen: kip, vis of kwark als toetje.`;

  // Weekstaafjes: "waarde" = aantal gelogde handmaten die dag (0–4). Een dag telt als
  // gelogd zodra er iets in staat. Hoogte = 14 + waarde × 8 px, of 10px bij niets.
  const weekBars = week.map((d) => {
    const waarde = HANDMATEN.reduce((n, h) => n + (d.porties[h.key] > 0 ? 1 : 0), 0);
    return { datum: d.datum, waarde, gelogd: waarde > 0 };
  });
  const aantalGelogd = weekBars.filter((b) => b.gelogd).length;
  const dagLabel =
    aantalGelogd === 1 ? 'Eén dag' : `${cap(GETAL[aantalGelogd] ?? String(aantalGelogd))} dagen`;
  const weekOnder = `${dagLabel} gelogd. Regelmaat is het punt, geen perfecte week.`;

  return (
    <ScrollView
      style={s.root}
      contentContainerStyle={[s.inhoud, { paddingTop: insets.top + 20 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={s.header}>
        <View style={s.headerTekst}>
          <Text style={text.eyebrow}>{vandaagLabel}</Text>
          <Text style={s.titel}>Vandaag gegeten</Text>
        </View>
        {/* Task 8: open Laura-sheet */}
        <LauraKnop openFlag={openFlag} onPress={() => {}} />
      </View>

      {/* Introregel */}
      <Text style={s.intro}>
        Geen calorieën — je eigen hand is de maat. Tik om een portie toe te voegen.
      </Text>

      {/* Vier portiekaarten */}
      {HANDMATEN.map((h) => (
        <Portiekaart
          key={h.key}
          handmaat={h}
          waarde={dag[h.key]}
          doel={doelen[h.key]}
          onMin={() => pasQuickAan(h.key, -1)}
          onPlus={() => pasQuickAan(h.key, +1)}
        />
      ))}

      {/* "Lau kijkt mee"-kaart */}
      <View style={s.lauKaart}>
        <Text style={s.lauEyebrow}>Lau kijkt mee</Text>
        <Text style={s.lauRegel}>{lauRegel}</Text>
      </View>

      {/* Weekkaart */}
      <View style={s.weekKaart}>
        <Text style={text.eyebrow}>Deze week</Text>
        <View style={s.weekRij}>
          {weekBars.map((b) => (
            <View key={b.datum} style={s.weekKolom}>
              <View
                style={[
                  s.staaf,
                  { height: b.gelogd ? 14 + b.waarde * 8 : 10 },
                  b.gelogd ? s.staafAan : s.staafUit,
                ]}
              />
              <Text style={s.weekLetter}>{weekdagLetter(b.datum)}</Text>
            </View>
          ))}
        </View>
        <Text style={s.kaartOnder}>{weekOnder}</Text>
      </View>

      {/* Uitleg-blok */}
      <View style={s.uitleg}>
        {HANDMATEN.map((h) => (
          <View key={h.key} style={s.uitlegRij}>
            <View style={[s.uitlegMarker, { backgroundColor: h.kleur }]} />
            <Text style={s.uitlegTekst}>
              <Text style={s.uitlegNaam}>{h.naam}</Text> · {h.hand} — {h.uitleg}
            </Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

/** Eén portiekaart (handoff § 3): marker + naam/uitleg + stepper, met de slot-balk eronder. */
function Portiekaart({
  handmaat,
  waarde,
  doel,
  onMin,
  onPlus,
}: {
  handmaat: Handmaat;
  waarde: number;
  doel: number;
  onMin: () => void;
  onPlus: () => void;
}) {
  return (
    <View style={s.kaart}>
      <View style={s.kaartRij}>
        <View style={[s.kaartMarker, { backgroundColor: handmaat.kleur }]} />
        <View style={s.kaartTekst}>
          <Text style={s.kaartNaam}>{handmaat.naam}</Text>
          <Text style={s.kaartSub}>
            {handmaat.hand} · {handmaat.uitleg}
          </Text>
        </View>
        <HandmaatStepper waarde={waarde} doel={doel} onMin={onMin} onPlus={onPlus} />
      </View>
      <SlotBalk waarde={waarde} doel={doel} kleur={handmaat.kleur} />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgApp },
  inhoud: { paddingHorizontal: 22, paddingBottom: 110, gap: 14 },

  // header
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  headerTekst: { flex: 1, gap: 8 },
  titel: { ...text.schermTitel },

  // introregel
  intro: { fontFamily: fontFamily.sans, fontSize: 14.5, lineHeight: 23, color: colors.bodySoft },

  // portiekaart
  kaart: {
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.hairlineSoft,
    borderRadius: radii.cardLg,
    padding: 18,
    gap: 14,
  },
  kaartRij: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  kaartMarker: { width: 16, height: 16, borderRadius: radii.marker },
  kaartTekst: { flex: 1, gap: 2 },
  kaartNaam: { fontFamily: fontFamily.sans, fontSize: 15.5, color: colors.ink },
  kaartSub: { fontFamily: fontFamily.sans, fontSize: 12.5, color: colors.mutedSoft },

  // "Lau kijkt mee"
  lauKaart: { backgroundColor: colors.sageSoft, borderRadius: radii.cardLg, padding: 20, gap: 10 },
  lauEyebrow: {
    fontFamily: fontFamily.sansMedium,
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: colors.sageMid,
  },
  lauRegel: { fontFamily: fontFamily.sans, fontSize: 15, lineHeight: 24, color: colors.sageDeep },

  // weekkaart
  weekKaart: { backgroundColor: colors.bgSurface, borderRadius: radii.cardLg, padding: 18, gap: 14 },
  weekRij: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  weekKolom: { flex: 1, alignItems: 'center', gap: 6 },
  staaf: { width: '100%', borderRadius: 8, borderWidth: 1 },
  staafAan: { backgroundColor: colors.sageSoft, borderColor: colors.sageSoftBorder },
  staafUit: { backgroundColor: colors.bgNeutralSoft, borderColor: colors.hairlineSofter },
  weekLetter: { fontFamily: fontFamily.sans, fontSize: 11, color: colors.mutedSofter },
  kaartOnder: { fontFamily: fontFamily.sans, fontSize: 14, lineHeight: 21, color: colors.bodySoft },

  // uitleg-blok
  uitleg: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.dashed,
    borderRadius: radii.cardLg,
    padding: 18,
    gap: 12,
  },
  uitlegRij: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  uitlegMarker: { width: 12, height: 12, borderRadius: radii.marker },
  uitlegTekst: { flex: 1, fontFamily: fontFamily.sans, fontSize: 13.5, lineHeight: 20, color: colors.body },
  uitlegNaam: { fontFamily: fontFamily.sansMedium, color: colors.ink },
});
