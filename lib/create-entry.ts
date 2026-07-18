"use client";

// Client-side orchestration of creating a "moment": one photo paired with an
// optional short sound, tied to a place and time.
//
// Order: insert the entry row -> upload the photo (+ thumbnail) -> upload the
// audio -> insert media rows. Storage paths are produced via lib/storage so
// this file stays backend-agnostic. The DB schema is still one-entry-to-many-
// media, but the product treats a moment as a single photo + single sound.

import type { SupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/client";
import {
  MEDIA_BUCKET,
  buildMediaPath,
  uploadObject,
} from "@/lib/storage";
import { generatePhotoThumbnail } from "@/lib/thumbnail";
import type { Entry, MediaType } from "@/lib/types";
import { uniqueId } from "@/lib/utils";

export interface NewEntryInput {
  title: string;
  note: string;
  lat: number | null;
  lng: number | null;
  placeLabel: string | null;
  recordedAt: string; // ISO
}

export interface NewMediaInput {
  type: MediaType;
  /** The file/blob to store (photo File or recorded audio Blob). */
  data: Blob;
  /** Filename to use for the object key (extension matters). */
  filename: string;
  durationSec?: number | null;
}

/** Choose a file extension for an audio blob (recorded or uploaded) based on
 * its MIME type. */
export function audioExtensionFor(mimeType: string): string {
  if (mimeType.includes("webm")) return "webm";
  if (mimeType.includes("mp4") || mimeType.includes("m4a")) return "m4a";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("mpeg") || mimeType.includes("mp3")) return "mp3";
  if (mimeType.includes("wav")) return "wav";
  if (mimeType.includes("aac")) return "aac";
  if (mimeType.includes("flac")) return "flac";
  return "webm";
}

/** Upload size ceilings, enforced client-side before any bytes are sent so a
 * huge file fails fast and cheaply rather than part-way through a save. */
export const MAX_PHOTO_BYTES = 25 * 1024 * 1024; // 25 MB
export const MAX_AUDIO_BYTES = 50 * 1024 * 1024; // 50 MB

function formatMb(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

/** Throw a user-facing error if a media item exceeds its size ceiling. */
export function assertWithinSizeLimit(media: NewMediaInput): void {
  const limit = media.type === "photo" ? MAX_PHOTO_BYTES : MAX_AUDIO_BYTES;
  if (media.data.size > limit) {
    const what = media.type === "photo" ? "photo" : "sound";
    throw new Error(
      `That ${what} is too large (${formatMb(media.data.size)}). The limit is ${formatMb(limit)}.`,
    );
  }
}

/**
 * Undo a partially-completed save: remove any objects already uploaded, then
 * delete the entry row (which cascades to any media rows that did land).
 *
 * Best-effort by design — it runs while another error is already propagating,
 * so a failure here must not mask the original cause.
 */
async function rollbackMoment(
  supabase: SupabaseClient,
  entryId: string,
  uploadedPaths: string[],
): Promise<void> {
  try {
    if (uploadedPaths.length > 0) {
      await supabase.storage.from(MEDIA_BUCKET).remove(uploadedPaths);
    }
  } catch {
    // Ignore: the entry delete below is the more important cleanup.
  }
  try {
    await supabase.from("entries").delete().eq("id", entryId);
  } catch {
    // Ignore: surfacing the original failure matters more.
  }
}

/**
 * Create a moment: an entry with a photo and/or a sound (at least one of the
 * two is required). Returns the created entry.
 *
 * The entry row must be inserted first (its id namespaces the object keys), so
 * this is not a single transaction. Everything after that insert runs under a
 * rollback: if any upload or the media insert fails, the uploaded objects and
 * the entry row are removed so a failed save never leaves a media-less "ghost"
 * moment behind.
 */
export async function createMoment(
  input: NewEntryInput,
  photo: NewMediaInput | null,
  audio: NewMediaInput | null,
): Promise<Entry> {
  if (!photo && !audio) {
    throw new Error("A moment needs a photo or a sound.");
  }

  // Check sizes up front, before the entry row exists — nothing to roll back.
  if (photo) assertWithinSizeLimit(photo);
  if (audio) assertWithinSizeLimit(audio);

  const supabase = createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    throw new Error("You must be signed in to save a moment.");
  }

  // 1) Insert the entry.
  const { data: entry, error: entryError } = await supabase
    .from("entries")
    .insert({
      user_id: user.id,
      title: input.title.trim() || null,
      note: input.note.trim() || null,
      lat: input.lat,
      lng: input.lng,
      place_label: input.placeLabel?.trim() || null,
      recorded_at: input.recordedAt,
    })
    .select()
    .single();
  if (entryError || !entry) {
    throw new Error(entryError?.message ?? "Failed to save moment.");
  }

  // Everything below is rolled back as a unit if any step fails.
  const uploadedPaths: string[] = [];
  try {
    const mediaRows: Array<Record<string, unknown>> = [];

    // 2) Upload the photo + a downscaled thumbnail, if there is one.
    if (photo) {
      const prefix = uniqueId();
      const photoPath = buildMediaPath(
        user.id,
        entry.id,
        `${prefix}-${photo.filename}`,
      );
      await uploadObject(supabase, photoPath, photo.data);
      uploadedPaths.push(photoPath);

      let thumbnailPath: string | null = null;
      if (photo.data instanceof File) {
        const thumb = await generatePhotoThumbnail(photo.data);
        if (thumb) {
          thumbnailPath = buildMediaPath(
            user.id,
            entry.id,
            `${prefix}-thumb.jpg`,
          );
          await uploadObject(supabase, thumbnailPath, thumb.blob, "image/jpeg");
          uploadedPaths.push(thumbnailPath);
        }
      }

      mediaRows.push({
        entry_id: entry.id,
        user_id: user.id,
        media_type: "photo",
        storage_path: photoPath,
        thumbnail_path: thumbnailPath,
        size_bytes: photo.data.size,
      });
    }

    // 3) Upload the sound, if one was recorded.
    if (audio) {
      const prefix = uniqueId();
      const audioPath = buildMediaPath(
        user.id,
        entry.id,
        `${prefix}-${audio.filename}`,
      );
      await uploadObject(supabase, audioPath, audio.data);
      uploadedPaths.push(audioPath);
      mediaRows.push({
        entry_id: entry.id,
        user_id: user.id,
        media_type: "audio",
        storage_path: audioPath,
        duration_sec: audio.durationSec ?? null,
        size_bytes: audio.data.size,
      });
    }

    // 4) Insert media rows.
    const { error: mediaError } = await supabase
      .from("media")
      .insert(mediaRows);
    if (mediaError) {
      throw new Error(mediaError.message);
    }
  } catch (e) {
    await rollbackMoment(supabase, entry.id, uploadedPaths);
    throw e instanceof Error ? e : new Error("Failed to save moment.");
  }

  return entry as Entry;
}
