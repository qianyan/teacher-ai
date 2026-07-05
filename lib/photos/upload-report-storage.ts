import type { PhotoEntry } from "@/lib/photos/inject-blobs";
import { logicalKeyFromFilename } from "@/lib/photos/inject-blobs";
import { normalizeReportPhotoContentType } from "@/lib/photos/report-photo-mime";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

const SIGN_URL = "/api/blob/report-upload";

function safeFilename(name: string): string {
  return name.replace(/^.*[/\\]/, "").replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 100);
}

type SignResponse = {
  bucket: string;
  path: string;
  token: string;
  signedUrl: string;
  publicUrl: string;
  error?: string;
};

/**
 * Upload a single report photo to Supabase Storage (signed URL from API, then direct upload).
 */
export async function uploadPhotoEntryToStorage(
  entry: PhotoEntry,
): Promise<{ url: string; pathname: string }> {
  if (!logicalKeyFromFilename(entry.logicalName.trim())) {
    throw new Error(`Invalid filename for mapping: ${entry.logicalName}`);
  }

  const pathname = `${entry.id}/${safeFilename(entry.logicalName)}`;
  const contentType = normalizeReportPhotoContentType(
    entry.logicalName,
    entry.file.type || "",
  );
  if (!contentType) {
    throw new Error(
      "无法识别图片类型（请使用 jpg / png / webp / gif / heic 等常见扩展名，或确保文件带有正确的类型）",
    );
  }

  const payload: { pathname: string; contentType: string; size?: number } = {
    pathname,
    contentType,
  };
  if (Number.isFinite(entry.file.size) && entry.file.size > 0) {
    payload.size = entry.file.size;
  }

  const signRes = await fetch(SIGN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });

  const signJson = (await signRes.json()) as SignResponse;
  if (!signRes.ok || signJson.error) {
    throw new Error(signJson.error ?? `Sign failed (${signRes.status})`);
  }

  const supabase = getSupabaseBrowserClient();
  const { error: upErr } = await supabase.storage
    .from(signJson.bucket)
    .uploadToSignedUrl(signJson.path, signJson.token, entry.file, {
      contentType,
    });

  if (upErr) {
    throw new Error(upErr.message);
  }

  return { url: signJson.publicUrl, pathname: signJson.path };
}
