# Fase 1 — Fundament: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Monorepo-fundament voor Lau in Balans: workspaces, gedeeld domeinpakket, Supabase-schema met RLS en seed-data, en werkende scaffolds voor de Expo klant-app en het Next.js coach-dashboard.

**Architecture:** npm-workspaces-monorepo. `packages/shared` is dependency-vrije TypeScript-source (geen build-stap) die door Metro (Expo), Next (transpilePackages) én later Deno geïmporteerd wordt. Supabase draait lokaal via Docker (`supabase start`); RLS is de beveiligingslaag en wordt met echte ingelogde testgebruikers getest.

**Tech Stack:** npm workspaces · TypeScript (strict) · Vitest · Supabase CLI (lokaal, Postgres + Auth + RLS) · Expo (React Native, Expo Router) · Next.js (App Router, Tailwind) · @supabase/supabase-js

**Spec:** `docs/superpowers/specs/2026-07-30-lau-in-balans-mvp-design.md`

---

## File Structure (eindresultaat van deze fase)

```text
lau-in-balans/
├── package.json                 # workspaces + root-scripts (test, seed, typecheck, verify)
├── tsconfig.base.json           # gedeelde strict-instellingen
├── .gitignore
├── README.md
├── packages/shared/
│   ├── package.json             # @lau/shared, main: src/index.ts (pure TS-source)
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts             # barrel
│       ├── types.ts             # domeintypes + DB-rijtypes (spiegel van het schema)
│       ├── handmaten.ts         # de vier handmaten + default portiedoelen
│       ├── helpers.ts           # weekNummer, telPortiesOp, dagTotaal (TDD)
│       ├── helpers.test.ts
│       └── tokens.ts            # design-tokens uit de handoff (kleuren, radii, fonts)
├── supabase/
│   ├── config.toml              # via `supabase init`
│   └── migrations/
│       ├── <ts>_schema.sql      # 9 tabellen
│       └── <ts>_rls.sql         # RLS + is_coach_of() + realtime-publicatie
├── scripts/
│   ├── local-env.mjs            # leest `supabase status -o env`
│   └── seed.mjs                 # demo-data uit de handoff (via service role)
├── tests/rls/rls.test.ts        # isolatie-tests met echte auth-gebruikers
├── apps/mobile/                 # create-expo-app (default template) + supabase-client
│   ├── lib/supabase.ts
│   ├── lib/domain.ts            # bewijs dat @lau/shared resolvet
│   └── .env.example
└── apps/coach/                  # create-next-app + transpilePackages + supabase env
    └── .env.local.example
```

Conventies: domeintaal Nederlands (zoals spec/handoff), code-idioom Engels waar gangbaar. Commits: `feat|chore|test: ...`.

---

### Task 1: Tooling

**Files:** geen (alleen systeem)

- [ ] **Step 1: Installeer watchman**

Run: `brew install watchman`
Expected: installatie slaagt; `watchman --version` print een versienummer.

- [ ] **Step 2: Verifieer de rest van de toolchain**

Run: `node --version && supabase --version && docker info --format '{{.ServerVersion}}'`
Expected: Node ≥ 20, een Supabase CLI-versie, en een Docker-serverversie (draait al). EAS CLI is pas in fase 6 nodig — niet installeren.

### Task 2: Monorepo-root

**Files:**

- Create: `package.json`, `tsconfig.base.json`, `.gitignore`, `README.md`

- [ ] **Step 1: Schrijf root `package.json`**

```json
{
  "name": "lau-in-balans",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "test": "vitest run packages/shared",
    "test:rls": "vitest run tests/rls",
    "seed": "node scripts/seed.mjs",
    "typecheck": "npm run typecheck --workspaces --if-present",
    "verify": "npm run typecheck && npm run test"
  }
}
```

- [ ] **Step 2: Schrijf `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "strict": true,
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "noUncheckedIndexedAccess": true
  }
}
```

- [ ] **Step 3: Schrijf `.gitignore`**

```gitignore
node_modules/
.expo/
.next/
dist/
build/
*.log
.DS_Store
.env
.env.*
!.env.example
!.env.local.example
supabase/.branches/
supabase/.temp/
```

- [ ] **Step 4: Schrijf `README.md`**

```markdown
# Lau in Balans

AI-assisted voedingscoaching: Expo klant-app (iOS/Android) + Next.js coach-dashboard + Supabase.

- Spec: `docs/superpowers/specs/2026-07-30-lau-in-balans-mvp-design.md`
- Design-referentie: `design_handoff_lau_in_balans/`

## Commands

- `npm run verify` — typecheck alle workspaces + unit-tests
- `npm run test:rls` — RLS-isolatie-tests (vereist `supabase start` + `npm run seed`)
- `npm run seed` — demo-data in lokale Supabase
```

- [ ] **Step 5: Installeer root-devDependencies**

Run: `npm install -D typescript vitest @supabase/supabase-js`
Expected: `package-lock.json` ontstaat, geen errors.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json tsconfig.base.json .gitignore README.md
git commit -m "chore: monorepo-root met workspaces en tooling"
```

### Task 3: packages/shared — scaffold

**Files:**

- Create: `packages/shared/package.json`, `packages/shared/tsconfig.json`, `packages/shared/src/index.ts`

- [ ] **Step 1: Schrijf `packages/shared/package.json`**

```json
{
  "name": "@lau/shared",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": { "typecheck": "tsc --noEmit" }
}
```

- [ ] **Step 2: Schrijf `packages/shared/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "noEmit": true },
  "include": ["src"]
}
```

- [ ] **Step 3: Schrijf `packages/shared/src/index.ts`**

```ts
export * from './types';
export * from './handmaten';
export * from './helpers';
export * from './tokens';
```

(Dit compileert pas na Task 4–6; dat is oké — commit volgt daar.)

### Task 4: shared — domeintypes & handmaten

**Files:**

- Create: `packages/shared/src/types.ts`, `packages/shared/src/handmaten.ts`

- [ ] **Step 1: Schrijf `types.ts`**

```ts
export type HandKey = 'eiwit' | 'groente' | 'koolhydraten' | 'vet';
export type Porties = Record<HandKey, number>;

