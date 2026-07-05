"use client";

import { useEffect } from "react";
import { Mic, Square, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAudioRecorder, type AudioRecording } from "@/lib/use-audio-recorder";

function formatDuration(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export function AudioRecorderControl({
  onChange,
}: {
  onChange: (recording: AudioRecording | null) => void;
}) {
  const { status, recording, error, elapsedSec, supported, start, stop, reset } =
    useAudioRecorder();

  // Bubble the finished recording (or its removal) up to the form.
  useEffect(() => {
    onChange(recording);
  }, [recording, onChange]);

  if (!supported) {
    return (
      <p className="text-sm text-muted-foreground">
        Audio recording isn&apos;t supported in this browser.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        {status === "recording" ? (
          <Button type="button" variant="destructive" onClick={stop}>
            <Square className="mr-2 size-4" /> Stop
          </Button>
        ) : (
          <Button type="button" variant="secondary" onClick={start}>
            <Mic className="mr-2 size-4" />
            {status === "stopped" ? "Re-record" : "Record audio"}
          </Button>
        )}

        {status === "recording" && (
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="inline-block size-2 animate-pulse rounded-full bg-red-500" />
            {formatDuration(elapsedSec)}
          </span>
        )}

        {status === "stopped" && recording && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              reset();
              onChange(null);
            }}
          >
            <RotateCcw className="mr-2 size-4" /> Clear
          </Button>
        )}
      </div>

      {status === "stopped" && recording && (
        <div className="flex flex-col gap-1">
          <audio controls src={recording.url} className="w-full max-w-md" />
          <span className="text-xs text-muted-foreground">
            {formatDuration(recording.durationSec)} recorded
          </span>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
