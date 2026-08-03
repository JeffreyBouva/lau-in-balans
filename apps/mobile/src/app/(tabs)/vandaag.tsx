import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import {
  HANDMATEN, weekNummer, vandaagISO, naarISODatum, type Porties,
} from '@lau/shared';
import { colors, radii, fontFamily, text } from '@/theme/tokens';
import { supabase } from '@/lib/supabase';
import { netteVoornaam } from '@/lib/naam';
import { heroZin } from '@/lib/hero';
import { useSessie } from '@/lib/sessie';
import { useKlantData } from '@/lib/klantdata';
import { useOpSlot } from '@/lib/hooks/useOpSlot';
import { usePortiedoelen } from '@/lib/hooks/useProfiel';
import { useSheets } from '@/lib/sheets';
import { useTutorialDoel } from '@/lib/tutorialdoelen';
import { SchermKop } from '@/components/SchermKop';
import { SlotKaart } from '@/components/SlotKaart';
import { CodeSheet } from '@/components/CodeSheet';
import { Tutorial, type TutorialStap } from '@/components/Tutorial';

const WEEKDAG = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];
const GETAL = ['nul', 'één', 'twee', 'drie', 'vier', 'vijf', 'zes', 'zeven'];

// Sleutels van de elementen die de uitleg uitlicht (zie lib/tutorialdoelen.tsx).
const DOEL_CONTACT = 'vandaag.contact';
const DOEL_OPVALT = 'vandaag.opvalt';
const DOEL_KNOPPEN = 'vandaag.knoppen';

// Eerste-keer-uitleg (spec § 3): weekoverzicht · wat opvalt · Laura-knop en profiel.
const UITLEG: TutorialStap[] = [
  {
    titel: 'Je week in één blik',
    tekst: 'Bovenaan zie je op welke dagen jullie contact hadden. Regelmaat telt hier meer dan een perfecte week.',
    doel: DOEL_CONTACT,
  },
  {
    titel: 'Wat opvalt',
    tekst: 'De groene kaart vat je week samen: wat goed gaat, en waar een kleine bijstelling het meeste oplevert.',
    doel: DOEL_OPVALT,
  },
  {
    titel: 'Laura en je profiel',
    tekst: 'Rechtsboven haal je Laura erbij. Het poppetje ernaast opent je profiel — daar pas je je gegevens en doelen aan.',
    doel: DOEL_KNOPPEN,
  },
];

const somPorties = (p: Porties) => p.eiwit + p.groente + p.koolhydraten + p.vet;
const komma = (n: number) => n.toFixed(1).replace('.', ',');
const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1);
const weekdagLetter = (iso: string) => WEEKDAG[new Date(`${iso}T00:00:00`).getDay()];