export type Moment = 'Ontbijt' | 'Lunch' | 'Avondeten' | 'Tussendoor';
export type Sender = 'ai' | 'client' | 'coach';
export type ClientStatus = 'nieuw' | 'actief' | 'stil' | 'gestopt';
export type FlagStatus = 'open' | 'resolved';
export type LogBron = 'chat' | 'eten';
export type NoteType = 'intake' | 'sessie' | 'los';
export type Veiligheidsvlag = 'geen' | 'soms' | 'voorzichtig' | 'overgeslagen';

/** Het gestructureerde per-klant AI-profiel — de personalisatiemotor. */
export interface AIProfile {
  doelen: string[];
  portiedoelen: Porties;
  knelpunten: string[];
  voorkeuren: string[];
  beperkingen: string[];
  checkinRitme: string[];
  aanpak: string;
  toon: string;
  vermijdenInCoaching: string;
  veiligheidsvlag: Veiligheidsvlag;
}

// ── DB-rijtypes (spiegel van supabase/migrations — snake_case zoals Postgres) ──

export interface ClientRow {
  id: string;
  coach_id: string;
  naam: string;
  leeftijd: number | null;
  startdatum: string; // ISO-datum
  status: ClientStatus;
  created_at: string;
}

export interface AiProfileVersionRow {
  id: string;
  client_id: string;
  versie: number;
  profiel: AIProfile;
  author: string | null; // null = system (onboarding)
  created_at: string;
}

export interface MessageRow {
  id: string;
  client_id: string;
  sender: Sender;
  tekst: string | null;
  food_log_id: string | null;
  created_at: string;
  read_at: string | null;
}

export interface FoodLogRow {
  id: string;
  client_id: string;
  datum: string;
  moment: Moment;
  porties: Porties;
  bron: LogBron;
  created_at: string;
}

export interface FlagRow {
  id: string;
  client_id: string;
  tekst: string | null;
  redenen: string[];
  status: FlagStatus;
  created_at: string;
  resolved_by: string | null;
  resolved_at: string | null;
}

export interface CoachNoteRow {
  id: string;
  client_id: string;
  datum: string;
  tekst: string;
  type: NoteType;
  created_at: string;
}

export interface WeeklySessionRow {
  id: string;
  client_id: string;
  datum: string;
  notitie: string;
  signalen: string[];
  voorstellen: unknown; // vorm wordt in fase 5 vastgelegd (session-suggest)
  resulting_profile_version: string | null;
  created_at: string;
}

export interface PushTokenRow {
  client_id: string;
  expo_push_token: string;
  platform: 'ios' | 'android';
  updated_at: string;
}
```

- [ ] **Step 2: Schrijf `handmaten.ts`** (waarden exact uit de handoff)

```ts
import type { HandKey, Porties } from './types';

export interface Handmaat {
  key: HandKey;
  naam: string;
  hand: string;
  uitleg: string;
  dagdoel: number;
  kleur: string;
}

export const HANDMATEN: readonly Handmaat[] = [
  { key: 'eiwit', naam: 'Eiwit', hand: 'Handpalm', uitleg: 'vlees, vis, kwark, tofu', dagdoel: 3, kleur: '#63805F' },
  { key: 'groente', naam: 'Groente', hand: 'Vuist', uitleg: 'alle groente en salade', dagdoel: 4, kleur: '#7E9C6E' },
  { key: 'koolhydraten', naam: 'Koolhydraten', hand: 'Holle hand', uitleg: 'rijst, pasta, brood, aardappel', dagdoel: 2, kleur: '#C1A277' },
  { key: 'vet', naam: 'Vetten', hand: 'Duim', uitleg: 'olie, kaas, avocado, pindakaas', dagdoel: 2, kleur: '#B0603F' },
] as const;

export const PORTIE_DOEL_DEFAULT: Porties = { eiwit: 3, groente: 4, koolhydraten: 2, vet: 2 };
export const LEGE_PORTIES: Porties = { eiwit: 0, groente: 0, koolhydraten: 0, vet: 0 };
```

- [ ] **Step 3: Typecheck (verwacht: faalt alleen nog op ontbrekende helpers/tokens)**

Run: `npm run typecheck -w @lau/shared`
Expected: errors over `./helpers` en `./tokens` (bestaan nog niet) — géén errors in types/handmaten zelf.

### Task 5: shared — helpers (TDD)

**Files:**

- Create: `packages/shared/src/helpers.test.ts`, `packages/shared/src/helpers.ts`

- [ ] **Step 1: Schrijf de failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { dagTotaal, telPortiesOp, weekNummer } from './helpers';
import { LEGE_PORTIES } from './handmaten';

describe('weekNummer', () => {
  it('is 1 op de startdag en de eerste zes dagen', () => {
    expect(weekNummer('2026-07-30', '2026-07-30')).toBe(1);
    expect(weekNummer('2026-07-30', '2026-08-05')).toBe(1);
  });
  it('is 2 op dag 7', () => {
    expect(weekNummer('2026-07-30', '2026-08-06')).toBe(2);
  });
  it('is 4 na drie volle weken', () => {
    expect(weekNummer('2026-07-09', '2026-07-30')).toBe(4);
  });
  it('klemt op 1 als vandaag vóór de startdatum ligt', () => {
    expect(weekNummer('2026-08-01', '2026-07-30')).toBe(1);
  });
});

describe('telPortiesOp', () => {
  it('telt per handmaat op', () => {
    expect(
      telPortiesOp({ eiwit: 1, groente: 2, koolhydraten: 1, vet: 0 }, { eiwit: 1, groente: 0, koolhydraten: 0, vet: 1 }),
    ).toEqual({ eiwit: 2, groente: 2, koolhydraten: 1, vet: 1 });
  });
});

describe('dagTotaal', () => {
  it('sommeert de porties van meerdere logs', () => {
    expect(
      dagTotaal([
        { porties: { eiwit: 1, groente: 2, koolhydraten: 1, vet: 0 } },
        { porties: { eiwit: 1, groente: 1, koolhydraten: 0, vet: 1 } },
      ]),
    ).toEqual({ eiwit: 2, groente: 3, koolhydraten: 1, vet: 1 });
  });
  it('geeft lege porties bij geen logs', () => {
    expect(dagTotaal([])).toEqual(LEGE_PORTIES);
  });
});
```

