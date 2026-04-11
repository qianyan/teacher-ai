import { upload } from "@vercel/blob/client";
import {
  logicalKeyFromFilename,
  type PhotoEntry,
} from "@/lib/photos/inject-blobs";

const HANDLE_UPLOAD_URL = "/api/blob/report-upload";

function safeFilename(name: string): string {
  return name.replace(/^.*[/\\]/, "").replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 100);
}

/**
 * Uploads report photos to Vercel Blob (client → Blob, no 4.5MB server body limit).
 * Reuses cached URLs per `PhotoEntry.id` when the same map is passed across calls.
 */
export async function ensureReportPhotoBlobUrls(
  entries: PhotoEntry[],
  urlByPhotoId: Map<string, string>,
): Promise<Map<string, string>> {
  const keyToUrl = new Map<string, string>();

  for (const entry of entries) {
    const key = logicalKeyFromFilename(entry.logicalName.trim());
    if (!key) continue;

    const cached = urlByPhotoId.get(entry.id);
    if (cached) {
      keyToUrl.set(key, cached);
      continue;
    }

    const pathname = `report-photos/${Date.now()}-${entry.id}-${safeFilename(entry.logicalName)}`;
    const result = await upload(pathname, entry.file, {
      access: "public",
      handleUploadUrl: HANDLE_UPLOAD_URL,
      clientPayload: key,
      contentType: entry.file.type || undefined,
      multipart: entry.file.size > 4_500_000,
    });

    urlByPhotoId.set(entry.id, result.url);
    keyToUrl.set(key, result.url);
  }

  return keyToUrl;
}
