// Cover-art extraction for the file deck. music-metadata is heavy and only needed on the
// host console, so it is dynamic-imported (kept out of the main/landing bundle).

export interface TrackArtwork {
  /** Full-resolution object URL for the host's own display. */
  objectUrl: string;
  /** Small JPEG data URL safe to broadcast to listeners over the realtime channel. */
  thumbDataUrl: string;
}

interface Picture {
  data: Uint8Array | number[];
  format?: string;
}

/** Wrap an embedded picture's bytes in a Blob (pure, testable without a DOM image). */
export function pictureToBlob(pic: Picture): Blob {
  const bytes = pic.data instanceof Uint8Array ? pic.data : Uint8Array.from(pic.data);
  // Copy into a fresh ArrayBuffer-backed view so the type is a plain BlobPart (not a possibly
  // SharedArrayBuffer-backed view, which TS rejects under strict lib settings).
  const part = new Uint8Array(bytes.length);
  part.set(bytes);
  return new Blob([part.buffer], { type: pic.format || 'image/jpeg' });
}

async function readPicture(file: File): Promise<Picture | null> {
  try {
    const mm = await import('music-metadata');
    const meta = await mm.parseBlob(file);
    return (meta.common.picture?.[0] as Picture | undefined) ?? null;
  } catch {
    return null;
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = reject;
    fr.readAsDataURL(blob);
  });
}

/** Downscale an image Blob to a small JPEG data URL so it fits the realtime payload budget. */
export async function downscaleToDataUrl(blob: Blob, maxPx = 256, quality = 0.72): Promise<string> {
  const url = URL.createObjectURL(blob);
  try {
    const img = await loadImage(url);
    const scale = Math.min(1, maxPx / Math.max(img.width || maxPx, img.height || maxPx));
    const w = Math.max(1, Math.round((img.width || maxPx) * scale));
    const h = Math.max(1, Math.round((img.height || maxPx) * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return await blobToDataUrl(blob);
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', quality);
  } catch {
    // Canvas unavailable / decode failed — fall back to the raw bytes.
    return await blobToDataUrl(blob);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Extract embedded cover art from a track file, or null if it has none. */
export async function extractArtwork(file: File): Promise<TrackArtwork | null> {
  const pic = await readPicture(file);
  if (!pic) return null;
  const blob = pictureToBlob(pic);
  const objectUrl = URL.createObjectURL(blob);
  const thumbDataUrl = await downscaleToDataUrl(blob);
  return { objectUrl, thumbDataUrl };
}
