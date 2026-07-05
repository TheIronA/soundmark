import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, MapPin } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { getEntry, momentMedia } from "@/lib/entries";
import { getObjectUrls } from "@/lib/storage";
import { formatLatLng } from "@/lib/geo";
import { bypassAuth } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DeleteEntryButton } from "@/components/delete-entry-button";
import { PageSpinner } from "@/components/page-spinner";
import { MomentPhoto } from "@/components/moment-photo";

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "full",
    timeStyle: "short",
  });
}

export default function EntryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<PageSpinner />}>
      <EntryDetail params={params} />
    </Suspense>
  );
}

async function EntryDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  if (!bypassAuth) {
    const { data: claims } = await supabase.auth.getClaims();
    if (!claims?.claims) redirect("/auth/login");
  }

  const entry = bypassAuth ? null : await getEntry(supabase, id);
  if (!entry) notFound();

  const { photo, audio } = momentMedia(entry);

  // Resolve the photo (full resolution) and the sound to signed URLs.
  const paths = [photo?.storage_path, audio?.storage_path].filter(
    Boolean,
  ) as string[];
  const urls = await getObjectUrls(supabase, paths);
  const photoUrl = photo ? urls[photo.storage_path] ?? null : null;
  const audioUrl = audio ? urls[audio.storage_path] ?? null : null;

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-5">
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link href="/app/timeline">
            <ArrowLeft className="mr-2 size-4" /> Back
          </Link>
        </Button>
        <DeleteEntryButton entryId={entry.id} />
      </div>

      {/* The moment: tap the photo to hear its sound. */}
      <MomentPhoto
        photoUrl={photoUrl}
        audioUrl={audioUrl}
        alt={entry.title || "Moment"}
        className="aspect-square w-full"
        rounded="rounded-neo"
      />

      {/* A full player too, for scrubbing. */}
      {audioUrl && <audio controls src={audioUrl} className="w-full" />}

      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold">{entry.title || "Untitled moment"}</h1>
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span>{formatWhen(entry.recorded_at)}</span>
          {(entry.lat !== null || entry.place_label) && (
            <span className="flex items-center gap-1">
              <MapPin className="size-3" />
              {entry.place_label || formatLatLng(entry.lat, entry.lng)}
            </span>
          )}
        </div>
      </div>

      {entry.note && (
        <p className="whitespace-pre-wrap text-sm leading-relaxed">
          {entry.note}
        </p>
      )}
    </div>
  );
}
