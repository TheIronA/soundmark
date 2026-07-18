"use client";

// One-gesture capture of a "moment": a photo paired with a short sound.
// Flow: pick/take a photo -> immediately record a sound -> save. Location and
// time come from the photo's EXIF when available (geolocation as a fallback).
// Title/note are optional and tucked away; the photo+sound pairing is the act.

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2, MapPin, Check, ChevronDown, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AudioRecorderControl } from "@/components/audio-recorder-control";
import { LocationPicker } from "@/components/location-picker";
import { PhotoCropper } from "@/components/photo-cropper";
import { PhotoCamera, cameraSupported } from "@/components/photo-camera";
import { getCurrentPosition, readPhotoExif, formatLatLng } from "@/lib/geo";
import {
  audioExtensionFor,
  createMoment,
  type NewMediaInput,
} from "@/lib/create-entry";
import type { AudioRecording } from "@/lib/use-audio-recorder";

type Step = "photo" | "camera" | "crop" | "sound";

export function MomentCapture() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("photo");
  // The just-picked, uncropped file, shown in the cropper before it becomes `photo`.
  const [rawPhoto, setRawPhoto] = useState<File | null>(null);
  // Where rawPhoto came from, so cancelling the crop returns to the right
  // place (back to the viewfinder for a camera shot, not the start screen).
  const [photoSource, setPhotoSource] = useState<"camera" | "library">(
    "library",
  );
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [recording, setRecording] = useState<AudioRecording | null>(null);

  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [recordedAt, setRecordedAt] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  // The manual map picker is always available via the edit button, and
  // opens automatically when both EXIF and live geolocation fail.
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  // Set when live geolocation was tried and failed. A live camera shot has no
  // EXIF to fall back on, so this is the difference between "located" and
  // "this moment will be saved without a place" — worth saying out loud
  // rather than silently dropping to the manual picker.
  const [locationDenied, setLocationDenied] = useState(false);

  const [showDetails, setShowDetails] = useState(false);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Whether to offer the live camera. Resolved after mount rather than during
  // render: the server has no `navigator`, so testing it inline would produce
  // a hydration mismatch. Starts false, so the library picker is what renders
  // if the camera turns out to be unavailable.
  const [canUseCamera, setCanUseCamera] = useState(false);
  useEffect(() => {
    setCanUseCamera(cameraSupported());
  }, []);

  // Live geolocation (+ manual-pin fallback), shared by both entry points
  // below since neither has photo EXIF to derive a location from.
  const locateLive = useCallback(async () => {
    setLocating(true);
    try {
      const pos = await getCurrentPosition();
      setLat(pos.lat);
      setLng(pos.lng);
      setLocationDenied(false);
      return true;
    } catch {
      setLocationDenied(true);
      setShowLocationPicker(true);
      return false;
    } finally {
      setLocating(false);
    }
  }, []);

  const handlePhotoPicked = useCallback(
    async (file: File | null) => {
      if (!file) return;
      setError(null);
      setRawPhoto(file);
      setPhotoSource("library");
      setShowLocationPicker(false);

      // Show the cropper first — the photo isn't "picked" for real until the
      // framing is confirmed.
      setStep("crop");

      // Derive location + time from the photo now, while cropping happens;
      // the crop (a re-encoded canvas image) won't carry EXIF itself.
      const { gps, takenAt } = await readPhotoExif(file);
      setRecordedAt(takenAt ?? new Date().toISOString());
      if (gps) {
        setLat(gps.lat);
        setLng(gps.lng);
      } else {
        await locateLive();
      }
    },
    [locateLive],
  );

  // A frame from the live camera. Unlike a library photo there's no EXIF to
  // read — the shot is happening here and now, so live geolocation *is* the
  // right answer for where it happened, and "now" for when.
  const handleCameraCapture = useCallback(
    async (file: File) => {
      setError(null);
      setRawPhoto(file);
      setPhotoSource("camera");
      setShowLocationPicker(false);
      setRecordedAt(new Date().toISOString());
      setStep("crop");
      await locateLive();
    },
    [locateLive],
  );

  const handleCropConfirm = useCallback((cropped: File) => {
    setPhoto(cropped);
    setPhotoPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(cropped);
    });
    setRawPhoto(null);
    setStep("sound");
  }, []);

  const handleCropCancel = useCallback(() => {
    setRawPhoto(null);
    setStep(photoSource === "camera" ? "camera" : "photo");
  }, [photoSource]);

  const handleSkipPhoto = useCallback(() => {
    setError(null);
    setPhoto(null);
    setShowLocationPicker(false);
    setStep("sound");
    setRecordedAt(new Date().toISOString());
    void locateLive();
  }, [locateLive]);

  const handleManualLocation = useCallback((pickedLat: number, pickedLng: number) => {
    setLat(pickedLat);
    setLng(pickedLng);
  }, []);

  const handleAudioChange = useCallback((rec: AudioRecording | null) => {
    setRecording(rec);
  }, []);

  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  const handleSave = async () => {
    if (!photo && !recording) return;
    setError(null);
    setSubmitting(true);
    try {
      const photoMedia: NewMediaInput | null = photo
        ? {
            type: "photo",
            data: photo,
            filename: photo.name,
          }
        : null;
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

  // The library picker keeps no `capture` attribute: a photo chosen there may
  // be an older one, and its own EXIF GPS/time is the best record of where and
  // when it was taken. The live camera is the other path — see
  // handleCameraCapture. Mounted in every step that offers it, so the "choose
  // from library" escape hatch works from the viewfinder too.
  const libraryInput = (
    <input
      ref={fileInputRef}
      type="file"
      accept="image/*"
      className="hidden"
      onChange={(e) => handlePhotoPicked(e.target.files?.[0] ?? null)}
    />
  );

  // Step 1: the photo is the entry point. Big, single tap.
  if (step === "photo") {
    return (
      <div className="flex flex-col items-center gap-6 py-8">
        {libraryInput}
        <button
          type="button"
          onClick={() => (canUseCamera ? setStep("camera") : fileInputRef.current?.click())}
          className="flex aspect-square w-full max-w-sm flex-col items-center justify-center gap-4 rounded-neo border-3 border-dashed border-border text-muted-foreground transition-colors hover:border-accent hover:text-accent"
        >
          <Camera className="size-16" strokeWidth={1.5} />
          <span className="text-lg font-medium">Capture a moment</span>
          <span className="text-sm">
            {canUseCamera
              ? "Tap to open the camera"
              : "Choose a photo to begin"}
          </span>
        </button>
        {canUseCamera && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-sm text-muted-foreground underline-offset-4 hover:text-accent hover:underline"
          >
            Or choose a photo from your library
          </button>
        )}
        <button
          type="button"
          onClick={handleSkipPhoto}
          className="text-sm text-muted-foreground underline-offset-4 hover:text-accent hover:underline"
        >
          Or just record a sound, no photo
        </button>
      </div>
    );
  }

  // Step 1a: the live viewfinder. A shot taken here is happening now, so its
  // location comes from live geolocation rather than EXIF.
  if (step === "camera") {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        {libraryInput}
        <PhotoCamera
          onCancel={() => setStep("photo")}
          onCapture={handleCameraCapture}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="text-sm text-muted-foreground underline-offset-4 hover:text-accent hover:underline"
        >
          Or choose a photo from your library
        </button>
      </div>
    );
  }

  // Step 1.5: crop the picked photo to the square it'll be shown as
  // everywhere in the app, before committing to it.
  if (step === "crop" && rawPhoto) {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <PhotoCropper
          file={rawPhoto}
          onCancel={handleCropCancel}
          onConfirm={handleCropConfirm}
        />
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
              <button
                type="button"
                onClick={() => setShowLocationPicker((v) => !v)}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Edit location"
              >
                <Pencil className="size-3.5" />
              </button>
            </>
          )}
        </div>
        {/* Live geolocation failed and there's no EXIF to fall back on, so
            this moment would be saved with no place at all. Say so, and offer
            the retry before falling back to pinning it by hand. */}
        {locationDenied && lat === null && !locating && (
          <div className="flex w-full max-w-sm flex-col items-center gap-2 rounded-neo border-3 border-warning/40 bg-warning/10 p-3 text-center">
            <p className="text-xs text-muted-foreground">
              This moment has no location yet. Enable location access, or pin
              it on the map below.
            </p>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => void locateLive()}
            >
              <MapPin className="mr-2 size-4" /> Try location again
            </Button>
          </div>
        )}

        {showLocationPicker && !locating && (
          <div className="flex w-full max-w-sm flex-col gap-2">
            <p className="text-xs text-muted-foreground">
              Tap the map to set this moment&apos;s location.
            </p>
            <LocationPicker lat={lat} lng={lng} onPick={handleManualLocation} />
          </div>
        )}
      </div>

      <div className="flex flex-col items-center gap-2 rounded-neo border-3 border-border bg-card p-5 shadow-neo-sm">
        <span className="text-sm font-medium">Now add the sound</span>
        <span className="text-xs text-muted-foreground">
          Record a few seconds of what this place sounded like, or upload a
          voice file.
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
        <Button
          onClick={handleSave}
          disabled={submitting || (!photo && !recording)}
          className="flex-1"
        >
          {submitting ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <Check className="mr-2 size-4" />
          )}
          Save moment
        </Button>
      </div>
      {!photo && !recording && !submitting && (
        <p className="-mt-3 text-center text-xs text-muted-foreground">
          Add a photo or record a sound to save this moment.
        </p>
      )}
      {photo && !recording && !submitting && (
        <p className="-mt-3 text-center text-xs text-muted-foreground">
          You can save with just the photo, but the sound is the point.
        </p>
      )}
    </div>
  );
}
