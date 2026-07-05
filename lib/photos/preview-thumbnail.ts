/**
 * Client-only: downscaled preview blobs for filmstrip / stage UI.
 * Full-resolution URLs stay for export and HTML injection.
 */

import { isHeicLikeFile } from "@/lib/photos/heic-preview";
import type { PhotoEntry } from "@/lib/photos/inject-blobs";

export const THUMB_MAX_EDGE = 176;
export const STAGE_MAX_EDGE = 640;

export function previewCacheSignature(entry: PhotoEntry): string {
  if (entry.file.size > 0) {
    return `${entry.id}|local|${entry.file.size}|${entry.file.lastModified}|${entry.logicalName}`;
  }
  return `${entry.id}|remote|${entry.remoteUrl ?? ""}|${entry.logicalName}`;
}

export async function createThumbnailBlobUrl(
  source: Blob,
  maxEdge: number,
): Promise<string> {
  const bitmap = await createImageBitmap(source);
  try {
    const longest = Math.max(bitmap.width, bitmap.height, 1);
    const scale = Math.min(1, maxEdge / longest);
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("无法创建预览画布");
    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("缩略图编码失败"))),
        "image/jpeg",
        0.82,
      );
    });
    return URL.createObjectURL(blob);
  } finally {
    bitmap.close();
  }
}

export async function createThumbnailPairFromFile(
  file: File,
): Promise<{ thumbUrl: string; stageUrl: string }> {
  const [thumbUrl, stageUrl] = await Promise.all([
    createThumbnailBlobUrl(file, THUMB_MAX_EDGE),
    createThumbnailBlobUrl(file, STAGE_MAX_EDGE),
  ]);
  return { thumbUrl, stageUrl };
}

/** Remote-only entry (restored draft): fetch once then downscale. */
export async function createThumbnailPairFromRemote(
  remoteUrl: string,
): Promise<{ thumbUrl: string; stageUrl: string }> {
  const res = await fetch(remoteUrl);
  if (!res.ok) throw new Error(`预览加载失败 (${res.status})`);
  const blob = await res.blob();
  return createThumbnailPairFromBlob(blob);
}

export async function createThumbnailPairFromBlob(
  blob: Blob,
): Promise<{ thumbUrl: string; stageUrl: string }> {
  const [thumbUrl, stageUrl] = await Promise.all([
    createThumbnailBlobUrl(blob, THUMB_MAX_EDGE),
    createThumbnailBlobUrl(blob, STAGE_MAX_EDGE),
  ]);
  return { thumbUrl, stageUrl };
}

export function pickFullscreenPreviewUrl(entry: PhotoEntry): string {
  if (entry.blobUrl && !isHeicLikeFile(entry.file)) return entry.blobUrl;
  return entry.remoteUrl ?? entry.blobUrl;
}
