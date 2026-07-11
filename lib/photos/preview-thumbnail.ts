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

/**
 * 同一 remoteUrl 的并发请求去重：usePhotoPreviewCache 的 effect 在父组件重渲染
 * （或 React StrictMode 开发态双调用）时会重跑，若不去重，恢复草稿类照片
 * （file.size === 0、仅有 remoteUrl）会在前一次 fetch 返回前被再次发起，
 * 造成对同一张图发出多次完全相同的 GET。这里按 URL 复用同一个 in-flight 请求；
 * 各消费者再从共享 Blob 独立生成缩略图，互不影响各自的 blob URL revoke。
 */
const remoteBlobInFlight = new Map<string, Promise<Blob>>();

function fetchRemoteBlob(remoteUrl: string): Promise<Blob> {
  const existing = remoteBlobInFlight.get(remoteUrl);
  if (existing) return existing;
  const promise = (async () => {
    try {
      const res = await fetch(remoteUrl);
      if (!res.ok) throw new Error(`预览加载失败 (${res.status})`);
      return await res.blob();
    } finally {
      // 完成后立即清除，后续调用可正常发起新请求（通常此时照片已入缓存，不会再到这里）
      remoteBlobInFlight.delete(remoteUrl);
    }
  })();
  remoteBlobInFlight.set(remoteUrl, promise);
  return promise;
}

/** Remote-only entry (restored draft): fetch once then downscale. */
export async function createThumbnailPairFromRemote(
  remoteUrl: string,
): Promise<{ thumbUrl: string; stageUrl: string }> {
  const blob = await fetchRemoteBlob(remoteUrl);
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
  // 远端恢复的照片（file.size === 0）blobUrl 可能是 0 字节 blob 或指向已撤销对象，
  // 此时优先用 remoteUrl；仅当本地有真实文件时才用 blobUrl（避免远端网络往返）。
  if (entry.file.size > 0 && entry.blobUrl && !isHeicLikeFile(entry.file)) {
    return entry.blobUrl;
  }
  return entry.remoteUrl ?? entry.blobUrl;
}
