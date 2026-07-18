"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { X } from "lucide-react";

import { MomentPhoto, setCurrentMomentAudio } from "@/components/moment-photo";
import { MapSearchBox, type GeocodeResult } from "@/components/map-search-box";

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
  /** Storage paths, so the lightbox can recover from an expired signed URL. */
  fullPhotoPath: string | null;
  audioPath: string | null;
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

    // Popup audio elements, keyed by entry id, so they can be paused when
    // their popup closes or the map unmounts.
    const markerAudioEls = new Map<string, HTMLAudioElement>();

    const bounds = L.latLngBounds([]);
    for (const entry of entries) {
      // Build a small popup card. Tapping the photo/placeholder plays its
      // sound directly, mirroring the tap-to-hear photo on the timeline. A
      // small corner button opens the full-size enlarge lightbox instead.
      const el = document.createElement("div");
      el.className = "sm-popup";
      el.style.width = "180px";

      if (entry.photoUrl || entry.audioUrl) {
        const media = document.createElement("div");
        media.style.cssText =
          "position:relative;width:100%;border-radius:8px;overflow:hidden;";

        let audio: HTMLAudioElement | null = null;
        let playing = false;

        const badge = document.createElement("span");
        badge.style.cssText =
          "position:absolute;bottom:6px;right:6px;display:flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:9999px;background:rgba(0,0,0,.55);color:#fff;font-size:12px;pointer-events:none;";
        badge.textContent = "🔊";

        const setPlaying = (next: boolean) => {
          playing = next;
          badge.textContent = playing ? "⏸" : "🔊";
          badge.style.background = playing
            ? "rgba(239,68,68,.9)"
            : "rgba(0,0,0,.55)";
        };

        if (entry.photoUrl) {
          const img = document.createElement("img");
          img.src = entry.photoUrl;
          img.alt = entry.title ?? "Moment";
          img.style.cssText =
            "width:100%;height:120px;object-fit:cover;display:block;";
          media.appendChild(img);
        } else {
          // No photo on this moment — show a mic placeholder so it isn't a
          // blank popup, mirroring MomentPhoto's audio-only fallback.
          const placeholder = document.createElement("div");
          placeholder.style.cssText =
            "width:100%;height:80px;display:flex;align-items:center;justify-content:center;background:rgba(127,127,127,0.15);font-size:24px;";
          placeholder.textContent = "🎙️";
          media.appendChild(placeholder);
        }

        if (entry.audioUrl) {
          media.style.cursor = "pointer";
          media.title = "Tap to hear";
          media.appendChild(badge);
          media.addEventListener("click", () => {
            if (!audio) {
              audio = new Audio(entry.audioUrl!);
              audio.addEventListener("play", () => setPlaying(true));
              audio.addEventListener("pause", () => setPlaying(false));
              audio.addEventListener("ended", () => setPlaying(false));
              markerAudioEls.set(entry.id, audio);
            }
            if (playing) {
              audio.pause();
              return;
            }
            setCurrentMomentAudio(audio);
            audio.currentTime = 0;
            void audio.play().catch(() => setPlaying(false));
          });
        }

        if (entry.photoUrl) {
          const expand = document.createElement("button");
          expand.type = "button";
          expand.title = "Enlarge";
          expand.setAttribute("aria-label", "Enlarge photo");
          expand.style.cssText =
            "position:absolute;top:6px;right:6px;display:flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:9999px;background:rgba(0,0,0,.55);color:#fff;font-size:12px;border:none;cursor:pointer;";
          expand.textContent = "⤢";
          expand.addEventListener("click", (e) => {
            e.stopPropagation();
            enlargeRef.current(entry);
          });
          media.appendChild(expand);
        }

        el.appendChild(media);
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
      el.appendChild(caption);

      const marker = L.marker([entry.lat, entry.lng], { icon: pinIcon() })
        .bindPopup(el, { maxWidth: 200 })
        .addTo(map);
      marker.getElement()?.style.setProperty("cursor", "pointer");
      // Stop this popup's sound when it closes, so audio doesn't keep
      // playing after the user navigates away from it.
      marker.on("popupclose", () => {
        markerAudioEls.get(entry.id)?.pause();
      });
      bounds.extend([entry.lat, entry.lng]);
    }

    if (entries.length > 1) {
      map.fitBounds(bounds, { padding: [64, 64], maxZoom: 12 });
    }

    return () => {
      for (const el of markerAudioEls.values()) el.pause();
      markerAudioEls.clear();
      map.remove();
      mapRef.current = null;
    };
    // Entries are provided once from the server; set up markers a single time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearchSelect = (result: GeocodeResult) => {
    mapRef.current?.setView([result.lat, result.lng], 13);
  };

  return (
    <>
      <div className="absolute left-3 right-3 top-3 z-[500] sm:left-4 sm:right-auto sm:w-80">
        <MapSearchBox onSelect={handleSearchSelect} />
      </div>
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
              photoPath={enlarged.fullPhotoPath}
              audioPath={enlarged.audioPath}
              alt={enlarged.title || "Moment"}
              className="aspect-square w-full"
            />
          </div>
        </div>
      )}
    </>
  );
}
