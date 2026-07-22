/** @vitest-environment jsdom */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { PhotoEntry } from "@/lib/photos/inject-blobs";
import { previewCacheSignature } from "@/lib/photos/preview-thumbnail";
import {
  clearPhotoPreviewCache,
  putPhotoPreviewCacheEntry,
  __resetPhotoPreviewCacheForTests,
} from "@/lib/photos/photo-preview-cache";
import { usePhotoPreviewCache } from "@/lib/photos/use-photo-preview-cache";

vi.mock("@/lib/photos/preview-thumbnail", async () => {
  const actual = await vi.importActual<typeof import("@/lib/photos/preview-thumbnail")>(
    "@/lib/photos/preview-thumbnail",
  );
  return {
    ...actual,
    createThumbnailPairFromFile: vi.fn(async () => ({
      thumbUrl: "blob:gen-thumb",
      stageUrl: "blob:gen-stage",
    })),
    createThumbnailPairFromRemote: vi.fn(async () => ({
      thumbUrl: "blob:gen-thumb-r",
      stageUrl: "blob:gen-stage-r",
    })),
  };
});

import {
  createThumbnailPairFromFile,
  createThumbnailPairFromRemote,
} from "@/lib/photos/preview-thumbnail";

function photo(overrides: Partial<PhotoEntry> = {}): PhotoEntry {
  const file =
    overrides.file ??
    new File([new Uint8Array([1, 2, 3])], "a1.jpg", { type: "image/jpeg" });
  return {
    id: "p1",
    file,
    logicalName: "a1.jpg",
    blobUrl: "blob:x",
    remoteUrl: null,
    remotePathname: null,
    uploadStatus: "pending",
    uploadError: null,
    uploadGeneration: 0,
    ingestError: null,
    ...overrides,
  };
}

beforeAll(() => {
  if (typeof URL.createObjectURL !== "function") {
    URL.createObjectURL = vi.fn(() => "blob:mock") as typeof URL.createObjectURL;
  }
  if (typeof URL.revokeObjectURL !== "function") {
    URL.revokeObjectURL = vi.fn() as typeof URL.revokeObjectURL;
  }
});

afterEach(() => {
  __resetPhotoPreviewCacheForTests();
  vi.mocked(createThumbnailPairFromFile).mockClear();
  vi.mocked(createThumbnailPairFromRemote).mockClear();
});

describe("usePhotoPreviewCache — module cache survives remount", () => {
  it("returns cached urls immediately after remount without regenerating", async () => {
    const entry = photo();
    const sig = previewCacheSignature(entry);
    putPhotoPreviewCacheEntry(entry.id, {
      sig,
      thumbUrl: "blob:cached-thumb",
      stageUrl: "blob:cached-stage",
    });

    const first = renderHook(() => usePhotoPreviewCache([entry]));
    expect(first.result.current.getPreviewUrls(entry)).toEqual({
      thumbUrl: "blob:cached-thumb",
      stageUrl: "blob:cached-stage",
      loading: false,
    });

    // Allow any scheduled generation effect to run (should be a no-op hit).
    await act(async () => {
      await Promise.resolve();
    });
    expect(createThumbnailPairFromFile).not.toHaveBeenCalled();
    first.unmount();

    const second = renderHook(() => usePhotoPreviewCache([entry]));
    expect(second.result.current.getPreviewUrls(entry)).toEqual({
      thumbUrl: "blob:cached-thumb",
      stageUrl: "blob:cached-stage",
      loading: false,
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(createThumbnailPairFromFile).not.toHaveBeenCalled();
    second.unmount();
  });

  it("generates once for a miss, then remount hits the module cache", async () => {
    const entry = photo();
    const { result, unmount } = renderHook(() => usePhotoPreviewCache([entry]));

    expect(result.current.getPreviewUrls(entry).loading).toBe(true);

    await waitFor(() => {
      expect(result.current.getPreviewUrls(entry).loading).toBe(false);
    });
    expect(createThumbnailPairFromFile).toHaveBeenCalledTimes(1);
    const urls = result.current.getPreviewUrls(entry);
    expect(urls.thumbUrl).toBe("blob:gen-thumb");
    unmount();

    vi.mocked(createThumbnailPairFromFile).mockClear();
    const remount = renderHook(() => usePhotoPreviewCache([entry]));
    expect(remount.result.current.getPreviewUrls(entry)).toEqual({
      thumbUrl: "blob:gen-thumb",
      stageUrl: "blob:gen-stage",
      loading: false,
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(createThumbnailPairFromFile).not.toHaveBeenCalled();
    remount.unmount();
  });

  it("clearPhotoPreviewCache empties what the hook would read", () => {
    const entry = photo();
    const sig = previewCacheSignature(entry);
    putPhotoPreviewCacheEntry(entry.id, {
      sig,
      thumbUrl: "blob:cached-thumb",
      stageUrl: "blob:cached-stage",
    });
    clearPhotoPreviewCache();
    const { result, unmount } = renderHook(() => usePhotoPreviewCache([entry]));
    expect(result.current.getPreviewUrls(entry)).toEqual({
      thumbUrl: null,
      stageUrl: null,
      loading: true,
    });
    unmount();
  });
});
