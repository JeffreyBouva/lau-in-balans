# Fase 2 — Klant-app (Expo): Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** De klant-app pixel-precies uit de design handoff bouwen (Expo/React Native), gekoppeld aan de echte gehoste Supabase: login, onboarding (schrijft profiel-v1), de drie hoofdschermen op live data, en de twee bottom sheets — zonder AI-antwoorden (die komen in fase 3).

**Architecture:** expo-router route-groepen (`(auth)`/`(onboarding)`/`(tabs)`) achter een sessie-gate. Kleine datahooks per domein bovenop `supabase-js` (geen globale store); realtime-subscription op `messages`. Styling met `StyleSheet` + de tokens uit `@lau/shared`, via een RN-tokenlaag met fontfamilies en tekststijlen. Eén herbruikbaar `Sheet`-component.

**Tech Stack:** Expo SDK 57 · expo-router · React 19 · @supabase/supabase-js · @expo-google-fonts/newsreader + dm-sans · @lau/shared (tokens/types/helpers) · vitest (logica-tests)

**Spec:** `docs/superpowers/specs/2026-07-30-fase-2-klant-app.md`
**Design (pixel-bron, leidend):** `design_handoff_lau_in_balans/README.md` (+ `Lau in Balans - v1.dc.html`).

---

## Werkwijze & conventies (lees eerst)

- **Cloud, geen Docker.** Data draait tegen de gehoste Supabase. Env voor de app staat in
  `apps/mobile/.env` (gitignored): `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY`
  (waarden uit de dashboard; dezelfde URL/anon-key als de repo-root `.env`, maar met de
  `EXPO_PUBLIC_`-prefix). Maak dit bestand eenmalig aan het begin (Task 1) uit `.env.example`.
- **Pixel-bron = de handoff.** Exacte maten/kleuren/copy/animaties staan in
  `design_handoff_lau_in_balans/README.md`. Neem hex-waarden/spacing NIET met de hand over —
  gebruik de tokens uit `@lau/shared` (`colors`, `radii`, `fonts`) en de RN-tekststijlen uit
  `apps/mobile/theme/tokens.ts` (Task 1). Waar de handoff een concrete waarde geeft die niet in
  de tokens zit (bijv. een specifieke padding), gebruik het getal uit de handoff.
- **Verificatie per scherm** gebeurt in de iOS-simulator (`npx expo run:ios` of Expo Go via
  `npx expo start`), visueel vergeleken met de handoff. Logica testen we met vitest.
- **Geen AI in fase 2.** Waar de handoff een AI-antwoord/typing-indicator na een actie toont:
  bouw de UI/opslag, maar sla het AI-antwoord over (commentaar `// fase 3: lau-reply`).
- **Componenten klein houden**: één verantwoordelijkheid per bestand. Een scherm componeert
  kleine bouwstenen uit `components/`.
- **Commit-trailer**: elke commit eindigt met een lege regel + `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Branch: `fase-2-klant-app` (al aangemaakt, bevat de spec-commit).

## File Structure (eindresultaat van fase 2)

```text
apps/mobile/
├── .env                          # EXPO_PUBLIC_SUPABASE_* (gitignored)
└── src/                          # expo-router-root = src/app; alias @/* → src/*
    ├── app/
    │   ├── _layout.tsx           # fonts laden + SessieProvider + routing-gate
    │   ├── (auth)/login.tsx
    │   ├── (onboarding)/_layout.tsx  # OnboardingProvider (stap-state)
    │   ├── (onboarding)/index.tsx    # de 8-staps flow (één scherm, stap-gestuurd)
    │   └── (tabs)/
    │       ├── _layout.tsx       # tabbar
    │       ├── vandaag.tsx
    │       ├── chat.tsx
    │       └── eten.tsx
    ├── lib/
    │   ├── supabase.ts           # bestaat (fase 1)
    │   ├── sessie.tsx            # SessieProvider, useSessie
    │   ├── datum.ts             # week-/dag-helpers (dun, hergebruikt @lau/shared)
    │   └── hooks/
    │       ├── useProfiel.ts
    │       ├── useVoedingslogs.ts        # + dagstand-aggregatie + quick-row-mutatie
    │       ├── useVoedingslogs.reducer.ts # pure aggregatie (TDD)
    │       ├── useBerichten.ts   # messages + realtime + send
    │       └── useFlag.ts
    ├── components/               # naast de scaffold-componenten
    │   ├── Sheet.tsx             # scrim + lauSheet-animatie
    │   ├── PrimaireKnop.tsx · Chip.tsx · HandmaatStepper.tsx · SlotBalk.tsx
    │   ├── Bericht.tsx           # ai/me/log/laura bubbel
    │   └── LauraKnop.tsx · VoortgangsBalk.tsx
    ├── theme/
    │   └── tokens.ts             # re-export @lau/shared + RN font-map + text-stijlen + shadows
    └── state/
        ├── onboarding.ts         # onboarding-reducer + profiel-mapping (TDD)
        └── logSheet.ts           # log-sheet-draft-reducer (TDD)