- [ ] **Step 2: Run tests, verwacht FAIL**

Run: `npx vitest run packages/shared`
Expected: FAIL — `helpers.ts` bestaat niet.

- [ ] **Step 3: Implementeer `helpers.ts`**

```ts
import type { Porties } from './types';
import { LEGE_PORTIES } from './handmaten';

const MS_PER_DAG = 86_400_000;

/** Week N sinds startdatum (1-based). Datums als ISO-strings (YYYY-MM-DD), tijdzone-vrij. */
export function weekNummer(startdatum: string, vandaag: string): number {
  const start = Date.parse(`${startdatum}T00:00:00Z`);
  const nu = Date.parse(`${vandaag}T00:00:00Z`);
  const dagen = Math.floor((nu - start) / MS_PER_DAG);
  return Math.max(1, Math.floor(dagen / 7) + 1);
}

export function telPortiesOp(a: Porties, b: Porties): Porties {
  return {
    eiwit: a.eiwit + b.eiwit,
    groente: a.groente + b.groente,
    koolhydraten: a.koolhydraten + b.koolhydraten,
    vet: a.vet + b.vet,
  };
}

export function dagTotaal(logs: ReadonlyArray<{ porties: Porties }>): Porties {
  return logs.reduce<Porties>((som, log) => telPortiesOp(som, log.porties), LEGE_PORTIES);
}
```

- [ ] **Step 4: Run tests, verwacht PASS**

Run: `npx vitest run packages/shared`
Expected: alle tests PASS.

### Task 6: shared — design-tokens

**Files:**

- Create: `packages/shared/src/tokens.ts`

- [ ] **Step 1: Schrijf `tokens.ts`** (hexwaarden exact uit de handoff-README; namen camelCase)

```ts
/**
 * Design-tokens uit design_handoff_lau_in_balans/README.md.
 * Kleurregel: sage (groen) = klant & voortgang. Clay (terracotta) = uitsluitend
 * coach-aandacht (flags) + de identiteit van Laura-als-mens; nooit decoratie
 * in de klant-app (uitzonderingen: handmaat vetten, Laura-avatar/bubbel).
 */
export const colors = {
  // achtergronden
  bgApp: '#F6F3ED',
  bgSurface: '#FFFFFF',
  bgSurfaceSunken: '#FBF9F5',
  bgNeutralSoft: '#EFEBE2',
  bgNeutralSofter: '#F1EEE7',
  // lijnen
  hairline: '#DCD6CA',
  hairlineSoft: '#E5E0D6',
  hairlineSofter: '#E9E4DA',
  tableRow: '#F1EEE7',
  tableHead: '#EDE8DE',
  dashed: '#D3CCBE',
  // tekst
  ink: '#262A24',
  body: '#5E6259',
  bodySoft: '#6E7168',
  muted: '#8C8F84',
  mutedSoft: '#9A9C91',
  mutedSofter: '#A3A59A',
  // sage (primair accent, klantkant)
  sage: '#63805F',
  sageHover: '#55714F',
  sageDeep: '#4C6749',
  sageDeeper: '#3D5539',
  sageSoft: '#E7EEE3',
  sageSoftBorder: '#CFE0C8',
  sageInk: '#37452F',
  sageMid: '#6D8A68',
  sageTint: '#FBFDFA',
  // clay (alleen coachkant + flags)
  clay: '#B0603F',
  claySoft: '#F6E7E0',
  clayBorder: '#EDD5C9',
  clayInk: '#93472B',
  // Laura-als-mens
  lauraBubbleBg: '#FBEFE8',
  lauraBubbleInk: '#6E4331',
  lauraAvatarBg: '#EFEBE2',
  lauraAvatarInk: '#8C6A56',
  lauraAvatarInkHover: '#765645',
  // handmaten
  foodEiwit: '#63805F',
  foodGroente: '#7E9C6E',
  foodKoolhydraten: '#C1A277',
  foodVet: '#B0603F',
  // overlay
  scrim: 'rgba(38, 42, 36, 0.3)',
} as const;

export const radii = {
  marker: 4,
  bubbleTip: 6,
  controlSm: 12,
  input: 14,
  card: 18,
  cardLg: 20,
  cardXl: 24,
  sheetTop: 30,
  pill: 999,
} as const;

export const fonts = {
  serif: 'Newsreader',
  sans: 'DM Sans',
} as const;
```

- [ ] **Step 2: Typecheck + tests**

Run: `npm run typecheck -w @lau/shared && npx vitest run packages/shared`
Expected: beide PASS (barrel uit Task 3 compileert nu volledig).

- [ ] **Step 3: Commit (Task 3–6 samen: het complete shared-pakket)**

```bash
git add packages/shared
git commit -m "feat: @lau/shared — domeintypes, handmaten, helpers (TDD) en design-tokens"
```

