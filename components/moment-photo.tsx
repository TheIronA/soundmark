"use client";

// A "living photo": tapping the image plays its attached sound inline, rather
// than navigating away. This is the primary interaction — the photo is the
// entry point to the sound.

import { useEffect, useRef, useState } from "react";
import { Volume2, Pause, ImageOff, Mic } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { refreshObjectUrl } from "@/lib/storage";

// Track the currently-playing element so only one moment sounds at a time,
// across MomentPhoto instances and other players (e.g. the map popup).
let currentAudio: HTMLAudioElement | null = null;

/** Stop whatever moment sound is currently playing, if any. */
export function stopCurrentMomentAudio() {
  currentAudio?.pause();
  currentAudio = null;
}

/**
 * Claim the single "currently playing" slot for `el`, pausing whatever
 * else (from any player, MomentPhoto or otherwise) was playing before it.
 */
export function setCurrentMomentAudio(el: HTMLAudioElement) {
  if (currentAudio && currentAudio !== el) currentAudio.pause();
  currentAudio = el;
}

export interface MomentPhotoProps {
  photoUrl: string | null;
  audioUrl: string | null;
  alt: string;
  /** Storage paths behind the URLs above. Optional, but supplying them lets
   * the component recover when a signed URL expires while the page sits open
   * (see SIGNED_URL_TTL_SEC) by re-signing instead of failing silently. */
  photoPath?: string | null;
  audioPath?: string | null;
  /** Extra classes for the outer button (e.g. sizing / aspect). */
  className?: string;
  rounded?: string;
}

export function MomentPhoto({
  photoUrl,
  audioUrl,
  alt,
  photoPath = null,
  audioPath = null,
  className = "",
  rounded = "rounded-neo",
}: MomentPhotoProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  // Locally-refreshed URLs, used once a server-signed one has expired.
  const [freshPhotoUrl, setFreshPhotoUrl] = useState<string | null>(null);
  const [freshAudioUrl, setFreshAudioUrl] = useState<string | null>(null);

  const shownPhotoUrl = freshPhotoUrl ?? photoUrl;
  const effectiveAudioUrl = freshAudioUrl ?? audioUrl;

  useEffect(() => {
    return () => {
      // Stop and detach on unmount.
      if (audioRef.current) {
        audioRef.current.pause();
        if (currentAudio === audioRef.current) currentAudio = null;
      }
    };
  }, []);

  const toggle = async () => {
    if (!effectiveAudioUrl) return;

    if (!audioRef.current) {
      const el = new Audio(effectiveAudioUrl);
      el.addEventListener("ended", () => setPlaying(false));
      el.addEventListener("pause", () => setPlaying(false));
      el.addEventListener("play", () => setPlaying(true));
      audioRef.current = el;
    }
    const el = audioRef.current;

    if (playing) {
      el.pause();
      return;
    }
    setCurrentMomentAudio(el);
    el.currentTime = 0;
    try {
      await el.play();
    } catch {
      setPlaying(false);
      // The most likely cause on a long-open page is an expired signed URL.
      // Re-sign from the stored path and try once more.
      if (!audioPath) return;
      const fresh = await refreshObjectUrl(createClient(), audioPath);
      if (!fresh) return;
      setFreshAudioUrl(fresh);
      el.src = fresh;
      setCurrentMomentAudio(el);
      el.currentTime = 0;
      void el.play().catch(() => setPlaying(false));
    }
  };

  // An expired signed URL surfaces on the image as a load error; re-sign and
  // swap in a fresh URL so the photo reappears without a reload.
  const handleImageError = async () => {
    if (!photoPath || freshPhotoUrl) return;
    const fresh = await refreshObjectUrl(createClient(), photoPath);
    if (fresh) setFreshPhotoUrl(fresh);
  };

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      disabled={!effectiveAudioUrl}
      aria-label={effectiveAudioUrl ? `Play sound for ${alt}` : alt}
      className={`group relative block overflow-hidden border-3 border-border shadow-neo-sm transition-all ${rounded} ${
        effectiveAudioUrl
          ? "cursor-pointer hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5"
          : "cursor-default"
      } ${className}`}
    >
      {shownPhotoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={shownPhotoUrl}
          alt={alt}
          onError={() => void handleImageError()}
          className="size-full object-cover transition-transform group-hover:scale-[1.02]"
        />
      ) : (
        <div className="flex size-full items-center justify-center bg-muted text-muted-foreground">
          <ImageOff className="size-6" />
        </div>
      )}

      {/* Sound affordance / playing state badge. */}
      {effectiveAudioUrl && (
        <span
          className={`absolute bottom-2 right-2 flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium backdrop-blur transition-colors ${
            playing
              ? "bg-red-500/90 text-white"
              : "bg-black/50 text-white group-hover:bg-black/70"
          }`}
        >
          {playing ? (
            <>
              <Pause className="size-3" />
              <span className="inline-flex items-center gap-[2px]">
                <Bar delay="0ms" />
                <Bar delay="120ms" />
                <Bar delay="240ms" />
              </span>
            </>
          ) : (
            <Volume2 className="size-3.5" />
          )}
        </span>
      )}

      {!effectiveAudioUrl && (
        <span className="absolute bottom-2 right-2 rounded-full bg-black/40 p-1 text-white/70">
          <Mic className="size-3.5" />
        </span>
      )}
    </button>
  );
}

// A tiny animated equalizer bar shown while a sound plays.
function Bar({ delay }: { delay: string }) {
  return (
    <span
      className="inline-block w-[3px] animate-pulse rounded-full bg-white"
      style={{ height: "10px", animationDelay: delay, animationDuration: "700ms" }}
    />
  );
}
