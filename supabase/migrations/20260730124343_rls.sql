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
