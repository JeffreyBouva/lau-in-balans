import { Tabs } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, Text, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, fontFamily, shadow } from '@/theme/tokens';
import { SheetsProvider } from '@/lib/sheets';
import { KlantDataProvider } from '@/lib/klantdata';
import { useSessie } from '@/lib/sessie';

type IonName = keyof typeof Ionicons.glyphMap;

// Volgorde, labels én iconen van de tabbar (handoff § Tabbar). Routes: vandaag, chat, eten.
// Outline = inactief, gevuld = actief (iOS-conventie).
const TABS: { route: string; label: string; icon: IonName; iconActief: IonName }[] = [
  { route: 'vandaag', label: 'Vandaag', icon: 'today-outline', iconActief: 'today' },
  { route: 'chat', label: 'Lau.ai', icon: 'chatbubbles-outline', iconActief: 'chatbubbles' },
  { route: 'eten', label: 'Eten', icon: 'restaurant-outline', iconActief: 'restaurant' },
];

/**
 * Custom tabbar: translucent blur-balk (iOS-gevoel) met een haarlijn bovenaan en de
 * brand-cream als fallback wanneer blur niet ondersteund wordt (web). Drie pillen met
 * icoon + label; actief = witte pil + shadow.tabActief + ink. Tikken geeft een taptic
 * (selectionAsync) op toestellen — no-op op web.
 */
function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <BlurView intensity={32} tint="light" style={[s.balk, { paddingBottom: 8 + insets.bottom }]}>
      {TABS.map((tab) => {
        const index = state.routes.findIndex((r) => r.name === tab.route);
        const actief = state.index === index;
        return (
          <Pressable
            key={tab.route}
            onPress={() => {
              const route = state.routes[index];
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!actief && !event.defaultPrevented) {
                if (Platform.OS !== 'web') Haptics.selectionAsync();
                navigation.navigate(route.name);
              }
            }}
            style={[s.tab, actief && s.tabActief]}
          >
            <Ionicons name={actief ? tab.iconActief : tab.icon} size={22} color={actief ? colors.ink : colors.muted} />
            <Text style={[s.label, { color: actief ? colors.ink : colors.muted }]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </BlurView>
  );
}

export default function TabsLayout() {
  const { clientId } = useSessie();
  // Mid-logout kan clientId even null zijn; dan niets renderen (de gate stuurt weg).
  if (!clientId) return null;
  return (
    <KlantDataProvider clientId={clientId}>
      <SheetsProvider>
        <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
          <Tabs.Screen name="vandaag" />
          <Tabs.Screen name="chat" />
          <Tabs.Screen name="eten" />
        </Tabs>
      </SheetsProvider>
    </KlantDataProvider>
  );
}

const s = StyleSheet.create({
  balk: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: 8,
    paddingTop: 8,
    paddingHorizontal: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairlineSofter,
    backgroundColor: 'rgba(246,243,237,0.72)', // brand-cream fallback als blur niet rendert (web)
  },
  tab: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  tabActief: { backgroundColor: colors.bgSurface, ...shadow.tabActief },
  label: { fontFamily: fontFamily.sansMedium, fontSize: 11, letterSpacing: 0.1 },
});
