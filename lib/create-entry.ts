"use client";

// Client-side orchestration of creating a "moment": one photo paired with an
// optional short sound, tied to a place and time.
//
// Order: insert the entry row -> upload the photo (+ thumbnail) -> upload the
// audio -> insert media rows. Storage paths are produced via lib/storage so
// this file stays backend-agnostic. The DB schema is still one-entry-to-many-
// media, but the product treats a moment as a single photo + single sound.

import { createClient } from "@/lib/supabase/client";
import { buildMediaPath, uploadObject } from "@/lib/storage";
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

/**
 * Create a moment: an entry with one photo and (optionally) one sound.
 * Returns the created entry.
 */
export async function createMoment(
  input: NewEntryInput,
  photo: NewMediaInput,
  audio: NewMediaInput | null,
): Promise<Entry> {
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

  const mediaRows: Array<Record<string, unknown>> = [];

  // 2) Upload the photo + a downscaled thumbnail.
  {
    const prefix = uniqueId();
    const photoPath = buildMediaPath(
      user.id,
      entry.id,
      `${prefix}-${photo.filename}`,
    );
    await uploadObject(supabase, photoPath, photo.data);

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
  const { error: mediaError } = await supabase.from("media").insert(mediaRows);
  if (mediaError) {
    throw new Error(mediaError.message);
  }

  return entry as Entry;
}
