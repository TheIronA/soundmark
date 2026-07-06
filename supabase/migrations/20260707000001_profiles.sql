-- Soundmark: profiles table
-- Per-user display settings (username, avatar) that live alongside Supabase
-- auth but aren't part of auth.users itself. The row is created lazily the
-- first time a user saves their profile (see lib/profile.ts), not via a
-- signup trigger.

create table if not exists public.profiles (
  id          uuid        primary key references auth.users (id) on delete cascade,
  username    text,
  -- Backend-agnostic object path (see lib/storage.ts), not a URL. Lives in
  -- the same "media" bucket as entry media, namespaced under "<user_id>/avatar/".
  avatar_path text,
  updated_at  timestamptz not null default now()
);

-- Case-insensitive uniqueness for usernames, when set.
create unique index if not exists profiles_username_key
  on public.profiles (lower(username))
  where username is not null;

-- Row Level Security: a user may only see and mutate their own profile.
alter table public.profiles enable row level security;

create policy "profiles: select own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles: insert own"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "profiles: update own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);
