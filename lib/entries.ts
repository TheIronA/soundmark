// Read helpers for entries + their media. Works with either the server or
// browser Supabase client (both satisfy the query surface used here).

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Entry, EntryWithMedia, Media } from "@/lib/types";

/**
 * Order media newest-created first, so "the" photo/sound of a moment is the
 * most recently added one. PostgREST does not guarantee any ordering for
 * embedded rows, so this is applied explicitly rather than relied upon.
 */
function sortMedia(media: Media[]): Media[] {
  return [...media].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

/**
 * Reduce an entry's media to the single photo + single sound the product
 * treats a "moment" as. The schema stays one-to-many; this picks the
 * newest-created of each type — so a sound added later via "Add a sound"
 * wins over an earlier one.
 */
export function momentMedia(entry: EntryWithMedia): {
  photo: Media | null;
  audio: Media | null;
} {
  const ordered = sortMedia(entry.media ?? []);
  const photo = ordered.find((m) => m.media_type === "photo") ?? null;
  const audio = ordered.find((m) => m.media_type === "audio") ?? null;
  return { photo, audio };
}

const MEDIA_SELECT = `
  id, entry_id, user_id, media_type, storage_path, thumbnail_path,
  duration_sec, size_bytes, created_at
`;

const ENTRY_WITH_MEDIA_SELECT = `
  id, user_id, title, note, lat, lng, place_label, recorded_at, created_at,
  media (${MEDIA_SELECT})
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
 *
 * The month/day match happens in Postgres (see the entries_on_this_day
 * migration) so this scales with the number of matching moments rather than
 * with the size of the whole archive. `timeZone` decides whose "today" is
 * meant — it defaults to the runtime's zone, which on the server is the
 * deployment's, so pass the viewer's zone explicitly where it's known.
 */
export async function listOnThisDay(
  supabase: SupabaseClient,
  now: Date = new Date(),
  timeZone: string = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
): Promise<EntryWithMedia[]> {
  const { data, error } = await supabase.rpc("entries_on_this_day", {
    p_month: now.getMonth() + 1, // 1-12
    p_day: now.getDate(),
    p_tz: timeZone,
  });
  if (error) throw error;

  const entries = (data ?? []) as Entry[];
  if (entries.length === 0) return [];

  // The RPC returns bare entry rows; attach each one's media in a second
  // query (the set is small by construction — one calendar day).
  const { data: media, error: mediaError } = await supabase
    .from("media")
    .select(MEDIA_SELECT)
    .in(
      "entry_id",
      entries.map((e) => e.id),
    );
  if (mediaError) throw mediaError;

  const byEntry = new Map<string, Media[]>();
  for (const m of (media ?? []) as Media[]) {
    const list = byEntry.get(m.entry_id);
    if (list) list.push(m);
    else byEntry.set(m.entry_id, [m]);
  }

  return entries.map((e) => ({
    ...e,
    media: sortMedia(byEntry.get(e.id) ?? []),
  }));
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
