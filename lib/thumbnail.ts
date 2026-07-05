// Client-side photo thumbnail generation using canvas. Keeps thumbnails small
// and cheap so the map/timeline can load many at once without pulling full
// resolution originals.

const MAX_THUMB_DIM = 320; // longest edge, px
const THUMB_QUALITY = 0.7;

export interface Thumbnail {
  blob: Blob;
  width: number;
  height: number;
}

/**
 * Downscale an image file to a JPEG thumbnail whose longest edge is at most
 * MAX_THUMB_DIM. Returns null if the file can't be decoded as an image.
 */
export async function generatePhotoThumbnail(
  file: File,
): Promise<Thumbnail | null> {
  const bitmap = await loadBitmap(file);
  if (!bitmap) return null;

  const scale = Math.min(
    1,
    MAX_THUMB_DIM / Math.max(bitmap.width, bitmap.height),
  );
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close?.();
    return null;
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", THUMB_QUALITY),
  );
  if (!blob) return null;
  return { blob, width, height };
}

async function loadBitmap(file: File): Promise<ImageBitmap | null> {
  try {
    // createImageBitmap handles EXIF orientation and is fast; fall back to
    // an <img> decode if unavailable.
    if (typeof createImageBitmap === "function") {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    }
  } catch {
    // fall through
  }
  try {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.src = url;
    await img.decode();
    const bmp = await createImageBitmap(img);
    URL.revokeObjectURL(url);
    return bmp;
  } catch {
    return null;
  }
}