export default function Vandaag() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [klant, setKlant] = useState<{ startdatum: string; naam: string } | null>(null);
  useEffect(() => {
    supabase.from('clients').select('startdatum, naam').single().then(({ data }) => setKlant(data as any));
  }, []);

  const { berichten, openFlag, dag, week, herlaad } = useKlantData();
  // Dezelfde persoonlijke dagdoelen als op het Eten-scherm: wat de klant op haar profiel
  // instelt, telt hier meteen mee in de gemiddelden en in "wat opvalt".
  const doelen = usePortiedoelen();
  const { openLaura } = useSheets();
  // Drie standen in plaats van twee: zolang het oordeel laadt blijven de tier-gevoelige
  // posities leeg. Dat is de kleinste ingreep die béide flitsen voorkomt — geen slot dat
  // een coached klant even ziet, en geen coach-blok dat een free klant even ziet.
  const { opSlot, laden: slotLaden } = useOpSlot();
  // Het tier los van useOpSlot: de hero en de week-eyebrow hangen aan "heb je een traject",
  // niet aan "staan de sloten aan" (ops kan die uitzetten zonder dat free een traject krijgt).
  const { tier, tierLaden } = useSessie();
  // De Laura-sheet is coach-contact; bij free opent de knop de code-sheet in plaats daarvan.
  const [codeSheet, setCodeSheet] = useState(false);

  // Uit te lichten elementen voor de eerste-keer-uitleg. Op slot staat er een SlotKaart in
  // plaats van de contactkaart; dan meet stap 1 niets en valt de uitleg terug op de kaart.
  const contactDoel = useTutorialDoel(DOEL_CONTACT);
  const opvaltDoel = useTutorialDoel(DOEL_OPVALT);

  // Week-gemiddelden verversen na terugkeer (bijv. na een log-save in de sheet).
  useFocusEffect(useCallback(() => { herlaad(); }, [herlaad]));

  // Header. De naam uit de database kan in kleine letters staan (Google-login); we
  // poetsen 'm bij weergave op — de opgeslagen waarde laten we met rust.
  const voornaam = netteVoornaam(klant?.naam);
  const weekNr = klant ? weekNummer(klant.startdatum, vandaagISO()) : null;

  // Contact: per dag (dezelfde 7-dagen-as als de weeklogs) is er contact als een
  // bericht op die kalenderdag valt.
  const contactDagen = week.map((d) => ({
    datum: d.datum,
    contact: berichten.some((b) => naarISODatum(new Date(b.created_at)) === d.datum),
  }));
  const aantalContact = contactDagen.filter((d) => d.contact).length;
  const contactZin = `${cap(GETAL[aantalContact] ?? String(aantalContact))} van zeven dagen. `
    + 'Regelmaat telt meer dan een perfecte week.'; // fase 3: vergelijking met vorige week

  // Eten-gemiddelden: som per handmaat / aantal dagen met een log deze week.
  const dagenMetLog = week.filter((d) => somPorties(d.porties) > 0).length;
  const gemiddelden = HANDMATEN.map((h) => {
    const totaal = week.reduce((sum, d) => sum + d.porties[h.key], 0);
    // Persoonlijk doel uit het profiel; 0 of ontbrekend valt terug op het standaarddoel,
    // zodat de verhoudingen hieronder nooit door nul delen.
    const doel = doelen[h.key] || h.dagdoel;
    return { ...h, doel, gem: dagenMetLog > 0 ? totaal / dagenMetLog : 0 };
  });
  const sterkste = gemiddelden.reduce((best, h) => (h.gem / h.doel > best.gem / best.doel ? h : best));
  const eiwit = gemiddelden.find((h) => h.key === 'eiwit')!;
  const heeftLogs = dagenMetLog > 0;

  // "Wat opvalt": statisch afgeleid uit de weekcijfers — fase 3 verrijkt dit met AI.
  const opvaltTitel = heeftLogs
    ? `${sterkste.naam} is deze week je sterkste punt.`
    : 'Nog geen eten gelogd deze week.';
  const opvaltRegel = heeftLogs
    ? (eiwit.gem >= eiwit.doel
        ? `Je eiwit zit op koers — dat merk je 's avonds aan minder trek.`
        : 'Bij het avondeten is eiwit het makkelijkst bij te sturen: kip, vis of kwark.')
    : 'Zodra je logt, zie je hier wat opvalt aan je week.';

  const etenOnder = heeftLogs
    ? `Gemiddelde handmaten per dag deze week. ${sterkste.naam} is je sterkste punt.`
    : 'Nog niets gelogd deze week. Twee tikken op het Eten-scherm.';

  // Hero-regel (feedback § 4). Stond vast op "Je vindt je ritme"; die zin klopte alleen bij
  // toeval. Nu kiest lib/hero.ts er één op de echte stand: week in het traject, dagen met
  // een log, dagen met contact, en of er vandaag al iets is bijgehouden.
  const hero = heroZin({
    voornaam,
    weekNr,
    dagenGelogd: dagenMetLog,
    contactDagen: aantalContact,
    gelogdVandaag: somPorties(dag) > 0,
    tier,
  });

  return (
    // De scroll zit in een schermvullende View: de tutorial-overlay is een absolute
    // fill en hoort naast de scroll, niet erin (binnen de inhoud zou 'ie meescrollen).
    <View style={s.root}>
      <ScrollView
        style={s.root}
        contentContainerStyle={[s.inhoud, { paddingTop: insets.top + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header. De Laura-knop ziet er in alle standen hetzelfde uit (niets te flitsen).
            Tijdens het laden is de tik bewust een no-op: dan weten we nog niet of dit een
            free-klant is, en Laura's inbox is voor klanten mét traject. */}
        <SchermKop
          openFlag={openFlag}
          lauraLabel={opSlot ? 'Ik heb een code' : undefined}
          onLaura={slotLaden ? () => {} : opSlot ? () => setCodeSheet(true) : openLaura}
          knoppenDoel={DOEL_KNOPPEN}
        >
          <View style={s.headerTekst}>
            {/* "Week N" hoort bij het traject: free heeft er geen, dus geen eyebrow. Zolang
                het tier-oordeel laadt tonen we 'm ook niet — anders flitst 'ie langs bij
                precies de klant voor wie hij niet bedoeld is. */}
            {!tierLaden && tier !== 'free' && weekNr != null && (
              <Text style={text.eyebrow}>Week {weekNr}</Text>
            )}
            <Text style={s.hero}>{hero}</Text>
          </View>
        </SchermKop>

        {/* Contactkaart */}
        {slotLaden ? null : opSlot ? (
          <SlotKaart
            titel="Contact met Lau.ai en Laura"
            uitleg="Zie hier op welke dagen jullie contact hadden — en hoe je week eruitziet."
            onCode={() => setCodeSheet(true)}
          />
        ) : (
          <View style={s.contactKaart} {...contactDoel}>
            <Text style={s.kaartLabel}>Dagen dat we contact hadden</Text>
            <View style={s.dagRij}>
              {contactDagen.map((d) => (
                <View key={d.datum} style={s.dagKolom}>
                  <View style={[s.blok, d.contact ? s.blokAan : s.blokUit]} />
                  <Text style={s.dagLetter}>{weekdagLetter(d.datum)}</Text>
                </View>
              ))}
            </View>
            <Text style={s.kaartOnder}>{contactZin}</Text>
          </View>
        )}

        {/* Wat opvalt */}
        <View style={s.opvaltKaart} {...opvaltDoel}>
          <Text style={s.opvaltEyebrow}>Wat opvalt</Text>
          <Text style={s.opvaltTitel}>{opvaltTitel}</Text>
          <Text style={s.opvaltRegel}>{opvaltRegel}</Text>
        </View>

        {/* Eten-gemiddelden */}
        <View style={s.etenKaart}>
          <View style={s.etenKop}>
            <Text style={text.eyebrow}>Eten bijhouden</Text>
            <Pressable onPress={() => router.push('/(tabs)/eten')} style={s.openenKnop}>
              <Text style={s.openenTekst}>Openen</Text>
            </Pressable>
          </View>
          <View style={s.etenRijen}>
            {gemiddelden.map((h) => (
              <View key={h.key} style={s.etenRij}>
                <View style={[s.marker, { backgroundColor: h.kleur }]} />
                <Text style={s.etenNaam}>{h.naam} · {h.hand}</Text>
                <Text style={s.etenGem}>{komma(h.gem)} van {h.doel}</Text>
              </View>
            ))}
          </View>
          <Text style={s.kaartOnder}>{etenOnder}</Text>
        </View>

        {/* Hier stonden "Waar we aan werken" en het afspraak-blok. Beide waren verzonnen —
            drie vaste werkpunten en een vaste datum ("donderdag 20 aug") — en er is geen
            databron die ze kan vullen (feedback § 2, aanname F5). Liever weg dan nep.
            Ze komen terug zodra het wekelijks gesprek ze vult (weekly_sessions.voorstellen
            is de échte bron voor werkpunten) en er echte agenda-data is voor de afspraak.
            De slot-kaart die hier voor free stond, is mee verdwenen: die beloofde inhoud
            die een coached klant nu ook niet krijgt. */}

        {/* Buiten de slot-conditie: zo overleeft de sheet het omklappen naar coached. */}
        <CodeSheet zichtbaar={codeSheet} onSluit={() => setCodeSheet(false)} />
      </ScrollView>

      {/* Als laatste kind: de eerste-keer-uitleg legt zich over het hele scherm. */}
      <Tutorial scherm="vandaag" stappen={UITLEG} />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgApp },
  inhoud: { paddingHorizontal: 22, paddingBottom: 110, gap: 18 },

  // header (de knoppenrij rechts zit in SchermKop)
  headerTekst: { gap: 8 },
  hero: { fontFamily: fontFamily.serif, fontSize: 30, lineHeight: 37, letterSpacing: -0.4, color: colors.ink },

  // contactkaart
  contactKaart: { backgroundColor: colors.bgSurface, borderRadius: radii.cardXl, padding: 22, gap: 14 },
  kaartLabel: { fontFamily: fontFamily.sans, fontSize: 13, color: colors.body },
  dagRij: { flexDirection: 'row', gap: 6 },
  dagKolom: { flex: 1, alignItems: 'center', gap: 6 },
  blok: { width: '100%', height: 34, borderRadius: radii.controlSm, borderWidth: 1 },
  blokAan: { backgroundColor: colors.sageSoft, borderColor: colors.sageSoftBorder },
  blokUit: { backgroundColor: colors.bgNeutralSoft, borderColor: colors.hairlineSofter },
  dagLetter: { fontFamily: fontFamily.sans, fontSize: 11, color: colors.mutedSofter },
  kaartOnder: { fontFamily: fontFamily.sans, fontSize: 14, lineHeight: 21, color: colors.bodySoft },

  // wat opvalt
  opvaltKaart: { backgroundColor: colors.sageSoft, borderRadius: radii.cardXl, padding: 22, gap: 10 },
  opvaltEyebrow: { fontFamily: fontFamily.sansMedium, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.sageMid },
  opvaltTitel: { fontFamily: fontFamily.serif, fontSize: 21, lineHeight: 29, color: colors.sageInk },
  opvaltRegel: { fontFamily: fontFamily.sans, fontSize: 14, lineHeight: 21, color: colors.sageDeep },

  // eten-gemiddelden
  etenKaart: { backgroundColor: colors.bgSurface, borderRadius: radii.cardXl, padding: 22, gap: 14 },
  etenKop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  openenKnop: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.hairline, backgroundColor: colors.bgSurface },
  openenTekst: { fontFamily: fontFamily.sans, fontSize: 13, color: colors.sageDeep },
  etenRijen: { gap: 12 },
  etenRij: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  marker: { width: 12, height: 12, borderRadius: radii.marker },
  etenNaam: { flex: 1, fontFamily: fontFamily.sans, fontSize: 14.5, color: colors.body },
  etenGem: { fontFamily: fontFamily.sans, fontSize: 14, color: colors.ink },
});
