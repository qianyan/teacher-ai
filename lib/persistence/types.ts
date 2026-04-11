import type { PhotoEntry } from "@/lib/photos/inject-blobs";

/** One photo row stored in IndexedDB (Blob is IDB-native). */
export type PersistedPhoto = {
  id: string;
  logicalName: string;
  fileBlob: Blob;
  remoteUrl: string | null;
  remotePathname: string | null;
  uploadStatus: PhotoEntry["uploadStatus"];
  uploadError: string | null;
  uploadGeneration: number;
};

/** Shared payload for draft and history entries. */
export type ReportSnapshot = {
  biweeklyDateRange: string;
  subTitle: string;
  introHtml: string;
  bodyHtml: string;
  fullHtml: string | null;
  photos: PersistedPhoto[];
};

export type DraftRecord = {
  key: "current";
  updatedAt: number;
  snapshot: ReportSnapshot;
};

export type HistoryRecord = {
  id: string;
  savedAt: string;
  snapshot: ReportSnapshot;
};

export type HydratedEditorState = {
  biweeklyDateRange: string;
  subTitle: string;
  introHtml: string;
  bodyHtml: string;
  fullHtml: string | null;
  photos: PhotoEntry[];
};
