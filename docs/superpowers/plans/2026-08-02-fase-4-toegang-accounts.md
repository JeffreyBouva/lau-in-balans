# Fase 4 — Toegang & accounts — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publieke app met twee tiers — free (voeding loggen) en coached (alles, via 6-teken code) — met registratie (e-mail + Google, Apple achter vlag), server-side enforcement en zichtbaar-op-slot UI.

**Architectuur:** Migratie voegt `clients.tier`, `invite_codes`, `app_config` en RPC's toe; een trigger op `auth.users` maakt automatisch een clients-rij. `lau-reply` weigert free. De app krijgt welkom/registreer/code-schermen, tier in de SessieProvider en een herbruikbare SlotKaart/CodeSheet.

**Tech stack:** Supabase (gehost, `supabase db push` — NOOIT lokaal Docker), Expo RN (web-preview verifieert), Vitest RLS-tests tegen cloud, Deno edge function.

**Spec:** `docs/superpowers/specs/2026-08-02-fase-4-toegang-accounts-design.md`
**Branch:** `fase-4-toegang-accounts` (bestaat al)

**Kritieke codebase-weetjes voor elke taak:**
- Migraties gaan naar de cloud: `supabase db push` vanuit de repo-root. Geen `supabase start`.
- Security-definer functies: ALTIJD `set search_path = ''` + schema-gekwalificeerde refs (patroon: `is_coach_of` in `20260730132026_hardening.sql`).
- `clients_guard_update`-trigger blokkeert wijziging van `coach_id` — de migratie versoepelt dit exact één geval (NULL → waarde) voor het verzilveren.
- RLS-tests draaien tegen cloud: `npm run test:rls` (vereist `.env` met SUPABASE_URL/ANON/SERVICE_ROLE — let op: de service-key in `.env` kan corrupt zijn (em-dash); dan moet Jeffrey 'm eerst opnieuw plakken).
- App-conventies: NL-namen, bestaande tokens uit `@/theme/tokens`, `PrimaireKnop`/`Sheet`/`Chip`-componenten bestaan.
- De onboarding schrijft al profielversie 1 (`author: null, versie: 1`) — NIET aanraken.

---

### Task 1: Migratie `fase4_toegang` (schema + trigger + RPC's + RLS)

**Files:**
- Create: `supabase/migrations/20260802090000_fase4_toegang.sql`

- [ ] **Step 1: Schrijf de migratie**

```sql
-- Fase 4: tiers, invite-codes, app_config, registratie-trigger, verzilver-RPC.

-- ── 1. clients: tier + coach optioneel ──
alter table public.clients add column tier text not null default 'free'
  check (tier in ('free', 'coached'));
alter table public.clients alter column coach_id drop not null;
update public.clients set tier = 'coached';  -- bestaande (demo)klanten zijn coached

-- Guard versoepelen: coach_id mag één transitie maken (NULL → coach, het verzilveren).
-- Een al-gekoppelde coach blijft onwijzigbaar.
create or replace function public.clients_guard_update()
returns trigger language plpgsql as $$
begin
  if new.id <> old.id
     or (old.coach_id is not null and new.coach_id is distinct from old.coach_id)
     or new.startdatum <> old.startdatum
     or new.created_at <> old.created_at then
    raise exception 'clients: id, coach_id, startdatum en created_at zijn niet wijzigbaar';
  end if;
  return new;
end;
$$;

-- ── 2. invite_codes: kaal, eenmalig, geen vervaldatum in v1 ──
create table public.invite_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  coach_id uuid not null references public.coaches (id),
  created_at timestamptz not null default now(),
  used_by uuid references public.clients (id) on delete set null,
  used_at timestamptz
);
alter table public.invite_codes enable row level security;
-- Bewust GEEN policies voor authenticated: alles loopt via de RPC's.
-- Coach-beheer-policies komen in fase 5 (dashboard).

-- ── 3. app_config: remote ops-knoppen, leesbaar voor iedereen ──
create table public.app_config (
  key text primary key,
  value jsonb not null
);
alter table public.app_config enable row level security;
create policy iedereen_leest_config on public.app_config
  for select to anon, authenticated using (true);
insert into public.app_config (key, value) values
  ('sloten_actief', 'true'::jsonb),
  ('apple_login_actief', 'false'::jsonb);

-- ── 4. Registratie-trigger: elke nieuwe auth-user krijgt een clients-rij ──
-- Metadata-vlag rol='coach' (gezet door de seed) slaat coach-accounts over.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if new.raw_user_meta_data->>'rol' = 'coach' then
    return new;
  end if;
  insert into public.clients (id, naam, tier)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data->>'naam', ''),
      nullif(new.raw_user_meta_data->>'full_name', ''),  -- Google/Apple
      split_part(coalesce(new.email, 'nieuw'), '@', 1)
    ),
    'free'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── 5. RPC verzilver_code: atomair, lekt niet welke codes bestaan ──
create or replace function public.verzilver_code(p_code text)
returns boolean
language plpgsql security definer
set search_path = ''
as $$
declare
  v_coach uuid;
begin
  if auth.uid() is null then
    return false;
  end if;
  -- Al coached → weiger; de code blijft bruikbaar voor iemand anders.
  if exists (select 1 from public.clients c where c.id = auth.uid() and c.tier = 'coached') then
    return false;
  end if;
  update public.invite_codes
     set used_by = auth.uid(), used_at = now()
   where upper(code) = upper(trim(p_code)) and used_by is null
  returning coach_id into v_coach;
  if v_coach is null then
    return false;
  end if;
  update public.clients set tier = 'coached', coach_id = v_coach where id = auth.uid();
  return true;
end;
$$;
revoke execute on function public.verzilver_code(text) from public, anon;
grant execute on function public.verzilver_code(text) to authenticated;

-- ── 6. RPC maak_invite_code: alleen service_role (dashboard/SQL; fase 5 krijgt coach-UI) ──
-- Alfabet zonder verwarrende tekens (geen O/0/I/1); 32 tekens.
create or replace function public.maak_invite_code(p_coach uuid)
returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  v_chars constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text;
  i int;
begin
  loop
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(v_chars, 1 + floor(random() * 32)::int, 1);
    end loop;
    begin
      insert into public.invite_codes (code, coach_id) values (v_code, p_coach);
      return v_code;
    exception when unique_violation then
      -- botsing (1 op ~1 miljard bij lege tabel): opnieuw
      null;
    end;
  end loop;
end;
$$;
revoke execute on function public.maak_invite_code(uuid) from public, anon, authenticated;
grant execute on function public.maak_invite_code(uuid) to service_role;

-- ── 7. mijn_tier: de klant leest z'n eigen tier al via RLS (clients select),
--     maar een expliciete RPC houdt de app-code simpel en werkt ook vlak na signup ──
create or replace function public.mijn_tier()
returns text
language sql stable security definer
set search_path = ''
as $$
  select coalesce(
    (select c.tier from public.clients c where c.id = auth.uid()),
    'free'
  );
$$;
revoke execute on function public.mijn_tier() from public, anon;
grant execute on function public.mijn_tier() to authenticated;
```

- [ ] **Step 2: Push naar de cloud**

Run (repo-root): `supabase db push`
Expected: `Applying migration 20260802090000_fase4_toegang.sql... Finished supabase db push.`

- [ ] **Step 3: Rooktest via SQL**

Run: `supabase db push --dry-run` (moet leeg zijn) en controleer in het dashboard of `invite_codes` en `app_config` bestaan. Alternatief: geen actie — Task 3's tests dekken alles.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260802090000_fase4_toegang.sql
git commit -m "feat(db): fase 4 — tiers, invite-codes, app_config, registratie-trigger, verzilver-RPC"
```

---

### Task 2: Seed-update (trigger-proof, tiers, testcodes)

**Files:**
- Modify: `scripts/seed.mjs`

De registratie-trigger maakt nu bij `admin.createUser` direct een clients-rij aan. De seed moet daarom:
1. Coach-users aanmaken met `app_metadata: { rol: 'coach' }` (trigger slaat ze over).
2. Klant-users aanmaken met `user_metadata: { naam }`.
3. De clients-rij die de trigger al maakte **wissen en opnieuw inserten** mét `tier: 'coached'`
   (upserten kán niet: de seed backdate't `startdatum` en de clients-guard blokkeert dat op UPDATE).
4. In `wisDemoData` ook `invite_codes` legen.

- [ ] **Step 1: Lees `scripts/seed.mjs` en pas aan**

Zoek de plek waar auth-users worden aangemaakt (`auth.admin.createUser`) en geef metadata mee:

```js
// coaches: rol 'coach' in app_metadata zodat handle_new_user géén clients-rij aanmaakt.
// Bewust app_metadata en niet user_metadata: alleen de service role kan die schrijven,
// user_metadata is bij signUp door de gebruiker zelf te vullen.
const { data: u } = await service.auth.admin.createUser({
  email, password: WACHTWOORD, email_confirm: true,
  user_metadata: { naam },
  ...(isCoach ? { app_metadata: { rol: 'coach' } } : {}),
});
```

Zoek de `clients`-insert. De trigger is je vóór geweest en heeft al een rij gemaakt
(`tier 'free'`, `coach_id null`). Upserten werkt hier níét: de seed zet een backdated
`startdatum` en `clients_guard_update` weigert elke wijziging daarvan. Wis de rij dus
eerst en insert daarna de demo-rij, nu mét `tier`:

```js
await service.from('clients').delete().eq('id', userId);
await service.from('clients').insert({
  id: userId, coach_id: coachId, naam, leeftijd, startdatum, status, tier: 'coached',
});
```

Voeg in `wisDemoData` (die verwijdert clients vóór coaches) toe, vóór het verwijderen van clients:

```js
await service.from('invite_codes').delete().not('id', 'is', null);
```

Pas de exacte variabelenamen aan op wat er in het bestand staat — de structuur (welke users, welke data) blijft identiek.

- [ ] **Step 2: Draai de seed tegen de cloud**

Run: `node scripts/seed.mjs`
Expected: zelfde output als voorheen, exit 0. (Vereist geldige service-key in `.env`.)

- [ ] **Step 3: Draai de bestaande RLS-tests — die moeten groen blijven**

Run: `npm run test:rls`
Expected: alle bestaande tests PASS (14+).

- [ ] **Step 4: Commit**

```bash
git add scripts/seed.mjs
git commit -m "chore(seed): trigger-proof — coach-metadata, clients-upsert met tier, invite-codes wissen"
```

---

### Task 3: RLS/RPC-tests voor fase 4

**Files:**
- Create: `tests/rls/fase4.test.ts`

- [ ] **Step 1: Schrijf de tests** (zelfde opzet als `tests/rls/rls.test.ts` — cloud, service-client in beforeAll)

```ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
// @ts-expect-error — plain ESM zonder types
import { supabaseEnv } from '../../scripts/supabase-env.mjs';

// Fase 4: registratie-trigger, tiers, verzilver_code. Draait tegen het GEHOSTE project.
const WACHTWOORD = 'fase4-test-2026';
const TEST_EMAIL = `fase4-${Date.now()}@test.lauinbalans.nl`;

let url: string;
let anonKey: string;
let service: SupabaseClient;
let lauraCoachId: string;
let testUserId: string;
let testUser: SupabaseClient;
let code: string;

beforeAll(async () => {
  const env = supabaseEnv();
  url = env.url;
  anonKey = env.anonKey;
  service = createClient(url, env.serviceKey, { auth: { persistSession: false } });

  const { data: coaches } = await service.from('coaches').select('id, naam');
  lauraCoachId = coaches!.find((c) => c.naam === 'Laura')!.id;

  // Verse gebruiker → trigger hoort een clients-rij te maken
  const { data: u, error } = await service.auth.admin.createUser({
    email: TEST_EMAIL, password: WACHTWOORD, email_confirm: true,
    user_metadata: { naam: 'Fase Vier' },
  });
  if (error) throw error;
  testUserId = u.user!.id;

  const { data: c } = await service.rpc('maak_invite_code', { p_coach: lauraCoachId });
  code = c as string;

  testUser = createClient(url, anonKey, { auth: { persistSession: false } });
  const { error: le } = await testUser.auth.signInWithPassword({ email: TEST_EMAIL, password: WACHTWOORD });
  if (le) throw le;
});

afterAll(async () => {
  await service.from('invite_codes').delete().eq('code', code);
  await service.auth.admin.deleteUser(testUserId);
});

describe('registratie-trigger', () => {
  it('maakt automatisch een free clients-rij met naam uit metadata', async () => {
    const { data } = await service.from('clients').select('naam, tier, coach_id').eq('id', testUserId).single();
    expect(data).toEqual({ naam: 'Fase Vier', tier: 'free', coach_id: null });
  });
});

describe('verzilver_code', () => {
  it('onzin-code → false', async () => {
    const { data } = await testUser.rpc('verzilver_code', { p_code: 'XXXXXX' });
    expect(data).toBe(false);
  });
  it('geldige code → true, tier coached, coach Laura (hoofdletterongevoelig)', async () => {
    const { data } = await testUser.rpc('verzilver_code', { p_code: code.toLowerCase() });
    expect(data).toBe(true);
    const { data: c } = await service.from('clients').select('tier, coach_id').eq('id', testUserId).single();
    expect(c).toEqual({ tier: 'coached', coach_id: lauraCoachId });
  });
  it('al-coached → false, ook met een verse geldige code', async () => {
    const { data: extra } = await service.rpc('maak_invite_code', { p_coach: lauraCoachId });
    const { data } = await testUser.rpc('verzilver_code', { p_code: extra as string });
    expect(data).toBe(false);
    // verse code is NIET verbruikt
    const { data: rij } = await service.from('invite_codes').select('used_by').eq('code', extra).single();
    expect(rij!.used_by).toBeNull();
    await service.from('invite_codes').delete().eq('code', extra as string);
  });
  it('gebruikte code door een ander → false', async () => {
    const { data: u2 } = await service.auth.admin.createUser({
      email: `fase4b-${Date.now()}@test.lauinbalans.nl`, password: WACHTWOORD, email_confirm: true,
    });
    const ander = createClient(url, anonKey, { auth: { persistSession: false } });
    await ander.auth.signInWithPassword({ email: u2.user!.email!, password: WACHTWOORD });
    const { data } = await ander.rpc('verzilver_code', { p_code: code });
    expect(data).toBe(false);
    await service.auth.admin.deleteUser(u2.user!.id);
  });
});

describe('afscherming', () => {
  it('klant ziet invite_codes niet', async () => {
    const { data } = await testUser.from('invite_codes').select('code');
    expect((data ?? []).length).toBe(0);
  });
  it('anon leest app_config (sloten_actief bestaat)', async () => {
    const anon = createClient(url, anonKey, { auth: { persistSession: false } });
    const { data } = await anon.from('app_config').select('key, value').eq('key', 'sloten_actief').single();
    expect(data!.value).toBe(true);
  });
  it('klant kan app_config niet schrijven', async () => {
    const { error } = await testUser.from('app_config').update({ value: false }).eq('key', 'sloten_actief');
    // RLS: geen update-policy → error of 0 rijen; waarde moet onveranderd zijn
    const { data } = await service.from('app_config').select('value').eq('key', 'sloten_actief').single();
    expect(data!.value).toBe(true);
    void error;
  });
  it('mijn_tier geeft de eigen tier', async () => {
    const { data } = await testUser.rpc('mijn_tier');
    expect(data).toBe('coached'); // na de verzilver-test hierboven
  });
});
```

- [ ] **Step 2: Draai de nieuwe tests**

Run: `npx vitest run tests/rls/fase4.test.ts`
Expected: alle tests PASS. (Volgorde binnen describes is van boven naar beneden — de verzilver-test zet de staat voor `mijn_tier`.)

- [ ] **Step 3: Draai de volledige RLS-suite**

Run: `npm run test:rls`
Expected: oud + nieuw allemaal PASS.

- [ ] **Step 4: Commit**

```bash
git add tests/rls/fase4.test.ts
git commit -m "test(rls): fase 4 — trigger, verzilver_code, invite-afscherming, app_config"
```

---

### Task 4: `lau-reply` weigert free-tier

**Files:**
- Modify: `supabase/functions/lau-reply/index.ts` (de parallelle context-load, ± regel 60)

- [ ] **Step 1: Voeg een tier-query toe aan de bestaande `Promise.all` en weiger free**

De functie heeft al een parallel blok. Breid uit van drie naar vier queries:

```ts
const [profielRes, berichtenRes, logsRes, klantRes] = await Promise.all([
  db.from('ai_profile_versions').select('profiel').eq('client_id', clientId)
    .order('versie', { ascending: false }).limit(1).maybeSingle(),
  db.from('messages').select('sender, tekst').eq('client_id', clientId)
    .order('created_at', { ascending: false }).limit(20), // nieuwste 20...
  db.from('food_logs').select('porties').eq('client_id', clientId)
    .gte('datum', weekStart.toISOString().slice(0, 10)),
  db.from('clients').select('tier').eq('id', clientId).single(),
]);

// Server-side enforcement: de slot-UI is geen papieren slot.
if ((klantRes.data as { tier?: string } | null)?.tier !== 'coached') {
  return new Response('coached vereist', { status: 403, headers: cors });
}
```

Plaats de 403-check direct ná de `Promise.all`, vóór de profiel-check.

- [ ] **Step 2: Type-check**

Run: `deno check --node-modules-dir=auto supabase/functions/lau-reply/index.ts`
Expected: `Check ... index.ts`, exit 0. Draai daarna `git checkout -- deno.lock` (auto-install blaast 'm op).

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/lau-reply/index.ts
git commit -m "feat(lau-reply): weiger free-tier server-side (403 coached vereist)"
```

(Deploy doet Jeffrey later; de bestaande deploy blijft werken omdat alle klanten nu coached zijn.)

---

### Task 5: App — tier in SessieProvider + useConfig + OAuth-basis

**Files:**
- Modify: `apps/mobile/src/lib/sessie.tsx`
- Modify: `apps/mobile/src/lib/supabase.ts`
- Create: `apps/mobile/src/lib/hooks/useConfig.ts`
- Create: `apps/mobile/src/lib/oauth.ts`

- [ ] **Step 1: `supabase.ts` — PKCE + sessie-detectie op web (nodig voor OAuth-redirects)**

```ts
import 'react-native-url-polyfill/auto';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error('EXPO_PUBLIC_SUPABASE_URL en EXPO_PUBLIC_SUPABASE_ANON_KEY zijn verplicht — zie .env.example');
}

export const supabase = createClient(url, anonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    flowType: 'pkce',
    // Web: na een OAuth-redirect staat de code in de URL — die moet supabase-js zelf oppakken.
    detectSessionInUrl: Platform.OS === 'web',
  },
});
```

- [ ] **Step 2: `oauth.ts` — Google/Apple-login, web via redirect, native via WebBrowser**

```ts
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { supabase } from './supabase';

WebBrowser.maybeCompleteAuthSession();

type Provider = 'google' | 'apple';

/**
 * Social login. Web: volledige redirect (supabase-js pakt de sessie op via
 * detectSessionInUrl). Native: auth-sessie in een browser-sheet + code-exchange.
 * Native werkt pas echt op een dev-build; de web-preview is de testroute nu.
 */
export async function socialLogin(provider: Provider): Promise<{ error: string | null }> {
  const FOUT = 'Inloggen lukte niet. Probeer het nog eens.';
  if (Platform.OS === 'web') {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin },
    });
    return { error: error ? FOUT : null };
  }
  const redirectTo = makeRedirectUri(); // gebruikt het app-scheme ("mobile")
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error || !data.url) return { error: FOUT };
  const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (res.type !== 'success') return { error: null }; // geannuleerd — geen foutmelding
  const codeMatch = res.url.match(/[?&]code=([^&]+)/);
  if (!codeMatch) return { error: FOUT };
  const { error: xe } = await supabase.auth.exchangeCodeForSession(codeMatch[1]);
  return { error: xe ? FOUT : null };
}
```

Installeer de benodigde packages (repo-root, workspace mobile):

Run: `cd apps/mobile && npx expo install expo-web-browser expo-auth-session expo-crypto`

- [ ] **Step 3: `useConfig.ts` — app_config lezen met defaults**

```ts
import { useEffect, useState } from 'react';
import { supabase } from '../supabase';

type Config = { slotenActief: boolean; appleLoginActief: boolean };
const DEFAULTS: Config = { slotenActief: true, appleLoginActief: false };

/** Remote ops-knoppen uit app_config; bij offline/fout gelden de defaults. */
export function useConfig(): Config {
  const [config, setConfig] = useState<Config>(DEFAULTS);
  useEffect(() => {
    supabase.from('app_config').select('key, value').then(({ data }) => {
      if (!data) return;
      const map = Object.fromEntries(data.map((r) => [r.key, r.value]));
      setConfig({
        slotenActief: map.sloten_actief !== false,
        appleLoginActief: map.apple_login_actief === true,
      });
    });
  }, []);
  return config;
}
```

- [ ] **Step 4: `sessie.tsx` — tier + registreer erbij**

Breid het context-type en de provider uit (bestaande code intact laten):

```ts
// aan het SessieContext-type toevoegen:
  tier: 'free' | 'coached' | null;
  herlaadTier: () => Promise<void>;
  registreer: (email: string, wachtwoord: string, naam: string) => Promise<{ error: string | null }>;

// in SessieProvider:
  const [tier, setTier] = useState<'free' | 'coached' | null>(null);

  const herlaadTier = useCallback(async () => {
    const { data } = await supabase.rpc('mijn_tier');
    setTier(data === 'coached' ? 'coached' : 'free');
  }, []);

  useEffect(() => {
    if (!clientId) { setTier(null); return; }
    herlaadTier();
  }, [clientId, herlaadTier]);

  async function registreer(email: string, wachtwoord: string, naam: string) {
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password: wachtwoord,
      options: { data: { naam: naam.trim() } },
    });
    return { error: error ? 'Registreren lukte niet. Controleer je gegevens of probeer een ander e-mailadres.' : null };
  }

// en beide in de Provider-value zetten: tier, herlaadTier, registreer
```

- [ ] **Step 5: Verifieer**

Run (repo-root): `npm run typecheck -w apps/mobile`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/lib/ apps/mobile/package.json package-lock.json
git commit -m "feat(mobile): tier in sessie, app_config-hook, OAuth-basis (PKCE, web-redirect)"
```

---

### Task 6: App — welkom- en registreerscherm + social-knoppen op login

**Files:**
- Create: `apps/mobile/src/app/(auth)/welkom.tsx`
- Create: `apps/mobile/src/app/(auth)/registreer.tsx`
- Create: `apps/mobile/src/components/SocialKnoppen.tsx`
- Modify: `apps/mobile/src/app/(auth)/login.tsx` (social-knoppen + link naar registreer)
- Modify: `apps/mobile/src/app/index.tsx` (redirect naar welkom)
- Modify: `apps/mobile/src/app/_layout.tsx` (gate: geen sessie → welkom)

- [ ] **Step 1: `SocialKnoppen.tsx`** (gedeeld door login + registreer)

```tsx
import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, fontFamily } from '@/theme/tokens';
import { socialLogin } from '@/lib/oauth';
import { useConfig } from '@/lib/hooks/useConfig';

