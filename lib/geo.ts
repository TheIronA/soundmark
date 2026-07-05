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
  try {
    const data = await exifr.parse(file, {
      gps: true,
      pick: ["latitude", "longitude", "DateTimeOriginal", "CreateDate"],
    });
    if (!data) return { gps: null, takenAt: null };

    const gps =
      typeof data.latitude === "number" && typeof data.longitude === "number"
        ? { lat: data.latitude, lng: data.longitude }
        : null;

    const taken: Date | undefined = data.DateTimeOriginal ?? data.CreateDate;
    const takenAt =
      taken instanceof Date && !Number.isNaN(taken.getTime())
        ? taken.toISOString()
        : null;

    return { gps, takenAt };
  } catch {
    // EXIF parsing is best-effort; never block an upload on it.
    return { gps: null, takenAt: null };
  }
}

/** Format a coordinate pair for display, or a placeholder when unknown. */
export function formatLatLng(
  lat: number | null | undefined,
  lng: number | null | undefined,
): string {
  if (typeof lat !== "number" || typeof lng !== "number") return "No location";
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}
