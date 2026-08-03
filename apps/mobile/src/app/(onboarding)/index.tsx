import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  View, Text, TextInput, Pressable, ScrollView, StyleSheet, Animated,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { HANDMATEN, type Veiligheidsvlag } from '@lau/shared';
import { colors, radii, fontFamily, text } from '@/theme/tokens';
import { useSessie } from '@/lib/sessie';
import { supabase } from '@/lib/supabase';
import { netteVoornaam } from '@/lib/naam';
import { PrimaireKnop } from '@/components/PrimaireKnop';
import { Chip } from '@/components/Chip';
import { VoortgangsBalk } from '@/components/VoortgangsBalk';
import { tik } from '@/lib/haptics';
import { PORTIEDOEL_MIN, PORTIEDOEL_MAX } from '@/lib/portiesuggestie';
import {
  legeOnboarding, naarProfiel, metKeuze, metDoelStap,
  DOEL_OPTIES, WEEKVORM_OPTIES, VOORKEUR_OPTIES, BEPERKING_OPTIES,
  BOUW_OPTIES, MAALTIJD_OPTIES, ACTIVITEIT_OPTIES,
  type OnboardingState,
} from '@/state/onboarding';

const AANTAL_STAPPEN = 9;

type MultiVeld = 'doelen' | 'weekvorm' | 'voorkeuren' | 'beperkingen';

const VEILIGHEID_OPTIES: { label: string; waarde: Veiligheidsvlag }[] = [
  { label: 'Nee, dat speelt niet bij mij', waarde: 'geen' },
  { label: 'Soms wel — houd er rekening mee', waarde: 'soms' },
  { label: 'Ja, daar wil ik voorzichtig mee zijn', waarde: 'voorzichtig' },
];

const CTAS = ['Laten we beginnen', 'Verder', 'Verder', 'Verder', 'Verder', 'Duidelijk', 'Dit is mijn start', 'Verder', 'Naar Lau.ai'];