/** Apple/Google-knoppen + "of"-scheiding. Apple staat achter de remote vlag
 *  (apple_login_actief) tot het Apple Developer-account er is. */
export function SocialKnoppen({ onFout }: { onFout: (m: string) => void }) {
  const { appleLoginActief } = useConfig();
  const [bezig, setBezig] = useState<null | 'google' | 'apple'>(null);

  async function start(provider: 'google' | 'apple') {
    setBezig(provider);
    const uitkomst = await socialLogin(provider);
    setBezig(null);
    if (uitkomst.status === 'fout') onFout(uitkomst.melding); // 'geannuleerd' = stil, geen melding
  }

  return (
    <View style={s.blok}>
      {appleLoginActief && (
        <Pressable style={({ pressed }) => [s.knop, s.apple, pressed && s.gedrukt]}
          disabled={bezig !== null} onPress={() => start('apple')}>
          <Ionicons name="logo-apple" size={19} color={colors.bgSurface} />
          <Text style={[s.tekst, { color: colors.bgSurface }]}>Doorgaan met Apple</Text>
        </Pressable>
      )}
      <Pressable style={({ pressed }) => [s.knop, s.google, pressed && s.gedrukt]}
        disabled={bezig !== null} onPress={() => start('google')}>
        <Ionicons name="logo-google" size={17} color={colors.ink} />
        <Text style={[s.tekst, { color: colors.ink }]}>{bezig === 'google' ? 'Bezig…' : 'Doorgaan met Google'}</Text>
      </Pressable>
      <View style={s.ofRij}>
        <View style={s.lijn} /><Text style={s.of}>of met e-mail</Text><View style={s.lijn} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  blok: { gap: 10, marginBottom: 14 },
  knop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9,
    paddingVertical: 14, borderRadius: radii.pill, borderWidth: 1 },
  gedrukt: { opacity: 0.7 },
  apple: { backgroundColor: colors.ink, borderColor: colors.ink },
  google: { backgroundColor: colors.bgSurface, borderColor: colors.hairline },
  tekst: { fontFamily: fontFamily.sansMedium, fontSize: 15 },
  ofRij: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 },
  lijn: { flex: 1, height: 1, backgroundColor: colors.hairlineSofter },
  of: { fontFamily: fontFamily.sans, fontSize: 12, color: colors.mutedSoft },
});
```

- [ ] **Step 2: `welkom.tsx`**

```tsx
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontFamily, text } from '@/theme/tokens';
import { PrimaireKnop } from '@/components/PrimaireKnop';
import { Pressable } from 'react-native';

