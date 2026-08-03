import { useCallback, useRef, useState } from 'react';
import { View, Text, Pressable, Animated, Easing, StyleSheet, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets, type EdgeInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { colors, radii, fontFamily, text, shadow } from '@/theme/tokens';
import { tik } from '@/lib/haptics';
import { useSessie } from '@/lib/sessie';
import { isGezien, markeerGezien, type TutorialScherm } from '@/lib/tutorials';
import { useDoelRect, type DoelRect } from '@/lib/tutorialdoelen';
import { PrimaireKnop } from '@/components/PrimaireKnop';

/** Een stap; `doel` is de sleutel van een element uit de tutorial-doelen-registry. */
export type TutorialStap = { titel: string; tekst: string; doel?: string };

/** Ruimte rondom het uitgelichte element, en de afronding van de sage-rand eromheen. */
const GAT_PAD = 8;
const GAT_RADIUS = 14;
/** Marge tussen het gat en de kaart. */
const KAART_MARGE = 12;
/** Hoogte-inschatting van de kaart, tot 'ie zichzelf een keer heeft opgemeten. */
const KAART_SCHATTING = 210;

type Vlak = { x: number; y: number; breedte: number; hoogte: number };

/**
 * Eerste-keer-uitleg per scherm (spec § 3, B2 + feedback 1): een scrim die een gat laat
 * vallen op het element waar de stap over gaat, met de tekstkaart ernaast.
 *
 * Het gat is geen SVG-masker maar VIER absolute vlakken (boven/onder/links/rechts van het
 * gat). Dat is een écht gat — het element eronder blijft in z'n eigen kleuren staan — en
 * het werkt zonder extra dependency op zowel native als web. De hoeken van het gat blijven
 * vierkant; met een scrim van 30% valt dat niet op, en een echte uitsparing met ronde
 * hoeken zou een masker/SVG vragen die de winst niet waard is. De sage-rand eromheen wijst
 * het element aan.
 *
 * Fallback (stap zonder `doel`, element nog niet gemeten, of weggescrold): de oude vorm —
 * volle scrim met de kaart onderaan. Zo blijft de uitleg altijd leesbaar, ook als meten op
 * web een keer niets oplevert (F2).
 *
 * Zet 'm als laatste kind van het scherm, als broer van de scroll-inhoud: de overlay is
 * een absolute fill binnen het scherm. De tabbar zit als absoluut gepositioneerde balk ná
 * de schermen in de navigator-boom en blijft dus bereikbaar boven de scrim — bewust: je
 * mag altijd weg, en de kaart houdt met z'n bodem-marge ruimte voor de balk vrij.
 *
 * De check draait op focus, niet alleen op mount: tabs blijven gemonteerd, dus na
 * "Uitleg opnieuw bekijken" op het profielscherm moet de terugkeer naar de tab de uitleg
 * weer tonen. Een lopende (of net gesloten) overlay wordt door de refs afgeschermd, zodat
 * een tab-wissel de voortgang niet terugzet.
 */
export function Tutorial({ scherm, stappen }: { scherm: TutorialScherm; stappen: TutorialStap[] }) {
  const insets = useSafeAreaInsets();
  // De vlaggen staan per klant (F3): op één toestel krijgt een tweede account z'n eigen
  // uitleg. Zolang er geen klant bekend is, weten we niet wiens vlag dit zou zijn.
  const { clientId } = useSessie();
  const [zichtbaar, setZichtbaar] = useState(false);
  const [stap, setStap] = useState(0);
  const fade = useRef(new Animated.Value(0)).current;

  // Spiegels van de staat voor de focus-check en de sluit-guard: die kijken buiten de
  // render-cyclus om en zouden anders naar een verouderde waarde kijken.
  const zichtbaarRef = useRef(false);
  const sluitendRef = useRef(false);

  // Meet-anker: het vlak van de overlay zelf, in window-coördinaten. De doelen meten met
  // measureInWindow, dus hun stand moet naar de lokale coördinaten van deze overlay terug
  // (safe-area, web-frame). Zonder dit anker zou het gat verschoven staan.
  const ankerRef = useRef<View | null>(null);
  const [anker, setAnker] = useState<Vlak | null>(null);
  const meetAnker = useCallback(() => {
    const node = ankerRef.current;
    if (!node || typeof node.measureInWindow !== 'function') return;
    node.measureInWindow((x, y, breedte, hoogte) => {
      if (breedte > 0 && hoogte > 0) setAnker({ x, y, breedte, hoogte });
    });
  }, []);

  const [kaartHoogte, setKaartHoogte] = useState(0);
  const meetKaart = useCallback((e: LayoutChangeEvent) => setKaartHoogte(e.nativeEvent.layout.height), []);

  useFocusEffect(
    useCallback(() => {
      if (!clientId) return;
      let actueel = true;
      isGezien(clientId, scherm).then((gezien) => {
        if (!actueel || gezien || zichtbaarRef.current || sluitendRef.current) return;
        zichtbaarRef.current = true;
        setStap(0);
        setZichtbaar(true);
        Animated.timing(fade, {
          toValue: 1,
          duration: 260,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
      });
      return () => { actueel = false; };
    }, [clientId, scherm, fade]),
  );

  // Vóór de vroege return: hooks draaien elke render. Buiten beeld meten we niets — dan
  // hoeft de registry ook niemand wakker te maken.
  const huidig: TutorialStap | undefined = stappen[Math.min(stap, stappen.length - 1)];
  const doelRect = useDoelRect(zichtbaar ? huidig?.doel : undefined);

  const laatste = stap >= stappen.length - 1;

  function volgende() {
    if (laatste) { sluit(); return; }
    tik();
    setStap((n) => n + 1);
  }

  /** Klaar én overslaan: vlag zetten, uitfaden, weg. */
  function sluit() {
    if (sluitendRef.current) return;
    sluitendRef.current = true;
    tik();
    // Niet afwachten: de fade duurt langer dan de schrijfactie, en de refs houden de
    // focus-check tegen tot de overlay echt weg is.
    if (clientId) void markeerGezien(clientId, scherm);
    Animated.timing(fade, {
      toValue: 0,
      duration: 200,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      // Eerst opruimen, dán pas kijken of de animatie het einde haalde: wordt de fade
      // onderbroken (tab-wissel, nieuwe animatie), dan zou een vroege return de refs op
      // "sluitend" laten staan en verschijnt de uitleg nooit meer. De resets zijn
      // idempotent, dus ze mogen ook bij een onderbreking draaien.
      zichtbaarRef.current = false;
      sluitendRef.current = false;
      if (!finished) return;
      setZichtbaar(false);
    });
  }

  if (!zichtbaar || !huidig) return null;

  const gat = maakGat(doelRect, anker);
  const kaartPlek = kaartPositie(gat, anker, insets, kaartHoogte);

  return (
    // Bewust geen Pressable op de scrim: de uitleg is drie korte stapjes, en een
    // onbedoelde tik naast de kaart zou 'm voorgoed wegklikken. Weg ga je via
    // "Overslaan" of "Klaar" — dat zijn ook de enige twee wegen die de vlag zetten.
    // accessibilityViewIsModal: VoiceOver blijft binnen de uitleg in plaats van door het
    // scherm eronder te lopen dat op dat moment niet bedienbaar is (iOS; op Android is
    // dit een no-op).
    <Animated.View style={[s.overlay, { opacity: fade }]} accessibilityViewIsModal>
      {/* Meet-anker én scrim. Het vult de overlay volledig, ook over het gat heen: het
          uitgelichte element is te zien maar niet te bedienen — je gaat verder met
          "Volgende", niet door het scherm eronder aan te raken. */}
      <View ref={ankerRef} onLayout={meetAnker} style={StyleSheet.absoluteFill}>
        {gat ? (
          <>
            <View style={[s.scrim, { left: 0, right: 0, top: 0, height: gat.y }]} />
            <View style={[s.scrim, { left: 0, right: 0, top: gat.y + gat.hoogte, bottom: 0 }]} />
            <View style={[s.scrim, { left: 0, width: gat.x, top: gat.y, height: gat.hoogte }]} />
            <View style={[s.scrim, { left: gat.x + gat.breedte, right: 0, top: gat.y, height: gat.hoogte }]} />
            <View
              pointerEvents="none"
              style={[s.rand, { left: gat.x, top: gat.y, width: gat.breedte, height: gat.hoogte }]}
            />
          </>
        ) : (
          <View style={[s.scrim, StyleSheet.absoluteFill]} />
        )}
      </View>

      <View style={[s.kaartLaag, kaartPlek]} onLayout={meetKaart}>
        <View style={s.kaart}>
          <Text style={s.titel}>{huidig.titel}</Text>
          <Text style={text.body}>{huidig.tekst}</Text>

          {/* De bolletjes zelf zijn decoratie (accessible={false}); de rij eromheen draagt
              de stand als voorleestekst, zodat VoiceOver niet drie naamloze vlakjes leest. */}
          <View
            style={s.dots}
            accessible
            accessibilityRole="text"
            accessibilityLabel={`Stap ${stap + 1} van ${stappen.length}`}
          >
            {stappen.map((_, i) => (
              <View key={i} accessible={false} style={[s.dot, i === stap ? s.dotAan : s.dotUit]} />
            ))}
          </View>

          <View style={s.knopRij}>
            <Pressable
              onPress={sluit}
              accessibilityRole="button"
              hitSlop={8}
              style={({ pressed }) => [s.overslaan, pressed && s.gedrukt]}
            >
              <Text style={s.overslaanTekst}>Overslaan</Text>
            </Pressable>
            <View style={s.primair}>
              <PrimaireKnop label={laatste ? 'Klaar' : 'Volgende'} onPress={volgende} />
            </View>
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

/**
 * Het gat in de scrim, in coördinaten van de overlay zelf. `null` = geen spotlight, dus
 * de kaart-only-vorm: geen doel, niets gemeten, of een doel dat (bijna) helemaal buiten
 * beeld ligt — een kaart die je weggescrold hebt, hoeft niet te worden aangewezen.
 */
function maakGat(rect: DoelRect | null, anker: Vlak | null) {
  if (!rect || !anker) return null;
  const links = rect.x - anker.x - GAT_PAD;
  const boven = rect.y - anker.y - GAT_PAD;
  const rechts = links + rect.breedte + GAT_PAD * 2;
  const onder = boven + rect.hoogte + GAT_PAD * 2;

  // Bijknippen op het overlay-vlak: anders krijgen de vier scrim-vlakken negatieve maten.
  const x = Math.max(0, links);
  const y = Math.max(0, boven);
  const breedte = Math.min(anker.breedte, rechts) - x;
  const hoogte = Math.min(anker.hoogte, onder) - y;
  // Te klein om nog iets uit te lichten (of volledig buiten beeld) → fallback.
  if (breedte < 24 || hoogte < 24) return null;
  return { x, y, breedte, hoogte };
}

/**
 * Waar de kaart komt: onder het gat als daar ruimte is, anders erboven, anders (past het
 * nergens) op de vaste plek onderaan — dezelfde plek als in de kaart-only-vorm. De
 * onderruimte houdt de tabbar vrij.
 */
function kaartPositie(
  gat: Vlak | null,
  anker: Vlak | null,
  insets: EdgeInsets,
  kaartHoogte: number,
) {
  const onderruimte = insets.bottom + 84;
  if (!gat || !anker) return { bottom: onderruimte };

  const nodig = kaartHoogte || KAART_SCHATTING;
  const onderGat = gat.y + gat.hoogte + KAART_MARGE;
  if (anker.hoogte - onderGat - onderruimte >= nodig) return { top: onderGat };
  if (gat.y - KAART_MARGE - (insets.top + 8) >= nodig) return { bottom: anker.hoogte - gat.y + KAART_MARGE };
  return { bottom: onderruimte };
}

const s = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  scrim: { position: 'absolute', backgroundColor: colors.scrim },
  rand: { position: 'absolute', borderRadius: GAT_RADIUS, borderWidth: 2, borderColor: colors.sage },

  kaartLaag: { position: 'absolute', left: 18, right: 18 },
  kaart: {
    backgroundColor: colors.bgSurface,
    borderRadius: radii.cardXl,
    padding: 24,
    gap: 12,
    ...shadow.sheet,
  },
  titel: { fontFamily: fontFamily.serif, fontSize: 20, lineHeight: 27, letterSpacing: -0.2, color: colors.ink },

  dots: { flexDirection: 'row', gap: 7, paddingTop: 2 },
  dot: { width: 7, height: 7, borderRadius: radii.pill },
  dotAan: { backgroundColor: colors.sage },
  dotUit: { backgroundColor: colors.hairline },

  knopRij: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingTop: 6 },
  overslaan: { paddingVertical: 8 },
  overslaanTekst: { fontFamily: fontFamily.sans, fontSize: 15, color: colors.body },
  gedrukt: { opacity: 0.55 },
  primair: { flex: 1 },
});
