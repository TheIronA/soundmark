"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { X } from "lucide-react";

import { MomentPhoto } from "@/components/moment-photo";

export interface MapEntry {
  id: string;
  title: string | null;
  lat: number;
  lng: number;
  recorded_at: string;
  photoUrl: string | null;
  /** Full-resolution original, used for the enlarge lightbox (photoUrl is a
   * small, heavily-compressed thumbnail meant only for the pin popup). */
  fullPhotoUrl: string | null;
  audioUrl: string | null;
}

// Free, keyless OpenStreetMap raster tiles.
const TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

// A small red pin drawn inline so we don't depend on Leaflet's default
// marker image assets (which don't resolve correctly under Next.js bundling).
function pinIcon(): L.DivIcon {
  return L.divIcon({
    className: "",
    html:
      '<div style="width:16px;height:16px;border-radius:50% 50% 50% 0;' +
      "background:#ef4444;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4);" +
      'transform:rotate(-45deg);"></div>',
    iconSize: [16, 16],
    iconAnchor: [8, 16],
    popupAnchor: [0, -16],
  });
}

export function EntriesMap({ entries }: { entries: MapEntry[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  // The entry whose photo is currently enlarged in the lightbox, if any.
  const [enlarged, setEnlarged] = useState<MapEntry | null>(null);
  const enlargeRef = useRef(setEnlarged);
  enlargeRef.current = setEnlarged;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: entries.length ? [entries[0].lat, entries[0].lng] : [20, 0],
      zoom: entries.length ? 4 : 1.5,
      zoomControl: false,
    });
    L.tileLayer(TILE_URL, {
      attribution: TILE_ATTRIBUTION,
      maxZoom: 19,
    }).addTo(map);
    L.control.zoom({ position: "topright" }).addTo(map);
    mapRef.current = map;

    const bounds = L.latLngBounds([]);
    for (const entry of entries) {
      // Build a small popup card. Tapping the photo enlarges it, mirroring
      // the tap-to-hear photo on the entry detail page.
      const el = document.createElement("div");
      el.className = "sm-popup";
      el.style.width = "180px";

      if (entry.photoUrl) {
        const img = document.createElement("img");
        img.src = entry.photoUrl;
        img.alt = entry.title ?? "Moment";
        img.style.cssText =
          "width:100%;height:120px;object-fit:cover;border-radius:8px;display:block;cursor:pointer;";
        img.title = "Tap to enlarge";
        img.addEventListener("click", () => enlargeRef.current(entry));
        el.appendChild(img);
      } else if (entry.audioUrl) {
        // No photo on this moment — show a mic placeholder so it isn't a
        // blank popup, mirroring MomentPhoto's audio-only fallback.
        const placeholder = document.createElement("div");
        placeholder.style.cssText =
          "width:100%;height:80px;border-radius:8px;display:flex;align-items:center;justify-content:center;background:rgba(127,127,127,0.15);font-size:24px;";
        placeholder.textContent = "🎙️";
        el.appendChild(placeholder);
      }

      const caption = document.createElement("div");
      caption.className = "sm-popup-caption";
      caption.style.cssText = "margin-top:6px;font-size:12px;";
      const title = document.createElement("strong");
      title.textContent = entry.title || "Moment";
      const date = document.createElement("div");
      date.className = "sm-popup-date";
      date.style.cssText = "font-size:11px;";
      date.textContent = new Date(entry.recorded_at).toLocaleDateString();
      caption.appendChild(title);
      caption.appendChild(date);
      if (entry.photoUrl || entry.audioUrl) {
        const hint = document.createElement("div");
        hint.style.cssText = "font-size:11px;margin-top:2px;";
        hint.className = "sm-popup-hint";
        hint.textContent = entry.photoUrl
          ? entry.audioUrl
            ? "🔊 Tap photo to enlarge & hear"
            : "Tap photo to enlarge"
          : "🔊 Has sound";
        caption.appendChild(hint);
      }
      el.appendChild(caption);

      const marker = L.marker([entry.lat, entry.lng], { icon: pinIcon() })
        .bindPopup(el, { maxWidth: 200 })
        .addTo(map);
      marker.getElement()?.style.setProperty("cursor", "pointer");
      bounds.extend([entry.lat, entry.lng]);
    }

    if (entries.length > 1) {
      map.fitBounds(bounds, { padding: [64, 64], maxZoom: 12 });
    }

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // Entries are provided once from the server; set up markers a single time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <div
        ref={containerRef}
        className="h-[70vh] w-full overflow-hidden rounded-neo border-3 border-border shadow-neo"
      />

      {/* Lightbox: an enlarged version of the tapped photo, matching the
          tap-to-hear photo on the entry detail page. */}
      {enlarged && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setEnlarged(null)}
        >
          <div
            className="flex w-full max-w-md flex-col gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between text-white">
              <div>
                <div className="font-semibold">
                  {enlarged.title || "Moment"}
                </div>
                <div className="text-xs opacity-80">
                  {new Date(enlarged.recorded_at).toLocaleDateString()}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEnlarged(null)}
                aria-label="Close"
                className="rounded-full bg-white/10 p-2 hover:bg-white/20"
              >
                <X className="size-5" />
              </button>
            </div>
            <MomentPhoto
              photoUrl={enlarged.fullPhotoUrl ?? enlarged.photoUrl}
              audioUrl={enlarged.audioUrl}
              alt={enlarged.title || "Moment"}
              className="aspect-square w-full"
            />
          </div>
        </div>
      )}
    </>
  );
}