const PUNTEN = [
  { icoon: '✓', tekst: 'Houd je voeding bij in handmaten — gratis, zonder calorieën tellen.' },
  { icoon: '✓', tekst: 'Lau.ai: een AI-coach die met je meedenkt, dag en nacht.' },
  { icoon: '✓', tekst: 'Samen met coach Laura, voor wie een coachingtraject volgt.' },
];

export default function Welkom() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.root, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 30 }]}>
      <View style={s.boven}>
        <Text style={s.merk}>Lau in Balans</Text>
        <Text style={s.hero}>Rust in je eetritme.</Text>
        <Text style={[text.bodyGroot, { marginTop: 6 }]}>
          De app hoort bij de voedingscoaching van Laura — en voeding bijhouden kan iedereen, gratis.
        </Text>
        <View style={s.punten}>
          {PUNTEN.map((p) => (
            <View key={p.tekst} style={s.punt}>
              <Text style={s.puntIcoon}>{p.icoon}</Text>
              <Text style={s.puntTekst}>{p.tekst}</Text>
            </View>
          ))}
        </View>
      </View>
      <View style={s.acties}>
        <PrimaireKnop label="Account maken" onPress={() => router.push('/(auth)/registreer')} />
        <Pressable onPress={() => router.push('/(auth)/login')} style={s.loginLink}>
          <Text style={s.loginTekst}>Ik heb al een account</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgApp, paddingHorizontal: 26, justifyContent: 'space-between' },
  boven: { gap: 8 },
  merk: { fontFamily: fontFamily.serif, fontSize: 20, color: colors.sage, letterSpacing: 0.4, marginBottom: 18 },
  hero: { fontFamily: fontFamily.serif, fontSize: 34, lineHeight: 41, letterSpacing: -0.5, color: colors.ink },
  punten: { marginTop: 26, gap: 14 },
  punt: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  puntIcoon: { fontFamily: fontFamily.sansMedium, fontSize: 14, color: colors.sage, lineHeight: 22 },
  puntTekst: { flex: 1, fontFamily: fontFamily.sans, fontSize: 15, lineHeight: 22, color: colors.body },
  acties: { gap: 14 },
  loginLink: { alignItems: 'center', paddingVertical: 8 },
  loginTekst: { fontFamily: fontFamily.sans, fontSize: 15, color: colors.sageDeep },
});
```

- [ ] **Step 3: `registreer.tsx`**

```tsx
import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSessie } from '@/lib/sessie';
import { PrimaireKnop } from '@/components/PrimaireKnop';
import { SocialKnoppen } from '@/components/SocialKnoppen';
import { colors, radii, fontFamily, text } from '@/theme/tokens';

