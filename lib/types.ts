// Shared domain types for Soundmark. These mirror the DB schema in
// supabase/migrations/ but are kept hand-written (rather than generated) to
// stay lightweight for the MVP.

export type MediaType = "audio" | "photo";

export interface Entry {
  id: string;
  user_id: string;
  title: string | null;
  note: string | null;
  lat: number | null;
  lng: number | null;
  place_label: string | null;
  recorded_at: string; // ISO timestamp
  created_at: string;
}

export interface Media {
  id: string;
  entry_id: string;
  user_id: string;
  media_type: MediaType;
  /** Backend-agnostic object path. Resolve to a URL via lib/storage. */
  storage_path: string;
  thumbnail_path: string | null;
  duration_sec: number | null;
  size_bytes: number | null;
  created_at: string;
}

/** An entry together with its media items. */
export interface EntryWithMedia extends Entry {
  media: Media[];
}
