import { useFonts, Newsreader_300Light, Newsreader_400Regular, Newsreader_500Medium } from '@expo-google-fonts/newsreader';
import { DMSans_300Light, DMSans_400Regular, DMSans_500Medium } from '@expo-google-fonts/dm-sans';
import { SplashScreen, Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { SessieProvider, useSessie } from '@/lib/sessie';

SplashScreen.preventAutoHideAsync();

function Gate() {
  const { session, laden, heeftProfiel } = useSessie();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (laden) return;
    const groep = segments[0];
    if (!session) { if (groep !== '(auth)') router.replace('/(auth)/welkom'); return; }
    if (heeftProfiel === null) return;
    if (!heeftProfiel && groep !== '(onboarding)') { router.replace('/(onboarding)'); return; }
    if (heeftProfiel && (groep === '(auth)' || groep === '(onboarding)')) router.replace('/(tabs)/chat');
  }, [session, heeftProfiel, laden, segments, router]);

  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  const [fontsReady] = useFonts({
    Newsreader_300Light, Newsreader_400Regular, Newsreader_500Medium,
    DMSans_300Light, DMSans_400Regular, DMSans_500Medium,
  });
  useEffect(() => { if (fontsReady) SplashScreen.hideAsync(); }, [fontsReady]);
  if (!fontsReady) return null;
  return <SessieProvider><Gate /></SessieProvider>;
}
