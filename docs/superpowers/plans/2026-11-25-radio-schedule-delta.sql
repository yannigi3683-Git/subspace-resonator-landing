-- Radio SCHEDULE, Release 1: database changes for the live project.
-- Paste into the Supabase SQL editor OFF AIR. Every statement is safe to run twice.
-- Mirrors supabase/radio-schema.sql (sections 2, 7 and 10). Kept outside supabase/ so
-- grants.test.ts does not read the same grants twice.
--
-- Step 0 first: the policy audit in plans/2026-11-25-radio-schedule.md (Phase 0). Any policy on
-- scheduled_shows other than shows_read and shows_write gets a `drop policy if exists` line below
-- before this is run.

alter table scheduled_shows add column if not exists aired_at timestamptz;
create index if not exists scheduled_shows_starts_idx on scheduled_shows (starts_at);

create or replace function upcoming_shows(_limit int default 3)
returns table (id uuid, title text, starts_at timestamptz)
language sql stable security invoker set search_path = public as $$
  select s.id, s.title, s.starts_at
  from scheduled_shows s
  where s.starts_at > now() - interval '30 minutes' and s.aired_at is null
  order by s.starts_at, s.id
  limit least(greatest(coalesce(_limit, 3), 1), 10)
$$;

grant insert, update, delete on scheduled_shows to authenticated;
grant execute on function upcoming_shows(int) to anon, authenticated;

-- Check afterwards (expect shows_read and shows_write only, and the new grants):
--   select policyname, cmd, permissive, qual, with_check from pg_policies where tablename = 'scheduled_shows';
--   select grantee, privilege_type from information_schema.role_table_grants where table_name = 'scheduled_shows';
--   select * from upcoming_shows(3);