export default function Registreer() {
  const { registreer } = useSessie();
  const router = useRouter();
  const [naam, setNaam] = useState('');
  const [email, setEmail] = useState('');
  const [ww, setWw] = useState('');
  const [fout, setFout] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);

  async function maakAccount() {
    if (!naam.trim() || !email.trim() || ww.length < 8) {
      setFout('Vul je naam en e-mail in, en kies een wachtwoord van minimaal 8 tekens.');
      return;
    }
    setBezig(true); setFout(null);
    const { error } = await registreer(email, ww, naam);
    setBezig(false);
    if (error) { setFout(error); return; }
    router.replace('/(onboarding)/code'); // de gate stuurt sessies zonder profiel hierheen
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.root}>
      <View style={s.inner}>
        <Text style={s.merk}>Lau in Balans</Text>
        <Text style={[text.bodyGroot, { marginBottom: 24 }]}>Maak een account om te beginnen.</Text>
        <SocialKnoppen onFout={setFout} />
        <TextInput style={s.input} placeholder="Naam" value={naam} onChangeText={setNaam}
          placeholderTextColor={colors.mutedSoft} />
        <TextInput style={s.input} placeholder="E-mail" autoCapitalize="none" keyboardType="email-address"
          value={email} onChangeText={setEmail} placeholderTextColor={colors.mutedSoft} />
        <TextInput style={s.input} placeholder="Wachtwoord (min. 8 tekens)" secureTextEntry
          value={ww} onChangeText={setWw} placeholderTextColor={colors.mutedSoft} />
        {fout && <Text style={[text.bodyKlein, { color: colors.clayInk, marginBottom: 8 }]}>{fout}</Text>}
        <PrimaireKnop label="Account maken" onPress={maakAccount} bezig={bezig} />
        <Pressable onPress={() => router.replace('/(auth)/login')} style={s.wissel}>
          <Text style={s.wisselTekst}>Ik heb al een account — inloggen</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgApp, justifyContent: 'center' },
  inner: { padding: 26 },
  merk: { fontFamily: fontFamily.serif, fontSize: 22, color: colors.sage, letterSpacing: 0.4, marginBottom: 8 },
  input: { padding: 14, borderWidth: 1, borderColor: colors.hairlineSoft, borderRadius: radii.input,
    backgroundColor: colors.bgSurface, fontFamily: fontFamily.sans, fontSize: 15, marginBottom: 12, color: colors.ink },
  wissel: { alignItems: 'center', paddingVertical: 14 },
  wisselTekst: { fontFamily: fontFamily.sans, fontSize: 14, color: colors.sageDeep },
});
```

- [ ] **Step 4: `login.tsx` — SocialKnoppen boven het formulier + link naar registreer**

Voeg imports toe (`SocialKnoppen`, `useRouter`, `Pressable`), render `<SocialKnoppen onFout={setFout} />` direct boven de e-mail-input, en onder de knop:

```tsx
<Pressable onPress={() => router.replace('/(auth)/registreer')} style={{ alignItems: 'center', paddingVertical: 14 }}>
  <Text style={{ fontFamily: fontFamily.sans, fontSize: 14, color: colors.sageDeep }}>Nieuw hier? Account maken</Text>