```

> **Pad-conventie (belangrijk — de scaffold wijkt af van een kaal Expo-project):** de
> expo-router-root is **`apps/mobile/src/app/`**, en er is een alias **`@/*` → `src/*`**. Alle
> app-code staat onder `src/` (fase 1's `lib/` en fase-2's `theme/` zijn hierheen verplaatst).
> **Importeer app-intern altijd via de alias**, bv. `@/theme/tokens`, `@/lib/supabase`,
> `@/lib/sessie`, `@/lib/hooks/useBerichten`, `@/state/onboarding`, `@/components/PrimaireKnop` —
> niet met relatieve `../../`-paden. De codeblokken hieronder tonen soms nog relatieve imports;
> gebruik in plaats daarvan de `@/`-alias.

Nieuwe app-dependencies (via `npx expo install` waar mogelijk): `@expo-google-fonts/newsreader`,
`@expo-google-fonts/dm-sans`, `expo-font`, `@react-native-async-storage/async-storage` (staat al).

---

### Task 1: Tokenlaag, fonts & env

**Files:**

- Create: `apps/mobile/.env` (uit `.env.example`), `apps/mobile/theme/tokens.ts`
- Modify: `apps/mobile/app/_layout.tsx` (fonts laden)

- [ ] **Step 1: Env + font-dependencies**

Run:
```bash
cp apps/mobile/.env.example apps/mobile/.env
# vul EXPO_PUBLIC_SUPABASE_URL + EXPO_PUBLIC_SUPABASE_ANON_KEY in (uit de repo-root .env,
# zelfde waarden; anon = de sb_publishable_ key). NIET de service-role key.
cd apps/mobile && npx expo install @expo-google-fonts/newsreader @expo-google-fonts/dm-sans expo-font && cd ../..
```
Expected: dependencies geïnstalleerd, SDK-compatibel; `.env` bestaat met de EXPO_PUBLIC_-waarden.

- [ ] **Step 2: Schrijf `apps/mobile/theme/tokens.ts`**

```ts
import { StyleSheet } from 'react-native';
import { colors, radii, fonts } from '@lau/shared';

export { colors, radii };

// RN heeft de exacte font-namen per gewicht nodig (Google-Fonts-pakketten).
export const fontFamily = {
  serif: 'Newsreader_400Regular',
  serifLight: 'Newsreader_300Light',
  serifMedium: 'Newsreader_500Medium',
  sans: 'DMSans_400Regular',
  sansLight: 'DMSans_300Light',
  sansMedium: 'DMSans_500Medium',
} as const;

// Tekststijlen uit de handoff-typografieschaal (Newsreader = serif, DM Sans = sans).
export const text = StyleSheet.create({
  onboardingHero: { fontFamily: fontFamily.serif, fontSize: 34, lineHeight: 41, letterSpacing: -0.5, color: colors.ink },
  schermTitel: { fontFamily: fontFamily.serif, fontSize: 28, lineHeight: 34, letterSpacing: -0.3, color: colors.ink },
  sheetTitel: { fontFamily: fontFamily.serif, fontSize: 26, lineHeight: 31, letterSpacing: -0.26, color: colors.ink },
  chatNaam: { fontFamily: fontFamily.serif, fontSize: 19, color: colors.ink },
  uitspraak: { fontFamily: fontFamily.serif, fontSize: 21, lineHeight: 29, color: colors.sageInk },
  bodyGroot: { fontFamily: fontFamily.sans, fontSize: 16, lineHeight: 26, color: colors.body },
  body: { fontFamily: fontFamily.sans, fontSize: 15, lineHeight: 23, color: colors.body },
  bodyKlein: { fontFamily: fontFamily.sans, fontSize: 14, lineHeight: 21, color: colors.bodySoft },
  label: { fontFamily: fontFamily.sans, fontSize: 13, lineHeight: 20, color: colors.muted },
  caption: { fontFamily: fontFamily.sans, fontSize: 12, lineHeight: 18, color: colors.muted },
  eyebrow: { fontFamily: fontFamily.sansMedium, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.mutedSofter },
});

export const shadow = {
  telefoon: { shadowColor: '#262A24', shadowOpacity: 0.35, shadowRadius: 30, shadowOffset: { width: 0, height: 24 } },
  tabActief: { shadowColor: '#262A24', shadowOpacity: 0.25, shadowRadius: 5, shadowOffset: { width: 0, height: 2 } },
  sheet: { shadowColor: '#262A24', shadowOpacity: 0.4, shadowRadius: 25, shadowOffset: { width: 0, height: -20 } },
} as const;
```

(De exacte tekstschaal staat in de handoff onder "Typografie"; bovenstaande dekt de gebruikte
rollen. Voeg een rol toe zodra een scherm er één nodig heeft die hier nog niet staat.)

- [ ] **Step 3: Fonts laden in `apps/mobile/app/_layout.tsx`**

Vervang de inhoud van het gegenereerde root-layout door een versie die de fonts laadt en de
splash vasthoudt tot ze klaar zijn (SessieProvider komt in Task 2 — nu alleen fonts + Stack):

```tsx
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
```

- [ ] **Step 4: Verifieer**

Run: `npm run typecheck -w apps/mobile` (PASS) en `cd apps/mobile && npx expo export --platform ios --output-dir /tmp/f2-export && cd ../.. && rm -rf /tmp/f2-export` (bundelt zonder errors).
Open daarna de simulator (`cd apps/mobile && npx expo start` → `i`) en bevestig dat de app start met de fonts geladen (de standaard expo-router-startpagina, nu in de geladen fonts).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/theme apps/mobile/app/_layout.tsx apps/mobile/package.json package-lock.json
git commit -m "feat(mobile): tokenlaag + Google Fonts (Newsreader/DM Sans) geladen in root-layout"
```

---

### Task 2: Sessie-provider & routing-gate

**Files:**

- Create: `apps/mobile/lib/sessie.tsx`
- Modify: `apps/mobile/app/_layout.tsx` (SessieProvider + gate), `apps/mobile/app/(auth)/login.tsx` (placeholder), `apps/mobile/app/(tabs)/_layout.tsx` (placeholder)

- [ ] **Step 1: Schrijf `apps/mobile/lib/sessie.tsx`**

```tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

type SessieContext = {
  session: Session | null;
  clientId: string | null;
  laden: boolean;
  login: (email: string, wachtwoord: string) => Promise<{ error: string | null }>;
  logout: () => Promise<void>;
};

const Ctx = createContext<SessieContext | null>(null);

export function SessieProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [laden, setLaden] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLaden(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  async function login(email: string, wachtwoord: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password: wachtwoord });
    return { error: error ? 'Inloggen lukte niet. Controleer je e-mail en wachtwoord.' : null };
  }
  async function logout() {
    await supabase.auth.signOut();
  }

  return (
    <Ctx.Provider value={{ session, clientId: session?.user.id ?? null, laden, login, logout }}>
      {children}
    </Ctx.Provider>
  );
}

export function useSessie() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSessie buiten SessieProvider');
  return v;
}
```

- [ ] **Step 2: Routing-gate in `apps/mobile/app/_layout.tsx`**

Breid het root-layout uit: wikkel in `SessieProvider` en stuur op basis van sessie + profiel-
bestaan naar `(auth)`, `(onboarding)` of `(tabs)`. Gebruik een binnen-component zodat `useSessie`
onder de provider hangt:

```tsx
// ... imports uit Task 1, plus:
import { useRouter, useSegments } from 'expo-router';
import { SessieProvider, useSessie } from '../lib/sessie';
import { supabase } from '../lib/supabase';
import { useState } from 'react';

function Gate() {
  const { session, clientId, laden } = useSessie();
  const [heeftProfiel, setHeeftProfiel] = useState<boolean | null>(null);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (!clientId) { setHeeftProfiel(null); return; }
    supabase.from('ai_profile_versions').select('id').limit(1)
      .then(({ data }) => setHeeftProfiel((data?.length ?? 0) > 0)); // klant ziet eigen v1? nee → coach-only
  }, [clientId]);

  useEffect(() => {
    if (laden) return;
    const groep = segments[0];
    if (!session) { if (groep !== '(auth)') router.replace('/(auth)/login'); return; }
    if (heeftProfiel === null) return; // nog aan het bepalen
    if (!heeftProfiel && groep !== '(onboarding)') { router.replace('/(onboarding)'); return; }
    if (heeftProfiel && (groep === '(auth)' || groep === '(onboarding)')) router.replace('/(tabs)/chat');
  }, [session, heeftProfiel, laden, segments]);

  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  const [fontsReady] = useFonts({ /* ...zoals Task 1... */ });
  useEffect(() => { if (fontsReady) SplashScreen.hideAsync(); }, [fontsReady]);
  if (!fontsReady) return null;
  return <SessieProvider><Gate /></SessieProvider>;
}
```

> **Let op — profiel-detectie:** de klant mag zijn eigen `ai_profile_versions` **niet** lezen
> (coach-only, RLS). `select` geeft dus altijd leeg terug en `heeftProfiel` zou altijd `false`
> zijn → iedereen belandt in onboarding. Dat is fout. **Fix in Step 3.**

- [ ] **Step 3: Profiel-detectie via een RPC (klant mag "heb ik een profiel?" wél weten)**

Maak een `security definer`-RPC die enkel een boolean teruggeeft, zonder profielinhoud te lekken.
Voeg een migratie toe (cloud, via `supabase db push` — vraag Jeffrey dit te draaien, net als in
fase 1; geen lokale Docker):

`supabase/migrations/<ts>_heeft_profiel.sql`:
```sql
create or replace function public.klant_heeft_profiel()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.ai_profile_versions v
    where v.client_id = auth.uid()
  );
