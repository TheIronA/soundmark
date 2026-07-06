"use client";

// Manual location picker — shown only when a photo has no EXIF GPS and
// live browser geolocation also failed or was denied. Tap the map to drop
// a pin; that becomes the moment's location.

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

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

export function LocationPicker({
  lat,
  lng,
  onPick,
}: {
  lat: number | null;
  lng: number | null;
  onPick: (lat: number, lng: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [lat ?? 20, lng ?? 0],
      zoom: lat != null ? 12 : 1.5,
      zoomControl: false,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);
    L.control.zoom({ position: "topright" }).addTo(map);

    map.on("click", (e: L.LeafletMouseEvent) => {
      const { lat: clickLat, lng: clickLng } = e.latlng;
      onPickRef.current(clickLat, clickLng);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // Set up once; position updates are handled by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the marker in sync with the selected point, without re-creating the map.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || lat == null || lng == null) return;
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
    } else {
      markerRef.current = L.marker([lat, lng], { icon: pinIcon() }).addTo(map);
    }
    map.setView([lat, lng], Math.max(map.getZoom(), 12));
  }, [lat, lng]);

  return (
    <div
      ref={containerRef}
      className="h-80 w-full overflow-hidden rounded-neo border-3 border-border shadow-neo-sm sm:h-64"
    />
  );
}
