import { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { colors, radii } from '@/theme/tokens';

/**
 * Typing-indicator (handoff § 2): links, wit + rand hairlineSofter, radius 20/20/20/6,
 * drie 6px sage-bolletjes met de `lauDot`-animatie — een opacity-puls van 1.2s die
 * oneindig loopt, met .2s en .4s stagger tussen de bolletjes. Verschijnt onder de laatste
 * bubbel zolang Lau "typt" (wachtOpLau).
 */
function Bol({ delay }: { delay: number }) {
  const o = useRef(new Animated.Value(0.25)).current;
  useEffect(() => {
    // lauDot: 0%/60%/100% → .25, 30% → 1 (over 1.2s). Puls in de eerste 60%, dan rust.
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(o, { toValue: 1, duration: 360, useNativeDriver: true }),
        Animated.timing(o, { toValue: 0.25, duration: 360, useNativeDriver: true }),
        Animated.delay(480),
      ]),
    );
    const start = setTimeout(() => anim.start(), delay);
    return () => { clearTimeout(start); anim.stop(); };
  }, [o, delay]);
  return <Animated.View style={[s.bol, { opacity: o }]} />;
}

export function TypIndicator() {
  return (
    <View style={s.bubbel} accessibilityLabel="Lau.ai typt">
      <Bol delay={0} />
      <Bol delay={200} />
      <Bol delay={400} />
    </View>
  );
}

const s = StyleSheet.create({
  bubbel: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 14,
    paddingHorizontal: 18,
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.hairlineSofter,
    borderTopLeftRadius: radii.cardLg,
    borderTopRightRadius: radii.cardLg,
    borderBottomRightRadius: radii.cardLg,
    borderBottomLeftRadius: radii.bubbleTip,
  },
  bol: { width: 6, height: 6, borderRadius: radii.pill, backgroundColor: colors.sage },
});