### Task 7: Supabase — schema-migratie

**Files:**

- Create: `supabase/config.toml` (via CLI), `supabase/migrations/<ts>_schema.sql`

- [ ] **Step 1: Initialiseer Supabase**

Run: `supabase init`
Expected: `supabase/config.toml` aangemaakt. (Vragen over VS Code/Deno-settings: nee is prima.)

- [ ] **Step 2: Maak de migratie aan**

Run: `supabase migration new schema`
Expected: leeg bestand `supabase/migrations/<timestamp>_schema.sql`.

- [ ] **Step 3: Schrijf het schema in dat bestand**

```sql
-- Lau in Balans — kernschema. Multi-coach vanaf dag één (spec).

create table public.coaches (
  id uuid primary key references auth.users (id) on delete cascade,
  naam text not null,
  created_at timestamptz not null default now()
);

create table public.clients (
  id uuid primary key references auth.users (id) on delete cascade,
  coach_id uuid not null references public.coaches (id),
  naam text not null,
  leeftijd int,
  startdatum date not null default current_date,
  status text not null default 'nieuw'
    check (status in ('nieuw', 'actief', 'stil', 'gestopt')),
  created_at timestamptz not null default now()
);

-- Append-only profielhistorie; de hoogste versie is het actieve profiel.
-- Uniciteit op DB-niveau: gelijktijdige schrijvers kunnen geen dubbele versie maken.
create table public.ai_profile_versions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  versie int not null check (versie >= 1),
  profiel jsonb not null,
  author uuid references public.coaches (id), -- null = system (onboarding)
  created_at timestamptz not null default now(),
  unique (client_id, versie)
);

create table public.food_logs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  datum date not null default current_date,
  moment text not null check (moment in ('Ontbijt', 'Lunch', 'Avondeten', 'Tussendoor')),
  porties jsonb not null,
  bron text not null check (bron in ('chat', 'eten')),
  created_at timestamptz not null default now()
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  sender text not null check (sender in ('ai', 'client', 'coach')),
  tekst text,
  food_log_id uuid references public.food_logs (id) on delete set null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  check (tekst is not null or food_log_id is not null)
);

create table public.flags (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  tekst text,
  redenen text[] not null default '{}',
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now(),
  resolved_by uuid references public.coaches (id),
  resolved_at timestamptz
);

create table public.coach_notes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  datum date not null default current_date,
  tekst text not null,
  type text not null default 'los' check (type in ('intake', 'sessie', 'los')),
  created_at timestamptz not null default now()
);

create table public.weekly_sessions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  datum date not null default current_date,
  notitie text not null default '',
  signalen text[] not null default '{}',
  voorstellen jsonb not null default '[]',
  resulting_profile_version uuid references public.ai_profile_versions (id),
  created_at timestamptz not null default now()
);

create table public.push_tokens (
  client_id uuid not null references public.clients (id) on delete cascade,
  expo_push_token text not null,
  platform text not null check (platform in ('ios', 'android')),
  updated_at timestamptz not null default now(),
  primary key (client_id, expo_push_token)
);

create index messages_client_created_idx on public.messages (client_id, created_at desc);
create index food_logs_client_datum_idx on public.food_logs (client_id, datum desc);
create index flags_client_status_idx on public.flags (client_id, status);
create index clients_coach_idx on public.clients (coach_id);
```

- [ ] **Step 4: Start lokale Supabase en pas de migratie toe**

Run: `supabase start && supabase db reset`
Expected: beide slagen; `db reset` meldt het toepassen van de schema-migratie. (Eerste `start` downloadt images — kan even duren.)

- [ ] **Step 5: Verifieer dat de tabellen bestaan**

Run: `docker exec supabase_db_lau-in-balans psql -U postgres -c "\dt public.*"`
Expected: de 9 tabellen uit Step 3.

- [ ] **Step 6: Commit**

```bash
git add supabase/
git commit -m "feat: supabase-schema — 9 tabellen, versioned AI-profiel, indexes"
```

### Task 8: Supabase — RLS-migratie

**Files:**

- Create: `supabase/migrations/<ts>_rls.sql` (via `supabase migration new rls`)

- [ ] **Step 1: Maak de migratie aan**

Run: `supabase migration new rls`

- [ ] **Step 2: Schrijf de RLS-policies**

