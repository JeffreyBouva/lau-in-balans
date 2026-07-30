import { useFonts, Newsreader_300Light, Newsreader_400Regular, Newsreader_500Medium } from '@expo-google-fonts/newsreader';
import { DMSans_300Light, DMSans_400Regular, DMSans_500Medium } from '@expo-google-fonts/dm-sans';
import { SplashScreen, Stack } from 'expo-router';
import { useEffect } from 'react';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsReady] = useFonts({
    Newsreader_300Light, Newsreader_400Regular, Newsreader_500Medium,
    DMSans_300Light, DMSans_400Regular, DMSans_500Medium,
  });
  useEffect(() => {
    if (fontsReady) SplashScreen.hideAsync();
  }, [fontsReady]);
  if (!fontsReady) return null;
  return <Stack screenOptions={{ headerShown: false }} />;
}
