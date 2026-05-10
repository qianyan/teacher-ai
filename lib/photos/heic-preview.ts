/**
 * HEIC/HEIF: decode to PNG `File` at import/upload time so Blob `remoteUrl` and screenshot HTML stay URL-based (small POST body).
 */

export function isHeicLikeFile(file: File): boolean {
  const t = (file.type || "").toLowerCase();
  if (t.includes("heic") || t.includes("heif")) return true;
  const n = file.name.toLowerCase();
  return n.endsWith(".heic") || n.endsWith(".heif");
}

export async function decodeHeicLikeToPngBlob(file: File): Promise<Blob> {
  const { default: heic2any } = await import("heic2any");
  const result = await heic2any({
    blob: file,
    toType: "image/png",
  });
  const blob = Array.isArray(result) ? result[0] : result;
  if (!(blob instanceof Blob)) {
    throw new Error("HEIC 解码未返回有效图片");
  }
  return blob;
}

/**
 * Uses local `file` when non-empty; otherwise fetches `remoteUrl` (e.g. restored draft without IDB blob).
 */
/** Non-HEIC files pass through unchanged. */
export async function normalizePhotoFileForUpload(file: File): Promise<File> {
  if (!isHeicLikeFile(file)) return file;
  const pngBlob = await decodeHeicLikeToPngBlob(file);
  const stripped = file.name.replace(/^.*[/\\]/, "").replace(/\.[^.]+$/i, "");
  const name = `${stripped || "photo"}.png`;
  return new File([pngBlob], name, { type: "image/png" });
}

export async function decodeHeicLikeToPngBlobFromEntry(p: {
  file: File;
  logicalName: string;
  remoteUrl: string | null;
}): Promise<Blob> {
  if (p.file.size > 0) {
    return decodeHeicLikeToPngBlob(p.file);
  }
  if (p.remoteUrl) {
    const r = await fetch(p.remoteUrl);
    const b = await r.blob();
    const named = new File([b], p.logicalName, { type: b.type || "image/heic" });
    return decodeHeicLikeToPngBlob(named);
  }
  throw new Error("无法解码 HEIC：缺少可用的图片数据");
}

export function allPhotosPreviewReady(
  photos: { file: File; ingestError: string | null }[],
): boolean {
  if (photos.length === 0) return true;
  return photos.every((p) => !isHeicLikeFile(p.file) && !p.ingestError);
}
