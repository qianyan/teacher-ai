import type { SupabaseClient } from "@supabase/supabase-js";

export const HISTORY_MAX_ROWS = 20;
const HISTORY_TABLE = "history_entries";

type RemotePersistedPhoto = {
  id: string;
  logicalName: string;
  remoteUrl: string | null;
  remotePathname: string | null;
  uploadStatus: "pending" | "uploading" | "synced" | "error";
  uploadError: string | null;
  uploadGeneration: number;
};

export type RemoteReportSnapshot = {
  biweeklyDateRange: string;
  subTitle: string;
  introHtml: string;
  bodyHtml: string;
  fullHtml: string | null;
  photos: RemotePersistedPhoto[];
};

export type HistoryEntry = {
  id: string;
  savedAt: string;
  snapshot: RemoteReportSnapshot;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringOrNull(value: unknown): string | null {
  if (value === null) return null;
  return typeof value === "string" ? value : null;
}

function ensureNoFileBlob(value: unknown): boolean {
  if (Array.isArray(value)) return value.every(ensureNoFileBlob);
  if (!isRecord(value)) return true;
  if ("fileBlob" in value) return false;
  return Object.values(value).every(ensureNoFileBlob);
}

function parsePhoto(input: unknown): RemotePersistedPhoto | null {
  if (!isRecord(input)) return null;
  const id = input.id;
  const logicalName = input.logicalName;
  const uploadStatus = input.uploadStatus;
  const uploadGeneration = input.uploadGeneration;
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
    remoteUrl: stringOrNull(input.remoteUrl),
    remotePathname: stringOrNull(input.remotePathname),
    uploadStatus,
    uploadError: stringOrNull(input.uploadError),
    uploadGeneration,
  };
}

export function parseRemoteSnapshot(input: unknown): RemoteReportSnapshot | null {
  if (!isRecord(input) || !ensureNoFileBlob(input)) return null;
  const photos = input.photos;
  if (!Array.isArray(photos)) return null;
  const parsedPhotos: RemotePersistedPhoto[] = [];
  for (const p of photos) {
    const parsed = parsePhoto(p);
    if (!parsed) return null;
    parsedPhotos.push(parsed);
  }
  const { biweeklyDateRange, subTitle, introHtml, bodyHtml, fullHtml } = input;
  if (
    typeof biweeklyDateRange !== "string" ||
    typeof subTitle !== "string" ||
    typeof introHtml !== "string" ||
    typeof bodyHtml !== "string" ||
    (fullHtml !== null && typeof fullHtml !== "string")
  ) {
    return null;
  }
  return { biweeklyDateRange, subTitle, introHtml, bodyHtml, fullHtml, photos: parsedPhotos };
}

function mapRowToEntry(row: Record<string, unknown>): HistoryEntry {
  const id = typeof row.id === "string" ? row.id : "";
  const savedAt =
    typeof row.saved_at === "string"
      ? row.saved_at
      : new Date(row.saved_at as string | number | Date).toISOString();
  const snapshot = parseRemoteSnapshot(row.snapshot_json);
  if (!id || !snapshot) throw new Error("History row shape is invalid");
  return { id, savedAt, snapshot };
}

export async function listHistoryEntries(client: SupabaseClient): Promise<HistoryEntry[]> {
  const { data, error } = await client
    .from(HISTORY_TABLE)
    .select("id,saved_at,snapshot_json")
    .order("saved_at", { ascending: false })
    .limit(HISTORY_MAX_ROWS);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapRowToEntry(row as Record<string, unknown>));
}

export async function getHistoryEntry(
  client: SupabaseClient,
  id: string,
): Promise<HistoryEntry | null> {
  const { data, error } = await client
    .from(HISTORY_TABLE)
    .select("id,saved_at,snapshot_json")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapRowToEntry(data as Record<string, unknown>);
}

export async function insertHistoryEntry(
  client: SupabaseClient,
  input: { userId: string; snapshot: RemoteReportSnapshot; savedAt?: string },
): Promise<HistoryEntry> {
  const payload: Record<string, unknown> = {
    user_id: input.userId,
    snapshot_json: input.snapshot,
  };
  if (input.savedAt) payload.saved_at = input.savedAt;
  const { data, error } = await client
    .from(HISTORY_TABLE)
    .insert(payload)
    .select("id,saved_at,snapshot_json")
    .single();
  if (error) throw new Error(error.message);
  return mapRowToEntry(data as Record<string, unknown>);
}

export async function deleteHistoryEntry(client: SupabaseClient, id: string): Promise<boolean> {
  const { data, error } = await client
    .from(HISTORY_TABLE)
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data);
}

export function userScopedStoragePath(userId: string, relativePath: string): string {
  const trimmed = relativePath.replace(/^\/+/, "");
  if (trimmed.startsWith(`${userId}/`)) return trimmed;
  return `${userId}/${trimmed}`;
}

export function assertUserOwnsStoragePath(userId: string, objectPath: string): boolean {
  return objectPath === userId || objectPath.startsWith(`${userId}/`);
}
