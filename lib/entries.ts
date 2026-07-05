// Read helpers for entries + their media. Works with either the server or
// browser Supabase client (both satisfy the query surface used here).

import type { SupabaseClient } from "@supabase/supabase-js";
import type { EntryWithMedia, Media } from "@/lib/types";

/**
 * Reduce an entry's media to the single photo + single sound the product
 * treats a "moment" as. The schema stays one-to-many; this just picks the
 * first of each type (newest-created wins, matching capture order).
 */
export function momentMedia(entry: EntryWithMedia): {
  photo: Media | null;
  audio: Media | null;
} {
  const photo = entry.media.find((m) => m.media_type === "photo") ?? null;
  const audio = entry.media.find((m) => m.media_type === "audio") ?? null;
  return { photo, audio };
}

const ENTRY_WITH_MEDIA_SELECT = `
  id, user_id, title, note, lat, lng, place_label, recorded_at, created_at,
  media (
    id, entry_id, user_id, media_type, storage_path, thumbnail_path,
    duration_sec, size_bytes, created_at
  )
`;

/** All of the current user's entries, newest moment first, with media. */
export async function listEntries(
  supabase: SupabaseClient,
): Promise<EntryWithMedia[]> {
  const { data, error } = await supabase
    .from("entries")
    .select(ENTRY_WITH_MEDIA_SELECT)
    .order("recorded_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as EntryWithMedia[];
}

/**
 * Moments recorded on this calendar day in a previous year — the "a year ago
 * today" resurfacing hook. Matches any prior year (usually just last year) so
 * the memory keeps returning as the archive ages. Ordered oldest first.
 */
export async function listOnThisDay(
  supabase: SupabaseClient,
  now: Date = new Date(),
): Promise<EntryWithMedia[]> {
  const month = now.getMonth() + 1; // 1-12
  const day = now.getDate();
  const year = now.getFullYear();

  const { data, error } = await supabase
    .from("entries")
    .select(ENTRY_WITH_MEDIA_SELECT)
    // Compare on the recorded moment's month/day, excluding the current year.
    .lt("recorded_at", `${year}-01-01`)
    .order("recorded_at", { ascending: true });
  if (error) throw error;

  // Filter to the same month/day locally (Postgres date extraction via the
  // JS client would need an RPC; the on-this-day set is tiny so this is fine).
  return ((data ?? []) as unknown as EntryWithMedia[]).filter((e) => {
    const d = new Date(e.recorded_at);
    return d.getMonth() + 1 === month && d.getDate() === day;
  });
}

/** A single entry with its media, or null if not found / not owned. */
export async function getEntry(
  supabase: SupabaseClient,
  id: string,
): Promise<EntryWithMedia | null> {
  const { data, error } = await supabase
    .from("entries")
    .select(ENTRY_WITH_MEDIA_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as EntryWithMedia) ?? null;
}
