"use client";

// A "living photo": tapping the image plays its attached sound inline, rather
// than navigating away. This is the primary interaction — the photo is the
// entry point to the sound.

import { useEffect, useRef, useState } from "react";
import { Volume2, Pause, ImageOff, Mic } from "lucide-react";

// Track the currently-playing element so only one moment sounds at a time.
let currentAudio: HTMLAudioElement | null = null;

export interface MomentPhotoProps {
  photoUrl: string | null;
  audioUrl: string | null;
  alt: string;
  /** Extra classes for the outer button (e.g. sizing / aspect). */
  className?: string;
  rounded?: string;
}

export function MomentPhoto({
  photoUrl,
  audioUrl,
  alt,
  className = "",
  rounded = "rounded-neo",
}: MomentPhotoProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    return () => {
      // Stop and detach on unmount.
      if (audioRef.current) {
        audioRef.current.pause();
        if (currentAudio === audioRef.current) currentAudio = null;
      }
    };
  }, []);

  const toggle = () => {
    if (!audioUrl) return;

    if (!audioRef.current) {
      const el = new Audio(audioUrl);
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
    // Pause whatever else is playing first.
    if (currentAudio && currentAudio !== el) currentAudio.pause();
    currentAudio = el;
    el.currentTime = 0;
    void el.play().catch(() => setPlaying(false));
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={!audioUrl}
      aria-label={audioUrl ? `Play sound for ${alt}` : alt}
      className={`group relative block overflow-hidden border-3 border-border shadow-neo-sm transition-all ${rounded} ${
        audioUrl
          ? "cursor-pointer hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5"
          : "cursor-default"
      } ${className}`}
    >
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoUrl}
          alt={alt}
          className="size-full object-cover transition-transform group-hover:scale-[1.02]"
        />
      ) : (
        <div className="flex size-full items-center justify-center bg-muted text-muted-foreground">
          <ImageOff className="size-6" />
        </div>
      )}

      {/* Sound affordance / playing state badge. */}
      {audioUrl && (
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

      {!audioUrl && (
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