</Pressable>
```

- [ ] **Step 5: OAuth-fout uit de URL tonen op web (login.tsx én registreer.tsx)**

Bij een mislukte social login stuurt Supabase de gebruiker terug met `error`/`error_description`
in de query. Zonder dit blijft het scherm stil en lijkt er niets gebeurd. Zet in beide schermen:

```ts
useEffect(() => {
  if (Platform.OS !== 'web') return;
  const p = new URLSearchParams(window.location.search);
  const d = p.get('error_description') ?? p.get('error');
  if (!d) return;
  setFout('Inloggen via de provider lukte niet.');
  ['error', 'error_code', 'error_description'].forEach((k) => p.delete(k));
  window.history.replaceState(null, '', window.location.pathname + (p.size ? `?${p}` : ''));
}, []);
```

- [ ] **Step 6: Gate + index-redirect**

`apps/mobile/src/app/index.tsx`: `<Redirect href="/(auth)/welkom" />`.
`_layout.tsx` Gate: vervang `router.replace('/(auth)/login')` door `router.replace('/(auth)/welkom')`.

- [ ] **Step 7: Verifieer**

Run: `npm run typecheck -w apps/mobile` → 0 errors.
Run: `cd apps/mobile && npx expo export --platform web --output-dir /tmp/f4-t6 && rm -rf /tmp/f4-t6` → OK.

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/src
git commit -m "feat(mobile): welkom- en registreerscherm, social-knoppen, gate naar welkom"
```

