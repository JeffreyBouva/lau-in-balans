import { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { HANDMATEN, type HandKey } from '@lau/shared';
import { colors, radii, fontFamily, text } from '@/theme/tokens';
import { supabase } from '@/lib/supabase';
import { useSessie } from '@/lib/sessie';
import { tik, stoot } from '@/lib/haptics';
import { resetTutorials } from '@/lib/tutorials';
import {
  useMijnProfiel, PROFIEL_VELDEN,
  type KlantProfiel, type KlantProfielWijziging, type ProfielLijstVeld,
} from '@/lib/hooks/useMijnProfiel';
import {
  DOEL_OPTIES, WEEKVORM_OPTIES, VOORKEUR_OPTIES, BEPERKING_OPTIES, CHECKIN_RITME_OPTIES,
} from '@/state/onboarding';
import { Chip } from '@/components/Chip';
import { PrimaireKnop } from '@/components/PrimaireKnop';
import { CodeSheet } from '@/components/CodeSheet';

const MAX_PORTIEDOEL = 12; // zelfde plafond als de RPC en het coach-dashboard

/** De vijf lijstvelden in schermvolgorde, met hun chip-suggesties. */
const LIJST_VELDEN: { veld: ProfielLijstVeld; titel: string; uitleg: string; opties: string[] }[] = [
  { veld: 'doelen', titel: 'Waar je naartoe wilt', uitleg: 'Meerdere mag. Lau werkt hiernaartoe.', opties: DOEL_OPTIES },
  { veld: 'knelpunten', titel: 'Hoe je week eruitziet', uitleg: 'Zo weet Lau wanneer een advies realistisch is.', opties: WEEKVORM_OPTIES },
  { veld: 'voorkeuren', titel: 'Wat je graag eet', uitleg: 'Lau stelt nooit iets voor waar jij niks mee kunt.', opties: VOORKEUR_OPTIES },
  { veld: 'beperkingen', titel: 'Waar Lau op moet letten', uitleg: 'Allergieën, aandoeningen of medicatie.', opties: BEPERKING_OPTIES },
  { veld: 'checkinRitme', titel: 'Wanneer je van Lau hoort', uitleg: 'Het ritme dat bij jouw dagen past.', opties: CHECKIN_RITME_OPTIES },
];

/** Alleen versturen wat écht veranderd is: elke opslag is een nieuwe profielversie in
 *  Laura's historie, en die hoeft niet vol te lopen met identieke rijen. */
function bouwWijziging(oud: KlantProfiel, nieuw: KlantProfiel): KlantProfielWijziging {
  const wijziging: KlantProfielWijziging = {};
  PROFIEL_VELDEN.forEach((veld) => {
    const a = oud[veld], b = nieuw[veld];
    if (a.length !== b.length || a.some((x, i) => x !== b[i])) wijziging[veld] = b;
  });
  if (HANDMATEN.some((h) => oud.portiedoelen[h.key] !== nieuw.portiedoelen[h.key])) {
    wijziging.portiedoelen = nieuw.portiedoelen;
  }
  return wijziging;
}

export default function Profiel() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session, tier, tierLaden, logout } = useSessie();
  const { profiel, laden, fout, herlaad, slaOp } = useMijnProfiel();

  // Bewerkbare kopie; wordt (her)gevuld zodra het profiel binnen is of net opgeslagen werd.
  const [concept, setConcept] = useState<KlantProfiel | null>(null);
  useEffect(() => {
    if (!profiel) { setConcept(null); return; }
    const { versie: _versie, ...velden } = profiel;
    setConcept(velden);
  }, [profiel]);

  const [bezig, setBezig] = useState(false);
  const [melding, setMelding] = useState<string | null>(null);
  const [opslaanFout, setOpslaanFout] = useState<string | null>(null);
  const [uitlegMelding, setUitlegMelding] = useState<string | null>(null);
  const [codeSheet, setCodeSheet] = useState(false);
  const [uitlogBezig, setUitlogBezig] = useState(false);

  // Naam uit de eigen clients-rij (RLS laat de klant z'n eigen rij lezen).
  const [naam, setNaam] = useState<string | null>(null);
  useEffect(() => {
    supabase.from('clients').select('naam').single()
      .then(({ data }) => setNaam((data as { naam: string } | null)?.naam ?? null));
  }, []);

  /** Elke bewerking wist de vorige bevestiging — anders blijft "Opgeslagen" staan
   *  boven ongesaved wijzigingen. */
  function wijzig(nieuw: KlantProfiel) {
    setConcept(nieuw);
    setMelding(null);
    setOpslaanFout(null);
  }

  function toggle(veld: ProfielLijstVeld, waarde: string) {
    if (!concept) return;
    tik();
    const huidig = concept[veld];
    wijzig({
      ...concept,
      [veld]: huidig.includes(waarde) ? huidig.filter((x) => x !== waarde) : [...huidig, waarde],
    });
  }

  function pasDoelAan(key: HandKey, stap: number) {
    if (!concept) return;
    const nieuw = Math.min(MAX_PORTIEDOEL, Math.max(0, concept.portiedoelen[key] + stap));
    if (nieuw === concept.portiedoelen[key]) return;
    tik();
    wijzig({ ...concept, portiedoelen: { ...concept.portiedoelen, [key]: nieuw } });
  }

  async function bewaar() {
    if (!profiel || !concept || bezig) return;
    const { versie: _versie, ...opgeslagen } = profiel;
    const wijziging = bouwWijziging(opgeslagen, concept);
    if (Object.keys(wijziging).length === 0) {
      setMelding('Er is nog niets veranderd om op te slaan.');
      return;
    }
    setBezig(true);
    setMelding(null);
    setOpslaanFout(null);
    const { error } = await slaOp(wijziging);
    setBezig(false);
    if (error) { setOpslaanFout(error); return; } // invoer blijft staan, opnieuw proberen kan
    stoot();
    setMelding('Opgeslagen — Lau rekent vanaf nu met je nieuwe doelen.');
  }

  async function herhaalUitleg() {
    tik();
    await resetTutorials();
    setUitlegMelding('De uitleg verschijnt weer op elk scherm.');
  }

  async function uitloggen() {
    stoot();
    setUitlogBezig(true);
    // Na het uitloggen stuurt de gate in _layout.tsx vanzelf naar welkom.
    await logout();
  }

  function terug() {
    tik();
    // Direct op /profiel binnenkomen (deeplink/web-refresh) kan: dan is er niets om
    // naar terug te gaan en sturen we naar de standaard-landing.
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/vandaag');
  }

  return (
    <View style={s.root}>
      <View style={[s.header, { paddingTop: insets.top + 6 }]}>
        <Pressable
          onPress={terug}
          accessibilityRole="button"
          accessibilityLabel="Terug"
          hitSlop={8}
          style={({ pressed }) => [s.terug, pressed && s.gedrukt]}
        >
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
        <Text style={s.schermTitel}>Profiel</Text>
      </View>

      <ScrollView
        style={s.body}
        contentContainerStyle={[s.inhoud, { paddingBottom: 40 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Account ── */}
        <View style={s.kaart}>
          <Text style={text.eyebrow}>Account</Text>
          <View style={{ gap: 4 }}>
            <Text style={s.naam}>{naam ?? '—'}</Text>
            <Text style={s.email}>{session?.user.email ?? ''}</Text>
          </View>
          {/* Zolang de tier laadt (of niet op te halen was) staat hier niets — geen
              "Gratis"-badge die bij een coached klant even voorbijflitst. */}
          {!tierLaden && tier !== null && (
            <View style={[s.badge, tier === 'coached' ? s.badgeCoached : s.badgeGratis]}>
              <Text style={[s.badgeTekst, { color: tier === 'coached' ? colors.sageDeeper : colors.muted }]}>
                {tier === 'coached' ? 'Coachingtraject' : 'Gratis'}
              </Text>
            </View>
          )}
          <View style={s.knopRij}>
            {tier === 'free' && (
              <SecundaireKnop label="Ik heb een code" onPress={() => { tik(); setCodeSheet(true); }} />
            )}
            <SecundaireKnop label="Uitloggen" onPress={uitloggen} bezig={uitlogBezig} />
          </View>
        </View>

        {laden ? (
          <View style={s.kaart}>
            <ActivityIndicator color={colors.sage} />
          </View>
        ) : fout || !concept ? (
          <View style={s.kaart}>
            <Text style={s.foutTekst}>{fout ?? 'Profiel laden lukte niet — probeer het later opnieuw.'}</Text>
            <View style={s.knopRij}>
              <SecundaireKnop label="Opnieuw proberen" onPress={() => { tik(); herlaad(); }} />
            </View>
          </View>
        ) : (
          <>
            {/* ── Mijn gegevens ── */}
            <View style={s.kaart}>
              <Text style={text.eyebrow}>Mijn gegevens</Text>
              <Text style={s.kaartIntro}>
                Wat je hier aanpast, weet Lau meteen. Laura ziet de wijziging in je profiel.
              </Text>
              {LIJST_VELDEN.map((v) => (
                <ChipGroep
                  key={v.veld}
                  titel={v.titel}
                  uitleg={v.uitleg}
                  opties={v.opties}
                  waarden={concept[v.veld]}
                  onToggle={(waarde) => toggle(v.veld, waarde)}
                />
              ))}
            </View>

            {/* ── Mijn portiedoelen ── */}
            <View style={s.kaart}>
              <Text style={text.eyebrow}>Mijn portiedoelen</Text>
              <Text style={s.kaartIntro}>
                Hoeveel handmaten je per dag wilt halen. Dit zijn de doelen op je Eten-scherm.
              </Text>
              {HANDMATEN.map((h) => (
                <View key={h.key} style={s.doelRij}>
                  <View style={[s.marker, { backgroundColor: h.kleur }]} />
                  <View style={s.doelTekst}>
                    <Text style={s.doelNaam}>{h.naam}</Text>
                    <Text style={s.doelSub}>{h.hand}</Text>
                  </View>
                  <DoelStepper
                    naam={h.naam}
                    waarde={concept.portiedoelen[h.key]}
                    onMin={() => pasDoelAan(h.key, -1)}
                    onPlus={() => pasDoelAan(h.key, +1)}
                  />
                </View>
              ))}
            </View>

            {/* ── Opslaan ── */}
            <View style={{ gap: 10 }}>
              <PrimaireKnop label="Opslaan" onPress={bewaar} bezig={bezig} />
              {melding && <Text style={s.meldingTekst}>{melding}</Text>}
              {opslaanFout && <Text style={s.foutTekst}>{opslaanFout}</Text>}
            </View>
          </>
        )}

        {/* ── Uitleg opnieuw bekijken ── */}
        <View style={s.kaart}>
          <Text style={text.eyebrow}>Uitleg</Text>
          <Text style={s.kaartIntro}>
            De korte rondleiding per scherm nog eens zien? Zet 'm hier terug.
          </Text>
          <View style={s.knopRij}>
            <SecundaireKnop label="Uitleg opnieuw bekijken" onPress={herhaalUitleg} />
          </View>
          {uitlegMelding && <Text style={s.meldingTekst}>{uitlegMelding}</Text>}
        </View>
      </ScrollView>

      <CodeSheet zichtbaar={codeSheet} onSluit={() => setCodeSheet(false)} />
    </View>
  );
}

/** Chip-multi-select zoals in de onboarding. Eigen antwoorden (vrije tekst uit de
 *  onboarding of van Laura) staan als extra chip achter de suggesties: zo blijven ze
 *  zichtbaar én bewaard in plaats van bij het eerste opslaan te verdwijnen. */
function ChipGroep({ titel, uitleg, opties, waarden, onToggle }: {
  titel: string;
  uitleg: string;
  opties: string[];
  waarden: string[];
  onToggle: (waarde: string) => void;
}) {
  const alle = [...opties, ...waarden.filter((w) => !opties.includes(w))];
  return (
    <View style={{ gap: 10 }}>
      <View style={{ gap: 2 }}>
        <Text style={s.veldTitel}>{titel}</Text>
        <Text style={s.veldUitleg}>{uitleg}</Text>
      </View>
      <View style={s.chipRij}>
        {alle.map((o) => (
          <Chip key={o} label={o} actief={waarden.includes(o)} onPress={() => onToggle(o)} />
        ))}
      </View>
    </View>
  );
}

/** Mini-stepper voor een dagdoel (0..12). Zelfde knop-gevoel als de HandmaatStepper op
 *  Eten, maar zonder dag/doel-verhouding: hier is het getal zélf het doel. */
function DoelStepper({ naam, waarde, onMin, onPlus }: {
  naam: string;
  waarde: number;
  onMin: () => void;
  onPlus: () => void;
}) {
  const minUit = waarde <= 0;
  const plusUit = waarde >= MAX_PORTIEDOEL;
  return (
    <View style={s.stepperRij}>
      <Pressable
        onPress={onMin}
        disabled={minUit}
        accessibilityRole="button"
        accessibilityLabel={`${naam}: doel omlaag`}
        style={({ pressed }) => [s.stepKnop, s.stepMin, minUit && s.stepUit, pressed && s.gedrukt]}
      >
        <Text style={[s.stepTeken, { color: minUit ? colors.muted : colors.ink }]}>−</Text>
      </Pressable>
      <Text style={s.stepWaarde}>{waarde}</Text>
      <Pressable
        onPress={onPlus}
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

/** Secundaire actie: pil met rand, zelfde maat als de primaire knop maar rustiger. */
function SecundaireKnop({ label, onPress, bezig }: { label: string; onPress: () => void; bezig?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={bezig}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!bezig, busy: !!bezig }}
      style={({ pressed }) => [s.secundair, pressed && { backgroundColor: colors.bgNeutralSoft }]}
    >
      {bezig ? <ActivityIndicator color={colors.body} /> : <Text style={s.secundairTekst}>{label}</Text>}
    </Pressable>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgApp },

  // header
  header: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingBottom: 10 },
  terug: { width: 40, height: 40, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' },
  schermTitel: { ...text.schermTitel },
  gedrukt: { opacity: 0.55, transform: [{ scale: 0.92 }] },

  // body
  body: { flex: 1 },
  inhoud: { paddingHorizontal: 22, paddingTop: 6, gap: 18 },

  // kaarten
  kaart: { backgroundColor: colors.bgSurface, borderRadius: radii.cardXl, padding: 22, gap: 14 },
  kaartIntro: { fontFamily: fontFamily.sans, fontSize: 14, lineHeight: 21, color: colors.bodySoft },

  // account
  naam: { fontFamily: fontFamily.serif, fontSize: 21, lineHeight: 28, color: colors.ink },
  email: { fontFamily: fontFamily.sans, fontSize: 14, color: colors.mutedSoft },
  badge: { alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 13, borderRadius: radii.pill, borderWidth: 1 },
  badgeCoached: { backgroundColor: colors.sageSoft, borderColor: colors.sageSoftBorder },
  badgeGratis: { backgroundColor: colors.bgNeutralSoft, borderColor: colors.hairlineSoft },
  badgeTekst: { fontFamily: fontFamily.sans, fontSize: 12.5 },

  // knoppen
  knopRij: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  secundair: {
    minHeight: 44,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.bgSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secundairTekst: { fontFamily: fontFamily.sans, fontSize: 14.5, color: colors.body },

  // mijn gegevens
  veldTitel: { fontFamily: fontFamily.sans, fontSize: 15, color: colors.ink },
  veldUitleg: { fontFamily: fontFamily.sans, fontSize: 13, lineHeight: 20, color: colors.mutedSoft },
  chipRij: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },

  // portiedoelen
  doelRij: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  marker: { width: 14, height: 14, borderRadius: radii.marker },
  doelTekst: { flex: 1, gap: 2 },
  doelNaam: { fontFamily: fontFamily.sans, fontSize: 15, color: colors.ink },
  doelSub: { fontFamily: fontFamily.sans, fontSize: 12.5, color: colors.mutedSoft },
  stepperRij: { flexDirection: 'row', alignItems: 'center' },
  stepKnop: { width: 34, height: 34, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' },
  stepMin: { backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.hairline },
  stepPlus: { backgroundColor: colors.sage },
  stepUit: { opacity: 0.4 },
  stepTeken: { fontFamily: fontFamily.sans, fontSize: 20, lineHeight: 22 },
  stepWaarde: { minWidth: 40, textAlign: 'center', fontFamily: fontFamily.sans, fontSize: 15, color: colors.ink },

  // meldingen
  meldingTekst: { fontFamily: fontFamily.sans, fontSize: 14, lineHeight: 21, color: colors.sageDeep },
  foutTekst: { fontFamily: fontFamily.sans, fontSize: 14, lineHeight: 21, color: colors.clayInk },
});
