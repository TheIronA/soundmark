"use client";

// Leaflet touches `window` at module load time, so it cannot be part of the
// server-rendered bundle. `next/dynamic` with `ssr: false` is only allowed
// inside a Client Component, hence this thin wrapper around the real
// implementation in `entries-map-inner.tsx`.
import dynamic from "next/dynamic";

export type { MapEntry } from "@/components/entries-map-inner";

export const EntriesMap = dynamic(
  () => import("@/components/entries-map-inner").then((m) => m.EntriesMap),
  { ssr: false },
);
