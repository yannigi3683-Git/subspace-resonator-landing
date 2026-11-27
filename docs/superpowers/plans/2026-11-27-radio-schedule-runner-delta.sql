-- Radio SCHEDULE RUNNER, Release 2: database changes for the live project.
-- Paste into the Supabase SQL editor OFF AIR, far from any scheduled show. Every statement is
-- safe to run twice. Mirrors supabase/radio-schema.sql (sections 2, 2b, 6b, 7, 10 and 11). Kept
-- outside supabase/ so grants.test.ts does not read the same grants twice.
--
-- Effect on broadcasts: none until a console is armed. Nothing here changes station, chat or
-- presence rules. The watchdog job runs every minute and does nothing unless SCHEDULE RUNNER
-- said it was on air and then went silent for 5 minutes.
--
-- Step 0 first (read only), and paste the results back:
--   select extname from pg_extension where extname = 'pg_cron';      -- expect one row
--   select policyname from pg_policies where tablename = 'runner_status';  -- expect none yet

-- SCHEDULE RUNNER (Release 2): what the neon line shows during an automatic show.
alter table scheduled_shows add column if not exists neon_mode text not null default 'tracks'
  check (neon_mode in ('tracks', 'title'));

-- 2b. SCHEDULE RUNNER status (singleton). The armed console holds a lease (a random id made per
-- tab, held only in memory) and beats every minute; the host's phone reads it. Writes go only
-- through the runner_* functions below, which use the server clock, so there is no write grant.
-- broadcast_started_at is station.live_session.startedAt, kept as text and compared as text:
-- a host reconnect keeps startedAt but mints a new cfSessionId (spec cycle A9.1).
create table if not exists runner_status (
  id boolean primary key default true check (id),
  lease_id uuid,
  device_label text check (char_length(device_label) <= 40),
  armed boolean not null default false,
  heartbeat_at timestamptz,
  state text not null default 'off'
    check (state in ('off','armed','preflight','starting','on_air','ending','failed')),
  next_show_id uuid,
  broadcast_started_at text check (char_length(broadcast_started_at) <= 40),
  message text check (char_length(message) <= 200),
  updated_at timestamptz not null default now()
);
insert into runner_status (id) values (true) on conflict do nothing;
alter table runner_status enable row level security;

-- 6b. SCHEDULE RUNNER lease. Security definer with an explicit gate: the host with 2FA, or the
-- service role (which can write the table directly anyway; allowing it here is what lets
-- `rls-probe.mjs --selftest` prove the probe can catch a call that went through).
create or replace function runner_caller_ok() returns boolean
language sql stable security definer set search_path = public as $$
  select is_admin_aal2() or coalesce(auth.jwt()->>'role', '') = 'service_role'
$$;

-- Arm: succeeds only if the lease is free, disarmed, already this tab's, or its holder has not
-- beaten for 3 minutes. False means another console holds it.
create or replace function runner_claim(_lease_id uuid, _label text) returns boolean
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not runner_caller_ok() then raise exception 'not allowed' using errcode = '42501'; end if;
  update runner_status
     set lease_id = _lease_id, device_label = left(coalesce(_label, ''), 40), armed = true,
         heartbeat_at = now(), state = 'armed', message = null, updated_at = now()
   where id and (lease_id is null or lease_id = _lease_id or not armed
                 or heartbeat_at is null or heartbeat_at < now() - interval '3 minutes');
  get diagnostics n = row_count;
  return n = 1;
end $$;

-- Heartbeat, once a minute from the armed tab. False means the lease was lost: disarm.
create or replace function runner_beat(_lease_id uuid, _state text, _next uuid, _broadcast text, _message text)
returns boolean
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not runner_caller_ok() then raise exception 'not allowed' using errcode = '42501'; end if;
  update runner_status
     set heartbeat_at = now(), state = _state, next_show_id = _next,
         broadcast_started_at = left(_broadcast, 40), message = left(_message, 200), updated_at = now()
   where id and armed and lease_id = _lease_id;
  get diagnostics n = row_count;
  return n = 1;
