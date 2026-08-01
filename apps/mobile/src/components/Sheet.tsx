import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type DimensionValue,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors, radii, shadow } from '@/theme/tokens';

/**
 * Herbruikbare bottom-sheet (handoff § 5). Scrim-tik sluit; de sheet-body vangt de tik
 * zelf op (zit als broer bóven de scrim). Openen: spring-up (subtiele iOS-settle) mét een
 * lichte haptic; de scrim fade't mee via een interpolatie op dezelfde y-waarde. Sluiten:
 * korte ease-in naar beneden. De Modal blijft gemount tot de sluit-animatie klaar is.
 */
export function Sheet({
  zichtbaar,
  onSluit,
  children,
  maxHeight,
}: {
  zichtbaar: boolean;
  onSluit: () => void;
  children: ReactNode;
  maxHeight?: number;
}) {
  const schermH = Dimensions.get('window').height;
  const y = useRef(new Animated.Value(schermH)).current;
  const [gemount, setGemount] = useState(zichtbaar);

  useEffect(() => {
    if (zichtbaar) {
      setGemount(true);
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      Animated.spring(y, {
        toValue: 0,
        stiffness: 220,
        damping: 24,
        mass: 1,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(y, {
        toValue: schermH,
        duration: 240,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setGemount(false);
      });
    }
  }, [zichtbaar, y, schermH]);

  // Scrim dimt mee met de sheet-positie: dicht (y = schermH) → transparant, open (y = 0) → vol.
  const scrimOpacity = y.interpolate({
    inputRange: [0, schermH],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const maxH: DimensionValue = maxHeight ?? '82%';

  return (
    <Modal transparent visible={gemount} animationType="none" onRequestClose={onSluit} statusBarTranslucent>
      <View style={s.root}>
        <Animated.View style={[s.scrim, { opacity: scrimOpacity }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onSluit} accessibilityLabel="Sluiten" />
        </Animated.View>
        <Animated.View style={[s.sheet, { maxHeight: maxH, transform: [{ translateY: y }] }]}>
          <View style={s.greep} />
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.scrim },
  sheet: {
    backgroundColor: colors.bgApp,
    borderTopLeftRadius: radii.sheetTop,
    borderTopRightRadius: radii.sheetTop,
    paddingTop: 10,
    ...shadow.sheet,
  },
  greep: {
    width: 44,
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.hairline,
    alignSelf: 'center',
    marginBottom: 6,
  },
});