```sql
-- RLS: klant ziet uitsluitend zichzelf; coach uitsluitend eigen klanten.
-- Edge Functions gebruiken de service role en omzeilen RLS bewust.

alter table public.coaches enable row level security;
alter table public.clients enable row level security;
alter table public.ai_profile_versions enable row level security;
alter table public.messages enable row level security;
alter table public.food_logs enable row level security;
alter table public.flags enable row level security;
alter table public.coach_notes enable row level security;
alter table public.weekly_sessions enable row level security;
alter table public.push_tokens enable row level security;

-- security definer: voorkomt recursieve RLS-evaluatie op clients in elke policy
create or replace function public.is_coach_of(p_client uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from clients c where c.id = p_client and c.coach_id = auth.uid()
  );
$$;

-- coaches
create policy coach_leest_zichzelf on public.coaches
  for select using (id = auth.uid());

-- clients
create policy klant_leest_zichzelf on public.clients
  for select using (id = auth.uid());
create policy coach_leest_klanten on public.clients
  for select using (coach_id = auth.uid());
create policy coach_wijzigt_klanten on public.clients
  for update using (coach_id = auth.uid());

-- messages
create policy klant_leest_eigen_berichten on public.messages
  for select using (client_id = auth.uid());
create policy klant_stuurt_als_klant on public.messages
  for insert with check (client_id = auth.uid() and sender = 'client');
create policy coach_leest_berichten on public.messages
  for select using (public.is_coach_of(client_id));
create policy coach_stuurt_als_coach on public.messages
  for insert with check (public.is_coach_of(client_id) and sender = 'coach');

-- food_logs
create policy klant_leest_eigen_logs on public.food_logs
  for select using (client_id = auth.uid());
create policy klant_schrijft_eigen_logs on public.food_logs
  for insert with check (client_id = auth.uid());
create policy coach_leest_logs on public.food_logs
  for select using (public.is_coach_of(client_id));

-- flags
create policy klant_leest_eigen_flags on public.flags
  for select using (client_id = auth.uid());
create policy klant_maakt_flag on public.flags
  for insert with check (client_id = auth.uid() and status = 'open');
create policy coach_leest_flags on public.flags
  for select using (public.is_coach_of(client_id));
create policy coach_rondt_flag_af on public.flags
  for update using (public.is_coach_of(client_id));

-- ai_profile_versions: klant schrijft alléén versie 1 (onboarding, author=system);
-- lezen is coach-only — het profiel is Laura's gereedschap, niet klant-UI.
create policy klant_schrijft_versie_1 on public.ai_profile_versions
  for insert with check (client_id = auth.uid() and versie = 1 and author is null);
create policy coach_leest_profielen on public.ai_profile_versions
  for select using (public.is_coach_of(client_id));
create policy coach_schrijft_profiel on public.ai_profile_versions
  for insert with check (public.is_coach_of(client_id) and author = auth.uid());

-- coach_notes & weekly_sessions: coach-only
create policy coach_leest_notities on public.coach_notes
  for select using (public.is_coach_of(client_id));
create policy coach_schrijft_notitie on public.coach_notes
  for insert with check (public.is_coach_of(client_id));
create policy coach_leest_sessies on public.weekly_sessions
  for select using (public.is_coach_of(client_id));
create policy coach_schrijft_sessie on public.weekly_sessions
  for insert with check (public.is_coach_of(client_id));

-- push_tokens: klant beheert eigen tokens
create policy klant_beheert_push_tokens on public.push_tokens
  for all using (client_id = auth.uid()) with check (client_id = auth.uid());

-- realtime voor chat en flags
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.flags;
```

- [ ] **Step 3: Pas toe en verifieer**

Run: `supabase db reset && docker exec supabase_db_lau-in-balans psql -U postgres -c "select tablename, count(*) from pg_policies where schemaname='public' group by tablename order by tablename;"`
Expected: reset slaagt; alle 9 tabellen hebben ≥ 1 policy (coaches 1, clients 3, messages 4, …).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/
git commit -m "feat: RLS-policies — klant/coach-isolatie + realtime-publicatie"
```

### Task 9: Seed-script met handoff-demodata

**Files:**

- Create: `scripts/local-env.mjs`, `scripts/seed.mjs`

- [ ] **Step 1: Schrijf `scripts/local-env.mjs`**

```js
import { execSync } from 'node:child_process';

/** Leest URL + keys van de draaiende lokale Supabase via `supabase status`. */
export function localSupabaseEnv() {
  const out = execSync('supabase status -o env', { encoding: 'utf8' });
  const vars = {};
  for (const line of out.split('\n')) {
    const m = line.match(/^([A-Z_]+)="?([^"]*)"?$/);
    if (m) vars[m[1]] = m[2];
  }
  const url = vars.API_URL ?? vars.SUPABASE_URL;
  const anonKey = vars.ANON_KEY ?? vars.SUPABASE_ANON_KEY;
  const serviceKey = vars.SERVICE_ROLE_KEY ?? vars.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceKey) {
    throw new Error('Kon lokale Supabase-env niet lezen — draait `supabase start`?');
  }
  return { url, anonKey, serviceKey };
}
```

- [ ] **Step 2: Schrijf `scripts/seed.mjs`**

Demo-data exact uit de handoff (klantenlijst, Sanne's transcript, profiel, logs, flags, notities). Wachtwoord voor alle demo-accounts: `demo-demo-2026`. E-mails eindigen op `@demo.lauinbalans.nl`; het script wist eerst alle bestaande demo-users (cascade ruimt domeinrijen op).

```js
import { createClient } from '@supabase/supabase-js';
import { localSupabaseEnv } from './local-env.mjs';

const { url, serviceKey } = localSupabaseEnv();
const db = createClient(url, serviceKey, { auth: { persistSession: false } });

const WACHTWOORD = 'demo-demo-2026';
const DOMEIN = 'demo.lauinbalans.nl';

const isoDatum = (d) => d.toISOString().slice(0, 10);
const dagenGeleden = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
};
const urenGeleden = (n) => new Date(Date.now() - n * 3_600_000).toISOString();

async function wisDemoUsers() {
  const { data, error } = await db.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  for (const user of data.users) {
    if (user.email?.endsWith(`@${DOMEIN}`)) {
      await db.auth.admin.deleteUser(user.id); // cascade wist coaches/clients + kinderen
    }
  }
}

async function maakUser(email, naam) {
  const { data, error } = await db.auth.admin.createUser({
    email: `${email}@${DOMEIN}`,
    password: WACHTWOORD,
    email_confirm: true,
    user_metadata: { naam },
  });
  if (error) throw error;
  return data.user.id;
}

async function invoeg(tabel, rows) {
  const { data, error } = await db.from(tabel).insert(rows).select();
  if (error) throw new Error(`${tabel}: ${error.message}`);
  return data;
}

await wisDemoUsers();

// ── Coaches ──
const lauraId = await maakUser('laura', 'Laura');
const beaId = await maakUser('bea', 'Bea'); // tweede coach: alleen voor RLS-isolatie-tests
await invoeg('coaches', [
  { id: lauraId, naam: 'Laura' },
  { id: beaId, naam: 'Bea' },
]);

