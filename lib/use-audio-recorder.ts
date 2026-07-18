"use client";

// In-browser audio recording via the MediaRecorder API.

import { useCallback, useEffect, useRef, useState } from "react";

export interface AudioRecording {
  blob: Blob;
  url: string; // object URL for local playback
  mimeType: string;
  durationSec: number;
}

type RecorderStatus = "idle" | "recording" | "stopped";

/** Read an audio file's duration (seconds) via a throwaway <audio> element.
 * Resolves to 0 if the browser can't determine it. */
function readAudioDuration(url: string): Promise<number> {
  return new Promise((resolve) => {
    const el = document.createElement("audio");
    el.preload = "metadata";
    const done = (value: number) => {
      el.removeAttribute("src");
      resolve(Number.isFinite(value) && value > 0 ? value : 0);
    };
    el.onloadedmetadata = () => done(el.duration);
    el.onerror = () => done(0);
    el.src = url;
  });
}

/** Best-effort MIME type from a filename extension, for the common case of
 * phone voice memos that arrive with an empty `file.type`. */
function mimeTypeFromFilename(name: string): string {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  const map: Record<string, string> = {
    mp3: "audio/mpeg",
    m4a: "audio/mp4",
    mp4: "audio/mp4",
    aac: "audio/aac",
    wav: "audio/wav",
    ogg: "audio/ogg",
    oga: "audio/ogg",
    opus: "audio/ogg",
    webm: "audio/webm",
    flac: "audio/flac",
    amr: "audio/amr",
    "3gp": "audio/3gpp",
    "3gpp": "audio/3gpp",
    caf: "audio/x-caf",
  };
  return map[ext] ?? "audio/mpeg";
}

/** Turn an uploaded audio file into the same shape a recording produces. */
export async function recordingFromFile(file: File): Promise<AudioRecording> {
  const url = URL.createObjectURL(file);
  const durationSec = await readAudioDuration(url);
  return {
    blob: file,
    url,
    // Phone voice memos are often handed over with an empty `file.type`; fall
    // back to guessing from the filename so the stored object gets a sensible
    // extension (see audioExtensionFor).
    mimeType: file.type || mimeTypeFromFilename(file.name),
    durationSec,
  };
}

/** Pick a supported audio container/codec, preferring webm/opus. */
function pickMimeType(): string {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  if (typeof MediaRecorder === "undefined") return "";
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
}

export function useAudioRecorder() {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [recording, setRecording] = useState<AudioRecording | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number>(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cleanupTick = () => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  };

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const start = useCallback(async () => {
    setError(null);
    // Discard any previous recording's object URL.
    setRecording((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return null;
    });
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined,
      );
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const type = recorder.mimeType || mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        const durationSec = (Date.now() - startedAtRef.current) / 1000;
        setRecording({
          blob,
          url: URL.createObjectURL(blob),
          mimeType: type,
          durationSec,
        });
        setStatus("stopped");
        stopStream();
        cleanupTick();
      };
      recorderRef.current = recorder;
      startedAtRef.current = Date.now();
      setElapsedSec(0);
      recorder.start();
      setStatus("recording");
      tickRef.current = setInterval(() => {
        setElapsedSec((Date.now() - startedAtRef.current) / 1000);
      }, 200);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not access the microphone.",
      );
      stopStream();
    }
  }, []);

  const stop = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
  }, []);

  const reset = useCallback(() => {
    setRecording((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return null;
    });
    setStatus("idle");
    setElapsedSec(0);
    setError(null);
  }, []);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      cleanupTick();
      stopStream();
      setRecording((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        return null;
      });
    };
  }, []);

  const supported =
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices &&
    typeof MediaRecorder !== "undefined";

  return { status, recording, error, elapsedSec, supported, start, stop, reset };
}
