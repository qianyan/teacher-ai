/** Allowed storage / sign-upload MIME types for report photos. */
export const REPORT_PHOTO_ALLOWED_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
]);

const EXT_TO_MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".jfif": "image/jpeg",
  ".jpe": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".heic": "image/heic",
  ".heif": "image/heif",
};

function extensionFromFilename(name: string): string {
  const base = name.replace(/^.*[/\\]/, "").toLowerCase();
  const dot = base.lastIndexOf(".");
  return dot >= 0 ? base.slice(dot) : "";
}

/**
 * Normalize browser-reported MIME (often empty or wrong) using filename extension.
 */
export function normalizeReportPhotoContentType(
  filename: string,
  declaredType: string,
): string | null {
  let t = declaredType.trim().toLowerCase();
  if (t === "image/jpg" || t === "image/jpeg") {
    t = "image/jpeg";
  }
  if (REPORT_PHOTO_ALLOWED_MIMES.has(t)) {
    return t;
  }
  if (t === "" || t === "application/octet-stream") {
    const ext = extensionFromFilename(filename);
    const inferred = EXT_TO_MIME[ext];
    if (inferred && REPORT_PHOTO_ALLOWED_MIMES.has(inferred)) {
      return inferred;
    }
  }
  return null;
}
