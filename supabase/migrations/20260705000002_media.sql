-- Soundmark: media table + storage bucket
-- A media item belongs to exactly one entry. An entry can have many media
-- items (multiple photos and/or audio clips for the same place-moment).

create type public.media_type as enum ('audio', 'photo');

create table if not exists public.media (
  id             uuid            primary key default gen_random_uuid(),
  entry_id       uuid            not null references public.entries (id) on delete cascade,
  -- Denormalized owner. Lets RLS and storage policies check ownership without
  -- a join, and survives even if the parent lookup is unavailable.
  user_id        uuid            not null references auth.users (id) on delete cascade,
  media_type     public.media_type not null,
  -- Backend-agnostic object path, NOT a Supabase URL. Today this is the object
  -- key inside the Supabase Storage bucket (e.g. "<user_id>/<entry_id>/<uuid>.webm").
  -- To swap the storage backend later (Drive, S3, ...), only the code that
  -- resolves a path to bytes changes -- this column and the schema do not.
  storage_path   text            not null,
  -- Optional derived thumbnail for photos (same path convention as above).
  thumbnail_path text,
  duration_sec   double precision, -- audio only
  size_bytes     bigint,
  created_at     timestamptz     not null default now()
);

create index if not exists media_entry_idx on public.media (entry_id);
create index if not exists media_user_idx  on public.media (user_id);

-- Row Level Security: a user may only see and mutate their own media rows.
alter table public.media enable row level security;

create policy "media: select own"
  on public.media for select
  using (auth.uid() = user_id);

create policy "media: insert own"
  on public.media for insert
  with check (auth.uid() = user_id);

create policy "media: update own"
  on public.media for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "media: delete own"
  on public.media for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Storage: a single private bucket for all Soundmark media.
-- Object keys are namespaced by user id as the first path segment, which the
-- policies below rely on to enforce per-user isolation.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('media', 'media', false)
on conflict (id) do nothing;

create policy "storage media: read own"
  on storage.objects for select
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "storage media: insert own"
  on storage.objects for insert
  with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "storage media: update own"
  on storage.objects for update
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "storage media: delete own"
  on storage.objects for delete
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
