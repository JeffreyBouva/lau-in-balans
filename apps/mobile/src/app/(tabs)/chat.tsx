import { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { weekNummer, vandaagISO, type Moment, type Porties } from '@lau/shared';
import { colors, radii, fontFamily, text } from '@/theme/tokens';
import { supabase } from '@/lib/supabase';
import { useKlantData } from '@/lib/klantdata';
import { useOpSlot } from '@/lib/hooks/useOpSlot';
import { useSlotSheets } from '@/lib/hooks/useSlotSheets';
import { useSheets } from '@/lib/sheets';
import { chatSuggesties } from '@/lib/suggesties';
import { tik, stoot } from '@/lib/haptics';
import { useTutorialDoel } from '@/lib/tutorialdoelen';
import { SchermKop } from '@/components/SchermKop';
import { SlotKaart } from '@/components/SlotKaart';
import { CodeSheet } from '@/components/CodeSheet';
import { CodeAanvraagSheet } from '@/components/CodeAanvraagSheet';
import { Bericht } from '@/components/Bericht';
import { TypIndicator } from '@/components/TypIndicator';
import { Tutorial, type TutorialStap } from '@/components/Tutorial';

// Sleutels van de elementen die de uitleg uitlicht (zie lib/tutorialdoelen.tsx).
// Stap 1 wijst de Lau.ai-kop aan en niet de hele berichtenlijst: die vult bijna het scherm,
// en dan zou er geen plek meer zijn voor de kaart naast het gat.
const DOEL_KOP = 'chat.kop';
const DOEL_ACTIES = 'chat.acties';
const DOEL_LAURA = 'chat.laura';

// Eerste-keer-uitleg (spec § 3): wie Lau.ai is · loggen vs. suggesties · Laura leest mee.
const UITLEG: TutorialStap[] = [
  {
    titel: 'Dit is Lau.ai',
    tekst: 'Stel gerust je vraag over eten, honger of een lastige dag. Lau.ai denkt met je mee, ook \'s avonds laat.',
    doel: DOEL_KOP,
  },
  {
    titel: 'Loggen of vragen',
    tekst: 'Met "Ik heb gegeten" leg je een maaltijd vast. De rondjes ernaast sturen meteen een vraag naar Lau.ai.',
    doel: DOEL_ACTIES,
  },
  {
    titel: 'Laura leest mee',
    tekst: 'Lau.ai geeft geen medisch advies. Laura kijkt mee in jullie gesprek en stelt Lau.ai op jou af.',
    doel: DOEL_LAURA,
  },
];

// De log-actie ("Ik heb gegeten") opent de log-sheet en staat daarom apart, als knop.
// De suggesties eronder sturen een bericht naar Lau en passen zich aan het dagdeel +
// status aan (zie lib/suggesties.ts). De AI-laag komt daar later overheen.

const cap = (w: string) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w);

