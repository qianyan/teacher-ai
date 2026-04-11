import type { PhotoEntry } from "@/lib/photos/inject-blobs";
import type { HydratedEditorState, PersistedPhoto, ReportSnapshot } from "./types";

export function photoEntryFromPersisted(p: PersistedPhoto): PhotoEntry {
  const file =
    p.fileBlob instanceof File
      ? p.fileBlob
      : new File([p.fileBlob], p.logicalName, {
          type: p.fileBlob.type || "application/octet-stream",
        });
  const blobUrl = URL.createObjectURL(file);
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
