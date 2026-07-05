"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export interface MapEntry {
  id: string;
  title: string | null;
  lat: number;
  lng: number;
  recorded_at: string;
  photoUrl: string | null;
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
  // One shared audio element so only one moment sounds at a time.
  const audioRef = useRef<HTMLAudioElement | null>(null);

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

    const playAudio = (url: string) => {
      if (!audioRef.current) audioRef.current = new Audio();
      const el = audioRef.current;
      if (el.src !== url) el.src = url;
      el.currentTime = 0;
      void el.play().catch(() => {});
    };

    const bounds = L.latLngBounds([]);
    for (const entry of entries) {
      // Build a small popup card. Tapping the photo plays the sound inline.
      const el = document.createElement("div");
      el.className = "sm-popup";
      el.style.width = "180px";

      if (entry.photoUrl) {
        const img = document.createElement("img");
        img.src = entry.photoUrl;
        img.alt = entry.title ?? "Moment";
        img.style.cssText =
          "width:100%;height:120px;object-fit:cover;border-radius:8px;display:block;" +
          (entry.audioUrl ? "cursor:pointer;" : "");
        if (entry.audioUrl) {
          const url = entry.audioUrl;
          img.title = "Tap to hear";
          img.addEventListener("click", () => playAudio(url));
        }
        el.appendChild(img);
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
      if (entry.audioUrl) {
        const hint = document.createElement("div");
        hint.style.cssText = "font-size:11px;margin-top:2px;";
        hint.className = "sm-popup-hint";
        hint.textContent = "🔊 Tap photo to hear";
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
      audioRef.current?.pause();
      map.remove();
      mapRef.current = null;
    };
    // Entries are provided once from the server; set up markers a single time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={containerRef}
      className="h-[70vh] w-full overflow-hidden rounded-neo border-3 border-border shadow-neo"
    />
  );
}
