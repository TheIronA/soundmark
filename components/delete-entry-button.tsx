"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { MEDIA_BUCKET } from "@/lib/storage";

export function DeleteEntryButton({ entryId }: { entryId: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm("Delete this entry and its media? This can't be undone.")) {
      return;
    }
    setDeleting(true);
    const supabase = createClient();

    // Collect the object paths before the rows are gone — deleting the entry
    // cascades the media rows away, taking the paths with them.
    const { data: media } = await supabase
      .from("media")
      .select("storage_path, thumbnail_path")
      .eq("entry_id", entryId);
    const paths = (media ?? [])
      .flatMap((m) => [m.storage_path, m.thumbnail_path])
      .filter(Boolean) as string[];

    // Delete the row first. Of the two possible half-states, an orphaned
    // object (invisible, reclaimable later) is strictly better than a live
    // entry whose media 404s — so the DB delete has to be the step that
    // decides whether the moment is gone.
    const { error } = await supabase.from("entries").delete().eq("id", entryId);
    if (error) {
      alert(error.message);
      setDeleting(false);
      return;
    }

    // Best-effort cleanup; a failure here only leaves unreferenced bytes.
    if (paths.length > 0) {
      try {
        await supabase.storage.from(MEDIA_BUCKET).remove(paths);
      } catch {
        // The entry is already gone from the user's view; nothing to surface.
      }
    }

    router.push("/app/timeline");
    router.refresh();
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleDelete}
      disabled={deleting}
      className="text-destructive hover:text-destructive"
    >
      {deleting ? (
        <Loader2 className="mr-2 size-4 animate-spin" />
      ) : (
        <Trash2 className="mr-2 size-4" />
      )}
      Delete
    </Button>
  );
}
