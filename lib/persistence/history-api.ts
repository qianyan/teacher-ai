import type { HistoryRecord, PersistedPhoto, ReportSnapshot } from "./types";

type RemotePersistedPhoto = Omit<PersistedPhoto, "fileBlob">;
type RemoteReportSnapshot = Omit<ReportSnapshot, "photos"> & {
  photos: RemotePersistedPhoto[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringOrNull(value: unknown): string | null {
  if (value === null) return null;
  return typeof value === "string" ? value : null;
}

function toRemoteSnapshot(snapshot: ReportSnapshot): RemoteReportSnapshot {
  return {
    biweeklyDateRange: snapshot.biweeklyDateRange,
    subTitle: snapshot.subTitle,
    introHtml: snapshot.introHtml,
    bodyHtml: snapshot.bodyHtml,
    fullHtml: snapshot.fullHtml,
    photos: snapshot.photos.map((photo) => ({
      id: photo.id,
      logicalName: photo.logicalName,
      remoteUrl: photo.remoteUrl,
      remotePathname: photo.remotePathname,
      uploadStatus: photo.uploadStatus,
      uploadError: photo.uploadError,
      uploadGeneration: photo.uploadGeneration,
    })),
  };
}

function parsePhoto(value: unknown): RemotePersistedPhoto | null {
  if (!isRecord(value)) return null;
  if ("fileBlob" in value) return null;
  const id = value.id;
  const logicalName = value.logicalName;
  const uploadStatus = value.uploadStatus;
  const uploadGeneration = value.uploadGeneration;
  if (
    typeof id !== "string" ||
    typeof logicalName !== "string" ||
    (uploadStatus !== "pending" &&
      uploadStatus !== "uploading" &&
      uploadStatus !== "synced" &&
      uploadStatus !== "error") ||
    typeof uploadGeneration !== "number"
  ) {
    return null;
  }
  return {
    id,
    logicalName,
    remoteUrl: stringOrNull(value.remoteUrl),
    remotePathname: stringOrNull(value.remotePathname),
    uploadStatus,
    uploadError: stringOrNull(value.uploadError),
    uploadGeneration,
  };
}

function parseSnapshot(value: unknown): ReportSnapshot | null {
  if (!isRecord(value)) return null;
  const photos = value.photos;
  if (!Array.isArray(photos)) return null;

  const parsedPhotos: PersistedPhoto[] = [];
  for (const p of photos) {
    const parsed = parsePhoto(p);
    if (!parsed) return null;
    parsedPhotos.push(parsed);
  }

  const biweeklyDateRange = value.biweeklyDateRange;
  const subTitle = value.subTitle;
  const introHtml = value.introHtml;
  const bodyHtml = value.bodyHtml;
  const fullHtml = value.fullHtml;
  if (
    typeof biweeklyDateRange !== "string" ||
    typeof subTitle !== "string" ||
    typeof introHtml !== "string" ||
    typeof bodyHtml !== "string" ||
    (fullHtml !== null && typeof fullHtml !== "string")
  ) {
    return null;
  }

  return {
    biweeklyDateRange,
    subTitle,
    introHtml,
    bodyHtml,
    fullHtml,
    photos: parsedPhotos,
  };
}

function parseHistoryRecord(value: unknown): HistoryRecord | null {
  if (!isRecord(value)) return null;
  const id = value.id;
  const savedAt = value.savedAt;
  if (typeof id !== "string" || typeof savedAt !== "string") return null;
  const snapshot = parseSnapshot(value.snapshot);
  if (!snapshot) return null;
  return { id, savedAt, snapshot };
}

async function parseJson<T>(res: Response): Promise<T> {
  try {
    return (await res.json()) as T;
  } catch {
    throw new Error(`HTTP ${res.status}: invalid JSON response`);
  }
}

export async function listHistoryRemote(): Promise<HistoryRecord[]> {
  const res = await fetch("/api/history", { cache: "no-store" });
  const body = await parseJson<{ error?: string; history?: unknown }>(res);
  if (!res.ok) {
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  if (!Array.isArray(body.history)) {
    throw new Error("Invalid history list response");
  }
  const rows = body.history
    .map((row) => parseHistoryRecord(row))
    .filter((row): row is HistoryRecord => Boolean(row));
  return rows;
}

export async function addHistoryRemote(snapshot: ReportSnapshot): Promise<HistoryRecord> {
  const res = await fetch("/api/history", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ snapshot: toRemoteSnapshot(snapshot) }),
  });
  const body = await parseJson<{ error?: string; history?: unknown }>(res);
  if (!res.ok) {
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  const row = parseHistoryRecord(body.history);
  if (!row) {
    throw new Error("Invalid history create response");
  }
  return row;
}

export async function getHistoryEntryRemote(id: string): Promise<HistoryRecord | null> {
  const res = await fetch(`/api/history/${encodeURIComponent(id)}`, {
    cache: "no-store",
  });
  const body = await parseJson<{ error?: string; history?: unknown }>(res);
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  const row = parseHistoryRecord(body.history);
  if (!row) {
    throw new Error("Invalid history item response");
  }
  return row;
}

export async function deleteHistoryRemote(id: string): Promise<void> {
  const res = await fetch(`/api/history/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  const body = await parseJson<{ error?: string }>(res);
  if (res.status === 404) return;
  if (!res.ok) {
    throw new Error(body.error || `HTTP ${res.status}`);
  }
}