$$;
revoke execute on function public.klant_heeft_profiel() from public, anon;
grant execute on function public.klant_heeft_profiel() to authenticated;
```
En in de Gate, vervang de directe select door:
```tsx
supabase.rpc('klant_heeft_profiel').then(({ data }) => setHeeftProfiel(data === true));
```

> De migratie moet vóór het testen op de cloud staan. Instructie voor de uitvoerder: lever de
> migratie aan Jeffrey met `supabase db push` (zoals fase 1). Tot die er is, kan de gate niet
> volledig getest worden — bouw wel alvast de rest.

- [ ] **Step 4: Placeholders zodat de routes bestaan**

`apps/mobile/app/(auth)/login.tsx`, `apps/mobile/app/(onboarding)/index.tsx`,
`apps/mobile/app/(tabs)/_layout.tsx` + `.../(tabs)/chat.tsx`: minimale schermen (een `View` met
een `Text` "…") zodat expo-router de groepen kent. Deze worden in latere tasks ingevuld.

- [ ] **Step 5: Verifieer + commit**

Run: `npm run typecheck -w apps/mobile` (PASS). Simulator: zonder sessie → login-placeholder.
```bash
git add apps/mobile/lib/sessie.tsx apps/mobile/app supabase/migrations
git commit -m "feat(mobile): sessie-provider + routing-gate + klant_heeft_profiel-RPC"
```

---

### Task 3: Login-scherm

**Files:**

- Modify: `apps/mobile/app/(auth)/login.tsx`
- Create: `apps/mobile/components/PrimaireKnop.tsx`

- [ ] **Step 1: `PrimaireKnop.tsx`** (herbruikbaar; sage, hoogte 52, radius 999, hover→pressed)

```tsx
import { Pressable, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { colors, radii, fontFamily } from '../theme/tokens';

export function PrimaireKnop({ label, onPress, bezig }: { label: string; onPress: () => void; bezig?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={bezig}
      style={({ pressed }) => [s.knop, pressed && { backgroundColor: colors.sageHover }]}>
      {bezig ? <ActivityIndicator color="#fff" /> : <Text style={s.label}>{label}</Text>}
    </Pressable>
  );
}
const s = StyleSheet.create({
  knop: { height: 52, borderRadius: radii.pill, backgroundColor: colors.sage, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: fontFamily.sans, fontSize: 16, color: '#fff' },
});
```

- [ ] **Step 2: Loginscherm** (sober, huisstijl; niet in de handoff — zie spec "Login")

Bouw `login.tsx`: `bg/app`-achtergrond, merknaam "Lau in Balans" (serif, sage), een korte regel,
twee inputs (e-mail/wachtwoord, stijl als de onboarding-input: rand `hairline-soft`, radius 14,
wit), de `PrimaireKnop` "Inloggen", en een foutregel (`text/muted-soft`) bij een mislukte login.
Gebruik `useSessie().login`; bij succes doet de gate de rest. Toon een `bezig`-state op de knop.

```tsx
import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useSessie } from '../../lib/sessie';
import { PrimaireKnop } from '../../components/PrimaireKnop';
import { colors, radii, fontFamily, text } from '../../theme/tokens';

