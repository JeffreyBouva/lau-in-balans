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
