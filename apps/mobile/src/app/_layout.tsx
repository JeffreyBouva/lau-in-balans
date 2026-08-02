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

  // De splash blijft staan tot de sessie-check klaar is. Zou 'ie al weggaan zodra de
  // fonts er zijn (RootLayout), dan flitst welkom/login voorbij voordat de gate weet
  // waar een ingelogde gebruiker heen moet. Gate rendert pas als fontsReady, dus
  // !laden hier betekent: fonts én sessie rond.
  useEffect(() => { if (!laden) SplashScreen.hideAsync().catch(() => {}); }, [laden]);

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
  if (!fontsReady) return null; // splash verdwijnt in Gate, zodra ook de sessie bekend is
  return <SessieProvider><Gate /></SessieProvider>;
}
