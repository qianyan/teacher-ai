/**
 * Module-level photo preview thumbnail/stage URL cache.
 * Survives PhotoList / usePhotoPreviewCache unmount so step remounts
 * do not rebuild every thumbnail from scratch.
 */

export type PhotoPreviewCacheEntry = {
  sig: string;
  thumbUrl: string;
  stageUrl: string;
};

const cache = new Map<string, PhotoPreviewCacheEntry>();

function revokeEntry(entry: PhotoPreviewCacheEntry): void {
  URL.revokeObjectURL(entry.thumbUrl);
  URL.revokeObjectURL(entry.stageUrl);
}

export function getPhotoPreviewCacheEntry(
  photoId: string,
  sig: string,
): PhotoPreviewCacheEntry | null {
  const entry = cache.get(photoId);
  if (!entry || entry.sig !== sig) return null;
  return entry;
}

export function putPhotoPreviewCacheEntry(
  photoId: string,
  entry: PhotoPreviewCacheEntry,
): void {
  const prev = cache.get(photoId);
  if (prev) {
    if (prev.thumbUrl !== entry.thumbUrl) URL.revokeObjectURL(prev.thumbUrl);
    if (prev.stageUrl !== entry.stageUrl) URL.revokeObjectURL(prev.stageUrl);
  }
  cache.set(photoId, entry);
}

export function prunePhotoPreviewCache(activeIds: ReadonlySet<string>): void {
  for (const [id, entry] of cache) {
    if (!activeIds.has(id)) {
      revokeEntry(entry);
      cache.delete(id);
    }
  }
}

/** Draft clear / logout — revoke every cached blob URL. */
export function clearPhotoPreviewCache(): void {
  for (const entry of cache.values()) {
    revokeEntry(entry);
  }
  cache.clear();
}

/** Test-only: drop entries without revoking (avoids noisy revoke in unit tests). */
export function __resetPhotoPreviewCacheForTests(): void {
  cache.clear();
}
