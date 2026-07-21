import { describe, expect, it } from "vitest";
import { allReportPhotosSynced } from "@/lib/photos/sync-guard";
import type { PhotoEntry } from "@/lib/photos/inject-blobs";

function photo(overrides: Partial<PhotoEntry> = {}): PhotoEntry {
  return {
    id: "1",
    file: new File([], "a1.jpg"),
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

describe("allReportPhotosSynced", () => {
  it("allows generation when there are no photos", () => {
    expect(allReportPhotosSynced([])).toBe(true);
  });

  it("is false while any photo is still pending", () => {
    expect(
      allReportPhotosSynced([
        photo({ uploadStatus: "synced", remoteUrl: "https://x/y.jpg" }),
        photo({ uploadStatus: "pending" }),
      ]),
    ).toBe(false);
  });

  it("is true only when every photo is synced with a remote url", () => {
    expect(
      allReportPhotosSynced([
        photo({ uploadStatus: "synced", remoteUrl: "https://x/1.jpg" }),
        photo({
          id: "2",
          logicalName: "a2.jpg",
          uploadStatus: "synced",
          remoteUrl: "https://x/2.jpg",
        }),
      ]),
    ).toBe(true);
  });

  it("is false when synced but the remote url is missing", () => {
    expect(
      allReportPhotosSynced([photo({ uploadStatus: "synced", remoteUrl: "" })]),
    ).toBe(false);
  });
});
