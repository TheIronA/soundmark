"use client";

// Inline editing for an entry's title and location, shown on the entry
// detail page. Title is a simple text field; location reuses the same
// tap-to-pin map from the capture flow.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Check, X, Loader2, MapPin } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LocationPicker } from "@/components/location-picker";
import { createClient } from "@/lib/supabase/client";
import { formatLatLng } from "@/lib/geo";

export function EditEntryDetails({
  entryId,
  title,
  lat,
  lng,
  placeLabel,
}: {
  entryId: string;
  title: string | null;
  lat: number | null;
  lng: number | null;
  placeLabel: string | null;
}) {
  const router = useRouter();

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(title ?? "");
  const [savingTitle, setSavingTitle] = useState(false);

  const [editingLocation, setEditingLocation] = useState(false);
  const [pendingLat, setPendingLat] = useState(lat);
  const [pendingLng, setPendingLng] = useState(lng);
  const [savingLocation, setSavingLocation] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const saveTitle = async () => {
    setSavingTitle(true);
    setError(null);
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("entries")
      .update({ title: titleValue.trim() || null })
      .eq("id", entryId);
    setSavingTitle(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setEditingTitle(false);
    router.refresh();
  };

  const saveLocation = async () => {
    if (pendingLat == null || pendingLng == null) {
      setEditingLocation(false);
      return;
    }
    setSavingLocation(true);
    setError(null);
    const supabase = createClient();
    // Clearing place_label: a manually-picked pin no longer matches any
    // previously resolved place name.
    const { error: updateError } = await supabase
      .from("entries")
      .update({ lat: pendingLat, lng: pendingLng, place_label: null })
      .eq("id", entryId);
    setSavingLocation(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setEditingLocation(false);
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-3">
      {editingTitle ? (
        <div className="flex items-center gap-2">
          <Input
            value={titleValue}
            onChange={(e) => setTitleValue(e.target.value)}
            placeholder="A name for this moment"
            autoFocus
            className="text-xl font-bold"
          />
          <Button size="icon" variant="secondary" onClick={saveTitle} disabled={savingTitle}>
            {savingTitle ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Check className="size-4" />
            )}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => {
              setTitleValue(title ?? "");
              setEditingTitle(false);
            }}
            disabled={savingTitle}
          >
            <X className="size-4" />
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold">{title || "Untitled moment"}</h1>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setEditingTitle(true)}
            aria-label="Edit title"
          >
            <Pencil className="size-3.5" />
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="size-3.5" />
          <span>{placeLabel || formatLatLng(lat, lng)}</span>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => {
              setPendingLat(lat);
              setPendingLng(lng);
              setEditingLocation((v) => !v);
            }}
            aria-label="Edit location"
          >
            <Pencil className="size-3.5" />
          </Button>
        </div>
        {editingLocation && (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-muted-foreground">
              Tap the map to set a new location.
            </p>
            <LocationPicker
              lat={pendingLat}
              lng={pendingLng}
              onPick={(pickedLat, pickedLng) => {
                setPendingLat(pickedLat);
                setPendingLng(pickedLng);
              }}
            />
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={saveLocation} disabled={savingLocation}>
                {savingLocation ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <Check className="mr-2 size-4" />
                )}
                Save location
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setEditingLocation(false)}
                disabled={savingLocation}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
