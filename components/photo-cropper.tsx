"use client";

// A minimal, dependency-free square cropper. Every photo in the app is
// displayed cropped to a square (object-cover) — the timeline grid, the map
// popups, the entry detail page. Rather than let that crop happen silently
// and unpredictably, this lets the person capturing the moment see and
// choose the square framing themselves before it's saved.

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, X, ZoomIn } from "lucide-react";

import { Button } from "@/components/ui/button";

// The crop viewport is a fixed square, in CSS pixels.
const VIEWPORT = 320;
// Cap the exported crop's resolution so files stay reasonably sized while
// still being much sharper than the 320px list thumbnail.
const MAX_OUTPUT_DIM = 1600;
const OUTPUT_QUALITY = 0.88;

export interface PhotoCropperProps {
  file: File;
  onCancel: () => void;
  onConfirm: (cropped: File) => void;
}

export function PhotoCropper({ file, onCancel, onConfirm }: PhotoCropperProps) {
  const [imgEl, setImgEl] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [processing, setProcessing] = useState(false);

  const dragRef = useRef<{
    startX: number;
    startY: number;
    startOffset: { x: number; y: number };
  } | null>(null);

  // Load the picked file into an <img> once. The browser applies EXIF
  // orientation to naturalWidth/naturalHeight and rendering for us.
  useEffect(() => {
    const url = URL.createObjectURL(file);
    const el = new Image();
    el.onload = () => setImgEl(el);
    el.src = url;
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  // How much a zoom=1 image must be scaled to cover the square viewport.
  const coverScale = useMemo(() => {
    if (!imgEl) return 1;
    return VIEWPORT / Math.min(imgEl.naturalWidth, imgEl.naturalHeight);
  }, [imgEl]);

  const scale = coverScale * zoom;
  const dispW = imgEl ? imgEl.naturalWidth * scale : VIEWPORT;
  const dispH = imgEl ? imgEl.naturalHeight * scale : VIEWPORT;
  const maxOffsetX = Math.max(0, (dispW - VIEWPORT) / 2);
  const maxOffsetY = Math.max(0, (dispH - VIEWPORT) / 2);

  const clamp = (value: number, max: number) =>
    Math.min(max, Math.max(-max, value));

  // Re-clamp whenever zoom changes (zooming out can leave a gap otherwise).
  useEffect(() => {
    setOffset((prev) => ({
      x: clamp(prev.x, maxOffsetX),
      y: clamp(prev.y, maxOffsetY),
    }));
    // Only re-run when the bounds change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxOffsetX, maxOffsetY]);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, startOffset: offset };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setOffset({
      x: clamp(dragRef.current.startOffset.x + dx, maxOffsetX),
      y: clamp(dragRef.current.startOffset.y + dy, maxOffsetY),
    });
  };

  const onPointerUp = () => {
    dragRef.current = null;
  };

  const confirm = async () => {
    if (!imgEl) return;
    setProcessing(true);
    try {
      // Map the viewport square back to a source rect in natural image
      // pixels, then draw just that rect to an output canvas.
      const left = (VIEWPORT - dispW) / 2 + offset.x;
      const top = (VIEWPORT - dispH) / 2 + offset.y;
      const sw = VIEWPORT / scale;
      const sh = sw; // square
      const sx = Math.min(
        Math.max(0, -left / scale),
        imgEl.naturalWidth - sw,
      );
      const sy = Math.min(
        Math.max(0, -top / scale),
        imgEl.naturalHeight - sh,
      );

      const outSize = Math.round(Math.min(sw, MAX_OUTPUT_DIM));
      const canvas = document.createElement("canvas");
      canvas.width = outSize;
      canvas.height = outSize;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas unavailable");
      ctx.drawImage(imgEl, sx, sy, sw, sh, 0, 0, outSize, outSize);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", OUTPUT_QUALITY),
      );
      if (!blob) throw new Error("Couldn't process image");

      const name = file.name.replace(/\.[^.]+$/, "") + "-cropped.jpg";
      onConfirm(new File([blob], name, { type: "image/jpeg" }));
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        className="relative touch-none select-none overflow-hidden rounded-neo border-3 border-border bg-muted shadow-neo-sm"
        style={{ width: VIEWPORT, height: VIEWPORT }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {imgEl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imgEl.src}
            alt="Crop preview"
            draggable={false}
            className="absolute max-w-none cursor-move"
            style={{
              width: dispW,
              height: dispH,
              left: (VIEWPORT - dispW) / 2 + offset.x,
              top: (VIEWPORT - dispH) / 2 + offset.y,
            }}
          />
        )}
        {/* Square framing guide. */}
        <div className="pointer-events-none absolute inset-0 border-2 border-white/70" />
      </div>

      <div className="flex w-full max-w-xs items-center gap-2">
        <ZoomIn className="size-4 shrink-0 text-muted-foreground" />
        <input
          type="range"
          min={1}
          max={4}
          step={0.01}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="w-full"
          aria-label="Zoom"
        />
      </div>

      <p className="text-xs text-muted-foreground">
        Drag to reposition, use the slider to zoom.
      </p>

      <div className="flex items-center gap-3">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={processing}>
          <X className="mr-2 size-4" /> Cancel
        </Button>
        <Button type="button" onClick={confirm} disabled={!imgEl || processing}>
          <Check className="mr-2 size-4" /> Use this crop
        </Button>
      </div>
    </div>
  );
}