export default function Onboarding() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { clientId, markProfielAangemaakt } = useSessie();
  const [state, setState] = useState<OnboardingState>(legeOnboarding);
  const [stap, setStap] = useState(0);
  const [bezig, setBezig] = useState(false);

  // Echte voornaam voor de afsluiting (klant mag z'n eigen clients-rij lezen via RLS).
  // netteVoornaam poetst een kleine-letter-naam (Google-login) op bij weergave; de
  // opgeslagen waarde blijft zoals hij is.
  const [voornaam, setVoornaam] = useState<string | null>(null);
  useEffect(() => {
    supabase.from('clients').select('naam').single()
      .then(({ data }) => setVoornaam(netteVoornaam((data as { naam: string } | null)?.naam) || null));
  }, []);

  // lauFade: opacity 0→1 + translateY 6→0 bij elke stap-wissel.
  const fade = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, [stap, fade]);

  function toggle(veld: MultiVeld, val: string) {
    setState((s) => ({
      ...s,
      [veld]: s[veld].includes(val) ? s[veld].filter((x) => x !== val) : [...s[veld], val],
    }));
  }

  async function voltooi() {
    setBezig(true);
    if (clientId) {
      const profiel = naarProfiel(state);
      // GEEN .select() — de klant mag v1 niet teruglezen (coach-only RLS).
      // author:null + versie:1 is vereist door de policy klant_schrijft_versie_1.
      await supabase.from('ai_profile_versions').insert({ client_id: clientId, versie: 1, author: null, profiel });
    }
    // Zet het profiel-vlaggetje meteen op true (C2-fix), ook bij een error (bijv.
    // bestaat al), zodat de routing-gate niet terugkaatst naar onboarding.
    markProfielAangemaakt();
    // B3: landen op Vandaag — voortgang eerst, dan Lau.ai, dan Eten.
    router.replace('/(tabs)/vandaag');
  }

  function volgende() {
    if (stap === AANTAL_STAPPEN - 1) { voltooi(); return; }
    setStap((s) => Math.min(AANTAL_STAPPEN - 1, s + 1));
  }
  const terug = () => setStap((s) => Math.max(0, s - 1));

  const chipGroep = (opties: string[], veld: MultiVeld) => (
    <View style={s.chipRij}>
      {opties.map((o) => (
        <Chip key={o} label={o} actief={state[veld].includes(o)} onPress={() => toggle(veld, o)} />
      ))}
    </View>
  );

  /** Zelfde chips, maar één antwoord tegelijk (dagdoelen-stap). */
  const keuzeGroep = <T extends string | number>(
    vraag: string,
    opties: { label: string; waarde: T }[],
    huidig: T,
    kies: (waarde: T) => void,
  ) => (
    <View style={s.keuzeBlok}>
      <Text style={s.veldLabel}>{vraag}</Text>
      <View style={s.chipRij}>
        {opties.map((o) => (
          <Chip
            key={String(o.waarde)}
            label={o.label}
            actief={huidig === o.waarde}
            onPress={() => { tik(); kies(o.waarde); }}
          />
        ))}
      </View>
    </View>
  );

  const stappen: { body: ReactNode }[] = [
    // 0 — welkom + permanente disclaimer
    {
      body: (
        <>
          <View style={s.cirkel}><Text style={s.cirkelL}>L</Text></View>
          <Text style={text.onboardingHero}>Fijn dat je er bent.</Text>
          <Text style={s.alinea}>Ik ben Lau.ai, je dagelijkse coach in deze app. Laura kent je verhaal, leest mee en stelt mij elke week bij op wat jij nodig hebt.</Text>
          <Text style={s.alinea}>We beginnen met een paar vragen. Geen formulier — gewoon een kennismaking. Je kunt alles later aanpassen.</Text>
          <View style={[s.kaart, { marginTop: 4 }]}>
            <Text style={s.kaartTekst}>Lau.ai geeft coaching en leefstijladvies, geen medisch advies. Bij klachten of twijfel verwijzen we je naar je huisarts of diëtist.</Text>
          </View>
        </>
      ),
    },
    // 1 — doelen
    {
      body: (
        <>
          <Text style={s.titel}>Waar wil je naartoe?</Text>
          <Text style={s.subtitel}>Kies wat het meest voor je telt. Meerdere mag.</Text>
          {chipGroep(DOEL_OPTIES, 'doelen')}
        </>
      ),
    },
    // 2 — weekvorm
    {
      body: (
        <>
          <Text style={s.titel}>Hoe ziet je week eruit?</Text>
          <Text style={s.subtitel}>Zo weet ik wanneer een advies realistisch is.</Text>
          {chipGroep(WEEKVORM_OPTIES, 'weekvorm')}
          <Text style={s.voetnoot}>Vertel later gerust meer in de chat — ik onthoud het.</Text>
        </>
      ),
    },
    // 3 — voorkeuren + afkeer
    {
      body: (
        <>
          <Text style={s.titel}>Wat eet je graag?</Text>
          <Text style={s.subtitel}>Ik stel nooit iets voor waar jij niks mee kunt.</Text>
          {chipGroep(VOORKEUR_OPTIES, 'voorkeuren')}
          <View style={{ gap: 8, marginTop: 8 }}>
            <Text style={s.veldLabel}>Wat eet je liever niet?</Text>
            <TextInput
              style={s.input}
              value={state.afkeer}
              onChangeText={(afkeer) => setState((v) => ({ ...v, afkeer }))}
              placeholder="bijv. vis, kwark, pittig"
              placeholderTextColor={colors.mutedSoft}
            />
          </View>
        </>
      ),
    },
    // 4 — beperkingen + extra
    {
      body: (
        <>
          <Text style={s.titel}>Is er iets waar ik op moet letten?</Text>
          <Text style={s.subtitel}>Allergieën, aandoeningen of medicatie. Alleen wat jij wilt delen.</Text>
          {chipGroep(BEPERKING_OPTIES, 'beperkingen')}
          <TextInput
            style={s.input}
            value={state.extra}
            onChangeText={(extra) => setState((v) => ({ ...v, extra }))}
            placeholder="Iets anders? Schrijf het hier"
            placeholderTextColor={colors.mutedSoft}
          />
          <View style={s.kaart}>
            <Text style={s.kaartTekst}>Laura leest dit als eerste. Ze bepaalt waar ik voorzichtig mee moet zijn.</Text>
          </View>
        </>
      ),
    },
    // 5 — handmaten-uitleg ("zo werkt het")
    {
      body: (
        <>
          <Text style={s.titel}>Zo werkt het.</Text>
          <Text style={s.subtitel}>Geen calorieën, geen weegschaal in de keuken. Je eigen hand is de maat. Die heb je altijd bij je, en hij is precies zo groot als jij: een grotere hand geeft vanzelf een grotere portie. Daarom hoef ik niets over je gewicht te weten.</Text>
          <View style={{ gap: 10 }}>
            {HANDMATEN.map((h) => (
              <View key={h.key} style={s.handKaart}>
                <View style={[s.marker, { backgroundColor: h.kleur }]} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={s.handNaam}>{h.hand}</Text>
                  <Text style={s.handUitleg}>{`${h.naam} — ${h.uitleg}`}</Text>
                </View>
              </View>
            ))}
          </View>
          <Text style={s.voetnoot}>Je logt het in twee tikken — in onze chat of op het Eten-scherm. Mis je een dag, dan is dat geen probleem.</Text>
        </>
      ),
    },
    // 6 — dagdoelen: drie keuzes → live voorstel, dat de klant zelf mag bijdraaien
    {
      body: (
        <>
          <Text style={s.titel}>Jouw dagdoelen.</Text>
          <Text style={s.subtitel}>De maat is bij iedereen de eigen hand. Hoevéél handen per dag verschilt wel. Drie vragen, dan doe ik een voorstel — en jij hebt het laatste woord.</Text>

          {keuzeGroep('Ik ben', BOUW_OPTIES, state.bouw, (bouw) => setState((v) => metKeuze(v, { bouw })))}
          {keuzeGroep('Maaltijden per dag', MAALTIJD_OPTIES, state.maaltijden, (maaltijden) => setState((v) => metKeuze(v, { maaltijden })))}
          {keuzeGroep('Hoe actief is je dag?', ACTIVITEIT_OPTIES, state.activiteit, (activiteit) => setState((v) => metKeuze(v, { activiteit })))}

          <View style={s.doelKaart}>
            {/* Zodra de klant zelf draait, is het niet langer "mijn" voorstel. */}
            <Text style={s.eyebrow}>{state.aangeraakt.length ? 'Jouw doelen per dag' : 'Mijn voorstel per dag'}</Text>
            {HANDMATEN.map((h) => (
              <View key={h.key} style={s.doelRij}>
                <View style={[s.marker, { backgroundColor: h.kleur }]} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={s.handNaam}>{h.naam}</Text>
                  <Text style={s.handUitleg}>{h.hand}</Text>
                </View>
                <DagdoelStepper
                  naam={h.naam}
                  waarde={state.portiedoelen[h.key]}
                  onMin={() => setState((v) => metDoelStap(v, h.key, -1))}
                  onPlus={() => setState((v) => metDoelStap(v, h.key, +1))}
                />
              </View>
            ))}
          </View>
          <Text style={s.voetnoot}>Dit is een startpunt. Je kunt het altijd aanpassen in je profiel.</Text>
        </>
      ),
    },
    // 7 — veiligheidsvraag (single-select, overslaanbaar)
    {
      body: (
        <>
          <Text style={s.titel}>Nog één vraag, en die mag je overslaan.</Text>
          <Text style={s.subtitel}>Heb je nu of eerder een moeilijke relatie met eten of je lichaam gehad? Er is geen goed of fout antwoord.</Text>
          <View style={{ gap: 10 }}>
            {VEILIGHEID_OPTIES.map((o) => {
              const actief = state.veiligheid === o.waarde;
              return (
                <Pressable
                  key={o.waarde}
                  onPress={() => setState((v) => ({ ...v, veiligheid: o.waarde }))}
                  style={[s.veilKaart, actief ? s.veilAan : s.veilUit]}
                >
                  <Text style={[s.veilTekst, { color: actief ? colors.sageDeeper : colors.body }]}>{o.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <View style={s.sageKaart}>
            <Text style={s.sageKaartTekst}>Wat je hier zegt, bepaalt hoe ik met je praat — niet of je welkom bent. Bij zwaardere klachten brengt Laura je in contact met een behandelaar.</Text>
          </View>
          {/* Overslaan = gewoon door; veiligheid blijft null → 'overgeslagen'. */}
          <Pressable onPress={volgende} style={s.skip}>
            <Text style={s.skipTekst}>Sla deze vraag over</Text>
          </Pressable>
        </>
      ),
    },
    // 8 — afsluiting
    {
      body: (
        <>
          <View style={s.cirkel}><Text style={s.cirkelL}>L</Text></View>
          <Text style={s.titelGroot}>
            {voornaam ? `Dank je, ${voornaam}. Ik weet genoeg om te beginnen.` : 'Dank je. Ik weet genoeg om te beginnen.'}
          </Text>
          <Text style={s.alinea}>Geen schema's, geen calorieën. We beginnen bij je avonden — daar zit volgens jou de meeste ruimte.</Text>
          <View style={s.eersteWeek}>
            <Text style={s.eyebrow}>Je eerste week</Text>
            <Text style={s.weekRegel}>Elke ochtend een kort bericht van mij. Reageer wanneer het jou past.</Text>
            <Text style={s.weekRegel}>Log je maaltijden op handmaten — twee tikken, wanneer je eraan denkt.</Text>
            <Text style={s.weekRegel}>Laura neemt contact op om je eerste gesprek van 30 minuten in te plannen.</Text>
          </View>
        </>
      ),
    },
  ];

  // De afsluiting telt niet mee als "stap" — vandaar AANTAL_STAPPEN − 1.
  const label = stap === AANTAL_STAPPEN - 1 ? 'Klaar' : `Stap ${stap + 1} van ${AANTAL_STAPPEN - 1}`;
  const ruimGap = stap === 0 || stap === AANTAL_STAPPEN - 1;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[s.root, { paddingTop: insets.top }]}
    >
      <View style={s.header}>
        <View style={s.headerRij}>
          <Text style={s.merk}>Lau in Balans</Text>
          <Text style={s.stapLabel}>{label}</Text>
        </View>
        <VoortgangsBalk fractie={(stap + 1) / AANTAL_STAPPEN} />
      </View>

      <ScrollView
        style={s.body}
        contentContainerStyle={s.bodyInhoud}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={[
            { gap: ruimGap ? 20 : 18 },
            { opacity: fade, transform: [{ translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }] },
          ]}
        >
          {stappen[stap].body}
        </Animated.View>
      </ScrollView>

      <View style={[s.footer, { paddingBottom: 26 + insets.bottom }]}>
        {stap > 0 && (
          <Pressable onPress={terug} style={s.terug}>
            <Text style={s.terugPijl}>←</Text>
          </Pressable>
        )}
        <View style={{ flex: 1 }}>
          <PrimaireKnop label={CTAS[stap]} onPress={volgende} bezig={bezig} />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

/**
 * Mini-stepper voor één dagdoel (1..12). Bewust een eigen, lokale component: de
 * HandmaatStepper op Eten toont "gelogd / doel" en heeft geen plafond, en hier is
 * het getal zélf het doel. Ondergrens is 1 — een doel van 0 is geen doel.
 */
function DagdoelStepper({ naam, waarde, onMin, onPlus }: {
  naam: string;
  waarde: number;
  onMin: () => void;
  onPlus: () => void;
}) {
  const minUit = waarde <= PORTIEDOEL_MIN;
  const plusUit = waarde >= PORTIEDOEL_MAX;
  return (
    <View style={s.stepperRij}>
      <Pressable
        onPress={() => { tik(); onMin(); }}
        disabled={minUit}
        accessibilityRole="button"
        accessibilityLabel={`${naam}: doel omlaag`}
        style={({ pressed }) => [s.stepKnop, s.stepMin, minUit && s.stepUit, pressed && s.gedrukt]}
      >
        <Text style={[s.stepTeken, { color: minUit ? colors.muted : colors.ink }]}>−</Text>
      </Pressable>
      <Text style={s.stepWaarde} accessibilityLabel={`${naam}: ${waarde} per dag`}>{waarde}</Text>
      <Pressable
        onPress={() => { tik(); onPlus(); }}
        disabled={plusUit}
        accessibilityRole="button"
        accessibilityLabel={`${naam}: doel omhoog`}
        style={({ pressed }) => [s.stepKnop, s.stepPlus, plusUit && s.stepUit, pressed && s.gedrukt]}
      >
        <Text style={[s.stepTeken, { color: colors.bgSurface }]}>+</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgApp },

  // header
  header: { paddingHorizontal: 26, paddingTop: 26, gap: 14 },
  headerRij: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  merk: { fontFamily: fontFamily.serif, fontSize: 15, color: colors.sage, letterSpacing: 0.3 },
  stapLabel: { fontFamily: fontFamily.sans, fontSize: 12, color: colors.mutedSoft },

  // body
  body: { flex: 1 },
  bodyInhoud: { paddingHorizontal: 26, paddingTop: 30, paddingBottom: 24 },

  // titels
  titel: { fontFamily: fontFamily.serif, fontSize: 28, lineHeight: 35, letterSpacing: -0.28, color: colors.ink },
  titelGroot: { fontFamily: fontFamily.serif, fontSize: 30, lineHeight: 36, letterSpacing: -0.45, color: colors.ink },
  subtitel: { fontFamily: fontFamily.sans, fontSize: 15, lineHeight: 24, color: colors.bodySoft },
  alinea: { fontFamily: fontFamily.sans, fontSize: 16, lineHeight: 26, color: colors.body },
  voetnoot: { fontFamily: fontFamily.sans, fontSize: 13, lineHeight: 21, color: colors.mutedSoft, marginTop: 4 },

  // cirkel "L"
  cirkel: { width: 64, height: 64, borderRadius: radii.pill, backgroundColor: colors.sageSoft, alignItems: 'center', justifyContent: 'center' },
  cirkelL: { fontFamily: fontFamily.serif, fontSize: 26, color: colors.sage },

  // chips
  chipRij: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },

  // vrije invoer
  veldLabel: { fontFamily: fontFamily.sans, fontSize: 14, color: colors.body },
  input: { width: '100%', paddingVertical: 14, paddingHorizontal: 16, borderWidth: 1, borderColor: colors.hairlineSoft, borderRadius: radii.input, backgroundColor: colors.bgSurface, fontFamily: fontFamily.sans, fontSize: 15, color: colors.ink },

  // info-/disclaimer-kaart
  kaart: { paddingVertical: 15, paddingHorizontal: 18, backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.hairlineSoft, borderRadius: radii.card },
  kaartTekst: { fontFamily: fontFamily.sans, fontSize: 13, lineHeight: 21, color: colors.bodySoft },

  // handmaat-kaarten (stap 5)
  handKaart: { paddingVertical: 15, paddingHorizontal: 17, backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.hairlineSoft, borderRadius: radii.card, flexDirection: 'row', alignItems: 'center', gap: 14 },
  marker: { width: 14, height: 14, borderRadius: radii.marker },
  handNaam: { fontFamily: fontFamily.sans, fontSize: 15, color: colors.ink },
  handUitleg: { fontFamily: fontFamily.sans, fontSize: 13, color: colors.muted },

  // dagdoelen (stap 6)
  keuzeBlok: { gap: 8 },
  doelKaart: { padding: 18, backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.hairlineSoft, borderRadius: radii.cardLg, gap: 12, marginTop: 2 },
  doelRij: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  stepperRij: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stepKnop: { width: 34, height: 34, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' },
  stepMin: { backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.hairline },
  stepPlus: { backgroundColor: colors.sage },
  stepUit: { opacity: 0.4 },
  stepTeken: { fontFamily: fontFamily.sans, fontSize: 20, lineHeight: 22 },
  stepWaarde: { minWidth: 30, textAlign: 'center', fontFamily: fontFamily.sansMedium, fontSize: 16, color: colors.ink },
  gedrukt: { opacity: 0.55, transform: [{ scale: 0.92 }] },

  // veiligheids-kaarten (stap 7, single-select)
  veilKaart: { paddingVertical: 16, paddingHorizontal: 18, borderRadius: radii.card, borderWidth: 1 },
  veilUit: { backgroundColor: colors.bgSurface, borderColor: colors.hairlineSoft },
  veilAan: { backgroundColor: colors.sageSoft, borderColor: colors.sage },
  veilTekst: { fontFamily: fontFamily.sans, fontSize: 15, lineHeight: 22 },
  sageKaart: { paddingVertical: 16, paddingHorizontal: 18, backgroundColor: colors.sageSoft, borderRadius: radii.card },
  sageKaartTekst: { fontFamily: fontFamily.sans, fontSize: 13, lineHeight: 21, color: colors.sageDeep },
  skip: { alignSelf: 'flex-start', paddingVertical: 4 },
  skipTekst: { fontFamily: fontFamily.sans, fontSize: 14, color: colors.mutedSoft, textDecorationLine: 'underline' },

  // "Je eerste week"-kaart (stap 7)
  eersteWeek: { padding: 18, backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.hairlineSoft, borderRadius: radii.cardLg, gap: 10 },
  eyebrow: { fontFamily: fontFamily.sans, fontSize: 12, letterSpacing: 1.4, textTransform: 'uppercase', color: colors.mutedSoft },
  weekRegel: { fontFamily: fontFamily.sans, fontSize: 15, lineHeight: 24, color: colors.body },

  // footer
  footer: { paddingHorizontal: 26, paddingTop: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  terug: { width: 52, height: 52, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.hairline, backgroundColor: colors.bgSurface, alignItems: 'center', justifyContent: 'center' },
  terugPijl: { fontFamily: fontFamily.sans, fontSize: 17, color: colors.body },
});