export default function Chat() {
  const insets = useSafeAreaInsets();
  const { berichten, verstuur, wachtOpLau, openFlag, dag, aiSuggesties, limietBereikt } = useKlantData();
  const { openLaura, openLog } = useSheets();
  // Zolang het oordeel laadt tonen we het chatscherm zoals het was — dat is de bestaande
  // staat, en zo flitst het slot niet voorbij bij een coached klant of bij sloten-uit.
  const { opSlot, laden: slotLaden } = useOpSlot();
  const toonSlot = opSlot && !slotLaden;
  // Code invullen én een code aanvragen (feedback § 3); er staat er altijd hoogstens één open.
  const { codeOpen, aanvraagOpen, openCode, openAanvraag, sluit, naarAanvraag } = useSlotSheets();

  // Uit te lichten elementen voor de eerste-keer-uitleg (de Laura-knop zit in SchermKop).
  const kopDoel = useTutorialDoel(DOEL_KOP);
  const actieDoel = useTutorialDoel(DOEL_ACTIES);

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
  useEffect(() => { lijstRef.current?.scrollToEnd({ animated: true }); }, [berichten.length, wachtOpLau, limietBereikt]);

  const [input, setInput] = useState('');
  function verstuurInput() {
    const tekst = input.trim();
    if (!tekst || limietBereikt) return;
    stoot();
    verstuur(tekst); // Lau's antwoord komt via de lau-reply Edge Function + realtime
    setInput('');
  }

  // Contextuele suggesties: dagdeel + of er vandaag al gelogd is (som van de porties > 0).
  const gelogdVandaag = dag.eiwit + dag.groente + dag.koolhydraten + dag.vet > 0;
  // AI-suggesties (tier 2) hebben voorrang; anders de regel-gebaseerde set (dagdeel + status).
  const suggesties = aiSuggesties.length ? aiSuggesties : chatSuggesties(new Date(), { gelogdVandaag });

  const weekNr = klant ? weekNummer(klant.startdatum, vandaagISO()) : null;
  const datumBron = berichten[0]?.created_at ? new Date(berichten[0].created_at) : new Date();
  const datumLabel = cap(datumBron.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' }));

  // Free: de hele tab zit op slot (Lau ís de coachingkant). Bewust géén early return maar
  // één boom met een schakelaar erin — zo blijft de CodeSheet hieronder dezelfde instantie
  // wanneer de tier omklapt en kan die z'n sluit-animatie afmaken.
  return (
    <View style={s.root}>
      {/* Header. Op slot is er nog geen coach om te bereiken; tijdens het laden weten we
          het nog niet — dan óók geen Laura-knop, zodat een free-klant geen flag kan
          sturen. Het profiel-icoon blijft wél staan: daar zitten uitloggen en de code. */}
      <SchermKop
        uitlijning="midden"
        style={[s.header, { paddingTop: insets.top + 22 }]}
        openFlag={openFlag}
        onLaura={openLaura}
        toonLaura={!toonSlot && !slotLaden}
        lauraDoel={DOEL_LAURA}
      >
        <View style={s.headerLinks} {...kopDoel}>
          <View style={s.avatar}>
            <Text style={s.avatarL}>L</Text>
          </View>
          <View style={s.headerTekst}>
            <Text style={text.chatNaam}>Lau.ai</Text>
            <Text style={text.caption}>
              {toonSlot || slotLaden ? 'AI-voedingscoach' : `Ingesteld door Laura${weekNr != null ? ` · week ${weekNr}` : ''}`}
            </Text>
          </View>
        </View>
      </SchermKop>

      {/* Drie standen: slot · laden (alleen header, leest als "aan het laden") · open.
          Zo flitst de chat-UI niet voorbij bij een free-klant tijdens de tier-load. */}
      {toonSlot ? (
        <SlotKaart
          variant="scherm"
          titel="Lau.ai denkt met je mee — dag en nacht"
          uitleg="Stel vragen over je eten, krijg warme coaching in handmaten en bouw samen aan je ritme. Laura leest mee en stelt Lau.ai op jou af."
          onCode={openCode}
          onAanvraag={openAanvraag}
        />
      ) : slotLaden ? null : (
        <>
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

            {/* Typing-indicator zolang Lau "typt" (lau-reply loopt, ai-antwoord nog niet binnen) */}
            {wachtOpLau && <TypIndicator />}

            {/* Maandlimiet bereikt (429 van lau-reply): rustige systeemregel, geen kooptaal,
                geen prijzen, geen links — het gesprek loopt via Laura. */}
            {limietBereikt && (
              // Live region: de kaart verschijnt ná een verstuurde tik, dus een
              // schermlezer moet 'm horen zonder dat de focus verspringt.
              <View style={s.limiet} accessibilityRole="text" accessibilityLiveRegion="polite">
                <View style={s.limietCirkel}>
                  <Ionicons name="moon-outline" size={13} color={colors.mutedSoft} />
                </View>
                <Text style={s.limietTekst}>
                  Je Lau.ai-gesprekken voor deze maand zijn op. Bespreek het met Laura — zij kan er meer voor je aanzetten.
                </Text>
              </View>
            )}

            {/* Disclaimerregel (guardrail: geen medisch advies, Laura leest mee) */}
            <View style={s.disclaimer}>
              <View style={s.infoCirkel}>
                <Text style={s.infoI}>i</Text>
              </View>
              <Text style={s.disclaimerTekst}>Lau.ai geeft geen medisch advies. Laura leest mee.</Text>
            </View>
          </ScrollView>

          {/* Quick-reply-rij. Blijft ALTIJD staan: "Ik heb gegeten" is de enige ingang
              naar de log-sheet, en loggen is geen AI-actie — dat moet gewoon door bij een
              bereikte maandlimiet. Alleen de suggestie-chips (en hun scheiding) gaan weg:
              elke chip zou een gesprek starten dat Lau toch niet beantwoordt. */}
          {/* Het meetvlak eromheen is voor de tutorial: een ScrollView meet zichzelf niet
              betrouwbaar, een gewone View wel. Het krijgt geen eigen stijl en verandert
              dus niets aan de rij. */}
          <View {...actieDoel}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={s.quickRij}
              contentContainerStyle={s.quickInhoud}
            >
              <Pressable style={({ pressed }) => [s.actieKnop, pressed && s.gedrukt]} onPress={openLog} accessibilityRole="button">
                <Ionicons name="add" size={18} color={colors.bgSurface} />
                <Text style={s.actieTekst}>Ik heb gegeten</Text>
              </Pressable>
              {!limietBereikt && <View style={s.scheiding} />}
              {!limietBereikt && suggesties.map((q) => (
                <Pressable
                  key={q}
                  style={({ pressed }) => [s.suggestie, pressed && s.gedrukt]}
                  onPress={() => { tik(); verstuur(q); }}
                  accessibilityRole="button"
                >
                  <Text style={s.suggestieTekst}>{q}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {/* Composer (zit boven de tabbar; bottom-padding houdt 'm er vrij van).
              Bij de maandlimiet uit: eerlijker dan een bericht laten sturen waar geen
              antwoord op komt. */}
          <View style={[s.composer, { paddingBottom: insets.bottom + 76 }]}>
            <TextInput
              style={[s.input, limietBereikt && s.uit]}
              value={input}
              onChangeText={setInput}
              editable={!limietBereikt}
              // editable={false} maakt het veld visueel dood, maar zegt een schermlezer
              // niets — deze regel wel (zelfde signaal als op de verzendknop hieronder).
              accessibilityState={{ disabled: limietBereikt }}
              placeholder={limietBereikt ? 'Lau.ai is er volgende maand weer voor je' : 'Schrijf iets aan Lau.ai…'}
              placeholderTextColor={colors.mutedSoft}
              returnKeyType="send"
              blurOnSubmit={false}
              onSubmitEditing={verstuurInput}
            />
            <Pressable
              style={({ pressed }) => [s.verzend, limietBereikt && s.uit, pressed && !limietBereikt && s.gedrukt]}
              onPress={verstuurInput}
              disabled={limietBereikt}
              accessibilityRole="button"
              accessibilityState={{ disabled: limietBereikt }}
            >
              <Text style={s.verzendGlyph}>↑</Text>
            </Pressable>
          </View>
        </>
      )}

      {/* Buiten de slot-conditie: zo overleven de sheets het omklappen naar coached. */}
      <CodeSheet zichtbaar={codeOpen} onSluit={sluit} onAanvraag={naarAanvraag} />
      <CodeAanvraagSheet zichtbaar={aanvraagOpen} onSluit={sluit} />

      {/* Als laatste kind: de eerste-keer-uitleg legt zich over het hele scherm. Op slot
          (en zolang het oordeel laadt) valt er niets uit te leggen — dan monteren we 'm
          niet, zodat de vlag ongebruikt blijft en de uitleg alsnog komt zodra de chat
          openklapt. */}
      {!opSlot && !slotLaden && <Tutorial scherm="chat" stappen={UITLEG} />}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgApp },

  // header (de knoppenrij rechts zit in SchermKop)
  header: {
    paddingHorizontal: 22,
    paddingBottom: 14,
    backgroundColor: colors.bgApp,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairlineSofter,
  },
  headerLinks: { flexDirection: 'row', alignItems: 'center', gap: 13 },
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

  // maandlimiet-regel: disclaimer-stijl, maar als kaartje zodat het als systeemmelding
  // leest en niet als een bericht van Lau. Neutrale kleuren — geen alarm, geen aanbod.
  limiet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.hairlineSoft,
    backgroundColor: colors.bgNeutralSofter,
  },
  limietCirkel: {
    width: 24,
    height: 24,
    borderRadius: radii.pill,
    backgroundColor: colors.bgSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  limietTekst: { flex: 1, fontFamily: fontFamily.sans, fontSize: 12, lineHeight: 18, color: colors.body },

  // quick-reply-rij
  quickRij: { flexGrow: 0 },
  quickInhoud: { paddingHorizontal: 22, paddingBottom: 8, gap: 8, alignItems: 'center' },
  // Log-actie: filled accent + plus → leest als een actie/knop (opent de log-sheet).
  actieKnop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 9,
    paddingLeft: 11,
    paddingRight: 15,
    borderRadius: radii.pill,
    backgroundColor: colors.sage,
  },
  actieTekst: { fontFamily: fontFamily.sansMedium, fontSize: 13, color: colors.bgSurface },
  // Scheiding tussen de actie en de suggesties, zodat je ziet dat het twee soorten zijn.
  scheiding: { width: 1, height: 22, backgroundColor: colors.hairline, marginHorizontal: 3 },
  // Suggesties: outline-chips → leest als "tik om naar Lau te sturen".
  suggestie: {
    paddingVertical: 9,
    paddingHorizontal: 15,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.bgSurface,
  },
  suggestieTekst: { fontFamily: fontFamily.sans, fontSize: 13, color: colors.body },
  gedrukt: { opacity: 0.6 }, // druk-feedback voor actie/suggestie/verzend
  uit: { opacity: 0.45 }, // uitgeschakeld (maandlimiet): composer + verzendknop dimmen

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
