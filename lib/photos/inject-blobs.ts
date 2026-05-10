/**
 * Client-only: map data-report-photo="PREFIX:INDEX" to blob URLs from logical filenames.
 */

import { blobUrlToDataUrl, isHeicLikeFile } from "@/lib/photos/heic-preview";

export { allPhotosPreviewReady } from "@/lib/photos/heic-preview";

export type PhotoEntry = {
  id: string;
  file: File;
  /** e.g. 探究1.jpg — must end with digits before extension */
  logicalName: string;
  /** Object URL for in-browser preview (PNG after HEIC decode, or original file) */
  blobUrl: string;
  /** Public Vercel Blob URL after upload; null until synced or after rename */
  remoteUrl: string | null;
  /** Store pathname from PutBlobResult (for debugging; delete uses url) */
  remotePathname: string | null;
  uploadStatus: "pending" | "uploading" | "synced" | "error";
  uploadError: string | null;
  /** Incremented on rename so stale upload completions are ignored */
  uploadGeneration: number;
  /** False while HEIC/HEIF is decoding to a displayable PNG blob URL */
  previewReady: boolean;
  /** Set when HEIC preview decode fails */
  previewError: string | null;
};

/** Prefer HTTPS for non-HEIC synced photos; HEIC remotes do not render in Chromium-based export. */
export function pickPreviewImageUrl(e: PhotoEntry): string {
  if (e.remoteUrl && !isHeicLikeFile(e.file)) {
    return e.remoteUrl;
  }
  return e.blobUrl;
}

/** Returns PREFIX:INDEX or null if the name does not match {prefix}{index}. */
export function logicalKeyFromFilename(name: string): string | null {
  const base = name.replace(/^.*[/\\]/, "").replace(/\.[^.]+$/i, "");
  const m = base.match(/^(.+?)(\d+)$/);
  if (!m) return null;
  return `${m[1]}:${parseInt(m[2], 10)}`;
}

/** Prefer HTTPS Blob URL for injection so preview / PNG / download use stable links when synced. */
export function buildPhotoBlobUrlMap(entries: PhotoEntry[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const e of entries) {
    const key = logicalKeyFromFilename(e.logicalName.trim());
    if (!key) continue;
    map.set(key, pickPreviewImageUrl(e));
  }
  return map;
}

/**
 * For downloaded HTML: use Blob URL when available, else embed as data URL (offline-capable).
 */
export async function buildPhotoUrlMapForPersist(
  entries: PhotoEntry[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (const e of entries) {
    const key = logicalKeyFromFilename(e.logicalName.trim());
    if (!key) continue;
    if (isHeicLikeFile(e.file)) {
      map.set(key, await blobUrlToDataUrl(e.blobUrl));
    } else if (e.remoteUrl) {
      map.set(key, e.remoteUrl);
    } else {
      map.set(key, await fileToDataUrl(e.file));
    }
  }
  return map;
}

/** For server-side / file-based HTML (e.g. Playwright screenshot): embed photos as data URLs. */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error ?? new Error("FileReader failed"));
    r.readAsDataURL(file);
  });
}

export async function buildPhotoDataUrlMap(
  entries: PhotoEntry[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (const e of entries) {
    const key = logicalKeyFromFilename(e.logicalName.trim());
    if (!key) continue;
    if (isHeicLikeFile(e.file)) {
      map.set(key, await blobUrlToDataUrl(e.blobUrl));
    } else {
      map.set(key, await fileToDataUrl(e.file));
    }
  }
  return map;
}

/**
 * For POST /api/long-screenshot: Chromium cannot load blob: or render HEIC from https:.
 * Inline HEIC-derived PNG as data URLs; keep https for ordinary synced images.
 */
export async function buildPhotoInjectionMapForLongScreenshot(
  entries: PhotoEntry[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (const e of entries) {
    const key = logicalKeyFromFilename(e.logicalName.trim());
    if (!key) continue;
    if (isHeicLikeFile(e.file)) {
      map.set(key, await blobUrlToDataUrl(e.blobUrl));
    } else if (e.remoteUrl) {
      map.set(key, e.remoteUrl);
    } else {
      map.set(key, await fileToDataUrl(e.file));
    }
  }
  return map;
}

export function revokePhotoBlobUrls(map: Map<string, string>): void {
  for (const url of map.values()) {
    URL.revokeObjectURL(url);
  }
}

/** Inject src into img tags that have data-report-photo (blob:, https:, or data: URLs). Browser only. */
export function injectPhotoBlobUrls(html: string, map: Map<string, string>): string {
  if (typeof window === "undefined") return html;
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("img[data-report-photo]").forEach((el) => {
    const img = el as HTMLImageElement;
    const k = img.getAttribute("data-report-photo")?.trim();
    if (!k) return;
    const u = map.get(k);
    if (u) img.setAttribute("src", u);
  });
  const out = doc.documentElement.outerHTML;
  if (out.startsWith("<html")) {
    return "<!DOCTYPE html>\n" + out;
  }
  return out;
}
