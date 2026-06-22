-- Subspace Radio — schema (P1, device-first)
-- Run in the Supabase SQL editor for project lgcmbmlapksmdbkhkyyv,
-- AFTER schema.sql (Phase 0: user_roles + has_role) has been applied.
-- Idempotent: safe to re-run.

-- 0. Dependency check
do $$ begin
  if to_regproc('public.has_role') is null then
    raise exception 'Phase 0 missing: run schema.sql first (user_roles + has_role)';
  end if;
end $$;

-- 1. Station singleton
create table if not exists station (
  id boolean primary key default true check (id),
  mode text not null default 'off' check (mode in ('off','live')),
  live_title text check (char_length(live_title) <= 80),
  live_session jsonb,
  slow_mode_s int not null default 3 check (slow_mode_s between 0 and 300),
  locked boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into station (id) values (true) on conflict do nothing;
alter table station enable row level security;

-- 2. Scheduled shows (standby-screen countdown)
create table if not exists scheduled_shows (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 80),
  starts_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table scheduled_shows enable row level security;

-- 3. Moderation
create table if not exists bans (
  uid uuid primary key,
  device_id text not null,
  reason text,
  created_at timestamptz not null default now()
);
alter table bans enable row level security;
create index if not exists bans_device_idx on bans (device_id);

create table if not exists kicks (
  id uuid primary key default gen_random_uuid(),
  uid uuid not null,
  device_id text not null,
  created_at timestamptz not null default now()
);
alter table kicks enable row level security;

-- 4. Chat
create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  uid uuid not null,
  device_id text not null,
  display_name text not null check (char_length(display_name) between 1 and 24),
  avatar_id text not null check (char_length(avatar_id) <= 32),
  body text not null check (char_length(body) between 1 and 500),
  is_host boolean not null default false,
  created_at timestamptz not null default now()
);
alter table chat_messages enable row level security;
create index if not exists chat_messages_created_idx on chat_messages (created_at desc);

-- 5. Admin audit (rows written only by the station trigger)
create table if not exists admin_audit (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  detail jsonb,
  created_at timestamptz not null default now()
);
alter table admin_audit enable row level security;

create or replace function log_station_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into admin_audit (action, detail)
  values ('station_update', jsonb_build_object(
    'mode', new.mode, 'locked', new.locked,
    'slow_mode_s', new.slow_mode_s, 'live_title', new.live_title));
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists station_audit on station;
create trigger station_audit before update on station
  for each row execute function log_station_change();

-- 6. Helpers
create or replace function get_server_time() returns timestamptz
language sql stable set search_path = public as $$ select now() $$;

-- Step-up auth: admin writes require an MFA-elevated session (aal2).
create or replace function is_admin_aal2() returns boolean
language sql stable security definer set search_path = public as $$
  select has_role(auth.uid(), 'admin')
     and coalesce(auth.jwt()->>'aal', 'aal1') = 'aal2'
$$;

create or replace function chat_allowed(_device_id text, _is_host boolean) returns boolean
language sql stable security definer set search_path = public as $$
  select
    (_is_host = has_role(auth.uid(), 'admin'))
    and not exists (
      select 1 from bans b where b.uid = auth.uid() or b.device_id = _device_id)
    and exists (
      select 1 from station s
      where s.mode <> 'off'
        and (not s.locked or has_role(auth.uid(), 'admin')))
    and (
      has_role(auth.uid(), 'admin')
      or not exists (
        select 1 from chat_messages m
        where m.uid = auth.uid()
          and m.created_at > now() - make_interval(secs =>
                (select slow_mode_s from station))))
$$;

-- 7. RLS policies (drop-then-create: valid Postgres, idempotent)
drop policy if exists station_read on station;
create policy station_read on station for select using (true);
drop policy if exists station_write on station;
create policy station_write on station for update
  using (is_admin_aal2()) with check (is_admin_aal2());

drop policy if exists shows_read on scheduled_shows;
create policy shows_read on scheduled_shows for select using (true);
drop policy if exists shows_write on scheduled_shows;
create policy shows_write on scheduled_shows for all
  using (is_admin_aal2()) with check (is_admin_aal2());

drop policy if exists bans_read_own on bans;
create policy bans_read_own on bans for select
  using (uid = auth.uid() or has_role(auth.uid(), 'admin'));
drop policy if exists bans_write on bans;
create policy bans_write on bans for all
  using (is_admin_aal2()) with check (is_admin_aal2());

drop policy if exists kicks_read_own on kicks;
create policy kicks_read_own on kicks for select
  using (uid = auth.uid() or has_role(auth.uid(), 'admin'));
drop policy if exists kicks_write on kicks;
create policy kicks_write on kicks for all
  using (is_admin_aal2()) with check (is_admin_aal2());

drop policy if exists chat_read on chat_messages;
create policy chat_read on chat_messages for select using (true);
drop policy if exists chat_insert on chat_messages;
create policy chat_insert on chat_messages for insert to authenticated
  with check (uid = auth.uid() and chat_allowed(device_id, is_host));
drop policy if exists chat_delete on chat_messages;
create policy chat_delete on chat_messages for delete using (is_admin_aal2());

drop policy if exists audit_read on admin_audit;
create policy audit_read on admin_audit for select
  using (has_role(auth.uid(), 'admin'));

-- 8. postgres_changes publication
do $$ begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and tablename = 'station') then
    alter publication supabase_realtime add table station;
  end if;
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and tablename = 'chat_messages') then
    alter publication supabase_realtime add table chat_messages;
  end if;
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and tablename = 'kicks') then
    alter publication supabase_realtime add table kicks;
  end if;
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and tablename = 'bans') then
    alter publication supabase_realtime add table bans;
  end if;
end $$;

-- 9. Private channel authorization (room:main; JWT required to subscribe;
--    clients may write presence only, never broadcast)
drop policy if exists room_read on realtime.messages;
create policy room_read on realtime.messages for select to authenticated
  using (realtime.topic() = 'room:main');
drop policy if exists room_presence_write on realtime.messages;
create policy room_presence_write on realtime.messages for insert to authenticated
  with check (realtime.topic() = 'room:main' and extension = 'presence');

-- 10. Table-level grants (newer Supabase does not auto-grant on new tables)
grant select on station, scheduled_shows, chat_messages to anon, authenticated;
grant select on bans, kicks to authenticated;
grant select on admin_audit to authenticated;
grant all on station, scheduled_shows, bans, kicks, chat_messages, admin_audit to service_role;
grant execute on function get_server_time() to anon, authenticated;
grant execute on function chat_allowed(text, boolean) to authenticated;
grant execute on function is_admin_aal2() to authenticated;

-- 11. TTL cleanup (pg_cron when available; admin console runs a fallback cleanup)
do $$ begin
  begin
    create extension if not exists pg_cron;
  exception when others then
    raise notice 'pg_cron unavailable: %', sqlerrm;
  end;
end $$;

do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron')
     and not exists (select 1 from cron.job where jobname = 'radio_ttl') then
    perform cron.schedule('radio_ttl', '17 * * * *', $job$
      delete from chat_messages where created_at < now() - interval '48 hours';
      delete from kicks where created_at < now() - interval '1 hour';
    $job$);
  end if;
end $$;
