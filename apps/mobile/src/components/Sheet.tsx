import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type DimensionValue,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors, radii, shadow } from '@/theme/tokens';

/** Duur van de sluit-animatie. Wie een sheet door een andere vervangt, wacht dit af —
 *  twee tegelijk gepresenteerde modals nemen elkaar op native mee in hun val. */
export const SHEET_SLUIT_MS = 240;

/**
 * Herbruikbare bottom-sheet (handoff § 5). Scrim-tik sluit; de sheet-body vangt de tik
 * zelf op (zit als broer bóven de scrim). Openen: spring-up (subtiele iOS-settle) mét een
 * lichte haptic; de scrim fade't mee via een interpolatie op dezelfde y-waarde. Sluiten:
 * korte ease-in naar beneden. Aan het handvat kun je de sheet naar beneden slepen om te
 * sluiten (drag voorbij de drempel of met genoeg snelheid → dicht, anders veert 'ie terug).
 * De Modal blijft gemount tot de sluit-animatie klaar is.
 *
 * Het toetsenbord wordt hier opgevangen, niet in de sheet-inhoud: een KeyboardAvoidingView
 * rekent met z'n eigen frame, en binnen de sheet-body is dat frame ~0 px van de onderkant
 * af — de verschuiving komt dan altijd op 0 uit en het toetsenbord bedekt het invoerveld.
 * (frame.y is parent-relatief; de KAV vergelijkt frame.y + hoogte met de toetsenbordpositie.)
 * De KAV moet dus schermvullend zijn (hier: rond de sheet, buiten de scrim).
 *
 * `sluitbaar={false}` zet alle sluit-wegen dicht (scrim, sleep, Android-back) — voor een
 * sheet die midden in een actie zit en niet halverwege weg mag vallen.
 */
export function Sheet({
  zichtbaar,
  onSluit,
  children,
  maxHeight,
  sluitbaar = true,
}: {
  zichtbaar: boolean;
  onSluit: () => void;
  children: ReactNode;
  maxHeight?: number;
  sluitbaar?: boolean;
}) {
  const schermH = Dimensions.get('window').height;
  const y = useRef(new Animated.Value(schermH)).current;
  const [gemount, setGemount] = useState(zichtbaar);

  // Laatste onSluit + sluitbaar in refs, zodat de één-keer-aangemaakte PanResponder niet
  // stale wordt (hij ziet anders eeuwig de waarden van de eerste render).
  const sluitRef = useRef(onSluit);
  sluitRef.current = onSluit;
  const sluitbaarRef = useRef(sluitbaar);
  sluitbaarRef.current = sluitbaar;

  const springNaarOpen = () =>
    Animated.spring(y, { toValue: 0, stiffness: 220, damping: 24, mass: 1, useNativeDriver: true }).start();

  useEffect(() => {
    if (zichtbaar) {
      setGemount(true);
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      springNaarOpen();
    } else {
      Animated.timing(y, {
        toValue: schermH,
        duration: SHEET_SLUIT_MS,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setGemount(false);
      });
    }
  }, [zichtbaar, y, schermH]);

  // Sleep het handvat naar beneden om te sluiten. Alleen omlaag (dy > 0); voorbij 120px of
  // met vaart (vy > 0.6) → sluiten via onSluit (de effect-animatie maakt het af), anders terug.
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) =>
        sluitbaarRef.current && g.dy > 4 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_e, g) => {
        if (g.dy > 0) y.setValue(g.dy);
      },
      onPanResponderRelease: (_e, g) => {
        if (g.dy > 120 || g.vy > 0.6) sluitRef.current();
        else springNaarOpen();
      },
    }),
  ).current;

  // Scrim dimt mee met de sheet-positie: dicht (y = schermH) → transparant, open (y = 0) → vol.
  const scrimOpacity = y.interpolate({
    inputRange: [0, schermH],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const maxH: DimensionValue = maxHeight ?? '82%';

  return (
    <Modal
      transparent
      visible={gemount}
      animationType="none"
      onRequestClose={() => { if (sluitbaar) onSluit(); }}
      statusBarTranslucent
    >
      <View style={s.root}>
        <Animated.View style={[s.scrim, { opacity: scrimOpacity }]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onSluit}
            disabled={!sluitbaar}
            accessibilityRole="button"
            accessibilityLabel="Sluiten"
          />
        </Animated.View>
        {/* box-none: de KAV vult het scherm (nodig voor een juiste toetsenbordmeting),
            maar mag zelf geen tikken vangen — die horen bij de scrim eronder. */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={s.kav}
          pointerEvents="box-none"
        >
          <Animated.View style={[s.sheet, { maxHeight: maxH, transform: [{ translateY: y }] }]}>
            <View style={s.greepZone} {...pan.panHandlers}>
              <View style={s.greep} />
            </View>
            {children}
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.scrim },
  // De onderaan-uitlijning verhuisde van root naar de KAV: die schuift bij een open
  // toetsenbord z'n onderrand omhoog, en de sheet gaat mee.
  kav: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.bgApp,
    borderTopLeftRadius: radii.sheetTop,
    borderTopRightRadius: radii.sheetTop,
    ...shadow.sheet,
  },
  // Ruime sleepzone rond het handvat (makkelijk te pakken); vervangt de losse paddingTop.
  greepZone: { paddingTop: 10, paddingBottom: 8, alignItems: 'center' },
  greep: {
    width: 44,
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.hairline,
  },
});