export default function Login() {
  const { login } = useSessie();
  const [email, setEmail] = useState('');
  const [ww, setWw] = useState('');
  const [fout, setFout] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);

  async function probeer() {
    setBezig(true); setFout(null);
    const { error } = await login(email.trim(), ww);
    setBezig(false);
    if (error) setFout(error);
  }
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.root}>
      <View style={s.inner}>
        <Text style={s.merk}>Lau in Balans</Text>
        <Text style={[text.bodyGroot, { marginBottom: 24 }]}>Welkom terug. Log in om verder te gaan.</Text>
        <TextInput style={s.input} placeholder="E-mail" autoCapitalize="none" keyboardType="email-address"
          value={email} onChangeText={setEmail} placeholderTextColor={colors.mutedSoft} />
        <TextInput style={s.input} placeholder="Wachtwoord" secureTextEntry
          value={ww} onChangeText={setWw} placeholderTextColor={colors.mutedSoft} />
        {fout && <Text style={[text.bodyKlein, { color: colors.clayInk, marginBottom: 8 }]}>{fout}</Text>}
        <PrimaireKnop label="Inloggen" onPress={probeer} bezig={bezig} />
      </View>
    </KeyboardAvoidingView>
  );
}
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgApp, justifyContent: 'center' },
  inner: { padding: 26 },
  merk: { fontFamily: fontFamily.serif, fontSize: 22, color: colors.sage, letterSpacing: 0.4, marginBottom: 8 },
  input: { padding: 14, borderWidth: 1, borderColor: colors.hairlineSoft, borderRadius: radii.input, backgroundColor: colors.bgSurface, fontFamily: fontFamily.sans, fontSize: 15, marginBottom: 12, color: colors.ink },
});
```

- [ ] **Step 3: Verifieer** (simulator): log in als `sanne@demo.lauinbalans.nl` / `demo-demo-2026`
  → gate stuurt door (naar `(tabs)/chat`-placeholder als de RPC-migratie staat; anders naar
  onboarding — noteer dat de RPC-migratie nodig is). Foute inlog → nette foutregel.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/(auth)/login.tsx apps/mobile/components/PrimaireKnop.tsx
git commit -m "feat(mobile): loginscherm + PrimaireKnop"
```

---

### Task 4: Onboarding (8 stappen) + profiel-v1

**Files:**

- Create: `apps/mobile/state/onboarding.ts` (+ `.test.ts`), `apps/mobile/components/Chip.tsx`
- Modify: `apps/mobile/app/(onboarding)/_layout.tsx`, `apps/mobile/app/(onboarding)/index.tsx`

- [ ] **Step 1 (TDD): onboarding-state + profiel-mapping — schrijf de test eerst**

`apps/mobile/state/onboarding.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { legeOnboarding, naarProfiel } from './onboarding';
import { PORTIE_DOEL_DEFAULT } from '@lau/shared';

describe('naarProfiel', () => {
  it('mapt onboarding-antwoorden naar een AIProfile met defaults', () => {
    const ob = { ...legeOnboarding(), doelen: ['Duurzaam afvallen'], voorkeuren: ['Vegetarisch'], beperkingen: ['Noten-allergie'], veiligheid: 'soms' as const };
    const p = naarProfiel(ob);
    expect(p.doelen).toEqual(['Duurzaam afvallen']);
    expect(p.voorkeuren).toEqual(['Vegetarisch']);
    expect(p.beperkingen).toEqual(['Noten-allergie']);
    expect(p.veiligheidsvlag).toBe('soms');
    expect(p.portiedoelen).toEqual(PORTIE_DOEL_DEFAULT);
    expect(p.knelpunten).toEqual([]);
    expect(typeof p.aanpak).toBe('string');
  });
  it('default-veiligheidsvlag is "overgeslagen" als niets gekozen', () => {
    expect(naarProfiel(legeOnboarding()).veiligheidsvlag).toBe('overgeslagen');
  });
});
```

- [ ] **Step 2: Run → FAIL** (`npx vitest run apps/mobile/state`). Expected: module bestaat niet.

- [ ] **Step 3: Implementeer `apps/mobile/state/onboarding.ts`**

```ts
import type { AIProfile, Veiligheidsvlag } from '@lau/shared';
import { PORTIE_DOEL_DEFAULT } from '@lau/shared';

export type OnboardingState = {
  doelen: string[]; weekvorm: string[]; voorkeuren: string[]; beperkingen: string[];
  afkeer: string; extra: string; veiligheid: Veiligheidsvlag | null;
};

export function legeOnboarding(): OnboardingState {
  return { doelen: ['Duurzaam afvallen'], weekvorm: [], voorkeuren: [], beperkingen: [], afkeer: '', extra: '', veiligheid: null };
}

export function naarProfiel(ob: OnboardingState): AIProfile {
  return {
    doelen: ob.doelen,
    portiedoelen: { ...PORTIE_DOEL_DEFAULT },
    knelpunten: [],
    voorkeuren: ob.voorkeuren,
    beperkingen: ob.beperkingen,
    checkinRitme: [],
    aanpak: 'Geen calorieën tellen, geen weegmomenten. Focus op maaltijdstructuur en handmaten.',
    toon: 'Warm en direct. Korte berichten.',
    vermijdenInCoaching: ob.veiligheid === 'voorzichtig' ? 'Voorzichtig met lichaamsbeeld; niet openen met gewicht of getallen.' : '',
    veiligheidsvlag: ob.veiligheid ?? 'overgeslagen',
  };
}
```

- [ ] **Step 4: Run → PASS** (`npx vitest run apps/mobile/state`).

