import type { PhotoEntry } from "@/lib/photos/inject-blobs";
import type { PersistedPhoto, ReportSnapshot } from "./types";

function persistedFromEntry(entry: PhotoEntry): PersistedPhoto {
  return {
    id: entry.id,
    logicalName: entry.logicalName,
    fileBlob: entry.file,
    remoteUrl: entry.remoteUrl,
    remotePathname: entry.remotePathname,
    uploadStatus: entry.uploadStatus,
    uploadError: entry.uploadError,
    uploadGeneration: entry.uploadGeneration,
  };
}

export type SnapshotInput = {
  biweeklyDateRange: string;
  subTitle: string;
  introHtml: string;
  bodyHtml: string;
  fullHtml: string | null;
  photos: PhotoEntry[];
};

export function snapshotFromState(input: SnapshotInput): ReportSnapshot {
  return {
    biweeklyDateRange: input.biweeklyDateRange,
    subTitle: input.subTitle,
    introHtml: input.introHtml,
    bodyHtml: input.bodyHtml,
    fullHtml: input.fullHtml,
    photos: input.photos.map(persistedFromEntry),
  };
}