// ── Klanten (handoff-klantenlijst; week N → startdatum) ──
const klantSpecs = [
  { email: 'sanne', naam: 'Sanne Vermeer', leeftijd: 38, week: 3, status: 'actief' },
  { email: 'iris', naam: 'Iris de Wit', leeftijd: 41, week: 7, status: 'actief' },
  { email: 'fleur', naam: 'Fleur Bakker', leeftijd: 33, week: 2, status: 'actief' },
  { email: 'marieke', naam: 'Marieke Jansen', leeftijd: 44, week: 11, status: 'actief' },
  { email: 'noor', naam: 'Noor El Amrani', leeftijd: 29, week: 1, status: 'nieuw' },
  { email: 'esther', naam: 'Esther Kok', leeftijd: 36, week: 9, status: 'stil' },
];
const klanten = {};
for (const spec of klantSpecs) {
  const id = await maakUser(spec.email, spec.naam);
  klanten[spec.email] = id;
  await invoeg('clients', [{
    id,
    coach_id: lauraId,
    naam: spec.naam,
    leeftijd: spec.leeftijd,
    startdatum: isoDatum(dagenGeleden((spec.week - 1) * 7 + 1)),
    status: spec.status,
  }]);
}
const sanne = klanten.sanne;

// ── Sanne: AI-profiel v1 (demo-profiel uit de handoff) ──
await invoeg('ai_profile_versions', [{
  client_id: sanne,
  versie: 1,
  author: null,
  profiel: {
    doelen: ['Duurzaam afvallen', '± 6 kg in 6 maanden', 'Energie voor het gezin'],
    portiedoelen: { eiwit: 3, groente: 4, koolhydraten: 2, vet: 2 },
    knelpunten: ['Avond na het eten', 'Donderdag: partner werkt laat'],
    voorkeuren: ['3 maaltijden', 'Weinig vlees', 'Geen vis', 'Max 25 min'],
    beperkingen: ['Noten-allergie', 'Geen medicatie'],
    checkinRitme: ["'s ochtends kort", "'s avonds op eigen initiatief", 'Duwtje na 3 stille dagen'],
    aanpak: 'Geen calorieën tellen, geen weegmomenten in de chat. Focus op maaltijdstructuur, avondroutine en handmaten.',
    toon: 'Warm en direct. Korte berichten. Geen wollige complimenten — Sanne prikt daar doorheen.',
    vermijdenInCoaching: 'Niet openen met gewicht of getallen. Geen strakke weekschema’s. Voorzichtig met lichaamsbeeld.',
    veiligheidsvlag: 'soms',
  },
}]);

// ── Sanne: voedingslogs deze week (5 dagen gelogd, conform handoff) ──
for (const n of [6, 5, 4, 2, 1]) {
  await invoeg('food_logs', [{
    client_id: sanne,
    datum: isoDatum(dagenGeleden(n)),
    moment: 'Avondeten',
    porties: { eiwit: 1, groente: 2, koolhydraten: 1, vet: 1 },
    bron: 'eten',
  }]);
}
const [lunchLog] = await invoeg('food_logs', [{
  client_id: sanne,
  datum: isoDatum(dagenGeleden(0)),
  moment: 'Lunch',
  porties: { eiwit: 1, groente: 2, koolhydraten: 1, vet: 0 },
  bron: 'chat',
}]);

// ── Sanne: transcript (handoff coach-meeleesscherm, 8 items) ──
const transcript = [
  ['ai', 'Goedemorgen Sanne. Gisteren zei je dat de avonden het moeilijkst zijn — hoe ging het na het eten?', 8],
  ['client', 'Verrassend rustig eigenlijk. Ik heb thee gezet in plaats van de koekjestrommel gepakt.', 7],
  ['log', null, 6],
  ['ai', 'Mooie lunch — handpalm eiwit en twee vuisten groente. Als je vanmiddag nog trek krijgt, is dat meestal het eiwit. Kwark of een handje kip erbij doet meer dan je denkt.', 6],
  ['client', 'Dank je. Donderdag wordt lastig, dan werkt Jeroen laat en eet ik met de kinderen mee.', 5],
  ['ai', 'Dat hoeft geen probleem te zijn. Zal ik woensdag een maaltijd voorstellen die de kinderen ook eten, zodat je donderdag geen apart plan nodig hebt?', 4],
  ['client', 'Graag. Ik wil trouwens even met een mens praten over het weekend.', 2],
];
for (const [sender, tekst, urenTerug] of transcript) {
  await invoeg('messages', [{
    client_id: sanne,
    sender: sender === 'log' ? 'client' : sender,
    tekst,
    food_log_id: sender === 'log' ? lunchLog.id : null,
    created_at: urenGeleden(urenTerug),
  }]);
}

// ── Laatste berichten van de andere klanten (handoff-klantenlijst) ──
const laatste = [
  ['iris', 'client', 'Lau snapt niet dat ik nachtdiensten heb.'],
  ['fleur', 'ai', 'Mooi dat je de lunch hebt voorbereid.'],
  ['marieke', 'client', 'Heb je recepten voor het weekend?'],
  ['noor', 'ai', 'Welkom Noor — je intake is afgerond. Laura stelt je profiel deze week bij.'],
  ['esther', 'ai', 'Ik hoor al vier dagen niets — zal ik het morgen rustig aan doen met vragen?'],
];
for (const [email, sender, tekst] of laatste) {
  await invoeg('messages', [{ client_id: klanten[email], sender, tekst, created_at: urenGeleden(20) }]);
}

// ── Open flags: Sanne (2 uur geleden) en Iris ──
await invoeg('flags', [
  { client_id: sanne, tekst: 'Ik wil even met een mens praten over het weekend.', redenen: ['Het weekend'], created_at: urenGeleden(2) },
  { client_id: klanten.iris, tekst: 'Lau snapt niet dat ik nachtdiensten heb.', redenen: ['Ik twijfel aan het advies'], created_at: urenGeleden(20) },
]);

