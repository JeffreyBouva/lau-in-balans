import { Tabs } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radii, fontFamily, shadow } from '@/theme/tokens';
import { SheetsProvider } from '@/lib/sheets';

// Volgorde en labels van de tabbar (handoff § Tabbar). Routes: vandaag, chat, eten.
const TABS = [
  { route: 'vandaag', label: 'Vandaag' },
  { route: 'chat', label: 'Lau.ai' },
  { route: 'eten', label: 'Eten' },
] as const;

/**
 * Custom tabbar (handoff § Tabbar): absoluut onderaan met een fade-gradient, drie
 * pillen die elk flex:1 vullen. Actief = witte pil + shadow.tabActief + ink-tekst.
 */
function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <LinearGradient
      // linear-gradient(to top, #F6F3ED 65%, rgba(246,243,237,0)) — onder solide, boven fade
      colors={['rgba(246,243,237,0)', colors.bgApp, colors.bgApp]}
      locations={[0, 0.35, 1]}
      style={[s.balk, { paddingBottom: 22 + insets.bottom }]}
    >
      {TABS.map((tab) => {
        const index = state.routes.findIndex((r) => r.name === tab.route);
        const actief = state.index === index;
        return (
          <Pressable
            key={tab.route}
            onPress={() => {
              const route = state.routes[index];
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!actief && !event.defaultPrevented) navigation.navigate(route.name);
            }}
            style={[s.tab, actief && s.tabActief]}
          >
            <Text style={[s.label, { color: actief ? colors.ink : colors.muted }]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </LinearGradient>
  );
}

export default function TabsLayout() {
  return (
    <SheetsProvider>
      <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
        <Tabs.Screen name="vandaag" />
        <Tabs.Screen name="chat" />
        <Tabs.Screen name="eten" />
      </Tabs>
    </SheetsProvider>
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
    paddingTop: 12,
    paddingHorizontal: 22,
  },
  tab: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActief: { backgroundColor: colors.bgSurface, ...shadow.tabActief },
  label: { fontFamily: fontFamily.sans, fontSize: 13 },
});