- [ ] **Step 5: `Chip.tsx`** (multi/single-select, stijl uit de handoff "Chip-stijl"):

```tsx
import { Pressable, Text, StyleSheet } from 'react-native';
import { colors, radii, fontFamily } from '../theme/tokens';

export function Chip({ label, actief, onPress }: { label: string; actief: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[s.chip, actief ? s.aan : s.uit]}>
      <Text style={[s.tekst, { color: actief ? colors.sageDeeper : colors.body }]}>{label}</Text>
    </Pressable>
  );
}
const s = StyleSheet.create({
  chip: { paddingVertical: 12, paddingHorizontal: 18, borderRadius: radii.pill, borderWidth: 1 },
  uit: { backgroundColor: colors.bgSurface, borderColor: colors.hairlineSoft },
  aan: { backgroundColor: colors.sageSoft, borderColor: colors.sage },
  tekst: { fontFamily: fontFamily.sans, fontSize: 14.5 },
});
```

- [ ] **Step 6: Bouw de 8-staps onboarding** in `(onboarding)/index.tsx` (state via `useReducer`/`useState`
  met `OnboardingState`). Header (merknaam + "Stap N van 7" + voortgangsbalk), body per stap
  (`lauFade`-achtige fade mag met `Animated`), footer (terug-knop vanaf stap 2 + primaire knop).
  De 8 stappen exact uit de handoff-tabel (§ "1. Onboarding — 8 stappen"): copy, chips, inputs,
  de veiligheidsvraag (stap 6, single-select + "overslaan"-link), en de afsluitstap.
  De `_layout.tsx` is een simpele `Stack` met `headerShown:false`.

- [ ] **Step 7: Profiel-v1 wegschrijven bij "Naar Lau" (stap 7)**

```ts
// in de handler van de laatste stap:
const profiel = naarProfiel(state);
const { error } = await supabase.from('ai_profile_versions').insert({
  client_id: clientId, versie: 1, author: null, profiel,
}); // geen .select() — klant mag v1 niet teruglezen (coach-only)
if (!error) router.replace('/(tabs)/chat');
```
> `author: null` + `versie: 1` is vereist door de `klant_schrijft_versie_1`-policy. Faalt de
> insert (bijv. de klant hééft al een profiel), stuur dan alsnog door naar de chat.

- [ ] **Step 8: Verifieer + commit**

Simulator: log in als een **profiel-loze** klant (bijv. maak in de seed/handmatig een test-klant,
of gebruik Noor als die geen profiel heeft) → doorloop onboarding → land op de chat; controleer
in de dashboard/DB dat er een `ai_profile_versions`-rij (versie 1) staat.
```bash
git add apps/mobile/state apps/mobile/components/Chip.tsx apps/mobile/app/(onboarding)
git commit -m "feat(mobile): onboarding (8 stappen) schrijft profiel-v1"
```

---

### Task 5: Datahooks (profiel/logs/berichten/flag)

**Files:**

- Create: `apps/mobile/lib/datum.ts`, `apps/mobile/lib/hooks/useVoedingslogs.reducer.ts` (+ `.test.ts`),
  `apps/mobile/lib/hooks/useProfiel.ts`, `useVoedingslogs.ts`, `useBerichten.ts`, `useFlag.ts`

- [ ] **Step 1: `lib/datum.ts`** (dunne wrappers rond `@lau/shared`)

```ts
import { weekNummer, naarISODatum, vandaagISO } from '@lau/shared';
export { weekNummer, naarISODatum, vandaagISO };
export function weekdagenTerug(n: number): string[] {
  // ISO-datums van (n-1) dagen geleden t/m vandaag, oud→nieuw.
  const uit: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    uit.push(naarISODatum(d));
  }
  return uit;
}
```

- [ ] **Step 2 (TDD): dagstand-aggregatie — test eerst**

`useVoedingslogs.reducer.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { dagStand, weekTotalen } from './useVoedingslogs.reducer';

const logs = [
  { datum: '2026-07-30', porties: { eiwit: 1, groente: 2, koolhydraten: 1, vet: 0 } },
  { datum: '2026-07-30', porties: { eiwit: 1, groente: 0, koolhydraten: 0, vet: 1 } },
  { datum: '2026-07-29', porties: { eiwit: 2, groente: 1, koolhydraten: 1, vet: 1 } },
];

describe('dagStand', () => {
  it('sommeert de porties van één dag', () => {
    expect(dagStand(logs, '2026-07-30')).toEqual({ eiwit: 2, groente: 2, koolhydraten: 1, vet: 1 });
  });
  it('geeft lege porties bij een dag zonder logs', () => {
    expect(dagStand(logs, '2026-07-28')).toEqual({ eiwit: 0, groente: 0, koolhydraten: 0, vet: 0 });
  });
});
describe('weekTotalen', () => {
  it('geeft per dag de som (eiwit) in dagvolgorde', () => {
    expect(weekTotalen(logs, ['2026-07-29', '2026-07-30'])).toEqual([
      { datum: '2026-07-29', porties: { eiwit: 2, groente: 1, koolhydraten: 1, vet: 1 } },
      { datum: '2026-07-30', porties: { eiwit: 2, groente: 2, koolhydraten: 1, vet: 1 } },
    ]);
  });
});
```

- [ ] **Step 3: Run → FAIL, dan implementeer `useVoedingslogs.reducer.ts`**

```ts
import type { Porties } from '@lau/shared';
import { dagTotaal } from '@lau/shared';

type Log = { datum: string; porties: Porties };

export function dagStand(logs: Log[], datum: string): Porties {
  return dagTotaal(logs.filter((l) => l.datum === datum));
}
export function weekTotalen(logs: Log[], datums: string[]): { datum: string; porties: Porties }[] {
  return datums.map((datum) => ({ datum, porties: dagStand(logs, datum) }));
}
```
Run → PASS (`npx vitest run apps/mobile/lib`).