// ── Notities voor Sanne (handoff) ──
await invoeg('coach_notes', [
  { client_id: sanne, datum: isoDatum(dagenGeleden(7)), tekst: 'Wil rust rond eten, niet nóg een schema. Werkt drie dagen, kinderen van 4 en 7. Avonden zijn het knelpunt.', type: 'sessie' },
  { client_id: sanne, datum: isoDatum(dagenGeleden(14)), tekst: 'Twee keer eerder een dieet met jojo-effect. Noten-allergie. Geen rode vlaggen, lichaamsbeeld ligt gevoelig.', type: 'intake' },
]);

const tellingen = {};
for (const tabel of ['coaches', 'clients', 'ai_profile_versions', 'messages', 'food_logs', 'flags', 'coach_notes']) {
  const { count } = await db.from(tabel).select('*', { count: 'exact', head: true });
  tellingen[tabel] = count;
}
console.log('Seed klaar:', tellingen);
```

- [ ] **Step 3: Run de seed**

Run: `npm run seed`
Expected: `Seed klaar: { coaches: 2, clients: 6, ai_profile_versions: 1, messages: 12, food_logs: 6, flags: 2, coach_notes: 2 }`

- [ ] **Step 4: Run nogmaals (idempotentie-check)**

Run: `npm run seed`
Expected: zelfde tellingen — geen duplicaten.

- [ ] **Step 5: Commit**

```bash
git add scripts/
git commit -m "feat: seed-script met demo-data uit de design handoff"
```

### Task 10: RLS-isolatie-tests

**Files:**

- Create: `tests/rls/rls.test.ts`

- [ ] **Step 1: Schrijf de tests**

```ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { beforeAll, describe, expect, it } from 'vitest';
// @ts-expect-error — plain ESM zonder types
import { localSupabaseEnv } from '../../scripts/local-env.mjs';

const WACHTWOORD = 'demo-demo-2026';
const DOMEIN = 'demo.lauinbalans.nl';

let url: string;
let anonKey: string;
let sanneId: string;
let irisId: string;

async function ingelogd(email: string): Promise<SupabaseClient> {
  const client = createClient(url, anonKey, { auth: { persistSession: false } });
  const { error } = await client.auth.signInWithPassword({
    email: `${email}@${DOMEIN}`,
    password: WACHTWOORD,
  });
  if (error) throw error;
  return client;
}

beforeAll(async () => {
  const env = localSupabaseEnv();
  url = env.url;
  anonKey = env.anonKey;
  const service = createClient(url, env.serviceKey, { auth: { persistSession: false } });
  const { data, error } = await service.from('clients').select('id, naam');
  if (error) throw error;
  sanneId = data.find((c) => c.naam === 'Sanne Vermeer')!.id;
  irisId = data.find((c) => c.naam === 'Iris de Wit')!.id;
});

describe('klant-isolatie (Sanne)', () => {
  it('ziet alleen zichzelf in clients', async () => {
    const sanne = await ingelogd('sanne');
    const { data } = await sanne.from('clients').select('naam');
    expect(data).toEqual([{ naam: 'Sanne Vermeer' }]);
  });

  it('ziet geen berichten van Iris', async () => {
    const sanne = await ingelogd('sanne');
    const { data } = await sanne.from('messages').select('id').eq('client_id', irisId);
    expect(data).toEqual([]);
  });

  it('kan geen bericht namens Iris sturen', async () => {
    const sanne = await ingelogd('sanne');
    const { error } = await sanne.from('messages').insert({ client_id: irisId, sender: 'client', tekst: 'hack' });
    expect(error).not.toBeNull();
  });

  it('kan zich niet als AI voordoen', async () => {
    const sanne = await ingelogd('sanne');
    const { error } = await sanne.from('messages').insert({ client_id: sanneId, sender: 'ai', tekst: 'nep' });
    expect(error).not.toBeNull();
  });

  it('kan geen AI-profielen lezen', async () => {
    const sanne = await ingelogd('sanne');
    const { data } = await sanne.from('ai_profile_versions').select('id');
    expect(data).toEqual([]);
  });
});

describe('coach-toegang (Laura)', () => {
  it('ziet alle zes klanten', async () => {
    const laura = await ingelogd('laura');
    const { data } = await laura.from('clients').select('id');
    expect(data).toHaveLength(6);
  });

  it('leest Sannes berichten en profiel', async () => {
    const laura = await ingelogd('laura');
    const { data: berichten } = await laura.from('messages').select('id').eq('client_id', sanneId);
    expect(berichten!.length).toBeGreaterThan(0);
    const { data: profielen } = await laura.from('ai_profile_versions').select('versie').eq('client_id', sanneId);
    expect(profielen).toEqual([{ versie: 1 }]);
  });
});

describe('coach-isolatie (Bea, geen klanten)', () => {
  it('ziet geen klanten en geen berichten', async () => {
    const bea = await ingelogd('bea');
    const { data: klanten } = await bea.from('clients').select('id');
    expect(klanten).toEqual([]);
    const { data: berichten } = await bea.from('messages').select('id').eq('client_id', sanneId);
    expect(berichten).toEqual([]);
  });
});

