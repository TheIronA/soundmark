"use client";

// Lets a moment that was saved without a sound (or whose sound was removed)
// get one added afterwards. Reuses the same recorder/upload control as the
// initial capture flow, uploading directly to the existing entry.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Mic, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AudioRecorderControl } from "@/components/audio-recorder-control";
import { createClient } from "@/lib/supabase/client";
import { MEDIA_BUCKET, buildMediaPath, uploadObject } from "@/lib/storage";
import { assertWithinSizeLimit, audioExtensionFor } from "@/lib/create-entry";
import { uniqueId } from "@/lib/utils";
import type { AudioRecording } from "@/lib/use-audio-recorder";

export function AddAudioButton({ entryId }: { entryId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [recording, setRecording] = useState<AudioRecording | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!recording) return;
    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error("You must be signed in to add a sound.");
      }

      assertWithinSizeLimit({
        type: "audio",
        data: recording.blob,
        filename: "sound",
      });

      const filename = `${uniqueId()}-sound.${audioExtensionFor(recording.mimeType)}`;
      const path = buildMediaPath(user.id, entryId, filename);
      await uploadObject(supabase, path, recording.blob);

      const { error: insertError } = await supabase.from("media").insert({
        entry_id: entryId,
        user_id: user.id,
        media_type: "audio",
        storage_path: path,
        duration_sec: recording.durationSec ?? null,
        size_bytes: recording.blob.size,
      });
      if (insertError) {
        // Don't leave the just-uploaded object behind with nothing pointing
        // at it; the row is what makes it reachable.
        try {
          await supabase.storage.from(MEDIA_BUCKET).remove([path]);
        } catch {
          // Best-effort; the insert error below is what matters.
        }
        throw insertError;
      }

      setOpen(false);
      setRecording(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the sound.");
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => setOpen(true)}
      >
        <Mic className="mr-2 size-4" /> Add a sound
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-neo border-3 border-border bg-card p-4 shadow-neo-sm">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">
          Record or upload a sound for this moment
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => {
            setOpen(false);
            setRecording(null);
            setError(null);
          }}
          disabled={saving}
          aria-label="Cancel"
        >
          <X className="size-4" />
        </Button>
      </div>

      <AudioRecorderControl onChange={setRecording} />

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button
        type="button"
        onClick={save}
        disabled={!recording || saving}
        className="self-start"
      >
        {saving ? (
          <Loader2 className="mr-2 size-4 animate-spin" />
        ) : (
          <Check className="mr-2 size-4" />
        )}
        Save sound
      </Button>
    </div>
  );
}
