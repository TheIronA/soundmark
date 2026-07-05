-- Soundmark: entries table
-- An "entry" is a place-moment: a spot on the map at a point in time that can
-- hold one or more media items (see 20260705000002_media.sql).

create extension if not exists "pgcrypto"; -- for gen_random_uuid()

create table if not exists public.entries (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users (id) on delete cascade,
  title       text,
  note        text,
  -- Location. Stored as plain lat/lng doubles for simplicity; a PostGIS
  -- geography column can be layered on later without a breaking change.
  lat         double precision,
  lng         double precision,
  place_label text,
  -- When the moment happened (may differ from created_at, e.g. EXIF date).
  recorded_at timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

-- Common access patterns: a user's entries newest-first, and map/timeline
-- queries scoped to the owner.
create index if not exists entries_user_recorded_idx
  on public.entries (user_id, recorded_at desc);

-- Row Level Security: a user may only see and mutate their own entries.
alter table public.entries enable row level security;

create policy "entries: select own"
  on public.entries for select
  using (auth.uid() = user_id);

create policy "entries: insert own"
  on public.entries for insert
  with check (auth.uid() = user_id);

create policy "entries: update own"
  on public.entries for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "entries: delete own"
  on public.entries for delete
  using (auth.uid() = user_id);
