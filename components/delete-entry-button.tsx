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

    // Remove storage objects first (DB cascade would orphan them otherwise).
    const { data: media } = await supabase
      .from("media")
      .select("storage_path, thumbnail_path")
      .eq("entry_id", entryId);
    const paths = (media ?? [])
      .flatMap((m) => [m.storage_path, m.thumbnail_path])
      .filter(Boolean) as string[];
    if (paths.length > 0) {
      await supabase.storage.from(MEDIA_BUCKET).remove(paths);
    }

    // Deleting the entry cascades to its media rows.
    const { error } = await supabase.from("entries").delete().eq("id", entryId);
    if (error) {
      alert(error.message);
      setDeleting(false);
      return;
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
