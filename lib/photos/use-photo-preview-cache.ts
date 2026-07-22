"use client";

import type { PhotoEntry } from "@/lib/photos/inject-blobs";
import { isHeicLikeFile } from "@/lib/photos/heic-preview";
import {
  getPhotoPreviewCacheEntry,
  prunePhotoPreviewCache,
  putPhotoPreviewCacheEntry,
} from "@/lib/photos/photo-preview-cache";
import {
  createThumbnailPairFromFile,
  createThumbnailPairFromRemote,
  previewCacheSignature,
} from "@/lib/photos/preview-thumbnail";
import { useCallback, useEffect, useState } from "react";

type PreviewUrls = {
  thumbUrl: string | null;
  stageUrl: string | null;
  loading: boolean;
};

const GENERATION_CONCURRENCY = 2;

async function runPool<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let index = 0;
  async function next(): Promise<void> {
    while (index < items.length) {
      const i = index++;
      await worker(items[i]!);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => next()));
}

export function usePhotoPreviewCache(photos: PhotoEntry[]) {
  const [previewRevision, setPreviewRevision] = useState(0);
  const bump = useCallback(() => setPreviewRevision((n) => n + 1), []);

  useEffect(() => {
    const active = new Set(photos.map((p) => p.id));
    prunePhotoPreviewCache(active);

    const pending = photos.filter((p) => {
      if (isHeicLikeFile(p.file) || p.ingestError) return false;
      const sig = previewCacheSignature(p);
      return getPhotoPreviewCacheEntry(p.id, sig) == null;
    });

    if (pending.length === 0) return;

    let cancelled = false;

    void runPool(pending, GENERATION_CONCURRENCY, async (photo) => {
      const sig = previewCacheSignature(photo);
      if (getPhotoPreviewCacheEntry(photo.id, sig)) return;

      try {
        const pair =
          photo.file.size > 0
            ? await createThumbnailPairFromFile(photo.file)
            : photo.remoteUrl
              ? await createThumbnailPairFromRemote(photo.remoteUrl)
              : null;

        if (!pair || cancelled) {
          if (pair) {
            URL.revokeObjectURL(pair.thumbUrl);
            URL.revokeObjectURL(pair.stageUrl);
          }
          return;
        }

        // Re-check after await — another run may have filled the same sig.
        if (getPhotoPreviewCacheEntry(photo.id, sig)) {
          URL.revokeObjectURL(pair.thumbUrl);
          URL.revokeObjectURL(pair.stageUrl);
          return;
        }

        putPhotoPreviewCacheEntry(photo.id, { sig, ...pair });
        if (!cancelled) bump();
      } catch (e) {
        console.warn("Preview thumbnail failed:", photo.logicalName, e);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [photos, bump]);

  // Intentionally do NOT clear the module cache on unmount — leaving the
  // photos step must keep thumbnails warm for the next mount (#23 / ADR-0001).

  const getPreviewUrls = useCallback((photo: PhotoEntry | null): PreviewUrls => {
    if (!photo || isHeicLikeFile(photo.file) || photo.ingestError) {
      return { thumbUrl: null, stageUrl: null, loading: false };
    }
    const sig = previewCacheSignature(photo);
    const cached = getPhotoPreviewCacheEntry(photo.id, sig);
    if (cached) {
      return {
        thumbUrl: cached.thumbUrl,
        stageUrl: cached.stageUrl,
        loading: false,
      };
    }
    return { thumbUrl: null, stageUrl: null, loading: true };
  }, []);

  return { getPreviewUrls, previewRevision };
}
