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
 * Resolve a stored path to a temporary, authenticated URL the browser can load.
 * The bucket is private, so we use signed URLs rather than public ones.
 */
export async function getObjectUrl(
  supabase: SupabaseClient,
  path: string,
  expiresInSec = 60 * 60,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .createSignedUrl(path, expiresInSec);
  if (error) throw error;
  return data.signedUrl;
}

/** Batch-resolve many paths to signed URLs, keyed by path. */
export async function getObjectUrls(
  supabase: SupabaseClient,
  paths: string[],
  expiresInSec = 60 * 60,
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
