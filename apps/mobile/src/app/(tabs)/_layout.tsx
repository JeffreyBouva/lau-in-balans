import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="chat" options={{ title: 'Chat' }} />
      <Tabs.Screen name="vandaag" options={{ title: 'Vandaag' }} />
      <Tabs.Screen name="eten" options={{ title: 'Eten' }} />
    </Tabs>
  );
}
