// Location + EXIF helpers used by the entry-creation flow.

import exifr from "exifr";

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface PhotoExif {
  gps: GeoPoint | null;
  /** EXIF capture time, if present, as an ISO string. */
  takenAt: string | null;
}

/** Read the browser's current position via the Geolocation API. */
export function getCurrentPosition(): Promise<GeoPoint> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Geolocation is not available in this browser."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(new Error(err.message || "Could not get location.")),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  });
}

/**
 * Extract GPS coordinates and capture time from a photo file's EXIF data.
 * Returns nulls for anything missing (many images have no GPS).
 */
export async function readPhotoExif(file: File): Promise<PhotoExif> {
  // GPS and capture-date are read independently: exifr's dedicated `gps()`
  // helper is the most reliable way to pull coordinates (per exifr's own
  // docs, more so than passing `{gps: true}` to a general `parse` call), and
  // keeping the date parse separate means a failure in one never blocks the
  // other.
  let gps: GeoPoint | null = null;
  try {
    const coords = await exifr.gps(file);
    if (
      coords &&
      typeof coords.latitude === "number" &&
      typeof coords.longitude === "number"
    ) {
      gps = { lat: coords.latitude, lng: coords.longitude };
    }
  } catch {
    // No GPS block, or an unsupported/corrupt file; fall through.
  }

  let takenAt: string | null = null;
  try {
    const data = await exifr.parse(file, {
      pick: ["DateTimeOriginal", "CreateDate"],
    });
    const taken: Date | undefined = data?.DateTimeOriginal ?? data?.CreateDate;
    if (taken instanceof Date && !Number.isNaN(taken.getTime())) {
      takenAt = taken.toISOString();
    }
  } catch {
    // Best-effort; missing capture date just falls back to "now".
  }

  return { gps, takenAt };
}

/** Format a coordinate pair for display, or a placeholder when unknown. */
export function formatLatLng(
  lat: number | null | undefined,
  lng: number | null | undefined,
): string {
  if (typeof lat !== "number" || typeof lng !== "number") return "No location";
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}
