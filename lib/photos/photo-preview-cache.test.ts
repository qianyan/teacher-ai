import { afterEach, describe, expect, it, vi } from "vitest";
import type { PhotoEntry } from "@/lib/photos/inject-blobs";
import { previewCacheSignature } from "@/lib/photos/preview-thumbnail";
import {
  clearPhotoPreviewCache,
  getPhotoPreviewCacheEntry,
  prunePhotoPreviewCache,
  putPhotoPreviewCacheEntry,
  __resetPhotoPreviewCacheForTests,
} from "@/lib/photos/photo-preview-cache";

function photo(overrides: Partial<PhotoEntry> = {}): PhotoEntry {
  const file = overrides.file ?? new File([new Uint8Array([1, 2, 3])], "a1.jpg", {
    type: "image/jpeg",
  });
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

afterEach(() => {
  __resetPhotoPreviewCacheForTests();
});

describe("photoPreviewCache", () => {
  it("misses until an entry is put, then hits for the same signature", () => {
    const entry = photo();
    const sig = previewCacheSignature(entry);

    expect(getPhotoPreviewCacheEntry(entry.id, sig)).toBeNull();

    putPhotoPreviewCacheEntry(entry.id, {
      sig,
      thumbUrl: "blob:thumb-1",
      stageUrl: "blob:stage-1",
    });

    expect(getPhotoPreviewCacheEntry(entry.id, sig)).toEqual({
      sig,
      thumbUrl: "blob:thumb-1",
      stageUrl: "blob:stage-1",
    });
  });

  it("misses when the signature no longer matches", () => {
    const entry = photo();
    const sig = previewCacheSignature(entry);
    putPhotoPreviewCacheEntry(entry.id, {
      sig,
      thumbUrl: "blob:thumb-1",
      stageUrl: "blob:stage-1",
    });

    expect(getPhotoPreviewCacheEntry(entry.id, "other-sig")).toBeNull();
  });

  it("prunes entries whose photo ids are no longer active and revokes their urls", () => {
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    putPhotoPreviewCacheEntry("gone", {
      sig: "s",
      thumbUrl: "blob:thumb-gone",
      stageUrl: "blob:stage-gone",
    });
    putPhotoPreviewCacheEntry("keep", {
      sig: "s",
      thumbUrl: "blob:thumb-keep",
      stageUrl: "blob:stage-keep",
    });

    prunePhotoPreviewCache(new Set(["keep"]));

    expect(getPhotoPreviewCacheEntry("gone", "s")).toBeNull();
    expect(getPhotoPreviewCacheEntry("keep", "s")).not.toBeNull();
    expect(revoke).toHaveBeenCalledWith("blob:thumb-gone");
    expect(revoke).toHaveBeenCalledWith("blob:stage-gone");
    expect(revoke).not.toHaveBeenCalledWith("blob:thumb-keep");
    revoke.mockRestore();
  });

  it("clearPhotoPreviewCache revokes every cached url", () => {
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    putPhotoPreviewCacheEntry("a", {
      sig: "s",
      thumbUrl: "blob:a-t",
      stageUrl: "blob:a-s",
    });
    putPhotoPreviewCacheEntry("b", {
      sig: "s",
      thumbUrl: "blob:b-t",
      stageUrl: "blob:b-s",
    });

    clearPhotoPreviewCache();

    expect(getPhotoPreviewCacheEntry("a", "s")).toBeNull();
    expect(getPhotoPreviewCacheEntry("b", "s")).toBeNull();
    expect(revoke).toHaveBeenCalledWith("blob:a-t");
    expect(revoke).toHaveBeenCalledWith("blob:a-s");
    expect(revoke).toHaveBeenCalledWith("blob:b-t");
    expect(revoke).toHaveBeenCalledWith("blob:b-s");
    revoke.mockRestore();
  });
});