---

### Task 7: App — codescherm + CodeInvoer + gate-update

**Files:**
- Create: `apps/mobile/src/components/CodeInvoer.tsx`
- Create: `apps/mobile/src/app/(onboarding)/code.tsx`
- Modify: `apps/mobile/src/app/_layout.tsx` (gate stuurt vers account naar code)

Het codescherm leeft in de `(onboarding)`-groep zodat de bestaande gate (sessie zonder
profiel → onboarding-groep) er niet mee vecht; *Overslaan* gaat door naar `/(onboarding)`.

- [ ] **Step 1: `CodeInvoer.tsx`** (één nette invoer — geen zes losse velden: plakbaar, autocomplete-vrij)

```tsx
import { TextInput, StyleSheet } from 'react-native';
import { colors, radii, fontFamily } from '@/theme/tokens';

/** 6-teken code-invoer: uppercase, alfabet zonder O/0/I/1, monospaced-gevoel via letterSpacing. */
export function CodeInvoer({ waarde, onWijzig }: { waarde: string; onWijzig: (v: string) => void }) {
  function normaliseer(v: string) {
    onWijzig(v.toUpperCase().replace(/[^ABCDEFGHJKLMNPQRSTUVWXYZ23456789]/g, '').slice(0, 6));
  }
  return (
    <TextInput
      style={s.invoer}
      value={waarde}
      onChangeText={normaliseer}
      placeholder="ABC234"
      placeholderTextColor={colors.mutedSofter}
      autoCapitalize="characters"
      autoCorrect={false}
      maxLength={6}
      accessibilityLabel="Code van Laura"
    />
  );
}

const s = StyleSheet.create({
  invoer: {
    textAlign: 'center', fontFamily: fontFamily.sansMedium, fontSize: 26, letterSpacing: 12,
    paddingVertical: 18, borderWidth: 1, borderColor: colors.hairline, borderRadius: radii.cardLg,
    backgroundColor: colors.bgSurface, color: colors.ink,
  },
});
```

- [ ] **Step 2: `(onboarding)/code.tsx`**

```tsx
import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useSessie } from '@/lib/sessie';
import { colors, fontFamily, text } from '@/theme/tokens';
import { PrimaireKnop } from '@/components/PrimaireKnop';
import { CodeInvoer } from '@/components/CodeInvoer';

export default function Code() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { herlaadTier } = useSessie();
  const [code, setCode] = useState('');
  const [fout, setFout] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);

  async function verzilver() {
    setBezig(true); setFout(null);
    const { data } = await supabase.rpc('verzilver_code', { p_code: code });
    setBezig(false);
    if (data !== true) {
      setFout('Deze code klopt niet of is al gebruikt. Check 'm bij Laura.');
      return;
    }
    await herlaadTier();
    router.replace('/(onboarding)');
  }

  return (
    <View style={[s.root, { paddingTop: insets.top + 60 }]}>
      <Text style={s.titel}>Ben je klant bij Laura?</Text>
      <Text style={[text.bodyGroot, { marginTop: 8 }]}>
        Dan heb je een code van haar gekregen. Vul 'm in en alles gaat open — ook zonder code
        kun je gewoon je voeding bijhouden.
      </Text>
      <View style={s.invoerBlok}>
        <CodeInvoer waarde={code} onWijzig={setCode} />
        {fout && <Text style={[text.bodyKlein, { color: colors.clayInk }]}>{fout}</Text>}
      </View>
      <PrimaireKnop label="Code verzilveren" onPress={verzilver} bezig={bezig} />
      <Pressable onPress={() => router.replace('/(onboarding)')} style={s.overslaan}>
        <Text style={s.overslaanTekst}>Ik heb geen code — overslaan</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgApp, paddingHorizontal: 26 },
  titel: { fontFamily: fontFamily.serif, fontSize: 28, lineHeight: 34, letterSpacing: -0.3, color: colors.ink },
  invoerBlok: { marginVertical: 26, gap: 10 },
  overslaan: { alignItems: 'center', paddingVertical: 16 },
  overslaanTekst: { fontFamily: fontFamily.sans, fontSize: 15, color: colors.sageDeep },
});
```

Let op de apostrof in `Check 'm bij Laura.` — gebruik in JSX `{"Deze code klopt niet of is al gebruikt. Check 'm bij Laura."}` of een typografische apostrof (’) om een parse-fout te vermijden.

- [ ] **Step 3: Gate-update in `_layout.tsx`**

