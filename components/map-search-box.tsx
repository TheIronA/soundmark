"use client";

// A location search box for Leaflet maps, backed by OpenStreetMap's free
// Nominatim geocoder (no API key, consistent with the OSM tiles already used
// elsewhere). Debounced-on-submit only (not as-you-type) to stay well under
// Nominatim's 1 req/sec fair-use limit.

import { useState } from "react";
import { Loader2, Search, X } from "lucide-react";

export interface GeocodeResult {
  lat: number;
  lng: number;
  label: string;
}

async function geocode(query: string): Promise<GeocodeResult[]> {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error("Search failed.");
  const data: Array<{ lat: string; lon: string; display_name: string }> =
    await res.json();
  return data.map((d) => ({
    lat: parseFloat(d.lat),
    lng: parseFloat(d.lon),
    label: d.display_name,
  }));
}

export function MapSearchBox({
  onSelect,
  className = "",
}: {
  onSelect: (result: GeocodeResult) => void;
  className?: string;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const runSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    try {
      const found = await geocode(trimmed);
      setResults(found);
      setOpen(true);
      if (found.length === 0) setError("No places found.");
    } catch {
      setError("Search failed. Try again.");
      setResults([]);
      setOpen(true);
    } finally {
      setLoading(false);
    }
  };

  const clear = () => {
    setQuery("");
    setResults([]);
    setError(null);
    setOpen(false);
  };

  return (
    <div className={`relative ${className}`}>
      <form onSubmit={runSearch} className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => results.length > 0 && setOpen(true)}
            placeholder="Search for a place…"
            className="h-10 w-full rounded-neo border-3 border-border bg-card pl-9 pr-8 text-sm shadow-neo-sm outline-none focus:border-accent"
          />
          {query && (
            <button
              type="button"
              onClick={clear}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
        <button
          type="submit"
          disabled={loading || !query.trim()}
          aria-label="Search"
          className="flex h-10 shrink-0 items-center justify-center rounded-neo border-3 border-border bg-card px-3 shadow-neo-sm disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Search className="size-4" />
          )}
        </button>
      </form>

      {open && (results.length > 0 || error) && (
        <div className="absolute z-[1000] mt-1 w-full overflow-hidden rounded-neo border-3 border-border bg-card shadow-neo">
          {error && (
            <p className="px-3 py-2 text-sm text-muted-foreground">{error}</p>
          )}
          {results.map((r, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                onSelect(r);
                setOpen(false);
              }}
              className="block w-full truncate px-3 py-2 text-left text-sm hover:bg-muted"
              title={r.label}
            >
              {r.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