- [ ] **Step 4: `useProfiel.ts`** — klant mag eigen profiel niet lezen, dus dit levert alleen de
  **portiedoelen** die de app nodig heeft, via een gerichte RPC. Voeg toe aan de heeft-profiel-
  migratie (of een nieuwe): een `security definer`-functie die uitsluitend de portiedoelen van de
  eigen actieve profielversie teruggeeft.

`supabase/migrations/<ts>_portiedoelen.sql`:
```sql
create or replace function public.mijn_portiedoelen()
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select v.profiel->'portiedoelen'
  from public.ai_profile_versions v
  where v.client_id = auth.uid()
  order by v.versie desc
  limit 1;
$$;
revoke execute on function public.mijn_portiedoelen() from public, anon;
grant execute on function public.mijn_portiedoelen() to authenticated;
```
```ts
// useProfiel.ts
import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { PORTIE_DOEL_DEFAULT, type Porties } from '@lau/shared';

export function usePortiedoelen(): Porties {
  const [doelen, setDoelen] = useState<Porties>(PORTIE_DOEL_DEFAULT);
  useEffect(() => {
    supabase.rpc('mijn_portiedoelen').then(({ data }) => { if (data) setDoelen(data as Porties); });
  }, []);
  return doelen;
}
```
> Deze migratie gaat mee met de `db push` van Task 2 (of een tweede). Lever ze samen aan Jeffrey.

- [ ] **Step 5: `useVoedingslogs.ts`** — leest de logs van de ingelogde klant (RLS filtert al op
  eigen `client_id`), levert dagstand + week, en biedt `pasQuickAan(handmaat, delta)` + `voegLogToe`.

```ts
import { useCallback, useEffect, useState } from 'react';
import type { HandKey, Porties, Moment } from '@lau/shared';
import { supabase } from '../supabase';
import { dagStand, weekTotalen } from './useVoedingslogs.reducer';
import { vandaagISO, weekdagenTerug } from '../datum';

type Row = { id: string; datum: string; moment: Moment; porties: Porties; bron: 'chat' | 'eten' };

export function useVoedingslogs(clientId: string) {
  const [rows, setRows] = useState<Row[]>([]);
  const laad = useCallback(async () => {
    const { data } = await supabase.from('food_logs').select('id, datum, moment, porties, bron')
      .gte('datum', weekdagenTerug(7)[0]);
    setRows((data as Row[]) ?? []);
  }, []);
  useEffect(() => { laad(); }, [laad]);

  const vandaag = vandaagISO();
  const dag = dagStand(rows, vandaag);
  const week = weekTotalen(rows, weekdagenTerug(7));

  // Quick-adjust: één 'eten'-bron dagrij (moment 'Tussendoor') die de steppers bezitten.
  const pasQuickAan = useCallback(async (handmaat: HandKey, delta: number) => {
    const quick = rows.find((r) => r.datum === vandaag && r.bron === 'eten' && r.moment === 'Tussendoor');
    if (quick) {
      const nieuw = { ...quick.porties, [handmaat]: Math.max(0, quick.porties[handmaat] + delta) };
      await supabase.from('food_logs').update({ porties: nieuw }).eq('id', quick.id);
    } else if (delta > 0) {
      await supabase.from('food_logs').insert({ client_id: clientId, datum: vandaag, moment: 'Tussendoor',
        porties: { eiwit: 0, groente: 0, koolhydraten: 0, vet: 0, [handmaat]: delta }, bron: 'eten' });
    }
    await laad();
  }, [rows, vandaag, clientId, laad]);

  const voegLogToe = useCallback(async (moment: Moment, porties: Porties) => {
    await supabase.from('food_logs').insert({ client_id: clientId, datum: vandaag, moment, porties, bron: 'chat' });
    await laad();
  }, [clientId, vandaag, laad]);

  return { dag, week, pasQuickAan, voegLogToe, herlaad: laad };
}
```
> **Model-keuze (de open vraag uit de spec, hier vastgelegd):** het Eten-scherm toont de dagsom
> (alle rijen van vandaag) en de steppers muteren één "quick"-rij (`bron:'eten'`,
> `moment:'Tussendoor'`). De log-sheet maakt aparte maaltijdrijen (`bron:'chat'`, gekozen moment).
> Beide tellen op in dagsom + weekkaart. De weergegeven stepper-waarde is de **dagsom** per
> handmaat; `−` klemt de quick-rij op 0 (kan de maaltijdbijdrage niet onder 0 duwen).

- [ ] **Step 6: `useBerichten.ts`** — messages + realtime + send (geen AI):

```ts
import { useCallback, useEffect, useState } from 'react';
import type { Sender } from '@lau/shared';
import { supabase } from '../supabase';

export type Bericht = { id: string; sender: Sender; tekst: string | null; food_log_id: string | null; created_at: string };

export function useBerichten(clientId: string) {
  const [berichten, setBerichten] = useState<Bericht[]>([]);
  useEffect(() => {
    supabase.from('messages').select('id, sender, tekst, food_log_id, created_at')
      .order('created_at', { ascending: true }).then(({ data }) => setBerichten((data as Bericht[]) ?? []));
    const kanaal = supabase.channel(`messages:${clientId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `client_id=eq.${clientId}` },
        (payload) => setBerichten((b) => [...b, payload.new as Bericht]))
      .subscribe();
    return () => { supabase.removeChannel(kanaal); };
  }, [clientId]);

  const verstuur = useCallback(async (tekst: string) => {
    await supabase.from('messages').insert({ client_id: clientId, sender: 'client', tekst });
    // fase 3: hierna lau-reply Edge Function → AI-antwoord + typing-indicator
  }, [clientId]);

  return { berichten, verstuur };
}
```

- [ ] **Step 7: `useFlag.ts`** — open flag + aanmaken:

```ts
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabase';

