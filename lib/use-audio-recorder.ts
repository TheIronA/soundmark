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