describe('anoniem', () => {
  it('ziet niets', async () => {
    const anon = createClient(url, anonKey, { auth: { persistSession: false } });
    const { data } = await anon.from('clients').select('id');
    expect(data).toEqual([]);
  });
});
```

- [ ] **Step 2: Run de tests**

Run: `npm run test:rls`
Expected: alle tests PASS (vereist draaiende `supabase start` + verse `npm run seed`).

- [ ] **Step 3: Commit**

```bash
git add tests/
git commit -m "test: RLS-isolatie — klant/coach/anoniem tegen lokale Supabase"
```

### Task 11: apps/mobile — Expo-scaffold

**Files:**

- Create: `apps/mobile/` (via create-expo-app), `apps/mobile/lib/supabase.ts`, `apps/mobile/lib/domain.ts`, `apps/mobile/.env.example`
- Modify: `apps/mobile/package.json` (scripts + workspace-dep)

- [ ] **Step 1: Scaffold de Expo-app**

Run (vanaf de repo-root): `npx create-expo-app@latest apps/mobile --template default --no-install`
Expected: `apps/mobile/` met expo-router-template (TypeScript).

- [ ] **Step 2: Koppel workspaces en installeer**

Voeg in `apps/mobile/package.json` toe aan `"dependencies"`: `"@lau/shared": "*"` en aan `"scripts"`: `"typecheck": "tsc --noEmit"`.
Run (root): `npm install`
Expected: workspace-symlink `node_modules/@lau/shared` bestaat.

- [ ] **Step 3: Installeer Supabase-dependencies**

Run: `cd apps/mobile && npx expo install @react-native-async-storage/async-storage && npm i @supabase/supabase-js react-native-url-polyfill && cd ../..`
Expected: versies zonder conflictfouten (expo install kiest de SDK-compatibele async-storage).

- [ ] **Step 4: Schrijf `apps/mobile/lib/supabase.ts` en `.env.example`**

```ts
import 'react-native-url-polyfill/auto';
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
    detectSessionInUrl: false,
  },
});
```

`.env.example` (lokale waarden komen uit `supabase status`; iOS-simulator kan bij `127.0.0.1`, een fysiek toestel niet — dat is pas relevant bij het cloud-project):

```bash
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon key uit `supabase status`>
```

- [ ] **Step 5: Schrijf `apps/mobile/lib/domain.ts`** (bewijst dat Metro @lau/shared resolvet)

```ts
export { HANDMATEN, PORTIE_DOEL_DEFAULT, LEGE_PORTIES, colors, radii, fonts } from '@lau/shared';
export type { HandKey, Porties, Moment, AIProfile, MessageRow, FoodLogRow } from '@lau/shared';
```

- [ ] **Step 6: Typecheck + bundel-smoketest**

Run: `npm run typecheck -w apps/mobile && cd apps/mobile && npx expo export --platform ios --output-dir /tmp/expo-export-check && cd ../..`
Expected: typecheck PASS; `expo export` bundelt zonder errors (bewijst dat Metro het monorepo + shared-pakket aankan). Faalt de export op de env-check uit Step 4: een `.env` met de example-waarden plaatsen is voldoende.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile package-lock.json
git commit -m "feat: Expo-scaffold klant-app met supabase-client en @lau/shared-koppeling"
```

### Task 12: apps/coach — Next.js-scaffold

**Files:**

- Create: `apps/coach/` (via create-next-app), `apps/coach/.env.local.example`, `apps/coach/src/lib/supabase.ts`
- Modify: `apps/coach/next.config.ts`, `apps/coach/package.json`

- [ ] **Step 1: Scaffold de Next-app**

Run (root): `npx create-next-app@latest apps/coach --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --turbopack --use-npm --skip-install`
Expected: `apps/coach/` met App Router + Tailwind.

- [ ] **Step 2: Workspace-dep + scripts + transpile**

In `apps/coach/package.json`: voeg `"@lau/shared": "*"` toe aan dependencies, `"@supabase/supabase-js"` eveneens, en `"typecheck": "tsc --noEmit"` aan scripts.
In `apps/coach/next.config.ts`:

```ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@lau/shared'],
};

export default nextConfig;
```

Run (root): `npm install`

- [ ] **Step 3: Schrijf `apps/coach/src/lib/supabase.ts` en `.env.local.example`**

```ts
import { createClient } from '@supabase/supabase-js';
import { colors } from '@lau/shared'; // bewijst transpilePackages; echte UI volgt in fase 4

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL en NEXT_PUBLIC_SUPABASE_ANON_KEY zijn verplicht — zie .env.local.example');
}

export const supabase = createClient(url, anonKey);
export const brandSage = colors.sage;
```

`.env.local.example`:

```bash
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key uit `supabase status`>
```

- [ ] **Step 4: Build-smoketest**

Run: `cp apps/coach/.env.local.example apps/coach/.env.local` → vul de echte anon key in (uit `supabase status`) → `npm run build -w apps/coach`
Expected: build PASS. (`supabase.ts` wordt nog nergens geïmporteerd, dus de env-check kan de build niet breken — de build bewijst vooral dat het scaffold en transpilePackages kloppen.)

- [ ] **Step 5: Commit**

```bash
git add apps/coach package-lock.json
git commit -m "feat: Next.js-scaffold coach-dashboard met supabase-client en @lau/shared"
```

### Task 13: Eindverificatie fase 1

**Files:**

- Modify: `README.md` (alleen indien commands afwijken)

- [ ] **Step 1: Volledige verificatie vanaf schoon**

Run: `supabase db reset && npm run seed && npm run verify && npm run test:rls`
Expected: alles PASS — schema + policies vers toegepast, seed idempotent, typecheck van alle drie de workspaces groen, unit- en RLS-tests groen.

- [ ] **Step 2: Commit (alleen bij README-wijzigingen) en afronden**

```bash
git add README.md && git commit -m "docs: verificatiecommando's fase 1" || true
```

Definition of done fase 1: `npm run verify` en `npm run test:rls` slagen op een schone checkout met draaiende Docker; beide app-scaffolds bouwen; de seed toont de handoff-demodata in Supabase Studio (`supabase status` → Studio-URL).
