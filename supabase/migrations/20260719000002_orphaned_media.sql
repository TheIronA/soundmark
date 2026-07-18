-- Soundmark: reclaiming orphaned storage objects
--
-- Uploads and cleanup both run in the browser, so an interrupted flow (tab
-- closed mid-save, a crash between an upload and its media insert, a failed
-- best-effort cleanup on delete) can leave objects in the bucket that no
-- media row references. They are invisible to the user but still billed and
-- still accumulate.
--
-- The application-side rollbacks (see lib/create-entry.ts and the delete
-- button) are the first line of defence; this is the backstop for the cases
-- those can't cover, because the client stopped running.

-- Objects in the media bucket owned by the caller that no media row points at.
-- Avatars live under "<user_id>/avatar/..." in the same bucket and are keyed
-- off the profiles table instead, so they are excluded explicitly rather than
-- being reported as orphans.
create or replace function public.orphaned_media_objects()
returns table (name text, size bigint, created_at timestamptz)
language sql
stable
security invoker
set search_path = public
as $$
  select o.name,
         coalesce((o.metadata ->> 'size')::bigint, 0) as size,
         o.created_at
  from storage.objects o
  where o.bucket_id = 'media'
    and (storage.foldername(o.name))[1] = auth.uid()::text
    and (storage.foldername(o.name))[2] is distinct from 'avatar'
    and not exists (
      select 1
      from public.media m
      where m.storage_path = o.name
         or m.thumbnail_path = o.name
    )
    and not exists (
      select 1
      from public.profiles p
      where p.avatar_path = o.name
    )
    -- Only consider objects old enough that an in-flight save can't still be
    -- about to insert its media row.
    and o.created_at < now() - interval '1 hour';
$$;

revoke all on function public.orphaned_media_objects() from public;
grant execute on function public.orphaned_media_objects() to authenticated;

comment on function public.orphaned_media_objects() is
  'Media-bucket objects owned by the caller with no referencing media/profiles row, older than 1 hour. Read-only: deletion goes through the storage API so RLS applies.';