De registreer-flow stuurt zelf naar `/(onboarding)/code`; de gate hoeft alleen de
onboarding-groep als geheel toe te staan (dat doet 'ie al: `groep !== '(onboarding)'`).
Er is dus GEEN gate-wijziging nodig behalve de welkom-redirect uit Task 6. Verifieer dat
`router.replace('/(onboarding)/code')` vanaf registreer werkt zonder dat de gate 'm
terugkaatst (de gate kaatst alleen naar `/(onboarding)` als je BUITEN de groep bent).

- [ ] **Step 4: Verifieer**

Run: `npm run typecheck -w apps/mobile` → 0 errors.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src
git commit -m "feat(mobile): codescherm in onboarding-flow + CodeInvoer"
```

---

### Task 8: App — SlotKaart, CodeSheet en slot-states (chat, vandaag, LauraKnop)

**Files:**
- Create: `apps/mobile/src/components/SlotKaart.tsx`
- Create: `apps/mobile/src/components/CodeSheet.tsx`
- Modify: `apps/mobile/src/app/(tabs)/chat.tsx` (free → slot-scherm)
- Modify: `apps/mobile/src/app/(tabs)/vandaag.tsx` (free → slot-kaarten)
- Modify: `apps/mobile/src/components/LauraKnop.tsx` (geen wijziging aan het component zelf; de schermen geven een andere onPress mee bij free)

- [ ] **Step 1: `CodeSheet.tsx`** (bottom-sheet rond CodeInvoer, hergebruikt `Sheet`)

```tsx
import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useSessie } from '@/lib/sessie';
import { colors, fontFamily, text } from '@/theme/tokens';
import { Sheet } from '@/components/Sheet';
import { PrimaireKnop } from '@/components/PrimaireKnop';
import { CodeInvoer } from '@/components/CodeInvoer';

/** Code verzilveren vanaf een slot-staat. Na succes: tier herladen — de app klapt open. */
export function CodeSheet({ zichtbaar, onSluit }: { zichtbaar: boolean; onSluit: () => void }) {
  const { herlaadTier } = useSessie();
  const [code, setCode] = useState('');
  const [fout, setFout] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);

  async function verzilver() {
    setBezig(true); setFout(null);
    const { data } = await supabase.rpc('verzilver_code', { p_code: code });
    setBezig(false);
    if (data !== true) {
      setFout('Deze code klopt niet of is al gebruikt.');
      return;
    }
    await herlaadTier();
    setCode('');
    onSluit();
  }

  return (
    <Sheet zichtbaar={zichtbaar} onSluit={onSluit}>
      <View style={s.inhoud}>
        <Text style={s.titel}>Code van Laura</Text>
        <Text style={text.body}>Vul de 6-tekencode in die je van Laura hebt gekregen.</Text>
        <CodeInvoer waarde={code} onWijzig={setCode} />
        {fout && <Text style={[text.bodyKlein, { color: colors.clayInk }]}>{fout}</Text>}
        <PrimaireKnop label="Verzilveren" onPress={verzilver} bezig={bezig} />
      </View>
    </Sheet>
  );
}

const s = StyleSheet.create({
  inhoud: { paddingHorizontal: 26, paddingTop: 6, paddingBottom: 34, gap: 16 },
  titel: { fontFamily: fontFamily.serif, fontSize: 26, letterSpacing: -0.26, color: colors.ink },
});
```

- [ ] **Step 2: `SlotKaart.tsx`** (kaart- én schermvariant, opent de CodeSheet)

```tsx
import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, fontFamily } from '@/theme/tokens';
import { CodeSheet } from '@/components/CodeSheet';

/**
 * Zichtbaar-maar-op-slot (fase 4-spec). Warm en eerlijk: wat het is + dat het bij een
 * coachingtraject hoort. NOOIT prijzen, links of koop-taal (App Store 3.1.3).
 * variant "kaart" = blok tussen andere kaarten; "scherm" = vult een hele tab.
 */
