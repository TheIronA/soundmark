// Storage backend abstraction.
//
// This is the ONLY module that knows Soundmark media lives in Supabase Storage.
// Everything else deals in backend-agnostic `storage_path` strings (the value
// stored in media.storage_path / media.thumbnail_path). To swap the backend
// later (Google Drive, S3, ...), reimplement the functions here; the schema,
// the media table, and the rest of the app stay unchanged.

import type { SupabaseClient } from "@supabase/supabase-js";

/** The bucket all media objects live in (see the media migration). */
export const MEDIA_BUCKET = "media";

/**
 * Build the object path for a new media file. Namespacing by user id as the
 * first segment is required by the storage RLS policies.
 */
export function buildMediaPath(
  userId: string,
  entryId: string,
  filename: string,
): string {
  return `${userId}/${entryId}/${filename}`;
}

/**
 * Build the object path for a user's profile picture. Namespaced by user id
 * (matching the storage RLS policies) with an "avatar/" prefix to keep it
 * distinct from entry media in the same bucket.
 */
export function buildAvatarPath(userId: string, filename: string): string {
  return `${userId}/avatar/${filename}`;
}

/** Upload bytes to the backend at `path`. Returns the stored path. */
export async function uploadObject(
  supabase: SupabaseClient,
  path: string,
  body: Blob | File,
  contentType?: string,
): Promise<string> {
  const { error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(path, body, {
      contentType: contentType ?? (body instanceof File ? body.type : undefined),
      upsert: false,
    });
  if (error) throw error;
  return path;
}

/**
 * How long a signed media URL stays valid. These URLs are baked into
 * server-rendered pages, so the window has to comfortably outlast a session
 * spent with the tab open — an hour was short enough that idle tabs came back
 * to 403ing images and unplayable sounds. Clients can also re-sign on demand
 * via the refresh route when a URL does lapse.
 */
export const SIGNED_URL_TTL_SEC = 60 * 60 * 12; // 12 hours

/**
 * Resolve a stored path to a temporary, authenticated URL the browser can load.
 * The bucket is private, so we use signed URLs rather than public ones.
 */
export async function getObjectUrl(
  supabase: SupabaseClient,
  path: string,
  expiresInSec = SIGNED_URL_TTL_SEC,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .createSignedUrl(path, expiresInSec);
  if (error) throw error;
  return data.signedUrl;
}

/**
 * Re-sign a single stored path from the browser. Used to recover when a URL
 * baked into a long-open page has expired: the client still holds the
 * backend-agnostic path, so it can mint a fresh URL without a page reload.
 * Returns null if re-signing fails (e.g. the session lapsed too).
 */
export async function refreshObjectUrl(
  supabase: SupabaseClient,
  path: string,
): Promise<string | null> {
  try {
    return await getObjectUrl(supabase, path);
  } catch {
    return null;
  }
}

/** Batch-resolve many paths to signed URLs, keyed by path. */
export async function getObjectUrls(
  supabase: SupabaseClient,
  paths: string[],
  expiresInSec = SIGNED_URL_TTL_SEC,
): Promise<Record<string, string>> {
  const unique = [...new Set(paths.filter(Boolean))];
  if (unique.length === 0) return {};
  const { data, error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .createSignedUrls(unique, expiresInSec);
  if (error) throw error;
  const map: Record<string, string> = {};
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) map[item.path] = item.signedUrl;
  }
  return map;
}
