import { useCallback, useRef, useState } from 'react';
import { View, Text, Pressable, Animated, Easing, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { colors, radii, fontFamily, text, shadow } from '@/theme/tokens';
import { tik } from '@/lib/haptics';
import { isGezien, markeerGezien, type TutorialScherm } from '@/lib/tutorials';
import { PrimaireKnop } from '@/components/PrimaireKnop';

export type TutorialStap = { titel: string; tekst: string };

/**
 * Eerste-keer-uitleg per scherm (spec § 3, B2): een scrim met een stappenkaart onderaan,
 * géén spotlight-uitsnedes — begrijpelijk, robuust over schermformaten en web-veilig.
 *
 * Zet 'm als laatste kind van het scherm, als broer van de scroll-inhoud: de overlay is
 * een absolute fill binnen het scherm. De tabbar zit als absoluut gepositioneerde balk ná
 * de schermen in de navigator-boom en blijft dus bereikbaar boven de scrim — bewust: je
 * mag altijd weg, en de kaart houdt met z'n bodem-padding ruimte voor de balk vrij.
 *
 * De check draait op focus, niet alleen op mount: tabs blijven gemonteerd, dus na
 * "Uitleg opnieuw bekijken" op het profielscherm moet de terugkeer naar de tab de uitleg
 * weer tonen. Een lopende (of net gesloten) overlay wordt door de refs afgeschermd, zodat
 * een tab-wissel de voortgang niet terugzet.
 */
export function Tutorial({ scherm, stappen }: { scherm: TutorialScherm; stappen: TutorialStap[] }) {
  const insets = useSafeAreaInsets();
  const [zichtbaar, setZichtbaar] = useState(false);
  const [stap, setStap] = useState(0);
  const fade = useRef(new Animated.Value(0)).current;

  // Spiegels van de staat voor de focus-check en de sluit-guard: die kijken buiten de
  // render-cyclus om en zouden anders naar een verouderde waarde kijken.
  const zichtbaarRef = useRef(false);
  const sluitendRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      let actueel = true;
      isGezien(scherm).then((gezien) => {
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
    }, [scherm, fade]),
  );

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
    void markeerGezien(scherm);
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

  if (!zichtbaar || stappen.length === 0) return null;
  const huidig = stappen[Math.min(stap, stappen.length - 1)];

  return (
    // Bewust geen Pressable op de scrim: de uitleg is drie korte stapjes, en een
    // onbedoelde tik naast de kaart zou 'm voorgoed wegklikken. Weg ga je via
    // "Overslaan" of "Klaar" — dat zijn ook de enige twee wegen die de vlag zetten.
    // accessibilityViewIsModal: VoiceOver blijft binnen de uitleg in plaats van door het
    // scherm eronder te lopen dat op dat moment niet bedienbaar is (iOS; op Android is
    // dit een no-op).
    <Animated.View style={[s.overlay, { opacity: fade }]} accessibilityViewIsModal>
      <View style={[s.kaart, { marginBottom: insets.bottom + 84 }]}>
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
    </Animated.View>
  );
}

const s = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.scrim,
    justifyContent: 'flex-end',
    paddingHorizontal: 18,
  },
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
