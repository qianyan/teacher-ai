"use client";

import type { PhotoEntry } from "@/lib/photos/inject-blobs";
import { isHeicLikeFile } from "@/lib/photos/heic-preview";
import {
  createThumbnailPairFromFile,
  createThumbnailPairFromRemote,
  previewCacheSignature,
} from "@/lib/photos/preview-thumbnail";
import { useCallback, useEffect, useRef, useState } from "react";

type CachedPreview = {
  sig: string;
  thumbUrl: string;
  stageUrl: string;
};

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
  const cacheRef = useRef(new Map<string, CachedPreview>());
  const [previewRevision, setPreviewRevision] = useState(0);
  const bump = useCallback(() => setPreviewRevision((n) => n + 1), []);

  useEffect(() => {
    const cache = cacheRef.current;
    const active = new Set(photos.map((p) => p.id));

    for (const [id, entry] of cache) {
      if (!active.has(id)) {
        URL.revokeObjectURL(entry.thumbUrl);
        URL.revokeObjectURL(entry.stageUrl);
        cache.delete(id);
      }
    }

    const pending = photos.filter((p) => {
      if (isHeicLikeFile(p.file) || p.ingestError) return false;
      const sig = previewCacheSignature(p);
      return cache.get(p.id)?.sig !== sig;
    });

    if (pending.length === 0) return;

    let cancelled = false;

    void runPool(pending, GENERATION_CONCURRENCY, async (photo) => {
      const sig = previewCacheSignature(photo);
      const prev = cache.get(photo.id);
      if (prev?.sig === sig) return;

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

        if (prev) {
          URL.revokeObjectURL(prev.thumbUrl);
          URL.revokeObjectURL(prev.stageUrl);
        }

        cache.set(photo.id, { sig, ...pair });
        if (!cancelled) bump();
      } catch (e) {
        console.warn("Preview thumbnail failed:", photo.logicalName, e);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [photos, bump]);

  useEffect(() => {
    const cache = cacheRef.current;
    return () => {
      for (const entry of cache.values()) {
        URL.revokeObjectURL(entry.thumbUrl);
        URL.revokeObjectURL(entry.stageUrl);
      }
      cache.clear();
    };
  }, []);

  const getPreviewUrls = useCallback((photo: PhotoEntry | null): PreviewUrls => {
    if (!photo || isHeicLikeFile(photo.file) || photo.ingestError) {
      return { thumbUrl: null, stageUrl: null, loading: false };
    }
    const cached = cacheRef.current.get(photo.id);
    const sig = previewCacheSignature(photo);
    if (cached?.sig === sig) {
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
