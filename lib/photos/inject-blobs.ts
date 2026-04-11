/**
 * Client-only: map data-report-photo="PREFIX:INDEX" to blob URLs from logical filenames.
 */

export type PhotoEntry = {
  id: string;
  file: File;
  /** e.g. 探究1.jpg — must end with digits before extension */
  logicalName: string;
  /** Stable object URL for previews and injection; revoke when removing the photo */
  blobUrl: string;
};

/** Returns PREFIX:INDEX or null if the name does not match {prefix}{index}. */
export function logicalKeyFromFilename(name: string): string | null {
  const base = name.replace(/^.*[/\\]/, "").replace(/\.[^.]+$/i, "");
  const m = base.match(/^(.+?)(\d+)$/);
  if (!m) return null;
  return `${m[1]}:${parseInt(m[2], 10)}`;
}

export function buildPhotoBlobUrlMap(entries: PhotoEntry[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const e of entries) {
    const key = logicalKeyFromFilename(e.logicalName.trim());
    if (!key) continue;
    map.set(key, e.blobUrl);
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
    map.set(key, await fileToDataUrl(e.file));
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