end $$;

-- DISARM (and best effort on page unload).
create or replace function runner_release(_lease_id uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not runner_caller_ok() then raise exception 'not allowed' using errcode = '42501'; end if;
  update runner_status
     set armed = false, lease_id = null, state = 'off', next_show_id = null, updated_at = now()
   where id and lease_id = _lease_id;
  get diagnostics n = row_count;
  return n = 1;
end $$;

-- Watchdog (pg_cron, every minute, section 11). Ends a show only when the runner said it was on
-- air, has not beaten for 5 minutes, and the station still holds the runner's OWN broadcast, so a
-- manual show is never touched. Same row change as END BROADCAST. Not callable from the browser.
create or replace function runner_watchdog() returns void
language plpgsql security definer set search_path = public as $$
declare stale runner_status;
begin
  select * into stale from runner_status
   where id and state in ('starting','on_air','ending')
     and broadcast_started_at is not null
     and heartbeat_at < now() - interval '5 minutes';
  if not found then return; end if;
  update station set mode = 'off', live_session = null
   where id and mode = 'live' and live_session->>'startedAt' = stale.broadcast_started_at;
  if found then
    update runner_status
       set state = 'failed', armed = false, updated_at = now(),
           message = 'Watchdog ended the show: no heartbeat for 5 min'
     where id;
  end if;
end $$;

drop policy if exists runner_read on runner_status;
create policy runner_read on runner_status for select using (is_admin_aal2());

-- SCHEDULE RUNNER: the host's phone and console read the row (RLS: admin with 2FA). No write
-- grant: the lease changes only through the functions. New functions are executable by PUBLIC
-- by default, so each one is revoked first and granted back only where it is meant to be.
grant select on runner_status to authenticated;
grant all on runner_status to service_role;
revoke all on function runner_caller_ok() from public, anon;
revoke all on function runner_claim(uuid, text) from public, anon;
revoke all on function runner_beat(uuid, text, uuid, text, text) from public, anon;
revoke all on function runner_release(uuid) from public, anon;
revoke all on function runner_watchdog() from public, anon, authenticated;
grant execute on function runner_caller_ok() to authenticated, service_role;
grant execute on function runner_claim(uuid, text) to authenticated, service_role;
grant execute on function runner_beat(uuid, text, uuid, text, text) to authenticated, service_role;
grant execute on function runner_release(uuid) to authenticated, service_role;
grant execute on function runner_watchdog() to service_role;

-- SCHEDULE RUNNER watchdog, every minute (spec 6.2). Nested so cron.job is only read when
-- pg_cron exists, and loud when it does not: without it a crashed console leaves a silent live room.
do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if not exists (select 1 from cron.job where jobname = 'runner_watchdog') then
      perform cron.schedule('runner_watchdog', '* * * * *', 'select public.runner_watchdog()');
    end if;
  else
    raise notice 'pg_cron is not enabled: the SCHEDULE RUNNER watchdog is NOT scheduled';
  end if;
end $$;

-- Check afterwards (paste the results back):
--   select policyname, cmd, permissive, qual from pg_policies where tablename = 'runner_status';
--     expect exactly one: runner_read, SELECT, PERMISSIVE, is_admin_aal2()
--   select grantee, privilege_type from information_schema.role_table_grants where table_name = 'runner_status';
--     expect authenticated SELECT, plus service_role; no INSERT/UPDATE/DELETE for anon or authenticated
--   select jobname, schedule from cron.job where jobname = 'runner_watchdog';   -- expect '* * * * *'
--   select id, armed, state from runner_status;                                 -- expect t, f, off
-- Then run the security probe: node scripts/rls-probe.mjs (all PASS) and --selftest (SELFTEST OK).
