-- Subspace Resonator — Supabase schema
-- Run this once in the Supabase SQL editor for project mswpvgfjtfxpcldozcvc.
-- Idempotent: safe to re-run (uses IF NOT EXISTS / OR REPLACE where possible).

-- 1. Admin role enum
create type if not exists app_role as enum ('admin');

-- 2. User-role mapping (references Supabase auth.users)
create table if not exists user_roles (
  user_id uuid references auth.users on delete cascade,
  role    app_role not null,
  primary key (user_id, role)
);
alter table user_roles enable row level security;

-- 3. Helper function: has_role()
create or replace function has_role(_user_id uuid, _role app_role)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists(
    select 1 from user_roles
    where user_id = _user_id and role = _role
  )
$$;

-- 4. Content table — single JSONB document ("singleton" row)
create table if not exists site_content (
  id         text primary key default 'singleton',
  data       jsonb not null default '{}',
  updated_at timestamptz not null default now()
);
alter table site_content enable row level security;

-- Everyone can read
create policy if not exists read_all
  on site_content for select
  using (true);

-- Only admins can write
create policy if not exists admin_write
  on site_content for all
  using (has_role(auth.uid(), 'admin'))
  with check (has_role(auth.uid(), 'admin'));

-- 5. Gallery storage bucket (public)
insert into storage.buckets (id, name, public)
values ('gallery', 'gallery', true)
on conflict (id) do nothing;

create policy if not exists gal_read
  on storage.objects for select
  using (bucket_id = 'gallery');

create policy if not exists gal_write
  on storage.objects for insert
  with check (bucket_id = 'gallery' and has_role(auth.uid(), 'admin'));

create policy if not exists gal_del
  on storage.objects for delete
  using (bucket_id = 'gallery' and has_role(auth.uid(), 'admin'));

-- After running this schema:
-- 1. In Supabase Dashboard → Authentication → Users, create Yanni's account
--    with email subspaceresonator@gmail.com (or yannigi3683@gmail.com).
-- 2. Copy the user's UUID from the dashboard.
-- 3. Run:
--    insert into user_roles (user_id, role)
--    values ('<paste-uuid-here>', 'admin');
