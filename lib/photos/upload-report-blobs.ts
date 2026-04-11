import { upload } from "@vercel/blob/client";
import type { PhotoEntry } from "@/lib/photos/inject-blobs";
import { logicalKeyFromFilename } from "@/lib/photos/inject-blobs";

const HANDLE_UPLOAD_URL = "/api/blob/report-upload";

function safeFilename(name: string): string {
  return name.replace(/^.*[/\\]/, "").replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 100);
}

/**
 * Upload a single report photo to Vercel Blob (client → Blob).
 * Path includes photo id and logical filename so renames create a new object with a clear name.
 */
export async function uploadPhotoEntryToBlob(
  entry: PhotoEntry,
): Promise<{ url: string; pathname: string }> {
  const key = logicalKeyFromFilename(entry.logicalName.trim());
  if (!key) {
    throw new Error(`Invalid filename for mapping: ${entry.logicalName}`);
  }

  const pathname = `report-photos/${entry.id}/${safeFilename(entry.logicalName)}`;
  const result = await upload(pathname, entry.file, {
    access: "public",
    handleUploadUrl: HANDLE_UPLOAD_URL,
    clientPayload: key,
    contentType: entry.file.type || undefined,
    multipart: entry.file.size > 4_500_000,
  });

  return { url: result.url, pathname: result.pathname };
}
