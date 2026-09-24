-- Subspace Resonator — Supabase schema
-- Project: lgcmbmlapksmdbkhkyyv (yannigi3683-Git's Org)
-- Run once in the Supabase SQL editor on a fresh project.

create type app_role as enum ('admin');

create table user_roles (
  user_id uuid references auth.users on delete cascade,
  role    app_role not null,
  primary key (user_id, role)
);
alter table user_roles enable row level security;

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

create table site_content (
  id         text primary key default 'singleton',
  data       jsonb not null default '{}',
  updated_at timestamptz not null default now()
);
alter table site_content enable row level security;

create policy read_all
  on site_content for select
  using (true);

create policy admin_write
  on site_content for all
  using (has_role(auth.uid(), 'admin'))
  with check (has_role(auth.uid(), 'admin'));

-- Table-level grants. Supabase stopped auto-granting Data API access to NEW public tables on
-- 2026-10-30, so a fresh project created after that date needs these spelled out or the table
-- is unreachable from the browser. Existing projects kept the grants they already had, which
-- is why this file was able to go this long without them. Grants are NOT a substitute for
-- RLS: the admin_write policy above is what actually restricts writes, and a grant without a
-- policy still denies. See section 10 of radio-schema.sql for the same block.
grant select on site_content to anon, authenticated;       -- every visitor reads before first paint
grant insert, update on site_content to authenticated;     -- admin panel upserts (siteContent.ts saveContent)
grant all on site_content to service_role;
-- user_roles deliberately gets NO grant: it is only ever read through has_role(), which is
-- SECURITY DEFINER and so needs no privilege on the caller's behalf.

insert into storage.buckets (id, name, public)
values ('gallery', 'gallery', true)
on conflict (id) do nothing;

create policy gal_read
  on storage.objects for select
  using (bucket_id = 'gallery');

create policy gal_write
  on storage.objects for insert
  with check (bucket_id = 'gallery' and has_role(auth.uid(), 'admin'));

create policy gal_del
  on storage.objects for delete
  using (bucket_id = 'gallery' and has_role(auth.uid(), 'admin'));

-- After running:
-- 1. Auth → Users → Add user (email + password for your admin login)
-- 2. Copy the user UUID, then run:
--    insert into user_roles (user_id, role) values ('<uuid>', 'admin');
