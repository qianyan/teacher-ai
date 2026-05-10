import type { PhotoEntry } from "@/lib/photos/inject-blobs";
import type { HydratedEditorState, PersistedPhoto, ReportSnapshot } from "./types";

export function photoEntryFromPersisted(p: PersistedPhoto): PhotoEntry {
  const blob = p.fileBlob;
  const hasLocalBlob = blob instanceof Blob;
  const file = hasLocalBlob
    ? blob instanceof File
      ? blob
      : new File([blob], p.logicalName, {
          type: blob.type || "application/octet-stream",
        })
    : new File([], p.logicalName, { type: "application/octet-stream" });
  const blobUrl = hasLocalBlob
    ? URL.createObjectURL(file)
    : p.remoteUrl || URL.createObjectURL(file);
  const hadRemote = Boolean(p.remoteUrl);
  let uploadStatus = p.uploadStatus;
  if (hadRemote) {
    uploadStatus = "synced";
  } else if (uploadStatus === "uploading") {
    uploadStatus = "pending";
  }
  return {
    id: p.id,
    file,
    logicalName: p.logicalName,
    blobUrl,
    remoteUrl: p.remoteUrl,
    remotePathname: p.remotePathname,
    uploadStatus,
    uploadError: hadRemote ? null : p.uploadError,
    uploadGeneration: p.uploadGeneration,
    ingestError: null,
  };
}

/** Revoke object URLs for entries (call before replacing photos from restore). */
export function revokePhotoEntryBlobUrls(photos: PhotoEntry[]): void {
  for (const p of photos) {
    if (p.blobUrl.startsWith("blob:")) {
      try {
        URL.revokeObjectURL(p.blobUrl);
      } catch {
        /* ignore */
      }
    }
  }
}

export function hydrateStateFromSnapshot(snapshot: ReportSnapshot): HydratedEditorState {
  const photos = snapshot.photos.map(photoEntryFromPersisted);
  return {
    biweeklyDateRange: snapshot.biweeklyDateRange,
    subTitle: snapshot.subTitle,
    introHtml: snapshot.introHtml,
    bodyHtml: snapshot.bodyHtml,
    fullHtml: snapshot.fullHtml,
    photos,
  };
}
