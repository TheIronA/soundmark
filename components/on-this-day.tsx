import Link from "next/link";
import { Sparkles } from "lucide-react";

import { MomentPhoto } from "@/components/moment-photo";

export interface OnThisDayItem {
  id: string;
  title: string | null;
  yearsAgo: number;
  photoUrl: string | null;
  audioUrl: string | null;
  /** Storage paths, so playback can recover from an expired signed URL. */
  photoPath: string | null;
  audioPath: string | null;
}

/**
 * The retention hook: a small card surfacing moments captured on this calendar
 * day in a past year. Rendered at the top of the home (timeline) screen.
 */
export function OnThisDay({ items }: { items: OnThisDayItem[] }) {
  if (items.length === 0) return null;

  return (
    <section className="rounded-neo border-3 border-warning/40 bg-warning/10 p-4 shadow-neo-sm">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="size-4 text-warning" />
        <h2 className="text-sm font-semibold">
          {items.length === 1 && items[0].yearsAgo === 1
            ? "A year ago today"
            : "On this day"}
        </h2>
      </div>
      <ul className="flex gap-3 overflow-x-auto pb-1">
        {items.map((item) => (
          <li key={item.id} className="flex w-32 shrink-0 flex-col gap-1.5">
            <MomentPhoto
              photoUrl={item.photoUrl}
              audioUrl={item.audioUrl}
              photoPath={item.photoPath}
              audioPath={item.audioPath}
              alt={item.title || "A past moment"}
              className="aspect-square w-full"
              rounded="rounded-neo"
            />
            <div className="flex flex-col px-0.5">
              <span className="truncate text-xs font-medium">
                {item.title || "A moment"}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {item.yearsAgo} {item.yearsAgo === 1 ? "year" : "years"} ago
              </span>
              <Link
                href={`/app/entry/${item.id}`}
                className="text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                Details
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
