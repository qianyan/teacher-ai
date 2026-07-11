#!/usr/bin/env tsx
/**
 * Find and delete orphan report photos in Supabase Storage.
 *
 * Orphans are objects in the report-photos bucket that are not referenced by
 * any history_entries.snapshot_json.photos entry (remotePathname or remoteUrl).
 *
 * Note: IndexedDB drafts are client-only and invisible to this script. Use
 * --grace-hours (default 24) to reduce risk of deleting in-progress uploads.
 *
 * Usage:
 *   npx tsx scripts/cleanup-orphan-photos.ts
 *   npx tsx scripts/cleanup-orphan-photos.ts --delete
 *   npx tsx scripts/cleanup-orphan-photos.ts --env-file .vercel/.env.production.local
 *   npx tsx scripts/cleanup-orphan-photos.ts --user-id <uuid> --grace-hours 48
 */
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseRemoteSnapshot } from "../lib/server/history-store";
import { objectPathFromSupabasePublicUrl } from "../lib/server/parse-supabase-storage-public-url";
import { getReportPhotosBucket } from "../lib/server/report-photos-bucket";
import { getSupabaseAdminClient } from "../lib/server/supabase-admin";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_ENV_FILE = resolve(ROOT, ".env.local");
const HISTORY_PAGE_SIZE = 500;
const STORAGE_LIST_PAGE_SIZE = 1000;
const DELETE_BATCH_SIZE = 100;

type CliOptions = {
  envFile: string;
  delete: boolean;
  graceHours: number;
  userId: string | null;
};

type StorageObject = {
  path: string;
  updatedAt: string | null;
};

function usage(): string {
  return [
    "Usage: npx tsx scripts/cleanup-orphan-photos.ts [options]",
    "",
    "Options:",
    "  --env-file <path>   Env file (default: .env.local)",
    "  --delete            Actually delete orphans (default: dry-run)",
    "  --grace-hours <n>   Skip objects updated within N hours (default: 24)",
    "  --user-id <uuid>    Only scan/delete under this user prefix",
    "  -h, --help          Show this help",
    "",
    "Examples:",
    "  npx tsx scripts/cleanup-orphan-photos.ts",
    "  npx tsx scripts/cleanup-orphan-photos.ts --delete",
    "  npx tsx scripts/cleanup-orphan-photos.ts --env-file .vercel/.env.production.local --delete",
  ].join("\n");
}

function parseArgs(argv: string[]): CliOptions {
  let envFile = DEFAULT_ENV_FILE;
  let deleteOrphans = false;
  let graceHours = 24;
  let userId: string | null = null;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];

    if (arg === "--env-file") {
      if (!next) throw new Error(`Missing value for --env-file.\n\n${usage()}`);
      envFile = resolve(ROOT, next);
      i += 1;
      continue;
    }

    if (arg === "--delete") {
      deleteOrphans = true;
      continue;
    }

    if (arg === "--grace-hours") {
      if (!next) throw new Error(`Missing value for --grace-hours.\n\n${usage()}`);
      graceHours = Number.parseFloat(next);
      if (!Number.isFinite(graceHours) || graceHours < 0) {
        throw new Error(`Invalid --grace-hours value: ${next}\n\n${usage()}`);
      }
      i += 1;
      continue;
    }

    if (arg === "--user-id") {
      if (!next) throw new Error(`Missing value for --user-id.\n\n${usage()}`);
      userId = next.trim();
      if (!userId) throw new Error(`Invalid --user-id value.\n\n${usage()}`);
      i += 1;
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      console.log(usage());
      process.exit(0);
    }

    throw new Error(`Unknown argument: ${arg}\n\n${usage()}`);
  }

  return { envFile, delete: deleteOrphans, graceHours, userId };
}

function loadEnv(envFile: string): void {
  if (!existsSync(envFile)) {
    throw new Error(`Env file not found: ${envFile}`);
  }
  const result = dotenv.config({ path: envFile, override: true });
  if (result.error) {
    throw new Error(`Could not load ${envFile}: ${result.error.message}`);
  }
}

function normalizeObjectPath(path: string): string {
  return path.replace(/^\/+/, "");
}

function addReferencedPath(referenced: Set<string>, path: string | null | undefined): void {
  if (!path) return;
  const normalized = normalizeObjectPath(path);
  if (!normalized || normalized.includes("..")) return;
  referenced.add(normalized);
}

