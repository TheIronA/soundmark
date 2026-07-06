import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Plus, MapPin } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { listEntries, listOnThisDay, momentMedia } from "@/lib/entries";
import { getObjectUrls } from "@/lib/storage";
import { formatLatLng } from "@/lib/geo";
import { bypassAuth } from "@/lib/utils";
import type { EntryWithMedia } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { PageSpinner } from "@/components/page-spinner";
import { MomentPhoto } from "@/components/moment-photo";
import { OnThisDay, type OnThisDayItem } from "@/components/on-this-day";

export const metadata = { title: "Timeline — Soundmark" };

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function TimelinePage() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <TimelineContent />
    </Suspense>
  );
}

async function TimelineContent() {
  const supabase = await createClient();
  if (!bypassAuth) {
    const { data: claims } = await supabase.auth.getClaims();
    if (!claims?.claims) redirect("/auth/login");
  }

  const now = new Date();
  const [entries, onThisDay]: [EntryWithMedia[], EntryWithMedia[]] = bypassAuth
    ? [[], []]
    : await Promise.all([
        listEntries(supabase),
        listOnThisDay(supabase, now),
      ]);

  // Resolve the photo (thumbnail) and sound for every moment (timeline +
  // on-this-day) to signed URLs in a single batch.
  const paths = [...entries, ...onThisDay].flatMap((e) => {
    const { photo, audio } = momentMedia(e);
    const out: string[] = [];
    if (photo) out.push(photo.thumbnail_path ?? photo.storage_path);
    if (audio) out.push(audio.storage_path);
    return out;
  });
  const urls = await getObjectUrls(supabase, paths);

  const onThisDayItems: OnThisDayItem[] = onThisDay.map((e) => {
    const { photo, audio } = momentMedia(e);
    return {
      id: e.id,
      title: e.title,
      yearsAgo: now.getFullYear() - new Date(e.recorded_at).getFullYear(),
      photoUrl: photo
        ? urls[photo.thumbnail_path ?? photo.storage_path] ?? null
        : null,
      audioUrl: audio ? urls[audio.storage_path] ?? null : null,
    };
  });

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <h1 className="text-2xl font-bold">No moments yet</h1>
        <p className="max-w-sm text-muted-foreground">
          Capture a photo and the sound around it to start your collection.
        </p>
        <Button asChild>
          <Link href="/app/new">
            <Plus className="mr-2 size-4" /> Capture your first moment
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <OnThisDay items={onThisDayItems} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Your moments</h1>
          <p className="text-sm text-muted-foreground">
            Tap a photo to hear it.
          </p>
        </div>
        <Button asChild size="sm">
          <Link href="/app/new">
            <Plus className="mr-2 size-4" /> New
          </Link>
        </Button>
      </div>

      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {entries.map((entry) => {
          const { photo, audio } = momentMedia(entry);
          const photoUrl = photo
            ? urls[photo.thumbnail_path ?? photo.storage_path] ?? null
            : null;
          const audioUrl = audio ? urls[audio.storage_path] ?? null : null;

          return (
            <li key={entry.id} className="flex flex-col gap-2">
              <MomentPhoto
                photoUrl={photoUrl}
                audioUrl={audioUrl}
                alt={entry.title || "Moment"}
                className="aspect-square w-full"
                rounded="rounded-neo"
              />
              <div className="flex flex-col gap-0.5 px-0.5">
                {entry.title && (
                  <span className="truncate text-sm font-medium">
                    {entry.title}
                  </span>
                )}
                <span className="text-xs text-muted-foreground">
                  {formatWhen(entry.recorded_at)}
                </span>
                {(entry.lat !== null || entry.place_label) && (
                  <span className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                    <MapPin className="size-3 shrink-0" />
                    {entry.place_label || formatLatLng(entry.lat, entry.lng)}
                  </span>
                )}
                <Button asChild size="sm" variant="secondary" className="mt-1 self-start">
                  <Link href={`/app/entry/${entry.id}`}>Details</Link>
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
