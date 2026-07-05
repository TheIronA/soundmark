"use client";

// One-gesture capture of a "moment": a photo paired with a short sound.
// Flow: pick/take a photo -> immediately record a sound -> save. Location and
// time come from the photo's EXIF when available (geolocation as a fallback).
// Title/note are optional and tucked away; the photo+sound pairing is the act.

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2, MapPin, Check, ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AudioRecorderControl } from "@/components/audio-recorder-control";
import { getCurrentPosition, readPhotoExif, formatLatLng } from "@/lib/geo";
import {
  audioExtensionFor,
  createMoment,
  type NewMediaInput,
} from "@/lib/create-entry";
import type { AudioRecording } from "@/lib/use-audio-recorder";

type Step = "photo" | "sound";

export function MomentCapture() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("photo");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [recording, setRecording] = useState<AudioRecording | null>(null);

  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [recordedAt, setRecordedAt] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  const [showDetails, setShowDetails] = useState(false);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePhotoPicked = useCallback(
    async (file: File | null) => {
      if (!file) return;
      setError(null);
      setPhoto(file);
      setPhotoPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(file);
      });

      // Advance straight to recording — the sound is the next half of the gesture.
      setStep("sound");

      // Derive location + time from the photo. Fall back to live geolocation
      // if the photo has no GPS.
      const { gps, takenAt } = await readPhotoExif(file);
      setRecordedAt(takenAt ?? new Date().toISOString());
      if (gps) {
        setLat(gps.lat);
        setLng(gps.lng);
      } else {
        setLocating(true);
        try {
          const pos = await getCurrentPosition();
          setLat(pos.lat);
          setLng(pos.lng);
        } catch {
          // No location available; the moment can still be saved without one.
        } finally {
          setLocating(false);
        }
      }
    },
    [],
  );

  const handleAudioChange = useCallback((rec: AudioRecording | null) => {
    setRecording(rec);
  }, []);

  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  const handleSave = async () => {
    if (!photo) return;
    setError(null);
    setSubmitting(true);
    try {
      const photoMedia: NewMediaInput = {
        type: "photo",
        data: photo,
        filename: photo.name,
      };
      const audioMedia: NewMediaInput | null = recording
        ? {
            type: "audio",
            data: recording.blob,
            filename: `sound.${audioExtensionFor(recording.mimeType)}`,
            durationSec: recording.durationSec,
          }
        : null;

      setStatus("Saving your moment…");
      await createMoment(
        {
          title,
          note,
          lat,
          lng,
          placeLabel: null,
          recordedAt: recordedAt ?? new Date().toISOString(),
        },
        photoMedia,
        audioMedia,
      );
      router.push("/app/timeline");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save your moment.");
      setSubmitting(false);
      setStatus(null);
    }
  };

  // Step 1: the photo is the entry point. Big, single tap.
  if (step === "photo") {
    return (
      <div className="flex flex-col items-center gap-6 py-8">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => handlePhotoPicked(e.target.files?.[0] ?? null)}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex aspect-square w-full max-w-sm flex-col items-center justify-center gap-4 rounded-neo border-3 border-dashed border-border text-muted-foreground transition-colors hover:border-accent hover:text-accent"
        >
          <Camera className="size-16" strokeWidth={1.5} />
          <span className="text-lg font-medium">Capture a moment</span>
          <span className="text-sm">Take or choose a photo to begin</span>
        </button>
      </div>
    );
  }

  // Step 2: photo is set; record the sound that belongs to it, then save.
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-4">
        {photoPreview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoPreview}
            alt="Your moment"
            className="max-h-80 w-full rounded-neo border-3 border-border object-cover shadow-neo-sm"
          />
        )}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {locating ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Finding location…
            </>
          ) : (
            <>
              <MapPin className="size-4" /> {formatLatLng(lat, lng)}
            </>
          )}
        </div>
      </div>

      <div className="flex flex-col items-center gap-2 rounded-neo border-3 border-border bg-card p-5 shadow-neo-sm">
        <span className="text-sm font-medium">Now record the sound</span>
        <span className="text-xs text-muted-foreground">
          A few seconds of what this place sounded like.
        </span>
        <div className="mt-2">
          <AudioRecorderControl onChange={handleAudioChange} />
        </div>
      </div>

      {/* Optional, secondary details — collapsed by default. */}
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => setShowDetails((s) => !s)}
          className="flex items-center gap-1 self-start text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronDown
            className={`size-4 transition-transform ${showDetails ? "rotate-180" : ""}`}
          />
          Add a title or note (optional)
        </button>
        {showDetails && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="A name for this moment"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="note">Note</Label>
              <Textarea
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Anything you want to remember"
                rows={2}
              />
            </div>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {status && !error && (
        <p className="text-sm text-muted-foreground">{status}</p>
      )}

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={submitting} className="flex-1">
          {submitting ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <Check className="mr-2 size-4" />
          )}
          Save moment
        </Button>
      </div>
      {!recording && !submitting && (
        <p className="-mt-3 text-center text-xs text-muted-foreground">
          You can save with just the photo, but the sound is the point.
        </p>
      )}
    </div>
  );
}
