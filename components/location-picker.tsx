"use client";

// Leaflet touches `window` at module load time, so it cannot be part of the
// server-rendered bundle. `next/dynamic` with `ssr: false` is only allowed
// inside a Client Component, hence this thin wrapper around the real
// implementation in `location-picker-inner.tsx`.
import dynamic from "next/dynamic";

export const LocationPicker = dynamic(
  () => import("@/components/location-picker-inner").then((m) => m.LocationPicker),
  { ssr: false },
);
