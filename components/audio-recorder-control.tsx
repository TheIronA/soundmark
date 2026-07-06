"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square, RotateCcw, Upload, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  useAudioRecorder,
  recordingFromFile,
  type AudioRecording,
} from "@/lib/use-audio-recorder";

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

  const uploadInputRef = useRef<HTMLInputElement>(null);
  // An uploaded file lives alongside recorded audio; whichever is present is
  // the "current" sound. Uploading resets any recording and vice versa.
  const [uploaded, setUploaded] = useState<AudioRecording | null>(null);
  const [loadingFile, setLoadingFile] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const current = uploaded ?? recording;

  // Bubble the current sound (recorded or uploaded) up to the form.
  useEffect(() => {
    onChange(current);
  }, [current, onChange]);

  // Release an uploaded file's object URL when it's replaced or on unmount.
  useEffect(() => {
    return () => {
      if (uploaded) URL.revokeObjectURL(uploaded.url);
    };
  }, [uploaded]);

  const handleFilePicked = async (file: File | null) => {
    if (!file) return;
    setUploadError(null);
    if (!file.type.startsWith("audio/")) {
      setUploadError("Please choose an audio file.");
      return;
    }
    // Clear any in-progress/finished recording so the two don't compete.
    reset();
    setLoadingFile(true);
    try {
      setUploaded((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        return null;
      });
      const rec = await recordingFromFile(file);
      setUploaded(rec);
    } catch {
      setUploadError("Couldn't read that audio file.");
    } finally {
      setLoadingFile(false);
    }
  };

  const clearAll = () => {
    reset();
    setUploaded((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return null;
    });
    setUploadError(null);
    if (uploadInputRef.current) uploadInputRef.current.value = "";
    onChange(null);
  };

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={uploadInputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={(e) => handleFilePicked(e.target.files?.[0] ?? null)}
      />

      <div className="flex flex-wrap items-center gap-3">
        {status === "recording" ? (
          <Button type="button" variant="destructive" onClick={stop}>
            <Square className="mr-2 size-4" /> Stop
          </Button>
        ) : (
          <>
            {supported && (
              <Button type="button" variant="secondary" onClick={start}>
                <Mic className="mr-2 size-4" />
                {current ? "Re-record" : "Record audio"}
              </Button>
            )}
            <Button
              type="button"
              variant="secondary"
              onClick={() => uploadInputRef.current?.click()}
              disabled={loadingFile}
            >
              {loadingFile ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Upload className="mr-2 size-4" />
              )}
              Upload a file
            </Button>
          </>
        )}

        {status === "recording" && (
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="inline-block size-2 animate-pulse rounded-full bg-red-500" />
            {formatDuration(elapsedSec)}
          </span>
        )}

        {current && status !== "recording" && (
          <Button type="button" variant="ghost" size="sm" onClick={clearAll}>
            <RotateCcw className="mr-2 size-4" /> Clear
          </Button>
        )}
      </div>

      {!supported && (
        <p className="text-xs text-muted-foreground">
          Recording isn&apos;t supported in this browser — you can upload an
          audio file instead.
        </p>
      )}

      {current && status !== "recording" && (
        <div className="flex flex-col gap-1">
          <audio controls src={current.url} className="w-full max-w-md" />
          <span className="text-xs text-muted-foreground">
            {current.durationSec > 0
              ? `${formatDuration(current.durationSec)} ${uploaded ? "uploaded" : "recorded"}`
              : uploaded
                ? "Audio file ready"
                : "Recorded"}
          </span>
        </div>
      )}

      {(error || uploadError) && (
        <p className="text-sm text-destructive">{error ?? uploadError}</p>
      )}
    </div>
  );
}