async function collectReferencedPaths(admin: SupabaseClient): Promise<Set<string>> {
  const referenced = new Set<string>();
  let offset = 0;

  while (true) {
    const { data, error } = await admin
      .from("history_entries")
      .select("snapshot_json")
      .order("saved_at", { ascending: false })
      .range(offset, offset + HISTORY_PAGE_SIZE - 1);

    if (error) throw new Error(`Failed to read history_entries: ${error.message}`);
    if (!data || data.length === 0) break;

    for (const row of data) {
      const snapshot = parseRemoteSnapshot(row.snapshot_json);
      if (!snapshot) continue;

      for (const photo of snapshot.photos) {
        addReferencedPath(referenced, photo.remotePathname);
        if (photo.remoteUrl) {
          addReferencedPath(referenced, objectPathFromSupabasePublicUrl(photo.remoteUrl));
        }
      }
    }

    if (data.length < HISTORY_PAGE_SIZE) break;
    offset += HISTORY_PAGE_SIZE;
  }

  return referenced;
}

async function listStorageObjects(
  admin: SupabaseClient,
  bucket: string,
  prefix: string,
): Promise<StorageObject[]> {
  const objects: StorageObject[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await admin.storage.from(bucket).list(prefix, {
      limit: STORAGE_LIST_PAGE_SIZE,
      offset,
      sortBy: { column: "name", order: "asc" },
    });

    if (error) {
      throw new Error(`Failed to list storage prefix "${prefix}": ${error.message}`);
    }
    if (!data || data.length === 0) break;

    for (const item of data) {
      const itemPath = prefix ? `${prefix}/${item.name}` : item.name;

      if (item.id === null) {
        const nested = await listStorageObjects(admin, bucket, itemPath);
        objects.push(...nested);
        continue;
      }

      objects.push({
        path: itemPath,
        updatedAt: typeof item.updated_at === "string" ? item.updated_at : null,
      });
    }

    if (data.length < STORAGE_LIST_PAGE_SIZE) break;
    offset += STORAGE_LIST_PAGE_SIZE;
  }

  return objects;
}

function isWithinGracePeriod(updatedAt: string | null, graceHours: number): boolean {
  if (graceHours <= 0 || !updatedAt) return false;
  const updatedMs = Date.parse(updatedAt);
  if (!Number.isFinite(updatedMs)) return false;
  return Date.now() - updatedMs < graceHours * 60 * 60 * 1000;
}

async function deleteInBatches(
  admin: SupabaseClient,
  bucket: string,
  paths: string[],
): Promise<void> {
  for (let i = 0; i < paths.length; i += DELETE_BATCH_SIZE) {
    const batch = paths.slice(i, i + DELETE_BATCH_SIZE);
    const { error } = await admin.storage.from(bucket).remove(batch);
    if (error) {
      throw new Error(`Failed to delete batch starting at index ${i}: ${error.message}`);
    }
  }
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  loadEnv(options.envFile);

  const admin = getSupabaseAdminClient();
  const bucket = getReportPhotosBucket();
  const listPrefix = options.userId ?? "";

  console.log(`Bucket: ${bucket}`);
  console.log(`Env: ${options.envFile}`);
  console.log(`Mode: ${options.delete ? "DELETE" : "dry-run"}`);
  console.log(`Grace period: ${options.graceHours}h`);
  if (options.userId) console.log(`User scope: ${options.userId}`);
  console.log("");

  console.log("Collecting referenced photo paths from history_entries...");
  const referenced = await collectReferencedPaths(admin);
  console.log(`Referenced paths: ${referenced.size}`);

  console.log("Listing storage objects...");
  const storageObjects = await listStorageObjects(admin, bucket, listPrefix);
  console.log(`Storage objects: ${storageObjects.length}`);

  const orphanCandidates = storageObjects.filter((obj) => !referenced.has(obj.path));
  const skippedByGrace = orphanCandidates.filter((obj) =>
    isWithinGracePeriod(obj.updatedAt, options.graceHours),
  );
  const orphans = orphanCandidates.filter(
    (obj) => !isWithinGracePeriod(obj.updatedAt, options.graceHours),
  );

  console.log("");
  console.log(`Orphan candidates: ${orphanCandidates.length}`);
  console.log(`Skipped (grace period): ${skippedByGrace.length}`);
  console.log(`Orphans to ${options.delete ? "delete" : "report"}: ${orphans.length}`);

  if (orphans.length === 0) {
    console.log("\nNothing to do.");
    return;
  }

  for (const obj of orphans) {
    const age = obj.updatedAt ? `updated ${obj.updatedAt}` : "unknown age";
    console.log(`  - ${obj.path} (${age})`);
  }

  if (!options.delete) {
    console.log("\nDry-run complete. Re-run with --delete to remove these objects.");
    return;
  }

  console.log("\nDeleting orphans...");
  await deleteInBatches(
    admin,
    bucket,
    orphans.map((obj) => obj.path),
  );
  console.log(`Deleted ${orphans.length} object(s).`);
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(message);
  process.exit(1);
});
