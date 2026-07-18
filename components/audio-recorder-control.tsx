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

// Extensions we treat as audio when the browser reports no (or a non-audio)
// MIME type. Phone voice memos (iOS .m4a, Android .ogg/.opus/.amr, ...) are
// routinely handed to a file input with an empty `file.type`, so we can't
// rely on the MIME type alone to decide whether a picked file is a sound.
const AUDIO_EXTENSIONS = [
  ".mp3",
  ".m4a",
  ".aac",
  ".wav",
  ".ogg",
  ".oga",
  ".opus",
  ".webm",
  ".flac",
  ".amr",
  ".3gp",
  ".3gpp",
  ".caf",
  ".mp4",
];

/** Whether a picked file looks like audio — by MIME type, or, when that's
 * missing/unreliable (common for phone voice memos), by file extension. */
function looksLikeAudio(file: File): boolean {
  if (file.type.startsWith("audio/")) return true;
  const name = file.name.toLowerCase();
  return AUDIO_EXTENSIONS.some((ext) => name.endsWith(ext));
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
    if (!looksLikeAudio(file)) {
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
        // Not `audio/*`: some mobile file pickers grey out voice-memo files
        // (e.g. .m4a/.opus) that arrive with an empty MIME type. We accept any
        // file here and validate it's audio in handleFilePicked instead.
        accept="audio/*,.m4a,.opus,.oga,.amr,.3gp,.3gpp,.caf,.aac,.flac"
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
