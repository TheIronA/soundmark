import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Plus } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { listEntries, momentMedia } from "@/lib/entries";
import { getObjectUrls } from "@/lib/storage";
import { bypassAuth } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EntriesMap, type MapEntry } from "@/components/entries-map";
import { PageSpinner } from "@/components/page-spinner";

export const metadata = { title: "Map — Soundmark" };

export default function MapPage() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <MapContent />
    </Suspense>
  );
}

async function MapContent() {
  const supabase = await createClient();
  if (!bypassAuth) {
    const { data: claims } = await supabase.auth.getClaims();
    if (!claims?.claims) redirect("/auth/login");
  }

  const entries = bypassAuth ? [] : await listEntries(supabase);
  const locatedEntries = entries.filter(
    (e) => typeof e.lat === "number" && typeof e.lng === "number",
  );

  // Resolve photo (thumbnail) + sound URLs for the located moments.
  const paths = locatedEntries.flatMap((e) => {
    const { photo, audio } = momentMedia(e);
    const out: string[] = [];
    if (photo) out.push(photo.thumbnail_path ?? photo.storage_path);
    if (audio) out.push(audio.storage_path);
    return out;
  });
  const urls = await getObjectUrls(supabase, paths);

  const located: MapEntry[] = locatedEntries.map((e) => {
    const { photo, audio } = momentMedia(e);
    return {
      id: e.id,
      title: e.title,
      lat: e.lat as number,
      lng: e.lng as number,
      recorded_at: e.recorded_at,
      photoUrl: photo
        ? urls[photo.thumbnail_path ?? photo.storage_path] ?? null
        : null,
      audioUrl: audio ? urls[audio.storage_path] ?? null : null,
    };
  });

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Map</h1>
          <p className="text-sm text-muted-foreground">
            {located.length} of {entries.length} moments have a location. Tap a
            photo to hear it.
          </p>
        </div>
        <Button asChild size="sm">
          <Link href="/app/new">
            <Plus className="mr-2 size-4" /> New
          </Link>
        </Button>
      </div>

      {/* The map is always shown, even with no located moments yet. When
          empty, a hint floats over it inviting the first capture. */}
      <div className="relative">
        <EntriesMap entries={located} />
        {located.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4">
            <div className="pointer-events-auto flex flex-col items-center gap-3 rounded-neo border-3 border-border bg-card px-6 py-5 text-center shadow-neo">
              <p className="max-w-xs text-sm text-muted-foreground">
                No located moments yet. Capture a moment with a location to see
                it here.
              </p>
              <Button asChild size="sm">
                <Link href="/app/new">
                  <Plus className="mr-2 size-4" /> New moment
                </Link>
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