export function useFlag(clientId: string) {
  const [openFlag, setOpenFlag] = useState(false);
  const laad = useCallback(async () => {
    const { data } = await supabase.from('flags').select('id').eq('status', 'open').limit(1);
    setOpenFlag((data?.length ?? 0) > 0);
  }, []);
  useEffect(() => { laad(); }, [laad]);
  const maakFlag = useCallback(async (tekst: string, redenen: string[]) => {
    await supabase.from('flags').insert({ client_id: clientId, tekst, redenen, status: 'open' });
    await laad();
  }, [clientId, laad]);
  return { openFlag, maakFlag };
}
```

- [ ] **Step 8: Verifieer + commit**

Run: `npm run typecheck -w apps/mobile` (PASS) + `npx vitest run apps/mobile` (reducer-tests groen).
```bash
git add apps/mobile/lib supabase/migrations
git commit -m "feat(mobile): datahooks (profiel-RPC, logs+aggregatie, berichten+realtime, flag)"
```

---

### Task 6: Tabbar + Vandaag-scherm

**Files:**

- Create: `apps/mobile/components/LauraKnop.tsx`, `apps/mobile/components/VoortgangsBalk.tsx`
- Modify: `apps/mobile/app/(tabs)/_layout.tsx`, `apps/mobile/app/(tabs)/vandaag.tsx`

- [ ] **Step 1: Tabbar** in `(tabs)/_layout.tsx` — expo-router `Tabs` met een custom tabbar die de
  handoff volgt (§ "Tabbar"): drie pills Vandaag/Lau.ai/Eten, actief = wit + shadow `tabActief`,
  inactief = transparant + `text/muted`, gradient-achtergrond bovenlangs. Gebruik `tabBar`-prop
  voor een eigen component of style de default `Tabs` zo dicht mogelijk. Volgorde: vandaag, chat, eten.

- [ ] **Step 2: `LauraKnop.tsx`** (rechtsboven op elk hoofdscherm) — twee states (geen flag / flag
  verstuurd) exact uit de handoff § "Laura-knop"; `onPress` opent de Laura-sheet (Task 8). Neemt
  `openFlag: boolean` + `onPress`.

- [ ] **Step 3: `VoortgangsBalk.tsx`** — generieke balk (rail + fill), voor onboarding/voortgang.

- [ ] **Step 4: Vandaag-scherm** (`vandaag.tsx`) op echte data via `useVoedingslogs` +
  `useBerichten` + `usePortiedoelen` + `useSessie`. Bouw exact de handoff § "4. Vandaag":
  eyebrow "Week N" (via `weekNummer(startdatum, vandaagISO())` — haal `startdatum` mee; zie
  noot), hero-titel, contactkaart (7 dagen: contact = een bericht op die dag), "wat opvalt"-kaart
  (statische, afgeleide regel — géén AI, markeer `// fase 3`), eten-gemiddelden-kaart (weekgemiddelde
  per handmaat), "waar we aan werken" (statisch), afspraak-blok. LauraKnop rechtsboven.
  > **Noot startdatum/week:** de klant kan zijn eigen `clients`-rij lezen (RLS `klant_leest_zichzelf`),
  > dus `supabase.from('clients').select('startdatum, naam').single()` geeft naam + startdatum voor
  > week-berekening en aanhef.

- [ ] **Step 5: Verifieer** (simulator, ingelogd als Sanne): week 3, contactdagen en gemiddelden
  komen uit haar echte seed-data; layout vergeleken met de handoff.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/components apps/mobile/app/(tabs)
git commit -m "feat(mobile): tabbar + Vandaag-scherm op echte data"
```

---

### Task 7: Eten-scherm + Chat-scherm

**Files:**

- Create: `apps/mobile/components/HandmaatStepper.tsx`, `SlotBalk.tsx`, `Bericht.tsx`
- Modify: `apps/mobile/app/(tabs)/eten.tsx`, `apps/mobile/app/(tabs)/chat.tsx`

- [ ] **Step 1: `HandmaatStepper.tsx` + `SlotBalk.tsx`** exact uit de handoff § "3. Eten"
  (stepper 34×34 knoppen, teller "{n} / {doel}"; slotbalk met gevulde/lege slots, opacity .55
  boven doel). Kleuren per handmaat uit `HANDMATEN` (`@lau/shared`).

- [ ] **Step 2: Eten-scherm** (`eten.tsx`) via `useVoedingslogs` + `usePortiedoelen`: header,
  introregel, vier portiekaarten (stepper + slotbalk per handmaat; `+`/`−` → `pasQuickAan`),
  "Lau kijkt mee"-kaart (statische regel op basis van `dag`), weekkaart (`week`), uitleg-blok.
  LauraKnop rechtsboven. Handmaten/dagdoelen uit `HANDMATEN` + `usePortiedoelen`.

- [ ] **Step 3: `Bericht.tsx`** — de vier bubbeltypes (ai/me/log/laura) exact uit de handoff
  § "2. Chat" (uitlijning, radii, kleuren). Log-bubbel toont per portie een regel (marker + "N × {hand} {naam}").

- [ ] **Step 4: Chat-scherm** (`chat.tsx`) via `useBerichten` + `useFlag`: header (avatar "L" +
  "Lau.ai" + "Ingesteld door Laura · week N" + LauraKnop), berichtenlijst (autoscroll naar onder
  via `scrollToEnd` bij nieuwe berichten), disclaimerregel onderaan, quick-reply-rij (eerste chip
  "Ik heb gegeten" opent de log-sheet; de rest verstuurt die tekst als klant-bericht via
  `verstuur`), composer (input + verzendknop → `verstuur`). **Geen AI-antwoord** (commentaar
  `// fase 3: lau-reply`). Bij het versturen scrollt de lijst naar onder.

- [ ] **Step 5: Verifieer** (simulator, Sanne): haar transcript verschijnt; een bericht versturen
  slaat op en verschijnt (via realtime), zonder Lau-antwoord. Layout vs. handoff.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/components apps/mobile/app/(tabs)/eten.tsx apps/mobile/app/(tabs)/chat.tsx
