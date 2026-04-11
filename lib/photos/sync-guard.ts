import type { PhotoEntry } from "@/lib/photos/inject-blobs";

/**
 * When there are photos, every entry must be synced to Vercel Blob before generate.
 * Empty list allows generate (no image placeholders required).
 */
export function allReportPhotosSynced(photos: PhotoEntry[]): boolean {
  if (photos.length === 0) return true;
  return photos.every(
    (p) => p.uploadStatus === "synced" && Boolean(p.remoteUrl?.trim()),
  );
}
