// Read/write helpers for the current user's profile (username + avatar).
// Mirrors the shape of lib/entries.ts: plain functions over a SupabaseClient,
// with backend-agnostic storage paths resolved elsewhere (see lib/storage.ts).
// The profiles row is created lazily on first save, not via a signup trigger.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile } from "@/lib/types";

const PROFILE_SELECT = "id, username, avatar_path, updated_at";

/** The given user's profile row, or null if one hasn't been saved yet. */
export async function getProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_SELECT)
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data as Profile | null;
}

export interface ProfileUpdate {
  username?: string | null;
  avatar_path?: string | null;
}

/** Create or update the given user's profile row. */
export async function upsertProfile(
  supabase: SupabaseClient,
  userId: string,
  fields: ProfileUpdate,
): Promise<Profile> {
  const { data, error } = await supabase
    .from("profiles")
    .upsert({ id: userId, ...fields, updated_at: new Date().toISOString() })
    .select(PROFILE_SELECT)
    .single();
  if (error) throw error;
  return data as Profile;
}
