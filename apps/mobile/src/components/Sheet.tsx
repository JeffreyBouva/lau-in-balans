import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  View,
  type DimensionValue,
} from 'react-native';
import { colors, radii, shadow } from '@/theme/tokens';

/**
 * Herbruikbare bottom-sheet (handoff § 5). Scrim-tik sluit; de sheet-body vangt
 * de tik zelf op (zit als broer bóven de scrim). Slide-up via `Animated.timing`
 * met een easing die `cubic-bezier(.22,.8,.3,1)` benadert over ~340ms. De Modal
 * blijft gemount tijdens de sluit-animatie en verdwijnt pas als die klaar is.
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
      Animated.timing(y, {
        toValue: 0,
        duration: 340,
        easing: Easing.bezier(0.22, 0.8, 0.3, 1),
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(y, {
        toValue: schermH,
        duration: 340,
        easing: Easing.bezier(0.22, 0.8, 0.3, 1),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setGemount(false);
      });
    }
  }, [zichtbaar, y, schermH]);

  const maxH: DimensionValue = maxHeight ?? '82%';

  return (
    <Modal transparent visible={gemount} animationType="none" onRequestClose={onSluit}>
      <View style={s.root}>
        <Pressable style={s.scrim} onPress={onSluit} accessibilityLabel="Sluiten" />
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
