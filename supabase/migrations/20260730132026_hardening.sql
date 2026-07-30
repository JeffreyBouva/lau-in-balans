-- Hardening na security-review fase 1.
-- Fixt: search_path-hijack op is_coach_of (C1), ontbrekende WITH CHECK op
-- update-policies (I4/I5), FK-acties voor AVG-verwijdering (I6), ontbrekende
-- indexes (I7), tijdzone-correcte datumdefaults (I8), push-token-uniciteit (I11),
-- plus enkele policy-gaten (klant leest eigen coach, klant beheert eigen logs).

-- ── C1: is_coach_of — lege search_path sluit de pg_temp-hijack ──
create or replace function public.is_coach_of(p_client uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.clients c
    where c.id = p_client and c.coach_id = auth.uid()
  );
$$;
revoke execute on function public.is_coach_of(uuid) from public, anon;
grant execute on function public.is_coach_of(uuid) to authenticated;
revoke temporary on database postgres from public;

-- ── I4: flag alleen open→resolved, met correcte auteur ──
drop policy klant_maakt_flag on public.flags;
create policy klant_maakt_flag on public.flags
  for insert with check (
    client_id = auth.uid() and status = 'open'
    and resolved_by is null and resolved_at is null
  );

drop policy coach_rondt_flag_af on public.flags;
create policy coach_rondt_flag_af on public.flags
  for update using (public.is_coach_of(client_id) and status = 'open')
  with check (
    public.is_coach_of(client_id)
    and status = 'resolved'
    and resolved_by = auth.uid()
    and resolved_at is not null
  );

-- ── I5: clients — coach mag alleen status/naam/leeftijd wijzigen ──
drop policy coach_wijzigt_klanten on public.clients;
create policy coach_wijzigt_klanten on public.clients
  for update using (coach_id = auth.uid())
  with check (coach_id = auth.uid());

create or replace function public.clients_guard_update()
returns trigger language plpgsql as $$
begin
  if new.id <> old.id
     or new.coach_id <> old.coach_id
     or new.startdatum <> old.startdatum
     or new.created_at <> old.created_at then
    raise exception 'clients: id, coach_id, startdatum en created_at zijn niet wijzigbaar';
  end if;
  return new;
end;
$$;
create trigger clients_guard_update before update on public.clients
  for each row execute function public.clients_guard_update();

-- ── klant leest de naam van de eigen coach (voor "je coach: Laura") ──
create policy klant_leest_eigen_coach on public.coaches
  for select using (
    exists (select 1 from public.clients c
            where c.coach_id = coaches.id and c.id = auth.uid())
  );

-- ── klant corrigeert eigen voedingslogs (eten-tab) ──
create policy klant_wijzigt_eigen_logs on public.food_logs
  for update using (client_id = auth.uid()) with check (client_id = auth.uid());
create policy klant_wist_eigen_logs on public.food_logs
  for delete using (client_id = auth.uid());

-- ── I6: historische auteur/afhandelaar loskoppelen bij coach-verwijdering ──
alter table public.ai_profile_versions
  drop constraint ai_profile_versions_author_fkey,
  add constraint ai_profile_versions_author_fkey
    foreign key (author) references public.coaches (id) on delete set null;
alter table public.flags
  drop constraint flags_resolved_by_fkey,
  add constraint flags_resolved_by_fkey
    foreign key (resolved_by) references public.coaches (id) on delete set null;

-- ── I7: indexes voor bewezen hot paths ──
create index coach_notes_client_datum_idx on public.coach_notes (client_id, datum desc);
create index weekly_sessions_client_datum_idx on public.weekly_sessions (client_id, datum desc);
create index messages_unread_idx on public.messages (client_id) where read_at is null;
create index flags_open_idx on public.flags (created_at desc) where status = 'open';
create index messages_food_log_idx on public.messages (food_log_id);

-- ── I8: datumdefaults in Europe/Amsterdam ──
alter table public.clients         alter column startdatum set default ((now() at time zone 'Europe/Amsterdam')::date);
alter table public.food_logs       alter column datum      set default ((now() at time zone 'Europe/Amsterdam')::date);
alter table public.coach_notes     alter column datum      set default ((now() at time zone 'Europe/Amsterdam')::date);
alter table public.weekly_sessions alter column datum      set default ((now() at time zone 'Europe/Amsterdam')::date);

-- ── I11: één device-token hoort bij één klant ──
alter table public.push_tokens add constraint push_tokens_token_unique unique (expo_push_token);
