"use client";

// In-page camera capture via getUserMedia. The live viewfinder is the primary
// way to start a moment: a photo taken here is happening *now*, which means
// live geolocation is the correct source of truth for where it happened
// (a camera frame carries no EXIF GPS or timestamp of its own).
//
// Produces a File, so the captured frame feeds into the same
// cropper -> sound -> save flow as a photo chosen from the library.

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Loader2, RefreshCw, X } from "lucide-react";

import { Button } from "@/components/ui/button";

type Facing = "environment" | "user";

/** Whether this browser can offer a live camera at all. getUserMedia is
 * secure-context only, so plain http:// (e.g. testing over a LAN IP) has no
 * camera even though the browser supports it. */
export function cameraSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === "function" &&
    (typeof window === "undefined" || window.isSecureContext)
  );
}

export interface PhotoCameraProps {
  onCancel: () => void;
  onCapture: (file: File) => void;
}

export function PhotoCamera({ onCancel, onCapture }: PhotoCameraProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [facing, setFacing] = useState<Facing>("environment");
  const [ready, setReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Whether more than one camera exists — no point offering a flip button on
  // a device with a single lens (most laptops).
  const [canFlip, setCanFlip] = useState(false);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  // (Re)open the stream whenever the requested camera changes.
  useEffect(() => {
    let cancelled = false;

    const open = async () => {
      setReady(false);
      setError(null);
      stopStream();

      if (!cameraSupported()) {
        setError(
          window.isSecureContext === false
            ? "The camera needs a secure (https) connection."
            : "This browser can't open a camera.",
        );
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          // iOS Safari needs playsInline (set on the element) plus an explicit
          // play() call; autoplay alone doesn't reliably start the preview.
          await video.play().catch(() => {});
        }
        if (!cancelled) setReady(true);

        // Only advertise flipping if the device actually has a second camera.
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const cameras = devices.filter((d) => d.kind === "videoinput");
          if (!cancelled) setCanFlip(cameras.length > 1);
        } catch {
          // Device enumeration is best-effort; leave the flip button hidden.
        }
      } catch (e) {
        if (cancelled) return;
        setError(cameraErrorMessage(e));
      }
    };

    void open();
    return () => {
      cancelled = true;
    };
  }, [facing, stopStream]);

  // Release the camera when the component goes away.
  useEffect(() => stopStream, [stopStream]);

  const capture = async () => {
    const video = videoRef.current;
    if (!video || !ready) return;
    setCapturing(true);
    try {
      // Grab the frame at the sensor's own resolution.
      const width = video.videoWidth;
      const height = video.videoHeight;
      if (!width || !height) throw new Error("The camera isn't ready yet.");

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas unavailable");

      // The front camera preview is mirrored for a natural selfie view; undo
      // that when writing the frame so the saved photo isn't back-to-front.
      if (facing === "user") {
        ctx.translate(width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(video, 0, 0, width, height);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.92),
      );
      if (!blob) throw new Error("Couldn't read that frame.");

      stopStream();
      onCapture(
        new File([blob], `photo-${Date.now()}.jpg`, { type: "image/jpeg" }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't take that photo.");
    } finally {
      setCapturing(false);
    }
  };

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <div className="relative w-full max-w-sm overflow-hidden rounded-neo border-3 border-border bg-black shadow-neo-sm">
        {/* Square viewfinder, matching the crop every photo ends up in. */}
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className={`aspect-square w-full object-cover ${
            facing === "user" ? "-scale-x-100" : ""
          }`}
        />

        {!ready && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white">
            <Loader2 className="size-6 animate-spin" />
            <span className="text-xs">Starting camera…</span>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center text-white">
            <Camera className="size-6 opacity-70" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {canFlip && ready && (
          <button
            type="button"
            onClick={() =>
              setFacing((f) => (f === "environment" ? "user" : "environment"))
            }
            aria-label="Switch camera"
            className="absolute right-3 top-3 rounded-full bg-black/55 p-2 text-white hover:bg-black/75"
          >
            <RefreshCw className="size-4" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Button type="button" variant="ghost" onClick={onCancel}>
          <X className="mr-2 size-4" /> Cancel
        </Button>
        <Button
          type="button"
          onClick={capture}
          disabled={!ready || capturing || !!error}
        >
          {capturing ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <Camera className="mr-2 size-4" />
          )}
          Take photo
        </Button>
      </div>
    </div>
  );
}

/** Turn a getUserMedia rejection into something worth showing a person. */
function cameraErrorMessage(e: unknown): string {
  const name = e instanceof Error ? e.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Camera access was blocked. Allow it in your browser settings to take a photo.";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return "No camera found on this device.";
  }
  if (name === "NotReadableError") {
    return "The camera is already in use by another app.";
  }
  return e instanceof Error ? e.message : "Couldn't open the camera.";
}
