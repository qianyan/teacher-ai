import type { PhotoEntry } from "@/lib/photos/inject-blobs";
import type { ReportTemplateId } from "@/lib/report/templates";
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
  templateId: ReportTemplateId;
  biweeklyDateRange: string;
  englishClassName: string;
  subTitle: string;
  introHtml: string;
  bodyHtml: string;
  fullHtml: string | null;
  photos: PhotoEntry[];
};

export function snapshotFromState(input: SnapshotInput): ReportSnapshot {
  return {
    templateId: input.templateId,
    biweeklyDateRange: input.biweeklyDateRange,
    englishClassName: input.englishClassName,
    subTitle: input.subTitle,
    introHtml: input.introHtml,
    bodyHtml: input.bodyHtml,
    fullHtml: input.fullHtml,
    photos: input.photos.map(persistedFromEntry),
  };
}