export function SlotKaart({ titel, uitleg, variant = 'kaart' }: {
  titel: string; uitleg: string; variant?: 'kaart' | 'scherm';
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  return (
    <View style={variant === 'scherm' ? s.scherm : s.kaart}>
      <View style={s.slotBol}>
        <Ionicons name="lock-closed" size={18} color={colors.sageMid} />
      </View>
      <Text style={s.titel}>{titel}</Text>
      <Text style={s.uitleg}>{uitleg}</Text>
      <Text style={s.traject}>Dit hoort bij een coachingtraject van Laura.</Text>
      <Pressable style={({ pressed }) => [s.knop, pressed && { opacity: 0.7 }]} onPress={() => setSheetOpen(true)}>
        <Text style={s.knopTekst}>Ik heb een code</Text>
      </Pressable>
      <CodeSheet zichtbaar={sheetOpen} onSluit={() => setSheetOpen(false)} />
    </View>
  );
}

const s = StyleSheet.create({
  kaart: { backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.hairlineSofter,
    borderRadius: radii.cardXl, padding: 22, gap: 8, alignItems: 'flex-start' },
  scherm: { flex: 1, justifyContent: 'center', paddingHorizontal: 34, gap: 8, alignItems: 'flex-start' },
  slotBol: { width: 40, height: 40, borderRadius: radii.pill, backgroundColor: colors.sageSoft,
    alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  titel: { fontFamily: fontFamily.serif, fontSize: 20, lineHeight: 26, color: colors.ink },
  uitleg: { fontFamily: fontFamily.sans, fontSize: 14, lineHeight: 21, color: colors.bodySoft },
  traject: { fontFamily: fontFamily.sans, fontSize: 13, color: colors.sageMid, marginTop: 2 },
  knop: { marginTop: 12, paddingVertical: 10, paddingHorizontal: 18, borderRadius: radii.pill,
    borderWidth: 1, borderColor: colors.sage, backgroundColor: colors.sageSoft },
  knopTekst: { fontFamily: fontFamily.sansMedium, fontSize: 13, color: colors.sageDeep },
});
```

- [ ] **Step 3: `chat.tsx` — free ziet het slot-scherm**

Bovenin het component (na de hooks, vóór de return), met `tier` en `slotenActief` erbij:

```tsx
const { tier } = useSessie();          // import useSessie uit '@/lib/sessie'
const { slotenActief } = useConfig();  // import useConfig uit '@/lib/hooks/useConfig'

if (tier === 'free' && slotenActief) {
  return (
    <View style={s.root}>
      <View style={[s.header, { paddingTop: insets.top + 22 }]}>
        <View style={s.avatar}><Text style={s.avatarL}>L</Text></View>
        <View style={s.headerTekst}>
          <Text style={text.chatNaam}>Lau.ai</Text>
          <Text style={text.caption}>AI-voedingscoach</Text>
        </View>
      </View>
      <SlotKaart
        variant="scherm"
        titel="Lau denkt met je mee — dag en nacht"
        uitleg="Stel vragen over je eten, krijg warme coaching in handmaten en bouw samen aan je ritme. Laura leest mee en stelt Lau op jou af."
      />
    </View>
  );
}
```

(Import `SlotKaart`. De hooks-volgorde blijft gelijk — de early return komt ná alle hooks.)

- [ ] **Step 4: `vandaag.tsx` — free ziet slot-kaarten voor coach-blokken**

Zelfde imports (`useSessie`, `useConfig`, `SlotKaart`). Definieer bovenin:

```tsx
const { tier } = useSessie();
const { slotenActief } = useConfig();
const opSlot = tier === 'free' && slotenActief;
```

Vervang in de JSX de contactkaart, "waar we aan werken"-groep en het afspraak-blok:

```tsx
{opSlot ? (
  <SlotKaart titel="Contact met Lau en Laura"
    uitleg="Zie hier hoe vaak jullie contact hadden en waar jullie samen aan werken." />
) : (
  <>{/* bestaande contactkaart */}</>
)}
```

- Contactkaart → SlotKaart hierboven.
- "Wat opvalt" en "Eten bijhouden" blijven open (eigen logdata).
- `werkGroep` + `afspraak` → samen één `SlotKaart` met
  `titel="Waar jullie aan werken"` en
  `uitleg="Werkpunten en je afspraken met Laura verschijnen hier zodra je een traject volgt."`.
- De `LauraKnop` in de header: geef bij `opSlot` een andere onPress mee die een lokale
  CodeSheet opent i.p.v. `openLaura`:

```tsx
const [codeSheet, setCodeSheet] = useState(false);
// header: <LauraKnop openFlag={openFlag} onPress={opSlot ? () => setCodeSheet(true) : openLaura} />
// onderaan de ScrollView-children: {opSlot && <CodeSheet zichtbaar={codeSheet} onSluit={() => setCodeSheet(false)} />}
```

Doe hetzelfde met de LauraKnop op `chat.tsx` (die zit in het slot-scherm niet — daar is
de hele tab al slot) en op `eten.tsx` (Eten blijft open, maar de LauraKnop opent daar bij
free óók de CodeSheet, zelfde patroon als vandaag.tsx).

- [ ] **Step 5: Verifieer**

Run: `npm run typecheck -w apps/mobile` → 0 errors.
Run: `cd apps/mobile && npx expo export --platform web --output-dir /tmp/f4-t8 && rm -rf /tmp/f4-t8` → OK.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src
git commit -m "feat(mobile): zichtbaar-op-slot — SlotKaart/CodeSheet op chat, vandaag, eten"
```

---

### Task 9: Splash naar brand-cream + eindverificatie

**Files:**
- Modify: `apps/mobile/app.json` (splash backgroundColor)

- [ ] **Step 1: Splash-achtergrond naar brand-cream**

In `app.json`, het `expo-splash-screen` plugin-blok: `"backgroundColor": "#F6F3ED"`
(was `#208AEF`). Het icoon blijft; logo-werk is bewust buiten scope.

- [ ] **Step 2: Volledige verificatie**

Run vanaf repo-root:
1. `npm run typecheck -w apps/mobile` → 0 errors
2. `npm test` (of `npx vitest run`) → alle unit-tests groen
3. `npm run test:rls` → alle RLS-tests groen (oud + fase 4)
4. `deno check --node-modules-dir=auto supabase/functions/lau-reply/index.ts` → schoon; daarna `git checkout -- deno.lock`
5. `cd apps/mobile && npx expo export --platform web --output-dir /tmp/f4-final && rm -rf /tmp/f4-final` → OK

- [ ] **Step 3: Handmatige flow-check documenteren voor Jeffrey** (niet zelf uitvoeren — web preview is van Jeffrey)

Schrijf in de commit-message of PR-tekst:
1. `npx expo start` → `w`; uitloggen indien ingelogd.
2. Welkom → Account maken → naam/e-mail/wachtwoord → codescherm verschijnt.
3. Overslaan → onboarding → app: Eten open, Lau.ai op slot, Vandaag deels op slot.
4. Via "Ik heb een code" een testcode verzilveren → alles klapt open.
5. Testcode maken (Supabase SQL-editor): `select public.maak_invite_code((select id from public.coaches where naam = 'Laura'));`

**Jeffrey-stappen (in de eindrapportage vermelden):**
- Supabase dashboard → Authentication → Sign In / Up → Email: **Confirm email UIT** (anders geen sessie direct na registratie).
- Google-login activeren: Google Cloud-project → OAuth consent + Web client-id/secret → Supabase dashboard → Authentication → Providers → Google. (Zonder dit werkt de Google-knop nog niet; de rest van de app wel.)
- Supabase → Authentication → URL Configuration → Redirect URLs: voeg de web-preview-origin + `/login` toe (bijv. `http://localhost:8081/login`), anders is de OAuth-foutafhandeling stil dood.
- `supabase functions deploy lau-reply` (bevat ook de eerdere streaming-fixes).

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app.json
git commit -m "feat(mobile): splash naar brand-cream + fase 4 eindverificatie"
```

---

## Self-review (uitgevoerd bij het schrijven)

- **Spec-dekking:** flow (T6/T7), tiers+slot (T8), datamodel+RPC's (T1), trigger (T1/T2), enforcement (T4), auth e-mail+Google+Apple-achter-vlag (T5/T6), remote config (T1/T5), tests (T3), splash (T9). Codes-via-SQL gedocumenteerd (T9). ✓
- **Geen placeholders:** elke taak heeft complete code of een exacte wijzigingsinstructie. ✓
- **Typeconsistentie:** `verzilver_code(p_code)` / `mijn_tier()` / `maak_invite_code(p_coach)` overal gelijk; `tier: 'free' | 'coached'`; `useConfig` → `{ slotenActief, appleLoginActief }`. ✓
- **Bekende risico's:** corrupte service-key in `.env` blokkeert T2/T3 (Jeffrey moet 'm opnieuw plakken — check vóór T2); `detectSessionInUrl` wijziging (T5) raakt bestaande web-login niet (alleen URL-parsing na redirect).