git commit -m "feat(mobile): Eten- en Chat-scherm op echte data (zonder AI-antwoord)"
```

---

### Task 8: Bottom sheets (Eten loggen + Praat met Laura)

**Files:**

- Create: `apps/mobile/components/Sheet.tsx`, `apps/mobile/state/logSheet.ts` (+ `.test.ts`)
- Modify: `apps/mobile/app/(tabs)/chat.tsx` + de schermen die de sheets openen

- [ ] **Step 1: `Sheet.tsx`** — herbruikbaar bottom-sheet: scrim (`overlay/scrim`, `blur`),
  sheet `radius 30 30 0 0`, `lauSheet`-animatie (`.34s cubic-bezier(.22,.8,.3,1)` → `Animated`
  met een matchende easing), greep-balkje, sluiten via scrim-tik. Props: `zichtbaar`, `onSluit`,
  `children`, optioneel `maxHeight`.

- [ ] **Step 2 (TDD): log-sheet-draft-reducer** — test eerst.

`apps/mobile/state/logSheet.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { legeDraft, pas, heeftIets } from './logSheet';

describe('logSheet-draft', () => {
  it('start op 1/1/1/0 met moment Avondeten', () => {
    const d = legeDraft();
    expect(d.porties).toEqual({ eiwit: 1, groente: 1, koolhydraten: 1, vet: 0 });
    expect(d.moment).toBe('Avondeten');
  });
  it('past een handmaat aan en klemt op 0', () => {
    expect(pas(legeDraft(), 'vet', -1).porties.vet).toBe(0);
    expect(pas(legeDraft(), 'eiwit', 1).porties.eiwit).toBe(2);
  });
  it('heeftIets is false bij alles 0', () => {
    expect(heeftIets({ moment: 'Lunch', porties: { eiwit: 0, groente: 0, koolhydraten: 0, vet: 0 } })).toBe(false);
  });
});
```

- [ ] **Step 3: Run → FAIL, implementeer `apps/mobile/state/logSheet.ts`**

```ts
import type { HandKey, Moment, Porties } from '@lau/shared';

export type Draft = { moment: Moment; porties: Porties };
export function legeDraft(): Draft { return { moment: 'Avondeten', porties: { eiwit: 1, groente: 1, koolhydraten: 1, vet: 0 } }; }
export function pas(d: Draft, h: HandKey, delta: number): Draft {
  return { ...d, porties: { ...d.porties, [h]: Math.max(0, d.porties[h] + delta) } };
}
export function heeftIets(d: Draft): boolean {
  return Object.values(d.porties).some((n) => n > 0);
}
```
Run → PASS.

- [ ] **Step 4: Eten-loggen-sheet** — inhoud uit de handoff § "5": titel, moment-keuze (4 knoppen),
  vier stepper-rijen (`Draft` via `pas`), acties "Later"/"Bewaren". "Bewaren" (bij `heeftIets`):
  `voegLogToe(draft.moment, draft.porties)` → sluit → navigeer naar chat waar de log-bubbel
  verschijnt (via realtime/reload). **Geen AI-reactie** (`// fase 3`). Draft reset naar 1/1/1/0.
  Getriggerd door de "Ik heb gegeten"-chip in de chat.

- [ ] **Step 5: Praat-met-Laura-sheet** — inhoud uit de handoff § "6": idle-state (Laura-avatar,
  alinea, textarea, redenchips, primaire knop) → `maakFlag(tekst, redenen)` → sent-state
  (✓, bevestiging, "terug naar Lau"). Na versturen toont de LauraKnop op alle schermen de
  "verstuurd"-status (via `useFlag().openFlag`). Openbaar vanaf elk hoofdscherm via de LauraKnop.

- [ ] **Step 6: Verifieer** (simulator, Sanne): "Ik heb gegeten" → sheet → Bewaren → log in de
  chat + dagstand op Eten omhoog. Laura-sheet → versturen → knop-status om (bolletje). Beide
  sheets: scrim-tik sluit, animatie klopt.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/components/Sheet.tsx apps/mobile/state/logSheet.ts apps/mobile/state/logSheet.test.ts apps/mobile/app
git commit -m "feat(mobile): bottom sheets — Eten loggen + Praat met Laura (echte writes)"
```

---

### Task 9: Open-states-lijst + eindverificatie fase 2

**Files:**

- Create: `docs/superpowers/open-design-questions.md`

- [ ] **Step 1: Documenteer de sober ingevulde, nog-te-ontwerpen onderdelen**

Schrijf `docs/superpowers/open-design-questions.md` met de defaults die we zelf maakten en die de
designer nog mag aanscherpen: **loginscherm** (hele scherm), **loading/skeleton-states**,
**lege staten** (chat zonder berichten, week zonder logs, nieuwe klant), **foutmeldingen**,
**offline-banner**, en de **voedingslog-dagstand-mapping** (quick-rij-keuze). Per item: waar het
zit, wat we nu doen, en de vraag aan de designer.

- [ ] **Step 2: Volledige verificatie**

Run: `npm run verify` (typecheck alle workspaces + alle unit-tests groen, incl. de nieuwe
mobile-reducers) en `npm run test:rls` (14/14 — ongewijzigd). Bevestig in de simulator de hele
flow: login → (nieuwe klant) onboarding → tabs; Sanne → tabs met haar data; loggen; flaggen.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/open-design-questions.md
git commit -m "docs: open-design-questions (sober ingevulde states) + fase-2 eindverificatie"
```

**Definition of done fase 2:** login werkt op de cloud; een profiel-loze klant doorloopt
onboarding en krijgt een profiel-v1; Sanne ziet haar echte data op alle drie de schermen; loggen
en flaggen schrijven echt weg en updaten de UI; `npm run verify` + `npm run test:rls` groen; alle
schermen visueel gelijk aan de handoff (op de bewust-open states na). Geen AI-antwoorden (fase 3).
